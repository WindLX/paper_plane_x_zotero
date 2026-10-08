/// <reference types="mocha" />

import { assert } from "chai";
import {
  BatchItemMetadata,
  chunkPaperIDs,
  isInProgressStatus,
  planPaperIDGroups,
  planReprocessGroups,
  uniquePaperIDs,
} from "../src/domain/paperBatch";

function item(
  itemID: number,
  paperID: string,
  status: string,
  hasLocalPDF: boolean,
): BatchItemMetadata {
  return { itemID, paperID, status, hasLocalPDF };
}

describe("paper batch planning", function () {
  it("skips missing bindings and missing PDFs, then merges duplicate paper ids", function () {
    const plan = planReprocessGroups([
      item(1, "p1", "COMPLETED", true),
      item(2, "", "", true),
      item(3, "p2", "COMPLETED", false),
      item(4, "p1", "COMPLETED", true),
    ]);

    assert.deepEqual(plan.groups, [
      { paperID: "p1", itemIDs: [1, 4], pdfSourceItemID: 1 },
    ]);
    assert.deepEqual(plan.skips, [
      { itemID: 2, reason: "no-paper-id", status: "" },
      { itemID: 3, reason: "no-local-pdf", status: "COMPLETED" },
    ]);
  });

  it("skips items whose backend status is still pending or processing", function () {
    const plan = planReprocessGroups([
      item(1, "p1", "PROCESSING", true),
      item(2, "p2", "pending", true),
      item(3, "p3", "completed", true),
    ]);

    assert.deepEqual(plan.skips, [
      { itemID: 1, reason: "in-progress", status: "PROCESSING" },
      { itemID: 2, reason: "in-progress", status: "pending" },
    ]);
    assert.deepEqual(
      plan.groups.map((group) => group.paperID),
      ["p3"],
    );
    assert.isTrue(isInProgressStatus(" PROCESSING "));
    assert.isFalse(isInProgressStatus("COMPLETED"));
  });

  it("uses the first group member with a local PDF as the request source", function () {
    const plan = planPaperIDGroups([
      item(1, "p1", "COMPLETED", false),
      item(2, "p1", "COMPLETED", true),
      item(3, "p1", "COMPLETED", true),
    ]);

    assert.deepEqual(plan.groups, [
      { paperID: "p1", itemIDs: [1, 2, 3], pdfSourceItemID: 2 },
    ]);
  });

  it("keeps the group paper id order for batched requests", function () {
    const plan = planPaperIDGroups([
      item(1, "p1", "", false),
      item(2, "p2", "", false),
      item(3, "p1", "", false),
    ]);

    assert.deepEqual(uniquePaperIDs(plan.groups), ["p1", "p2"]);
  });

  it("chunks paper ids into batches of at most 100", function () {
    const paperIDs = Array.from({ length: 205 }, (_, index) => `p${index}`);
    const chunks = chunkPaperIDs(paperIDs);

    assert.deepEqual(
      chunks.map((chunk) => chunk.length),
      [100, 100, 5],
    );
    assert.deepEqual(chunks.flat(), paperIDs);
    assert.deepEqual(chunkPaperIDs([], 100), []);
  });
});
