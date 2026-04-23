import {
  AnalysisReport,
  QuickScan,
  PaperDetailResponse,
  ProjectSummary,
  SynthesisData,
} from "./types";

export interface PaperUploadPayload {
  title: string;
  authors: string;
  year: string;
  publication: string;
  doi: string;
  customMeta: string;
}

const PAPER_PLANE_TAG_PREFIX = "ppx:";
const PAPER_PLANE_VERDICT_TAG_PREFIX = "ppx-verdict:";

export function extractAssociatedProjects(
  detail: PaperDetailResponse,
): ProjectSummary[] {
  const unique = new Map<string, ProjectSummary>();
  const put = (projectID: string, name: string | null = null) => {
    const id = projectID.trim();
    if (!id) {
      return;
    }
    const prev = unique.get(id);
    if (!prev) {
      unique.set(id, { project_id: id, name });
      return;
    }
    if (!prev.name && name) {
      unique.set(id, { project_id: id, name });
    }
  };

  if (detail.project_id) {
    put(detail.project_id);
  }
  if (Array.isArray(detail.project_ids)) {
    detail.project_ids.forEach((id) => {
      if (typeof id === "string") {
        put(id);
      }
    });
  }
  if (Array.isArray(detail.projects)) {
    detail.projects.forEach((project) => {
      if (project && typeof project.project_id === "string") {
        put(project.project_id, project.name || null);
      }
    });
  }

  return Array.from(unique.values());
}

export function buildPaperDetailStatusMessage(detail: PaperDetailResponse) {
  return [
    `extraction_fc=${detail.extraction_fact_check_status}`,
    `analysis_fc=${detail.analysis_fact_check_status}`,
  ].join("; ");
}

export function extractUploadPayload(item: Zotero.Item): PaperUploadPayload {
  const title = item.getField("title") || "";
  const creators = item.getCreators();
  const authors = creators
    .map((creator) => {
      const lastName = creator.lastName || "";
      const firstName = creator.firstName || "";
      return `${lastName} ${firstName}`.trim();
    })
    .filter(Boolean)
    .join(", ");

  let year = "";
  const dateStr = item.getField("date");
  if (dateStr) {
    const yearMatch = dateStr.match(/\d{4}/);
    if (yearMatch) {
      year = yearMatch[0];
    }
  }

  const publication = getPublication(item);
  const doi = getDOI(item);

  return {
    title,
    authors,
    year,
    publication,
    doi,
    customMeta: JSON.stringify({ zotero_key: item.key }),
  };
}

export function extractManualUpdatePayload(
  item: Zotero.Item,
  quickScan?: QuickScan | null,
  synthesisData?: SynthesisData | null,
  analysisReport?: AnalysisReport | null,
) {
  const payload = extractUploadPayload(item);
  const year = payload.year ? Number.parseInt(payload.year, 10) : null;
  const nextPayload: Record<string, unknown> = {
    title: payload.title || null,
    authors: payload.authors
      ? payload.authors
          .split(",")
          .map((author) => author.trim())
          .filter(Boolean)
      : [],
    year: Number.isFinite(year || NaN) ? year : null,
    publication: payload.publication || null,
    doi: payload.doi || null,
    custom_meta: payload.customMeta || null,
  };
    nextPayload.quick_scan = mergeQuickScanTags(
      quickScan,
      extractPaperPlaneTags(item),
    );
  }
  if (synthesisData !== undefined) {
    nextPayload.synthesis_data = synthesisData;
  }
  if (analysisReport !== undefined) {
    nextPayload.analysis_report = analysisReport;
  }
  return nextPayload;
}

export function extractPaperPlaneTags(item: Zotero.Item) {
  const unique = new Set<string>();
  item.getTags().forEach((tagEntry) => {
    const rawTag = tagEntry.tag || "";
    if (
      !rawTag.startsWith(PAPER_PLANE_TAG_PREFIX) ||
      rawTag.startsWith(PAPER_PLANE_VERDICT_TAG_PREFIX)
    ) {
      return;
    }
    const normalized = rawTag.slice(PAPER_PLANE_TAG_PREFIX.length).trim();
    if (!normalized) {
      return;
    }
    unique.add(normalized);
  });
  return Array.from(unique);
}

export function mergeQuickScanTags(
  quickScan: QuickScan | null | undefined,
  tags: string[],
): QuickScan {
  return {
    verdict: quickScan?.verdict || "",
    reason: quickScan?.reason || "",
    quick_summary: quickScan?.quick_summary || "",
    tags,
  };
}

export function getFirstPdfPath(item: Zotero.Item) {
  for (const attachmentID of item.getAttachments()) {
    const attachment = Zotero.Items.get(attachmentID);
    if (attachment?.attachmentContentType !== "application/pdf") {
      continue;
    }
    const filePath = attachment.getFilePath();
    if (filePath) {
      return filePath;
    }
  }
  return "";
}

function getPublication(item: Zotero.Item) {
  try {
    return item.getField("publicationTitle") || "";
  } catch (_error) {
    try {
      return item.getField("proceedingsTitle") || "";
    } catch (_nestedError) {
      return "";
    }
  }
}

function getDOI(item: Zotero.Item) {
  try {
    return item.getField("DOI") || "";
  } catch (_error) {
    return "";
  }
}
