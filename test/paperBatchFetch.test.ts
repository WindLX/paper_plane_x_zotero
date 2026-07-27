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

describe("paper batch fetch", function () {
  it("continues after failures and reports success, failure, and skipped counts", async function () {
    const items = [fakeItem(1), fakeItem(2), fakeItem(3)];
    const paperIDs = new Map([
      [1, "paper-success"],
      [2, "paper-failure"],
      [3, ""],
    ]);
    const synced: number[] = [];
    const progress: number[] = [];
    const dependencies: FetchDependencies = {
      readPaperID(item) {
        return paperIDs.get(item.id) || "";
      },
      async fetchDetail(paperID) {
        if (paperID === "paper-failure") {
          throw new Error("network failure");
        }
        return detail(paperID);
      },
      async syncDetail(item) {
        synced.push(item.id);
      },
    };

    const stats = await fetchPaperDetailsForItems(items, dependencies, {
      onProgress(processed) {
        progress.push(processed);
      },
    });

    assert.deepEqual(stats, { success: 1, failed: 1, skipped: 1 });
    assert.deepEqual(synced, [1]);
    assert.deepEqual(progress, [1, 2, 3]);
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
