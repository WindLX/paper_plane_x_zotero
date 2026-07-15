/// <reference types="mocha" />

import { assert } from "chai";
import { PaperDetailResponse } from "../src/domain/paper";
import { buildPaperListRemoteMetadata } from "../src/features/paper/list/metadataCache";

function detail(overrides: Partial<PaperDetailResponse>): PaperDetailResponse {
  return {
    paper_id: "paper-1",
    authors: [],
    extraction_status: "COMPLETED",
    extraction_fact_check_status: "PASSED",
    analysis_fact_check_status: "PASSED",
    extraction_retry_count: 0,
    analysis_retry_count: 0,
    created_at: "2026-01-01",
    updated_at: "2026-01-02",
    ...overrides,
  };
}

describe("paper list metadata", function () {
  it("formats projects with embedded and cached names", function () {
    const value = buildPaperListRemoteMetadata(
      detail({
        project_ids: ["project-a", "project-b"],
        projects: [{ project_id: "project-a", name: "Project A" }],
      }),
      new Map([["project-b", "Project B"]]),
    );

    assert.equal(
      value.projectSummary,
      "project-a (Project A); project-b (Project B)",
    );
  });

  it("extracts quick scan recommendation fields", function () {
    const value = buildPaperListRemoteMetadata(
      detail({
        quick_scan: {
          tags: ["control"],
          verdict: "推荐精读",
          reason: "Strong baseline",
          quick_summary: "A concise summary",
        },
      }),
    );

    assert.deepInclude(value, {
      verdict: "推荐精读",
      reason: "Strong baseline",
      quickSummary: "A concise summary",
    });
  });
});
