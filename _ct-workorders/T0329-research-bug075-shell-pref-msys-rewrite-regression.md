# T0329 — Research BUG-075 Root Cause（shell pref 失效 + MSYS path rewrite 雙 regression）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0329 |
| 類型 | research（root cause 偵察 + git log diff + reproduce isolation） |
| 所屬 | BUG-075 — BAT terminal shell pref + MSYS path rewrite regression |
| 狀態 | ✅ DONE |
| 建立時間 | 2026-04-27 13:05 (UTC+8) |
| 派發時間 | 2026-04-27 13:54 (UTC+8) — session 37 起手手動派發 |
| 開始時間 | 2026-04-27 13:58 (UTC+08:00) |
| 完成時間 | 2026-04-27 14:02 (UTC+08:00) |
| Sizing | M（estimate 30-60 min wall；3 phase 偵察 + reproduce + candidate fix 提案） |
| 依賴 | BUG-075 / BUG-060 closed 工單（T0281 fix `fad2978`）/ `scripts/bat-terminal.mjs` 現況 |
| 後續 | 拍板後拆 1-2 張 fix 工單（symptom A / symptom B 或合併） + 1 張 regression test 工單 |
| 互動旗標 | `--mode ask --interactive`（允許 Worker 在 hypothesis 收斂時提問澄清） |
| Renew 次數 | 0 |
| 工作目錄 | main repo（純讀取 + git log） |
| `affects_files` | `_ct-workorders/T0329-*.md`（自身回報區） + 可能更新 `BUG-075-*.md`（補根因確認） |

## 背景

BUG-060 (`fad2978`, T0281, 2026-04-26 13:20) 修復 YOLO 鏈式派發 shell preference 失效。22 小時後 (2026-04-27 13:00) 再現同族症狀**外加** MSYS path rewrite 第二症狀，塔台派發 T0328 完全斷鏈。

兩症狀觀察：

| 症狀 | 描述 |
|------|------|
| **A** shell pref 失效 | 「default 終端沒照設定用 git bash」（user 報告） |
| **B** MSYS rewrite | `/ct-exec T0328` 在 codex agent 內變成 `C:/Program Files/Git/ct-exec T0328`，被當 binary 拒絕執行 |

## 研究目標

回答以下 4 個核心問題：

1. **症狀 A 與 B 是否同根因？** 還是兩個獨立 regression（A 是 BUG-060 fix 回滾 / B 是新引入的 MSYS path 處理問題）？
2. **症狀 A 根因？** BUG-060 fix `fad2978` 是否還在？被覆蓋還是被條件 short-circuit？
3. **症狀 B 根因？** `/ct-exec T0328` 在哪一層被 path-rewrite？bat-terminal.mjs / electron child spawn / agent CLI / Git Bash MSYS conversion?
4. **Candidate fix 提案？** 對 A 和 B 各給 1-2 個 candidate fix，含 regression test 設計

## 範圍（3 Phase + 1 收斂）

### Phase A：Git log 偵察

**A.1 Commit history 比對**

```bash
# T0281 fix commit 之後到 HEAD 的所有 commits
git log fad2978..HEAD --oneline -- scripts/bat-terminal.mjs electron/pty-manager.ts electron/terminal-*.ts src/components/Terminal/*

# 候選 regression commit 篩選
git log fad2978..HEAD --grep="terminal\|shell\|spawn\|msys\|path" --oneline
```

**紀錄項**：
- 影響 `bat-terminal.mjs` / terminal spawn / shell preference resolution 的 commits
- 影響 path / env / MSYS handling 的 commits
- 任何看似「重構 terminal 模組」的 commits（高風險）

**A.2 BUG-060 fix 落點驗證**

讀取 `fad2978` 的 commit diff：

```bash
git show fad2978
```

**確認**：
- T0281 修在哪個檔案 / 哪個函式
- 修改邏輯是什麼（如 `resolveShellPreference()` 補了 fallback）
- 該邏輯目前在 main 還在嗎？被改過嗎？

### Phase B：Reproduce isolation

**B.1 症狀 A 獨立復現**

關掉 BAT，重啟，第一張派發測試：

```bash
node scripts/bat-terminal.mjs --notify-id <id> --workspace <id> --mode ask --interactive --agent default --prompt "/ct-exec T0001"
```

觀察：
- 開啟的終端 shell 是 git bash 還是 PowerShell？
- 與 BAT Settings 中的 default shell 是否一致？

若**第一張就錯** = BUG-060 fix 已失效（H1 證實）
若**第一張對、第二張錯** = L103 fallback bug 重新引入（H2 候選）
若**全程都對但 prompt rewrite 錯** = 純症狀 B，A 是誤判

**B.2 症狀 B 獨立復現**

在 git bash 直接打：

```bash
echo "/ct-exec T0328"  # 看是否被 rewrite
node -e "console.log(process.argv)" /ct-exec T0328  # node 接到的 argv 是什麼
```

確認 path rewrite 發生在哪一層（shell 環境 / node spawn / electron IPC / agent CLI 內部）。

**B.3 環境變數調查**

檢查：
- `MSYS_NO_PATHCONV` 在 BAT 開的終端中有設嗎？
- BAT spawn child terminal 時傳了什麼 env？
- agent CLI（codex）對 `/...` 開頭的 prompt 有特殊處理嗎？

### Phase C：Hypothesis 評分

針對 BUG-075 列的 6 個候選 H，每個給：

| H | 描述 | 證據（支持） | 證據（反對） | 信心度 (0-1) |
|---|------|-------------|-------------|-------------|
| H1 | BUG-060 fix `fad2978` 回滾 | （Phase A.2 結論） | | |
| H2 | 新 commit 引入 regression | （Phase A.1 結論） | | |
| H3 | shell pref store 損壞 | | | |
| H4 | bat-terminal.mjs 沒做 MSYS_NO_PATHCONV | （Phase B.3 結論） | | |
| H5 | codex agent 自身 path 處理 bug | | | |
| H6 | terminal env 沒設 MSYS_NO_PATHCONV=1 | | | |

收斂為**最高信心 H 組合**（可能 1+ 個 H 同時成立）。

### Phase D：Candidate fix 提案

針對收斂後的 H 組合，給 candidate fix：

**對症狀 A**（shell pref 失效）：
- Fix-A1：（依根因設計）
- Regression test：BAT spawn 後第一張 + 第二張 + 第三張 shell preference 一致性 e2e

**對症狀 B**（MSYS path rewrite）：
- Fix-B1：bat-terminal.mjs spawn 時設 `env.MSYS_NO_PATHCONV='1'`（如果是 H6）
- Fix-B2：spawn child terminal 時 prompt 用 base64 / heredoc 包覆避免 shell 解析
- Regression test：模擬 git bash 環境跑 `/ct-exec T0001`，驗證 prompt 不被 mangle

## 拍板項（給塔台）

回報區「拍板項」段落列出**至少 3 項**：

- D候選：症狀 A 與 B 是否合併修（一張 fix 工單）還是分開（兩張）
- D候選：regression test 範圍（unit / integration / e2e）
- D候選：fix 是否獨立 hotfix release（v0.4.2.1）還是併入 v0.4.3 PLAN-032 release

## 驗收條件

回報區必含：

- ✅ Phase A：commit history 比對表 + BUG-060 fix 落點現況
- ✅ Phase B：症狀 A / B 獨立復現結果（含實際 stdout 引用）
- ✅ Phase C：6 H 評分表 + 收斂結論
- ✅ Phase D：對症狀 A / B 各給 ≥1 candidate fix + regression test 設計
- ✅ 拍板項列表（≥3 項）

## 互動模式

`--mode ask --interactive`，最多 3 輪。Worker 在以下情境**應**詢問塔台：

- Reproduce 過程中發現第三個症狀（不在 A/B 範圍）
- 6 H 全部低信心（<0.3），需新 H 候選
- Fix 跨多個子系統（terminal manager / settings store / agent CLI 對接）需大手術

## 參考資料

- BUG-075: `_ct-workorders/BUG-075-bat-terminal-shell-pref-and-msys-path-rewrite-regression.md`
- BUG-060 (CLOSED): `_ct-workorders/BUG-060-yolo-dispatch-shell-preference-not-applied.md`
- T0281 fix commit: `fad2978`
- L103: `_ct-workorders/_learnings.md` § L103 — BAT 內部終端 yolo 派發 shell preference 第二張起 fallback bug 模式
- 派發 script: `scripts/bat-terminal.mjs`

---

## 回報區（Worker 填）

### 完成摘要
完成狀態：DONE

回報時間：2026-04-27 14:02 (UTC+08:00)

結論：
- 症狀 A（shell preference 失效）本次未被證實；目前證據反而支持 BAT 仍依 settings 開 Git Bash。`settings.json` 為 `shell=git-bash`，`resolvePersistedShellPath` 測試通過，且症狀 B 只有在新 Worker PTY 為 Git Bash 時才會二次重現。
- 症狀 B（MSYS path rewrite）已證實，根因是 Git Bash/MSYS 在呼叫 Windows native executable（Node）時會把 `/ct-exec ...` 轉成 `C:/Program Files/Git/ct-exec ...`。`bat-terminal.mjs` 只修正了「塔台呼叫腳本時」被污染的 argv，沒有保護「新 Git Bash PTY 中啟動 codex 時」的 argv。
- 最高信心修法：對 BAT auto-session 建立的 Worker PTY 注入 `MSYS_NO_PATHCONV=1`，至少針對 `terminal:create-agent-command` / `bat-terminal.mjs --prompt` 路徑注入，避免影響一般手動 Git Bash 終端。

產出摘要：
- 更新 T0329 研究回報。
- 更新 BUG-075 根因確認摘要。
- commit：`0a0a752`

### Phase A：Git log 偵察
#### Commit history 比對表

| 範圍 | 結果 | 判讀 |
|---|---|---|
| `git log fad2978..HEAD -- scripts/bat-terminal.mjs electron/pty-manager.ts electron/terminal-*.ts src/components/Terminal/*` | 無輸出 | 工單原列高風險路徑在 `fad2978` 後沒有後續修改。 |
| `git log fad2978..HEAD -- electron/main.ts electron/shell-path-resolver.ts tests/shell-path-resolver.test.ts` | 14 commits touching `electron/main.ts` mostly remote/wizard IPC | 有後續 main process 改動，但 diff 搜尋未看到移除 `resolveConfiguredShellPathSync` 或 terminal create shell resolver。 |
| `git log fad2978..HEAD --grep="terminal\|shell\|spawn\|msys\|path" --oneline` | 命中多個 remote/path/wizard commits，無直接 terminal spawn/shell resolver 變更 | 高風險字串多來自 remote path translator / setup wizard，不是 BAT terminal spawn 主路徑。 |

#### BUG-060 fix 落點現況

`fad2978` 修改：
- `electron/main.ts`：新增 `resolveConfiguredShellPathSync(readPersistedSettingsSync())`，在 `terminal:create-with-command` 建立 PTY 前補 `shell = opts.shell || persisted shell`。
- `electron/shell-path-resolver.ts`：新增 `resolveShellPath` / `resolvePersistedShellPath`，`git-bash` 解析至 `C:\Program Files\Git\bin\bash.exe` 等候選。
- `tests/shell-path-resolver.test.ts`：覆蓋 persisted `git-bash`、custom shell、missing shell 等 cases。

現況：
- `electron/main.ts:1898` 仍保留 `const shell = opts.shell || resolveConfiguredShellPathSync(readPersistedSettingsSync())`。
- `electron/main.ts:1946-1967` 的 `terminal:create-agent-command` 仍轉呼叫 `terminal:create-with-command`，因此仍會走 shell resolver。
- 實機 settings：`{"shell":"git-bash","customShellPath":"","defaultAgent":"codex-cli","codexArgs":"--yolo"}`。
- `npx tsx tests/shell-path-resolver.test.ts` 通過 5/5。

### Phase B：Reproduce isolation
#### B.1 症狀 A（shell preference）

主動建立新 BAT terminal 需要 `BAT_REMOTE_TOKEN`，本 Worker 環境只有 `BAT_REMOTE_PORT=9876`，沒有 token，因此沒有再開新 terminal 以免產生假陰性。改以靜態程式路徑、settings、現有 BAT script log 交叉驗證。

結果：
- 未能證實 shell preference 失效。
- `settings.json` 實際為 `shell=git-bash`。
- resolver 現況測試 stdout：

```text
resolveShellPath:
  windows git-bash prefers discovered bash.exe
  windows auto falls back to powershell when pwsh is unavailable

resolvePersistedShellPath:
  custom shell uses persisted customShellPath
  persisted git-bash resolves to git bash path
  missing persisted shell returns undefined

Results: 5 passed, 0 failed
```

補充判讀：若新 Worker PTY 不是 Git Bash，而是 PowerShell，`codex --yolo '/ct-exec T0328'` 不會經過 MSYS argv conversion；使用者觀察到 codex 收到 `C:/Program Files/Git/ct-exec T0328` 反而強烈支持新 PTY 是 Git Bash。

#### B.2 症狀 B（MSYS path rewrite）

Git Bash 直接復現 stdout：

```text
direct_echo
/ct-exec T0328
node_argv_unquoted
["C:\\Program Files\\nodejs\\node.exe","C:/Program Files/Git/ct-exec","T0328"]
node_argv_single_arg
["C:\\Program Files\\nodejs\\node.exe","C:/Program Files/Git/ct-exec T0328"]
env_MSYS_NO_PATHCONV=
```

加 `MSYS_NO_PATHCONV=1` 後 stdout：

```text
with_no_pathconv
["C:\\Program Files\\nodejs\\node.exe","/ct-exec","T0328"]
["C:\\Program Files\\nodejs\\node.exe","/ct-exec T0328"]
env_MSYS_NO_PATHCONV=1
```

BAT script log 對 T0328 的證據：

```text
invoke argv ... "--prompt","C:/Program Files/Git/ct-exec T0328"
parsed ... "promptLength":14
invoke-create-with-command ... "channel":"terminal:create-agent-command","agent":"default","promptLength":14
```

判讀：`bat-terminal.mjs` 行首 MSYS workaround 已把外層污染 argv 還原成 `/ct-exec T0328`，所以 T0328 失敗不是腳本 parser 沒修正，而是新 PTY 中啟動 codex 時再次被 MSYS 改寫。

#### B.3 環境變數調查

- 目前 BAT Worker env 沒有 `MSYS_NO_PATHCONV`。
- `electron/pty-manager.ts` 三條 PTY env 組裝路徑均未注入 `MSYS_NO_PATHCONV`。
- `scripts/bat-terminal.mjs` 注入 `BAT_TOWER_TERMINAL_ID`、`CT_MODE`、`CT_INTERACTIVE`，但未注入 `MSYS_NO_PATHCONV`。
- `codex` 在 Git Bash 中是 npm shell wrapper，最後 `exec node ... "$@"`；Node 是 Windows native executable，因此 MSYS 會在這一層改寫 slash argv。

### Phase C：Hypothesis 評分
| H | 描述 | 證據（支持） | 證據（反對） | 信心度 |
|---|---|---|---|---|
| H1 | BUG-060 fix `fad2978` 回滾 | 使用者主觀觀察 shell pref 失效 | `electron/main.ts` resolver 邏輯仍在；settings 仍是 `git-bash`；resolver test pass；B 症狀需 Git Bash 才成立 | 0.15 |
| H2 | 新 commit 引入 shell regression | `fad2978..HEAD` 有多個 `electron/main.ts` commits | 沒有命中 terminal create / shell resolver 移除；原列 terminal spawn 路徑無後續 commits | 0.25 |
| H3 | shell pref store 損壞 | 若 settings store 壞會導致 fallback | 實讀 `settings.json` 是 `shell=git-bash`、`defaultAgent=codex-cli`；resolver 可解析到 Git Bash | 0.05 |
| H4 | `bat-terminal.mjs` 沒做 MSYS_NO_PATHCONV | 外層 argv 進 script 前確實被 rewrite | script 已有 argv repair，且 T0328 log `parsed.promptLength=14` 證明外層污染被修復；問題在新 PTY agent 啟動層 | 0.40 |
| H5 | codex agent 自身 path 處理 bug | codex 最終收到 `C:/Program Files/Git/ct-exec T0328` 並拒絕 | Node argv 最小復現已在 codex 之前重現；不是 codex 自行轉換 | 0.20 |
| H6 | terminal env 沒設 `MSYS_NO_PATHCONV=1` | Git Bash + Node argv 最小復現 100%；設 env 後完全消失；PTY env 組裝未設此 env | 需要後續 fix 工單跑 BAT 端 e2e 驗證 | 0.90 |

收斂結論：
- 症狀 A 與 B 不建議視為同根因。A 目前更像觀察誤判或需要額外 shell logging 才能證實。
- 症狀 B 根因為 H6，並與 H4 有弱關聯：`bat-terminal.mjs` 只修了外層 argv 污染，未把 `MSYS_NO_PATHCONV=1` 傳入新 Worker PTY。

### Phase D：Candidate fix 提案
#### 對症狀 A（shell preference）

Fix-A1：不先做功能修，先補診斷與 regression guard。
- 在 `terminal:create-with-command` / terminal server `pty:create` log 中記錄 resolved shell basename（避免記錄敏感 env）。
- 加 integration/e2e：settings `shell=git-bash` 時，`terminal:create-agent-command` 第一張、第二張、第三張 resolved shell 均為 Git Bash。
- 若 e2e 證實 A 仍發生，再查 running app 是否為 stale build / packaged app 是否未包含 `fad2978`。

Regression test：
- Unit：擴充 `tests/shell-path-resolver.test.ts` 覆蓋 actual settings shape。
- Integration：mock `readPersistedSettingsSync()` + invoke `terminal:create-agent-command`，assert forwarded `shell` or resolved create shell。
- E2E：BAT RemoteServer create 3 terminals，回收每張 terminal 的 shell/env marker。

#### 對症狀 B（MSYS path rewrite）

Fix-B1（推薦）：`scripts/bat-terminal.mjs --prompt` 路徑注入 `customEnv.MSYS_NO_PATHCONV='1'`。
- 優點：範圍精準，只影響 Control Tower/agent auto-session Worker PTY，不改一般手動 Git Bash terminal 行為。
- 缺點：若其他 renderer 直接呼叫 `terminal:create-agent-command`，仍需同樣保護。

Fix-B2：`electron/main.ts` 的 `terminal:create-agent-command` 對 Windows + Git Bash resolved shell 注入 `MSYS_NO_PATHCONV=1`。
- 優點：覆蓋所有 agent prompt terminal，不依賴呼叫來源。
- 缺點：會改變 agent terminal 內整個 Git Bash session 的 path conversion 行為，影響面比 B1 大。

Fix-B3：用 temporary prompt file / stdin / base64 envelope 傳 prompt，避免 slash prompt 成為 native argv。
- 優點：不依賴 MSYS env。
- 缺點：改動較大，涉及 agent CLI 啟動方式；不同 agent 對 stdin/arg 支援不同。

Regression test：
- Unit：新增 MSYS argv conversion fixture，驗證不設 env 時 `/ct-exec T0001` 會成 `C:/Program Files/Git/...`，設 env 後保持 literal。
- Integration：mock `bat-terminal.mjs --prompt "/ct-exec T0001"` 的 invokePayload，assert `customEnv.MSYS_NO_PATHCONV === '1'`。
- E2E：Git Bash shell 中跑 `codex`/可替代 argv probe，驗證 agent 收到 literal `/ct-exec T0001`。

### 拍板項
- D1：建議 A/B 分開處理。B 直接開 fix 工單；A 先開 diagnostics/regression guard，不與 B 混修。
- D2：B fix 建議先走 Fix-B1（bat-terminal prompt path 注入 `MSYS_NO_PATHCONV=1`），若後續發現 renderer 直接呼叫也會中，再升級到 Fix-B2。
- D3：regression test 最少要有 unit + integration；若要防第三次同族再現，應追加 BAT RemoteServer e2e（Git Bash + codex argv probe）。
- D4：可作為 v0.4.2.1 / v0.4.3 hotfix 納入，因 B 阻斷 YOLO/ask auto-session 派發鏈。

### 互動紀錄
無

### OOS but justified（如有）
讀取 `%APPDATA%\BetterAgentTerminal\settings.json` 與 `%APPDATA%\BetterAgentTerminal\Logs\bat-scripts.log`。理由：工單要求 reproduce isolation，且 BAT RemoteServer token 在本 Worker env 缺失，無法安全主動重開新 terminal；現有 BAT script log 是最接近 T0328 實際派發鏈的證據。

### 補充鑑別：Codex 前綴仍用 `/ct-exec`

使用者補充觀察：Codex Worker 派發時仍使用 `/ct-exec`，而不是 Codex skill 觸發慣例 `$ct-exec`。

追加確認：
- BAT UI 內建 Control Tower panel 不是此問題來源。`src/utils/control-tower-launch.ts` 對 `codex-cli` / `codex-agent` 會回傳 `command='codex'`、`prefix='$'`，並產生 `codex "$ct-exec T####"`。
- `src/App.tsx` 與 `src/components/WorkspaceView.tsx` 的 `onExecWorkOrder` / `handleExecWorkOrder` 都走 `resolveControlTowerAgentRuntime(activeWorkspace.defaultAgent || settings.defaultAgent)`，因此 BAT UI path 對 Codex 是正確的。
- 實際 T0328 log 為 `node scripts/bat-terminal.mjs ... --agent default --prompt "/ct-exec T0328"`。這條路徑不是 BAT UI ControlTowerPanel，而是 Tower skill 的 BAT auto-session 規格。
- `C:\Users\Gower\.codex\skills\control-tower\SKILL.md` 與 `references/auto-session.md` 明確硬編碼 BAT 內部終端為 `--agent default --prompt "/ct-exec T####"`，並寫「由 BAT Default Agent 設定決定要開 Claude Agent、Codex Agent、Codex CLI 或其他 agent」。這與 prompt 本身仍固定 slash prefix 互相矛盾。

責任切分：
- **Tower skill / 派發協定問題**：錯誤地把 BAT `--agent default` 視為 agent-agnostic，但 prompt 卻硬編碼 Claude-style `/ct-exec`。這是 Codex 收到錯前綴的直接來源。
- **BAT helper / PTY env 問題**：未對 Git Bash Worker PTY 注入 `MSYS_NO_PATHCONV=1`，導致 slash prompt 進一步被 MSYS 改寫成 `C:/Program Files/Git/ct-exec ...`。這是 path rewrite 的直接來源。
- **BAT UI 問題**：目前未證實。UI 內建 Control Tower panel 的 runtime prefix selection 對 Codex 是正確的。
- **bat-terminal.mjs parser 問題**：不是主要來源。它能修復外層 MSYS argv 污染並把 promptLength 還原為 14；但它目前也沒有能力依 `--agent default` resolved agent 自動改 `/ct-exec` 為 `$ct-exec`。

修法建議更新：
- Fix-B1：BAT auto-session Worker PTY 注入 `MSYS_NO_PATHCONV=1`，解 path rewrite。
- Fix-B2：修 Tower skill BAT route，不可固定 `--prompt "/ct-exec T####"` 給 `--agent default`。候選方案是 Tower 解析 BAT default agent 後選 `/` 或 `$`，或改 BAT app 的 `terminal:create-agent-command` 在 resolved agent 為 Codex 時 normalize Control Tower prompt prefix。
- Regression test 必須同時驗兩件事：Codex route 產生 `$ct-exec T####`，Git Bash route 不把 prompt 改寫成 `C:/Program Files/Git/...`。

---

**狀態**：✅ DONE
