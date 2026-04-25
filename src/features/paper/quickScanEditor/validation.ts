import {
  AnalysisReport,
  Citation,
  CitedText,
  QuickScan,
  SynthesisData,
} from "../../../domain/paper";
import { QUICK_SCAN_VERDICTS, StructuredJSONValidationResult } from "./types";

const QUICK_SCAN_KEYS = ["verdict", "reason", "quick_summary", "tags"] as const;
const SYNTHESIS_KEYS = [
  "research_gap",
  "methodology",
  "key_results",
  "review_summary",
] as const;
const SYNTHESIS_RESEARCH_GAP_KEYS = [
  "context",
  "existing_limit",
  "motivation",
] as const;
const SYNTHESIS_METHODOLOGY_KEYS = [
  "approach_name",
  "core_logic",
  "innovation",
  "disadvantage",
  "future_direction",
] as const;
const SYNTHESIS_KEY_RESULTS_KEYS = [
  "dataset_env",
  "baseline",
  "performance",
] as const;
const ANALYSIS_KEYS = [
  "prerequisites",
  "core_formulation",
  "derivation_steps",
  "related_references",
] as const;
const ANALYSIS_PREREQUISITE_KEYS = [
  "concept_name",
  "brief_explanation",
  "relevance_to_paper",
] as const;
const ANALYSIS_CORE_FORMULATION_KEYS = [
  "problem_definition",
  "objective_function",
  "algorithm_flow",
] as const;
const ANALYSIS_DERIVATION_STEP_KEYS = [
  "step_order",
  "step_name",
  "detail_explanation",
] as const;
const ANALYSIS_RELATED_REFERENCE_KEYS = ["title", "reason"] as const;
const CITED_TEXT_KEYS = ["text", "citations"] as const;
const CITATION_KEYS = ["quote", "source_header"] as const;

export function createEmptyQuickScan(): QuickScan {
  return {
    verdict: QUICK_SCAN_VERDICTS[1],
    reason: "",
    quick_summary: "",
    tags: [],
  };
}

export function createEmptySynthesisData(): SynthesisData {
  return {};
}

export function createEmptyAnalysisReport(): AnalysisReport {
  return {};
}

export function stringifyStructuredJSON<T>(
  value: T | null | undefined,
  fallback: T,
) {
  return JSON.stringify(value ?? fallback, null, 2);
}

export function validateQuickScanJSON(
  text: string,
): StructuredJSONValidationResult<QuickScan> {
  return validateJSONRoot(text, "quick_scan", normalizeQuickScan);
}

export function validateSynthesisJSON(
  text: string,
): StructuredJSONValidationResult<SynthesisData> {
  return validateJSONRoot(text, "synthesis_data", normalizeSynthesisData);
}

export function validateAnalysisJSON(
  text: string,
): StructuredJSONValidationResult<AnalysisReport> {
  return validateJSONRoot(text, "analysis_report", normalizeAnalysisReport);
}

function validateJSONRoot<T>(
  text: string,
  label: string,
  normalizer: (value: unknown, path: string) => T,
): StructuredJSONValidationResult<T> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: `Invalid JSON: ${message}`,
    };
  }

  try {
    const normalized = normalizer(parsed, label);
    return {
      ok: true,
      value: normalized,
      prettyText: JSON.stringify(normalized, null, 2),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function normalizeQuickScan(value: unknown, path: string): QuickScan {
  const parsed = expectObjectWithExactKeys(value, QUICK_SCAN_KEYS, path);
  const verdict = expectEnum(
    parsed.verdict,
    QUICK_SCAN_VERDICTS,
    `${path}.verdict`,
  );
  const reason = expectString(parsed.reason, `${path}.reason`);
  const quickSummary = expectString(
    parsed.quick_summary,
    `${path}.quick_summary`,
  );
  const tags = expectStringArray(parsed.tags, `${path}.tags`, true);

  return {
    verdict,
    reason,
    quick_summary: quickSummary,
    tags,
  };
}

function normalizeSynthesisData(value: unknown, path: string): SynthesisData {
  const parsed = expectObjectWithAllowedKeys(value, SYNTHESIS_KEYS, path);
  const normalized: SynthesisData = {};

  if ("research_gap" in parsed) {
    normalized.research_gap = normalizeOptionalObject(
      parsed.research_gap,
      SYNTHESIS_RESEARCH_GAP_KEYS,
      `${path}.research_gap`,
      (input, childPath) => ({
        context:
          "context" in input
            ? normalizeCitedText(input.context, `${childPath}.context`)
            : undefined,
        existing_limit:
          "existing_limit" in input
            ? normalizeCitedText(
                input.existing_limit,
                `${childPath}.existing_limit`,
              )
            : undefined,
        motivation:
          "motivation" in input
            ? normalizeCitedText(input.motivation, `${childPath}.motivation`)
            : undefined,
      }),
    );
  }

  if ("methodology" in parsed) {
    normalized.methodology = normalizeOptionalObject(
      parsed.methodology,
      SYNTHESIS_METHODOLOGY_KEYS,
      `${path}.methodology`,
      (input, childPath) => ({
        approach_name:
          "approach_name" in input
            ? expectString(input.approach_name, `${childPath}.approach_name`)
            : undefined,
        core_logic:
          "core_logic" in input
            ? normalizeCitedText(input.core_logic, `${childPath}.core_logic`)
            : undefined,
        innovation:
          "innovation" in input
            ? normalizeCitedText(input.innovation, `${childPath}.innovation`)
            : undefined,
        disadvantage:
          "disadvantage" in input
            ? normalizeCitedText(
                input.disadvantage,
                `${childPath}.disadvantage`,
              )
            : undefined,
        future_direction:
          "future_direction" in input
            ? normalizeCitedText(
                input.future_direction,
                `${childPath}.future_direction`,
              )
            : undefined,
      }),
    );
  }

  if ("key_results" in parsed) {
    normalized.key_results = normalizeOptionalObject(
      parsed.key_results,
      SYNTHESIS_KEY_RESULTS_KEYS,
      `${path}.key_results`,
      (input, childPath) => ({
        dataset_env:
          "dataset_env" in input
            ? normalizeCitedText(input.dataset_env, `${childPath}.dataset_env`)
            : undefined,
        baseline:
          "baseline" in input
            ? normalizeCitedText(input.baseline, `${childPath}.baseline`)
            : undefined,
        performance:
          "performance" in input
            ? normalizeCitedText(input.performance, `${childPath}.performance`)
            : undefined,
      }),
    );
  }

  if ("review_summary" in parsed) {
    normalized.review_summary = normalizeCitedText(
      parsed.review_summary,
      `${path}.review_summary`,
    );
  }

  return normalized;
}

function normalizeAnalysisReport(value: unknown, path: string): AnalysisReport {
  const parsed = expectObjectWithAllowedKeys(value, ANALYSIS_KEYS, path);
  const normalized: AnalysisReport = {};

  if ("prerequisites" in parsed) {
    normalized.prerequisites = expectArray(
      parsed.prerequisites,
      `${path}.prerequisites`,
    ).map((item, index) => {
      const row = expectObjectWithAllowedKeys(
        item,
        ANALYSIS_PREREQUISITE_KEYS,
        `${path}.prerequisites[${index}]`,
      );
      return {
        concept_name:
          "concept_name" in row
            ? expectString(
                row.concept_name,
                `${path}.prerequisites[${index}].concept_name`,
              )
            : undefined,
        brief_explanation:
          "brief_explanation" in row
            ? expectString(
                row.brief_explanation,
                `${path}.prerequisites[${index}].brief_explanation`,
              )
            : undefined,
        relevance_to_paper:
          "relevance_to_paper" in row
            ? normalizeCitedText(
                row.relevance_to_paper,
                `${path}.prerequisites[${index}].relevance_to_paper`,
              )
            : undefined,
      };
    });
  }

  if ("core_formulation" in parsed) {
    normalized.core_formulation = normalizeOptionalObject(
      parsed.core_formulation,
      ANALYSIS_CORE_FORMULATION_KEYS,
      `${path}.core_formulation`,
      (input, childPath) => ({
        problem_definition:
          "problem_definition" in input
            ? normalizeCitedText(
                input.problem_definition,
                `${childPath}.problem_definition`,
              )
            : undefined,
        objective_function:
          "objective_function" in input
            ? normalizeCitedText(
                input.objective_function,
                `${childPath}.objective_function`,
              )
            : undefined,
        algorithm_flow:
          "algorithm_flow" in input
            ? normalizeCitedText(
                input.algorithm_flow,
                `${childPath}.algorithm_flow`,
              )
            : undefined,
      }),
    );
  }

  if ("derivation_steps" in parsed) {
    normalized.derivation_steps = expectArray(
      parsed.derivation_steps,
      `${path}.derivation_steps`,
    ).map((item, index) => {
      const row = expectObjectWithAllowedKeys(
        item,
        ANALYSIS_DERIVATION_STEP_KEYS,
        `${path}.derivation_steps[${index}]`,
      );
      return {
        step_order:
          "step_order" in row
            ? expectNumber(
                row.step_order,
                `${path}.derivation_steps[${index}].step_order`,
              )
            : undefined,
        step_name:
          "step_name" in row
            ? expectString(
                row.step_name,
                `${path}.derivation_steps[${index}].step_name`,
              )
            : undefined,
        detail_explanation:
          "detail_explanation" in row
            ? normalizeCitedText(
                row.detail_explanation,
                `${path}.derivation_steps[${index}].detail_explanation`,
              )
            : undefined,
      };
    });
  }

  if ("related_references" in parsed) {
    normalized.related_references = expectArray(
      parsed.related_references,
      `${path}.related_references`,
    ).map((item, index) => {
      const row = expectObjectWithAllowedKeys(
        item,
        ANALYSIS_RELATED_REFERENCE_KEYS,
        `${path}.related_references[${index}]`,
      );
      return {
        title:
          "title" in row
            ? expectString(
                row.title,
                `${path}.related_references[${index}].title`,
              )
            : undefined,
        reason:
          "reason" in row
            ? expectString(
                row.reason,
                `${path}.related_references[${index}].reason`,
              )
            : undefined,
      };
    });
  }

  return normalized;
}

function normalizeCitedText(value: unknown, path: string): CitedText {
  const parsed = expectObjectWithExactKeys(value, CITED_TEXT_KEYS, path);
  return {
    text: expectString(parsed.text, `${path}.text`),
    citations: expectArray(parsed.citations, `${path}.citations`).map(
      (item, index) => normalizeCitation(item, `${path}.citations[${index}]`),
    ),
  };
}

function normalizeCitation(value: unknown, path: string): Citation {
  const parsed = expectObjectWithExactKeys(value, CITATION_KEYS, path);
  return {
    quote: expectString(parsed.quote, `${path}.quote`),
    source_header: expectString(parsed.source_header, `${path}.source_header`),
  };
}

function normalizeOptionalObject<T>(
  value: unknown,
  allowedKeys: readonly string[],
  path: string,
  mapper: (input: Record<string, unknown>, path: string) => T,
) {
  const parsed = expectObjectWithAllowedKeys(value, allowedKeys, path);
  return mapper(parsed, path);
}

function expectObjectWithExactKeys(
  value: unknown,
  expectedKeys: readonly string[],
  path: string,
) {
  const parsed = expectObject(value, path);
  const actualKeys = Object.keys(parsed).sort();
  const sortedExpected = [...expectedKeys].sort();
  if (
    actualKeys.length !== sortedExpected.length ||
    actualKeys.some((key, index) => key !== sortedExpected[index])
  ) {
    throw new Error(
      `${path} must contain exactly these keys: ${expectedKeys.join(", ")}`,
    );
  }
  return parsed;
}

function expectObjectWithAllowedKeys(
  value: unknown,
  allowedKeys: readonly string[],
  path: string,
) {
  const parsed = expectObject(value, path);
  const invalidKey = Object.keys(parsed).find(
    (key) => !allowedKeys.includes(key),
  );
  if (invalidKey) {
    throw new Error(`${path} contains unsupported key: ${invalidKey}`);
  }
  return parsed;
}

function expectObject(value: unknown, path: string) {
  if (!isPlainObject(value)) {
    throw new Error(`${path} must be a JSON object`);
  }
  return value;
}

function expectArray(value: unknown, path: string) {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array`);
  }
  return value;
}

function expectString(value: unknown, path: string) {
  if (typeof value !== "string") {
    throw new Error(`${path} must be a string`);
  }
  return value;
}

function expectNumber(value: unknown, path: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${path} must be a finite number`);
  }
  return value;
}

function expectEnum<T extends readonly string[]>(
  value: unknown,
  options: T,
  path: string,
): T[number] {
  if (typeof value !== "string" || !options.includes(value)) {
    throw new Error(`${path} must be one of: ${options.join(", ")}`);
  }
  return value;
}

function expectStringArray(value: unknown, path: string, trimItems = false) {
  const list = expectArray(value, path);
  return list.map((item, index) => {
    if (typeof item !== "string") {
      throw new Error(`${path}[${index}] must be a string`);
    }
    const normalized = trimItems ? item.trim() : item;
    if (trimItems && !normalized) {
      throw new Error(`${path}[${index}] must not be empty`);
    }
    return normalized;
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
