import { QuickScan } from "../../domain/paper/types";

const TAG_PREFIX = "ppx:";
const VERDICT_TAG_PREFIX = "ppx-verdict:";

export async function syncQuickScanTagsToItem(
  item: Zotero.Item,
  quickScan: QuickScan | null,
) {
  const existingTags = item.getTags().map((tag) => tag.tag);
  existingTags
    .filter(
      (tag) => tag.startsWith(TAG_PREFIX) || tag.startsWith(VERDICT_TAG_PREFIX),
    )
    .forEach((tag) => item.removeTag(tag));

  if (quickScan?.tags?.length) {
    quickScan.tags
      .filter((tag) => !!tag)
      .forEach((tag) => item.addTag(`${TAG_PREFIX}${tag.trim()}`));
  }

  if (quickScan?.verdict?.trim()) {
    item.addTag(`${VERDICT_TAG_PREFIX}${quickScan.verdict.trim()}`);
  }

  await item.saveTx();
}
