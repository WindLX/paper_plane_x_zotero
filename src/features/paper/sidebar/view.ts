import { el } from "../../../shared/ui/dom";
import { getString } from "../../../utils/locale";
import { renderActionBar, renderProjectAssociationPanel, renderSummaryPanel } from "./components/panels";
import {
  createAnalysisSection,
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
  mountEl.replaceChildren();
  mountEl.className = "ppx-sidebar-root";

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
  wrap.appendChild(renderProjectAssociationPanel(doc, vm));

  const sections = el(doc, "div", { className: "ppx-structured-sections" });
  vm.structuredSections.forEach((section) => {
    switch (section.kind) {
      case "quickScan":
        sections.appendChild(
          createQuickScanSection(
            doc,
            section.quickScan || null,
            vm,
          ),
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
        sections.appendChild(createFactCheckSection(doc, section.detail || null));
        break;
    }
  });
  wrap.appendChild(sections);
}
