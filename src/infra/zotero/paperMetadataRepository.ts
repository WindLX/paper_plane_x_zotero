export interface LocalPaperMetadata {
  paperID: string;
  status: string;
  message: string;
}

const EXTRA_PAPER_ID_KEY = "paper_plane_id";
const EXTRA_PAPER_STATUS_KEY = "paper_plane_status";
const EXTRA_PAPER_MESSAGE_KEY = "paper_plane_message";

export interface PaperMetadataRepository {
  read(item: Zotero.Item): LocalPaperMetadata;
  write(
    item: Zotero.Item,
    patch: Partial<LocalPaperMetadata>,
  ): Promise<LocalPaperMetadata>;
}

export const paperMetadataRepository: PaperMetadataRepository = {
  read(item) {
    const extra = item.getField("extra") || "";
    return {
      paperID: getExtraKeyValue(extra, EXTRA_PAPER_ID_KEY),
      status: getExtraKeyValue(extra, EXTRA_PAPER_STATUS_KEY),
      message: getExtraKeyValue(extra, EXTRA_PAPER_MESSAGE_KEY),
    };
  },
  async write(item, patch) {
    const currentExtra = item.getField("extra") || "";
    const lines = currentExtra.split(/\r?\n/).filter((line) => line.length > 0);
    const nextLines = [...lines];

    if (patch.paperID) {
      setExtraKeyValue(nextLines, EXTRA_PAPER_ID_KEY, patch.paperID);
    }
    if (patch.status) {
      setExtraKeyValue(nextLines, EXTRA_PAPER_STATUS_KEY, patch.status);
    }
    if (patch.message) {
      setExtraKeyValue(nextLines, EXTRA_PAPER_MESSAGE_KEY, patch.message);
    }

    item.setField("extra", nextLines.join("\n"));
    await item.saveTx();
    return this.read(item);
  },
};

function setExtraKeyValue(lines: string[], key: string, value: string) {
  const keyPrefix = `${key}:`;
  const nextLine = `${keyPrefix} ${sanitizeExtraValue(value)}`;
  const index = lines.findIndex((line) =>
    line.trimStart().startsWith(keyPrefix),
  );
  if (index >= 0) {
    lines[index] = nextLine;
  } else {
    lines.push(nextLine);
  }
}

function sanitizeExtraValue(value: string) {
  return value.replace(/\r?\n/g, " ").trim();
}

function getExtraKeyValue(extra: string, key: string) {
  const keyPrefix = `${key}:`;
  const line = extra
    .split(/\r?\n/)
    .find((candidate) => candidate.trimStart().startsWith(keyPrefix));
  if (!line) {
    return "";
  }
  return line.slice(line.indexOf(":") + 1).trim();
}
