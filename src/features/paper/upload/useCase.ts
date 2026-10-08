import { createPaperApiClient } from "@/domain/paper/paperApiClient";
import { paperMetadataRepository } from "@/infra/zotero/paperMetadataRepository";
import {
  createPaperProgress,
  showPaperNotice,
} from "@/infra/zotero/paperNotificationService";
import { getString } from "@/utils/locale";
import { beginBatchSession } from "../batch/session";

interface UploadStats {
  success: number;
  failed: number;
  skipped: number;
}

const paperApiClient = createPaperApiClient();

export async function uploadSingleItem(item: Zotero.Item) {
  const baseURL = paperApiClient.getBaseURL();
  if (!baseURL) {
    showPaperNotice(getString("upload-base-url-missing"), "warning");
    return false;
  }

  const result = await processItemUpload(item);
  if (result.result === "skipped") {
    showPaperNotice(
      getString("upload-item-skipped-no-pdf", {
        args: { title: result.title },
      }),
      "warning",
    );
    return false;
  }

  showPaperNotice(
    getString("upload-item-success", { args: { title: result.title } }),
    "success",
  );
  return true;
}

export async function uploadSelectedItems(items: Zotero.Item[], win: Window) {
  const baseURL = paperApiClient.getBaseURL();
  if (!baseURL) {
    showPaperNotice(getString("upload-base-url-missing"), "warning");
    return;
  }

  if (!items.length) {
    showPaperNotice(getString("upload-no-selection"), "warning");
    return;
  }

  const session = beginBatchSession(win);
  if (!session) {
    showPaperNotice(getString("batch-already-running"), "warning");
    return;
  }

  const stats: UploadStats = { success: 0, failed: 0, skipped: 0 };
  const progress = createPaperProgress(getString("upload-start"));
  let stopped = false;

  try {
    for (let i = 0; i < items.length; i++) {
      if (!session.isActive()) {
        stopped = true;
        break;
      }
      const item = items[i];
      const title = item.getField("title") || `${item.id}`;
      try {
        const result = await processItemUpload(item);
        if (result.result === "skipped") {
          stats.skipped += 1;
          showPaperNotice(
            getString("upload-item-skipped-no-pdf", {
              args: { title: result.title },
            }),
            "warning",
          );
        } else {
          stats.success += 1;
          showPaperNotice(
            getString("upload-item-success", { args: { title: result.title } }),
            "success",
          );
        }
      } catch (error) {
        stats.failed += 1;
        const reason =
          error instanceof Error ? error.message : "Unknown upload error";
        showPaperNotice(
          getString("upload-item-failed", { args: { title, reason } }),
          "error",
        );
        ztoolkit.log("Upload error", error);
      } finally {
        progress.update(
          Math.round(((i + 1) / items.length) * 100),
          `${i + 1}/${items.length}`,
        );
      }
      if (!session.isActive()) {
        stopped = true;
        break;
      }
    }

    progress.finish(
      getString("upload-finish", {
        args: {
          success: stats.success,
          failed: stats.failed,
          skipped: stats.skipped,
        },
      }),
    );
    if (stopped) {
      showPaperNotice(getString("batch-stopped"), "warning");
    }
  } finally {
    session.finish();
  }
}

async function processItemUpload(item: Zotero.Item) {
  const title = item.getField("title") || `${item.id}`;
  const result = await paperApiClient.uploadFromItem(item);
  if (result.result === "skipped") {
    return {
      title,
      result: "skipped" as const,
    };
  }

  await paperMetadataRepository.write(item, {
    paperID: result.response?.paper_id || undefined,
    status: result.response?.status,
    message: result.response?.message,
  });

  return {
    title,
    result: "success" as const,
  };
}
