import { getPref } from "../../utils/prefs";
import {
  buildPaperDetailStatusMessage,
  extractManualUpdatePayload,
  extractUploadPayload,
  getFirstPdfPath,
} from "./mappers";
import {
  AnalysisReport,
  MessageResponse,
  PaperDetailResponse,
  PaperStatusOverrides,
  ProjectResponse,
  QuickScan,
  SynthesisData,
  UploadResponse,
} from "./types";

export interface UploadFromItemResult {
  result: "success" | "skipped";
  response?: UploadResponse;
}

export interface PaperApiClient {
  getBaseURL(): string;
  uploadFromItem(item: Zotero.Item): Promise<UploadFromItemResult>;
  fetchDetail(paperID: string): Promise<PaperDetailResponse>;
  manualUpdate(
    item: Zotero.Item,
    paperID: string,
    statusOverrides?: PaperStatusOverrides,
    quickScan?: QuickScan | null,
    synthesisData?: SynthesisData | null,
    analysisReport?: AnalysisReport | null,
    options?: {
      syncQuickScanTagsFromItem?: boolean;
    },
  ): Promise<PaperDetailResponse>;
  reprocess(item: Zotero.Item, paperID: string): Promise<UploadResponse>;
  fetchProjectDetail(projectID: string): Promise<ProjectResponse>;
  linkProject(projectID: string, paperID: string): Promise<MessageResponse>;
  unlinkProject(projectID: string, paperID: string): Promise<MessageResponse>;
}

export function createPaperApiClient(): PaperApiClient {
  return {
    getBaseURL() {
      return getPaperServiceBaseURL();
    },
    async uploadFromItem(item) {
      const baseURL = getPaperServiceBaseURL();
      if (!baseURL) {
        throw new Error("paper service base URL is empty");
      }

      const pdfPath = getFirstPdfPath(item);
      if (!pdfPath) {
        return {
          result: "skipped",
        };
      }

      const payload = extractUploadPayload(item);
      const response = await submitPaper(
        buildPaperCollectionEndpoint(baseURL),
        pdfPath,
        payload,
      );
      return {
        result: "success",
        response,
      };
    },
    async fetchDetail(paperID) {
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
    },
    async manualUpdate(
      item,
      paperID,
      statusOverrides,
      quickScan,
      synthesisData,
      analysisReport,
      options,
    ) {
      const baseURL = getPaperServiceBaseURL();
      if (!baseURL) {
        throw new Error("paper service base URL is empty");
      }

      const endpoint = buildPaperDetailEndpoint(baseURL, paperID);
      const payload: Record<string, unknown> = extractManualUpdatePayload(
        item,
        quickScan,
        synthesisData,
        analysisReport,
        options,
      );
      if (statusOverrides?.extraction_status) {
        payload.extraction_status = statusOverrides.extraction_status;
      }
      if (statusOverrides?.extraction_fact_check_status) {
        payload.extraction_fact_check_status =
          statusOverrides.extraction_fact_check_status;
      }
      if (statusOverrides?.analysis_fact_check_status) {
        payload.analysis_fact_check_status =
          statusOverrides.analysis_fact_check_status;
      }

      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      return parseJSONResponse<PaperDetailResponse>(response);
    },
    async reprocess(item, paperID) {
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
    },
    async fetchProjectDetail(projectID) {
      const baseURL = getPaperServiceBaseURL();
      if (!baseURL) {
        throw new Error("paper service base URL is empty");
      }

      const response = await fetch(
        buildProjectDetailEndpoint(baseURL, projectID),
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        },
      );

      return parseJSONResponse<ProjectResponse>(response);
    },
    async linkProject(projectID, paperID) {
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
    },
    async unlinkProject(projectID, paperID) {
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
    },
  };
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

export function buildMetadataPatchSummary(detail: PaperDetailResponse) {
  return buildPaperDetailStatusMessage(detail);
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
    throw new Error(
      `HTTP ${response.status}: ${errorText || "request failed"}`,
    );
  }
  return (await response.json()) as unknown as T;
}
