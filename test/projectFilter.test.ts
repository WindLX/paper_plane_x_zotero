/// <reference types="mocha" />

import { assert } from "chai";
import { ProjectResponse } from "../src/domain/paper";
import { filterProjects } from "../src/features/paper/link/projectFilter";

function project(
  projectID: string,
  name: string,
  description: string | null,
): ProjectResponse {
  return {
    project_id: projectID,
    name,
    description,
    agent_summary: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-02",
    conversation_count: 0,
  };
}

const projects = [
  project("prj-transformer", "Attention Models", "Sequence modeling"),
  project("prj-control", "Robust Control", "MPC-based recovery"),
  project("SPECIAL-ID", "Untitled Work", null),
];

describe("project picker filtering", function () {
  it("returns all projects for an empty query", function () {
    assert.deepEqual(filterProjects(projects, "   "), projects);
  });

  it("searches project titles case-insensitively", function () {
    assert.deepEqual(filterProjects(projects, "attention"), [projects[0]]);
  });

  it("searches project descriptions", function () {
    assert.deepEqual(filterProjects(projects, "MPC-based"), [projects[1]]);
  });

  it("searches project IDs case-insensitively", function () {
    assert.deepEqual(filterProjects(projects, "special-id"), [projects[2]]);
  });

  it("matches multiple terms across title and description", function () {
    assert.deepEqual(filterProjects(projects, "robust recovery"), [
      projects[1],
    ]);
  });
});
