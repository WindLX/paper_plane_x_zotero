import { ProjectResponse } from "@/domain/paper";

export function filterProjects(
  projects: ProjectResponse[],
  query: string,
): ProjectResponse[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return projects;
  }

  const queryTokens = normalizedQuery.split(/\s+/);
  return projects.filter((project) => {
    const searchableText = [
      project.name,
      project.description,
      project.project_id,
    ]
      .map((value) => normalizeSearchText(value || ""))
      .join(" ");
    return queryTokens.every((token) => searchableText.includes(token));
  });
}

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase();
}
