import { getString } from "../../../utils/locale";
import { uploadSelectedItems } from "./useCase";

const ITEM_MENU_SEPARATOR_ID = "zotero-itemmenu-paper-planex-separator";
const ITEM_MENU_ID = "zotero-itemmenu-paper-planex-upload";

export function registerPaperUploadMenuItem() {
  const menuIcon = `chrome://${addon.data.config.addonRef}/content/icons/favicon@0.5x.png`;
  ztoolkit.Menu.register("item", {
    tag: "menuseparator",
    id: ITEM_MENU_SEPARATOR_ID,
  });
  ztoolkit.Menu.register("item", {
    tag: "menuitem",
    id: ITEM_MENU_ID,
    label: getString("menuitem-upload-paper"),
    commandListener: async () => {
      await uploadSelectedItems();
    },
    icon: menuIcon,
  });
}
