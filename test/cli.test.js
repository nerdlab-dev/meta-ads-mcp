import assert from "node:assert/strict";
import test from "node:test";

import { parseArgs, runCli } from "../src/cli.js";

function createIo() {
  const output = [];
  return {
    io: {
      out: (value) => output.push(value),
      error: (value) => output.push(value),
    },
    output,
  };
}

test("parses --help as the help command", () => {
  assert.deepEqual(parseArgs(["--help"]), { command: "help", client: null });
});

test("parses --version as the version command", () => {
  assert.deepEqual(parseArgs(["--version"]), {
    command: "version",
    client: null,
  });
});

test("parses no arguments as the install command", () => {
  assert.deepEqual(parseArgs([]), { command: "install", client: null });
});

test("parses the client to install for", () => {
  assert.deepEqual(parseArgs(["install", "--client", "codex"]), {
    command: "install",
    client: "codex",
  });
});

test("fails on unknown arguments", async () => {
  const { io, output } = createIo();
  const code = await runCli(["unknown"], io);

  assert.equal(code, 1);
  assert.match(output.join("\n"), /Usage/);
});

test("help exits with success", async () => {
  const { io, output } = createIo();
  const code = await runCli(["--help"], io);

  assert.equal(code, 0);
  assert.match(output.join("\n"), /nerdboard-meta-ads-mcp/);
});
