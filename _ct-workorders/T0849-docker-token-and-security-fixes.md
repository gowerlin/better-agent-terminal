---
schema_version: 1
schema_kind: workorder
id: T0849
title: "Docker 精靈 W1：權杖不進命令列、healthy 後才讀權杖、三段式權杖取得與明確錯誤碼、inspect 不回傳 env、docker 指令補 timeout"
type: implementation
status: DONE
repo: better-agent-terminal
project: PLAN-052
priority: P2
sizing: M
created_at: "2026-11-04T15:18:27+0800"
started_at: "2026-11-04T15:21:20+08:00"
updated_at: "2026-11-04T15:35:28+08:00"
completed_at: "2026-11-04T15:35:28+08:00"
session_ids:
  - "ba6e7e92-fb1a-49d6-bcfe-1518b2bbae2c"
depends_on: []
related:
  - "PLAN-052；D282 / D283；T0848 回報區〈調查結論〉1、3、5 與〈建議下一步〉W1；T0743（Docker 精靈驗收）；BUG-097（`DOCKER_PUBLISH_HOST`）；BUG-111 / T0444（不動使用者容器）"
affects_files:
  - _ct-workorders/T0849-docker-token-and-security-fixes.md
  - electron/docker-lifecycle.ts
  - electron/docker-detect.ts
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/components/setup-wizard/steps/docker/start-server.ts
  - src/components/setup-wizard/steps/wsl/connect-test.ts
  - src/components/setup-wizard/error-mapper.ts
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - electron/__tests__/docker-lifecycle.test.ts
  - electron/__tests__/docker-server-port.test.ts
  - electron/__tests__/docker-detect.test.ts
  - electron/remote/__tests__/headless-server.test.ts
  - src/components/setup-wizard/__tests__/docker-flow.test.ts
  - src/components/setup-wizard/steps/docker/__tests__/
  # Q-1 塔台裁決 A（2026-11-04 15:30）：本單行為變更的直接後果
  - src/components/setup-wizard/__tests__/wizard-jump-rollback.test.ts
  - src/components/setup-wizard/__tests__/wizard-rollback-ownership.test.ts
  - tests/__mocks__/electron-api.ts
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不改映像來源（W4a / W4b 的範圍）、不改容器選單（W2）、不改寫設定（W3 / T0850 與本單並行，不要碰 `steps/wsl/write-profile.ts`）。"
  - "🔴 埠映射維持 `-p 127.0.0.1:<P>:9876`（`DOCKER_PUBLISH_HOST`，不得放寬）；不動使用者容器（BUG-111：沿用既有容器時不重設權杖、不改容器設定、取消只停回自己啟動的）。"
  - "🔴 權杖值不得出現在命令列、日誌、錯誤訊息、IPC 回傳給 renderer 以外的地方；舊容器 `--token` 的解析只在 main。child_process 一律 `execFile` + 陣列參數 + timeout，容器名稱過 `/^[a-zA-Z0-9._-]+$/`（CLAUDE.md「Child Process Spawning」）。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。本機 Docker 沒有 engine：不建立 / 啟動 / 刪除容器或映像。"
---

# T0849 — Docker 精靈 W1：權杖與安全修正

## 元資料
- **工單編號**：T0849｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-04 15:18 (UTC+8)
- **規模**：M｜**決策**：D283（U5：新容器不再帶 `--token`）｜**可並行**：T0850（W3）

## 背景
T0848 研究（回報區〈調查結論〉1、3、5，附 `檔案:行`）：「沿用既有容器讀不到權杖」的推論不成立（帶 `--token` 啟動也會寫 `server-token.json`），但現行流程有這些問題：建立新容器把 `--token` 放在 `docker run` 參數（`docker-lifecycle.ts:268`，`docker inspect` / 程序列表看得到）；沿用既有容器在 `docker start` 後、等 healthy **之前**就 `exec cat`（`:283-284`）；讀不到時 `allowFailure` 不報錯，最後在 connect-test 顯示看不出原因的 `PRECONDITION_MISSING`；`docker:inspect-container` 把 `Config.Env` 整串回傳給 renderer（`docker-detect.ts:103`）；`listContainers` 等 docker 呼叫沒有 timeout。

## 任務
1. **建立新容器不帶 `--token`**：server 第一次啟動自己產生並寫檔（`loadOrGenerateToken`，`electron/remote/headless-entry.ts`）；精靈在 healthy 後經 `docker exec cat` 讀取，與沿用既有容器同一條路徑。同時加 label `bat.server=1`（W2 的選單用來標「BAT 建立」）。
2. **讀權杖移到 healthy 之後**（兩條路徑都是）。
3. **三段式權杖取得**（只在 main，只回傳 token 本身）：
   1. 路徑：`docker inspect` 的 `Config.Cmd` / `Entrypoint` 有 `--data-dir <d>` → `<d>/server-token.json`；否則依 `Config.Env` 的 `XDG_DATA_HOME` / `HOME` 推算；最後 `/root/.local/share/bat-server`。
   2. 舊容器 fallback：檔案讀不到、但 `Config.Cmd` 有 `--token <t>` → 用 `<t>`。
   3. 都沒有 → 新錯誤碼 `docker-token-unavailable`（error-mapper＋三語文字：確認容器跑的是 bat-server、看 `docker logs`），取代現在的 `PRECONDITION_MISSING`。
   - 不重新簽發權杖。
4. **`docker:inspect-container` 不回傳 env**：renderer 只用 `image` / `state`；確認所有 consumer 後從回傳形狀移除 `env`（型別一併改）。
5. **timeout**：`listContainers`、`execDocker` 與其他 docker `execFile` 補 timeout（偵測類 5 s、IO 類 30 s；既有 `docker run` / 等 healthy 的時限照舊）。
6. **測試**：純函式（權杖路徑推算、`--token` 解析、`docker run` 參數組裝斷言「沒有 `--token`、只綁 127.0.0.1、有 label」）；main 以既有 `setExecFileImplForTests` 模式 mock；`headless-server.test.ts` 補「帶 `opts.token` 時 `server-token.json` 寫入且內容相同」（T0848 的探測腳本是雛形）；精靈流程 `docker-flow.test.ts` 更新。

### 驗收條件
- [x] 上述測試通過；既有 docker / 精靈 / headless 測試不回歸
- [x] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npx vite build` 成功
- [x] 回報區列出 `--token`、`env` 在程式碼中已不再出現的 grep 證據（權杖值相關）
- [x] 若 WSL 內有可用的 Docker（T0743 的環境），可選跑 `BAT_E2E_T0743_DOCKER=1` 的 T0743 spec；沒有就在回報區列〈待實機驗收〉
- [x] commit 只含本單範圍

---

## 回報區

### 待塔台決策

#### Q-1：權杖改成 healthy 後讀取，affects_files 外有 3 個測試檔必須跟著改，可以改嗎？
- 提問時間：2026-11-04T15:30:00+0800
- 背景：精靈改成 healthy 後呼叫新的 `docker.readServerToken`，`startContainer` 不再收 / 回 `token`（任務 1、2）。以下 3 個不在 affects_files 的測試仍 mock 舊行為，現在失敗（不是產品回歸，是行為依工單改變）：
  - `src/components/setup-wizard/__tests__/wizard-jump-rollback.test.ts`（3 例；mock 缺 `readServerToken`）
  - `src/components/setup-wizard/__tests__/wizard-rollback-ownership.test.ts`（5 例；mock 缺 `readServerToken`，另有 1 例斷言 T0452「重試沿用 `docker run` 時的 token」，要改成「重試後讀到容器的權杖」）。🔴 這個檔 T0850 正在改，工作樹裡有 T0850 未 commit 的修改。
  - `tests/__mocks__/electron-api.ts`（legacy harness，`test:legacy` 的 docker 精靈測試 8 處失敗；加 `readServerToken`、拿掉 `startContainer` 的 token）
- 選項：[A] 三個都改；`wizard-rollback-ownership.test.ts` 只 stage 我自己的 hunk（`git diff` 產 patch → `git apply --cached`，不 commit T0850 的修改；若 T0850 先 commit 就直接 `git commit --only`）/ [B] 只改 jump-rollback 與 legacy mock，`wizard-rollback-ownership.test.ts` 交給 T0850 順手改（T0850 會先紅燈）/ [C] 其他：________
- Worker 建議：[A]。這三處是本單行為變更的直接後果，留著 `test:unit` / `test:legacy` 就不會全過，達不到驗收；精確 stage 可以避開 T0850 的修改。
- 影響範圍：上列 3 個測試檔；驗收「`npm run test:unit` 全過」與 `test:legacy`。
- 阻塞：否（先做 headless-server 測試、docker-flow 測試與其他驗證）；commit 前要等答覆。
- **答覆（BAT 通道）**：塔台 15:30 經 `--answer` 選 [A]：三個都改；T0850 已於 15:24 commit（`c0ace27e`），ownership 檔工作樹沒有它的未提交修改，直接 `git add` 明確路徑即可；`tests/__mocks__/electron-api.ts` 只改既有檔、不在 `tests/` 新增檔（D177）；三個檔補進 affects_files。→ 已照做（見〈互動紀錄〉）。

### 完成狀態

- **狀態**：DONE（Worker 步驟全部完成；Docker 實機項目列在〈待實機驗收〉）。
- **一句話結論**：建立新容器不再帶 `--token`、加 label `bat.server=1`；兩條路徑都在容器 healthy **之後**才經新的 `docker:read-server-token` 讀權杖（資料目錄推算 → 舊容器 `--token` → `docker-token-unavailable`），只有權杖本身回到 renderer；`docker:inspect-container` 不再回傳 `env`；所有 docker 呼叫都有 timeout。
- **落點檢查**：PASS。
  - C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`。
  - C-1：工單在 REPO_ROOT 底下。C-3：抽查的 5 筆（`electron/docker-lifecycle.ts` 等）都存在，C-0 已 PASS，只記錄。C-2：工單沒有 `branch` 欄位（在 `main`）。
  - 沒有 `CT_HOME`，不是 worktree（無 `branch` / `base_sha` / `validated_sha` 欄位）。
- **BAT 環境**：`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`；`BAT_REMOTE_TOKEN` 已設定；`CT_MODE` = yolo；`CT_INTERACTIVE` = 0。
- **session_id**：ba6e7e92-fb1a-49d6-bcfe-1518b2bbae2c
- **commit**：產品 `36a55028`（19 檔，+835 / −113）；工單另 commit（本次收尾）。沒有 push。工作樹的 `_ct-workorders/_tower-state.md` 修改是塔台的，沒有碰、沒有 commit。

### 變更內容

| 檔案 | 變更 |
|---|---|
| `electron/docker-lifecycle.ts` | `execDocker(args, timeoutMs, allowFailure)`：每個呼叫都寫明 timeout（偵測 `DETECT_TIMEOUT_MS` 5 s：inspect、health；IO `IO_TIMEOUT_MS` 30 s：start / stop / rm / restart / logs / exec；`docker run` 傳 `null` = 照舊不限時，可能要先拉映像）。新增純函式 `buildCreateContainerArgs`（無 `--token`、`--label bat.server=1`、只 `-p 127.0.0.1:<P>:9876`）、`readCommandFlag`（`--x v` / `--x=v`，最後一個為準，同 bat-server `parseArgs`）、`resolveServerTokenPath`（`--data-dir` → env `BAT_SERVER_DATA_DIR` → `XDG_DATA_HOME/bat-server` → `HOME/.local/share/bat-server` → `/root/.local/share/bat-server`，相對路徑以 `Config.WorkingDir` 為基準；順序與 `scripts/bat-server.mjs` `resolveDataDir` + `dataDir.ts` 一致——env `BAT_SERVER_DATA_DIR` 是工單沒列、但 server 實際會讀的一層，所以補上）。新增 `readServerToken`（三段式，不重新簽發、只跑 `inspect` 與 `exec cat`）。`startContainer` 不收也不回 `token`，沿用既有容器時不再 `exec cat`。移除 `randomBytes`。 |
| `electron/docker-detect.ts` | `DOCKER_DETECT_TIMEOUT_MS` = 5 s 套到 `--version` / `info` / `ps` / `inspect`；`inspectContainer` 回傳移除 `env`。 |
| `electron/main.ts` | `docker:start-container` 選項型別拿掉 `token`；新增 `docker:read-server-token`（回傳時丟掉 `source`，只回 `{ ok, token }`；log 只記來源「server-token.json / container --token (legacy)」或錯誤碼與訊息，不記值）。 |
| `electron/preload.ts`、`src/types/electron.d.ts` | `inspectContainer` 型別移除 `env`；`startContainer` 拿掉 `token`；新增 `readServerToken` / `DockerReadServerTokenResult`。 |
| `src/components/setup-wizard/steps/docker/start-server.ts` | 建立新容器不傳 token；拿掉 T0452 的「`docker run` 失敗時記住 token」與 `ctx.state.remoteToken`；`waitForHealthy` 之後呼叫 `readServerToken`，失敗丟 `wizardError(error, errorCode, { name })`。`resolveServerPort` 的錯誤補 `params: { name }`（`docker-inspect-failed` 的文字有 `{{name}}`）。 |
| `src/components/setup-wizard/steps/wsl/connect-test.ts` | `docker-linux` 沒有權杖時改丟 `docker-token-unavailable`（start-server 已先擋下，這是保底）；其他平台照舊 `PRECONDITION_MISSING`。 |
| `src/components/setup-wizard/error-mapper.ts` | `DOCKER_TOKEN_UNAVAILABLE_CODE` + registry 項 `docker-token-unavailable`（start-server / connect-test，retry / cancel，`append-raw`）；`docker-inspect-failed` 的 `stepIds` 加 `start-server`。 |
| `src/locales/{en,zh-TW,zh-CN}.json` | `wizard.docker.error.tokenUnavailable`（確認容器跑的是 bat-server、看 `docker logs {{name}}`）。 |
| 測試 | 見〈驗證〉。 |

### 驗證

- `electron/__tests__/docker-lifecycle.test.ts`：`buildCreateContainerArgs`（沒有 `--token`、只綁 127.0.0.1、有 label、完整參數、`docker run` 無 timeout）、`readCommandFlag` 8 例、`resolveServerTokenPath`（`--data-dir` 兩種寫法、相對路徑、env 三層、空值、預設）、`readServerToken`（檔案兩種格式、舊 `--token` fallback、加密檔 fallback、`docker-token-unavailable` 訊息不含 env / 指令的值、inspect 失敗、只跑 inspect / exec cat、名稱不合法不跑 docker）、各呼叫 timeout；既有 T0427 / T0452 例改為新行為。
- `electron/__tests__/docker-detect.test.ts`（新）：status / list / inspect 都是 5 s timeout、逾時回 unavailable、inspect 不含 `env` 且序列化後不含 env / `--token` 的值。
- `electron/remote/__tests__/headless-server.test.ts`：帶 `opts.token` 啟動後 `server-token.json` = `{ encrypted:false, data:<token> }`；server 自己產生的檔案經 `readServerToken`（mock docker 回傳該檔內容）讀回同一個權杖。
- `src/components/setup-wizard/steps/docker/__tests__/start-server.test.ts`：建立新容器不傳 token、healthy 後才讀（含「第一次 `starting`、第二次 `healthy`」的順序斷言）、unhealthy 不讀、自己的容器重跑重新讀、`docker-token-unavailable` 帶 `{ name }`、mapper 對應與三語文字、connect-test 保底錯誤碼。
- `src/components/setup-wizard/__tests__/docker-flow.test.ts`：context 不預帶權杖、步驟順序（start-server 在 fetch-fingerprint / connect-test 之前）、start-server 可重試。
- Q-1 的三個檔：mock 加 `readServerToken`、拿掉 token / env；ownership 檔 T0452 兩例改成「重試後從容器讀權杖、state 不留權杖」。
- 閘門（產品程式碼與 `36a55028` 相同，跑在 commit 前的工作樹）：
  - `npm run typecheck` = 0、`npm run typecheck:electron` = 0
  - `npm run test:unit`：436 files passed / 3 skipped；7795 tests passed / 40 skipped
  - `npx vite build`：成功
  - `npm run test:legacy`：32 / 33 files、471 / 472 tests。唯一失敗是 `tests/docker-flow-journeys.test.ts` Journey 3（`second.createdProfileId` 期望 `docker-rebuild`、實際 `undefined`）。🔴 **不是本單造成**：在不含本單改動的乾淨 HEAD（`be1d218a`，暫用 `git worktree` 於 scratchpad，跑完已移除）上同樣失敗；原因是 T0850（`c0ace27e`）讓同容器重跑改為更新既有設定，不再新建 profile，這個 legacy 測試沒跟著改。見〈後續建議〉。
- **grep 證據**（權杖值相關）：
  - `electron/docker-lifecycle.ts`、`electron/docker-detect.ts`、`steps/docker/*.ts` 裡 `--token` 只剩註解與 `readCommandFlag(…, 'token')`（舊容器 fallback 的解析，只在 main）與錯誤訊息裡的「has no --token」字樣；沒有任何地方組出 `--token` 參數。`randomBytes` 在 docker-lifecycle 0 處。
  - `main.ts` / `preload.ts` / `electron.d.ts` 的 `startContainer` / `start-container` 行沒有 `token`（grep 計數 0）。
  - `env`：`docker-detect.ts` 只剩說明註解；`preload.ts` / `electron.d.ts` 沒有 `env: string[]`。`docker-lifecycle.ts` 的 `Config.Env` 只在 `envValue` 讀 `BAT_SERVER_DATA_DIR` / `XDG_DATA_HOME` / `HOME` 推路徑，值不離開 main、不進訊息。
- 權杖不進日誌：`execDocker` 不記參數或輸出；`docker:read-server-token` 只記來源或錯誤；錯誤訊息只含容器名稱與檔案路徑。

### 待實機驗收

本機 Docker 只有 client、沒有 engine（同 T0743 / T0848），沒有建立 / 啟動任何容器，`BAT_E2E_T0743_DOCKER=1` 的 T0743 spec 沒有跑。實機要確認：

1. 建立新容器：`docker inspect <name>` 的 `Config.Cmd` 沒有 `--token`、`Config.Labels` 有 `bat.server=1`、`HostConfig.PortBindings` 只有 `127.0.0.1`；精靈連線成功；debug log 有 `[wizard] docker read-server-token: from server-token.json`。
2. 沿用以 `--token` 建立的舊容器：連線成功（檔案或 `--token` 任一來源）。
3. 沿用一個停止中、從未跑過的容器：等 healthy 後才讀，第一次啟動不再拿不到權杖。
4. 沿用不是 bat-server 的容器（或刪掉 `server-token.json`）：start-server 顯示 `tokenUnavailable` 文字，不是 connect-test 的通用錯誤。

### 遭遇問題

- 第一次用 heredoc 寫 node 改檔腳本時 bash 解析失敗（引號／反引號），改用 Edit 工具；`docker-detect.ts` 是 CRLF，字串錨點比對失敗，同樣改用 Edit。
- Q-1：三個 affects_files 外的測試檔必須跟著改（見〈待塔台決策〉）。

### 後續建議

- **T0850 的 legacy 回歸**：`tests/docker-flow-journeys.test.ts` Journey 3 在 `c0ace27e` 之後失敗（見〈驗證〉），`pre-release.yml` / `release.yml` 的 Test gate 會因此擋下發版。建議由 T0850 系列補一張小單改這個測試的期望（重建同名容器應更新既有設定，而非 `createdProfileId`）。
- `docs/docker-deployment.md:132`、`:137` 仍寫「Generated by BAT and passed as `--token`」「`docker start` 之後讀」，與本單行為不符；不在本單 affects_files，建議併入 PLAN-052 的文件工單更新。

### 互動紀錄

- [15:30] Q-1: affects_files 外 3 個測試檔要不要改 → A（塔台）: [A] 三個都改，ownership 檔直接 `git add`（T0850 已 commit）、mock 只改既有檔、補進 affects_files → Action: 三檔已改並補進 frontmatter `affects_files`，隨產品 commit `36a55028` 提交；frontmatter `tower_question` 已刪除。
