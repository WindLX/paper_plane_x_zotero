export function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  options: {
    className?: string;
    text?: string;
    attrs?: Record<string, string>;
  } = {},
) {
  const node = doc.createElement(tag);
  if (options.className) {
    node.className = options.className;
  }
  if (typeof options.text === "string") {
    node.textContent = options.text;
  }
  Object.entries(options.attrs || {}).forEach(([key, value]) => {
    node.setAttribute(key, value);
  });
  return node;
}
