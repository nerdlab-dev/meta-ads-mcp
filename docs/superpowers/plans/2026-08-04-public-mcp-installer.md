# 너드보드 Meta Ads MCP 공개 설치 도구 구현 계획

> **에이전트 작업자 필수 사항:** 이 계획을 작업별로 실행할 때 `executing-plans`를 사용해요. 각 단계는 체크박스로 추적해요.

**목표:** `npx -y @nerdboard/meta-ads-mcp@latest install` 한 번으로 Codex CLI 또는 Claude Code에 너드보드 원격 MCP를 안전하게 등록하는 공개 npm 패키지를 만들어요.

**구조:** 패키지는 Node.js ESM과 표준 라이브러리만 사용해요. CLI 인자 처리와 설치 흐름을 분리하고, 실제 제품 설정 파일을 직접 수정하지 않은 채 각 제품의 공식 `mcp get`과 `mcp add` 명령을 호출해요.

**기술 스택:** Node.js 20 이상, ESM JavaScript, `node:test`, npm, GitHub Actions

## 공통 제약

- 런타임 의존성은 0개로 유지해요.
- 자동 설치 대상은 Codex CLI와 Claude Code예요.
- 원격 MCP URL은 `https://nerdboard.kr/mcp`예요.
- MCP 서버 이름은 `nerdboard-meta-ads`예요.
- CLI는 JSON, TOML 등 제품 설정 파일을 직접 읽거나 쓰지 않아요.
- 이름이 같고 URL이 다르면 기존 설정을 변경하지 않아요.
- Homebrew, 로컬 stdio 프록시, CLI OAuth, 별도 사용량 과금은 구현하지 않아요.
- 모든 사용자 안내 문구와 커밋 메시지는 한국어로 작성해요.

---

### 작업 1: npm 패키지와 기본 CLI

**파일:**
- 생성: `package.json`
- 생성: `bin/nerdboard-meta-ads-mcp.js`
- 생성: `src/cli.js`
- 생성: `test/cli.test.js`

**인터페이스:**
- 생성: `parseArgs(argv)` → `{ command: "help" | "version" | "install", client: "codex" | "claude" | null }`
- 생성: `runCli(argv, io, dependencies)` → `Promise<number>`
- 생성: `main()` → 프로세스 종료 코드를 설정하는 실행 진입점

- [ ] **1단계: 도움말·버전·잘못된 인자 테스트 작성**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { parseArgs, runCli } from "../src/cli.js";

test("--help는 도움말 명령으로 해석한다", () => {
  assert.deepEqual(parseArgs(["--help"]), { command: "help", client: null });
});

test("--version은 버전 명령으로 해석한다", () => {
  assert.deepEqual(parseArgs(["--version"]), { command: "version", client: null });
});

test("알 수 없는 인자는 실패한다", async () => {
  const output = [];
  const code = await runCli(["unknown"], {
    out: (value) => output.push(value),
    error: (value) => output.push(value),
  });
  assert.equal(code, 1);
  assert.match(output.join("\n"), /사용법/);
});
```

- [ ] **2단계: 테스트가 실패하는지 확인**

실행: `npm test`

예상: `package.json` 또는 `src/cli.js`가 없어 실패해요.

- [ ] **3단계: 최소 패키지와 CLI 구현**

`package.json`에는 다음 공개 인터페이스를 넣어요.

```json
{
  "name": "@nerdboard/meta-ads-mcp",
  "version": "0.1.0",
  "description": "너드보드 Meta 광고 원격 MCP 설치 도구",
  "type": "module",
  "bin": {
    "nerdboard-meta-ads-mcp": "./bin/nerdboard-meta-ads-mcp.js"
  },
  "files": ["bin", "src", "README.md", "LICENSE"],
  "scripts": {
    "test": "node --test",
    "check": "node --check src/cli.js && node --check src/install.js && node --check bin/nerdboard-meta-ads-mcp.js"
  },
  "engines": { "node": ">=20" },
  "publishConfig": { "access": "public", "provenance": true },
  "license": "MIT"
}
```

`parseArgs`는 `install`, `--client codex`, `--client claude`, `--help`, `--version`만 허용해요. 인자가 없으면 `install`로 처리해요. `runCli`는 도움말과 `package.json` 버전을 출력해요. 설치 명령일 때만 `src/install.js`를 동적으로 불러와 작업 2의 `installMcp`에 위임해요. 따라서 작업 1의 도움말과 버전은 아직 `src/install.js`가 없어도 실행돼요.

진입점은 다음처럼 얇게 유지해요.

```js
#!/usr/bin/env node
import { main } from "../src/cli.js";

await main();
```

- [ ] **4단계: 기본 CLI 테스트 통과 확인**

실행: `npm test`

예상: 모든 기본 CLI 테스트가 통과해요.

- [ ] **5단계: 커밋**

```bash
git add package.json bin src/cli.js test/cli.test.js
git commit -m "기능: 공개 MCP 설치 CLI 기본 구조 추가"
```

### 작업 2: 클라이언트 선택과 감지

**파일:**
- 생성: `src/install.js`
- 생성: `test/install.test.js`
- 수정: `src/cli.js`

**인터페이스:**
- 생성: `detectClients(runner)` → 설치된 클라이언트 이름 배열
- 생성: `selectClient(requestedClient, detectedClients)` → `{ client }` 또는 `{ error }`
- 생성: `installMcp(options)` → `{ ok: boolean, message: string }`
- `runner(command, args)` → `{ status: number | null, stdout: string, stderr: string }`

- [ ] **1단계: 클라이언트 선택 테스트 작성**

```js
test("Codex만 설치됐으면 Codex를 선택한다", () => {
  assert.deepEqual(selectClient(null, ["codex"]), { client: "codex" });
});

test("둘 다 설치됐으면 명시적 선택을 요구한다", () => {
  const result = selectClient(null, ["codex", "claude"]);
  assert.match(result.error, /--client/);
});

test("설치되지 않은 클라이언트를 지정하면 실패한다", () => {
  const result = selectClient("claude", ["codex"]);
  assert.match(result.error, /찾을 수 없어요/);
});
```

- [ ] **2단계: 선택 테스트 실패 확인**

실행: `node --test test/install.test.js`

예상: `src/install.js`가 없어 실패해요.

- [ ] **3단계: 감지와 선택 최소 구현**

`detectClients`는 다음 명령의 종료 코드만 확인해요.

```js
runner("codex", ["--version"]);
runner("claude", ["--version"]);
```

두 제품이 모두 있으면 자동 선택하지 않아요. `--client`로 지정한 제품이 설치되어 있지 않아도 다른 제품으로 대체하지 않아요.

- [ ] **4단계: 선택 테스트 통과 확인**

실행: `node --test test/install.test.js`

예상: 클라이언트 감지와 선택 테스트가 통과해요.

- [ ] **5단계: 커밋**

```bash
git add src/cli.js src/install.js test/install.test.js
git commit -m "기능: MCP 클라이언트 감지와 선택 추가"
```

### 작업 3: 멱등 설치와 충돌 보호

**파일:**
- 수정: `src/install.js`
- 수정: `test/install.test.js`

**인터페이스:**
- Codex 조회: `codex mcp get nerdboard-meta-ads`
- Codex 추가: `codex mcp add nerdboard-meta-ads --url https://nerdboard.kr/mcp`
- Claude 조회: `claude mcp get nerdboard-meta-ads`
- Claude 추가: `claude mcp add --transport http --scope user nerdboard-meta-ads https://nerdboard.kr/mcp`

- [ ] **1단계: 설치·재실행·충돌 테스트 작성**

```js
test("등록되지 않은 Codex 서버를 추가한다", async () => {
  const calls = [];
  const runner = (command, args) => {
    calls.push([command, args]);
    if (args[1] === "get") return { status: 1, stdout: "", stderr: "없음" };
    return { status: 0, stdout: "", stderr: "" };
  };
  const result = await installMcp({ requestedClient: "codex", runner });
  assert.equal(result.ok, true);
  assert.deepEqual(calls.at(-1), ["codex", ["mcp", "add", "nerdboard-meta-ads", "--url", "https://nerdboard.kr/mcp"]]);
});

function createRunner({ getStatus, getOutput }) {
  const runner = (command, args) => {
    runner.calls.push([command, args]);
    if (args[1] === "get") {
      return { status: getStatus, stdout: getOutput, stderr: "" };
    }
    return { status: 0, stdout: "", stderr: "" };
  };
  runner.calls = [];
  return runner;
}

test("같은 URL이 이미 있으면 추가하지 않는다", async () => {
  const runner = createRunner({ getStatus: 0, getOutput: "https://nerdboard.kr/mcp" });
  const result = await installMcp({ requestedClient: "codex", runner });
  assert.equal(result.ok, true);
  assert.equal(runner.calls.filter(([, args]) => args.includes("add")).length, 0);
});

test("같은 이름에 다른 URL이 있으면 덮어쓰지 않는다", async () => {
  const runner = createRunner({ getStatus: 0, getOutput: "https://example.com/mcp" });
  const result = await installMcp({ requestedClient: "codex", runner });
  assert.equal(result.ok, false);
  assert.match(result.message, /변경하지 않았어요/);
});
```

- [ ] **2단계: 설치 테스트 실패 확인**

실행: `node --test test/install.test.js`

예상: 설치 호출과 충돌 보호가 없어 실패해요.

- [ ] **3단계: 제품별 명령과 멱등 설치 구현**

제품별 명령은 작은 상수 객체로 정의해요. 새 클래스나 공통 어댑터 계층은 만들지 않아요.

조회가 성공하면 출력에 정확한 원격 URL이 있는지 확인해요. URL이 같으면 성공으로 끝내고, 다르면 실패해요. 조회가 실패하면 추가 명령을 실행해요. 추가 명령이 실패하면 stderr와 종료 코드를 사용자 메시지로 반환해요.

- [ ] **4단계: 전체 설치 테스트 통과 확인**

실행: `npm test`

예상: Codex와 Claude 설치, 재실행, 이름 충돌, 명령 실패 테스트가 모두 통과해요.

- [ ] **5단계: 커밋**

```bash
git add src/install.js test/install.test.js
git commit -m "기능: 원격 MCP 멱등 설치와 충돌 보호 추가"
```

### 작업 4: 실행 파일 스모크 테스트와 공개 문서

**파일:**
- 수정: `README.md`
- 생성: `LICENSE`
- 생성: `test/bin.test.js`
- 생성: `.github/workflows/ci.yml`

**인터페이스:**
- 실행 파일: `node bin/nerdboard-meta-ads-mcp.js --help`
- 수동 Codex 설치: `codex mcp add nerdboard-meta-ads --url https://nerdboard.kr/mcp`
- 수동 Claude 설치: `claude mcp add --transport http --scope user nerdboard-meta-ads https://nerdboard.kr/mcp`

- [ ] **1단계: 실행 파일 스모크 테스트 작성**

```js
import { spawnSync } from "node:child_process";

test("실행 파일이 도움말을 출력한다", () => {
  const result = spawnSync(process.execPath, ["bin/nerdboard-meta-ads-mcp.js", "--help"], { encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /nerdboard-meta-ads-mcp/);
});
```

- [ ] **2단계: 스모크 테스트 실패 확인**

실행: `node --test test/bin.test.js`

예상: 실행 권한이나 CLI 출력이 요구사항과 다르면 실패해요.

- [ ] **3단계: README, 라이선스, CI 작성**

README에는 다음 내용을 한국어로 명시해요.

- CLI만 MIT 오픈소스라는 점
- 광고 작업은 너드보드 관리형 MCP 서버에서 실행된다는 점
- 너드보드 계정과 활성 구독이 필요하다는 점
- 대표 `npx` 설치 명령
- Codex와 Claude의 수동 설치 명령
- 지원하지 않는 클라이언트의 원격 URL
- 패키지가 Meta 토큰이나 광고 요청을 저장하지 않는다는 점
- 로컬 개발과 테스트 명령

CI는 Node.js 20과 22에서 `npm test`, `npm run check`, `npm pack --dry-run`을 실행해요.

- [ ] **4단계: 패키지 전체 검증**

실행:

```bash
npm test
npm run check
npm pack --dry-run
node bin/nerdboard-meta-ads-mcp.js --help
node bin/nerdboard-meta-ads-mcp.js --version
```

예상: 모든 명령이 종료 코드 0으로 끝나고 패키지에 `package.json`, `bin`, `src`, `README.md`, `LICENSE`만 포함돼요.

- [ ] **5단계: 커밋**

```bash
git add README.md LICENSE test/bin.test.js .github/workflows/ci.yml
git commit -m "문서: 공개 설치와 서비스 경계 안내 추가"
```

### 작업 5: 최종 검토와 원격 공유

**파일:**
- 검토: 전체 변경 파일

**인터페이스:**
- 없음

- [ ] **1단계: 설계 대비 누락 확인**

`docs/superpowers/specs/2026-08-04-public-mcp-installer-design.md`의 MVP 범위, 오류 처리, 테스트, 완료 기준을 변경 파일과 대조해요.

- [ ] **2단계: 과설계 검토**

런타임 의존성, 설정 파일 파서, 자체 OAuth, 로컬 프록시, 사용되지 않는 옵션이나 추상 계층이 없는지 확인해요.

- [ ] **3단계: 최종 검증**

실행: `npm test && npm run check && npm pack --dry-run`

예상: 테스트와 문법 검사, 패키지 구성이 모두 통과해요.

- [ ] **4단계: 브랜치 상태 확인**

실행: `git status --short --branch && git log --oneline origin/main..HEAD`

예상: 작업 디렉터리가 깨끗하고 한국어 커밋만 보여요.

- [ ] **5단계: 원격 브랜치에 푸시**

실행: `git push -u origin feature/public-mcp-installer`

예상: 공개 저장소에서 작업 브랜치를 확인할 수 있어요.
