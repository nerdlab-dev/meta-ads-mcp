import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");

const HELP = `너드보드 Meta Ads MCP 설치 도구

사용법:
  nerdboard-meta-ads-mcp install [--client codex|claude]
  nerdboard-meta-ads-mcp --help
  nerdboard-meta-ads-mcp --version`;

export function parseArgs(argv) {
  if (argv.length === 0) {
    return { command: "install", client: null };
  }

  if (argv.length === 1 && ["--help", "-h"].includes(argv[0])) {
    return { command: "help", client: null };
  }

  if (
    argv.length === 1 &&
    ["--version", "-v"].includes(argv[0])
  ) {
    return { command: "version", client: null };
  }

  if (argv[0] !== "install") {
    return { error: "지원하지 않는 명령이에요." };
  }

  if (argv.length === 1) {
    return { command: "install", client: null };
  }

  if (
    argv.length === 3 &&
    argv[1] === "--client" &&
    ["codex", "claude"].includes(argv[2])
  ) {
    return { command: "install", client: argv[2] };
  }

  return { error: "클라이언트는 codex 또는 claude만 지정할 수 있어요." };
}

export async function runCli(
  argv,
  io = { out: console.log, error: console.error },
) {
  const parsed = parseArgs(argv);

  if (parsed.error) {
    io.error(`${parsed.error}\n\n${HELP}`);
    return 1;
  }

  if (parsed.command === "help") {
    io.out(HELP);
    return 0;
  }

  if (parsed.command === "version") {
    io.out(version);
    return 0;
  }

  const { installMcp } = await import("./install.js");
  const result = await installMcp({ requestedClient: parsed.client });
  const write = result.ok ? io.out : io.error;
  write(result.message);
  return result.ok ? 0 : 1;
}

export async function main() {
  process.exitCode = await runCli(process.argv.slice(2));
}
