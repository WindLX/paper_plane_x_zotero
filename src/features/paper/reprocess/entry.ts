import { getLocaleID } from "@/utils/locale";
import { getSelectedRegularItems } from "../batch/selection";
import { reprocessSelectedItems } from "./useCase";

const ITEM_MENU_ID = "zotero-itemmenu-paper-plane-x-reprocess";

let registeredMenuID: string | undefined;

export function registerPaperReprocessMenuItem() {
  if (registeredMenuID) {
    return;
  }

  const dataKey = Zotero.MenuManager.registerMenu({
    menuID: ITEM_MENU_ID,
    pluginID: addon.data.config.addonID,
    target: "main/library/item",
    menus: [
      {
        menuType: "menuitem",
        l10nID: getLocaleID("menuitem-reprocess-paper"),
        icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon@0.5x.svg`,
        onCommand: async (_event, context) => {
          const win = context.menuElem.ownerGlobal;
          if (!win) {
            return;
          }
          await reprocessSelectedItems(
            getSelectedRegularItems(context.items),
            win,
          );
        },
      },
    ],
  });

  registeredMenuID = dataKey || undefined;
}

export function unregisterPaperReprocessMenuItem() {
  if (!registeredMenuID) {
    return;
  }
  Zotero.MenuManager.unregisterMenu(registeredMenuID);
  registeredMenuID = undefined;
}
