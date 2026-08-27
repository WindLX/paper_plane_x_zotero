import { getLocaleID } from "@/utils/locale";
import {
  CollectionMenuContext,
  getSingleCollectionMenuRow,
} from "./menuContext";
import {
  cancelCollectionProjectAssociations,
  getCollectionMappedProjectIDs,
  syncProjectToCollection,
} from "./useCase";

const COLLECTION_MENU_ID = "zotero-collectionmenu-paper-plane-x-project-sync";
let registeredMenuID: string | undefined;

export function registerProjectCollectionSyncMenuItem() {
  if (registeredMenuID) {
    return;
  }
  const dataKey = Zotero.MenuManager.registerMenu({
    menuID: COLLECTION_MENU_ID,
    pluginID: addon.data.config.addonID,
    target: "main/library/collection",
    menus: [
      {
        menuType: "menuitem",
        l10nID: getLocaleID("menuitem-sync-project-to-collection"),
        icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon@0.5x.svg`,
        onShowing(_event, context) {
          const row = getSingleCollectionMenuRow(
            context as CollectionMenuContext<Zotero.CollectionTreeRow>,
          );
          const available = Boolean(
            row?.isCollection() && row.editable && row.filesEditable,
          );
          context.setVisible(available);
          context.setEnabled(available);
        },
        async onCommand(_event, context) {
          const row = getSingleCollectionMenuRow(
            context as CollectionMenuContext<Zotero.CollectionTreeRow>,
          );
          if (!row?.isCollection() || !row.editable || !row.filesEditable) {
            return;
          }
          await syncProjectToCollection(row.ref as Zotero.Collection);
        },
      },
      {
        menuType: "menuitem",
        l10nID: getLocaleID("menuitem-unlink-project-from-collection"),
        icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon@0.5x.svg`,
        onShowing(_event, context) {
          const row = getSingleCollectionMenuRow(
            context as CollectionMenuContext<Zotero.CollectionTreeRow>,
          );
          const available = Boolean(
            row?.isCollection() &&
            getCollectionMappedProjectIDs(row.ref as Zotero.Collection).length >
              0,
          );
          context.setVisible(available);
          context.setEnabled(available);
        },
        onCommand(_event, context) {
          const row = getSingleCollectionMenuRow(
            context as CollectionMenuContext<Zotero.CollectionTreeRow>,
          );
          if (!row?.isCollection()) {
            return;
          }
          const win = context.menuElem.ownerGlobal;
          if (!win) {
            return;
          }
          cancelCollectionProjectAssociations(
            row.ref as Zotero.Collection,
            win,
          );
        },
      },
    ],
  });
  registeredMenuID = dataKey || undefined;
}

export function unregisterProjectCollectionSyncMenuItem() {
  if (!registeredMenuID) {
    return;
  }
  Zotero.MenuManager.unregisterMenu(registeredMenuID);
  registeredMenuID = undefined;
}
