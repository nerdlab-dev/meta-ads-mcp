import assert from "node:assert/strict";
import test from "node:test";

import { detectClients, installMcp, selectClient } from "../src/install.js";

const REMOTE_URL = "https://nerdboard.kr/mcp";

function createRunner({
  installedClients = ["codex"],
  registrations = {},
  addResults = {},
} = {}) {
  const runner = (command, args) => {
    runner.calls.push([command, args]);

    if (args[0] === "--version") {
      return {
        status: installedClients.includes(command) ? 0 : 1,
        stdout: "",
        stderr: "",
      };
    }

    if (args[0] === "mcp" && args[1] === "get") {
      const registration = registrations[command];
      return registration === undefined
        ? { status: 1, stdout: "", stderr: "no such server" }
        : { status: 0, stdout: registration, stderr: "" };
    }

    if (args[0] === "mcp" && args.includes("add")) {
      return (
        addResults[command] ?? { status: 0, stdout: "added", stderr: "" }
      );
    }

    return { status: 1, stdout: "", stderr: "unexpected command" };
  };
  runner.calls = [];
  return runner;
}

test("detects only clients whose exit code is success", () => {
  const runner = (command) => ({
    status: command === "codex" ? 0 : 1,
    stdout: "",
    stderr: "",
  });

  assert.deepEqual(detectClients(runner), ["codex"]);
});

test("selects Codex when only Codex is installed", () => {
  assert.deepEqual(selectClient(null, ["codex"]), { client: "codex" });
});

test("selects Claude when only Claude is installed", () => {
  assert.deepEqual(selectClient(null, ["claude"]), { client: "claude" });
});

test("requires an explicit choice when both clients are installed", () => {
  const result = selectClient(null, ["codex", "claude"]);

  assert.match(result.error, /--client/);
});

test("points to manual install when no client is installed", () => {
  const result = selectClient(null, []);

  assert.match(result.error, /manual install/);
});

test("fails when the requested client is not installed", () => {
  const result = selectClient("claude", ["codex"]);

  assert.match(result.error, /Could not find/);
});

test("adds an unregistered Codex server", async () => {
  const runner = createRunner();

  const result = await installMcp({ requestedClient: "codex", runner });

  assert.equal(result.ok, true);
  assert.deepEqual(runner.calls.at(-1), [
    "codex",
    ["mcp", "add", "nerdboard-meta-ads", "--url", REMOTE_URL],
  ]);
  assert.match(result.message, /codex mcp login/);
  assert.match(result.message, /nerdboard-meta-ads/);
});

test("requests both Meta read and write scopes in the Codex login", async () => {
  const runner = createRunner();

  const result = await installMcp({ requestedClient: "codex", runner });

  assert.match(result.message, /--scopes/);
  assert.match(result.message, /ad-channel:meta:read/);
  assert.match(result.message, /ad-channel:meta:campaign:read/);
  assert.match(result.message, /ad-channel:meta:creative:read/);
  assert.match(result.message, /ad-channel:meta:campaign:write/);
  assert.match(result.message, /ad-channel:meta:creative:write/);
});

test("adds an unregistered Claude server at user scope", async () => {
  const runner = createRunner({ installedClients: ["claude"] });

  const result = await installMcp({ requestedClient: "claude", runner });

  assert.equal(result.ok, true);
  assert.deepEqual(runner.calls.at(-1), [
    "claude",
    [
      "mcp",
      "add",
      "--transport",
      "http",
      "--scope",
      "user",
      "nerdboard-meta-ads",
      REMOTE_URL,
    ],
  ]);
  assert.match(result.message, /\/mcp/);
});

test("does not add when the same URL is already registered", async () => {
  const runner = createRunner({ registrations: { codex: REMOTE_URL } });

  const result = await installMcp({ requestedClient: "codex", runner });

  assert.equal(result.ok, true);
  assert.equal(runner.calls.some(([, args]) => args.includes("add")), false);
  assert.match(result.message, /already connected/);
});

test("does not overwrite when the same name has a different URL", async () => {
  const runner = createRunner({
    registrations: { codex: "https://example.com/mcp" },
  });

  const result = await installMcp({ requestedClient: "codex", runner });

  assert.equal(result.ok, false);
  assert.equal(runner.calls.some(([, args]) => args.includes("add")), false);
  assert.match(result.message, /left unchanged/);
});

test("returns the exit code and error when the add command fails", async () => {
  const runner = createRunner({
    addResults: {
      codex: { status: 7, stdout: "", stderr: "permission denied" },
    },
  });

  const result = await installMcp({ requestedClient: "codex", runner });

  assert.equal(result.ok, false);
  assert.match(result.message, /Exit code 7/);
  assert.match(result.message, /permission denied/);
});
