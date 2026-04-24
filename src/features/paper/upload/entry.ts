import { getLocaleID } from "../../../utils/locale";
import { uploadSelectedItems } from "./useCase";

const ITEM_MENU_ID = "zotero-itemmenu-paper-plane-x-upload";

let statusMenuItemRegistered = false;

export function registerPaperUploadMenuItem() {
  if (statusMenuItemRegistered) {
    return;
  }

  const dataKey = Zotero.MenuManager.registerMenu({
    menuID: ITEM_MENU_ID,
    pluginID: addon.data.config.addonID,
    target: "main/library/item",
    menus: [
      {
        menuType: "menuitem",
        l10nID: getLocaleID("menuitem-upload-paper"),
        icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon@0.5x.svg`,
        onCommand: async () => {
          await uploadSelectedItems();
        },
      },
    ],
  });

  statusMenuItemRegistered = Boolean(dataKey);
}
