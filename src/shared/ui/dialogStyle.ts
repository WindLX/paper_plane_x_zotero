const DIALOG_STYLE_ID_PREFIX = "paper-planex-dialog-style";

export function registerDialogStyles(doc: Document) {
  doc.documentElement.classList.add("ppx-ui-root");
  doc.body?.classList.add("ppx-dialog-body");
  ["ui.css", "dialogs.css"].forEach((fileName) => {
    const styleID = `${DIALOG_STYLE_ID_PREFIX}-${fileName}`;
    if (doc.getElementById(styleID)) {
      return;
    }
    const link = doc.createElement("link");
    link.id = styleID;
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = `chrome://${addon.data.config.addonRef}/content/${fileName}`;
    doc.head.appendChild(link);
  });
}
