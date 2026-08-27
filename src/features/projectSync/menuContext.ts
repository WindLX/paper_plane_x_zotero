export interface CollectionMenuContext<Row> {
  collectionTreeRows?: readonly Row[];
  collectionTreeRow?: Row;
}

export function getSingleCollectionMenuRow<Row>(
  context: CollectionMenuContext<Row>,
): Row | undefined {
  // Zotero 10 exposes the plural property and deliberately keeps a throwing
  // getter under the old singular name. Check property presence before reading
  // either value so the Zotero 7 fallback cannot trigger that getter.
  if ("collectionTreeRows" in context) {
    const rows = context.collectionTreeRows;
    return rows?.length === 1 ? rows[0] : undefined;
  }
  return context.collectionTreeRow;
}
