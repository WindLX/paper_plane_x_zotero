import { getLocaleID } from "../../../utils/locale";
import { mountPaperSidebar } from "./controller";

const PANE_ID = "paper-plane-x";

let sidebarSectionRegistered = false;

export function registerPaperSidebarSection() {
  if (sidebarSectionRegistered) {
    return;
  }

  Zotero.ItemPaneManager.registerSection({
    paneID: PANE_ID,
    pluginID: addon.data.config.addonID,
    header: {
      l10nID: getLocaleID("item-section-paper-plane-head-text"),
      icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon@0.5x.svg`,
    },
    sidenav: {
      l10nID: getLocaleID("item-section-paper-plane-sidenav-tooltip"),
      icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon@0.5x.svg`,
    },
    onRender: ({ body, item, setSectionSummary }) => {
      mountPaperSidebar(body, item, setSectionSummary);
    },
  });

  sidebarSectionRegistered = true;
}
