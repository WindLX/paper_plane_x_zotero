/// <reference types="mocha" />

import { assert } from "chai";
import {
  ReprocessDependencies,
  ReprocessStats,
  reprocessItems,
} from "../src/features/paper/reprocess/useCase";
import {
  UnlinkDependencies,
  unlinkItemsFromProject,
} from "../src/features/paper/unlink/useCase";

interface LocalState {
  paperID: string;
  status: string;
  hasLocalPDF: boolean;
}

function fakeItem(id: number): Zotero.Item {
  return {
    id,
    isRegularItem: () => true,
    getField: () => `Item ${id}`,
  } as unknown as Zotero.Item;
}

function stateOf(states: Map<number, LocalState>, id: number): LocalState {
  const state = states.get(id);
  if (!state) {
    throw new Error(`missing local state for item ${id}`);
  }
  return state;
}

function createReprocessDependencies(
  states: Map<number, LocalState>,
  reprocess: ReprocessDependencies["reprocess"],
  writes: number[],
  failingWriteIDs: Set<number> = new Set(),
): ReprocessDependencies {
  return {
    readMetadata(item) {
      const state = stateOf(states, item.id);
      return { paperID: state.paperID, status: state.status, message: "" };
    },
    hasLocalPDF(item) {
      return stateOf(states, item.id).hasLocalPDF;
    },
    reprocess,
    async writeMetadata(item, patch) {
      writes.push(item.id);
      if (failingWriteIDs.has(item.id)) {
        throw new Error("save failed");
      }
      return {
        paperID: patch.paperID || "",
        status: patch.status || "",
        message: patch.message || "",
      };
    },
  };
}

describe("paper batch operations", function () {
  describe("reprocess", function () {
    it("reprocesses once per paper_id and writes the result to every duplicate", async function () {
      const items = [fakeItem(1), fakeItem(2), fakeItem(3)];
      const states = new Map<number, LocalState>([
        [1, { paperID: "p1", status: "COMPLETED", hasLocalPDF: true }],
        [2, { paperID: "p1", status: "COMPLETED", hasLocalPDF: true }],
        [3, { paperID: "p2", status: "HUMAN_COMPLETED", hasLocalPDF: true }],
      ]);
      const requests: string[] = [];
      const writes: number[] = [];
      const dependencies = createReprocessDependencies(
        states,
        async (item, paperID) => {
          requests.push(`${paperID}@${item.id}`);
          return {
            task_id: "task",
            status: "PENDING",
            paper_id: paperID,
            message: "queued",
          };
        },
        writes,
      );

      const stats = await reprocessItems(items, dependencies);

      assert.deepEqual(requests, ["p1@1", "p2@3"]);
      assert.deepEqual(writes, [1, 2, 3]);
      assert.deepEqual(stats, {
        success: 3,
        failed: 0,
        skipped: 0,
        stopped: false,
      });
    });

    it("skips unbound, PDF-less, and already running items", async function () {
      const items = [fakeItem(1), fakeItem(2), fakeItem(3), fakeItem(4)];
      const states = new Map<number, LocalState>([
        [1, { paperID: "", status: "", hasLocalPDF: true }],
        [2, { paperID: "p2", status: "COMPLETED", hasLocalPDF: false }],
        [3, { paperID: "p3", status: "PROCESSING", hasLocalPDF: true }],
        [4, { paperID: "p4", status: "COMPLETED", hasLocalPDF: true }],
      ]);
      const skips: Array<[number, string]> = [];
      const writes: number[] = [];
      const dependencies = createReprocessDependencies(
        states,
        async (_item, paperID) => ({
          task_id: "task",
          status: "PENDING",
          paper_id: paperID,
          message: "queued",
        }),
        writes,
      );

      const stats = await reprocessItems(items, dependencies, {
        onSkip(item, reason) {
          skips.push([item.id, reason]);
        },
      });

      assert.deepEqual(skips, [
        [1, "no-paper-id"],
        [2, "no-local-pdf"],
        [3, "in-progress"],
      ]);
      assert.deepEqual(writes, [4]);
      assert.deepEqual(stats, {
        success: 1,
        failed: 0,
        skipped: 3,
        stopped: false,
      });
    });

    it("counts one failed paper for each duplicate and keeps going", async function () {
      const items = [fakeItem(1), fakeItem(2), fakeItem(3)];
      const states = new Map<number, LocalState>([
        [1, { paperID: "p1", status: "COMPLETED", hasLocalPDF: true }],
        [2, { paperID: "p1", status: "COMPLETED", hasLocalPDF: true }],
        [3, { paperID: "p2", status: "COMPLETED", hasLocalPDF: true }],
      ]);
      const errors: number[] = [];
      const writes: number[] = [];
      const dependencies = createReprocessDependencies(
        states,
        async (_item, paperID) => {
          if (paperID === "p1") {
            throw new Error("HTTP 502");
          }
          return {
            task_id: "task",
            status: "PENDING",
            paper_id: paperID,
            message: "queued",
          };
        },
        writes,
      );

      const stats = await reprocessItems(items, dependencies, {
        onError(item) {
          errors.push(item.id);
        },
      });

      assert.deepEqual(errors, [1, 2]);
      assert.deepEqual(writes, [3]);
      assert.deepEqual(stats, {
        success: 1,
        failed: 2,
        skipped: 0,
        stopped: false,
      });
      assert.equal(stats.success + stats.failed + stats.skipped, items.length);
    });

    it("keeps a failing local save from re-counting duplicates that already succeeded", async function () {
      const items = [fakeItem(1), fakeItem(2)];
      const states = new Map<number, LocalState>([
        [1, { paperID: "p1", status: "COMPLETED", hasLocalPDF: true }],
        [2, { paperID: "p1", status: "COMPLETED", hasLocalPDF: true }],
      ]);
      const writes: number[] = [];
      const errors: number[] = [];
      const dependencies = createReprocessDependencies(
        states,
        async (_item, paperID) => ({
          task_id: "task",
          status: "PENDING",
          paper_id: paperID,
          message: "queued",
        }),
        writes,
        new Set([1]),
      );

      const stats = await reprocessItems(items, dependencies, {
        onError(item) {
          errors.push(item.id);
        },
      });

      assert.deepEqual(writes, [1, 2]);
      assert.deepEqual(errors, [1]);
      assert.deepEqual(stats, {
        success: 1,
        failed: 1,
        skipped: 0,
        stopped: false,
      });
      assert.equal(stats.success + stats.failed + stats.skipped, items.length);
    });

    it("stops before writing the next duplicate once the batch session ends", async function () {
      const items = [fakeItem(1), fakeItem(2)];
      const states = new Map<number, LocalState>([
        [1, { paperID: "p1", status: "COMPLETED", hasLocalPDF: true }],
        [2, { paperID: "p1", status: "COMPLETED", hasLocalPDF: true }],
      ]);
      const requests: string[] = [];
      const writes: number[] = [];
      const dependencies = createReprocessDependencies(
        states,
        async (_item, paperID) => {
          requests.push(paperID);
          return {
            task_id: "task",
            status: "PENDING",
            paper_id: paperID,
            message: "queued",
          };
        },
        writes,
      );

      const stats = await reprocessItems(items, dependencies, {
        shouldContinue: () => writes.length < 1,
      });

      assert.deepEqual(requests, ["p1"]);
      assert.deepEqual(writes, [1]);
      assert.deepEqual(stats, {
        success: 1,
        failed: 0,
        skipped: 0,
        stopped: true,
      });
    });

    it("stops dispatching the next paper once a window closes", async function () {
      const items = [fakeItem(1), fakeItem(2), fakeItem(3)];
      const states = new Map<number, LocalState>([
        [1, { paperID: "p1", status: "COMPLETED", hasLocalPDF: true }],
        [2, { paperID: "p2", status: "COMPLETED", hasLocalPDF: true }],
        [3, { paperID: "p3", status: "COMPLETED", hasLocalPDF: true }],
      ]);
      const requests: string[] = [];
      const writes: number[] = [];
      const dependencies = createReprocessDependencies(
        states,
        async (_item, paperID) => {
          requests.push(paperID);
          return {
            task_id: "task",
            status: "PENDING",
            paper_id: paperID,
            message: "queued",
          };
        },
        writes,
      );

      const stats: ReprocessStats = await reprocessItems(items, dependencies, {
        shouldContinue: () => writes.length < 1,
      });

      assert.deepEqual(requests, ["p1"]);
      assert.deepEqual(writes, [1]);
      assert.deepEqual(stats, {
        success: 1,
        failed: 0,
        skipped: 0,
        stopped: true,
      });
    });
  });

  describe("unlink", function () {
    it("unlinks one project per paper_id and keeps the other state", async function () {
      const items = [fakeItem(1), fakeItem(2), fakeItem(3)];
      const paperIDs = new Map([
        [1, "p1"],
        [2, "p1"],
        [3, "p2"],
      ]);
      const calls: string[] = [];
      const dependencies: UnlinkDependencies = {
        readPaperID(item) {
          return paperIDs.get(item.id) || "";
        },
        async unlinkProject(projectID, paperID) {
          calls.push(`${projectID}:${paperID}`);
        },
      };

      const stats = await unlinkItemsFromProject(
        items,
        "project-9",
        dependencies,
      );

      assert.deepEqual(calls, ["project-9:p1", "project-9:p2"]);
      assert.deepEqual(stats, {
        success: 3,
        failed: 0,
        skipped: 0,
        stopped: false,
      });
    });

    it("skips unbound items and continues after a failed unlink", async function () {
      const items = [fakeItem(1), fakeItem(2), fakeItem(3)];
      const paperIDs = new Map([
        [1, "p1"],
        [2, ""],
        [3, "p2"],
      ]);
      const errors: number[] = [];
      const dependencies: UnlinkDependencies = {
        readPaperID(item) {
          return paperIDs.get(item.id) || "";
        },
        async unlinkProject(_projectID, paperID) {
          if (paperID === "p1") {
            throw new Error("HTTP 404");
          }
        },
      };

      const stats = await unlinkItemsFromProject(
        items,
        "project-9",
        dependencies,
        {
          onError(item) {
            errors.push(item.id);
          },
        },
      );

      assert.deepEqual(errors, [1]);
      assert.deepEqual(stats, {
        success: 1,
        failed: 1,
        skipped: 1,
        stopped: false,
      });
      assert.equal(stats.success + stats.failed + stats.skipped, items.length);
    });
  });
});
