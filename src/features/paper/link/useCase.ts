import { createPaperApiClient } from "@/domain/paper/paperApiClient";
import { paperMetadataRepository } from "@/infra/zotero/paperMetadataRepository";
import {
  createPaperProgress,
  showPaperNotice,
} from "@/infra/zotero/paperNotificationService";
import { getString } from "@/utils/locale";
import { openProjectPickerDialog } from "./dialog";

interface LinkStats {
  success: number;
  failed: number;
  skipped: number;
}

const paperApiClient = createPaperApiClient();

export async function linkSelectedItemsToProject() {
  const baseURL = paperApiClient.getBaseURL();
  if (!baseURL) {
    showPaperNotice(getString("link-base-url-missing"), "warning");
    return;
  }

  const pane = Zotero.getActiveZoteroPane?.();
  const selectedItems = (pane?.getSelectedItems?.() || []).filter((item) =>
    item.isRegularItem(),
  );

  if (!selectedItems.length) {
    showPaperNotice(getString("link-no-selection"), "warning");
    return;
  }

  // 过滤出已有 paperID 的 items
  const itemsWithPaperID = selectedItems.map((item) => ({
    item,
    meta: paperMetadataRepository.read(item),
  }));
  const validItems = itemsWithPaperID.filter((i) => i.meta.paperID);
  const skippedItems = itemsWithPaperID.filter((i) => !i.meta.paperID);

  if (!validItems.length) {
    showPaperNotice(getString("link-no-paper-id"), "warning");
    return;
  }

  // 获取项目列表
  let projects: Awaited<
    ReturnType<typeof paperApiClient.listProjects>
  >["items"];
  try {
    const data = await paperApiClient.listProjects();
    projects = data.items || [];
  } catch (error) {
    showPaperNotice(getString("link-fetch-projects-failed"), "error");
    return;
  }

  if (!projects.length) {
    showPaperNotice(getString("link-no-projects"), "warning");
    return;
  }

  // 让用户搜索并选择项目
  let project;
  try {
    project = await openProjectPickerDialog(projects, validItems.length);
  } catch (err) {
    ztoolkit.log("Project select dialog error", err);
    showPaperNotice(
      `Failed to open project selection dialog: ${err instanceof Error ? err.message : String(err)}`,
      "error",
    );
    return;
  }

  if (!project) {
    return;
  }

  // 批量关联
  const stats: LinkStats = { success: 0, failed: 0, skipped: 0 };
  const progress = createPaperProgress(
    getString("link-start", {
      args: { projectName: project.name || project.project_id },
    }),
  );

  for (let i = 0; i < validItems.length; i++) {
    const { item, meta } = validItems[i];
    const title = item.getField("title") || `${item.id}`;
    try {
      await paperApiClient.linkProject(project.project_id, meta.paperID);
      stats.success += 1;
    } catch (error) {
      stats.failed += 1;
      const reason =
        error instanceof Error ? error.message : "Unknown link error";
      showPaperNotice(
        getString("link-item-failed", { args: { title, reason } }),
        "error",
      );
      ztoolkit.log("Link error", error);
    } finally {
      progress.update(
        Math.round(((i + 1) / validItems.length) * 100),
        `${i + 1}/${validItems.length}`,
      );
    }
  }

  for (const { item } of skippedItems) {
    stats.skipped += 1;
    showPaperNotice(
      getString("link-item-skipped-no-paper-id", {
        args: { title: item.getField("title") || `${item.id}` },
      }),
      "warning",
    );
  }

  progress.finish(
    getString("link-finish", {
      args: {
        success: stats.success,
        failed: stats.failed,
        skipped: stats.skipped,
      },
    }),
  );
}
