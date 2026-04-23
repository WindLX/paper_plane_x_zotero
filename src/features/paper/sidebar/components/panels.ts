import { Link, RefreshCw, RotateCw, Save, Unlink, Upload, Edit } from "lucide";
import { ProjectSummary } from "../../../../domain/paper";
import { el } from "../../../../shared/ui/dom";
import { getString } from "../../../../utils/locale";
import { PaperSidebarViewModel } from "../types";
import {
  createButton,
  createCollapsibleCard,
  renderCopyableLine,
  renderEditableStatusField,
  renderValueLine,
} from "./common";

const EXTRACTION_STATUS_OPTIONS = [
  { value: "PENDING", label: "PENDING", disabled: true },
  { value: "PROCESSING", label: "PROCESSING", disabled: true },
  { value: "COMPLETED", label: "COMPLETED", disabled: true },
  { value: "HUMAN_COMPLETED", label: "HUMAN_COMPLETED" },
  { value: "FAILED", label: "FAILED" },
];

const FACT_CHECK_STATUS_OPTIONS = [
  { value: "PENDING", label: "PENDING", disabled: true },
  { value: "PASSED", label: "PASSED", disabled: true },
  { value: "HUMAN_PASSED", label: "HUMAN_PASSED" },
  { value: "FAILED", label: "FAILED" },
];

export function renderSummaryPanel(doc: Document, vm: PaperSidebarViewModel) {
  const panel = createCollapsibleCard(
    doc,
    getString("paper-panel-summary-title"),
    true,
  );
  panel.root.classList.add(
    "ppx-panel",
    "ppx-panel-section",
    "ppx-summary-panel",
  );
  panel.content.append(
    renderCopyableLine(
      doc,
      getString("paper-panel-paper-id-label"),
      vm.data.localMeta.paperID || getString("paper-panel-value-empty"),
      vm.data.localMeta.paperID
        ? () =>
            vm.actions.copy(
              vm.data.localMeta.paperID,
              getString("paper-panel-copy-success"),
            )
        : undefined,
    ),
    renderValueLine(
      doc,
      getString("paper-panel-status-label"),
      vm.ui.statusSummary,
    ),
    renderValueLine(
      doc,
      getString("paper-panel-message-label"),
      vm.data.localMeta.message || getString("paper-panel-value-empty"),
    ),
    renderEditableStatusField(
      doc,
      getString("paper-panel-extraction-status-label"),
      vm.draft.extraction_status,
      vm.data.remoteDetail?.extraction_status || "",
      EXTRACTION_STATUS_OPTIONS,
      !vm.data.remoteDetail,
      (value) => vm.actions.updateDraft("extraction_status", value),
    ),
    renderEditableStatusField(
      doc,
      getString("paper-panel-extraction-fc-status-label"),
      vm.draft.extraction_fact_check_status,
      vm.data.remoteDetail?.extraction_fact_check_status || "",
      FACT_CHECK_STATUS_OPTIONS,
      !vm.data.remoteDetail,
      (value) => vm.actions.updateDraft("extraction_fact_check_status", value),
    ),
    renderEditableStatusField(
      doc,
      getString("paper-panel-analysis-fc-status-label"),
      vm.draft.analysis_fact_check_status,
      vm.data.remoteDetail?.analysis_fact_check_status || "",
      FACT_CHECK_STATUS_OPTIONS,
      !vm.data.remoteDetail,
      (value) => vm.actions.updateDraft("analysis_fact_check_status", value),
    ),
    renderValueLine(
      doc,
      getString("paper-panel-extraction-retry-count-label"),
      vm.data.remoteDetail
        ? String(vm.data.remoteDetail.extraction_retry_count)
        : getString("paper-panel-value-not-synced"),
    ),
    renderValueLine(
      doc,
      getString("paper-panel-analysis-retry-count-label"),
      vm.data.remoteDetail
        ? String(vm.data.remoteDetail.analysis_retry_count)
        : getString("paper-panel-value-not-synced"),
    ),
    renderValueLine(
      doc,
      getString("paper-panel-updated-at-label"),
      vm.data.remoteDetail?.updated_at ||
        getString("paper-panel-value-not-synced"),
    ),
  );
  return panel.root;
}

export function renderProjectAssociationPanel(
  doc: Document,
  vm: PaperSidebarViewModel,
) {
  const panel = createCollapsibleCard(
    doc,
    getString("paper-panel-projects-label"),
    true,
  );
  panel.root.classList.add("ppx-panel", "ppx-panel-section");
  const list = el(doc, "div", { className: "ppx-project-list" });

  if (!vm.data.localMeta.paperID) {
    list.appendChild(
      el(doc, "div", {
        className: "ppx-muted",
        text: getString("paper-panel-placeholder-not-uploaded"),
      }),
    );
  } else if (!vm.data.remoteDetail) {
    list.appendChild(
      el(doc, "div", {
        className: "ppx-muted",
        text: getString("paper-panel-project-not-synced"),
      }),
    );
  } else if (!vm.data.projects.length) {
    list.appendChild(
      el(doc, "div", {
        className: "ppx-muted",
        text: getString("paper-panel-project-empty"),
      }),
    );
  } else {
    vm.data.projects.forEach((project) =>
      list.appendChild(renderProjectRow(doc, vm, project)),
    );
  }

  const inputRow = el(doc, "div", { className: "ppx-project-input-row" });
  const input = el(doc, "input", {
    className: "ppx-input",
    attrs: {
      type: "text",
      value: vm.draft.projectIDInput,
      placeholder: getString("paper-panel-project-link-placeholder"),
    },
  }) as HTMLInputElement;
  input.addEventListener("input", () =>
    vm.actions.updateDraft("projectIDInput", input.value),
  );
  inputRow.append(
    input,
    createButton(
      doc,
      getString("paper-panel-action-link-project"),
      Link,
      vm.ui.actions.link.status === "loading",
      async () => vm.actions.linkProject(),
      getString("paper-panel-action-linking-project"),
    ),
  );

  panel.content.append(list, inputRow);
  return panel.root;
}

export function renderActionBar(doc: Document, vm: PaperSidebarViewModel) {
  const row = el(doc, "div", { className: "ppx-action-bar" });
  row.append(
    createButton(
      doc,
      getString("paper-panel-action-sync"),
      RefreshCw,
      vm.ui.actions.sync.status === "loading",
      async () => vm.actions.sync(),
      getString("paper-panel-action-syncing"),
    ),
    createButton(
      doc,
      getString("paper-panel-action-upload"),
      Upload,
      vm.ui.actions.upload.status === "loading",
      async () => vm.actions.upload(),
      getString("paper-panel-action-uploading"),
    ),
    createButton(
      doc,
      getString("paper-panel-action-retry"),
      RotateCw,
      vm.ui.actions.retry.status === "loading",
      async () => vm.actions.retry(),
      getString("paper-panel-action-reprocessing"),
    ),
    createButton(
      doc,
      getString("paper-panel-action-update-meta"),
      Save,
      vm.ui.actions.update.status === "loading",
      async () => vm.actions.updateMetadata(),
      getString("paper-panel-action-updating-meta"),
    ),
  );
  const panel = el(doc, "div", {
    className: "ppx-panel ppx-action-panel",
  });
  panel.appendChild(row);
  return panel;
}

function renderProjectRow(
  doc: Document,
  vm: PaperSidebarViewModel,
  project: ProjectSummary,
) {
  const row = el(doc, "div", { className: "ppx-project-row" });
  const name = vm.data.projectNames[project.project_id] || project.name || "";
  const projectText = name
    ? `${project.project_id} (${name})`
    : project.project_id;
  const label = el(doc, "button", {
    className: "ppx-copy-button ppx-project-value",
    text: projectText,
  }) as HTMLButtonElement;
  label.type = "button";
  label.addEventListener("click", () =>
    vm.actions.copy(
      project.project_id,
      getString("paper-panel-copy-text-success"),
    ),
  );

  row.append(
    label,
    createButton(
      doc,
      getString("paper-panel-action-unlink-project"),
      Unlink,
      vm.ui.actions[`unlink:${project.project_id}`]?.status === "loading",
      async () => vm.actions.unlinkProject(project.project_id),
      getString("paper-panel-action-unlinking-project"),
      "is-secondary",
    ),
  );
  return row;
}
