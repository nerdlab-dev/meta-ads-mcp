import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ALLOWED_FILES = new Set([
  ".github/assets/demo.gif",
  ".github/assets/header.svg",
  ".github/workflows/ci.yml",
  ".gitignore",
  "LICENSE",
  "README.md",
  "package.json",
  "scripts/check-public-content.js",
]);
const ALLOWED_DIRECTORIES = ["bin/", "src/", "test/"];
const englishLegalTerm = [
  String.fromCodePoint(112, 105, 112, 101),
  String.fromCodePoint(98, 111, 97, 114, 100),
].join("[\\s_-]*");
const koreanLegalTerm = [
  String.fromCodePoint(54028, 51060, 54532),
  String.fromCodePoint(48372, 46300),
].join("[\\s_-]*");
const LEGAL_TERMS = [
  new RegExp(englishLegalTerm, "i"),
  new RegExp(koreanLegalTerm),
];
const CREDENTIAL_PATTERNS = [
  new RegExp(["-----BEGIN ", "(?:[A-Z]+ )?PRIVATE KEY-----"].join("")),
  /\bghp_[A-Za-z0-9]{30,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{30,}\b/,
  /\bnpm_[A-Za-z0-9]{30,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /(?:password|passwd|client[_-]?secret|api[_-]?key)\s*[:=]\s*["']?[^\s"']{8,}/i,
];

export function inspectPublicFiles(files) {
  return files.flatMap(({ file, content }) => {
    if (
      !ALLOWED_FILES.has(file) &&
      !ALLOWED_DIRECTORIES.some((directory) => file.startsWith(directory))
    ) {
      return [{ file, reason: "Disallowed file path" }];
    }

    if (content === null) {
      return [];
    }

    if (LEGAL_TERMS.some((pattern) => pattern.test(content))) {
      return [{ file, reason: "Prohibited legal term" }];
    }

    if (CREDENTIAL_PATTERNS.some((pattern) => pattern.test(content))) {
      return [{ file, reason: "Suspected credential" }];
    }

    return [];
  });
}

export function checkPublicContent(rootDirectory) {
  const trackedFiles = execFileSync("git", ["ls-files", "-z"], {
    cwd: rootDirectory,
  })
    .toString("utf8")
    .split("\0")
    .filter(Boolean);

  // Binary files skip only the content checks; the path check still applies.
  const files = trackedFiles.map((file) => {
    const buffer = readFileSync(join(rootDirectory, file));
    return {
      file,
      content: buffer.includes(0) ? null : buffer.toString("utf8"),
    };
  });

  return inspectPublicFiles(files);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const violations = checkPublicContent(process.cwd());
  for (const { file, reason } of violations) {
    console.log(`${reason}: ${file}`);
  }
  process.exitCode = violations.length === 0 ? 0 : 1;
}
