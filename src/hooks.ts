import { registerPaperUploadMenuItem } from "./features/paper/upload/entry";
import { registerPaperFetchMenuItem } from "./features/paper/fetch/entry";
import { registerPaperLinkMenuItem } from "./features/paper/link/entry";
import { registerPaperSidebarSection } from "./features/paper/sidebar/entry";
import { registerPaperListColumns } from "./features/paper/list/entry";
import {
  registerPaperReprocessMenuItem,
  unregisterPaperReprocessMenuItem,
} from "./features/paper/reprocess/entry";
import {
  registerPaperUnlinkMenuItem,
  unregisterPaperUnlinkMenuItem,
} from "./features/paper/unlink/entry";
import { stopActiveBatchSession } from "./features/paper/batch/session";
import { initLocale } from "./utils/locale";
import { registerPrefsScripts } from "./features/preferences/controller";
import { registerPreferencesPane } from "./features/preferences/entry";
import { createZToolkit } from "./utils/ztoolkit";
import { registerMainWindowStyle } from "./shared/ui/mainWindowStyle";
import {
  registerProjectCollectionSyncMenuItem,
  unregisterProjectCollectionSyncMenuItem,
} from "./features/projectSync/entry";

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  initLocale();

  registerPreferencesPane();
  registerPaperListColumns();

  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win)),
  );

  // Mark initialized as true to confirm plugin loading status
  // outside of the plugin (e.g. scaffold testing process)
  addon.data.initialized = true;
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow): Promise<void> {
  addon.data.ztoolkit = createZToolkit();

  win.MozXULElement.insertFTLIfNeeded(
    `${addon.data.config.addonRef}-mainWindow.ftl`,
  );

  registerMainWindowStyle(win);
  registerPaperSidebarSection();
  registerPaperUploadMenuItem();
  registerPaperFetchMenuItem();
  registerPaperLinkMenuItem();
  registerPaperReprocessMenuItem();
  registerPaperUnlinkMenuItem();
  registerProjectCollectionSyncMenuItem();
}

async function onMainWindowUnload(win: Window): Promise<void> {
  // Only the window that started a batch stops it; other windows keep theirs.
  stopActiveBatchSession(win);
  ztoolkit.unregisterAll();
  addon.data.dialog?.window?.close();
}

function onShutdown(): void {
  // Plugin unload stops the active batch regardless of which window owns it.
  stopActiveBatchSession();
  unregisterPaperReprocessMenuItem();
  unregisterPaperUnlinkMenuItem();
  unregisterProjectCollectionSyncMenuItem();
  ztoolkit.unregisterAll();
  addon.data.dialog?.window?.close();
  // Remove addon object
  addon.data.alive = false;
  // @ts-expect-error - Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

async function onPrefsEvent(type: string, data: { [key: string]: any }) {
  switch (type) {
    case "load":
      registerPrefsScripts(data.window);
      break;
    default:
      return;
  }
}

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onPrefsEvent,
};
