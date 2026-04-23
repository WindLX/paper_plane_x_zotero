import { CheckCheck, Save, Wand2, X } from "lucide";
import { createLucideIcon } from "../../../shared/ui/icon/lucide";
import { getString } from "../../../utils/locale";
import { StructuredJSONEditorOptions, StructuredEditorValue } from "./types";
import { stringifyStructuredJSON } from "./validation";

const QUICK_SCAN_EDITOR_LINE_HEIGHT_PX = 21;

export async function openStructuredJSONEditorDialog<T extends StructuredEditorValue>(
  options: StructuredJSONEditorOptions<T>,
) {
  let currentText = stringifyStructuredJSON(
    options.initialValue,
    options.createEmptyValue(),
  );
  let initialText = currentText;
  let isDirty = false;
  let isSaving = false;
  let statusMessage = "";
  let validationMessage = "";
  let dialogHelper: any;
  let lineNumbersEl: HTMLPreElement | null = null;
  let measureEl: HTMLDivElement | null = null;
  let resizeObserver: ResizeObserver | null = null;

  const dialogData: {
    loadCallback: () => void;
    unloadCallback: () => void;
    unloadLock?: { promise: Promise<void>; resolve: () => void };
  } = {
    loadCallback: () => {
      const doc = dialogHelper.window?.document;
      if (!doc) {
        return;
      }
      const textarea = doc.getElementById(
        "ppx-quick-scan-json-textarea",
      ) as HTMLTextAreaElement | null;
      if (!textarea) {
        return;
      }
      lineNumbersEl = doc.getElementById(
        "ppx-quick-scan-line-numbers",
      ) as HTMLPreElement | null;
      measureEl = createMeasureElement(doc);
      textarea.value = currentText;
      textarea.focus();
      textarea.selectionStart = 0;
      textarea.selectionEnd = 0;
      decorateActionButtons(doc);
      textarea.addEventListener("input", () => {
        currentText = textarea.value;
        isDirty = currentText !== initialText;
        validationMessage = "";
        statusMessage = isDirty
          ? getString("paper-panel-json-dirty")
          : "";
        refreshState();
      });
      textarea.addEventListener("scroll", () => {
        if (lineNumbersEl) {
          lineNumbersEl.scrollTop = textarea.scrollTop;
        }
        syncCurrentLineHighlight(textarea);
      });
      textarea.addEventListener("click", () => {
        syncCurrentLineHighlight(textarea);
      });
      textarea.addEventListener("keyup", () => {
        syncCurrentLineHighlight(textarea);
      });
      textarea.addEventListener("mouseup", () => {
        refreshState();
      });
      textarea.addEventListener("keydown", (event: KeyboardEvent) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
          event.preventDefault();
          void saveFromShortcut();
        }
      });
      if (typeof dialogHelper.window?.ResizeObserver === "function") {
        const observer = new dialogHelper.window.ResizeObserver(() => {
          refreshState();
        });
        resizeObserver = observer;
        observer.observe(textarea);
      } else {
        dialogHelper.window?.addEventListener("resize", refreshState);
      }
      refreshState();
    },
    unloadCallback: () => {
      resizeObserver?.disconnect();
      resizeObserver = null;
      measureEl?.remove();
      measureEl = null;
      dialogHelper.window?.removeEventListener?.("resize", refreshState);
      addon.data.dialog = undefined;
    },
  };

  dialogHelper = new ztoolkit.Dialog(8, 1)
    .addCell(0, 0, {
      tag: "div",
      namespace: "html",
      styles: {
        padding: "20px 22px",
        marginBottom: "18px",
        borderRadius: "10px",
        border: "1px solid rgba(15, 23, 42, 0.10)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.92))",
        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
      },
      children: [
        {
          tag: "div",
          namespace: "html",
          properties: {
            innerText: options.title || "-",
          },
          styles: {
            fontSize: "18px",
            fontWeight: "700",
            marginBottom: "8px",
            color: "rgba(15, 23, 42, 0.92)",
          },
        },
        {
          tag: "div",
          namespace: "html",
          styles: {
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            alignItems: "center",
          },
          children: [
            {
              tag: "span",
              namespace: "html",
              properties: {
                innerText: `paper_id: ${options.paperID}`,
              },
              styles: infoChipStyle(),
            },
            {
              tag: "span",
              namespace: "html",
              properties: {
                innerText: options.updatedAt
                  ? `${getString("paper-panel-updated-at-label")}: ${options.updatedAt}`
                  : getString("paper-panel-value-not-synced"),
              },
              styles: infoChipStyle(),
            },
          ],
        },
      ],
    })
    .addCell(1, 0, {
      tag: "div",
      namespace: "html",
      styles: {
        display: "grid",
        gridTemplateColumns: "50px minmax(0, 1fr)",
        overflow: "hidden",
        marginBottom: "14px",
        borderRadius: "10px",
        border: "1px solid rgba(15, 23, 42, 0.14)",
        background:
          "linear-gradient(180deg, rgba(248,250,252,0.98), rgba(241,245,249,0.96))",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.8), 0 10px 24px rgba(15, 23, 42, 0.05)",
      },
      children: [
        {
          tag: "pre",
          namespace: "html",
          id: "ppx-quick-scan-line-numbers",
          properties: {
            innerText: "1",
          },
          styles: {
            margin: "0",
            padding: "14px 8px 14px 0",
            minHeight: "360px",
            boxSizing: "border-box",
            textAlign: "right",
            color: "rgba(100, 116, 139, 0.9)",
            background: "rgba(226, 232, 240, 0.72)",
            borderRight: "1px solid rgba(15, 23, 42, 0.08)",
            fontFamily:
              'ui-monospace, "SFMono-Regular", "Cascadia Code", "JetBrains Mono", Consolas, monospace',
            fontSize: "13px",
            lineHeight: `${QUICK_SCAN_EDITOR_LINE_HEIGHT_PX}px`,
            userSelect: "none",
            overflow: "hidden",
            whiteSpace: "pre",
          },
        },
        {
          tag: "textarea",
          namespace: "html",
          id: "ppx-quick-scan-json-textarea",
          attributes: {
            spellcheck: "false",
            wrap: "soft",
          },
          styles: {
            width: "100%",
            minHeight: "360px",
            boxSizing: "border-box",
            padding: "14px 16px",
            border: "none",
            background: "transparent",
            color: "rgba(15, 23, 42, 0.92)",
            outline: "none",
            fontFamily:
              'ui-monospace, "SFMono-Regular", "Cascadia Code", "JetBrains Mono", Consolas, monospace',
            fontSize: "13px",
            lineHeight: `${QUICK_SCAN_EDITOR_LINE_HEIGHT_PX}px`,
            resize: "vertical",
            overflow: "auto",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            wordBreak: "break-word",
          },
        },
      ],
    })
    .addCell(2, 0, {
      tag: "p",
      namespace: "html",
      properties: {
        innerText: options.description,
      },
      styles: {
        margin: "0 0 12px",
        padding: "0 4px",
        fontSize: "12px",
        lineHeight: "1.6",
        opacity: "0.82",
      },
    })
    .addCell(3, 0, {
      tag: "div",
      namespace: "html",
      id: "ppx-quick-scan-validation",
      properties: {
        innerText: "",
      },
      styles: {
        minHeight: "18px",
        padding: "2px 6px 0",
        fontSize: "12px",
        color: "#b45309",
      },
    })
    .addCell(4, 0, {
      tag: "div",
      namespace: "html",
      id: "ppx-quick-scan-status",
      properties: {
        innerText: "",
      },
      styles: {
        minHeight: "18px",
        padding: "0 6px 14px",
        fontSize: "12px",
        color: "rgba(15,23,42,0.72)",
      },
    })
    .addCell(5, 0, {
      tag: "div",
      namespace: "html",
      id: "ppx-quick-scan-actions",
      styles: {
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: "6px",
        padding: "0 2px 0 2px",
      },
      children: [
        makeActionButton(
          "ppx-quick-scan-format",
          getString("paper-panel-action-format-json"),
        ),
        makeActionButton(
          "ppx-quick-scan-validate",
          getString("paper-panel-action-validate-json"),
        ),
        makeActionButton(
          "ppx-quick-scan-cancel",
          getString("paper-panel-action-cancel"),
        ),
        makeActionButton(
          "ppx-quick-scan-save",
          getString("paper-panel-action-save-json"),
        ),
      ],
    })
    .setDialogData(dialogData as any)
    .open(options.title, {
      width: 920,
      height: 760,
      centerscreen: true,
      resizable: true,
      fitContent: false,
      noDialogMode: true,
    });

  addon.data.dialog = dialogHelper;

  await dialogData.unloadLock?.promise;

  async function saveFromShortcut() {
    if (isSaving) {
      return;
    }
    const result = options.validateJSON(currentText);
    if (!result.ok) {
      validationMessage = result.error;
      statusMessage = "";
      refreshState();
      return;
    }
    await submit(result.value, result.prettyText);
  }

  async function submit(value: T, prettyText: string) {
    isSaving = true;
    validationMessage = "";
    statusMessage = getString("paper-panel-action-saving-json");
    refreshState();
    try {
      await options.onSubmit(value);
      currentText = prettyText;
      initialText = prettyText;
      isDirty = false;
      statusMessage = getString("paper-panel-json-saved");
      refreshState();
      dialogHelper.window?.close();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      validationMessage = "";
      statusMessage = message;
      refreshState();
    } finally {
      isSaving = false;
      refreshState();
    }
  }

  function refreshState() {
    const doc = dialogHelper.window?.document;
    if (!doc) {
      return;
    }
    const textarea = doc.getElementById(
      "ppx-quick-scan-json-textarea",
    ) as HTMLTextAreaElement | null;
    const validationEl = doc.getElementById("ppx-quick-scan-validation");
    const statusEl = doc.getElementById("ppx-quick-scan-status");
    if (textarea && textarea.value !== currentText) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      textarea.value = currentText;
      if (typeof start === "number" && typeof end === "number") {
        textarea.selectionStart = Math.min(start, currentText.length);
        textarea.selectionEnd = Math.min(end, currentText.length);
      }
    }
    if (textarea) {
      textarea.disabled = isSaving;
      syncCurrentLineHighlight(textarea);
    }
    if (lineNumbersEl && textarea && measureEl) {
      lineNumbersEl.textContent = buildWrappedLineNumbers(
        textarea,
        currentText,
        measureEl,
      );
    }
    if (validationEl) {
      validationEl.textContent = validationMessage;
    }
    if (statusEl) {
      statusEl.textContent = statusMessage;
    }
  }

  function syncCurrentLineHighlight(textarea: HTMLTextAreaElement) {
    const caretRowIndex = measureEl
      ? getCaretVisualRowIndex(textarea, currentText, measureEl)
      : currentText.slice(0, textarea.selectionStart ?? 0).split("\n").length - 1;
    const top = 14 + caretRowIndex * QUICK_SCAN_EDITOR_LINE_HEIGHT_PX - textarea.scrollTop;
    textarea.style.backgroundImage = `linear-gradient(180deg,
      transparent ${Math.max(0, top)}px,
      rgba(148, 163, 184, 0.12) ${Math.max(0, top)}px,
      rgba(148, 163, 184, 0.12) ${Math.max(0, top + QUICK_SCAN_EDITOR_LINE_HEIGHT_PX)}px,
      transparent ${Math.max(0, top + QUICK_SCAN_EDITOR_LINE_HEIGHT_PX)}px)`;
    textarea.style.backgroundRepeat = "no-repeat";
  }

  function decorateActionButtons(doc: Document) {
    const buttonMap: Array<{ id: string; label: string; icon: typeof Wand2 }> = [
      {
        id: "ppx-quick-scan-format",
        label: getString("paper-panel-action-format-json"),
        icon: Wand2,
      },
      {
        id: "ppx-quick-scan-validate",
        label: getString("paper-panel-action-validate-json"),
        icon: CheckCheck,
      },
      {
        id: "ppx-quick-scan-cancel",
        label: getString("paper-panel-action-cancel"),
        icon: X,
      },
      {
        id: "ppx-quick-scan-save",
        label: getString("paper-panel-action-save-json"),
        icon: Save,
      },
    ];

    buttonMap.forEach(({ id, label, icon }) => {
      const button = doc.getElementById(id) as HTMLButtonElement | null;
      if (!button || button.dataset.ppxDecorated === "true") {
        return;
      }
      button.dataset.ppxDecorated = "true";
      button.setAttribute(
        "style",
        [
          "display:inline-flex",
          "align-items:center",
          "justify-content:center",
          "gap:6px",
          "min-height:28px",
          "padding:0 12px",
          "border:1px solid rgba(15,23,42,0.14)",
          "border-radius:6px",
          "background:linear-gradient(180deg, rgba(255,255,255,0.98), rgba(241,245,249,0.92))",
          "box-shadow:inset 0 1px 0 rgba(255,255,255,0.8)",
          "color:rgba(15,23,42,0.86)",
        ].join(";"),
      );
      button.textContent = "";
      button.append(
        createLucideIcon(doc, icon, {
          width: 14,
          height: 14,
        }),
        doc.createTextNode(label),
      );
    });

    const formatButton = doc.getElementById(
      "ppx-quick-scan-format",
    ) as HTMLButtonElement | null;
    const validateButton = doc.getElementById(
      "ppx-quick-scan-validate",
    ) as HTMLButtonElement | null;
    const cancelButton = doc.getElementById(
      "ppx-quick-scan-cancel",
    ) as HTMLButtonElement | null;
    const saveButton = doc.getElementById(
      "ppx-quick-scan-save",
    ) as HTMLButtonElement | null;

    formatButton?.addEventListener("click", () => {
      if (isSaving) {
        return;
      }
      const result = options.validateJSON(currentText);
      if (!result.ok) {
        validationMessage = result.error;
        statusMessage = "";
        refreshState();
        return;
      }
      currentText = result.prettyText;
      validationMessage = "";
      statusMessage = getString("paper-panel-json-formatted");
      isDirty = currentText !== initialText;
      refreshState();
    });

    validateButton?.addEventListener("click", () => {
      if (isSaving) {
        return;
      }
      const result = options.validateJSON(currentText);
      if (!result.ok) {
        validationMessage = result.error;
        statusMessage = "";
      } else {
        validationMessage = "";
        statusMessage = getString("paper-panel-json-valid");
      }
      refreshState();
    });

    cancelButton?.addEventListener("click", () => {
      if (isSaving) {
        return;
      }
      if (isDirty && dialogHelper.window?.confirm) {
        const confirmClose = dialogHelper.window.confirm(
          getString("paper-panel-json-unsaved-confirm"),
        );
        if (!confirmClose) {
          return;
        }
      }
      dialogHelper.window?.close();
    });

    saveButton?.addEventListener("click", async () => {
      if (isSaving) {
        return;
      }
      const result = options.validateJSON(currentText);
      if (!result.ok) {
        validationMessage = result.error;
        statusMessage = "";
        refreshState();
        return;
      }
      await submit(result.value, result.prettyText);
    });
  }
}

function createMeasureElement(doc: Document) {
  const measure = doc.createElement("div");
  measure.setAttribute("aria-hidden", "true");
  Object.assign(measure.style, {
    position: "fixed",
    visibility: "hidden",
    pointerEvents: "none",
    inset: "0 auto auto -99999px",
    padding: "0",
    margin: "0",
    border: "none",
    boxSizing: "content-box",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
    fontFamily:
      'ui-monospace, "SFMono-Regular", "Cascadia Code", "JetBrains Mono", Consolas, monospace',
    fontSize: "13px",
    lineHeight: `${QUICK_SCAN_EDITOR_LINE_HEIGHT_PX}px`,
  } as Partial<CSSStyleDeclaration>);
  const parent = doc.body ?? doc.documentElement;
  if (parent) {
    parent.appendChild(measure);
  }
  return measure;
}

function syncMeasureElement(
  textarea: HTMLTextAreaElement,
  measureEl: HTMLDivElement,
) {
  const ownerDocument = textarea.ownerDocument;
  const computed = ownerDocument?.defaultView?.getComputedStyle(textarea);
  if (!computed) {
    return;
  }
  const contentWidth = Math.max(
    1,
    textarea.clientWidth -
      parseFloat(computed.paddingLeft || "0") -
      parseFloat(computed.paddingRight || "0"),
  );
  measureEl.style.width = `${contentWidth}px`;
  measureEl.style.fontFamily = computed.fontFamily;
  measureEl.style.fontSize = computed.fontSize;
  measureEl.style.fontWeight = computed.fontWeight;
  measureEl.style.letterSpacing = computed.letterSpacing;
  measureEl.style.lineHeight = computed.lineHeight;
  measureEl.style.whiteSpace = computed.whiteSpace;
  measureEl.style.wordBreak = computed.wordBreak;
  measureEl.style.overflowWrap = computed.overflowWrap;
}

function getMeasuredRowCount(
  textarea: HTMLTextAreaElement,
  value: string,
  measureEl: HTMLDivElement,
) {
  syncMeasureElement(textarea, measureEl);
  measureEl.textContent = normalizeMeasuredText(value);
  const measuredHeight = measureEl.getBoundingClientRect().height;
  return Math.max(1, Math.ceil(measuredHeight / QUICK_SCAN_EDITOR_LINE_HEIGHT_PX));
}

function buildWrappedLineNumbers(
  textarea: HTMLTextAreaElement,
  text: string,
  measureEl: HTMLDivElement,
) {
  const lines = text.split("\n");
  const rows: string[] = [];
  lines.forEach((line, index) => {
    const wrappedRows = getMeasuredRowCount(textarea, line, measureEl);
    rows.push(String(index + 1));
    for (let row = 1; row < wrappedRows; row += 1) {
      rows.push("");
    }
  });
  return rows.join("\n");
}

function getCaretVisualRowIndex(
  textarea: HTMLTextAreaElement,
  text: string,
  measureEl: HTMLDivElement,
) {
  const selectionStart = textarea.selectionStart ?? 0;
  const prefix = text.slice(0, selectionStart);
  const prefixWithCaretAnchor =
    selectionStart >= text.length
      ? `${prefix}\u200b`
      : `${prefix}${text[selectionStart] ?? "\u200b"}`;
  return getMeasuredRowCount(textarea, prefixWithCaretAnchor, measureEl) - 1;
}

function normalizeMeasuredText(value: string) {
  if (!value) {
    return "\u200b";
  }
  if (value.endsWith("\n")) {
    return `${value}\u200b`;
  }
  return value;
}

function infoChipStyle() {
  return {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "24px",
    padding: "0 8px",
    borderRadius: "999px",
    border: "1px solid rgba(15, 23, 42, 0.10)",
    background: "rgba(255,255,255,0.82)",
    fontSize: "12px",
    color: "rgba(15, 23, 42, 0.72)",
  };
}

function makeActionButton(id: string, text: string) {
  return {
    tag: "button",
    namespace: "html",
    id,
    attributes: {
      type: "button",
    },
    properties: {
      innerText: text,
    },
  };
}
