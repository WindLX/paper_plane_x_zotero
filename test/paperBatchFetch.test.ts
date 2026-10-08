/// <reference types="mocha" />

import { assert } from "chai";
import { PaperDetailResponse } from "../src/domain/paper";
import {
  FetchDependencies,
  fetchPaperDetailsForItems,
} from "../src/features/paper/fetch/useCase";
import { syncPaperDetailToItem } from "../src/features/paper/sync/detailSync";

function detail(paperID: string): PaperDetailResponse {
  return {
    paper_id: paperID,
    authors: [],
    extraction_status: "COMPLETED",
    extraction_fact_check_status: "PASSED",
    analysis_fact_check_status: "HUMAN_PASSED",
    extraction_retry_count: 0,
    analysis_retry_count: 0,
    quick_scan: {
      tags: ["control"],
      verdict: "推荐精读",
      reason: "Strong fit",
      quick_summary: "Summary",
    },
    created_at: "2026-01-01",
    updated_at: "2026-01-02",
  };
}

function fakeItem(id: number): Zotero.Item {
  return {
    id,
    isRegularItem: () => true,
    getField: () => `Item ${id}`,
  } as unknown as Zotero.Item;
}

function paperIDMap(paperIDs: Record<number, string>) {
  const map = new Map(
    Object.entries(paperIDs).map(([id, paperID]) => [Number(id), paperID]),
  );
  return (item: Zotero.Item) => {
    const paperID = map.get(item.id);
    if (paperID === undefined) {
      throw new Error(`missing paper id for item ${item.id}`);
    }
    return paperID;
  };
}

describe("paper batch fetch", function () {
  it("batch-gets every unique paper_id and syncs each duplicate item", async function () {
    const items = [fakeItem(1), fakeItem(2), fakeItem(3)];
    const requests: string[][] = [];
    const synced: number[] = [];
    const dependencies: FetchDependencies = {
      readPaperID: paperIDMap({ 1: "p1", 2: "p1", 3: "p2" }),
      async batchGetPapers(paperIDs) {
        requests.push([...paperIDs]);
        return { items: paperIDs.map(detail) };
      },
      async syncDetail(item) {
        synced.push(item.id);
      },
    };

    const stats = await fetchPaperDetailsForItems(items, dependencies);

    assert.deepEqual(requests, [["p1", "p2"]]);
    assert.deepEqual(synced, [1, 2, 3]);
    assert.deepEqual(stats, {
      success: 3,
      failed: 0,
      skipped: 0,
      stopped: false,
    });
  });

  it("reports missing paper ids explicitly and keeps going", async function () {
    const items = [fakeItem(1), fakeItem(2), fakeItem(3)];
    const missing: string[] = [];
    const dependencies: FetchDependencies = {
      readPaperID: paperIDMap({ 1: "p1", 2: "missing", 3: "p3" }),
      async batchGetPapers() {
        return { items: [detail("p1"), detail("p3")] };
      },
      async syncDetail() {},
    };

    const stats = await fetchPaperDetailsForItems(items, dependencies, {
      onMissing(_item, paperID) {
        missing.push(paperID);
      },
    });

    assert.deepEqual(missing, ["missing"]);
    assert.deepEqual(stats, {
      success: 2,
      failed: 1,
      skipped: 0,
      stopped: false,
    });
  });

  it("skips items without a paper_id binding", async function () {
    const items = [fakeItem(1), fakeItem(2)];
    let requests = 0;
    const skipped: number[] = [];
    const dependencies: FetchDependencies = {
      readPaperID: paperIDMap({ 1: "p1", 2: "" }),
      async batchGetPapers(paperIDs) {
        requests += 1;
        return { items: paperIDs.map(detail) };
      },
      async syncDetail() {},
    };

    const stats = await fetchPaperDetailsForItems(items, dependencies, {
      onSkip(item) {
        skipped.push(item.id);
      },
    });

    assert.equal(requests, 1);
    assert.deepEqual(skipped, [2]);
    assert.deepEqual(stats, {
      success: 1,
      failed: 0,
      skipped: 1,
      stopped: false,
    });
  });

  it("splits more than 100 paper ids and continues after a failed chunk", async function () {
    const items = Array.from({ length: 150 }, (_, index) =>
      fakeItem(index + 1),
    );
    const paperIDs: Record<number, string> = {};
    items.forEach((item) => {
      paperIDs[item.id] = `p${item.id}`;
    });
    const chunkSizes: number[] = [];
    const errors: string[] = [];
    const dependencies: FetchDependencies = {
      readPaperID: paperIDMap(paperIDs),
      async batchGetPapers(ids) {
        chunkSizes.push(ids.length);
        if (chunkSizes.length === 1) {
          throw new Error("HTTP 500");
        }
        return { items: ids.map(detail) };
      },
      async syncDetail() {},
    };

    const stats = await fetchPaperDetailsForItems(items, dependencies, {
      onError(_item, reason) {
        errors.push(reason);
      },
    });

    assert.deepEqual(chunkSizes, [100, 50]);
    assert.equal(errors.length, 100);
    assert.deepEqual(stats, {
      success: 50,
      failed: 100,
      skipped: 0,
      stopped: false,
    });
  });

  it("stops before the next request when the batch session ends", async function () {
    const items = [fakeItem(1), fakeItem(2)];
    let requests = 0;
    const dependencies: FetchDependencies = {
      readPaperID: paperIDMap({ 1: "p1", 2: "p2" }),
      async batchGetPapers(paperIDs) {
        requests += 1;
        return { items: paperIDs.map(detail) };
      },
      async syncDetail() {},
    };

    const stats = await fetchPaperDetailsForItems(items, dependencies, {
      shouldContinue: () => false,
    });

    assert.equal(requests, 0);
    assert.deepEqual(stats, {
      success: 0,
      failed: 0,
      skipped: 0,
      stopped: true,
    });
  });

  it("stops before syncing the next duplicate once the batch session ends", async function () {
    const items = [fakeItem(1), fakeItem(2)];
    const synced: number[] = [];
    const dependencies: FetchDependencies = {
      readPaperID: paperIDMap({ 1: "p1", 2: "p1" }),
      async batchGetPapers() {
        return { items: [detail("p1")] };
      },
      async syncDetail(item) {
        synced.push(item.id);
      },
    };

    const stats = await fetchPaperDetailsForItems(items, dependencies, {
      shouldContinue: () => synced.length < 1,
    });

    assert.deepEqual(synced, [1]);
    assert.deepEqual(stats, {
      success: 1,
      failed: 0,
      skipped: 0,
      stopped: true,
    });
  });

  it("persists status, fact-check message, tags, and verdict", async function () {
    let extra = "";
    const tags = new Set(["ppx:old", "unrelated"]);
    let saveCalls = 0;
    const item = {
      id: 1,
      getField(field: string) {
        return field === "extra" ? extra : "";
      },
      setField(field: string, value: string) {
        if (field === "extra") extra = value;
      },
      getTags() {
        return Array.from(tags, (tag) => ({ tag }));
      },
      removeTag(tag: string) {
        tags.delete(tag);
      },
      addTag(tag: string) {
        tags.add(tag);
      },
      async saveTx() {
        saveCalls += 1;
      },
    } as unknown as Zotero.Item;

    await syncPaperDetailToItem(item, detail("paper-sync"));

    assert.include(extra, "paper_plane_id: paper-sync");
    assert.include(extra, "paper_plane_status: COMPLETED");
    assert.include(extra, "extraction_fc=PASSED");
    assert.include(extra, "analysis_fc=HUMAN_PASSED");
    assert.deepEqual(
      Array.from(tags).sort(),
      ["ppx-verdict:推荐精读", "ppx:control", "unrelated"].sort(),
    );
    assert.equal(saveCalls, 2);
  });
});
