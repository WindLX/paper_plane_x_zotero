export interface ProjectCollectionTarget {
  libraryID: number;
  collectionID: number;
}

export type ProjectCollectionMap = Record<string, ProjectCollectionTarget>;

export function parseProjectCollectionMap(raw: string): ProjectCollectionMap {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (_error) {
    return {};
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const mapping: ProjectCollectionMap = {};
  for (const [projectID, target] of Object.entries(value)) {
    const record = target as Record<string, unknown>;
    if (
      projectID &&
      target &&
      typeof target === "object" &&
      !Array.isArray(target) &&
      typeof record.libraryID === "number" &&
      typeof record.collectionID === "number"
    ) {
      mapping[projectID] = {
        libraryID: record.libraryID,
        collectionID: record.collectionID,
      };
    }
  }
  return mapping;
}

export function mapProjectToCollection(
  mapping: ProjectCollectionMap,
  projectID: string,
  target: ProjectCollectionTarget,
): ProjectCollectionMap {
  return { ...mapping, [projectID]: target };
}

export function findProjectsMappedToCollection(
  mapping: ProjectCollectionMap,
  target: ProjectCollectionTarget,
): string[] {
  return Object.entries(mapping)
    .filter(
      ([, current]) =>
        current.libraryID === target.libraryID &&
        current.collectionID === target.collectionID,
    )
    .map(([projectID]) => projectID)
    .sort();
}

export function removeProjectsMappedToCollection(
  mapping: ProjectCollectionMap,
  target: ProjectCollectionTarget,
): ProjectCollectionMap {
  const next = { ...mapping };
  findProjectsMappedToCollection(mapping, target).forEach((projectID) => {
    delete next[projectID];
  });
  return next;
}
