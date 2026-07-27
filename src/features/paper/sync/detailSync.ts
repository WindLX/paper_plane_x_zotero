import {
  buildPaperDetailStatusMessage,
  PaperDetailResponse,
} from "@/domain/paper";
import { paperMetadataRepository } from "@/infra/zotero/paperMetadataRepository";
import { syncQuickScanTagsToItem } from "@/infra/zotero/paperTagSync";
import { primePaperListRemoteMetadata } from "../list/metadataCache";

export async function syncPaperDetailToItem(
  item: Zotero.Item,
  detail: PaperDetailResponse,
) {
  await paperMetadataRepository.write(item, {
    paperID: detail.paper_id,
    status: detail.extraction_status,
    message: buildPaperDetailStatusMessage(detail),
  });
  await syncQuickScanTagsToItem(item, detail.quick_scan || null);
  primePaperListRemoteMetadata(detail);
}
