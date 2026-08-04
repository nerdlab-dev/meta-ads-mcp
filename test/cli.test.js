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

test("--help는 도움말 명령으로 해석한다", () => {
  assert.deepEqual(parseArgs(["--help"]), { command: "help", client: null });
});

test("--version은 버전 명령으로 해석한다", () => {
  assert.deepEqual(parseArgs(["--version"]), {
    command: "version",
    client: null,
  });
});

test("인자가 없으면 설치 명령으로 해석한다", () => {
  assert.deepEqual(parseArgs([]), { command: "install", client: null });
});

test("설치할 클라이언트를 지정한다", () => {
  assert.deepEqual(parseArgs(["install", "--client", "codex"]), {
    command: "install",
    client: "codex",
  });
});

test("알 수 없는 인자는 실패한다", async () => {
  const { io, output } = createIo();
  const code = await runCli(["unknown"], io);

  assert.equal(code, 1);
  assert.match(output.join("\n"), /사용법/);
});

test("도움말은 성공으로 종료한다", async () => {
  const { io, output } = createIo();
  const code = await runCli(["--help"], io);

  assert.equal(code, 0);
  assert.match(output.join("\n"), /nerdboard-meta-ads-mcp/);
});
