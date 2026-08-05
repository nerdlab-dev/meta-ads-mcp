import { spawnSync } from "node:child_process";

const CLIENTS = ["codex", "claude"];
const SERVER_NAME = "nerdboard-meta-ads";
const REMOTE_URL = "https://nerdboard.kr/mcp";
const META_SCOPES = [
  "ad-channel:meta:read",
  "ad-channel:meta:campaign:read",
  "ad-channel:meta:creative:read",
  "ad-channel:meta:campaign:write",
  "ad-channel:meta:creative:write",
].join(",");

const COMMANDS = {
  codex: {
    get: ["mcp", "get", SERVER_NAME],
    add: ["mcp", "add", SERVER_NAME, "--url", REMOTE_URL],
    login: `codex mcp login --scopes ${META_SCOPES} ${SERVER_NAME}`,
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
    login: "Run /mcp inside Claude Code and sign in with your browser.",
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
      error: `Could not find the ${requestedClient} CLI. Please check that it is installed.`,
    };
  }

  if (detectedClients.length === 1) {
    return { client: detectedClients[0] };
  }

  if (detectedClients.length === 0) {
    return {
      error:
        "Could not find Codex CLI or Claude Code. Please use the manual install steps in the README.",
    };
  }

  return {
    error:
      "Both Codex CLI and Claude Code are installed. Please pass --client codex or --client claude.",
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
        message: `Nerdboard Meta Ads MCP is already connected to ${client}.\n${commands.login}`,
      };
    }

    return {
      ok: false,
      message: `The name ${SERVER_NAME} is registered with a different URL. Your existing configuration was left unchanged.`,
    };
  }

  const added = runner(client, commands.add);
  if (added.status !== 0) {
    const exitCode = added.status ?? "unknown";
    const detail = added.stderr.trim() || "No error message was provided.";
    return {
      ok: false,
      message: `The MCP add command failed. Exit code ${exitCode}: ${detail}`,
    };
  }

  return {
    ok: true,
    message: `Connected Nerdboard Meta Ads MCP to ${client}.\n${commands.login}`,
  };
}
