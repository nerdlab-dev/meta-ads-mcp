import { spawnSync } from "node:child_process";

const CLIENTS = ["codex", "claude"];
const SERVER_NAME = "nerdboard-meta-ads";
const REMOTE_URL = "https://nerdboard.kr/mcp";

const COMMANDS = {
  codex: {
    get: ["mcp", "get", SERVER_NAME],
    add: ["mcp", "add", SERVER_NAME, "--url", REMOTE_URL],
    login: `codex mcp login ${SERVER_NAME}`,
  },
  claude: {
    get: ["mcp", "get", SERVER_NAME],
    add: [
      "mcp",
      "add",
      "--transport",
      "http",
      "--scope",
      "user",
      SERVER_NAME,
      REMOTE_URL,
    ],
    login: "Claude Code에서 /mcp를 실행해 로그인해주세요.",
  },
};

function runCommand(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr || result.error?.message || "",
  };
}

export function detectClients(runner) {
  return CLIENTS.filter((client) => {
    const result = runner(client, ["--version"]);
    return result.status === 0;
  });
}

export function selectClient(requestedClient, detectedClients) {
  if (requestedClient) {
    if (detectedClients.includes(requestedClient)) {
      return { client: requestedClient };
    }

    return {
      error: `${requestedClient} CLI를 찾을 수 없어요. 설치 상태를 확인해주세요.`,
    };
  }

  if (detectedClients.length === 1) {
    return { client: detectedClients[0] };
  }

  if (detectedClients.length === 0) {
    return {
      error:
        "Codex CLI와 Claude Code를 찾을 수 없어요. README의 수동 설치 방법을 이용해주세요.",
    };
  }

  return {
    error:
      "Codex CLI와 Claude Code가 모두 설치되어 있어요. --client codex 또는 --client claude를 지정해주세요.",
  };
}

export function installMcp({
  requestedClient = null,
  runner = runCommand,
} = {}) {
  const selected = selectClient(requestedClient, detectClients(runner));
  if (selected.error) {
    return { ok: false, message: selected.error };
  }

  const client = selected.client;
  const commands = COMMANDS[client];
  const current = runner(client, commands.get);

  if (current.status === 0) {
    if (current.stdout.includes(REMOTE_URL)) {
      return {
        ok: true,
        message: `${client}에 너드보드 Meta Ads MCP가 이미 연결되어 있어요.\n${commands.login}`,
      };
    }

    return {
      ok: false,
      message: `${SERVER_NAME} 이름에 다른 URL이 등록되어 있어요. 기존 설정은 변경하지 않았어요.`,
    };
  }

  const added = runner(client, commands.add);
  if (added.status !== 0) {
    const exitCode = added.status ?? "알 수 없음";
    const detail = added.stderr.trim() || "오류 메시지가 없어요.";
    return {
      ok: false,
      message: `MCP 추가 명령이 실패했어요. 종료 코드 ${exitCode}: ${detail}`,
    };
  }

  return {
    ok: true,
    message: `너드보드 Meta Ads MCP를 ${client}에 연결했어요.\n${commands.login}`,
  };
}
