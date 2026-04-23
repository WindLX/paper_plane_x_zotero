import { getString } from "../../../utils/locale";
import { PaperSidebarViewModel } from "./types";

export function createPaperSidebarViewModel(
  store: ReturnType<typeof import("./store").createPaperSidebarStore>,
): PaperSidebarViewModel {
  const state = store.getState();
  return {
    data: {
      isRegularItem: state.isRegularItem,
      localMeta: state.localMeta,
      remoteDetail: state.remoteDetail,
      projects: state.projects,
      projectNames: state.projectNames,
    },
    draft: state.draft,
    ui: {
      actions: state.actions,
      statusSummary:
        state.localMeta.status ||
        getString("paper-panel-placeholder-not-uploaded"),
    },
    structuredSections: [
      {
        kind: "quickScan",
        label: getString("paper-panel-quick-scan-label"),
        quickScan: state.remoteDetail?.quick_scan || null,
      },
      {
        kind: "synthesis",
        label: getString("paper-panel-synthesis-data-label"),
        detail: state.remoteDetail,
      },
      {
        kind: "analysis",
        label: getString("paper-panel-analysis-report-label"),
        detail: state.remoteDetail,
      },
      {
        kind: "factCheck",
        label: getString("paper-panel-section-fact-check"),
        detail: state.remoteDetail,
      },
    ],
    actions: {
      sync: () => store.sync(false),
      upload: () => store.upload(),
      retry: () => store.retry(),
      updateMetadata: () => store.updateMetadata(),
      openQuickScanEditor: () => store.openQuickScanEditor(),
      openSynthesisEditor: () => store.openSynthesisEditor(),
      openAnalysisEditor: () => store.openAnalysisEditor(),
      updateDraft: (key, value) => store.updateDraft(key, value),
      linkProject: () => store.linkProject(),
      unlinkProject: (projectID) => store.unlinkProject(projectID),
      copy: (text, successMessage) => store.copy(text, successMessage),
    },
  };
}
