import {
  AnalysisReport,
  QuickScan,
  SynthesisData,
} from "../../../domain/paper";

export const QUICK_SCAN_VERDICTS = [
  "推荐精读",
  "仅作参考",
  "仅看实验",
  "无需阅读",
] as const;

export type StructuredEditorValue = QuickScan | SynthesisData | AnalysisReport;

export interface StructuredJSONValidationSuccess<T> {
  ok: true;
  value: T;
  prettyText: string;
}

export interface StructuredJSONValidationFailure {
  ok: false;
  error: string;
}

export type StructuredJSONValidationResult<T> =
  | StructuredJSONValidationSuccess<T>
  | StructuredJSONValidationFailure;

export interface StructuredJSONEditorOptions<T extends StructuredEditorValue> {
  title: string;
  paperID: string;
  updatedAt?: string | null;
  description: string;
  initialValue: T | null | undefined;
  createEmptyValue: () => T;
  validateJSON: (text: string) => StructuredJSONValidationResult<T>;
  onSubmit: (value: T) => Promise<void>;
}
