import { createPaperApiClient } from "@/domain/paper";
import {
  collectProjectSyncSubtreeItemIDs,
  fetchAllProjectPapers,
  matchProjectPaper,
  ProjectSyncCandidate,
} from "@/domain/projectSync";
import {
  findProjectsMappedToCollection,
  mapProjectToCollection,
  parseProjectCollectionMap,
  removeProjectsMappedToCollection,
} from "@/domain/projectSyncMapping";
import { openProjectPickerDialog } from "@/features/paper/link/dialog";
import { paperMetadataRepository } from "@/infra/zotero/paperMetadataRepository";
import {
  createPaperProgress,
  showPaperNotice,
} from "@/infra/zotero/paperNotificationService";
import { getString } from "@/utils/locale";
import { getPref, setPref } from "@/utils/prefs";
import { PaperDetailResponse, ProjectResponse } from "@/domain/paper/types";

export interface ProjectSyncStats {
  total: number;
  created: number;
  reused: number;
  pdfAdded: number;
  conflicts: number;
  failed: number;
}

const paperApiClient = createPaperApiClient();
const PAGE_SIZE = 100;

export async function syncProjectToCollection(collection: Zotero.Collection) {
  if (!paperApiClient.getBaseURL()) {
    showPaperNotice(getString("project-sync-base-url-missing"), "warning");
    return;
  }

  let projects: ProjectResponse[];
  try {
    projects = await fetchAllProjects();
  } catch (error) {
    ztoolkit.log("Project sync project-list error", error);
    showPaperNotice(getString("project-sync-projects-failed"), "error");
    return;
  }
  if (projects.length === 0) {
    showPaperNotice(getString("project-sync-no-projects"), "warning");
    return;
  }

  const mapping = readMapping();
  const initialProjectID = Object.entries(mapping).find(
    ([, target]) =>
      target.libraryID === collection.libraryID &&
      target.collectionID === collection.id,
  )?.[0];
  const project = await openProjectPickerDialog(projects, null, {
    initialProjectID,
    title: getString("project-sync-select-title"),
    prompt: getString("project-sync-select-prompt", {
      args: { collection: collection.name },
    }),
    confirmLabel: getString("project-sync-action-confirm"),
  });
  if (!project) {
    return;
  }

  writeMapping(
    mapProjectToCollection(mapping, project.project_id, {
      libraryID: collection.libraryID,
      collectionID: collection.id,
    }),
  );

  const progress = createPaperProgress(
    getString("project-sync-start", {
      args: { project: project.name, collection: collection.name },
    }),
  );
  try {
    const stats = await runProjectSync(project.project_id, collection, {
      onProgress(processed, total) {
        progress.update(
          total === 0 ? 100 : Math.round((processed / total) * 100),
          `${processed}/${total}`,
        );
      },
      onItemError(paperID, reason) {
        showPaperNotice(
          getString("project-sync-item-failed", {
            args: { paperID, reason },
          }),
          "error",
        );
      },
      onItemConflict(paperID, itemIDs) {
        showPaperNotice(
          getString("project-sync-item-conflict", {
            args: { paperID, itemIDs: itemIDs.join(", ") },
          }),
          "warning",
        );
      },
    });
    progress.finish(
      getString("project-sync-finish", {
        args: { ...stats },
      }),
      8000,
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    ztoolkit.log("Project sync failed", error);
    progress.finish(
      getString("project-sync-failed", { args: { reason } }),
      8000,
    );
  }
}

export function getCollectionMappedProjectIDs(
  collection: Zotero.Collection,
): string[] {
  return findProjectsMappedToCollection(readMapping(), {
    libraryID: collection.libraryID,
    collectionID: collection.id,
  });
}

export function cancelCollectionProjectAssociations(
  collection: Zotero.Collection,
  win: Window,
): boolean {
  const projectIDs = getCollectionMappedProjectIDs(collection);
  if (projectIDs.length === 0) {
    return false;
  }
  const confirmed = win.confirm(
    getString("project-sync-unlink-confirm", {
      args: { collection: collection.name, count: projectIDs.length },
    }),
  );
  if (!confirmed) {
    return false;
  }
  writeMapping(
    removeProjectsMappedToCollection(readMapping(), {
      libraryID: collection.libraryID,
      collectionID: collection.id,
    }),
  );
  showPaperNotice(
    getString("project-sync-unlink-finish", {
      args: { collection: collection.name, count: projectIDs.length },
    }),
    "success",
  );
  return true;
}

export async function runProjectSync(
  projectID: string,
  collection: Zotero.Collection,
  events: {
    onProgress?(processed: number, total: number): void;
    onItemError?(paperID: string, reason: string): void;
    onItemConflict?(paperID: string, itemIDs: number[]): void;
  } = {},
): Promise<ProjectSyncStats> {
  const fetched = await fetchAllProjectPapers(paperApiClient, projectID);
  const stats: ProjectSyncStats = {
    total: fetched.papers.length + fetched.missingPaperIDs.length,
    created: 0,
    reused: 0,
    pdfAdded: 0,
    conflicts: 0,
    failed: fetched.missingPaperIDs.length,
  };
  fetched.missingPaperIDs.forEach((paperID) =>
    events.onItemError?.(paperID, "Paper detail was not returned by Backend"),
  );

  const subtreeCollections = [
    collection,
    ...Zotero.Collections.getByParent(collection.id, true),
  ];
  const subtreeItemIDs = collectProjectSyncSubtreeItemIDs(
    collection.id,
    subtreeCollections.map((current) => ({
      collectionID: current.id,
      parentCollectionID: current.parentID || null,
      itemIDs: current.getChildItems(true, false),
    })),
  );
  const libraryItems = (
    await Zotero.Items.getAll(collection.libraryID, true)
  ).filter((item) => item.isRegularItem());
  const candidates = libraryItems.map((item) =>
    toCandidate(item, subtreeItemIDs.has(item.id)),
  );

  let processed = fetched.missingPaperIDs.length;
  events.onProgress?.(processed, stats.total);
  for (const paper of fetched.papers) {
    try {
      const outcome = await syncPaper(paper, collection, candidates);
      if (outcome.result === "conflict") {
        stats.conflicts += 1;
        events.onItemConflict?.(paper.paper_id, outcome.itemIDs);
      } else {
        stats[outcome.result] += 1;
        if (outcome.pdfAdded) {
          stats.pdfAdded += 1;
        }
        const item = Zotero.Items.get(outcome.itemID);
        const candidate = toCandidate(item, true);
        const candidateIndex = candidates.findIndex(
          (current) => current.itemID === item.id,
        );
        if (candidateIndex >= 0) {
          candidates[candidateIndex] = candidate;
        } else {
          candidates.push(candidate);
        }
      }
    } catch (error) {
      stats.failed += 1;
      events.onItemError?.(
        paper.paper_id,
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      processed += 1;
      events.onProgress?.(processed, stats.total);
    }
  }
  return stats;
}

async function syncPaper(
  paper: PaperDetailResponse,
  collection: Zotero.Collection,
  candidates: ProjectSyncCandidate[],
): Promise<
  | { result: "created" | "reused"; itemID: number; pdfAdded: boolean }
  | { result: "conflict"; itemIDs: number[] }
> {
  const match = matchProjectPaper(paper, candidates);
  if (match.kind === "conflict") {
    return { result: "conflict", itemIDs: match.itemIDs };
  }

  let item: Zotero.Item;
  let result: "created" | "reused";
  if (match.kind === "matched") {
    item = Zotero.Items.get(match.itemID);
    const existingPaperID = paperMetadataRepository.read(item).paperID;
    if (existingPaperID && existingPaperID !== paper.paper_id) {
      return { result: "conflict", itemIDs: [item.id] };
    }
    result = "reused";
    if (!match.inTargetSubtree) {
      await addItemToCollection(collection, item.id);
    }
  } else {
    item = new Zotero.Item("journalArticle");
    item.libraryID = collection.libraryID;
    await fillEmptyMetadata(item, paper);
    result = "created";
    await addItemToCollection(collection, item.id);
  }

  await fillEmptyMetadata(item, paper);
  await paperMetadataRepository.write(item, {
    paperID: paper.paper_id,
  });
  let pdfAdded = false;
  if (!hasPDFAttachment(item)) {
    const pdf = await paperApiClient.downloadPaperPDF(paper.paper_id);
    await attachPDF(item, paper.paper_id, pdf);
    pdfAdded = true;
  }
  return { result, itemID: item.id, pdfAdded };
}

async function fetchAllProjects() {
  const projects: ProjectResponse[] = [];
  let offset = 0;
  while (true) {
    const page = await paperApiClient.listProjects(offset, PAGE_SIZE);
    projects.push(...page.items);
    if (page.items.length === 0 && offset < page.total) {
      throw new Error(
        `Project list returned an empty page at offset ${offset}`,
      );
    }
    offset += page.items.length;
    if (offset >= page.total) {
      break;
    }
  }
  return projects;
}

function toCandidate(
  item: Zotero.Item,
  inTargetSubtree: boolean,
): ProjectSyncCandidate {
  return {
    itemID: item.id,
    paperID: paperMetadataRepository.read(item).paperID,
    doi: safeField(item, "DOI"),
    inTargetSubtree,
  };
}

async function fillEmptyMetadata(
  item: Zotero.Item,
  paper: PaperDetailResponse,
) {
  let changed = false;
  const fields: Array<[string, string]> = [
    ["title", paper.title || ""],
    ["publicationTitle", paper.publication || ""],
    ["date", paper.year ? String(paper.year) : ""],
    ["DOI", paper.doi || ""],
  ];
  fields.forEach(([field, value]) => {
    if (value && !safeField(item, field)) {
      item.setField(field, value);
      changed = true;
    }
  });
  if (paper.authors.length > 0 && item.getCreators().length === 0) {
    item.setCreators(
      paper.authors.map((name) => ({ name, creatorType: "author" })),
    );
    changed = true;
  }
  if (!item.id || changed) {
    await item.saveTx();
  }
}

async function addItemToCollection(
  collection: Zotero.Collection,
  itemID: number,
) {
  if (collection.hasItem(itemID)) {
    return;
  }
  await Zotero.DB.executeTransaction(async () => {
    await collection.addItem(itemID);
  });
}

function hasPDFAttachment(item: Zotero.Item) {
  return item.getAttachments().some((attachmentID) => {
    const attachment = Zotero.Items.get(attachmentID);
    return attachment?.attachmentContentType === "application/pdf";
  });
}

async function attachPDF(
  item: Zotero.Item,
  paperID: string,
  bytes: Uint8Array,
) {
  const path = PathUtils.join(
    Zotero.getTempDirectory().path,
    `paper-plane-x-${paperID}.pdf`,
  );
  await IOUtils.write(path, bytes);
  try {
    await Zotero.Attachments.importFromFile({
      file: path,
      parentItemID: item.id,
      title: "Paper Plane X PDF",
      contentType: "application/pdf",
    });
  } finally {
    await IOUtils.remove(path, { ignoreAbsent: true });
  }
}

function safeField(item: Zotero.Item, field: string) {
  try {
    return String(item.getField(field) || "").trim();
  } catch (_error) {
    return "";
  }
}

function readMapping() {
  return parseProjectCollectionMap(
    String(getPref("projectSyncCollectionMap") || "{}"),
  );
}

function writeMapping(mapping: ReturnType<typeof readMapping>) {
  setPref("projectSyncCollectionMap", JSON.stringify(mapping));
}
