import { config } from "../../package.json";

export async function registerPrefsScripts(_window: Window) {
    const input = _window.document.querySelector(
        `#zotero-prefpane-${config.addonRef}-paperPlaneBaseURL`,
    ) as HTMLInputElement | null;

    if (!input) {
        return;
    }

    // Keep a normalized base URL to avoid duplicated slashes in API endpoint join.
    input.addEventListener("change", () => {
        input.value = normalizeBaseURL(input.value);
    });
}

function normalizeBaseURL(value: string) {
    return value.trim().replace(/\/+$/, "");
}
