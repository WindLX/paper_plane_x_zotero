import {
  buildPaperDetailStatusMessage,
  createPaperApiClient,
  extractAssociatedProjects,
} from "../../../domain/paper";
import { copyText } from "../../../infra/zotero/clipboard";
import {
  LocalPaperMetadata,
  paperMetadataRepository,
} from "../../../infra/zotero/paperMetadataRepository";
import { showPaperNotice } from "../../../infra/zotero/paperNotificationService";
import { syncQuickScanTagsToItem } from "../../../infra/zotero/paperTagSync";
import { getString } from "../../../utils/locale";
import { openStructuredJSONEditorDialog } from "../quickScanEditor/dialog";
import {
  createEmptyAnalysisReport,
  createEmptyQuickScan,
  createEmptySynthesisData,
  validateAnalysisJSON,
  validateQuickScanJSON,
  validateSynthesisJSON,
} from "../quickScanEditor/validation";
import { uploadSingleItem } from "../upload/useCase";
import {
  PaperActionState,
  PaperSidebarState,
  SidebarDraftState,
} from "./types";

const SYNC_THROTTLE_MS = 3000;
const lastSyncAtByItemID = new Map<number, number>();
const paperApiClient = createPaperApiClient();

const EMPTY_META: LocalPaperMetadata = {
  paperID: "",
  status: "",
  message: "",
};

export function createPaperSidebarStore(item?: Zotero.Item) {
  let state: PaperSidebarState = {
    item,
    isRegularItem: Boolean(item?.isRegularItem()),
    localMeta:
      item && item.isRegularItem()
        ? paperMetadataRepository.read(item)
        : EMPTY_META,
    remoteDetail: null,
    projects: [],
    projectNames: {},
    draft: {
      extraction_status: "",
      extraction_fact_check_status: "",
      analysis_fact_check_status: "",
      projectIDInput: "",
    },
    actions: createInitialActionMap(),
  };
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach((listener) => listener());
  const patch = (next: Partial<PaperSidebarState>) => {
    state = {
      ...state,
      ...next,
    };
    emit();
  };

  const patchAction = (key: string, next: PaperActionState) => {
    state = {
      ...state,
      actions: {
        ...state.actions,
        [key]: next,
      },
    };
    emit();
  };

  const refreshLocalMeta = () => {
    if (!state.item || !state.isRegularItem) {
      return;
    }
    patch({
      localMeta: paperMetadataRepository.read(state.item),
    });
  };

  const resolveProjectNames = async () => {
    if (!state.remoteDetail) {
      patch({
        projects: [],
        projectNames: {},
      });
      return;
    }

    const projects = extractAssociatedProjects(state.remoteDetail);
    const projectNames: Record<string, string | null> = {
      ...state.projectNames,
    };
    projects.forEach((project) => {
      if (project.name) {
        projectNames[project.project_id] = project.name;
      }
    });

    const unresolved = projects
      .filter((project) => !projectNames[project.project_id])
      .map((project) => project.project_id);

    if (unresolved.length) {
      await Promise.all(
        unresolved.map(async (projectID) => {
          try {
            const detail = await paperApiClient.fetchProjectDetail(projectID);
            projectNames[projectID] = detail.name || null;
          } catch (_error) {
            projectNames[projectID] = null;
          }
        }),
      );
    }

    patch({
      projects,
      projectNames,
    });
  };

  const hydrateDraftFromRemoteDetail = () => {
    patch({
      draft: {
        ...state.draft,
        extraction_status: state.remoteDetail?.extraction_status || "",
        extraction_fact_check_status:
          state.remoteDetail?.extraction_fact_check_status || "",
        analysis_fact_check_status:
          state.remoteDetail?.analysis_fact_check_status || "",
      },
    });
  };

  const syncAndPersistDetail = async (
    detail: Awaited<ReturnType<typeof paperApiClient.fetchDetail>>,
  ) => {
    if (!state.item) {
      return;
    }
    await paperMetadataRepository.write(state.item, {
      paperID: detail.paper_id,
      status: detail.extraction_status,
      message: buildPaperDetailStatusMessage(detail),
    });
    await syncQuickScanTagsToItem(state.item, detail.quick_scan || null);
    refreshLocalMeta();
  };

  const withAction = async (
    key: string,
    fn: () => Promise<void>,
    throttled?: () => boolean,
  ) => {
    if (throttled?.()) {
      return;
    }

    patchAction(key, { status: "loading" });
    try {
      await fn();
      patchAction(key, { status: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      patchAction(key, { status: "error", error: message });
      showPaperNotice(
        getString("paper-panel-action-failed", {
          args: { reason: message },
        }),
        "error",
      );
      ztoolkit.log("Paper sidebar action failed", error);
    }
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getState() {
      return state;
    },
    getSummary() {
      return (
        state.localMeta.status ||
        getString("paper-panel-placeholder-not-uploaded")
      );
    },
    updateDraft(key: keyof SidebarDraftState, value: string) {
      patch({
        draft: {
          ...state.draft,
          [key]: value,
        },
      });
    },
    copy(text: string, successMessage: string) {
      if (!text.trim()) {
        return;
      }
      copyText(text);
      showPaperNotice(successMessage, "success");
    },
    async sync(silent = false) {
      await withAction(
        "sync",
        async () => {
          if (!state.item || !state.localMeta.paperID) {
            throw new Error("paper_id is empty");
          }
          const detail = await paperApiClient.fetchDetail(
            state.localMeta.paperID,
          );
          patch({ remoteDetail: detail });
          await resolveProjectNames();
          hydrateDraftFromRemoteDetail();
          await syncAndPersistDetail(detail);
          if (!silent) {
            showPaperNotice(getString("paper-panel-sync-success"), "success");
          }
        },
        () => {
          if (!state.item) {
            return false;
          }
          const now = Date.now();
          const lastSyncAt = lastSyncAtByItemID.get(state.item.id) || 0;
          const elapsed = now - lastSyncAt;
          if (elapsed < SYNC_THROTTLE_MS) {
            const waitSeconds = Math.ceil((SYNC_THROTTLE_MS - elapsed) / 1000);
            patchAction("sync", { status: "throttled" });
            if (!silent) {
              showPaperNotice(
                getString("paper-panel-sync-throttled", {
                  args: { seconds: waitSeconds },
                }),
                "warning",
              );
            }
            return true;
          }
          lastSyncAtByItemID.set(state.item.id, now);
          return false;
        },
      );
    },
    async upload() {
      await withAction("upload", async () => {
        if (!state.item) {
          return;
        }
        await uploadSingleItem(state.item);
        refreshLocalMeta();
        patch({
          remoteDetail: null,
          projects: [],
          projectNames: {},
        });
      });
    },
    async retry() {
      await withAction("retry", async () => {
        if (!state.item || !state.localMeta.paperID) {
          throw new Error("paper_id is empty");
        }
        const submit = await paperApiClient.reprocess(
          state.item,
          state.localMeta.paperID,
        );
        await paperMetadataRepository.write(state.item, {
          paperID: submit.paper_id || state.localMeta.paperID,
          status: submit.status,
          message: submit.message,
        });
        refreshLocalMeta();
        patch({
          remoteDetail: null,
          projects: [],
        });
      });
    },
    async updateMetadata() {
      await withAction("update", async () => {
        if (!state.item || !state.localMeta.paperID) {
          throw new Error("paper_id is empty");
        }
        const statusOverrides = state.remoteDetail
          ? {
              extraction_status:
                state.draft.extraction_status &&
                state.draft.extraction_status !==
                  state.remoteDetail.extraction_status
                  ? state.draft.extraction_status
                  : undefined,
              extraction_fact_check_status:
                state.draft.extraction_fact_check_status &&
                state.draft.extraction_fact_check_status !==
                  state.remoteDetail.extraction_fact_check_status
                  ? state.draft.extraction_fact_check_status
                  : undefined,
              analysis_fact_check_status:
                state.draft.analysis_fact_check_status &&
                state.draft.analysis_fact_check_status !==
                  state.remoteDetail.analysis_fact_check_status
                  ? state.draft.analysis_fact_check_status
                  : undefined,
            }
          : undefined;
        const detail = await paperApiClient.manualUpdate(
          state.item,
          state.localMeta.paperID,
          statusOverrides,
          state.remoteDetail?.quick_scan || null,
        );
        patch({ remoteDetail: detail });
        await resolveProjectNames();
        hydrateDraftFromRemoteDetail();
        await syncAndPersistDetail(detail);
        showPaperNotice(getString("paper-panel-sync-success"), "success");
      });
    },
    async openQuickScanEditor() {
      if (!state.item || !state.localMeta.paperID || !state.remoteDetail) {
        showPaperNotice(getString("paper-panel-value-not-synced"), "warning");
        return;
      }
      await openStructuredJSONEditorDialog({
        title: getString("paper-panel-quick-scan-editor-title"),
        description: getString("paper-panel-quick-scan-editor-description"),
        createEmptyValue: createEmptyQuickScan,
        paperID: state.localMeta.paperID,
        initialValue: state.remoteDetail.quick_scan || null,
        updatedAt: state.remoteDetail.updated_at || null,
        validateJSON: validateQuickScanJSON,
        onSubmit: async (quickScan) => {
          const detail = await paperApiClient.manualUpdate(
            state.item!,
            state.localMeta.paperID,
            undefined,
            quickScan,
            undefined,
            undefined,
            { syncQuickScanTagsFromItem: false },
          );
          patch({ remoteDetail: detail });
          await resolveProjectNames();
          hydrateDraftFromRemoteDetail();
          await syncAndPersistDetail(detail);
          showPaperNotice(getString("paper-panel-sync-success"), "success");
        },
      });
    },
    async openSynthesisEditor() {
      if (!state.item || !state.localMeta.paperID || !state.remoteDetail) {
        showPaperNotice(getString("paper-panel-value-not-synced"), "warning");
        return;
      }
      await openStructuredJSONEditorDialog({
        title: getString("paper-panel-synthesis-editor-title"),
        description: getString("paper-panel-synthesis-editor-description"),
        createEmptyValue: createEmptySynthesisData,
        paperID: state.localMeta.paperID,
        initialValue: state.remoteDetail.synthesis_data || null,
        updatedAt: state.remoteDetail.updated_at || null,
        validateJSON: validateSynthesisJSON,
        onSubmit: async (synthesisData) => {
          const detail = await paperApiClient.manualUpdate(
            state.item!,
            state.localMeta.paperID,
            undefined,
            state.remoteDetail?.quick_scan,
            synthesisData,
            state.remoteDetail?.analysis_report,
          );
          patch({ remoteDetail: detail });
          await resolveProjectNames();
          hydrateDraftFromRemoteDetail();
          await syncAndPersistDetail(detail);
          showPaperNotice(getString("paper-panel-sync-success"), "success");
        },
      });
    },
    async openAnalysisEditor() {
      if (!state.item || !state.localMeta.paperID || !state.remoteDetail) {
        showPaperNotice(getString("paper-panel-value-not-synced"), "warning");
        return;
      }
      await openStructuredJSONEditorDialog({
        title: getString("paper-panel-analysis-editor-title"),
        description: getString("paper-panel-analysis-editor-description"),
        createEmptyValue: createEmptyAnalysisReport,
        paperID: state.localMeta.paperID,
        initialValue: state.remoteDetail.analysis_report || null,
        updatedAt: state.remoteDetail.updated_at || null,
        validateJSON: validateAnalysisJSON,
        onSubmit: async (analysisReport) => {
          const detail = await paperApiClient.manualUpdate(
            state.item!,
            state.localMeta.paperID,
            undefined,
            state.remoteDetail?.quick_scan,
            state.remoteDetail?.synthesis_data,
            analysisReport,
          );
          patch({ remoteDetail: detail });
          await resolveProjectNames();
          hydrateDraftFromRemoteDetail();
          await syncAndPersistDetail(detail);
          showPaperNotice(getString("paper-panel-sync-success"), "success");
        },
      });
    },
    async linkProject() {
      await withAction("link", async () => {
        if (!state.localMeta.paperID) {
          throw new Error("paper_id is empty");
        }
        const projectID = state.draft.projectIDInput.trim();
        if (!projectID) {
          throw new Error("project_id is empty");
        }
        await paperApiClient.linkProject(projectID, state.localMeta.paperID);
        const detail = await paperApiClient.fetchDetail(
          state.localMeta.paperID,
        );
        patch({
          remoteDetail: detail,
          draft: {
            ...state.draft,
            projectIDInput: "",
          },
        });
        await resolveProjectNames();
        showPaperNotice(
          getString("paper-panel-project-link-success", {
            args: { projectID },
          }),
          "success",
        );
      });
    },
    async unlinkProject(projectID: string) {
      await withAction(`unlink:${projectID}`, async () => {
        if (!state.localMeta.paperID) {
          throw new Error("paper_id is empty");
        }
        await paperApiClient.unlinkProject(projectID, state.localMeta.paperID);
        const detail = await paperApiClient.fetchDetail(
          state.localMeta.paperID,
        );
        patch({ remoteDetail: detail });
        await resolveProjectNames();
        showPaperNotice(
          getString("paper-panel-project-unlink-success", {
            args: { projectID },
          }),
          "success",
        );
      });
    },
    async autoSync() {
      if (!state.remoteDetail && state.localMeta.paperID) {
        await this.sync(true);
      }
    },
  };
}

function createInitialActionMap() {
  return {
    sync: { status: "idle" as const },
    upload: { status: "idle" as const },
    retry: { status: "idle" as const },
    update: { status: "idle" as const },
    link: { status: "idle" as const },
  };
}
