import assert from "node:assert/strict";
import test from "node:test";

import { detectClients, selectClient } from "../src/install.js";

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
