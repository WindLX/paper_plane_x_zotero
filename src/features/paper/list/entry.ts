import { paperMetadataRepository } from "../../../infra/zotero/paperMetadataRepository";
import { getString } from "../../../utils/locale";

let statusColumnRegistered = false;

export function registerPaperListColumns() {
  if (statusColumnRegistered) {
    return;
  }

  const dataKey = Zotero.ItemTreeManager.registerColumn({
    pluginID: addon.data.config.addonID,
    dataKey: "paperPlaneStatus",
    label: getString("paper-list-column-status"),
    enabledTreeIDs: ["main"],
    defaultIn: ["default"],
    width: "120",
    fixedWidth: false,
    showInColumnPicker: true,
    dataProvider: (item: Zotero.Item) => {
      if (!item?.isRegularItem?.()) {
        return "";
      }
      const meta = paperMetadataRepository.read(item);
      return meta.status || getString("paper-panel-placeholder-not-uploaded");
    },
  });

  statusColumnRegistered = Boolean(dataKey);
}
