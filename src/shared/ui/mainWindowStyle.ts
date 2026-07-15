const MAIN_WINDOW_STYLE_ID_PREFIX = "paper-planex-main-window-style";

export function registerMainWindowStyle(win: _ZoteroTypes.MainWindow) {
  const doc = win.document;
  ["ui.css", "zoteroPane.css"].forEach((fileName) => {
    const styleID = `${MAIN_WINDOW_STYLE_ID_PREFIX}-${fileName}`;
    if (doc.getElementById(styleID)) {
      return;
    }
    const styles = ztoolkit.UI.createElement(doc, "link", {
      namespace: "html",
      properties: {
        id: styleID,
        type: "text/css",
        rel: "stylesheet",
        href: `chrome://${addon.data.config.addonRef}/content/${fileName}`,
      },
    });
    doc.documentElement?.appendChild(styles);
  });
}
