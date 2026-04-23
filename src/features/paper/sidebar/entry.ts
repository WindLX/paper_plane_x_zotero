import { getLocaleID } from "../../../utils/locale";
import { mountPaperSidebar } from "./controller";

const PANE_ID = "paper-plane-x";

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
      mountPaperSidebar(body, item, setSectionSummary);
    },
  });
}
