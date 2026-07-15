import {
  createPaperApiClient,
  extractAssociatedProjects,
  PaperDetailResponse,
} from "@/domain/paper";

export interface PaperListRemoteMetadata {
  projectSummary: string;
  verdict: string;
  reason: string;
  quickSummary: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const RETRY_DELAY_MS = 30 * 1000;
const paperApiClient = createPaperApiClient();
const cache = new Map<
  string,
  { value: PaperListRemoteMetadata; loadedAt: number }
>();
const pending = new Map<string, Promise<void>>();
const retryAfter = new Map<string, number>();
let projectNameMapPromise: Promise<Map<string, string>> | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

export function getPaperListRemoteMetadata(
  paperID: string,
): PaperListRemoteMetadata | null {
  if (!paperID) {
    return null;
  }

  const cached = cache.get(paperID);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached.value;
  }

  if (!pending.has(paperID) && Date.now() >= (retryAfter.get(paperID) || 0)) {
    const request = loadPaperMetadata(paperID).finally(() => {
      pending.delete(paperID);
    });
    pending.set(paperID, request);
  }
  return cached?.value || null;
}

export function primePaperListRemoteMetadata(detail: PaperDetailResponse) {
  const value = buildPaperListRemoteMetadata(detail);
  cache.set(detail.paper_id, { value, loadedAt: Date.now() });
  scheduleListRefresh();

  if (extractAssociatedProjects(detail).some((project) => !project.name)) {
    void getProjectNameMap()
      .then((projectNames) => {
        cache.set(detail.paper_id, {
          value: buildPaperListRemoteMetadata(detail, projectNames),
          loadedAt: Date.now(),
        });
        scheduleListRefresh();
      })
      .catch((error) => {
        ztoolkit.log("Paper list project names load failed", error);
      });
  }
}

export function buildPaperListRemoteMetadata(
  detail: PaperDetailResponse,
  projectNames: ReadonlyMap<string, string> = new Map(),
): PaperListRemoteMetadata {
  const projectSummary = extractAssociatedProjects(detail)
    .map((project) => {
      const name = project.name || projectNames.get(project.project_id) || "";
      return name ? `${project.project_id} (${name})` : project.project_id;
    })
    .join("; ");

  return {
    projectSummary,
    verdict: detail.quick_scan?.verdict || "",
    reason: detail.quick_scan?.reason || "",
    quickSummary: detail.quick_scan?.quick_summary || "",
  };
}

async function loadPaperMetadata(paperID: string) {
  try {
    const detail = await paperApiClient.fetchDetail(paperID);
    const projects = extractAssociatedProjects(detail);
    const needsProjectNames = projects.some((project) => !project.name);
    const projectNames = needsProjectNames
      ? await getProjectNameMap().catch(() => new Map<string, string>())
      : new Map<string, string>();
    cache.set(paperID, {
      value: buildPaperListRemoteMetadata(detail, projectNames),
      loadedAt: Date.now(),
    });
    retryAfter.delete(paperID);
    scheduleListRefresh();
  } catch (error) {
    retryAfter.set(paperID, Date.now() + RETRY_DELAY_MS);
    ztoolkit.log("Paper list metadata load failed", paperID, error);
  }
}

function getProjectNameMap() {
  if (!projectNameMapPromise) {
    projectNameMapPromise = paperApiClient
      .listProjects()
      .then(
        (response) =>
          new Map(
            response.items
              .filter((project) => Boolean(project.name))
              .map((project) => [project.project_id, project.name]),
          ),
      )
      .catch((error) => {
        projectNameMapPromise = null;
        throw error;
      });
  }
  return projectNameMapPromise;
}

function scheduleListRefresh() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    const itemsView = Zotero.getActiveZoteroPane?.()?.itemsView;
    if (itemsView) {
      itemsView.forceUpdate();
    }
  }, 50);
}
