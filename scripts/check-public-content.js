import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const INTERNAL_DIRECTORY = ["docs", ["super", "powers"].join("")].join("/");
const LEGAL_TERMS = [
  new RegExp(["pipe", "board"].join("[\\s_-]*"), "i"),
  new RegExp(["파이프", "보드"].join("[\\s_-]*"), "i"),
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
    if (file.startsWith(`${INTERNAL_DIRECTORY}/`)) {
      return [{ file, reason: "내부 작업 파일" }];
    }

    if (LEGAL_TERMS.some((pattern) => pattern.test(content))) {
      return [{ file, reason: "법적 금칙어" }];
    }

    if (CREDENTIAL_PATTERNS.some((pattern) => pattern.test(content))) {
      return [{ file, reason: "자격증명 의심" }];
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

  const files = trackedFiles.flatMap((file) => {
    const buffer = readFileSync(join(rootDirectory, file));
    return buffer.includes(0)
      ? []
      : [{ file, content: buffer.toString("utf8") }];
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
