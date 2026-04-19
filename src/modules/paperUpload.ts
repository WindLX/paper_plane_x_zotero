import { getString } from "../utils/locale";
import { createPaperFromItem, getPaperServiceBaseURL } from "./paperService";

interface UploadStats {
    success: number;
    failed: number;
    skipped: number;
}

const EXTRA_PAPER_ID_KEY = "paper_plane_id";
const EXTRA_PAPER_STATUS_KEY = "paper_plane_status";
const EXTRA_PAPER_MESSAGE_KEY = "paper_plane_message";
const ITEM_MENU_SEPARATOR_ID = "zotero-itemmenu-paper-planex-separator";
const ITEM_MENU_ID = "zotero-itemmenu-paper-planex-upload";

export interface PaperPlaneMetadata {
    paperID: string;
    status: string;
    message: string;
}

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

export async function uploadSingleItem(item: Zotero.Item) {
    const baseURL = getPaperServiceBaseURL();
    if (!baseURL) {
        showMessage(getString("upload-base-url-missing"), "warning");
        return false;
    }

    const result = await processItemUpload(item);
    if (result.result === "skipped") {
        showMessage(
            getString("upload-item-skipped-no-pdf", { args: { title: result.title } }),
            "warning",
        );
        return false;
    }

    showMessage(
        getString("upload-item-success", { args: { title: result.title } }),
        "success",
    );
    return true;
}

export async function uploadSelectedItems() {
    const baseURL = getPaperServiceBaseURL();
    if (!baseURL) {
        showMessage(getString("upload-base-url-missing"), "warning");
        return;
    }

    const pane = Zotero.getActiveZoteroPane?.();
    const selectedItems = (pane?.getSelectedItems?.() || []).filter((item) =>
        item.isRegularItem(),
    );

    if (!selectedItems.length) {
        showMessage(getString("upload-no-selection"), "warning");
        return;
    }

    const stats: UploadStats = { success: 0, failed: 0, skipped: 0 };
    const popupWin = new ztoolkit.ProgressWindow(addon.data.config.addonName, {
        closeOnClick: true,
        closeTime: -1,
    })
        .createLine({
            text: getString("upload-start"),
            type: "default",
            progress: 0,
        })
        .show();

    for (let i = 0; i < selectedItems.length; i++) {
        const item = selectedItems[i];
        const title = item.getField("title") || `${item.id}`;
        try {
            const result = await processItemUpload(item);
            if (result.result === "skipped") {
                stats.skipped += 1;
                showMessage(
                    getString("upload-item-skipped-no-pdf", { args: { title: result.title } }),
                    "warning",
                );
                continue;
            }

            stats.success += 1;
            showMessage(
                getString("upload-item-success", { args: { title: result.title } }),
                "success",
            );
        } catch (error) {
            stats.failed += 1;
            const reason = error instanceof Error ? error.message : "Unknown upload error";
            showMessage(
                getString("upload-item-failed", { args: { title, reason } }),
                "error",
            );
            ztoolkit.log("Upload error", error);
        } finally {
            popupWin.changeLine({
                progress: Math.round(((i + 1) / selectedItems.length) * 100),
                text: `${i + 1}/${selectedItems.length}`,
            });
        }
    }

    popupWin.changeLine({
        progress: 100,
        text: getString("upload-finish", {
            args: {
                success: stats.success,
                failed: stats.failed,
                skipped: stats.skipped,
            },
        }),
    });
    popupWin.startCloseTimer(5000);
}

export function getPaperPlaneMetadata(item: Zotero.Item): PaperPlaneMetadata {
    const extra = item.getField("extra") || "";
    return {
        paperID: getExtraKeyValue(extra, EXTRA_PAPER_ID_KEY),
        status: getExtraKeyValue(extra, EXTRA_PAPER_STATUS_KEY),
        message: getExtraKeyValue(extra, EXTRA_PAPER_MESSAGE_KEY),
    };
}

export async function upsertPaperMetadataToExtra(
    item: Zotero.Item,
    metadata: {
        paperID?: string;
        status?: string;
        message?: string;
    },
) {
    const currentExtra = item.getField("extra") || "";
    const lines = currentExtra.split(/\r?\n/).filter((line) => line.length > 0);
    const nextLines = [...lines];

    if (metadata.paperID) {
        setExtraKeyValue(nextLines, EXTRA_PAPER_ID_KEY, metadata.paperID);
    }
    if (metadata.status) {
        setExtraKeyValue(nextLines, EXTRA_PAPER_STATUS_KEY, metadata.status);
    }
    if (metadata.message) {
        setExtraKeyValue(nextLines, EXTRA_PAPER_MESSAGE_KEY, metadata.message);
    }

    item.setField("extra", nextLines.join("\n"));
    await item.saveTx();
}

async function processItemUpload(item: Zotero.Item) {
    const title = item.getField("title") || `${item.id}`;
    const result = await createPaperFromItem(item);
    if (result.result === "skipped") {
        return {
            title,
            result: "skipped" as const,
        };
    }

    await upsertPaperMetadataToExtra(item, {
        paperID: result.response.paper_id || undefined,
        status: result.response.status,
        message: result.response.message,
    });

    return {
        title,
        result: "success" as const,
    };
}

function setExtraKeyValue(lines: string[], key: string, value: string) {
    const keyPrefix = `${key}:`;
    const nextLine = `${keyPrefix} ${sanitizeExtraValue(value)}`;
    const index = lines.findIndex((line) => line.trimStart().startsWith(keyPrefix));
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

function showMessage(text: string, type: "default" | "warning" | "error" | "success") {
    new ztoolkit.ProgressWindow(addon.data.config.addonName)
        .createLine({
            text,
            type,
            progress: 100,
        })
        .show();
}
