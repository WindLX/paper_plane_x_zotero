const MAIN_WINDOW_STYLE_ID = "paper-planex-main-window-style";

export function registerMainWindowStyle(win: _ZoteroTypes.MainWindow) {
  const doc = win.document;
  if (doc.getElementById(MAIN_WINDOW_STYLE_ID)) {
    return;
  }

  const styles = ztoolkit.UI.createElement(doc, "link", {
    namespace: "html",
    properties: {
      id: MAIN_WINDOW_STYLE_ID,
      type: "text/css",
      rel: "stylesheet",
      href: `chrome://${addon.data.config.addonRef}/content/zoteroPane.css`,
    },
  });
  doc.documentElement?.appendChild(styles);
}
