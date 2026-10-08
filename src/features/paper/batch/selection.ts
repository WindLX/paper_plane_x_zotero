/**
 * Zotero's item menu supplies the selection through the menu context; the
 * explicit ZoteroPane API is only used when a caller has no menu context, so an
 * empty menu selection stays empty instead of falling back to another window.
 */
export function getSelectedRegularItems(items?: Zotero.Item[]): Zotero.Item[] {
  const source = items ?? Zotero.getActiveZoteroPane().getSelectedItems();
  return source.filter((item) => item.isRegularItem());
}
