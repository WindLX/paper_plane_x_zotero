/// <reference types="mocha" />

import { assert } from "chai";
import {
  buildPaperDetailStatusMessage,
  extractAssociatedProjects,
  extractManualUpdatePayload,
  extractPaperPlaneTags,
  mergeQuickScanTags,
} from "../src/domain/paper";

function createMockItem(overrides?: {
  title?: string;
  creators?: Array<{ firstName?: string; lastName?: string }>;
  date?: string;
  publicationTitle?: string;
  proceedingsTitle?: string;
  doi?: string;
  key?: string;
  tags?: string[];
}) {
  const values = {
    title: overrides?.title || "",
    creators: overrides?.creators || [],
    date: overrides?.date || "",
    publicationTitle: overrides?.publicationTitle || "",
    proceedingsTitle: overrides?.proceedingsTitle || "",
    doi: overrides?.doi || "",
    key: overrides?.key || "ITEM-1",
    tags: overrides?.tags || [],
  };

  return {
    key: values.key,
    getField(field: string) {
      switch (field) {
        case "title":
          return values.title;
        case "date":
          return values.date;
        case "publicationTitle":
          if (!values.publicationTitle) {
            throw new Error("publicationTitle missing");
          }
          return values.publicationTitle;
        case "proceedingsTitle":
          return values.proceedingsTitle;
        case "DOI":
          return values.doi;
        default:
          return "";
      }
    },
    getCreators() {
      return values.creators;
    },
    getTags() {
      return values.tags.map((tag) => ({ tag }));
    },
  } as unknown as Zotero.Item;
}

describe("paper domain mappers", function () {
  it("deduplicates associated projects and prefers named entries", function () {
    const result = extractAssociatedProjects({
      paper_id: "paper-1",
      authors: [],
      extraction_status: "COMPLETED",
      extraction_fact_check_status: "PASSED",
      analysis_fact_check_status: "PASSED",
      extraction_retry_count: 0,
      analysis_retry_count: 0,
      created_at: "2026-01-01",
      updated_at: "2026-01-02",
      project_id: "proj-a",
      project_ids: ["proj-a", "proj-b"],
      projects: [
        { project_id: "proj-b", name: "Project B" },
        { project_id: "proj-c", name: "Project C" },
      ],
    });

    assert.deepEqual(result, [
      { project_id: "proj-a", name: null },
      { project_id: "proj-b", name: "Project B" },
      { project_id: "proj-c", name: "Project C" },
    ]);
  });

  it("builds the local status summary from remote detail", function () {
    const result = buildPaperDetailStatusMessage({
      paper_id: "paper-1",
      authors: [],
      extraction_status: "COMPLETED",
      extraction_fact_check_status: "HUMAN_PASSED",
      analysis_fact_check_status: "FAILED",
      extraction_retry_count: 1,
      analysis_retry_count: 2,
      created_at: "2026-01-01",
      updated_at: "2026-01-02",
    });

    assert.equal(result, "extraction_fc=HUMAN_PASSED; analysis_fc=FAILED");
  });

  it("extracts normalized paper-plane tags from zotero tags", function () {
    const item = createMockItem({
      tags: [
        "ppx:agent",
        "ppx: benchmark ",
        "ppx-verdict:推荐精读",
        "plain-tag",
        "ppx:",
        "ppx:agent",
      ],
    });

    const result = extractPaperPlaneTags(item);

    assert.deepEqual(result, ["agent", "benchmark"]);
  });

  it("includes zotero ppx tags in manual update payload", function () {
    const item = createMockItem({
      title: "Attention Is All You Need",
      creators: [
        { firstName: "Ashish", lastName: "Vaswani" },
        { firstName: "Noam", lastName: "Shazeer" },
      ],
      date: "2017-06-12",
      proceedingsTitle: "NeurIPS",
      doi: "10.5555/test",
      key: "ABCD1234",
      tags: ["ppx:transformer", "ppx:nlp", "ppx-verdict:推荐精读"],
    });

    const result = extractManualUpdatePayload(item);

    assert.deepEqual(result.quick_scan, {
      verdict: "",
      reason: "",
      quick_summary: "",
      tags: ["transformer", "nlp"],
    });
    assert.deepEqual(result.authors, ["Vaswani Ashish", "Shazeer Noam"]);
    assert.equal(result.publication, "NeurIPS");
    assert.equal(result.year, 2017);
    assert.equal(result.custom_meta, '{"zotero_key":"ABCD1234"}');
  });

  it("preserves existing quick scan content while replacing tags", function () {
    const result = mergeQuickScanTags(
      {
        verdict: "推荐精读",
        reason: "important baseline",
        quick_summary: "strong benchmark and clean ablation",
        tags: ["old-tag"],
      },
      ["new-tag", "agent"],
    );

    assert.deepEqual(result, {
      verdict: "推荐精读",
      reason: "important baseline",
      quick_summary: "strong benchmark and clean ablation",
      tags: ["new-tag", "agent"],
    });
  });
});
