import { createPaperApiClient, PaperDetailResponse } from "@/domain/paper";
import { paperMetadataRepository } from "@/infra/zotero/paperMetadataRepository";
import {
  createPaperProgress,
  showPaperNotice,
} from "@/infra/zotero/paperNotificationService";
import { getString } from "@/utils/locale";
import { syncPaperDetailToItem } from "../sync/detailSync";

export interface FetchStats {
  success: number;
  failed: number;
  skipped: number;
}

export interface FetchDependencies {
  readPaperID(item: Zotero.Item): string;
  fetchDetail(paperID: string): Promise<PaperDetailResponse>;
  syncDetail(item: Zotero.Item, detail: PaperDetailResponse): Promise<void>;
}

interface FetchCallbacks {
  onProgress?(processed: number, total: number): void;
  onError?(item: Zotero.Item, error: unknown): void;
}

const paperApiClient = createPaperApiClient();

const defaultDependencies: FetchDependencies = {
  readPaperID(item) {
    return paperMetadataRepository.read(item).paperID;
  },
  fetchDetail(paperID) {
    return paperApiClient.fetchDetail(paperID);
  },
  syncDetail(item, detail) {
    return syncPaperDetailToItem(item, detail);
  },
};

export async function fetchPaperDetailsForItems(
  items: Zotero.Item[],
  dependencies: FetchDependencies = defaultDependencies,
  callbacks: FetchCallbacks = {},
): Promise<FetchStats> {
  const stats: FetchStats = { success: 0, failed: 0, skipped: 0 };

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const paperID = dependencies.readPaperID(item).trim();
    if (!paperID) {
      stats.skipped += 1;
      callbacks.onProgress?.(index + 1, items.length);
      continue;
    }

    try {
      const detail = await dependencies.fetchDetail(paperID);
      await dependencies.syncDetail(item, detail);
      stats.success += 1;
    } catch (error) {
      stats.failed += 1;
      callbacks.onError?.(item, error);
    } finally {
      callbacks.onProgress?.(index + 1, items.length);
    }
  }

  return stats;
}

export async function fetchSelectedPaperDetails() {
  if (!paperApiClient.getBaseURL()) {
    showPaperNotice(getString("fetch-base-url-missing"), "warning");
    return;
  }

  const pane = Zotero.getActiveZoteroPane?.();
  const selectedItems = (pane?.getSelectedItems?.() || []).filter((item) =>
    item.isRegularItem(),
  );
  if (!selectedItems.length) {
    showPaperNotice(getString("fetch-no-selection"), "warning");
    return;
  }

  const progress = createPaperProgress(getString("fetch-start"));
  const stats = await fetchPaperDetailsForItems(
    selectedItems,
    defaultDependencies,
    {
      onProgress(processed, total) {
        progress.update(
          Math.round((processed / total) * 100),
          `${processed}/${total}`,
        );
      },
      onError(item, error) {
        const title = item.getField("title") || `${item.id}`;
        const reason =
          error instanceof Error ? error.message : "Unknown fetch error";
        showPaperNotice(
          getString("fetch-item-failed", { args: { title, reason } }),
          "error",
        );
        ztoolkit.log("Paper detail batch fetch failed", item.id, error);
      },
    },
  );

  progress.finish(
    getString("fetch-finish", {
      args: {
        success: stats.success,
        failed: stats.failed,
        skipped: stats.skipped,
      },
    }),
  );
}
