/// <reference types="mocha" />

import { assert } from "chai";
import { getSelectedRegularItems } from "../src/features/paper/batch/selection";

function fakeItem(id: number, regularItem = true): Zotero.Item {
  return {
    id,
    isRegularItem: () => regularItem,
  } as unknown as Zotero.Item;
}

const globalScope = globalThis as { Zotero?: unknown };

describe("paper batch selection", function () {
  let originalZotero: unknown;

  beforeEach(function () {
    originalZotero = globalScope.Zotero;
  });

  afterEach(function () {
    globalScope.Zotero = originalZotero;
  });

  it("keeps an empty menu selection instead of using another window's selection", function () {
    let paneCalls = 0;
    globalScope.Zotero = {
      getActiveZoteroPane: () => {
        paneCalls += 1;
        return { getSelectedItems: () => [fakeItem(1)] };
      },
    };

    assert.deepEqual(getSelectedRegularItems([]), []);
    assert.equal(paneCalls, 0);
  });

  it("uses the active Zotero pane only when the menu context has no items", function () {
    globalScope.Zotero = {
      getActiveZoteroPane: () => ({
        getSelectedItems: () => [fakeItem(1), fakeItem(2, false)],
      }),
    };

    assert.deepEqual(
      getSelectedRegularItems(undefined).map((item) => item.id),
      [1],
    );
  });
});
