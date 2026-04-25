export interface UploadResponse {
  task_id: string;
  status: string;
  paper_id?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  message: string;
}

export interface Citation {
  quote: string;
  source_header: string;
}

export interface CitedText {
  text: string;
  citations: Citation[];
}

export interface QuickScan {
  tags: string[];
  verdict: "推荐精读" | "仅作参考" | "仅看实验" | "无需阅读" | string;
  reason: string;
  quick_summary: string;
}

export interface SynthesisData {
  research_gap?: {
    context?: CitedText;
    existing_limit?: CitedText;
    motivation?: CitedText;
  };
  methodology?: {
    approach_name?: string;
    core_logic?: CitedText;
    innovation?: CitedText;
    disadvantage?: CitedText;
    future_direction?: CitedText;
  };
  key_results?: {
    dataset_env?: CitedText;
    baseline?: CitedText;
    performance?: CitedText;
  };
  review_summary?: CitedText;
}

export interface AnalysisReport {
  prerequisites?: Array<{
    concept_name?: string;
    brief_explanation?: string;
    relevance_to_paper?: CitedText;
  }>;
  core_formulation?: {
    problem_definition?: CitedText;
    objective_function?: CitedText;
    algorithm_flow?: CitedText;
  };
  derivation_steps?: Array<{
    step_order?: number;
    step_name?: string;
    detail_explanation?: CitedText;
  }>;
  related_references?: Array<{
    title?: string;
    reason?: string;
  }>;
}

export interface PaperDetailResponse {
  paper_id: string;
  title?: string | null;
  authors: string[];
  year?: number | null;
  publication?: string | null;
  doi?: string | null;
  custom_meta?: string | null;
  extraction_status: string;
  extraction_fact_check_status: string;
  analysis_fact_check_status: string;
  extraction_retry_count: number;
  analysis_retry_count: number;
  created_at: string;
  updated_at: string;
  quick_scan?: QuickScan | null;
  synthesis_data?: SynthesisData | null;
  analysis_report?: AnalysisReport | null;
  extraction_fact_check_result?: Record<string, unknown> | null;
  analysis_fact_check_result?: Record<string, unknown> | null;
  project_ids?: string[];
  project_id?: string | null;
  projects?: Array<{
    project_id?: string;
    name?: string | null;
  }>;
}

export interface ProjectSummary {
  project_id: string;
  name: string | null;
}

export interface ProjectResponse {
  project_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageResponse {
  message: string;
}

export interface PaperStatusOverrides {
  extraction_status?: string;
  extraction_fact_check_status?: string;
  analysis_fact_check_status?: string;
}
