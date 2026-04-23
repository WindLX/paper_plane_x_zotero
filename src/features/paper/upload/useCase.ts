import { createPaperApiClient } from "../../../domain/paper/paperApiClient";
import { paperMetadataRepository } from "../../../infra/zotero/paperMetadataRepository";
import {
  createPaperProgress,
  showPaperNotice,
} from "../../../infra/zotero/paperNotificationService";
import { getString } from "../../../utils/locale";

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
      getString("upload-item-skipped-no-pdf", { args: { title: result.title } }),
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

export async function uploadSelectedItems() {
  const baseURL = paperApiClient.getBaseURL();
  if (!baseURL) {
    showPaperNotice(getString("upload-base-url-missing"), "warning");
    return;
  }

  const pane = Zotero.getActiveZoteroPane?.();
  const selectedItems = (pane?.getSelectedItems?.() || []).filter((item) =>
    item.isRegularItem(),
  );

  if (!selectedItems.length) {
    showPaperNotice(getString("upload-no-selection"), "warning");
    return;
  }

  const stats: UploadStats = { success: 0, failed: 0, skipped: 0 };
  const progress = createPaperProgress(getString("upload-start"));

  for (let i = 0; i < selectedItems.length; i++) {
    const item = selectedItems[i];
    const title = item.getField("title") || `${item.id}`;
    try {
      const result = await processItemUpload(item);
      if (result.result === "skipped") {
        stats.skipped += 1;
        showPaperNotice(
          getString("upload-item-skipped-no-pdf", { args: { title: result.title } }),
          "warning",
        );
        continue;
      }

      stats.success += 1;
      showPaperNotice(
        getString("upload-item-success", { args: { title: result.title } }),
        "success",
      );
    } catch (error) {
      stats.failed += 1;
      const reason = error instanceof Error ? error.message : "Unknown upload error";
      showPaperNotice(
        getString("upload-item-failed", { args: { title, reason } }),
        "error",
      );
      ztoolkit.log("Upload error", error);
    } finally {
      progress.update(
        Math.round(((i + 1) / selectedItems.length) * 100),
        `${i + 1}/${selectedItems.length}`,
      );
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
