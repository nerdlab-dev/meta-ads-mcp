import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("실행 파일이 도움말을 출력한다", () => {
  const result = spawnSync(
    process.execPath,
    ["bin/nerdboard-meta-ads-mcp.js", "--help"],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /nerdboard-meta-ads-mcp/);
});

test("실행 파일이 패키지 버전을 출력한다", () => {
  const result = spawnSync(
    process.execPath,
    ["bin/nerdboard-meta-ads-mcp.js", "--version"],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), "0.1.0");
});
