/**
 * Create a Lucide SVG icon element for use in Zotero's document context.
 *
 * Since lucide's built-in createElement relies on the global `document`,
 * which may not exist in the bootstrap sandbox, we re-implement it here
 * accepting an explicit `doc` parameter.
 */

const defaultAttributes: Record<string, string | number> = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": 2,
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
};

type IconNode = Array<string | Record<string, unknown>>;

function createSVGElement(
  doc: Document,
  tag: string,
  attrs: Record<string, unknown>,
  children?: IconNode[],
) {
  const element = doc.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.keys(attrs).forEach((name) => {
    element.setAttribute(name, String(attrs[name]));
  });
  if (children?.length) {
    children.forEach((child) => {
      const childTag = child[0] as string;
      const childAttrs = (child[1] as Record<string, unknown>) || {};
      const childChildren = child.slice(2) as unknown as IconNode[] | undefined;
      const childElement = createSVGElement(
        doc,
        childTag,
        childAttrs,
        childChildren,
      );
      element.appendChild(childElement);
    });
  }
  return element;
}

export function createLucideIcon(
  doc: Document,
  iconNode: IconNode[],
  customAttrs: Record<string, string | number> = {},
) {
  const attrs = {
    ...defaultAttributes,
    ...customAttrs,
  };
  return createSVGElement(doc, "svg", attrs, iconNode);
}
