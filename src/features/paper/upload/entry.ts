import { getLocaleID } from "@/utils/locale";
import { getSelectedRegularItems } from "../batch/selection";
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
        onCommand: async (_event, context) => {
          const win = context.menuElem.ownerGlobal;
          if (!win) {
            return;
          }
          await uploadSelectedItems(
            getSelectedRegularItems(context.items),
            win,
          );
        },
      },
    ],
  });

  statusMenuItemRegistered = Boolean(dataKey);
}
