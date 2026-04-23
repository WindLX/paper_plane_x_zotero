import { PaperDetailResponse, ProjectSummary, QuickScan } from "../../../domain/paper/types";
import { LocalPaperMetadata } from "../../../infra/zotero/paperMetadataRepository";

export type PaperActionStatus =
  | "idle"
  | "loading"
  | "success"
  | "error"
  | "throttled";

export interface PaperActionState {
  status: PaperActionStatus;
  error?: string;
}

export interface SidebarDraftState {
  extraction_status: string;
  extraction_fact_check_status: string;
  analysis_fact_check_status: string;
  projectIDInput: string;
}

export interface PaperSidebarState {
  item?: Zotero.Item;
  isRegularItem: boolean;
  localMeta: LocalPaperMetadata;
  remoteDetail: PaperDetailResponse | null;
  projects: ProjectSummary[];
  projectNames: Record<string, string | null>;
  draft: SidebarDraftState;
  actions: Record<string, PaperActionState>;
}

export interface PaperPanelSectionVM {
  kind: "quickScan" | "synthesis" | "analysis" | "factCheck";
  label: string;
  quickScan?: QuickScan | null;
  detail?: PaperDetailResponse | null;
}

export interface PaperSidebarViewModel {
  data: {
    isRegularItem: boolean;
    localMeta: LocalPaperMetadata;
    remoteDetail: PaperDetailResponse | null;
    projects: ProjectSummary[];
    projectNames: Record<string, string | null>;
  };
  draft: SidebarDraftState;
  ui: {
    actions: Record<string, PaperActionState>;
    statusSummary: string;
  };
  structuredSections: PaperPanelSectionVM[];
  actions: {
    sync(): Promise<void>;
    upload(): Promise<void>;
    retry(): Promise<void>;
    updateMetadata(): Promise<void>;
    openQuickScanEditor(): Promise<void>;
    openSynthesisEditor(): Promise<void>;
    openAnalysisEditor(): Promise<void>;
    updateDraft(
      key: keyof SidebarDraftState,
      value: string,
    ): void;
    linkProject(): Promise<void>;
    unlinkProject(projectID: string): Promise<void>;
    copy(text: string, successMessage: string): void;
  };
}
