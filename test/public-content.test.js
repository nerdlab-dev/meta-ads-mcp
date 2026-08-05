import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  checkPublicContent,
  inspectPublicFiles,
} from "../scripts/check-public-content.js";

test("rejects file paths outside the allowlist", () => {
  const files = [
    "notes/private-plan.md",
    ".private/settings.json",
    "INSTRUCTIONS.md",
  ].map((file) => ({ file, content: "" }));

  assert.deepEqual(
    inspectPublicFiles(files),
    files.map(({ file }) => ({ file, reason: "Disallowed file path" })),
  );
});

test("applies the path allowlist to binary files too", () => {
  assert.deepEqual(
    inspectPublicFiles([{ file: "notes/secret.bin", content: null }]),
    [{ file: "notes/secret.bin", reason: "Disallowed file path" }],
  );
  assert.deepEqual(
    inspectPublicFiles([{ file: ".github/assets/demo.gif", content: null }]),
    [],
  );
});

test("blocks case and separator variants of prohibited legal terms", () => {
  const english = String.fromCodePoint(112, 105, 112, 101, 98, 111, 97, 114, 100);
  const korean = String.fromCodePoint(54028, 51060, 54532, 48372, 46300);
  const variants = [
    english,
    `${english.slice(0, 4)}-${english.slice(4)}`,
    `${english.slice(0, 4)}_${english.slice(4)}`,
    `${english.slice(0, 4)} ${english.slice(4)}`,
    korean,
    `${korean.slice(0, 3)} ${korean.slice(3)}`,
  ];
  const files = variants.map((content, index) => ({
    file: `src/fixture-${index}.js`,
    content,
  }));

  assert.deepEqual(
    inspectPublicFiles(files),
    files.map(({ file }) => ({ file, reason: "Prohibited legal term" })),
  );
});

test("rejects high-risk credential formats in public files", () => {
  const credentials = [
    ["-----BEGIN ", "PRIVATE KEY-----"].join(""),
    ["ghp_", "a".repeat(36)].join(""),
    ["github_pat_", "b".repeat(40)].join(""),
    ["npm_", "c".repeat(36)].join(""),
    ["sk-", "d".repeat(40)].join(""),
    ["password", "company-secret-value"].join("="),
    ["client_secret", "company-secret-value"].join("="),
  ];
  const files = credentials.map((content, index) => ({
    file: `src/credential-${index}.js`,
    content,
  }));

  assert.deepEqual(
    inspectPublicFiles(files),
    files.map(({ file }) => ({ file, reason: "Suspected credential" })),
  );
});

test("inspects only files tracked by Git", (context) => {
  const rootDirectory = mkdtempSync(join(tmpdir(), "public-content-"));
  context.after(() => rmSync(rootDirectory, { force: true, recursive: true }));

  execFileSync("git", ["init", "--quiet"], { cwd: rootDirectory });
  const internalDirectory = join(rootDirectory, "notes");
  mkdirSync(internalDirectory, { recursive: true });
  writeFileSync(join(internalDirectory, "private-plan.md"), "internal");
  writeFileSync(
    join(rootDirectory, "untracked.txt"),
    String.fromCodePoint(112, 105, 112, 101, 98, 111, 97, 114, 100),
  );
  execFileSync("git", ["add", "notes"], { cwd: rootDirectory });

  const file = "notes/private-plan.md";
  assert.deepEqual(checkPublicContent(rootDirectory), [
    { file, reason: "Disallowed file path" },
  ]);
});

test("public-content CLI fails when a violation exists", (context) => {
  const rootDirectory = mkdtempSync(join(tmpdir(), "public-content-cli-"));
  context.after(() => rmSync(rootDirectory, { force: true, recursive: true }));

  execFileSync("git", ["init", "--quiet"], { cwd: rootDirectory });
  const internalDirectory = join(rootDirectory, "notes");
  mkdirSync(internalDirectory, { recursive: true });
  writeFileSync(join(internalDirectory, "private-plan.md"), "internal");
  execFileSync("git", ["add", "notes"], { cwd: rootDirectory });

  const script = fileURLToPath(
    new URL("../scripts/check-public-content.js", import.meta.url),
  );
  const result = spawnSync(process.execPath, [script], {
    cwd: rootDirectory,
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /Disallowed file path/);
});
