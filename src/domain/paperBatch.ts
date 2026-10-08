import { PaperDetailResponse } from "./paper";

export const BATCH_GET_CHUNK_SIZE = 100;

export type BatchSkipReason = "no-paper-id" | "no-local-pdf" | "in-progress";

export interface BatchItemMetadata {
  itemID: number;
  paperID: string;
  status: string;
  hasLocalPDF: boolean;
}

export interface BatchSkip {
  itemID: number;
  reason: BatchSkipReason;
  status: string;
}

export interface BatchGroup {
  paperID: string;
  itemIDs: number[];
  pdfSourceItemID: number | null;
}

export interface BatchPlan {
  groups: BatchGroup[];
  skips: BatchSkip[];
}

export function isInProgressStatus(status: string): boolean {
  const normalized = status.trim().toUpperCase();
  return normalized === "PENDING" || normalized === "PROCESSING";
}

/**
 * Reprocess requires a backend binding, a readable local PDF, and an idle
 * backend status. Every failing item is skipped with its first failing reason
 * so the user can tell why it was left alone. Items sharing a paper_id collapse
 * into one request; the group's PDF comes from its first item with a local PDF.
 */
export function planReprocessGroups(items: BatchItemMetadata[]): BatchPlan {
  return planGroups(items, (item) => {
    if (!item.paperID) {
      return "no-paper-id";
    }
    if (!item.hasLocalPDF) {
      return "no-local-pdf";
    }
    if (isInProgressStatus(item.status)) {
      return "in-progress";
    }
    return null;
  });
}

/**
 * Detail refresh only needs a backend binding. Duplicate paper_ids are merged
 * so the batch-get request and the result write happen once per paper.
 */
export function planPaperIDGroups(items: BatchItemMetadata[]): BatchPlan {
  return planGroups(items, (item) => (item.paperID ? null : "no-paper-id"));
}

export function uniquePaperIDs(groups: BatchGroup[]): string[] {
  return Array.from(new Set(groups.map((group) => group.paperID)));
}

export function chunkPaperIDs(
  paperIDs: string[],
  size: number = BATCH_GET_CHUNK_SIZE,
): string[][] {
  const chunkSize = Math.max(1, Math.floor(size));
  const chunks: string[][] = [];
  for (let index = 0; index < paperIDs.length; index += chunkSize) {
    chunks.push(paperIDs.slice(index, index + chunkSize));
  }
  return chunks;
}

export function indexDetailsByPaperID(
  details: PaperDetailResponse[],
): Map<string, PaperDetailResponse> {
  return new Map(details.map((detail) => [detail.paper_id, detail]));
}

function planGroups(
  items: BatchItemMetadata[],
  classify: (item: BatchItemMetadata) => BatchSkipReason | null,
): BatchPlan {
  const skips: BatchSkip[] = [];
  const groups = new Map<string, BatchGroup>();

  for (const item of items) {
    const reason = classify(item);
    if (reason) {
      skips.push({ itemID: item.itemID, reason, status: item.status });
      continue;
    }
    const existing = groups.get(item.paperID);
    if (existing) {
      existing.itemIDs.push(item.itemID);
      if (existing.pdfSourceItemID === null && item.hasLocalPDF) {
        existing.pdfSourceItemID = item.itemID;
      }
      continue;
    }
    groups.set(item.paperID, {
      paperID: item.paperID,
      itemIDs: [item.itemID],
      pdfSourceItemID: item.hasLocalPDF ? item.itemID : null,
    });
  }

  return { groups: Array.from(groups.values()), skips };
}
