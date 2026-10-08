import { createPaperApiClient } from "@/domain/paper/paperApiClient";
import { getFirstPdfPath } from "@/domain/paper/mappers";
import { UploadResponse } from "@/domain/paper/types";
import {
  BatchItemMetadata,
  BatchSkipReason,
  planReprocessGroups,
} from "@/domain/paperBatch";
import {
  LocalPaperMetadata,
  paperMetadataRepository,
} from "@/infra/zotero/paperMetadataRepository";
import {
  createPaperProgress,
  showPaperNotice,
} from "@/infra/zotero/paperNotificationService";
import { getString } from "@/utils/locale";
import { beginBatchSession } from "../batch/session";
import { describeBatchSkipReason } from "../batch/skipReason";

export interface ReprocessStats {
  success: number;
  failed: number;
  skipped: number;
  stopped: boolean;
}

export interface ReprocessDependencies {
  readMetadata(item: Zotero.Item): LocalPaperMetadata;
  hasLocalPDF(item: Zotero.Item): boolean;
  reprocess(item: Zotero.Item, paperID: string): Promise<UploadResponse>;
  writeMetadata(
    item: Zotero.Item,
    patch: Partial<LocalPaperMetadata>,
  ): Promise<LocalPaperMetadata>;
}

export interface ReprocessCallbacks {
  onProgress?(processed: number, total: number): void;
  onSkip?(item: Zotero.Item, reason: BatchSkipReason, status: string): void;
  onError?(item: Zotero.Item, reason: string): void;
  shouldContinue?(): boolean;
}

const paperApiClient = createPaperApiClient();

const defaultDependencies: ReprocessDependencies = {
  readMetadata(item) {
    return paperMetadataRepository.read(item);
  },
  hasLocalPDF(item) {
    return Boolean(getFirstPdfPath(item));
  },
  reprocess(item, paperID) {
    return paperApiClient.reprocess(item, paperID);
  },
  writeMetadata(item, patch) {
    return paperMetadataRepository.write(item, patch);
  },
};

/**
 * A merged group shares one backend request. That request decides the fate of
 * the whole group, while each item's local metadata write is isolated so one
 * failing save cannot re-count the items that already succeeded. Every item is
 * counted at most once, so success + failed + skipped never exceeds the total;
 * when the owning window closes, the remaining items are left uncounted and the
 * result reports that the batch stopped.
 */
export async function reprocessItems(
  items: Zotero.Item[],
  dependencies: ReprocessDependencies = defaultDependencies,
  callbacks: ReprocessCallbacks = {},
): Promise<ReprocessStats> {
  const stats: ReprocessStats = {
    success: 0,
    failed: 0,
    skipped: 0,
    stopped: false,
  };
  if (items.length === 0) {
    return stats;
  }

  const itemsByID = new Map(items.map((item) => [item.id, item]));
  const metadata: BatchItemMetadata[] = items.map((item) => {
    const meta = dependencies.readMetadata(item);
    return {
      itemID: item.id,
      paperID: meta.paperID.trim(),
      status: meta.status,
      hasLocalPDF: dependencies.hasLocalPDF(item),
    };
  });
  const plan = planReprocessGroups(metadata);
  const total = items.length;
  let processed = 0;
  const isStopped = () =>
    callbacks.shouldContinue ? !callbacks.shouldContinue() : false;
  const advance = () => {
    processed += 1;
    callbacks.onProgress?.(processed, total);
  };

  for (const skip of plan.skips) {
    if (isStopped()) {
      stats.stopped = true;
      return stats;
    }
    const item = itemsByID.get(skip.itemID);
    stats.skipped += 1;
    if (item) {
      callbacks.onSkip?.(item, skip.reason, skip.status);
    }
    advance();
  }

  for (const group of plan.groups) {
    if (isStopped()) {
      stats.stopped = true;
      return stats;
    }

    let response: UploadResponse;
    try {
      const sourceItem =
        group.pdfSourceItemID === null
          ? undefined
          : itemsByID.get(group.pdfSourceItemID);
      if (!sourceItem) {
        throw new Error("local pdf source item is no longer available");
      }
      response = await dependencies.reprocess(sourceItem, group.paperID);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      for (const itemID of group.itemIDs) {
        if (isStopped()) {
          stats.stopped = true;
          return stats;
        }
        const item = itemsByID.get(itemID);
        if (item) {
          callbacks.onError?.(item, reason);
        }
        stats.failed += 1;
        advance();
      }
      continue;
    }

    for (const itemID of group.itemIDs) {
      if (isStopped()) {
        stats.stopped = true;
        return stats;
      }
      const item = itemsByID.get(itemID);
      if (!item) {
        continue;
      }
      try {
        await dependencies.writeMetadata(item, {
          paperID: response.paper_id || group.paperID,
          status: response.status,
          message: response.message,
        });
        stats.success += 1;
      } catch (error) {
        stats.failed += 1;
        callbacks.onError?.(
          item,
          error instanceof Error ? error.message : String(error),
        );
      }
      advance();
      if (isStopped()) {
        stats.stopped = true;
        return stats;
      }
    }
  }

  return stats;
}

export async function reprocessSelectedItems(
  items: Zotero.Item[],
  win: Window,
) {
  if (!paperApiClient.getBaseURL()) {
    showPaperNotice(getString("reprocess-base-url-missing"), "warning");
    return;
  }
  if (items.length === 0) {
    showPaperNotice(getString("reprocess-no-selection"), "warning");
    return;
  }

  const confirmed = win.confirm(
    getString("reprocess-confirm", { args: { count: items.length } }),
  );
  if (!confirmed) {
    return;
  }

  const session = beginBatchSession(win);
  if (!session) {
    showPaperNotice(getString("batch-already-running"), "warning");
    return;
  }

  const progress = createPaperProgress(
    getString("reprocess-start", { args: { count: items.length } }),
  );
  try {
    const stats = await reprocessItems(items, defaultDependencies, {
      onProgress(processed, total) {
        progress.update(
          total === 0 ? 100 : Math.round((processed / total) * 100),
          `${processed}/${total}`,
        );
      },
      onSkip(item, reason, status) {
        showPaperNotice(
          getString("reprocess-item-skipped", {
            args: {
              title: describeItem(item),
              reason: describeBatchSkipReason(reason, status),
            },
          }),
          "warning",
        );
      },
      onError(item, reason) {
        showPaperNotice(
          getString("reprocess-item-failed", {
            args: { title: describeItem(item), reason },
          }),
          "error",
        );
      },
      shouldContinue: () => session.isActive(),
    });
    progress.finish(
      getString("reprocess-finish", {
        args: {
          success: stats.success,
          failed: stats.failed,
          skipped: stats.skipped,
        },
      }),
    );
    if (stats.stopped) {
      showPaperNotice(getString("batch-stopped"), "warning");
    }
  } finally {
    session.finish();
  }
}

function describeItem(item: Zotero.Item) {
  return item.getField("title") || `${item.id}`;
}
