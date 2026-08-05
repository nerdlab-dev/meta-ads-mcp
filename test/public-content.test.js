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

test("내부 작업 경로를 공개 파일로 허용하지 않는다", () => {
  const file = ["docs", ["super", "powers"].join(""), "plan.md"].join("/");

  assert.deepEqual(inspectPublicFiles([{ file, content: "" }]), [
    { file, reason: "내부 작업 파일" },
  ]);
});

test("에이전트 설정과 프롬프트 파일 경로를 공개 파일로 허용하지 않는다", () => {
  const files = [
    [[".", "codex"].join(""), "settings.json"].join("/"),
    [[".", "agents"].join(""), "rules.md"].join("/"),
    [[".", "claude"].join(""), "settings.json"].join("/"),
    ["AG", "ENTS.md"].join(""),
    ["CLA", "UDE.md"].join(""),
    ["GEM", "INI.md"].join(""),
    ["docs/design-", "pro", "mpt.md"].join(""),
    ["docs/설계-", "프롬", "프트.md"].join(""),
  ].map((file) => ({ file, content: "" }));

  assert.deepEqual(
    inspectPublicFiles(files),
    files.map(({ file }) => ({ file, reason: "내부 작업 파일" })),
  );
});

test("법적 금칙어의 대소문자와 구분자 변형을 모두 차단한다", () => {
  const variants = [
    ["Pipe", "Board"].join(""),
    ["pipe", "board"].join("-"),
    ["pipe", "board"].join("_"),
    ["pipe", "board"].join(" "),
    ["파이프", "보드"].join(""),
    ["파이프", "보드"].join(" "),
  ];
  const files = variants.map((content, index) => ({
    file: `fixture-${index}.txt`,
    content,
  }));

  assert.deepEqual(
    inspectPublicFiles(files),
    files.map(({ file }) => ({ file, reason: "법적 금칙어" })),
  );
});

test("고위험 자격증명 형식을 공개 파일로 허용하지 않는다", () => {
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
    file: `credential-${index}.txt`,
    content,
  }));

  assert.deepEqual(
    inspectPublicFiles(files),
    files.map(({ file }) => ({ file, reason: "자격증명 의심" })),
  );
});

test("Git이 추적하는 파일만 공개 검사 대상으로 사용한다", (context) => {
  const rootDirectory = mkdtempSync(join(tmpdir(), "public-content-"));
  context.after(() => rmSync(rootDirectory, { force: true, recursive: true }));

  execFileSync("git", ["init", "--quiet"], { cwd: rootDirectory });
  const internalDirectory = join(
    rootDirectory,
    "docs",
    ["super", "powers"].join(""),
  );
  mkdirSync(internalDirectory, { recursive: true });
  writeFileSync(join(internalDirectory, "plan.md"), "internal");
  writeFileSync(
    join(rootDirectory, "untracked.txt"),
    ["pipe", "board"].join(""),
  );
  execFileSync("git", ["add", "docs"], { cwd: rootDirectory });

  const file = ["docs", ["super", "powers"].join(""), "plan.md"].join("/");
  assert.deepEqual(checkPublicContent(rootDirectory), [
    { file, reason: "내부 작업 파일" },
  ]);
});

test("공개 검사 CLI는 위반 파일이 있으면 실패한다", (context) => {
  const rootDirectory = mkdtempSync(join(tmpdir(), "public-content-cli-"));
  context.after(() => rmSync(rootDirectory, { force: true, recursive: true }));

  execFileSync("git", ["init", "--quiet"], { cwd: rootDirectory });
  const internalDirectory = join(
    rootDirectory,
    "docs",
    ["super", "powers"].join(""),
  );
  mkdirSync(internalDirectory, { recursive: true });
  writeFileSync(join(internalDirectory, "plan.md"), "internal");
  execFileSync("git", ["add", "docs"], { cwd: rootDirectory });

  const script = fileURLToPath(
    new URL("../scripts/check-public-content.js", import.meta.url),
  );
  const result = spawnSync(process.execPath, [script], {
    cwd: rootDirectory,
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /내부 작업 파일/);
});
