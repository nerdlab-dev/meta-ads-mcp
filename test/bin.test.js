import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("the executable prints the help text", () => {
  const result = spawnSync(
    process.execPath,
    ["bin/nerdboard-meta-ads-mcp.js", "--help"],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /nerdboard-meta-ads-mcp/);
});

test("the executable prints the package version", () => {
  const result = spawnSync(
    process.execPath,
    ["bin/nerdboard-meta-ads-mcp.js", "--version"],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), "0.1.0");
});
