import { el } from "@/shared/ui/dom";
import { getString } from "@/utils/locale";
import {
  renderActionBar,
  renderProjectAssociationPanel,
  renderSummaryPanel,
} from "./components/panels";
import {
  createAnalysisSection,
  createAgentNoteSection,
  createFactCheckSection,
  createQuickScanSection,
  createSynthesisSection,
} from "./components/sections";
import { PaperSidebarViewModel } from "./types";

export function renderPaperSidebar(
  mountEl: HTMLDivElement,
  vm: PaperSidebarViewModel,
) {
  const doc = mountEl.ownerDocument || ztoolkit.getGlobal("document");
  const manualOpen =
    mountEl.querySelector<HTMLDetailsElement>(".ppx-project-manual")?.open ||
    false;
  const oldInput = mountEl.querySelector<HTMLInputElement>(
    ".ppx-project-manual input",
  );
  const restoreInputFocus = oldInput !== null && doc.activeElement === oldInput;
  const selectionStart = oldInput?.selectionStart ?? 0;
  const selectionEnd = oldInput?.selectionEnd ?? 0;
  mountEl.replaceChildren();
  mountEl.className = "ppx-sidebar-root ppx-ui-root";

  const wrap = el(doc, "div", { className: "ppx-sidebar" });
  mountEl.appendChild(wrap);

  if (!vm.data.isRegularItem) {
    wrap.appendChild(
      el(doc, "div", {
        className: "ppx-muted",
        text: getString("paper-panel-no-regular-item"),
      }),
    );
    return;
  }

  wrap.appendChild(renderActionBar(doc, vm));
  wrap.appendChild(renderSummaryPanel(doc, vm));
  const projectPanel = renderProjectAssociationPanel(doc, vm);
  projectPanel.querySelector<HTMLDetailsElement>(".ppx-project-manual")!.open =
    manualOpen;
  wrap.appendChild(projectPanel);

  const sections = el(doc, "div", { className: "ppx-structured-sections" });
  vm.structuredSections.forEach((section) => {
    switch (section.kind) {
      case "agentNote":
        sections.appendChild(
          createAgentNoteSection(doc, section.detail || null, vm),
        );
        break;
      case "quickScan":
        sections.appendChild(
          createQuickScanSection(doc, section.quickScan || null, vm),
        );
        break;
      case "synthesis":
        sections.appendChild(
          createSynthesisSection(doc, section.detail || null, vm),
        );
        break;
      case "analysis":
        sections.appendChild(
          createAnalysisSection(doc, section.detail || null, vm),
        );
        break;
      case "factCheck":
        sections.appendChild(
          createFactCheckSection(doc, section.detail || null),
        );
        break;
    }
  });
  wrap.appendChild(sections);
  if (restoreInputFocus) {
    const input = projectPanel.querySelector<HTMLInputElement>("input")!;
    input.focus({ preventScroll: true });
    input.setSelectionRange(selectionStart, selectionEnd);
  }
}
