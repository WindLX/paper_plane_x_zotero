import { getLocaleID } from "../../../utils/locale";
import { uploadSelectedItems } from "./useCase";

const ITEM_MENU_SEPARATOR_ID = "zotero-itemmenu-paper-plane-x-separator";
const ITEM_MENU_ID = "zotero-itemmenu-paper-plane-x-upload";

export function registerPaperUploadMenuItem() {
  Zotero.MenuManager.registerMenu({
    menuID: ITEM_MENU_SEPARATOR_ID,
    pluginID: addon.data.config.addonID,
    target: "main/library/item",
    menus: [
      {
        menuType: "separator",
      },
    ],
  });
  Zotero.MenuManager.registerMenu({
    menuID: ITEM_MENU_ID,
    pluginID: addon.data.config.addonID,
    target: "main/library/item",
    menus: [
      {
        menuType: "menuitem",
        l10nID: getLocaleID("menuitem-upload-paper"),
        icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon@0.5x.png`,
        onCommand: async () => {
          await uploadSelectedItems();
        },
      },
    ],
  });
}
