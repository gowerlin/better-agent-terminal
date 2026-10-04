---
schema_version: 1
schema_kind: workorder
id: T0434
title: "PLAN-036 P3 / K 工單 4：遠端 Tower 端到端驗收（vitest headless harness 跑真 helper）+ smoke 項 + 文件"
type: implementation
status: DONE
repo: better-agent-terminal
project: PLAN-036
priority: P2
sizing: M
created_at: "2026-10-05T05:49:04+08:00"
started_at: "2026-10-05T06:41:55+08:00"
updated_at: "2026-10-05T07:06:45+08:00"
completed_at: "2026-10-05T07:06:45+08:00"
target_version: next
depends_on:
  - T0431
  - T0432
  - T0433
  - T0447
  - T0448
related:
  - "T0445 安全 review BLOCK（`2161b7e`）：#1-#4 修正（T0447 / T0448）後才可進實機；harness 端到端需含 T0447 的負向情境（撤銷後 pipelined frame 被拒）"
  - "T0420 研究回報區「各單內容」工單 4、§3 端到端流程"
  - "T0396 `npm run smoke:remote:headless`（S1-S12）；T0391 `deploy:headless:dev`"
  - "D134 追加（K 實作）"
affects_files:
  - electron/remote/__tests__/
  - scripts/smoke-remote-headless.mjs
  - scripts/__tests__/
  - CLAUDE.md
  - docs/remote-dev-overview.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **不部署 WSL、不 restart 服務**：WSL 部署與真 BAT 遠端視窗實機由塔台 / 使用者執行。本單產出 (a) vitest harness 端到端測試、(b) smoke 新增項目（對已部署 server 才會跑，本單只需對**目前 WSL server 跑時能正確 SKIP 或標示版本不足**，不得因舊 server 而紅）、(c) 文件、(d) 回報區的實機步驟。"
  - "🔴 `_ct-workorders/_local-rules.md` 為塔台私有檔，**不改**；需要更新的「Auto-Session 路由規則」遠端分支內容寫在回報區，由塔台套用。`CLAUDE.md` 可改（新增遠端 Tower 通知小節：權杖範圍、env key、限制）。"
  - "🔴 harness 測試跑真 node helper 子行程：Tower PTY → `bat-terminal.mjs` → `created-externally` → `bat-notify.mjs` → `notified` + `keypress`；以及負向：權杖越權呼叫被拒。測試需在 Windows 本機可跑（helper 子行程以 `process.execPath` + array args spawn）。"
  - "🔴 **塔台 06:38 追加（T0433 遭遇問題 4）**：`scripts/dev-deploy-headless.mjs` 目前只替換 esbuild 產物、不部署 `scripts/` helper → `deploy:headless:dev` 後遠端 `<installRoot>/scripts/` 不存在、helper env 不注入（安全降級）。本單擴充 dev-deploy 一併複製 T0433 的 `serverBundleHelperScripts`（沿用其清單 SoT，含 dry-run / `.bak-<tag>` / `--rollback` 行為與測試），否則實機驗收無從進行。`affects_files` 視為含 `scripts/dev-deploy-headless.mjs`。"
  - "🔴 依賴 T0431 / T0432 / T0433。開工前 `git log --oneline -10` 確認。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push。"
---

# T0434 — 遠端 Tower 端到端驗收 + 文件（K 工單 4）

## 範圍

依 T0420「各單內容」工單 4：
1. vitest headless harness 端到端（memory_overrides 第 3 條）
2. `smoke:remote:headless` 新增 S13（遠端 PTY 內 `BAT_*` key 清單正確、無 server token；helper 可對 headless 開分頁）——對舊 server 正確 SKIP
3. `CLAUDE.md` 新增「遠端 Tower 通知（PLAN-036 K）」小節；`docs/remote-dev-overview.md` 補對應段
4. 回報區：`_local-rules.md` 建議修訂文字 + 使用者實機步驟（WSL 部署後在真 BAT 遠端視窗從遠端 Tower 派一張測試單；前提：遠端 `~/.claude/skills` 已裝 control-tower 系列 skill）

## 驗收條件

- [x] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 40
- [x] smoke 對目前 WSL server 執行結果附回報區（新項 SKIP 而非 FAIL）——若無法連 WSL，註明未執行
- [x] PLAN-036 檔 P3 段補 K 完成註記（T0431-T0434 + commit）

## Sub-session 執行指示
1. 讀本工單 + T0420 / T0431 / T0432 / T0433 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單 + PLAN-036；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**

- **落點檢查**：PASS —— C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 PASS；C-3 present（`electron/remote/__tests__/`、`scripts/smoke-remote-headless.mjs`、`scripts/__tests__/`、`CLAUDE.md`、`docs/remote-dev-overview.md` 皆存在）；C-2 不適用（無 `branch` 欄位，HEAD=`main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 派發環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`
- 依賴確認：開工時 `git log` 含 `9fa2cc3`（T0431）、`aec20c0`（T0432）、`ec4ca56`（T0433）、`2ed593f`（T0447）、`5bfeb08`（T0448）；工作期間另有 `c186c81`（T0449）、`7effa79`（T0450）提交，本單已對齊（見遭遇問題 1）
- 驗收條件：
  - [x] `npm run test:unit`：**154 files / 2466 passed / 1 skipped / 0 failed**；`npx tsc --noEmit` = **36**（≤ 40；本單檔案 0 筆）
  - [x] smoke 對目前 WSL server：**12/13 PASS + S13 SKIP（server too old，不算失敗），exit 0**，無殘留 PTY（詳見下）
  - [x] PLAN-036「P3 進度」補 K 完成註記（T0431-T0434、T0447-T0450 + commit）

### 產出摘要

**1. vitest 端到端 harness**（新檔 `electron/remote/__tests__/headless-remote-tower-e2e.test.ts`，7 tests）

真 headless server（T0388 harness，in-process）+ 真 wss + 真 node-pty + **真 helper**。與 T0433 不同：helper **在 PTY 內**執行——測試對 PTY 打 `node driver.cjs job.json`，driver 是 PTY shell 的子行程（持有該 shell 的真實 env），以 `process.execPath` + array args spawn helper，結果寫檔；job args 的 `{env:NAME}` 代表 PTY 自己的 `$NAME`（= Tower 打 `"$BAT_TERMINAL_ID"`）。Windows 本機可跑（PowerShell 預設 shell）。

| # | 情境 | 斷言 |
|---|---|---|
| 1 | Tower PTY（`workspaceId` = client workspace） | `BAT_*` 恰 8 key；`BAT_WORKSPACE_ID` / port 正確；env 無 server token；權杖 verify 為 `tower` |
| 2 | Tower PTY 內 `bat-terminal --skill ct-exec --workorder T9434 --notify-id {env:BAT_TERMINAL_ID} --workspace {env:BAT_WORKSPACE_ID} --mode yolo --no-interactive` | exit 0；BAT client 收 `terminal:created-externally`（同 workspace、command 含 `/ct-exec T9434`）；worker shell 真的執行了 agent 指令；worker env：`BAT_TOWER_TERMINAL_ID` = tower、`CT_MODE=yolo`、`CT_INTERACTIVE=0`、權杖為綁該 tower 的 `worker`、無 server token |
| 3 | worker PTY 內 `bat-notify --source T9434 --submit "T9434 完成"` | exit 0；`terminal:notified`（targetId = tower）+ `terminal:keypress`（Enter / submit）；Tower PTY 收到預填文字；模擬 renderer 合成 Enter（client `pty:write '\r'`） |
| 4 | worker 越權 | worker 派單 → `Forbidden: role-not-allowed` exit 1、無新分頁；worker 對旁觀 PTY notify/write → `Forbidden` exit 1、旁觀 PTY 無文字、無 notified 事件 |
| 5 | Tower 越權 | raw command → `Forbidden: channel-not-allowed`；Tower 對 worker notify/write → `role-not-allowed`、worker 無文字；未知 agent → `Forbidden: agent-not-allowed`（T0450，S13 依賴此行為） |
| 6 | **T0447 負向**：worker 權杖已認證的 socket，worker PTY 被 kill 後 pipelined `[ping, pty:write(tower), pty:create(evil)]` | close code `1006`（terminate）、`invokeHandler` spy **0 次**、evil PTY 不存在、Tower 無文字；真 `bat-notify` 用死掉的 worker env → `Authentication failed: Capability revoked` exit 1 |
| 7 | **no-client**：Tower 再派一個 worker；job 延遲 1.5 s 期間唯一 BAT client 斷線 | `bat-notify --submit` exit 1、`terminal keypress failed: no-client`（yolo 不假裝送出）；收尾 kill 全部 PTY → registry 清空 |

穩定性：單檔連跑 4 次皆 7/7（約 8 s）。

**2. smoke S13**（`scripts/smoke-remote-headless.mjs`）
- 自建第 4 個 smoke PTY（`smoke-…-tower`，帶 `workspaceId`），打一行 shell：列 `BAT_*` **key 名**（不印值）、以 sha256 比對「有幾個 env 值等於 server token」（**server token 本身從不打進 PTY**，只打 digest；無 `sha256sum` → `x` → FAIL）、`BAT_REMOTE_TOKEN` 長度（43 = T0432-T0448；50 = T0449 `batcap.` 前綴）
- **無 helper env**（`BAT_HELPER_DIR` / `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` 皆無）→ `SKIP` + `reason: 'server-too-old'`；`summarize` 把此類 SKIP 視同 WARN（不算失敗），其他 SKIP（前置失敗）仍算失敗；CLI 印 `SKIP S13 … — server too old for this check (not a failure)`、`RESULT: 12/13 PASS, 1 SKIP (server too old)`
- 有 helper env：key 集合須精確、無 token、長度合法 → 在**同一 PTY 內**跑真 `bat-terminal.mjs`（node 優先 `$BAT_HELPER_DIR/../bin/node`，否則 `node`）：①raw command 必須 `Forbidden: channel-not-allowed`；②未註冊 agent `bat-smoke-unregistered-agent` 必須以 tower 角色到達 create-agent-command 且不建任何分頁（T0450+ `Forbidden: agent-not-allowed`；T0433-T0449 為授權但無 launch command，以 `pty:get-cwd` 確認未建立）。**不啟動任何 agent**；raw 探測若認證失敗即不跑第二次（避免累積失敗）；探測若意外建出分頁 → FAIL 並在 cleanup kill
- cleanup 對 `…-tower`（與意外分頁）做 existence probe
- `scripts/__tests__/smoke-remote-headless.test.mjs`：fake server 加 S13 模擬（`helperEnv` full/none/partial/leak/nosha、`helperRaw`、`helperAgent` false/not-allowed/refused/created）；新增 PASS / T0450 PASS / 舊 server tolerated SKIP / 6 種 FAIL（仍清乾淨）/ summarize 規則 / probe 指令與 regex（回顯不誤配、不含 token）/ 判定函式；**drift 守門**：`REMOTE_TOWER_ENV_KEYS` = `buildHeadlessHelperEnv` 實際 key + 3 個共通 key、權杖長度 ∈ 允許集合（此守門當場抓到 T0449 前綴改動，見遭遇問題 1）。81 → 91 tests
- 指令在真 Git Bash 下驗證過：新版 env → `[8 keys]:[0]:[43]`；外洩 → token 命中數 2；舊版 → 無 helper key；三者的指令回顯皆不匹配結果 regex

**3. `deploy:headless:dev` 一併部署 helper**（塔台 06:38 追加，`scripts/dev-deploy-headless.mjs`）
- `parseHelperScripts` / `loadHelperScripts`：清單取自 `build-server-bundle.mjs` 的 `serverBundleHelperScripts`（SoT，與 bundle build、`verify-helper-bundle.js` 同源；不存在 / 空 / 非法檔名即 throw，不 fallback）；`stageHelperScripts` 複製到 `dist-server/dev-deploy-headless/scripts/`
- 部署到 `<installRoot>/scripts/`（不存在則建立；dry-run 不建），plan / FILE 行名稱為 `scripts/<name>`，沿用 `.bak-<tag>` / `.absent` / `--rollback`；WSL bash 腳本改為每組一段（JS 組仍要求 `electron/remote` 存在、`--expect-string` 只檢 JS 組；helper 組非必要、只在 deploy `mkdir -p`）；dir target 的 `inspectDir` / `deployDir` / `rollbackDir` 加 `subdir` / `allowMissing` / `create` / `prefix` 選項（預設值 = 原行為）
- 已知：`--rollback` 後由 deploy 建立的 `scripts/` 目錄留空（無害；`buildHeadlessHelperEnv` 檢查 helper 檔存在）
- 測試新增 7 個（檔案共 36）：清單解析（真 build script + 3 種 fail-fast）、staging、dir helper 組備份/還原、`main()` dry-run 列出 `scripts/* action=create` 且不建目錄、**`main()` dir target `--yes` 部署 + `--rollback --yes`**（helper sha 與 repo 一致）、bash 腳本結構、**Git Bash 實跑 helper 組 round-trip**

**4. 文件**
- `CLAUDE.md` 新增「遠端 Tower 通知（PLAN-036 K）」：env key、權杖範圍表（含 T0449/T0450 規則）、生命週期、限制（agent 模式派單、no-client、node 路徑、codex、skills 安裝、單一 remoteClient、本機仍全權 token）、驗證方式
- `docs/remote-dev-overview.md`：dev deploy 段補 helper 部署；smoke 表加 S13、`--json` exit code 規則、`…-tower` PTY；新增「Remote Tower notification (PLAN-036 K)」段（env 表、權杖範圍、端到端流程、限制、驗證）

**5. 證據分道**

| 證據道 | 結果 | 內容 |
|---|---|---|
| `npm run test:unit` | PASS | 154 files / 2466 passed / 1 skipped（含並行 Worker 的未提交改動，見遭遇問題 4） |
| `npx tsc --noEmit` | PASS | 36（≤ 40；本單 0） |
| 本單 3 檔 | PASS | e2e 7 + smoke 91 + dev-deploy 36 |
| `npm run verify:helpers` | PASS | `server bundle ships 4 helper(s) with a closed import set` |
| WSL smoke（runtime，client-only） | PASS（S13 SKIP） | 見下 |
| `npx vite build` / `npm run test:e2e` | 未跑 | 依工單 L141 禁止 |
| WSL 部署 / 真 BAT 遠端視窗實機 | 未做 | 依工單禁令，交塔台 / 使用者（步驟見下） |

**WSL smoke 原始結果**（2026-10-05T07:00:47+0800，`npm run smoke:remote:headless -- --target wsl:Ubuntu-24.04`，server `bundle=0.5.9-pre.4`、`env=wsl`、`127.0.0.1:9877`）：S1-S12 PASS；`SKIP S13 … — remote PTY has no helper env (BAT_* = BAT_SESSION,BAT_TERMINAL_ID,BAT_WORKSPACE_ID): server predates T0433, or <installRoot>/scripts has no helpers (dev deploy before T0434) — version insufficient`；`[smoke] RESULT: 12/13 PASS, 1 SKIP (server too old)`；cleanup 4 個 smoke PTY 皆 `pty-not-found`；**exit 0**。未 restart / 未部署 / 未寫入 WSL。

**6. 建議：`_local-rules.md`「Auto-Session 路由規則」遠端分支修訂文字**（本單不改該檔，由塔台套用）

> ⚠️ 現行規則的 `node "$BAT_HELPER_DIR/bat-terminal.mjs" claude "/ct-exec T####"` 是 **raw command 模式**（`terminal:create-with-command`），遠端權杖一律 `Forbidden: channel-not-allowed`；且 WSL 測試機 PATH 上沒有 `node`（smoke S10 `node=missing`）。

建議將「路由決策樹」的 `BAT_SESSION=1` 分支改為：

```
├─ BAT_SESSION=1（在 BAT 終端：本機分頁，或遠端 WSL / SSH / Docker 視窗的分頁）
│  ├─ BAT_HELPER_DIR + BAT_REMOTE_PORT + BAT_REMOTE_TOKEN 皆有
│  │  └─ N="$BAT_HELPER_DIR/../bin/node"; [ -x "$N" ] || N=node
│  │     "$N" "$BAT_HELPER_DIR/bat-terminal.mjs" --skill ct-exec --workorder T#### \
│  │       --notify-id "$BAT_TERMINAL_ID" --workspace "$BAT_WORKSPACE_ID" [--mode yolo] [--no-interactive]
│  │     → 本機：RemoteServer（全權 token）；遠端：headless bat-server（每 PTY 權杖，PLAN-036 K）
│  │     → 新分頁出現在 Tower 所在視窗 / workspace
│  └─ 任一缺少（遠端舊 server、helper 未部署）→ 直接走降級鏈；不要先嘗試 node "/bat-terminal.mjs"
```

Bash 白名單建議改列 agent 模式（本機與遠端通用；`$BAT_HELPER_DIR/../bin/node` 在本機不存在時自動用 `node`）：

| 用途 | 指令 | 條件 |
|---|---|---|
| BAT 終端（本機 / 遠端） | `"$N" "$BAT_HELPER_DIR/bat-terminal.mjs" --skill ct-exec --workorder T#### --notify-id "$BAT_TERMINAL_ID" --workspace "$BAT_WORKSPACE_ID"` | `BAT_SESSION=1` 且 helper env 齊全 |
| 同上（ct-done） | `… --skill ct-done --workorder T#### …` | 同上 |

補充說明（可併入同節）：遠端分頁可由 `BAT_REMOTE_TOKEN` 以 `batcap.` 開頭辨識（T0449，僅 headless 每 PTY 權杖有此前綴）；遠端 `--submit` 需有 BAT client 連著，否則 `bat-notify` exit 1（`no-client`）→ 走手動訊息；遠端 `~/.claude/skills` 需另裝 control-tower 系列 skill。

**7. 使用者實機步驟**（WSL；本單未執行）

前提：BAT 本體為含 T0431 renderer 改動（遠端 `created-externally` 不 fallback）的新 build，或以 `npm run dev` 執行；WSL 內 `~/.claude/skills` 已裝 control-tower / ct-exec 系列 skill（ct-exec 的 notify 也須用 `"$BAT_HELPER_DIR/../bin/node"` 或 PATH 上有 node）。

1. 部署（本機 repo）：`npm run deploy:headless:dev -- --target wsl:Ubuntu-24.04`（dry-run：確認 `scripts/bat-terminal.mjs` 等 4 檔 `action=create`）→ `npm run deploy:headless:dev -- --target wsl:Ubuntu-24.04 --yes --tag t0434 --expect-string batcap.`（預期 `IS_ACTIVE active`、`✅ deployed sha256 matches built output`）
2. `npm run smoke:remote:headless -- --target wsl:Ubuntu-24.04` → 預期 **13/13 PASS**（S13 列出 8 個 key、`raw command → Forbidden: channel-not-allowed`、`bat-smoke-unregistered-agent → Forbidden: agent-not-allowed (T0450+)`）
3. BAT 開 WSL 遠端 profile 視窗 → 開終端分頁 → `env | grep ^BAT_ | cut -d= -f1 | sort`：應恰為 `BAT_HELPER_DIR` / `BAT_HELPER_LOG_DIR` / `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` / `BAT_SERVER_CERT_PATH` / `BAT_SESSION` / `BAT_TERMINAL_ID` / `BAT_WORKSPACE_ID`
4. 同分頁啟動 claude 當遠端 Tower，建一張測試單（例如只改一個暫存檔的 DONE 單），以第 6 節指令派單 → 遠端視窗**同 workspace** 出現 Worker 分頁並執行 `/ct-exec T####`
5. Worker 完成 → Tower 分頁出現 toast + badge、預填 `T#### 完成`；yolo（`--submit`）自動送出
6. 負向（選做）：Worker 執行期間關閉 BAT → Worker 的 `--submit` 應 exit 1（`no-client`）並給手動訊息；重開 BAT 後 Tower 分頁仍有預填文字
7. 回復：`npm run deploy:headless:dev -- --target wsl:Ubuntu-24.04 --rollback --yes --tag t0434`（JS 還原、helper 移除；`scripts/` 目錄留空）

### 遭遇問題

1. **並行提交 T0449 / T0450 改變權杖行為（已對齊）**：開工後 `c186c81`（T0449：權杖加 `batcap.` 前綴 → 長度 50；撤銷權杖回 `Capability revoked`）與 `7effa79`（T0450：未知 agent → `agent-not-allowed`、spawn 配額、pty:write 只收可列印文字）先後提交。e2e 的撤銷訊息、S13 的長度判定與 agent 探測判定已改為同時接受 T0433-T0449 與 T0450+ 行為；S13 的 drift 守門（`buildHeadlessHelperEnv` 實際 token 長度）當場抓到 T0449 的長度改動
2. **現行 `_local-rules` 派單指令在遠端不可用**：raw command 形式被權杖拒絕、WSL 無 `node`（見第 6 節）。另 **ct-exec skill（非本 repo）** 的 Worker notify 指令 `node "<helper>/bat-notify.mjs"` 在遠端同樣需改用 `"$BAT_HELPER_DIR/../bin/node"` —— 建議塔台另案通知 skill 維護（或後續在 headless env 加 `BAT_HELPER_NODE` / 把 `<installRoot>/bin` 加進 PTY PATH，屬 headless-entry 改動，不在本單範圍）
3. **既有行為（未改，記錄）**：`bat-terminal.mjs` 對 server 回 `false`（未建立）仍印 `✓ Terminal created` 並 exit 0（只把 `{ ok:false }` 物件當拒絕）。T0450 後未知 agent 已在授權層被拒，實務影響變小；S13 對 T0433-T0449 server 以 `pty:get-cwd` 確認未建立，不依賴該輸出。建議另案讓 bat-terminal 把 `false` 視為失敗（會影響本機路徑，需塔台裁決）
4. **並行 Worker 改動**：工作樹另有 `electron/remote/remote-server.ts`（T0451，未提交）、T0436 / T0441 等改動；`test:unit` 全綠是在含這些未提交改動的工作樹上跑的。本單 commit 以 `git commit --only` 只帶本單路徑，未碰他單檔案；未用 stash / reset / checkout / restore
5. **Windows 文字模式寫檔踩到 CRLF**：以 Python 修補時曾寫出 CRLF（repo 為 LF），shebang 行帶 `\r` 使 vitest 轉譯報 `SyntaxError: Invalid or unexpected token`；已全部轉回 LF（`file` 確認），後續修補改用二進位寫入
6. `AttachConsole failed` stderr 雜訊（node-pty conpty kill 路徑）在全套測試中出現，測試全綠；與 T0447 遭遇問題 1 同一現象，未深究

**Commit**：`git add` 新測試檔後 `git commit --only` 本單 9 個路徑（`CLAUDE.md`、`docs/remote-dev-overview.md`、`scripts/dev-deploy-headless.mjs`、`scripts/smoke-remote-headless.mjs`、`scripts/__tests__/dev-deploy-headless.test.mjs`、`scripts/__tests__/smoke-remote-headless.test.mjs`、`electron/remote/__tests__/headless-remote-tower-e2e.test.ts`、本工單、PLAN-036）；未 push、未部署 WSL。hash 見 `git log`（回報區於 commit 前寫入，不自我引用）。

### 回報時間

2026-10-05T07:05:01+08:00
