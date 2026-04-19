import { getPref } from "../utils/prefs";

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

export function getPaperServiceBaseURL() {
    return (getPref("paperPlaneBaseURL") || "").trim().replace(/\/+$/, "");
}

export function buildPaperCollectionEndpoint(baseURL: string) {
    return `${baseURL}/api/v1/papers`;
}

export function buildPaperDetailEndpoint(baseURL: string, paperID: string) {
    return `${buildPaperCollectionEndpoint(baseURL)}/${encodeURIComponent(paperID)}`;
}

export function buildProjectDetailEndpoint(baseURL: string, projectID: string) {
    return `${baseURL}/api/v1/projects/${encodeURIComponent(projectID)}`;
}

export function buildProjectPaperLinkEndpoint(
    baseURL: string,
    projectID: string,
    paperID: string,
) {
    return `${buildProjectDetailEndpoint(baseURL, projectID)}/papers/${encodeURIComponent(paperID)}`;
}

export async function createPaperFromItem(item: Zotero.Item) {
    const baseURL = getPaperServiceBaseURL();
    if (!baseURL) {
        throw new Error("paper service base URL is empty");
    }

    const pdfPath = getFirstPdfPath(item);
    if (!pdfPath) {
        return {
            result: "skipped" as const,
        };
    }

    const payload = extractPayload(item);
    const response = await submitPaper(buildPaperCollectionEndpoint(baseURL), pdfPath, payload);
    return {
        result: "success" as const,
        response,
    };
}

export async function fetchPaperDetail(paperID: string): Promise<PaperDetailResponse> {
    const baseURL = getPaperServiceBaseURL();
    if (!baseURL) {
        throw new Error("paper service base URL is empty");
    }

    const response = await fetch(buildPaperDetailEndpoint(baseURL, paperID), {
        method: "GET",
        headers: {
            Accept: "application/json",
        },
    });

    return parseJSONResponse<PaperDetailResponse>(response);
}

export async function manualUpdatePaperMetadata(item: Zotero.Item, paperID: string) {
    const baseURL = getPaperServiceBaseURL();
    if (!baseURL) {
        throw new Error("paper service base URL is empty");
    }

    const endpoint = buildPaperDetailEndpoint(baseURL, paperID);
    const payload = extractManualUpdatePayload(item);
    const response = await fetch(endpoint, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify(payload),
    });

    return parseJSONResponse<PaperDetailResponse>(response);
}

export async function reprocessPaper(item: Zotero.Item, paperID: string) {
    const baseURL = getPaperServiceBaseURL();
    if (!baseURL) {
        throw new Error("paper service base URL is empty");
    }

    const pdfPath = getFirstPdfPath(item);
    if (!pdfPath) {
        throw new Error("local pdf not found");
    }

    const pdfBytes = await IOUtils.read(pdfPath);
    const pdfName = getFileName(pdfPath);
    const boundary = createMultipartBoundary();
    const body = buildMultipartBody(boundary, pdfName, pdfBytes, {
        customMeta: "",
    });

    const response = await fetch(
        `${buildPaperDetailEndpoint(baseURL, paperID)}/reprocess`,
        {
            method: "POST",
            headers: {
                "Content-Type": `multipart/form-data; boundary=${boundary}`,
                Accept: "application/json",
            },
            body,
        },
    );

    return parseJSONResponse<UploadResponse>(response);
}

export async function fetchProjectDetail(projectID: string): Promise<ProjectResponse> {
    const baseURL = getPaperServiceBaseURL();
    if (!baseURL) {
        throw new Error("paper service base URL is empty");
    }

    const response = await fetch(buildProjectDetailEndpoint(baseURL, projectID), {
        method: "GET",
        headers: {
            Accept: "application/json",
        },
    });

    return parseJSONResponse<ProjectResponse>(response);
}

export async function linkPaperToProject(projectID: string, paperID: string) {
    const baseURL = getPaperServiceBaseURL();
    if (!baseURL) {
        throw new Error("paper service base URL is empty");
    }

    const response = await fetch(
        buildProjectPaperLinkEndpoint(baseURL, projectID, paperID),
        {
            method: "POST",
            headers: {
                Accept: "application/json",
            },
        },
    );

    return parseJSONResponse<MessageResponse>(response);
}

export async function unlinkPaperFromProject(projectID: string, paperID: string) {
    const baseURL = getPaperServiceBaseURL();
    if (!baseURL) {
        throw new Error("paper service base URL is empty");
    }

    const response = await fetch(
        buildProjectPaperLinkEndpoint(baseURL, projectID, paperID),
        {
            method: "DELETE",
            headers: {
                Accept: "application/json",
            },
        },
    );

    return parseJSONResponse<MessageResponse>(response);
}

export function extractAssociatedProjects(detail: PaperDetailResponse): ProjectSummary[] {
    const unique = new Map<string, ProjectSummary>();
    const put = (projectID: string, name: string | null = null) => {
        const id = projectID.trim();
        if (!id) {
            return;
        }
        const prev = unique.get(id);
        if (!prev) {
            unique.set(id, { project_id: id, name });
            return;
        }
        if (!prev.name && name) {
            unique.set(id, { project_id: id, name });
        }
    };

    if (detail.project_id) {
        put(detail.project_id);
    }
    if (Array.isArray(detail.project_ids)) {
        detail.project_ids.forEach((id) => {
            if (typeof id === "string") {
                put(id);
            }
        });
    }
    if (Array.isArray(detail.projects)) {
        detail.projects.forEach((project) => {
            if (!project) {
                return;
            }
            if (typeof project.project_id === "string") {
                put(project.project_id, project.name || null);
            }
        });
    }

    return Array.from(unique.values());
}

export function buildPaperDetailStatusMessage(detail: PaperDetailResponse) {
    return [
        `extraction_fc=${detail.extraction_fact_check_status}`,
        `analysis_fc=${detail.analysis_fact_check_status}`,
    ].join("; ");
}

function getFirstPdfPath(item: Zotero.Item) {
    for (const attachmentID of item.getAttachments()) {
        const attachment = Zotero.Items.get(attachmentID);
        if (attachment?.attachmentContentType !== "application/pdf") {
            continue;
        }
        const filePath = attachment.getFilePath();
        if (filePath) {
            return filePath;
        }
    }
    return "";
}

function extractPayload(item: Zotero.Item) {
    const title = item.getField("title") || "";
    const creators = item.getCreators();
    const authors = creators
        .map((creator) => {
            const lastName = creator.lastName || "";
            const firstName = creator.firstName || "";
            return `${lastName} ${firstName}`.trim();
        })
        .filter(Boolean)
        .join(", ");

    let year = "";
    const dateStr = item.getField("date");
    if (dateStr) {
        const yearMatch = dateStr.match(/\d{4}/);
        if (yearMatch) {
            year = yearMatch[0];
        }
    }

    let publication = "";
    try {
        publication = item.getField("publicationTitle") || "";
    } catch (_e) {
        publication = "";
    }
    if (!publication) {
        try {
            publication = item.getField("proceedingsTitle") || "";
        } catch (_e) {
            publication = "";
        }
    }

    let doi = "";
    try {
        doi = item.getField("DOI") || "";
    } catch (_e) {
        doi = "";
    }

    return {
        title,
        authors,
        year,
        publication,
        doi,
        customMeta: JSON.stringify({ zotero_key: item.key }),
    };
}

function extractManualUpdatePayload(item: Zotero.Item) {
    const payload = extractPayload(item);
    const year = payload.year ? Number.parseInt(payload.year, 10) : null;
    return {
        title: payload.title || null,
        authors: payload.authors
            ? payload.authors
                .split(",")
                .map((author) => author.trim())
                .filter(Boolean)
            : [],
        year: Number.isFinite(year || NaN) ? year : null,
        publication: payload.publication || null,
        doi: payload.doi || null,
        custom_meta: payload.customMeta || null,
    };
}

async function submitPaper(
    endpoint: string,
    pdfPath: string,
    payload: {
        title: string;
        authors: string;
        year: string;
        publication: string;
        doi: string;
        customMeta: string;
    },
) {
    const pdfBytes = await IOUtils.read(pdfPath);
    const pdfName = getFileName(pdfPath);
    const boundary = createMultipartBoundary();
    const body = buildMultipartBody(boundary, pdfName, pdfBytes, payload);

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
            Accept: "application/json",
        },
        body,
    });

    return parseJSONResponse<UploadResponse>(response);
}

function createMultipartBoundary() {
    return `----paperplanex-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildMultipartBody(
    boundary: string,
    pdfName: string,
    pdfBytes: Uint8Array,
    payload: {
        title?: string;
        authors?: string;
        year?: string;
        publication?: string;
        doi?: string;
        customMeta?: string;
    },
) {
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];

    const appendTextField = (name: string, value: string) => {
        chunks.push(
            encoder.encode(
                `--${boundary}\r\n` +
                `Content-Disposition: form-data; name="${name}"\r\n\r\n` +
                `${value}\r\n`,
            ),
        );
    };

    chunks.push(
        encoder.encode(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="pdf_file"; filename="${escapeHeaderValue(pdfName)}"\r\n` +
            "Content-Type: application/pdf\r\n\r\n",
        ),
    );
    chunks.push(pdfBytes);
    chunks.push(encoder.encode("\r\n"));

    if (payload.title) appendTextField("title", payload.title);
    if (payload.authors) appendTextField("authors", payload.authors);
    if (payload.year) appendTextField("year", payload.year);
    if (payload.publication) appendTextField("publication", payload.publication);
    if (payload.doi) appendTextField("doi", payload.doi);
    if (payload.customMeta) appendTextField("custom_meta", payload.customMeta);

    chunks.push(encoder.encode(`--${boundary}--\r\n`));
    return concatUint8Arrays(chunks);
}

function concatUint8Arrays(chunks: Uint8Array[]) {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
    }
    return merged;
}

function escapeHeaderValue(value: string) {
    return value.replace(/"/g, "");
}

function getFileName(path: string) {
    return path.replace(/\\/g, "/").split("/").pop() || "paper.pdf";
}

async function parseJSONResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 409) {
            throw new Error(`409 Conflict: ${errorText || "status conflict"}`);
        }
        throw new Error(`HTTP ${response.status}: ${errorText || "request failed"}`);
    }
    return (await response.json()) as unknown as T;
}
