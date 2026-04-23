/// <reference types="mocha" />

import { assert } from "chai";
import {
  createEmptyAnalysisReport,
  createEmptyQuickScan,
  createEmptySynthesisData,
  stringifyStructuredJSON,
  validateAnalysisJSON,
  validateQuickScanJSON,
  validateSynthesisJSON,
} from "../src/features/paper/quickScanEditor/validation";

describe("quickScanEditor validation", function () {
  it("creates a valid empty quick scan template", function () {
    const result = validateQuickScanJSON(
      stringifyStructuredJSON(createEmptyQuickScan(), createEmptyQuickScan()),
    );

    assert.isTrue(result.ok);
    if (result.ok) {
      assert.deepEqual(result.value, {
        verdict: "仅作参考",
        reason: "",
        quick_summary: "",
        tags: [],
      });
    }
  });

  it("rejects extra keys", function () {
    const result = validateQuickScanJSON(
      JSON.stringify({
        verdict: "推荐精读",
        reason: "r",
        quick_summary: "s",
        tags: ["agent"],
        extra: true,
      }),
    );

    assert.isFalse(result.ok);
    if (!result.ok) {
      assert.include(result.error, "exactly these keys");
    }
  });

  it("rejects invalid verdict values", function () {
    const result = validateQuickScanJSON(
      JSON.stringify({
        verdict: "bad",
        reason: "r",
        quick_summary: "s",
        tags: ["agent"],
      }),
    );

    assert.isFalse(result.ok);
    if (!result.ok) {
      assert.include(result.error, "verdict must be one of");
    }
  });

  it("rejects non-string tags and empty tag strings", function () {
    const badType = validateQuickScanJSON(
      JSON.stringify({
        verdict: "推荐精读",
        reason: "r",
        quick_summary: "s",
        tags: ["ok", 1],
      }),
    );
    const emptyTag = validateQuickScanJSON(
      JSON.stringify({
        verdict: "推荐精读",
        reason: "r",
        quick_summary: "s",
        tags: ["ok", "   "],
      }),
    );

    assert.isFalse(badType.ok);
    assert.isFalse(emptyTag.ok);
  });

  it("accepts an empty synthesis template", function () {
    const result = validateSynthesisJSON(
      stringifyStructuredJSON(createEmptySynthesisData(), createEmptySynthesisData()),
    );

    assert.isTrue(result.ok);
    if (result.ok) {
      assert.deepEqual(result.value, {});
    }
  });

  it("rejects unsupported synthesis keys", function () {
    const result = validateSynthesisJSON(
      JSON.stringify({
        research_gap: {},
        extra: true,
      }),
    );

    assert.isFalse(result.ok);
    if (!result.ok) {
      assert.include(result.error, "unsupported key");
    }
  });

  it("accepts an empty analysis template", function () {
    const result = validateAnalysisJSON(
      stringifyStructuredJSON(createEmptyAnalysisReport(), createEmptyAnalysisReport()),
    );

    assert.isTrue(result.ok);
    if (result.ok) {
      assert.deepEqual(result.value, {});
    }
  });

  it("rejects invalid analysis step_order values", function () {
    const result = validateAnalysisJSON(
      JSON.stringify({
        derivation_steps: [
          {
            step_order: "1",
            step_name: "A",
            detail_explanation: {
              text: "x",
              citations: [],
            },
          },
        ],
      }),
    );

    assert.isFalse(result.ok);
    if (!result.ok) {
      assert.include(result.error, "step_order");
    }
  });
});
