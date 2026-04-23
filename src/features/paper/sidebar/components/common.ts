import katex from "katex";
import { marked } from "marked";
import { createLucideIcon } from "../../../../shared/ui/icon/lucide";
import { el } from "../../../../shared/ui/dom";
import { getString } from "../../../../utils/locale";
import { CitedText } from "../../../../domain/paper";

type LucideIconNode = [string, Record<string, unknown>][];

export function renderValueLine(doc: Document, label: string, value: string) {
  const line = el(doc, "div", { className: "ppx-field-row" });
  line.append(
    el(doc, "span", { className: "ppx-field-label", text: label }),
    el(doc, "span", { className: "ppx-field-value", text: value }),
  );
  return line;
}

export function renderCopyableLine(
  doc: Document,
  label: string,
  value: string,
  onCopy?: () => void,
) {
  const line = el(doc, "div", { className: "ppx-field-row" });
  let valueEl: HTMLButtonElement | HTMLSpanElement;
  if (onCopy) {
    const button = el(doc, "button", {
      className: "ppx-copy-button ppx-copy-value",
      text: value,
    }) as HTMLButtonElement;
    button.type = "button";
    button.addEventListener("click", onCopy);
    valueEl = button;
  } else {
    valueEl = el(doc, "span", {
      className: "ppx-field-value",
      text: value,
    });
  }
  line.append(
    el(doc, "span", { className: "ppx-field-label", text: label }),
    valueEl,
  );
  return line;
}

export function renderEditableStatusField(
  doc: Document,
  label: string,
  draftValue: string,
  originalValue: string,
  options: Array<{ value: string; label: string; disabled?: boolean }>,
  disabled: boolean,
  onChange: (value: string) => void,
) {
  const modified = (draftValue || originalValue) !== originalValue;
  const line = el(doc, "div", { className: "ppx-field-row ppx-field-row-editable" });
  const select = el(doc, "select", {
    className: `ppx-select${modified ? " is-modified" : ""}`,
  }) as HTMLSelectElement;
  select.disabled = disabled;

  const emptyOption = el(doc, "option", { text: "-" }) as HTMLOptionElement;
  emptyOption.value = "";
  select.appendChild(emptyOption);

  options.forEach((option) => {
    const optionEl = el(doc, "option", { text: option.label }) as HTMLOptionElement;
    optionEl.value = option.value;
    optionEl.disabled = Boolean(option.disabled);
    if ((draftValue || originalValue) === option.value) {
      optionEl.selected = true;
    }
    select.appendChild(optionEl);
  });

  select.addEventListener("change", () => {
    onChange(select.value);
  });
  line.append(
    el(doc, "span", { className: "ppx-field-label", text: label }),
    select,
  );
  return line;
}

export function createButton(
  doc: Document,
  text: string,
  iconNode: LucideIconNode,
  loading: boolean,
  onClick: () => Promise<void>,
  loadingText: string,
  extraClass = "",
) {
  const button = el(doc, "button", {
    className: `ppx-button ${extraClass}`.trim(),
  }) as HTMLButtonElement;
  button.type = "button";
  button.disabled = loading;
  button.append(
    createLucideIcon(doc, iconNode, {
      width: 14,
      height: 14,
    }),
    el(doc, "span", {
      text: loading ? loadingText : text,
    }),
  );
  button.addEventListener("click", async () => onClick());
  return button;
}

export function createCollapsibleCard(
  doc: Document,
  title: string,
  open = false,
) {
  const details = el(doc, "details", { className: "ppx-card" }) as HTMLDetailsElement;
  details.open = open;

  const summary = el(doc, "summary", {
    className: "ppx-card-summary",
    text: title,
  });
  const content = el(doc, "div", { className: "ppx-card-content" });
  details.append(summary, content);
  return {
    root: details,
    content,
  };
}

export function createInlineField(doc: Document, label: string, value: string) {
  const line = el(doc, "div", { className: "ppx-inline-field" });
  const labelEl = el(doc, "span", {
    className: "ppx-inline-label",
    text: label,
  });
  const valueEl = el(doc, "span", { className: "ppx-markdown" });
  renderMarkdownWithKatex(doc, valueEl, value);
  line.append(labelEl, valueEl);
  return line;
}

export function createParagraphField(
  doc: Document,
  label: string,
  value: string,
) {
  return createInlineField(doc, label, value);
}

export function createCodeField(doc: Document, label: string, value: string) {
  const line = el(doc, "div", { className: "ppx-code-field" });
  const labelEl = el(doc, "div", {
    className: "ppx-code-label",
    text: label,
  });
  const pre = el(doc, "pre", {
    className: "ppx-code-block",
    text: value,
  });
  line.append(labelEl, pre);
  return line;
}

export function createTagField(doc: Document, label: string, tags: string[]) {
  const line = el(doc, "div", { className: "ppx-inline-field" });
  line.appendChild(
    el(doc, "span", {
      className: "ppx-inline-label",
      text: label,
    }),
  );

  const wrap = el(doc, "div", { className: "ppx-tag-list" });
  const safeTags = tags.filter((tag) => !!tag?.trim());
  if (!safeTags.length) {
    wrap.appendChild(el(doc, "span", { text: "-" }));
  } else {
    safeTags.forEach((tag) => {
      wrap.appendChild(
        el(doc, "span", {
          className: "ppx-tag",
          text: tag,
        }),
      );
    });
  }
  line.appendChild(wrap);
  return line;
}

export function appendCitedField(
  section: HTMLDivElement,
  doc: Document,
  label: string,
  cited?: CitedText,
) {
  if (!cited) {
    section.appendChild(createInlineField(doc, label, "-"));
    return;
  }

  const field = createCollapsibleCard(doc, label, false);
  field.content.appendChild(
    createParagraphField(
      doc,
      getString("paper-panel-label-summary"),
      cited.text || "-",
    ),
  );

  if (!cited.citations?.length) {
    section.appendChild(field.root);
    return;
  }

  const citeDetails = createCollapsibleCard(
    doc,
    getString("paper-panel-label-citations", {
      args: { count: cited.citations.length },
    }),
    false,
  );
  cited.citations.forEach((citation, idx) => {
    const citeItem = el(doc, "div", { className: "ppx-citation-item" });
    citeItem.append(
      el(doc, "div", {
        className: "ppx-citation-head",
        text: `#${idx + 1} ${citation.source_header || "unknown"}`,
      }),
      createQuoteButton(doc, citation.quote || ""),
    );
    citeDetails.content.appendChild(citeItem);
  });

  field.content.appendChild(citeDetails.root);
  section.appendChild(field.root);
}

export function renderMarkdownWithKatex(
  doc: Document,
  container: HTMLElement,
  markdownText: string,
) {
  const source = (markdownText || "-").trim();
  try {
    const mathTokens: string[] = [];
    const processed = source
      .replace(/\$\$([\s\S]+?)\$\$/g, (_match, expr: string) => {
        const token = `@@PPX_MATH_${mathTokens.length}@@`;
        mathTokens.push(
          katex.renderToString(expr.trim(), {
            throwOnError: false,
            displayMode: true,
            output: "mathml",
          }),
        );
        return token;
      })
      .replace(/(^|[^\\])\$(.+?)\$/g, (_match, prefix: string, expr: string) => {
        const token = `@@PPX_MATH_${mathTokens.length}@@`;
        mathTokens.push(
          katex.renderToString(expr.trim(), {
            throwOnError: false,
            displayMode: false,
            output: "mathml",
          }),
        );
        return `${prefix}${token}`;
      });

    const parsed = marked.parse(processed, {
      gfm: true,
      breaks: true,
      async: false,
    });
    let html = typeof parsed === "string" ? parsed : source;
    mathTokens.forEach((mathHTML, idx) => {
      html = html.replaceAll(`@@PPX_MATH_${idx}@@`, mathHTML);
    });
    container.innerHTML = html;
    (
      Array.from(
        container.querySelectorAll<HTMLParagraphElement>("p"),
      ) as HTMLParagraphElement[]
    ).forEach((p) => {
      p.classList.add("ppx-paragraph");
    });
  } catch (error) {
    ztoolkit.log("Paper panel markdown render failed", error);
    container.textContent = source;
  }
}

export function formatJSON(data: unknown) {
  if (!data) {
    return "-";
  }
  try {
    return JSON.stringify(data);
  } catch (_error) {
    return String(data);
  }
}

function createQuoteButton(doc: Document, quote: string) {
  const button = el(doc, "button", {
    className: "ppx-quote-button",
  }) as HTMLButtonElement;
  button.type = "button";
  renderMarkdownWithKatex(doc, button, quote || "-");
  if (!quote.trim()) {
    button.disabled = true;
  } else {
    button.addEventListener("click", () => {
      Zotero.Utilities.Internal.copyTextToClipboard(quote);
      new ztoolkit.ProgressWindow(addon.data.config.addonName)
        .createLine({
          text: getString("paper-panel-copy-text-success"),
          type: "success",
          progress: 100,
        })
        .show();
    });
  }
  return button;
}
