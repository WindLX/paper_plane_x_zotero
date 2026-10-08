import { createPaperApiClient, PaperDetailResponse } from "@/domain/paper";
import {
  BatchItemMetadata,
  BatchSkipReason,
  chunkPaperIDs,
  indexDetailsByPaperID,
  planPaperIDGroups,
  uniquePaperIDs,
} from "@/domain/paperBatch";
import { paperMetadataRepository } from "@/infra/zotero/paperMetadataRepository";
import {
  createPaperProgress,
  showPaperNotice,
} from "@/infra/zotero/paperNotificationService";
import { getString } from "@/utils/locale";
import { beginBatchSession } from "../batch/session";
import { describeBatchSkipReason } from "../batch/skipReason";
import { syncPaperDetailToItem } from "../sync/detailSync";

export interface FetchStats {
  success: number;
  failed: number;
  skipped: number;
  stopped: boolean;
}

export interface FetchDependencies {
  readPaperID(item: Zotero.Item): string;
  batchGetPapers(paperIDs: string[]): Promise<{ items: PaperDetailResponse[] }>;
  syncDetail(item: Zotero.Item, detail: PaperDetailResponse): Promise<void>;
}

export interface FetchCallbacks {
  onProgress?(processed: number, total: number): void;
  onSkip?(item: Zotero.Item, reason: BatchSkipReason, status: string): void;
  onMissing?(item: Zotero.Item, paperID: string): void;
  onError?(item: Zotero.Item, reason: string): void;
  shouldContinue?(): boolean;
}

const paperApiClient = createPaperApiClient();

const defaultDependencies: FetchDependencies = {
  readPaperID(item) {
    return paperMetadataRepository.read(item).paperID;
  },
  batchGetPapers(paperIDs) {
    return paperApiClient.batchGetPapers(paperIDs);
  },
  syncDetail(item, detail) {
    return syncPaperDetailToItem(item, detail);
  },
};

/**
 * Refreshes item metadata with chunked batch-get requests. Items sharing a
 * paper_id share one request and one detail, but each item is written serially.
 * A failing chunk or item is reported and the remaining items still run.
 */
export async function fetchPaperDetailsForItems(
  items: Zotero.Item[],
  dependencies: FetchDependencies = defaultDependencies,
  callbacks: FetchCallbacks = {},
): Promise<FetchStats> {
  const stats: FetchStats = {
    success: 0,
    failed: 0,
    skipped: 0,
    stopped: false,
  };
  if (items.length === 0) {
    return stats;
  }

  const itemsByID = new Map(items.map((item) => [item.id, item]));
  const metadata: BatchItemMetadata[] = items.map((item) => ({
    itemID: item.id,
    paperID: dependencies.readPaperID(item).trim(),
    status: "",
    hasLocalPDF: false,
  }));
  const plan = planPaperIDGroups(metadata);
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

  const details = new Map<string, PaperDetailResponse>();
  const chunkErrors = new Map<string, string>();
  const chunks = chunkPaperIDs(uniquePaperIDs(plan.groups));
  for (const chunk of chunks) {
    if (isStopped()) {
      stats.stopped = true;
      return stats;
    }
    try {
      const response = await dependencies.batchGetPapers(chunk);
      indexDetailsByPaperID(response.items).forEach((detail, paperID) => {
        details.set(paperID, detail);
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      chunk.forEach((paperID) => chunkErrors.set(paperID, reason));
    }
  }

  for (const group of plan.groups) {
    if (isStopped()) {
      stats.stopped = true;
      return stats;
    }
    const detail = details.get(group.paperID);
    for (const itemID of group.itemIDs) {
      if (isStopped()) {
        stats.stopped = true;
        return stats;
      }
      const item = itemsByID.get(itemID);
      if (!item) {
        continue;
      }
      if (!detail) {
        stats.failed += 1;
        const requestError = chunkErrors.get(group.paperID);
        if (requestError) {
          callbacks.onError?.(item, requestError);
        } else {
          callbacks.onMissing?.(item, group.paperID);
        }
        advance();
        continue;
      }
      try {
        await dependencies.syncDetail(item, detail);
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

export async function fetchSelectedPaperDetails(
  items: Zotero.Item[],
  win: Window,
) {
  if (!paperApiClient.getBaseURL()) {
    showPaperNotice(getString("fetch-base-url-missing"), "warning");
    return;
  }
  if (items.length === 0) {
    showPaperNotice(getString("fetch-no-selection"), "warning");
    return;
  }

  const session = beginBatchSession(win);
  if (!session) {
    showPaperNotice(getString("batch-already-running"), "warning");
    return;
  }

  const progress = createPaperProgress(getString("fetch-start"));
  try {
    const stats = await fetchPaperDetailsForItems(items, defaultDependencies, {
      onProgress(processed, total) {
        progress.update(
          total === 0 ? 100 : Math.round((processed / total) * 100),
          `${processed}/${total}`,
        );
      },
      onSkip(item, reason, status) {
        showPaperNotice(
          getString("fetch-item-skipped", {
            args: {
              title: describeItem(item),
              reason: describeBatchSkipReason(reason, status),
            },
          }),
          "warning",
        );
      },
      onMissing(item, paperID) {
        showPaperNotice(
          getString("fetch-item-missing", {
            args: { title: describeItem(item), paperID },
          }),
          "error",
        );
      },
      onError(item, reason) {
        showPaperNotice(
          getString("fetch-item-failed", {
            args: { title: describeItem(item), reason },
          }),
          "error",
        );
        ztoolkit.log("Paper detail batch fetch failed", item.id, reason);
      },
      shouldContinue: () => session.isActive(),
    });
    progress.finish(
      getString("fetch-finish", {
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
