import { getLocaleID } from "@/utils/locale";
import { fetchSelectedPaperDetails } from "./useCase";

const ITEM_MENU_ID = "zotero-itemmenu-paper-plane-x-fetch";

let fetchMenuItemRegistered = false;

export function registerPaperFetchMenuItem() {
  if (fetchMenuItemRegistered) {
    return;
  }

  const dataKey = Zotero.MenuManager.registerMenu({
    menuID: ITEM_MENU_ID,
    pluginID: addon.data.config.addonID,
    target: "main/library/item",
    menus: [
      {
        menuType: "menuitem",
        l10nID: getLocaleID("menuitem-fetch-paper"),
        icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon@0.5x.svg`,
        onCommand: async () => {
          await fetchSelectedPaperDetails();
        },
      },
    ],
  });

  fetchMenuItemRegistered = Boolean(dataKey);
}
