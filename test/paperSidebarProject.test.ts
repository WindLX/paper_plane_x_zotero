/// <reference types="mocha" />

import { assert } from "chai";
import {
  createPaperApiClient,
  PaperDetailResponse,
  ProjectResponse,
} from "../src/domain/paper";
import { createPaperSidebarStore } from "../src/features/paper/sidebar/store";
import { createPaperSidebarViewModel } from "../src/features/paper/sidebar/viewModel";
import { renderProjectAssociationPanel } from "../src/features/paper/sidebar/components/panels";
import { renderPaperSidebar } from "../src/features/paper/sidebar/view";

const project: ProjectResponse = {
  project_id: "prj-sidebar-test",
  name: "Synthetic project",
  description: null,
  agent_summary: null,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  conversation_count: 0,
};

function setup(paperID = "pap-sidebar-test") {
  const writes: string[][] = [];
  const item = {
    id: 91001,
    isRegularItem: () => true,
    getField: (field: string) =>
      field === "extra"
        ? `citation-key: preserved\npaper_plane_id: ${paperID}`
        : "",
  } as unknown as Zotero.Item;
  const detail: PaperDetailResponse = {
    paper_id: paperID,
    authors: [],
    extraction_status: "COMPLETED",
    extraction_fact_check_status: "PASSED",
    analysis_fact_check_status: "PASSED",
    extraction_retry_count: 0,
    analysis_retry_count: 0,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    projects: [{ project_id: project.project_id, name: project.name }],
  };
  const apiClient = {
    ...createPaperApiClient(),
    async listProjects() {
      return { items: [project], total: 1, offset: 0, limit: 100 };
    },
    async linkProject(projectID: string, linkedPaperID: string) {
      writes.push([projectID, linkedPaperID]);
      return { message: "linked" };
    },
    async fetchDetail() {
      return detail;
    },
  };
  return { item, apiClient, writes };
}

describe("paper sidebar project linking", function () {
  // Unit bundles run in the tester window. Supply the installed plugin's real
  // host context for localization and notices, rather than replacing either.
  const scope = globalThis as typeof globalThis & {
    addon?: typeof addon;
    ztoolkit?: typeof ztoolkit;
  };
  let originalAddon: typeof addon | undefined;
  let originalToolkit: typeof ztoolkit | undefined;

  before(function () {
    originalAddon = scope.addon;
    originalToolkit = scope.ztoolkit;
    scope.addon = (
      Zotero as typeof Zotero & { PaperPlaneX: typeof addon }
    ).PaperPlaneX;
    scope.ztoolkit = scope.addon.data.ztoolkit;
  });

  after(function () {
    scope.addon = originalAddon;
    scope.ztoolkit = originalToolkit;
  });

  it("uses the shared picker and refreshes the associated projects", async function () {
    const { item, apiClient, writes } = setup();
    const store = createPaperSidebarStore(item, {
      apiClient,
      async pickProject(projects, count) {
        assert.deepEqual(projects, [project]);
        assert.equal(count, 1);
        return project;
      },
    });
    await createPaperSidebarViewModel(store).actions.selectProject();
    assert.deepEqual(writes, [[project.project_id, "pap-sidebar-test"]]);
    assert.equal(store.getState().projects[0].name, project.name);
    assert.equal(store.getState().actions.link.status, "success");
    assert.include(item.getField("extra"), "citation-key: preserved");
  });

  it("keeps manual ID linking without fetching projects or opening a picker", async function () {
    const { item, apiClient, writes } = setup();
    const store = createPaperSidebarStore(item, {
      apiClient: {
        ...apiClient,
        async listProjects() {
          throw new Error("unexpected project list");
        },
      },
      async pickProject() {
        throw new Error("unexpected picker");
      },
    });
    store.updateDraft("projectIDInput", "  prj-manual  ");
    await createPaperSidebarViewModel(store).actions.linkProject();
    assert.deepEqual(writes, [["prj-manual", "pap-sidebar-test"]]);
    assert.equal(store.getState().draft.projectIDInput, "");
  });

  it("cancels without writing or clearing the manual draft", async function () {
    const { item, apiClient, writes } = setup();
    const store = createPaperSidebarStore(item, {
      apiClient,
      async pickProject() {
        return null;
      },
    });
    store.updateDraft("projectIDInput", "prj-draft");
    await store.linkProject("picker");
    assert.isEmpty(writes);
    assert.equal(store.getState().draft.projectIDInput, "prj-draft");
    assert.equal(store.getState().actions.link.status, "idle");
  });

  it("shows list failures and can retry", async function () {
    const { item, apiClient, writes } = setup();
    let failed = true;
    const store = createPaperSidebarStore(item, {
      apiClient: {
        ...apiClient,
        async listProjects() {
          if (failed) throw new Error("synthetic list error");
          return apiClient.listProjects();
        },
      },
      async pickProject() {
        return project;
      },
    });
    await store.linkProject("picker");
    assert.equal(store.getState().actions.link.status, "error");
    assert.include(
      store.getState().actions.link.error || "",
      "synthetic list error",
    );
    failed = false;
    await store.linkProject("picker");
    assert.lengthOf(writes, 1);
  });

  it("does not bind after the sidebar is detached, and prevents duplicate dialogs", async function () {
    const { item, apiClient, writes } = setup();
    let active = true;
    let calls = 0;
    let finish!: (value: ProjectResponse) => void;
    const store = createPaperSidebarStore(item, {
      apiClient,
      isActive: () => active,
      async pickProject() {
        calls++;
        return new Promise<ProjectResponse>((resolve) => {
          finish = resolve;
        });
      },
    });
    const first = store.linkProject("picker");
    await Promise.resolve();
    await store.linkProject("picker");
    assert.equal(calls, 1);
    active = false;
    finish(project);
    await first;
    assert.isEmpty(writes);
    assert.equal(store.getState().actions.link.status, "idle");
  });

  it("handles an empty project list without showing a picker", async function () {
    const { item, apiClient, writes } = setup();
    const store = createPaperSidebarStore(item, {
      apiClient: {
        ...apiClient,
        async listProjects() {
          return { items: [], total: 0, offset: 0, limit: 100 };
        },
      },
      async pickProject() {
        throw new Error("unexpected picker");
      },
    });
    await store.linkProject("picker");
    assert.isEmpty(writes);
    assert.equal(store.getState().actions.link.status, "idle");
  });

  it("keeps manual input open and focused across draft updates", function () {
    const { item } = setup();
    const store = createPaperSidebarStore(item);
    const doc = Zotero.getMainWindow().document;
    const mount = doc.createElement("div");
    doc.documentElement.appendChild(mount);
    const render = () =>
      renderPaperSidebar(mount, createPaperSidebarViewModel(store));
    const unsubscribe = store.subscribe(render);
    try {
      render();
      mount.querySelector<HTMLDetailsElement>(".ppx-project-manual")!.open =
        true;
      const input = mount.querySelector<HTMLInputElement>(
        ".ppx-project-manual input",
      )!;
      input.focus();
      input.value = "prj-manual";
      input.setSelectionRange(4, 7);
      store.updateDraft("projectIDInput", input.value);
      const next = mount.querySelector<HTMLInputElement>(
        ".ppx-project-manual input",
      )!;
      assert.isTrue(
        mount.querySelector<HTMLDetailsElement>(".ppx-project-manual")!.open,
      );
      assert.equal(next.value, "prj-manual");
      assert.equal(doc.activeElement, next);
      assert.equal(next.selectionStart, 4);
      assert.equal(next.selectionEnd, 7);
    } finally {
      unsubscribe();
      mount.remove();
    }
  });

  it("disables both entry points until the paper has a binding", function () {
    const { item } = setup("");
    const store = createPaperSidebarStore(item);
    const doc = Zotero.getMainWindow().document;
    const panel = renderProjectAssociationPanel(
      doc,
      createPaperSidebarViewModel(store),
    );
    const buttons = panel.querySelectorAll<HTMLButtonElement>("button");
    assert.lengthOf(buttons, 2);
    assert.isTrue(Array.from(buttons).every((button) => button.disabled));
    assert.isFalse(
      panel.querySelector<HTMLDetailsElement>(".ppx-project-manual")!.open,
    );
    assert.isNotEmpty(
      panel.querySelector("input")!.getAttribute("aria-label")!,
    );
  });
});
