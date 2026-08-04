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
        ? { status: 1, stdout: "", stderr: "서버 없음" }
        : { status: 0, stdout: registration, stderr: "" };
    }

    if (args[0] === "mcp" && args.includes("add")) {
      return (
        addResults[command] ?? { status: 0, stdout: "추가됨", stderr: "" }
      );
    }

    return { status: 1, stdout: "", stderr: "예상하지 못한 명령" };
  };
  runner.calls = [];
  return runner;
}

test("종료 코드가 성공인 클라이언트만 감지한다", () => {
  const runner = (command) => ({
    status: command === "codex" ? 0 : 1,
    stdout: "",
    stderr: "",
  });

  assert.deepEqual(detectClients(runner), ["codex"]);
});

test("Codex만 설치됐으면 Codex를 선택한다", () => {
  assert.deepEqual(selectClient(null, ["codex"]), { client: "codex" });
});

test("Claude만 설치됐으면 Claude를 선택한다", () => {
  assert.deepEqual(selectClient(null, ["claude"]), { client: "claude" });
});

test("둘 다 설치됐으면 명시적 선택을 요구한다", () => {
  const result = selectClient(null, ["codex", "claude"]);

  assert.match(result.error, /--client/);
});

test("설치된 클라이언트가 없으면 수동 설치를 안내한다", () => {
  const result = selectClient(null, []);

  assert.match(result.error, /수동 설치/);
});

test("설치되지 않은 클라이언트를 지정하면 실패한다", () => {
  const result = selectClient("claude", ["codex"]);

  assert.match(result.error, /찾을 수 없어요/);
});

test("등록되지 않은 Codex 서버를 추가한다", async () => {
  const runner = createRunner();

  const result = await installMcp({ requestedClient: "codex", runner });

  assert.equal(result.ok, true);
  assert.deepEqual(runner.calls.at(-1), [
    "codex",
    ["mcp", "add", "nerdboard-meta-ads", "--url", REMOTE_URL],
  ]);
  assert.match(result.message, /codex mcp login nerdboard-meta-ads/);
});

test("등록되지 않은 Claude 서버를 사용자 범위에 추가한다", async () => {
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

test("같은 URL이 이미 있으면 추가하지 않는다", async () => {
  const runner = createRunner({ registrations: { codex: REMOTE_URL } });

  const result = await installMcp({ requestedClient: "codex", runner });

  assert.equal(result.ok, true);
  assert.equal(runner.calls.some(([, args]) => args.includes("add")), false);
  assert.match(result.message, /이미 연결/);
});

test("같은 이름에 다른 URL이 있으면 덮어쓰지 않는다", async () => {
  const runner = createRunner({
    registrations: { codex: "https://example.com/mcp" },
  });

  const result = await installMcp({ requestedClient: "codex", runner });

  assert.equal(result.ok, false);
  assert.equal(runner.calls.some(([, args]) => args.includes("add")), false);
  assert.match(result.message, /변경하지 않았어요/);
});

test("추가 명령이 실패하면 종료 코드와 오류를 반환한다", async () => {
  const runner = createRunner({
    addResults: {
      codex: { status: 7, stdout: "", stderr: "권한 없음" },
    },
  });

  const result = await installMcp({ requestedClient: "codex", runner });

  assert.equal(result.ok, false);
  assert.match(result.message, /종료 코드 7/);
  assert.match(result.message, /권한 없음/);
});
