import { BatchSkipReason } from "@/domain/paperBatch";
import { getString } from "@/utils/locale";

export function describeBatchSkipReason(
  reason: BatchSkipReason,
  status: string,
): string {
  if (reason === "no-paper-id") {
    return getString("batch-skip-no-paper-id");
  }
  if (reason === "no-local-pdf") {
    return getString("batch-skip-no-local-pdf");
  }
  return getString("batch-skip-in-progress", {
    args: { status: status || "PENDING" },
  });
}
