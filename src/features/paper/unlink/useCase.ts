import { createPaperApiClient } from "@/domain/paper/paperApiClient";
import {
  BatchItemMetadata,
  BatchSkipReason,
  planPaperIDGroups,
} from "@/domain/paperBatch";
import { paperMetadataRepository } from "@/infra/zotero/paperMetadataRepository";
import {
  createPaperProgress,
  showPaperNotice,
} from "@/infra/zotero/paperNotificationService";
import { getString } from "@/utils/locale";
import { isWindowAlive } from "@/utils/window";
import { openProjectPickerDialog } from "@/features/paper/link/dialog";
import { beginBatchSession } from "../batch/session";
import { describeBatchSkipReason } from "../batch/skipReason";

export interface UnlinkStats {
  success: number;
  failed: number;
  skipped: number;
  stopped: boolean;
}

export interface UnlinkDependencies {
  readPaperID(item: Zotero.Item): string;
  unlinkProject(projectID: string, paperID: string): Promise<void>;
}

export interface UnlinkCallbacks {
  onProgress?(processed: number, total: number): void;
  onSkip?(item: Zotero.Item, reason: BatchSkipReason, status: string): void;
  onError?(item: Zotero.Item, reason: string): void;
  shouldContinue?(): boolean;
}

const paperApiClient = createPaperApiClient();

const defaultDependencies: UnlinkDependencies = {
  readPaperID(item) {
    return paperMetadataRepository.read(item).paperID;
  },
  async unlinkProject(projectID, paperID) {
    await paperApiClient.unlinkProject(projectID, paperID);
  },
};

/**
 * Removes one project link per unique paper_id. The Zotero item, its PDF
 * attachments, the paper_id binding, and every other project link stay intact.
 * The whole selection is passed in, so items without a binding are reported as
 * skipped instead of disappearing from the summary. Each item is counted once.
 */
export async function unlinkItemsFromProject(
  items: Zotero.Item[],
  projectID: string,
  dependencies: UnlinkDependencies = defaultDependencies,
  callbacks: UnlinkCallbacks = {},
): Promise<UnlinkStats> {
  const stats: UnlinkStats = {
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

  for (const group of plan.groups) {
    if (isStopped()) {
      stats.stopped = true;
      return stats;
    }
    try {
      await dependencies.unlinkProject(projectID, group.paperID);
      for (const itemID of group.itemIDs) {
        if (isStopped()) {
          stats.stopped = true;
          return stats;
        }
        if (itemsByID.has(itemID)) {
          stats.success += 1;
          advance();
        }
      }
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
    }
  }

  return stats;
}

export async function unlinkSelectedItemsFromProject(
  items: Zotero.Item[],
  win: Window,
) {
  if (!paperApiClient.getBaseURL()) {
    showPaperNotice(getString("unlink-base-url-missing"), "warning");
    return;
  }
  if (items.length === 0) {
    showPaperNotice(getString("unlink-no-selection"), "warning");
    return;
  }

  const boundCount = items.filter(
    (item) => paperMetadataRepository.read(item).paperID.trim().length > 0,
  ).length;
  if (boundCount === 0) {
    showPaperNotice(getString("unlink-no-paper-id"), "warning");
    return;
  }

  let projects;
  try {
    projects = (await paperApiClient.listProjects()).items || [];
  } catch (error) {
    ztoolkit.log("Unlink project list error", error);
    showPaperNotice(getString("unlink-fetch-projects-failed"), "error");
    return;
  }
  if (projects.length === 0) {
    showPaperNotice(getString("unlink-no-projects"), "warning");
    return;
  }

  const project = await openProjectPickerDialog(projects, null, {
    title: getString("unlink-select-title"),
    prompt: getString("unlink-select-prompt", {
      args: { count: items.length },
    }),
    confirmLabel: getString("unlink-action-confirm"),
  });
  if (!project) {
    return;
  }

  if (!isWindowAlive(win)) {
    return;
  }

  const confirmed = win.confirm(
    getString("unlink-confirm", {
      args: {
        project: project.name || project.project_id,
        count: items.length,
      },
    }),
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
    getString("unlink-start", {
      args: { projectName: project.name || project.project_id },
    }),
  );
  try {
    const stats = await unlinkItemsFromProject(
      items,
      project.project_id,
      defaultDependencies,
      {
        onProgress(processed, total) {
          progress.update(
            total === 0 ? 100 : Math.round((processed / total) * 100),
            `${processed}/${total}`,
          );
        },
        onSkip(item, reason, status) {
          showPaperNotice(
            getString("unlink-item-skipped", {
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
            getString("unlink-item-failed", {
              args: { title: describeItem(item), reason },
            }),
            "error",
          );
        },
        shouldContinue: () => session.isActive(),
      },
    );
    progress.finish(
      getString("unlink-finish", {
        args: {
          project: project.name || project.project_id,
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
