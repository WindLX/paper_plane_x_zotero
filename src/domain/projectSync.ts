import { PaperDetailResponse } from "./paper";

export interface ProjectSyncCandidate {
  itemID: number;
  paperID: string;
  doi: string;
  inTargetSubtree: boolean;
}

export interface ProjectSyncCollectionSnapshot {
  collectionID: number;
  parentCollectionID: number | null;
  itemIDs: number[];
}

export type ProjectSyncMatch =
  | { kind: "none" }
  | { kind: "matched"; itemID: number; inTargetSubtree: boolean }
  | { kind: "conflict"; itemIDs: number[] };

export interface ProjectPaperSource {
  searchProjectPapers(
    projectID: string,
    offset: number,
    limit: number,
  ): Promise<{ paper_ids: string[]; total: number }>;
  batchGetPapers(paperIDs: string[]): Promise<{ items: PaperDetailResponse[] }>;
}

export interface ProjectPaperFetchResult {
  papers: PaperDetailResponse[];
  missingPaperIDs: string[];
}

const PAGE_SIZE = 100;
const PDF_EXTENSION = ".pdf";
const MAX_PDF_FILENAME_BYTES = 220;
const FORBIDDEN_FILENAME_CHARACTERS = '<>:"/\\|?*';

export function collectProjectSyncSubtreeItemIDs(
  rootCollectionID: number,
  collections: ProjectSyncCollectionSnapshot[],
) {
  const childIDs = new Map<number, number[]>();
  collections.forEach((collection) => {
    if (collection.parentCollectionID === null) {
      return;
    }
    const siblings = childIDs.get(collection.parentCollectionID) || [];
    siblings.push(collection.collectionID);
    childIDs.set(collection.parentCollectionID, siblings);
  });

  const subtreeCollectionIDs = new Set<number>();
  const pending = [rootCollectionID];
  while (pending.length > 0) {
    const collectionID = pending.pop();
    if (collectionID === undefined || subtreeCollectionIDs.has(collectionID)) {
      continue;
    }
    subtreeCollectionIDs.add(collectionID);
    pending.push(...(childIDs.get(collectionID) || []));
  }

  return new Set(
    collections
      .filter((collection) => subtreeCollectionIDs.has(collection.collectionID))
      .flatMap((collection) => collection.itemIDs),
  );
}

export function normalizeProjectSyncDOI(value: string | null | undefined) {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "")
    .replace(/^doi:\s*/, "");
}

export function buildProjectSyncPDFFilename(paper: PaperDetailResponse) {
  const title = sanitizeFilenameSegment(paper.title || "");
  const firstAuthor = sanitizeFilenameSegment(
    paper.authors.find((author) => author.trim()) || "",
  );
  const effectiveTitle =
    title || sanitizeFilenameSegment(`Paper Plane X ${paper.paper_id}`);
  const baseName = firstAuthor
    ? `${effectiveTitle} - ${firstAuthor}`
    : effectiveTitle;
  const availableBytes = MAX_PDF_FILENAME_BYTES - PDF_EXTENSION.length;
  const truncated = truncateUtf8(baseName, availableBytes).replace(
    /[. ]+$/,
    "",
  );
  return `${truncated || `Paper Plane X ${paper.paper_id}`}${PDF_EXTENSION}`;
}

export function matchProjectPaper(
  paper: PaperDetailResponse,
  candidates: ProjectSyncCandidate[],
): ProjectSyncMatch {
  const subtree = candidates.filter((candidate) => candidate.inTargetSubtree);
  const outside = candidates.filter((candidate) => !candidate.inTargetSubtree);
  const phases = [subtree, outside];
  const doi = normalizeProjectSyncDOI(paper.doi);

  for (const phase of phases) {
    const byPaperID = phase.filter(
      (candidate) => candidate.paperID === paper.paper_id,
    );
    const paperIDMatch = resolveCandidates(byPaperID);
    if (paperIDMatch) {
      return paperIDMatch;
    }

    if (doi) {
      const byDOI = phase.filter(
        (candidate) => normalizeProjectSyncDOI(candidate.doi) === doi,
      );
      const doiMatch = resolveCandidates(byDOI);
      if (doiMatch) {
        return doiMatch;
      }
    }
  }

  return { kind: "none" };
}

export async function fetchAllProjectPapers(
  source: ProjectPaperSource,
  projectID: string,
): Promise<ProjectPaperFetchResult> {
  const paperIDs: string[] = [];
  let offset = 0;

  while (true) {
    const page = await source.searchProjectPapers(projectID, offset, PAGE_SIZE);
    if (page.paper_ids.length === 0 && offset < page.total) {
      throw new Error(
        `Project paper search returned an empty page at offset ${offset} of ${page.total}`,
      );
    }
    paperIDs.push(...page.paper_ids);
    offset += page.paper_ids.length;
    if (offset >= page.total) {
      break;
    }
  }

  const uniquePaperIDs = Array.from(new Set(paperIDs));
  const details = new Map<string, PaperDetailResponse>();
  for (let index = 0; index < uniquePaperIDs.length; index += PAGE_SIZE) {
    const chunk = uniquePaperIDs.slice(index, index + PAGE_SIZE);
    const response = await source.batchGetPapers(chunk);
    response.items.forEach((paper) => details.set(paper.paper_id, paper));
  }

  return {
    papers: uniquePaperIDs.flatMap((paperID) => {
      const paper = details.get(paperID);
      return paper ? [paper] : [];
    }),
    missingPaperIDs: uniquePaperIDs.filter((paperID) => !details.has(paperID)),
  };
}

function resolveCandidates(
  candidates: ProjectSyncCandidate[],
): ProjectSyncMatch | null {
  const unique = Array.from(
    new Map(
      candidates.map((candidate) => [candidate.itemID, candidate]),
    ).values(),
  );
  if (unique.length === 0) {
    return null;
  }
  if (unique.length > 1) {
    return {
      kind: "conflict",
      itemIDs: unique.map((candidate) => candidate.itemID),
    };
  }
  return {
    kind: "matched",
    itemID: unique[0].itemID,
    inTargetSubtree: unique[0].inTargetSubtree,
  };
}

function sanitizeFilenameSegment(value: string) {
  const sanitized = Array.from(value.normalize("NFC"), (character) => {
    const codePoint = character.codePointAt(0) || 0;
    if (
      codePoint < 32 ||
      codePoint === 127 ||
      FORBIDDEN_FILENAME_CHARACTERS.includes(character)
    ) {
      return " ";
    }
    return character;
  })
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "");
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(sanitized)) {
    return `_${sanitized}`;
  }
  return sanitized;
}

function truncateUtf8(value: string, maxBytes: number) {
  const encoder = new TextEncoder();
  let byteCount = 0;
  let result = "";
  for (const character of value) {
    const characterBytes = encoder.encode(character).length;
    if (byteCount + characterBytes > maxBytes) {
      break;
    }
    result += character;
    byteCount += characterBytes;
  }
  return result;
}
