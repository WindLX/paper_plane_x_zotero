import { extractPaperPlaneTags } from "@/domain/paper";
import { copyText } from "@/infra/zotero/clipboard";
import { paperMetadataRepository } from "@/infra/zotero/paperMetadataRepository";
import { showPaperNotice } from "@/infra/zotero/paperNotificationService";
import { getString } from "@/utils/locale";
import { getPaperListRemoteMetadata } from "./metadataCache";

type PaperListColumnKey =
  | "status"
  | "tags"
  | "paperID"
  | "projects"
  | "verdict"
  | "reason"
  | "quickSummary";

interface PaperListColumnDefinition {
  key: PaperListColumnKey;
  dataKey: string;
  label: Parameters<typeof getString>[0];
  width: string;
  defaultVisible?: boolean;
  copyable?: boolean;
}

const TAG_VALUE_SEPARATOR = "\u001f";

const COLUMN_DEFINITIONS: PaperListColumnDefinition[] = [
  {
    key: "status",
    dataKey: "paperPlaneStatus",
    label: "paper-list-column-status",
    width: "120",
    defaultVisible: true,
  },
  {
    key: "tags",
    dataKey: "paperPlaneTags",
    label: "paper-list-column-tags",
    width: "160",
  },
  {
    key: "paperID",
    dataKey: "paperPlanePaperID",
    label: "paper-list-column-paper-id",
    width: "180",
  },
  {
    key: "projects",
    dataKey: "paperPlaneProjects",
    label: "paper-list-column-projects",
    width: "240",
  },
  {
    key: "verdict",
    dataKey: "paperPlaneVerdict",
    label: "paper-list-column-verdict",
    width: "110",
  },
  {
    key: "reason",
    dataKey: "paperPlaneReason",
    label: "paper-list-column-reason",
    width: "240",
  },
  {
    key: "quickSummary",
    dataKey: "paperPlaneQuickSummary",
    label: "paper-list-column-quick-summary",
    width: "280",
  },
];

let columnsRegistered = false;

export function registerPaperListColumns() {
  if (columnsRegistered) {
    return;
  }

  const registrationResults = COLUMN_DEFINITIONS.map((definition) =>
    Boolean(
      Zotero.ItemTreeManager.registerColumn({
        pluginID: addon.data.config.addonID,
        dataKey: definition.dataKey,
        label: getString(definition.label),
        enabledTreeIDs: ["main"],
        defaultIn: definition.defaultVisible ? ["default"] : undefined,
        width: definition.width,
        minWidth: 72,
        fixedWidth: false,
        showInColumnPicker: true,
        columnPickerSubMenu: true,
        zoteroPersist: ["width", "hidden", "sortDirection"],
        dataProvider: (item: Zotero.Item) =>
          getColumnValue(item, definition.key),
        renderCell: (index, data, column, isFirstColumn, doc) =>
          renderPaperListCell(
            index,
            data,
            column,
            isFirstColumn,
            doc,
            definition.key,
          ),
      }),
    ),
  );
  columnsRegistered = registrationResults.every(Boolean);
}

export function getColumnValue(
  item: Zotero.Item,
  key: PaperListColumnKey,
): string {
  if (!item?.isRegularItem?.()) {
    return "";
  }

  const localMeta = paperMetadataRepository.read(item);
  switch (key) {
    case "status":
      return (
        localMeta.status || getString("paper-panel-placeholder-not-uploaded")
      );
    case "tags":
      return extractPaperPlaneTags(item).join(TAG_VALUE_SEPARATOR);
    case "paperID":
      return localMeta.paperID;
  }

  const remoteMeta = getPaperListRemoteMetadata(localMeta.paperID);
  if (!remoteMeta) {
    return "";
  }
  switch (key) {
    case "projects":
      return remoteMeta.projectSummary;
    case "verdict":
      return remoteMeta.verdict;
    case "reason":
      return remoteMeta.reason;
    case "quickSummary":
      return remoteMeta.quickSummary;
  }
}

function renderPaperListCell(
  _index: number,
  data: string,
  column: _ZoteroTypes.ItemTreeManager.ItemTreeColumnOptions & {
    className: string;
  },
  _isFirstColumn: boolean,
  doc: Document,
  key: PaperListColumnKey,
) {
  const cell = doc.createElement("span");
  cell.className = `cell ${column.className} ppx-list-cell`;

  if (key === "tags") {
    const tags = data.split(TAG_VALUE_SEPARATOR).filter(Boolean);
    cell.classList.add("ppx-list-tag-cell");
    cell.title = tags.join(", ");
    tags.forEach((tag) => {
      const chip = doc.createElement("span");
      chip.className = "ppx-list-tag";
      chip.textContent = tag;
      chip.title = tag;
      cell.appendChild(chip);
    });
    return cell;
  }

  cell.textContent = data;
  cell.title = data;
  return cell;
}
