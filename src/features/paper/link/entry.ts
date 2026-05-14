import { getLocaleID } from "@/utils/locale";
import { linkSelectedItemsToProject } from "./useCase";

const ITEM_MENU_ID = "zotero-itemmenu-paper-plane-x-link";

let linkMenuItemRegistered = false;

export function registerPaperLinkMenuItem() {
  if (linkMenuItemRegistered) {
    return;
  }

  const dataKey = Zotero.MenuManager.registerMenu({
    menuID: ITEM_MENU_ID,
    pluginID: addon.data.config.addonID,
    target: "main/library/item",
    menus: [
      {
        menuType: "menuitem",
        l10nID: getLocaleID("menuitem-link-paper"),
        icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon@0.5x.svg`,
        onCommand: async () => {
          await linkSelectedItemsToProject();
        },
      },
    ],
  });

  linkMenuItemRegistered = Boolean(dataKey);
}
