/// <reference types="mocha" />

import { assert } from "chai";
import { paperMetadataRepository } from "../src/infra/zotero/paperMetadataRepository";

function createMockItem(initialExtra = "") {
  let extra = initialExtra;
  let saveCalls = 0;

  return {
    item: {
      getField(field: string) {
        if (field === "extra") {
          return extra;
        }
        return "";
      },
      setField(field: string, value: string) {
        if (field === "extra") {
          extra = value;
        }
      },
      async saveTx() {
        saveCalls += 1;
      },
    } as unknown as Zotero.Item,
    getExtra() {
      return extra;
    },
    getSaveCalls() {
      return saveCalls;
    },
  };
}

describe("paperMetadataRepository", function () {
  it("reads empty metadata from empty extra", function () {
    const { item } = createMockItem("");

    const result = paperMetadataRepository.read(item);

    assert.deepEqual(result, {
      paperID: "",
      status: "",
      message: "",
    });
  });

  it("writes metadata while preserving unrelated lines", async function () {
    const { item, getExtra, getSaveCalls } = createMockItem(
      ["citation-key: foo", "paper_plane_status: OLD"].join("\n"),
    );

    await paperMetadataRepository.write(item, {
      paperID: "paper-123",
      status: "COMPLETED",
      message: "ok",
    });

    assert.include(getExtra(), "citation-key: foo");
    assert.include(getExtra(), "paper_plane_id: paper-123");
    assert.include(getExtra(), "paper_plane_status: COMPLETED");
    assert.include(getExtra(), "paper_plane_message: ok");
    assert.equal(getSaveCalls(), 1);
  });

  it("sanitizes newline values when writing", async function () {
    const { item } = createMockItem("");

    const result = await paperMetadataRepository.write(item, {
      message: "line1\nline2\r\nline3",
    });

    assert.equal(result.message, "line1 line2 line3");
  });
});
