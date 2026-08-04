const CLIENTS = ["codex", "claude"];

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
