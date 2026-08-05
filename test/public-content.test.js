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

test("허용 목록 밖의 파일 경로를 공개 파일로 허용하지 않는다", () => {
  const files = [
    "notes/private-plan.md",
    ".private/settings.json",
    "INSTRUCTIONS.md",
  ].map((file) => ({ file, content: "" }));

  assert.deepEqual(
    inspectPublicFiles(files),
    files.map(({ file }) => ({ file, reason: "허용되지 않은 파일 경로" })),
  );
});

test("바이너리 파일도 경로 허용 목록 검사를 받는다", () => {
  assert.deepEqual(
    inspectPublicFiles([{ file: "notes/secret.bin", content: null }]),
    [{ file: "notes/secret.bin", reason: "허용되지 않은 파일 경로" }],
  );
  assert.deepEqual(
    inspectPublicFiles([{ file: ".github/assets/demo.gif", content: null }]),
    [],
  );
});

test("법적 금칙어의 대소문자와 구분자 변형을 모두 차단한다", () => {
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
    file: `src/credential-${index}.js`,
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
    { file, reason: "허용되지 않은 파일 경로" },
  ]);
});

test("공개 검사 CLI는 위반 파일이 있으면 실패한다", (context) => {
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
  assert.match(result.stdout, /허용되지 않은 파일 경로/);
});
