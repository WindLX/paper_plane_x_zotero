import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const manifestPath = resolve(testDirectory, "../addon/manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const zotero = manifest.applications?.zotero;

assert.equal(zotero?.strict_min_version, "6.999");
assert.equal(zotero?.strict_max_version, "10.*");
