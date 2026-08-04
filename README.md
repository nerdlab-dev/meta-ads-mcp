# Nerdboard Meta Ads MCP

Codex CLI와 Claude Code에 너드보드 Meta Ads MCP를 연결하는 공개 설치 도구예요.

이 저장소의 CLI는 MIT 오픈소스예요. 실제 광고 조회·생성·수정은 너드보드의 관리형 원격 MCP 서버에서 실행돼요. 사용하려면 너드보드 계정, 활성 구독, 연결된 Meta 광고 계정이 필요해요.

## 빠른 설치

Node.js 20 이상이 필요해요.

```bash
npx -y @nerdboard/meta-ads-mcp@latest install
```

Codex CLI와 Claude Code가 모두 설치되어 있으면 대상을 지정해요.

```bash
npx -y @nerdboard/meta-ads-mcp@latest install --client codex
npx -y @nerdboard/meta-ads-mcp@latest install --client claude
```

설치기는 각 제품의 공식 MCP 명령을 사용해요. 제품 설정 파일을 직접 수정하지 않아요.

## 로그인

Codex CLI에서는 설치 후 다음 명령을 실행해요.

```bash
codex mcp login nerdboard-meta-ads
```

Claude Code에서는 `/mcp`를 실행한 뒤 브라우저에서 로그인해요.

로그인 과정에서 너드보드 테넌트와 권한을 선택해요. 구독이나 Meta 계정 연결이 필요하면 너드보드 화면에서 이어서 설정해요.

## 수동 설치

Codex CLI:

```bash
codex mcp add nerdboard-meta-ads --url https://nerdboard.kr/mcp
```

Claude Code:

```bash
claude mcp add --transport http --scope user nerdboard-meta-ads https://nerdboard.kr/mcp
```

Cursor 등 다른 원격 MCP 클라이언트에는 다음 URL을 등록해요.

```text
https://nerdboard.kr/mcp
```

## 설치기가 하는 일

- Codex CLI와 Claude Code 설치 여부를 확인해요.
- `nerdboard-meta-ads` 연결이 이미 있는지 확인해요.
- 연결이 없으면 제품의 공식 `mcp add` 명령을 실행해요.
- 같은 연결이 이미 있으면 아무것도 변경하지 않아요.
- 같은 이름에 다른 URL이 있으면 기존 설정을 보호하고 종료해요.

## 설치기가 하지 않는 일

- Meta 액세스 토큰을 읽거나 저장하지 않아요.
- 광고 요청을 로컬에서 처리하거나 중계하지 않아요.
- 너드보드 서버 코드와 광고 생성 로직을 포함하지 않아요.
- 기존 MCP 설정을 삭제하거나 덮어쓰지 않아요.

## 로컬 개발

```bash
npm test
npm run check
npm pack --dry-run
```

## 라이선스

이 저장소의 CLI 소스는 [MIT 라이선스](./LICENSE)를 따라요. 너드보드 서비스와 원격 MCP 서버에는 별도의 이용 조건이 적용돼요.
