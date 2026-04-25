import { FilePenLine } from "lucide";
import { PaperDetailResponse, QuickScan } from "../../../../domain/paper";
import { createLucideIcon } from "../../../../shared/ui/icon/lucide";
import { el } from "../../../../shared/ui/dom";
import { getString } from "../../../../utils/locale";
import { PaperSidebarViewModel } from "../types";
import {
  appendCitedField,
  createCodeField,
  createCollapsibleCard,
  createInlineField,
  createParagraphField,
  createTagField,
  formatJSON,
} from "./common";

export function createQuickScanSection(
  doc: Document,
  quickScan: QuickScan | null,
  vm: PaperSidebarViewModel,
) {
  const section = createCollapsibleCard(
    doc,
    getString("paper-panel-quick-scan-label"),
    true,
  );
  section.root.classList.add("ppx-panel", "ppx-panel-section");
  attachJSONEditAction(doc, section.root, !vm.data.remoteDetail, async () => {
    await vm.actions.openQuickScanEditor();
  });

  if (!quickScan) {
    section.content.appendChild(
      el(doc, "div", {
        className: "ppx-muted",
        text: getString("paper-panel-value-not-synced"),
      }),
    );
    return section.root;
  }

  section.content.append(
    createTagField(
      doc,
      getString("paper-panel-label-tags"),
      quickScan.tags || [],
    ),
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

export function createSynthesisSection(
  doc: Document,
  detail: PaperDetailResponse | null,
  vm: PaperSidebarViewModel,
) {
  const section = createCollapsibleCard(
    doc,
    getString("paper-panel-synthesis-data-label"),
    false,
  );
  section.root.classList.add("ppx-panel", "ppx-panel-section");
  attachJSONEditAction(doc, section.root, !vm.data.remoteDetail, async () => {
    await vm.actions.openSynthesisEditor();
  });
  const synthesis = detail?.synthesis_data;
  if (!synthesis) {
    section.content.appendChild(
      el(doc, "div", {
        className: "ppx-muted",
        text: getString("paper-panel-value-not-synced"),
      }),
    );
    return section.root;
  }

  const gap = createCollapsibleCard(
    doc,
    getString("paper-panel-section-research-gap"),
    false,
  );
  appendCitedField(
    gap.content,
    doc,
    getString("paper-panel-label-context"),
    synthesis.research_gap?.context,
  );
  appendCitedField(
    gap.content,
    doc,
    getString("paper-panel-label-existing-limit"),
    synthesis.research_gap?.existing_limit,
  );
  appendCitedField(
    gap.content,
    doc,
    getString("paper-panel-label-motivation"),
    synthesis.research_gap?.motivation,
  );

  const method = createCollapsibleCard(
    doc,
    getString("paper-panel-section-methodology"),
    false,
  );
  method.content.appendChild(
    createInlineField(
      doc,
      getString("paper-panel-label-approach-name"),
      synthesis.methodology?.approach_name || "-",
    ),
  );
  appendCitedField(
    method.content,
    doc,
    getString("paper-panel-label-core-logic"),
    synthesis.methodology?.core_logic,
  );
  appendCitedField(
    method.content,
    doc,
    getString("paper-panel-label-innovation"),
    synthesis.methodology?.innovation,
  );
  appendCitedField(
    method.content,
    doc,
    getString("paper-panel-label-disadvantage"),
    synthesis.methodology?.disadvantage,
  );
  appendCitedField(
    method.content,
    doc,
    getString("paper-panel-label-future-direction"),
    synthesis.methodology?.future_direction,
  );

  const results = createCollapsibleCard(
    doc,
    getString("paper-panel-section-key-results"),
    false,
  );
  appendCitedField(
    results.content,
    doc,
    getString("paper-panel-label-dataset-env"),
    synthesis.key_results?.dataset_env,
  );
  appendCitedField(
    results.content,
    doc,
    getString("paper-panel-label-baseline"),
    synthesis.key_results?.baseline,
  );
  appendCitedField(
    results.content,
    doc,
    getString("paper-panel-label-performance"),
    synthesis.key_results?.performance,
  );

  const review = createCollapsibleCard(
    doc,
    getString("paper-panel-section-review-summary"),
    false,
  );
  appendCitedField(
    review.content,
    doc,
    getString("paper-panel-label-summary"),
    synthesis.review_summary,
  );

  section.content.append(gap.root, method.root, results.root, review.root);
  return section.root;
}

export function createAnalysisSection(
  doc: Document,
  detail: PaperDetailResponse | null,
  vm: PaperSidebarViewModel,
) {
  const section = createCollapsibleCard(
    doc,
    getString("paper-panel-analysis-report-label"),
    false,
  );
  section.root.classList.add("ppx-panel", "ppx-panel-section");
  attachJSONEditAction(doc, section.root, !vm.data.remoteDetail, async () => {
    await vm.actions.openAnalysisEditor();
  });
  const report = detail?.analysis_report;
  if (!report) {
    section.content.appendChild(
      el(doc, "div", {
        className: "ppx-muted",
        text: getString("paper-panel-value-not-synced"),
      }),
    );
    return section.root;
  }

  const prerequisites = createCollapsibleCard(
    doc,
    getString("paper-panel-section-prerequisites"),
    false,
  );
  if (!report.prerequisites?.length) {
    prerequisites.content.appendChild(
      createInlineField(doc, getString("paper-panel-label-items"), "-"),
    );
  } else {
    report.prerequisites.forEach((item, idx) => {
      const conceptTitle =
        item.concept_name?.trim() || getString("paper-panel-label-untitled");
      const card = createCollapsibleCard(
        doc,
        `${getString("paper-panel-label-concept")} ${idx + 1}: ${conceptTitle}`,
        false,
      );
      card.content.append(
        createInlineField(
          doc,
          getString("paper-panel-label-name"),
          item.concept_name || "-",
        ),
        createParagraphField(
          doc,
          getString("paper-panel-label-brief-explanation"),
          item.brief_explanation || "-",
        ),
      );
      appendCitedField(
        card.content,
        doc,
        getString("paper-panel-label-relevance"),
        item.relevance_to_paper,
      );
      prerequisites.content.appendChild(card.root);
    });
  }

  const coreFormulation = createCollapsibleCard(
    doc,
    getString("paper-panel-section-core-formulation"),
    false,
  );
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

  const derivation = createCollapsibleCard(
    doc,
    getString("paper-panel-section-derivation-steps"),
    false,
  );
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
      appendCitedField(
        stepCard.content,
        doc,
        getString("paper-panel-label-detail"),
        step.detail_explanation,
      );
      derivation.content.appendChild(stepCard.root);
    });
  }

  const relatedReferences = createCollapsibleCard(
    doc,
    getString("paper-panel-section-related-references"),
    false,
  );
  if (!report.related_references?.length) {
    relatedReferences.content.appendChild(
      createInlineField(doc, getString("paper-panel-label-items"), "-"),
    );
  } else {
    report.related_references.forEach((reference, idx) => {
      const title =
        reference.title?.trim() || getString("paper-panel-label-untitled");
      const card = createCollapsibleCard(
        doc,
        `${getString("paper-panel-label-reference")} ${idx + 1}: ${title}`,
        false,
      );
      card.content.append(
        createInlineField(
          doc,
          getString("paper-panel-label-title"),
          reference.title || "-",
        ),
        createParagraphField(
          doc,
          getString("paper-panel-label-reason"),
          reference.reason || "-",
        ),
      );
      relatedReferences.content.appendChild(card.root);
    });
  }

  section.content.append(
    prerequisites.root,
    coreFormulation.root,
    derivation.root,
    relatedReferences.root,
  );
  return section.root;
}

export function createFactCheckSection(
  doc: Document,
  detail: PaperDetailResponse | null,
) {
  const section = createCollapsibleCard(
    doc,
    getString("paper-panel-section-fact-check"),
    false,
  );
  section.root.classList.add("ppx-panel", "ppx-panel-section");
  section.content.append(
    createCodeField(
      doc,
      getString("paper-panel-extraction-fc-result-label"),
      formatJSON(detail?.extraction_fact_check_result),
    ),
    createCodeField(
      doc,
      getString("paper-panel-analysis-fc-result-label"),
      formatJSON(detail?.analysis_fact_check_result),
    ),
  );
  return section.root;
}

function attachJSONEditAction(
  doc: Document,
  root: HTMLElement,
  disabled: boolean,
  onClick: () => Promise<void>,
) {
  const buttonRow = el(doc, "div", { className: "ppx-section-actions" });
  const editButton = el(doc, "button", {
    className: "ppx-button is-secondary",
  }) as HTMLButtonElement;
  editButton.type = "button";
  editButton.disabled = disabled;
  editButton.append(
    createLucideIcon(doc, FilePenLine, {
      width: 14,
      height: 14,
    }),
    el(doc, "span", {
      text: getString("paper-panel-action-edit-json"),
    }),
  );
  editButton.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await onClick();
  });
  buttonRow.appendChild(editButton);
  root.querySelector(".ppx-card-summary")?.appendChild(buttonRow);
}
