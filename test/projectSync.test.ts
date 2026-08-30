/// <reference types="mocha" />

import { assert } from "chai";
import {
  buildProjectSyncPDFFilename,
  collectProjectSyncSubtreeItemIDs,
  fetchAllProjectPapers,
  matchProjectPaper,
  normalizeProjectSyncDOI,
} from "../src/domain/projectSync";
import {
  findProjectsMappedToCollection,
  mapProjectToCollection,
  parseProjectCollectionMap,
  removeProjectsMappedToCollection,
} from "../src/domain/projectSyncMapping";
import { PaperDetailResponse } from "../src/domain/paper";
import { getSingleCollectionMenuRow } from "../src/features/projectSync/menuContext";

function paper(paperID: string, doi?: string): PaperDetailResponse {
  return {
    paper_id: paperID,
    doi,
    authors: [],
    extraction_status: "PENDING",
    extraction_fact_check_status: "PENDING",
    analysis_fact_check_status: "PENDING",
    extraction_retry_count: 0,
    analysis_retry_count: 0,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  };
}

describe("PPX project to Zotero collection sync", function () {
  it("builds searchable PDF names from title and first author", function () {
    assert.equal(
      buildProjectSyncPDFFilename({
        ...paper("paper-1"),
        title: "Flight/Control: A Study?",
        authors: ["Alice Smith", "Bob Chen"],
      }),
      "Flight Control A Study - Alice Smith.pdf",
    );
  });

  it("keeps attachment filenames portable and within filesystem limits", function () {
    const filename = buildProjectSyncPDFFilename({
      ...paper("paper-1"),
      title: "飞行控制".repeat(80),
      authors: ["张三"],
    });

    assert.isAtMost(new TextEncoder().encode(filename).length, 220);
    assert.match(filename, /\.pdf$/);
    assert.notMatch(filename, /[<>:"/\\|?*]/);
  });

  it("does not invent an author when metadata is missing", function () {
    assert.equal(
      buildProjectSyncPDFFilename({
        ...paper("paper-1"),
        title: "A Useful Paper",
      }),
      "A Useful Paper.pdf",
    );
  });

  it("uses Zotero 10 plural collection rows without reading the removed getter", function () {
    const selectedRow = { id: 7 };
    const context = {
      collectionTreeRows: [selectedRow],
      get collectionTreeRow(): never {
        throw new Error(
          "collectionTreeRow was removed -- use collectionTreeRows",
        );
      },
    };

    assert.equal(getSingleCollectionMenuRow(context), selectedRow);
    assert.isUndefined(
      getSingleCollectionMenuRow({
        collectionTreeRows: [selectedRow, { id: 8 }],
      }),
    );
  });

  it("keeps the Zotero 7 singular collection row fallback", function () {
    const selectedRow = { id: 7 };

    assert.equal(
      getSingleCollectionMenuRow({ collectionTreeRow: selectedRow }),
      selectedRow,
    );
  });

  it("normalizes DOI URLs and prefixes", function () {
    assert.equal(
      normalizeProjectSyncDOI(" HTTPS://doi.org/10.1000/Example "),
      "10.1000/example",
    );
    assert.equal(
      normalizeProjectSyncDOI("doi: 10.1000/Example"),
      "10.1000/example",
    );
  });

  it("recursively expands nested collection items", function () {
    const itemIDs = collectProjectSyncSubtreeItemIDs(1, [
      { collectionID: 1, parentCollectionID: null, itemIDs: [10] },
      { collectionID: 2, parentCollectionID: 1, itemIDs: [20] },
      { collectionID: 3, parentCollectionID: 2, itemIDs: [30] },
      { collectionID: 4, parentCollectionID: null, itemIDs: [40] },
    ]);

    assert.deepEqual(Array.from(itemIDs).sort(), [10, 20, 30]);
  });

  it("prefers the target subtree before a library-wide match", function () {
    const result = matchProjectPaper(paper("paper-1", "10.1000/a"), [
      { itemID: 1, paperID: "", doi: "10.1000/a", inTargetSubtree: false },
      { itemID: 2, paperID: "paper-1", doi: "", inTargetSubtree: true },
    ]);

    assert.deepEqual(result, {
      kind: "matched",
      itemID: 2,
      inTargetSubtree: true,
    });
  });

  it("reports multiple DOI matches without choosing one", function () {
    const result = matchProjectPaper(paper("paper-1", "10.1000/a"), [
      { itemID: 1, paperID: "", doi: "10.1000/a", inTargetSubtree: true },
      { itemID: 2, paperID: "", doi: "doi:10.1000/A", inTargetSubtree: true },
    ]);

    assert.deepEqual(result, { kind: "conflict", itemIDs: [1, 2] });
  });

  it("pages IDs, batches details, and reports missing details", async function () {
    const searchedOffsets: number[] = [];
    const batches: string[][] = [];
    const result = await fetchAllProjectPapers(
      {
        async searchProjectPapers(_projectID, offset) {
          searchedOffsets.push(offset);
          return offset === 0
            ? { paper_ids: ["p1", "p2"], total: 3 }
            : { paper_ids: ["p3"], total: 3 };
        },
        async batchGetPapers(paperIDs) {
          batches.push(paperIDs);
          return { items: [paper("p1"), paper("p3")] };
        },
      },
      "project-1",
    );

    assert.deepEqual(searchedOffsets, [0, 2]);
    assert.deepEqual(batches, [["p1", "p2", "p3"]]);
    assert.deepEqual(
      result.papers.map((item) => item.paper_id),
      ["p1", "p3"],
    );
    assert.deepEqual(result.missingPaperIDs, ["p2"]);
  });

  it("stores one target per PPX project and ignores malformed preferences", function () {
    assert.deepEqual(parseProjectCollectionMap("not-json"), {});
    const first = mapProjectToCollection({}, "project-1", {
      libraryID: 1,
      collectionID: 2,
    });
    const second = mapProjectToCollection(first, "project-1", {
      libraryID: 1,
      collectionID: 3,
    });

    assert.deepEqual(parseProjectCollectionMap(JSON.stringify(second)), {
      "project-1": { libraryID: 1, collectionID: 3 },
    });
  });

  it("finds and removes every project mapped to one collection", function () {
    const mapping = {
      "project-2": { libraryID: 1, collectionID: 3 },
      "project-1": { libraryID: 1, collectionID: 3 },
      "project-3": { libraryID: 1, collectionID: 4 },
      "project-4": { libraryID: 2, collectionID: 3 },
    };

    assert.deepEqual(
      findProjectsMappedToCollection(mapping, {
        libraryID: 1,
        collectionID: 3,
      }),
      ["project-1", "project-2"],
    );
    assert.deepEqual(
      removeProjectsMappedToCollection(mapping, {
        libraryID: 1,
        collectionID: 3,
      }),
      {
        "project-3": { libraryID: 1, collectionID: 4 },
        "project-4": { libraryID: 2, collectionID: 3 },
      },
    );
    assert.property(mapping, "project-1");
  });
});
