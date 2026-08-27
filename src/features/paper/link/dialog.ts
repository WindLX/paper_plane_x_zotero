import { Check, FolderKanban, Link, Search, X } from "lucide";
import { ProjectResponse } from "@/domain/paper";
import { registerDialogStyles } from "@/shared/ui/dialogStyle";
import { createLucideIcon } from "@/shared/ui/icon/lucide";
import { getString } from "@/utils/locale";
import { filterProjects } from "./projectFilter";

export async function openProjectPickerDialog(
  projects: ProjectResponse[],
  selectedItemCount: number | null,
  options: {
    initialProjectID?: string;
    title?: string;
    prompt?: string;
    confirmLabel?: string;
  } = {},
): Promise<ProjectResponse | null> {
  const dialogHelper: any = new ztoolkit.Dialog(1, 1);
  let selectedProjectID = options.initialProjectID || "";
  let result: ProjectResponse | null = null;

  const dialogData: {
    loadCallback: () => void;
    unloadCallback: () => void;
    unloadLock?: { promise: Promise<void>; resolve: () => void };
  } = {
    loadCallback: () => {
      const doc = dialogHelper.window?.document as Document | undefined;
      if (!doc) {
        return;
      }
      registerDialogStyles(doc);
      decorateStaticContent(doc, selectedItemCount, options);

      const input = doc.getElementById(
        "ppx-project-picker-search",
      ) as HTMLInputElement | null;
      const clearButton = doc.getElementById(
        "ppx-project-picker-clear",
      ) as HTMLButtonElement | null;
      const cancelButton = doc.getElementById(
        "ppx-project-picker-cancel",
      ) as HTMLButtonElement | null;
      const confirmButton = doc.getElementById(
        "ppx-project-picker-confirm",
      ) as HTMLButtonElement | null;

      if (!input || !clearButton || !cancelButton || !confirmButton) {
        return;
      }

      const render = () => {
        const filteredProjects = filterProjects(projects, input.value);
        if (
          selectedProjectID &&
          !filteredProjects.some(
            (project) => project.project_id === selectedProjectID,
          )
        ) {
          selectedProjectID = "";
        }
        renderProjectList(
          doc,
          projects,
          filteredProjects,
          selectedProjectID,
          (projectID) => {
            selectedProjectID = projectID;
            render();
            findProjectCard(doc, selectedProjectID)?.focus();
          },
        );
        clearButton.hidden = !input.value;
        confirmButton.disabled = !selectedProjectID;
      };

      input.addEventListener("input", render);
      input.addEventListener("keydown", (event) => {
        const filteredProjects = filterProjects(projects, input.value);
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const currentIndex = filteredProjects.findIndex(
            (project) => project.project_id === selectedProjectID,
          );
          const direction = event.key === "ArrowDown" ? 1 : -1;
          const fallbackIndex = direction > 0 ? 0 : filteredProjects.length - 1;
          const nextIndex =
            currentIndex < 0
              ? fallbackIndex
              : (currentIndex + direction + filteredProjects.length) %
                filteredProjects.length;
          const nextProject = filteredProjects[nextIndex];
          if (nextProject) {
            selectedProjectID = nextProject.project_id;
            render();
            findProjectCard(doc, selectedProjectID)?.scrollIntoView({
              block: "nearest",
            });
          }
        } else if (event.key === "Enter" && selectedProjectID) {
          event.preventDefault();
          confirmButton.click();
        }
      });
      clearButton.addEventListener("click", () => {
        input.value = "";
        input.focus();
        render();
      });
      cancelButton.addEventListener("click", () => {
        dialogHelper.window?.close();
      });
      confirmButton.addEventListener("click", () => {
        result =
          projects.find(
            (project) => project.project_id === selectedProjectID,
          ) || null;
        if (result) {
          dialogHelper.window?.close();
        }
      });
      dialogHelper.window?.addEventListener(
        "keydown",
        (event: KeyboardEvent) => {
          if (event.key === "Escape") {
            event.preventDefault();
            dialogHelper.window?.close();
          }
        },
      );

      render();
      input.focus();
    },
    unloadCallback: () => {
      addon.data.dialog = undefined;
    },
  };

  dialogHelper
    .addCell(0, 0, {
      tag: "div",
      namespace: "html",
      classList: ["ppx-project-picker"],
      children: [
        {
          tag: "div",
          namespace: "html",
          id: "ppx-project-picker-header",
        },
        {
          tag: "div",
          namespace: "html",
          id: "ppx-project-picker-search-wrap",
          children: [
            {
              tag: "span",
              namespace: "html",
              id: "ppx-project-picker-search-icon",
            },
            {
              tag: "input",
              namespace: "html",
              id: "ppx-project-picker-search",
              attributes: {
                type: "search",
                autocomplete: "off",
                placeholder: getString("link-search-placeholder"),
                "aria-label": getString("link-search-placeholder"),
              },
            },
            {
              tag: "button",
              namespace: "html",
              id: "ppx-project-picker-clear",
              attributes: {
                type: "button",
                title: getString("link-search-clear"),
                "aria-label": getString("link-search-clear"),
              },
            },
          ],
        },
        {
          tag: "div",
          namespace: "html",
          id: "ppx-project-picker-meta",
        },
        {
          tag: "div",
          namespace: "html",
          id: "ppx-project-picker-list",
          attributes: {
            role: "listbox",
            "aria-label": getString("link-select-project-title"),
          },
        },
        {
          tag: "div",
          namespace: "html",
          id: "ppx-project-picker-actions",
          children: [
            actionButton("ppx-project-picker-cancel"),
            actionButton("ppx-project-picker-confirm"),
          ],
        },
      ],
    })
    .setDialogData(dialogData as any)
    .open(options.title || getString("link-select-project-title"), {
      width: 720,
      height: 680,
      centerscreen: true,
      resizable: true,
      fitContent: false,
      noDialogMode: true,
    });

  addon.data.dialog = dialogHelper;
  await dialogData.unloadLock?.promise;
  return result;
}

function renderProjectList(
  doc: Document,
  allProjects: ProjectResponse[],
  projects: ProjectResponse[],
  selectedProjectID: string,
  onSelect: (projectID: string) => void,
) {
  const meta = doc.getElementById("ppx-project-picker-meta");
  const list = doc.getElementById("ppx-project-picker-list");
  if (!meta || !list) {
    return;
  }

  meta.textContent = getString("link-results-count", {
    args: { visible: projects.length, total: allProjects.length },
  });
  list.replaceChildren();

  if (!projects.length) {
    const empty = doc.createElement("div");
    empty.className = "ppx-project-picker-empty";
    empty.append(
      createLucideIcon(doc, Search, { width: 24, height: 24 }),
      createTextElement(doc, "strong", getString("link-no-search-results")),
      createTextElement(doc, "span", getString("link-no-search-results-hint")),
    );
    list.appendChild(empty);
    return;
  }

  projects.forEach((project) => {
    const selected = project.project_id === selectedProjectID;
    const card = doc.createElement("button");
    card.type = "button";
    card.className = `ppx-project-picker-card${selected ? " is-selected" : ""}`;
    card.dataset.projectId = project.project_id;
    card.setAttribute("role", "option");
    card.setAttribute("aria-selected", String(selected));

    const icon = doc.createElement("span");
    icon.className = "ppx-project-picker-folder";
    icon.appendChild(
      createLucideIcon(doc, selected ? Check : FolderKanban, {
        width: 18,
        height: 18,
      }),
    );

    const content = doc.createElement("span");
    content.className = "ppx-project-picker-card-content";
    content.append(
      createTextElement(
        doc,
        "strong",
        project.name || getString("link-project-untitled"),
      ),
      createTextElement(
        doc,
        "span",
        project.description || getString("link-project-description-empty"),
        "ppx-project-picker-description",
      ),
      createTextElement(
        doc,
        "code",
        project.project_id,
        "ppx-project-picker-id",
      ),
    );

    card.append(icon, content);
    card.addEventListener("click", () => onSelect(project.project_id));
    list.appendChild(card);
  });
}

function findProjectCard(doc: Document, projectID: string) {
  return (
    Array.from(doc.querySelectorAll("[data-project-id]")) as HTMLElement[]
  ).find((element) => element.dataset.projectId === projectID);
}

function decorateStaticContent(
  doc: Document,
  selectedItemCount: number | null,
  options: {
    title?: string;
    prompt?: string;
    confirmLabel?: string;
  },
) {
  const header = doc.getElementById("ppx-project-picker-header");
  const searchIcon = doc.getElementById("ppx-project-picker-search-icon");
  const clearButton = doc.getElementById("ppx-project-picker-clear");
  const cancelButton = doc.getElementById("ppx-project-picker-cancel");
  const confirmButton = doc.getElementById("ppx-project-picker-confirm");
  if (
    !header ||
    !searchIcon ||
    !clearButton ||
    !cancelButton ||
    !confirmButton
  ) {
    return;
  }

  const titleRow = doc.createElement("div");
  titleRow.className = "ppx-project-picker-title-row";
  const titleIcon = doc.createElement("span");
  titleIcon.className = "ppx-project-picker-title-icon";
  titleIcon.appendChild(
    createLucideIcon(doc, FolderKanban, { width: 20, height: 20 }),
  );
  const titleText = doc.createElement("div");
  titleText.append(
    createTextElement(
      doc,
      "h1",
      options.title || getString("link-select-project-title"),
    ),
    createTextElement(
      doc,
      "p",
      options.prompt || getString("link-select-project-prompt"),
    ),
  );
  titleRow.append(titleIcon, titleText);
  header.append(titleRow);
  if (selectedItemCount !== null) {
    header.append(
      createTextElement(
        doc,
        "span",
        getString("link-selected-items-count", {
          args: { count: selectedItemCount },
        }),
        "ppx-chip ppx-project-picker-count",
      ),
    );
  }

  searchIcon.appendChild(
    createLucideIcon(doc, Search, { width: 16, height: 16 }),
  );
  clearButton.appendChild(createLucideIcon(doc, X, { width: 15, height: 15 }));
  decorateButton(doc, cancelButton, X, getString("paper-panel-action-cancel"));
  decorateButton(
    doc,
    confirmButton,
    Link,
    options.confirmLabel || getString("link-action-confirm"),
  );
}

function decorateButton(
  doc: Document,
  button: HTMLElement,
  icon: Parameters<typeof createLucideIcon>[1],
  label: string,
) {
  button.className = `ppx-button${
    button.id === "ppx-project-picker-confirm" ? " is-primary" : ""
  }`;
  button.append(
    createLucideIcon(doc, icon, { width: 14, height: 14 }),
    doc.createTextNode(label),
  );
}

function createTextElement(
  doc: Document,
  tag: "h1" | "p" | "span" | "strong" | "code",
  text: string,
  className?: string,
) {
  const element = doc.createElement(tag);
  element.textContent = text;
  if (className) {
    element.className = className;
  }
  return element;
}

function actionButton(id: string) {
  return {
    tag: "button",
    namespace: "html",
    id,
    attributes: { type: "button" },
  };
}
