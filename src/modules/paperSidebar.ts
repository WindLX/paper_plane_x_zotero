import { getLocaleID, getString } from "../utils/locale";
import katex from "katex";
import { marked } from "marked";
import {
    getPaperPlaneMetadata,
    upsertPaperMetadataToExtra,
    uploadSingleItem,
} from "./paperUpload";
import {
    CitedText,
    buildPaperDetailStatusMessage,
    extractAssociatedProjects,
    fetchPaperDetail,
    fetchProjectDetail,
    linkPaperToProject,
    manualUpdatePaperMetadata,
    PaperDetailResponse,
    ProjectSummary,
    QuickScan,
    reprocessPaper,
    unlinkPaperFromProject,
} from "./paperService";

const PANE_ID = "paper-plane-x";
const SYNC_THROTTLE_MS = 3000;
const lastSyncAtByItemID = new Map<number, number>();
const TAG_PREFIX = "ppx:";
const VERDICT_TAG_PREFIX = "ppx-verdict:";

export function registerPaperSidebarSection() {
    Zotero.ItemPaneManager.registerSection({
        paneID: PANE_ID,
        pluginID: addon.data.config.addonID,
        header: {
            l10nID: getLocaleID("item-section-paper-plane-head-text"),
            icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon@0.5x.png`,
        },
        sidenav: {
            l10nID: getLocaleID("item-section-paper-plane-sidenav-tooltip"),
            icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon@0.5x.png`,
        },
        onRender: ({ body, item, setSectionSummary }) => {
            renderSidebar(body, item);
            if (!item || !item.isRegularItem()) {
                setSectionSummary("");
                return;
            }
            const meta = getPaperPlaneMetadata(item);
            setSectionSummary(
                meta.status || getString("paper-panel-placeholder-not-uploaded"),
            );
        },
    });
}

function renderSidebar(body: HTMLDivElement, item?: Zotero.Item) {
    body.replaceChildren();
    body.style.userSelect = "text";
    body.style.setProperty("-moz-user-select", "text");

    const doc = body.ownerDocument || ztoolkit.getGlobal("document");
    const wrap = doc.createElement("div");
    wrap.style.display = "grid";
    wrap.style.gap = "8px";
    wrap.style.userSelect = "text";
    wrap.style.setProperty("-moz-user-select", "text");

    if (!item || !item.isRegularItem()) {
        const tip = doc.createElement("div");
        tip.textContent = getString("paper-panel-no-regular-item");
        tip.style.color = "var(--fill-secondary)";
        wrap.appendChild(tip);
        body.appendChild(wrap);
        return;
    }

    const paperIDLine = createCopyableValueLine(
        doc,
        getString("paper-panel-paper-id-label"),
        "",
    );
    const statusLine = createValueLine(
        doc,
        getString("paper-panel-status-label"),
        "",
    );
    const messageLine = createValueLine(
        doc,
        getString("paper-panel-message-label"),
        "",
    );
    const extractionStatusLine = createValueLine(
        doc,
        getString("paper-panel-extraction-status-label"),
        "",
    );
    const extractionFCLine = createValueLine(
        doc,
        getString("paper-panel-extraction-fc-status-label"),
        "",
    );
    const analysisFCLine = createValueLine(
        doc,
        getString("paper-panel-analysis-fc-status-label"),
        "",
    );
    const extractionRetryLine = createValueLine(
        doc,
        getString("paper-panel-extraction-retry-count-label"),
        "",
    );
    const analysisRetryLine = createValueLine(
        doc,
        getString("paper-panel-analysis-retry-count-label"),
        "",
    );
    const updatedAtLine = createValueLine(
        doc,
        getString("paper-panel-updated-at-label"),
        "",
    );

    const btnRow = doc.createElement("div");
    btnRow.style.display = "flex";
    btnRow.style.gap = "6px";
    btnRow.style.flexWrap = "wrap";

    const projectSection = doc.createElement("div");
    projectSection.style.display = "grid";
    projectSection.style.gap = "6px";
    projectSection.style.marginTop = "2px";

    const projectTitle = doc.createElement("div");
    projectTitle.textContent = getString("paper-panel-projects-label");
    projectTitle.style.fontWeight = "700";

    const projectList = doc.createElement("div");
    projectList.style.display = "grid";
    projectList.style.gap = "4px";

    const projectInputRow = doc.createElement("div");
    projectInputRow.style.display = "flex";
    projectInputRow.style.gap = "6px";
    projectInputRow.style.alignItems = "center";

    const projectInput = doc.createElement("input");
    projectInput.type = "text";
    projectInput.placeholder = getString("paper-panel-project-link-placeholder");
    projectInput.style.flex = "1";
    projectInput.style.minWidth = "160px";
    projectInput.style.padding = "4px 6px";

    const linkProjectBtn = createButton(
        doc,
        getString("paper-panel-action-link-project"),
    );
    projectInputRow.append(projectInput, linkProjectBtn);
    projectSection.append(projectTitle, projectList, projectInputRow);

    const syncBtn = createButton(doc, getString("paper-panel-action-sync"));
    const uploadBtn = createButton(doc, getString("paper-panel-action-upload"));
    const retryBtn = createButton(doc, getString("paper-panel-action-retry"));
    const updateBtn = createButton(
        doc,
        getString("paper-panel-action-update-meta"),
    );

    const structuredContainer = doc.createElement("div");
    structuredContainer.style.display = "grid";
    structuredContainer.style.gap = "10px";
    structuredContainer.style.marginTop = "4px";

    let syncedDetail: PaperDetailResponse | null = null;
    const projectNameByID = new Map<string, string | null>();

    const resolveProjectNames = async (detail: PaperDetailResponse | null) => {
        if (!detail) {
            return;
        }
        const projects = extractAssociatedProjects(detail);
        projects.forEach((project) => {
            if (project.name) {
                projectNameByID.set(project.project_id, project.name);
            }
        });

        const unresolved = projects
            .filter((project) => !projectNameByID.get(project.project_id))
            .map((project) => project.project_id);
        if (!unresolved.length) {
            return;
        }

        await Promise.all(
            unresolved.map(async (projectID) => {
                try {
                    const detail = await fetchProjectDetail(projectID);
                    projectNameByID.set(projectID, detail.name || null);
                } catch (_error) {
                    projectNameByID.set(projectID, null);
                }
            }),
        );
    };

    const renderProjectAssociations = () => {
        projectList.replaceChildren();

        const meta = getPaperPlaneMetadata(item);
        if (!meta.paperID) {
            const tip = doc.createElement("div");
            tip.textContent = getString("paper-panel-placeholder-not-uploaded");
            tip.style.color = "var(--fill-secondary)";
            projectList.appendChild(tip);
            return;
        }

        if (!syncedDetail) {
            const tip = doc.createElement("div");
            tip.textContent = getString("paper-panel-project-not-synced");
            tip.style.color = "var(--fill-secondary)";
            projectList.appendChild(tip);
            return;
        }

        const projects = extractAssociatedProjects(syncedDetail);
        if (!projects.length) {
            const tip = doc.createElement("div");
            tip.textContent = getString("paper-panel-project-empty");
            tip.style.color = "var(--fill-secondary)";
            projectList.appendChild(tip);
            return;
        }

        projects.forEach((project: ProjectSummary) => {
            const row = doc.createElement("div");
            row.style.display = "flex";
            row.style.alignItems = "center";
            row.style.gap = "6px";
            row.style.flexWrap = "wrap";

            const text = doc.createElement("span");
            const name = project.name || projectNameByID.get(project.project_id) || "";
            text.textContent = name
                ? `${project.project_id} (${name})`
                : project.project_id;
            text.style.cursor = "copy";
            text.style.textDecoration = "underline dotted";
            text.style.userSelect = "text";
            text.style.setProperty("-moz-user-select", "text");
            text.addEventListener("click", () => {
                Zotero.Utilities.Internal.copyTextToClipboard(project.project_id);
                showPlaceholderMessage(getString("paper-panel-copy-text-success"));
            });

            const unlinkBtn = createButton(
                doc,
                getString("paper-panel-action-unlink-project"),
            );
            unlinkBtn.style.padding = "2px 6px";
            unlinkBtn.addEventListener("click", async () => {
                const currentMeta = getPaperPlaneMetadata(item);
                if (!currentMeta.paperID) {
                    return;
                }
                await withButtonLoading(
                    unlinkBtn,
                    getString("paper-panel-action-unlinking-project"),
                    async () => {
                        await unlinkPaperFromProject(project.project_id, currentMeta.paperID!);
                        syncedDetail = await fetchPaperDetail(currentMeta.paperID!);
                        await resolveProjectNames(syncedDetail);
                        showPlaceholderMessage(
                            getString("paper-panel-project-unlink-success", {
                                args: { projectID: project.project_id },
                            }),
                            "success",
                        );
                    },
                );
            });

            row.append(text, unlinkBtn);
            projectList.appendChild(row);
        });
    };

    const refresh = () => {
        const meta = getPaperPlaneMetadata(item);
        paperIDLine.value.textContent =
            meta.paperID || getString("paper-panel-value-empty");
        paperIDLine.value.style.cursor = meta.paperID ? "copy" : "default";
        paperIDLine.value.style.textDecoration = meta.paperID
            ? "underline dotted"
            : "none";
        statusLine.value.textContent =
            meta.status || getString("paper-panel-placeholder-not-uploaded");
        messageLine.value.textContent =
            meta.message || getString("paper-panel-value-empty");

        const notSynced = getString("paper-panel-value-not-synced");
        extractionStatusLine.value.textContent =
            syncedDetail?.extraction_status || notSynced;
        extractionFCLine.value.textContent =
            syncedDetail?.extraction_fact_check_status || notSynced;
        analysisFCLine.value.textContent =
            syncedDetail?.analysis_fact_check_status || notSynced;
        extractionRetryLine.value.textContent =
            syncedDetail ? String(syncedDetail.extraction_retry_count) : notSynced;
        analysisRetryLine.value.textContent =
            syncedDetail ? String(syncedDetail.analysis_retry_count) : notSynced;
        updatedAtLine.value.textContent = syncedDetail?.updated_at || notSynced;

        renderProjectAssociations();
        renderStructuredData(structuredContainer, syncedDetail);
    };

    const withButtonLoading = async (
        button: HTMLButtonElement,
        loadingText: string,
        fn: () => Promise<void>,
    ) => {
        const origin = button.textContent || "";
        button.disabled = true;
        button.textContent = loadingText;
        try {
            await fn();
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            showPlaceholderMessage(
                getString("paper-panel-action-failed", { args: { reason } }),
                "error",
            );
            ztoolkit.log("Paper panel action failed", error);
        } finally {
            button.disabled = false;
            button.textContent = origin;
            refresh();
        }
    };

    const syncDetailFromService = async (silent = false) => {
        const now = Date.now();
        const itemID = item.id;
        const lastSyncAt = lastSyncAtByItemID.get(itemID) || 0;
        const elapsed = now - lastSyncAt;
        if (elapsed < SYNC_THROTTLE_MS) {
            if (!silent) {
                const waitSeconds = Math.ceil((SYNC_THROTTLE_MS - elapsed) / 1000);
                showPlaceholderMessage(
                    getString("paper-panel-sync-throttled", {
                        args: { seconds: waitSeconds },
                    }),
                    "warning",
                );
            }
            return;
        }
        lastSyncAtByItemID.set(itemID, now);

        await withButtonLoading(
            syncBtn,
            getString("paper-panel-action-syncing"),
            async () => {
                const meta = getPaperPlaneMetadata(item);
                if (!meta.paperID) {
                    throw new Error("paper_id is empty");
                }
                syncedDetail = await fetchPaperDetail(meta.paperID);
                await resolveProjectNames(syncedDetail);
                await upsertPaperMetadataToExtra(item, {
                    paperID: syncedDetail.paper_id,
                    status: syncedDetail.extraction_status,
                    message: buildPaperDetailStatusMessage(syncedDetail),
                });
                await syncQuickScanTagsToItem(item, syncedDetail.quick_scan || null);
                if (!silent) {
                    showPlaceholderMessage(getString("paper-panel-sync-success"), "success");
                }
            },
        );
    };

    syncBtn.addEventListener("click", async () => {
        await syncDetailFromService(false);
    });

    uploadBtn.addEventListener("click", async () => {
        await withButtonLoading(
            uploadBtn,
            getString("paper-panel-action-uploading"),
            async () => {
                await uploadSingleItem(item);
                syncedDetail = null;
            },
        );
    });


    retryBtn.addEventListener("click", async () => {
        await withButtonLoading(
            retryBtn,
            getString("paper-panel-action-reprocessing"),
            async () => {
                const meta = getPaperPlaneMetadata(item);
                if (!meta.paperID) {
                    throw new Error("paper_id is empty");
                }
                const submit = await reprocessPaper(item, meta.paperID);
                await upsertPaperMetadataToExtra(item, {
                    paperID: submit.paper_id || meta.paperID,
                    status: submit.status,
                    message: submit.message,
                });
                syncedDetail = null;
            },
        );
    });

    updateBtn.addEventListener("click", async () => {
        await withButtonLoading(
            updateBtn,
            getString("paper-panel-action-updating-meta"),
            async () => {
                const meta = getPaperPlaneMetadata(item);
                if (!meta.paperID) {
                    throw new Error("paper_id is empty");
                }
                syncedDetail = await manualUpdatePaperMetadata(item, meta.paperID);
                await resolveProjectNames(syncedDetail);
                await upsertPaperMetadataToExtra(item, {
                    paperID: syncedDetail.paper_id,
                    status: syncedDetail.extraction_status,
                    message: buildPaperDetailStatusMessage(syncedDetail),
                });
                await syncQuickScanTagsToItem(item, syncedDetail.quick_scan || null);
                showPlaceholderMessage(getString("paper-panel-sync-success"), "success");
            },
        );
    });

    linkProjectBtn.addEventListener("click", async () => {
        await withButtonLoading(
            linkProjectBtn,
            getString("paper-panel-action-linking-project"),
            async () => {
                const meta = getPaperPlaneMetadata(item);
                if (!meta.paperID) {
                    throw new Error("paper_id is empty");
                }
                const projectID = projectInput.value.trim();
                if (!projectID) {
                    throw new Error("project_id is empty");
                }
                await linkPaperToProject(projectID, meta.paperID);
                syncedDetail = await fetchPaperDetail(meta.paperID);
                await resolveProjectNames(syncedDetail);
                projectInput.value = "";
                showPlaceholderMessage(
                    getString("paper-panel-project-link-success", {
                        args: { projectID },
                    }),
                    "success",
                );
            },
        );
    });

    btnRow.append(syncBtn, uploadBtn, retryBtn, updateBtn);
    wrap.append(
        paperIDLine.line,
        statusLine.line,
        messageLine.line,
        extractionStatusLine.line,
        extractionFCLine.line,
        analysisFCLine.line,
        extractionRetryLine.line,
        analysisRetryLine.line,
        updatedAtLine.line,
        projectSection,
        btnRow,
        structuredContainer,
    );

    refresh();
    body.appendChild(wrap);

    // Auto-sync once when sidebar is activated and current render has no synced detail yet.
    const currentMeta = getPaperPlaneMetadata(item);
    if (!syncedDetail && currentMeta.paperID) {
        void syncDetailFromService(true);
    }
}

function createValueLine(doc: Document, label: string, value: string) {
    const line = doc.createElement("div");
    line.style.display = "grid";
    line.style.gridTemplateColumns = "84px 1fr";
    line.style.gap = "8px";
    line.style.alignItems = "start";

    const labelEl = doc.createElement("span");
    labelEl.textContent = label;
    labelEl.style.fontWeight = "600";

    const valueEl = doc.createElement("span");
    valueEl.textContent = value;
    valueEl.style.wordBreak = "break-word";
    valueEl.style.userSelect = "text";
    valueEl.style.setProperty("-moz-user-select", "text");

    line.append(labelEl, valueEl);
    return {
        line,
        value: valueEl,
    };
}

function createCopyableValueLine(doc: Document, label: string, value: string) {
    const line = doc.createElement("div");
    line.style.display = "grid";
    line.style.gridTemplateColumns = "84px 1fr";
    line.style.gap = "8px";
    line.style.alignItems = "start";

    const labelEl = doc.createElement("span");
    labelEl.textContent = label;
    labelEl.style.fontWeight = "600";

    const valueEl = doc.createElement("span");
    valueEl.textContent = value;
    valueEl.style.wordBreak = "break-word";
    valueEl.style.userSelect = "text";
    valueEl.style.setProperty("-moz-user-select", "text");

    const copyCurrentPaperID = () => {
        const raw = valueEl.textContent?.trim() || "";
        const emptyValue = getString("paper-panel-value-empty");
        if (!raw || raw === emptyValue) {
            return;
        }
        Zotero.Utilities.Internal.copyTextToClipboard(raw);
        showPlaceholderMessage(getString("paper-panel-copy-success"));
    };

    valueEl.addEventListener("click", copyCurrentPaperID);

    line.append(labelEl, valueEl);
    return {
        line,
        value: valueEl,
    };
}

function createButton(doc: Document, text: string) {
    const btn = doc.createElement("button");
    btn.textContent = text;
    btn.style.padding = "4px 8px";
    btn.style.borderRadius = "6px";
    return btn;
}

function renderStructuredData(container: HTMLDivElement, detail: PaperDetailResponse | null) {
    container.replaceChildren();
    const doc = container.ownerDocument || ztoolkit.getGlobal("document");

    if (!detail) {
        const empty = doc.createElement("div");
        empty.textContent = getString("paper-panel-value-not-synced");
        empty.style.color = "var(--fill-secondary)";
        container.appendChild(empty);
        return;
    }

    container.append(
        createQuickScanSection(doc, detail.quick_scan || null),
        createSynthesisSection(doc, detail),
        createAnalysisSection(doc, detail),
        createFactCheckSection(doc, detail),
    );
}

function createCollapsibleCard(doc: Document, title: string, open = false) {
    const details = doc.createElement("details");
    details.open = open;
    details.style.border = "1px solid var(--fill-quinary)";
    details.style.borderRadius = "10px";
    details.style.padding = "8px 10px";
    details.style.background = "var(--material-card-background, transparent)";

    const summary = doc.createElement("summary");
    summary.textContent = title;
    summary.style.cursor = "pointer";
    summary.style.fontWeight = "700";
    summary.style.outline = "none";
    summary.style.padding = "2px 0";

    const content = doc.createElement("div");
    content.style.display = "grid";
    content.style.gap = "8px";
    content.style.marginTop = "8px";

    details.append(summary, content);
    return {
        root: details,
        content,
    };
}

function createQuickScanSection(doc: Document, quickScan: QuickScan | null) {
    const section = createCollapsibleCard(
        doc,
        getString("paper-panel-quick-scan-label"),
        true,
    );
    if (!quickScan) {
        section.content.appendChild(
            createMutedLine(doc, getString("paper-panel-value-not-synced")),
        );
        return section.root;
    }

    section.content.append(
        createTagField(doc, getString("paper-panel-label-tags"), quickScan.tags || []),
        createInlineField(
            doc,
            getString("paper-panel-label-verdict"),
            quickScan.verdict || "-",
        ),
        createParagraphField(
            doc,
            getString("paper-panel-label-reason"),
            quickScan.reason || "-",
        ),
        createParagraphField(
            doc,
            getString("paper-panel-label-quick-summary"),
            quickScan.quick_summary || "-",
        ),
    );
    return section.root;
}

function createSynthesisSection(doc: Document, detail: PaperDetailResponse) {
    const section = createCollapsibleCard(
        doc,
        getString("paper-panel-synthesis-data-label"),
        false,
    );
    const synthesis = detail.synthesis_data;
    if (!synthesis) {
        section.content.appendChild(
            createMutedLine(doc, getString("paper-panel-value-not-synced")),
        );
        return section.root;
    }

    const gap = createCollapsibleCard(doc, getString("paper-panel-section-research-gap"), false);
    appendCitedField(gap.content, doc, getString("paper-panel-label-context"), synthesis.research_gap?.context);
    appendCitedField(gap.content, doc, getString("paper-panel-label-existing-limit"), synthesis.research_gap?.existing_limit);
    appendCitedField(gap.content, doc, getString("paper-panel-label-motivation"), synthesis.research_gap?.motivation);

    const method = createCollapsibleCard(doc, getString("paper-panel-section-methodology"), false);
    method.content.appendChild(
        createInlineField(
            doc,
            getString("paper-panel-label-approach-name"),
            synthesis.methodology?.approach_name || "-",
        ),
    );
    appendCitedField(method.content, doc, getString("paper-panel-label-core-logic"), synthesis.methodology?.core_logic);
    appendCitedField(method.content, doc, getString("paper-panel-label-innovation"), synthesis.methodology?.innovation);
    appendCitedField(method.content, doc, getString("paper-panel-label-disadvantage"), synthesis.methodology?.disadvantage);
    appendCitedField(
        method.content,
        doc,
        getString("paper-panel-label-future-direction"),
        synthesis.methodology?.future_direction,
    );

    const results = createCollapsibleCard(doc, getString("paper-panel-section-key-results"), false);
    appendCitedField(results.content, doc, getString("paper-panel-label-dataset-env"), synthesis.key_results?.dataset_env);
    appendCitedField(results.content, doc, getString("paper-panel-label-baseline"), synthesis.key_results?.baseline);
    appendCitedField(results.content, doc, getString("paper-panel-label-performance"), synthesis.key_results?.performance);

    const review = createCollapsibleCard(doc, getString("paper-panel-section-review-summary"), false);
    appendCitedField(review.content, doc, getString("paper-panel-label-summary"), synthesis.review_summary);

    section.content.append(gap.root, method.root, results.root, review.root);
    return section.root;
}

function createAnalysisSection(doc: Document, detail: PaperDetailResponse) {
    const section = createCollapsibleCard(
        doc,
        getString("paper-panel-analysis-report-label"),
        false,
    );
    const report = detail.analysis_report;
    if (!report) {
        section.content.appendChild(
            createMutedLine(doc, getString("paper-panel-value-not-synced")),
        );
        return section.root;
    }

    const prerequisites = createCollapsibleCard(doc, getString("paper-panel-section-prerequisites"), false);
    if (!report.prerequisites?.length) {
        prerequisites.content.appendChild(
            createInlineField(doc, getString("paper-panel-label-items"), "-"),
        );
    } else {
        report.prerequisites.forEach((item, idx) => {
            const conceptTitle = item.concept_name?.trim() || getString("paper-panel-label-untitled");
            const card = createCollapsibleCard(
                doc,
                `${getString("paper-panel-label-concept")} ${idx + 1}: ${conceptTitle}`,
                false,
            );
            card.content.append(
                createInlineField(doc, getString("paper-panel-label-name"), item.concept_name || "-"),
                createParagraphField(
                    doc,
                    getString("paper-panel-label-brief-explanation"),
                    item.brief_explanation || "-",
                ),
            );
            appendCitedField(card.content, doc, getString("paper-panel-label-relevance"), item.relevance_to_paper);
            prerequisites.content.appendChild(card.root);
        });
    }

    const coreFormulation = createCollapsibleCard(doc, getString("paper-panel-section-core-formulation"), false);
    appendCitedField(
        coreFormulation.content,
        doc,
        getString("paper-panel-label-problem-definition"),
        report.core_formulation?.problem_definition,
    );
    appendCitedField(
        coreFormulation.content,
        doc,
        getString("paper-panel-label-objective-function"),
        report.core_formulation?.objective_function,
    );
    appendCitedField(
        coreFormulation.content,
        doc,
        getString("paper-panel-label-algorithm-flow"),
        report.core_formulation?.algorithm_flow,
    );

    const derivation = createCollapsibleCard(doc, getString("paper-panel-section-derivation-steps"), false);
    if (!report.derivation_steps?.length) {
        derivation.content.appendChild(
            createInlineField(doc, getString("paper-panel-label-steps"), "-"),
        );
    } else {
        report.derivation_steps.forEach((step) => {
            const stepCard = createCollapsibleCard(
                doc,
                `${getString("paper-panel-label-step")} ${step.step_order || "?"}: ${step.step_name || getString("paper-panel-label-untitled")}`,
                false,
            );
            appendCitedField(stepCard.content, doc, getString("paper-panel-label-detail"), step.detail_explanation);
            derivation.content.appendChild(stepCard.root);
        });
    }

    section.content.append(prerequisites.root, coreFormulation.root, derivation.root);
    return section.root;
}

function createFactCheckSection(doc: Document, detail: PaperDetailResponse) {
    const section = createCollapsibleCard(doc, getString("paper-panel-section-fact-check"), false);
    section.content.append(
        createCodeField(
            doc,
            getString("paper-panel-extraction-fc-result-label"),
            formatJSON(detail.extraction_fact_check_result),
        ),
        createCodeField(
            doc,
            getString("paper-panel-analysis-fc-result-label"),
            formatJSON(detail.analysis_fact_check_result),
        ),
    );
    return section.root;
}

function createInlineField(doc: Document, label: string, value: string) {
    const line = doc.createElement("div");
    line.style.display = "grid";
    line.style.gap = "4px";

    const labelEl = doc.createElement("span");
    labelEl.textContent = label;
    labelEl.style.fontWeight = "600";
    labelEl.style.color = "var(--fill-secondary)";
    labelEl.style.fontSize = "12px";

    const valueEl = doc.createElement("span");
    renderMarkdownWithKatex(doc, valueEl, value);
    valueEl.style.wordBreak = "break-word";
    valueEl.style.lineHeight = "1.5";
    valueEl.style.userSelect = "text";
    valueEl.style.setProperty("-moz-user-select", "text");

    line.append(labelEl, valueEl);
    return line;
}

function createParagraphField(doc: Document, label: string, value: string) {
    const field = createInlineField(doc, label, value);
    const valueEl = field.lastElementChild as HTMLSpanElement;
    valueEl.style.lineHeight = "1.45";
    return field;
}

function createCodeField(doc: Document, label: string, value: string) {
    const line = doc.createElement("div");
    line.style.display = "grid";
    line.style.gap = "6px";

    const labelEl = doc.createElement("div");
    labelEl.textContent = label;
    labelEl.style.fontWeight = "600";

    const pre = doc.createElement("pre");
    pre.textContent = value;
    pre.style.margin = "0";
    pre.style.padding = "8px";
    pre.style.border = "1px solid var(--fill-quinary)";
    pre.style.borderRadius = "8px";
    pre.style.whiteSpace = "pre-wrap";
    pre.style.wordBreak = "break-word";
    pre.style.maxHeight = "200px";
    pre.style.overflow = "auto";
    pre.style.userSelect = "text";
    pre.style.setProperty("-moz-user-select", "text");

    line.append(labelEl, pre);
    return line;
}

function createTagField(doc: Document, label: string, tags: string[]) {
    const line = doc.createElement("div");
    line.style.display = "grid";
    line.style.gap = "4px";

    const labelEl = doc.createElement("span");
    labelEl.textContent = label;
    labelEl.style.fontWeight = "600";
    labelEl.style.color = "var(--fill-secondary)";
    labelEl.style.fontSize = "12px";

    const wrap = doc.createElement("div");
    wrap.style.display = "flex";
    wrap.style.gap = "6px";
    wrap.style.flexWrap = "wrap";

    const safeTags = tags.filter((tag) => !!tag?.trim());
    if (!safeTags.length) {
        const empty = doc.createElement("span");
        empty.textContent = "-";
        wrap.appendChild(empty);
    } else {
        safeTags.forEach((tag) => {
            const chip = doc.createElement("span");
            chip.textContent = tag;
            chip.style.padding = "2px 8px";
            chip.style.borderRadius = "999px";
            chip.style.fontSize = "12px";
            chip.style.border = "1px solid var(--fill-quinary)";
            chip.style.background = "var(--fill-quaternary)";
            wrap.appendChild(chip);
        });
    }

    line.append(labelEl, wrap);
    return line;
}

function appendCitedField(
    section: HTMLDivElement,
    doc: Document,
    label: string,
    cited?: CitedText,
) {
    if (!cited) {
        section.appendChild(createInlineField(doc, label, "-"));
        return;
    }

    const field = createCollapsibleCard(doc, label, false);
    field.content.appendChild(
        createParagraphField(doc, getString("paper-panel-label-summary"), cited.text || "-"),
    );

    if (!cited.citations?.length) {
        section.appendChild(field.root);
        return;
    }

    const citeDetails = createCollapsibleCard(
        doc,
        getString("paper-panel-label-citations", {
            args: { count: cited.citations.length },
        }),
        false,
    );
    cited.citations.forEach((citation, idx) => {
        const citeItem = doc.createElement("div");
        citeItem.style.display = "grid";
        citeItem.style.gap = "4px";
        citeItem.style.padding = "6px 8px";
        citeItem.style.border = "1px solid var(--fill-quinary)";
        citeItem.style.borderRadius = "8px";

        const head = doc.createElement("div");
        head.textContent = `#${idx + 1} ${citation.source_header || "unknown"}`;
        head.style.fontSize = "12px";
        head.style.color = "var(--fill-secondary)";

        const quote = doc.createElement("div");
        renderMarkdownWithKatex(doc, quote, citation.quote || "");
        quote.style.whiteSpace = "pre-wrap";
        quote.style.wordBreak = "break-word";
        quote.style.userSelect = "text";
        quote.style.setProperty("-moz-user-select", "text");
        quote.style.cursor = citation.quote?.trim() ? "copy" : "default";
        quote.style.textDecoration = citation.quote?.trim()
            ? "underline dotted"
            : "none";
        quote.addEventListener("click", () => {
            const raw = citation.quote?.trim() || "";
            if (!raw) {
                return;
            }
            Zotero.Utilities.Internal.copyTextToClipboard(raw);
            showPlaceholderMessage(getString("paper-panel-copy-text-success"));
        });

        citeItem.append(head, quote);
        citeDetails.content.appendChild(citeItem);
    });

    field.content.appendChild(citeDetails.root);
    section.appendChild(field.root);
}

function renderMarkdownWithKatex(doc: Document, container: HTMLElement, markdownText: string) {
    const source = (markdownText || "-").trim();
    try {
        const mathTokens: string[] = [];
        let processed = source
            .replace(/\$\$([\s\S]+?)\$\$/g, (_match, expr: string) => {
                const token = `@@PPX_MATH_${mathTokens.length}@@`;
                mathTokens.push(
                    katex.renderToString(expr.trim(), {
                        throwOnError: false,
                        displayMode: true,
                        output: "mathml",
                    }),
                );
                return token;
            })
            .replace(
                /(^|[^\\])\$(.+?)\$/g,
                (_match, prefix: string, expr: string) => {
                    const token = `@@PPX_MATH_${mathTokens.length}@@`;
                    mathTokens.push(
                        katex.renderToString(expr.trim(), {
                            throwOnError: false,
                            displayMode: false,
                            output: "mathml",
                        }),
                    );
                    return `${prefix}${token}`;
                },
            );

        const parsed = marked.parse(processed, {
            gfm: true,
            breaks: true,
            async: false,
        });
        let html = typeof parsed === "string" ? parsed : source;

        mathTokens.forEach((mathHTML, idx) => {
            html = html.replaceAll(`@@PPX_MATH_${idx}@@`, mathHTML);
        });

        container.innerHTML = html;
        container
            .querySelectorAll<HTMLParagraphElement>("p")
            .forEach((p: HTMLParagraphElement) => {
                p.style.margin = "0";
            });
    } catch (error) {
        ztoolkit.log("Paper panel markdown render failed", error);
        container.textContent = source;
    }
}

function createMutedLine(doc: Document, text: string) {
    const line = doc.createElement("div");
    line.textContent = text;
    line.style.color = "var(--fill-secondary)";
    return line;
}

function formatJSON(data: unknown) {
    if (!data) {
        return "-";
    }
    try {
        return JSON.stringify(data);
    } catch (_error) {
        return String(data);
    }
}

async function syncQuickScanTagsToItem(item: Zotero.Item, quickScan: QuickScan | null) {
    const existingTags = item.getTags().map((tag) => tag.tag);
    existingTags
        .filter((tag) => tag.startsWith(TAG_PREFIX) || tag.startsWith(VERDICT_TAG_PREFIX))
        .forEach((tag) => item.removeTag(tag));

    if (quickScan?.tags?.length) {
        quickScan.tags
            .filter((tag) => !!tag)
            .forEach((tag) => item.addTag(`${TAG_PREFIX}${tag.trim()}`));
    }
    if (quickScan?.verdict) {
        item.addTag(`${VERDICT_TAG_PREFIX}${quickScan.verdict}`);
    }

    await item.saveTx();
}

function showPlaceholderMessage(
    text: string,
    type: "default" | "warning" | "error" | "success" = "default",
) {
    new ztoolkit.ProgressWindow(addon.data.config.addonName)
        .createLine({
            text,
            type,
            progress: 100,
        })
        .show();
}
