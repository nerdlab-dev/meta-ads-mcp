import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

test("npm 배포 파일을 빈 캐시에 설치해 Codex와 Claude 연결까지 실행한다", () => {
  const temp = mkdtempSync(join(tmpdir(), "nerdboard-package-smoke-"));
  try {
    const config = join(temp, ".npmrc");
    writeFileSync(config, "ignore-scripts=true\n");
    const env = { ...process.env, NPM_CONFIG_USERCONFIG: config, NPM_CONFIG_CACHE: join(temp, "cache") };
    const packed = JSON.parse(execFileSync("npm", ["pack", "--json", "--pack-destination", temp], { encoding: "utf8", env }));
    const packageFile = join(temp, packed[0].filename);
    const bin = join(temp, "bin");
    mkdirSync(bin);
    for (const client of ["codex", "claude"]) {
      writeFileSync(join(bin, client), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
if (args[0] === '--version') { console.log('1.0.0'); process.exit(0); }
if (args[0] === 'mcp' && args[1] === 'get') process.exit(1);
if (args[0] === 'mcp' && args[1] === 'add') {
  fs.writeFileSync(process.env.MCP_SMOKE_RECEIPT, JSON.stringify(args));
  process.exit(0);
}
process.exit(2);
`, { mode: 0o755 });
    }
    env.PATH = `${bin}${process.platform === "win32" ? ";" : ":"}${process.env.PATH}`;
    const npmArgs = ["exec", "--yes", "--offline", "--package", packageFile, "--", "nerdboard-meta-ads-mcp"];
    const version = execFileSync("npm", [...npmArgs, "--version"], { cwd: temp, env, encoding: "utf8" });
    assert.equal(version.trim(), JSON.parse(readFileSync(resolve("package.json"), "utf8")).version);
    for (const client of ["codex", "claude"]) {
      env.MCP_SMOKE_RECEIPT = join(temp, `${client}.json`);
      const output = execFileSync("npm", [...npmArgs, "install", "--client", client], { cwd: temp, env, encoding: "utf8" });
      const args = JSON.parse(readFileSync(env.MCP_SMOKE_RECEIPT, "utf8"));
      assert.deepEqual(args, client === "codex"
        ? ["mcp", "add", "nerdboard-meta-ads", "--url", "https://nerdboard.kr/mcp"]
        : ["mcp", "add", "--transport", "http", "--scope", "user", "nerdboard-meta-ads", "https://nerdboard.kr/mcp"]);
      assert.match(output, client === "codex" ? /codex mcp login nerdboard-meta-ads/ : /\/mcp/);
      assert.doesNotMatch(output, /--scopes/);
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
