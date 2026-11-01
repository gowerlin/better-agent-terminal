---
schema_version: 1
schema_kind: workorder
id: T0737
title: "pre.7 自動化驗收：BUG-179 重開後 bat-scripts.log 輪替（隔離實例）＋ BUG-177 / 178 從介面操作的 e2e（本機假模型，不耗 token）"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-01T17:15:51+0800"
started_at: "2026-11-01T17:41:20+0800"
updated_at: "2026-11-01T17:56:31+0800"
completed_at: "2026-11-01T17:56:31+0800"
depends_on: [T0736]
related:
  - "BUG-179 / T0732（`ce648034`，D198）：`electron/bat-scripts-log-rotation.ts` `rotateBatScriptsLog`，本機 `app.whenReady` 開頭、headless `start()`；T0732 只有單元測試，實機輪替未驗"
  - "BUG-177 / T0729（`ceb24910`）：e2e ⑩ 以 IPC `claude.getSupportedModels` 驗 0 請求 / 0 session 檔"
  - "BUG-178 / T0730（`6f7b3d53`）：`electron/claude-config-dir.ts`；e2e ⑪ / ⑫ 以 `CLAUDE_CONFIG_DIR` 驗 resume 歷史與 plugins；另修 `electron/handlers/ct-config.ts` 預設值層"
  - "`e2e/v072-pre6-claude-panel.spec.ts`、`e2e/fixtures/fake-anthropic-api.ts`、`e2e/fixtures/electron-isolation.ts`；CLAUDE.md「Logging」節 T0732 段、「Claude Agent SDK / CLI」節 Claude 設定目錄段；`docs/agent-guide/logging.md`、`docs/agent-guide/claude-agent-sdk-cli.md`"
affects_files:
  - "e2e/v072-pre7-bat-scripts-log-rotation.spec.ts（新增，檔名可調）"
  - "e2e/v072-pre7-claude-panel-ui.spec.ts（新增，檔名可調；或在 `e2e/v072-pre6-claude-panel.spec.ts` 加情境，但 ①–⑫ 行為不得改）"
  - "e2e/fixtures/（只在需要共用 helper 時擴充）"
  - docs/agent-guide/logging.md
  - docs/agent-guide/claude-agent-sdk-cli.md
  - _ct-workorders/T0737-e2e-pre7-acceptance-log-rotation-config-dir.md
renew_count: 0
session_ids:
  - "183da5c9-7165-491d-a861-895441b20a17"
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 BUG-179 情境（隔離實例的 userData，啟動前在 `<userData>/Logs/` 預先放檔）：① `bat-scripts.log` > 10 MiB → 啟動後改名為 `bat-scripts-<YYYYMMDD-HHMMSS>.log`、原檔不存在或變成新的小檔；debug log 有 `[bat-scripts-log]` 輪替行。② 預先放 3 份舊的 `bat-scripts-<stamp>.log` ＋ 一個 > 10 MiB 的現行檔 → 啟動後只留最近 3 份（依檔名時間戳，最舊的被刪）。③ ≤ 10 MiB → 不動（內容與大小相同）。④ 輪替後在隔離實例的分頁內跑一個 helper（例 `bat-terminal.mjs --version` 以外會寫 log 的呼叫，如 `bat-mcp` / `bat-notify` 的可行路徑，或 hook `report-hook`）→ 新的 `bat-scripts.log` 被建立並有 NDJSON 記錄（寫入路徑不受影響）。⑤（選做）改名失敗（例如預先以獨占方式開著檔案，Windows）→ BAT 照常啟動、debug log 只記一行、不丟例外。⑥（選做）headless bat-server 的 `<dataDir>/Logs`：若能在本機以 temp dataDir 啟動 server bundle / headless entry 就驗，做不到寫原因。檔案大小用稀疏或快速寫入產生，跑完刪掉。"
  - "🔴 BUG-177 情境（從介面操作，不直接呼叫 IPC）：在隔離實例新增 Claude Agent 面板分頁、等候載入模型清單 / 切換模型下拉 → 假 API 收到 0 個模型請求、暫存 HOME 的 `.claude/projects/` 沒有新 session 檔；之後送一則訊息 → 只產生 1 個 session 檔、session 清單（resume 對話框）只出現這一個。"
  - "🔴 BUG-178 情境（從介面操作）：設 `CLAUDE_CONFIG_DIR` 指到暫存目錄（HOME 隔離到另一個暫存目錄）→ 面板送訊息後重開 BAT，從 resume 對話框 / 歷史清單看得到該 session 並能接續，歷史重建；plugins 清單（若面板有顯示）讀自 `CLAUDE_CONFIG_DIR`；Control Tower 總覽的 `*config` 預設值層在 `CLAUDE_CONFIG_DIR/skills/control-tower/references/tower-config.md` 存在時讀得到（T0730 修的 `ct-config.ts`）；HOME 下的 `.claude` 沒有被寫入。與 e2e ⑪ / ⑫ 重複的部分可直接引用其結果，只補介面層。"
  - "🔴 不耗 token：claude 只打 `e2e/fixtures/fake-anthropic-api.ts`（沿用 T0727 的隔離做法：暫存 HOME、`ANTHROPIC_BASE_URL` / 假 key、`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`、拒絕並記錄的 proxy、工作區放 `%ProgramData%`）；不得用使用者的登入或真實 API；回報區列出對外請求數（預期 0）。"
  - "🔴 不改產品程式碼（`src/` / `electron/` / `scripts/` 都不動）；發現產品缺陷 → 記在回報區〈發現的問題〉附重現步驟與證據，由塔台開 BUG，不在本單修。某情境做不到就寫原因與已試過的做法，其餘照做，可回 PARTIAL。"
  - "🔴 隔離：一律用 `e2e/fixtures/electron-isolation.ts` 的隔離實例（`--runtime=e2e-…`、獨立 userData 與 remote port），🔴 絕不碰使用者真正的 `<appData>/BetterAgentTerminal/Logs/bat-scripts.log` 與 userData，不以預設實例啟動 source build，不執行安裝檔。先 `npx vite build`（T0736 完成後才派本單，避免同時 build）。工作區名稱一律 `e2e-t0737-*`。暫存目錄跑完要清掉；清不掉就把路徑寫進回報區。"
  - "🔴 驗證：新 spec 綠（或部分綠並說明），連跑 2 次；重跑 `e2e/v072-pre6-claude-panel.spec.ts`（①–⑫）綠；rotation 相關單元測試（`electron/__tests__/` 下 T0732 的兩個檔）綠；`npm run typecheck` = 0、`npm run typecheck:electron` = 0（spec 若在 tsconfig 範圍外則註明）。`docs/agent-guide/logging.md` 的 T0732 驗證段、`docs/agent-guide/claude-agent-sdk-cli.md` 的 Claude 設定目錄驗證段各補一行指向新 spec。回報區列〈BUG 結案建議〉（每個 BUG：可 CLOSED / 仍需手動，附證據）與〈仍需手動實機驗收〉（例如使用者真實 BAT 重開、真實模型、遠端 headless）。不發版、不改 CHANGELOG、不改 BUG 單狀態（由塔台處理）、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0737 — pre.7 自動化驗收：bat-scripts.log 輪替＋Claude 面板介面 e2e

## 元資料

- **工單編號**：T0737
- **類型**：implementation（驗收用 e2e）
- **優先級**：P2
- **建立時間**：2026-11-01T17:15:51+0800
- **預估規模**：M

## 背景

使用者要求安排 `v0.7.2-pre.7` 的自動驗收（與 pre.8 的 T0736 一起）。HEAD 的 `src` / `electron` / `scripts` 與 pre.8 發版 commit `cf71bf6f` 相同；pre.7 → pre.8 之間的產品變動只有 T0735（工作區 ⚠️），與本單三個 BUG 無關，以 source build 驗即可涵蓋 pre.7 的修正。

- BUG-179（`bat-scripts.log` 啟動輪替）：T0732 只有單元測試，回報寫明實機輪替未驗。
- BUG-177 / BUG-178：已有 e2e ⑩–⑫，但以 IPC 直接呼叫；本單補使用者操作介面的路徑與 `*config` 預設值層。

## 範圍

1. BUG-179 情境 ①–④（⑤⑥ 選做）。
2. BUG-177、BUG-178 介面情境。
3. 重跑既有 spec / 單元測試；docs 驗證段各一行。

## 不做

- 不改產品程式碼、不修發現的缺陷、不改 BUG 單狀態。
- 不在使用者正在用的 BAT 上驗。

## 驗收

- [x] BUG-179 ①–④ PASS（⑤⑥ 做了或寫原因）
- [x] BUG-177、BUG-178 介面情境 PASS / 未涵蓋與原因
- [x] 對外請求數 0
- [x] `v072-pre6-claude-panel` ①–⑫ 綠、rotation 單元測試綠、兩個 typecheck = 0
- [x] 〈BUG 結案建議〉與〈仍需手動實機驗收〉

---

## 回報區

### 完成狀態

- **狀態**：DONE —— 驗收 5 項全過：BUG-179 ①–⑤ PASS（⑥ 由既有整合測試涵蓋，原因見下）；BUG-177 / BUG-178 介面情境 PASS；對外請求 0；pre6 ①–⑫ 綠、rotation 單元測試綠、兩個 typecheck = 0；〈BUG 結案建議〉與〈仍需手動實機驗收〉已填。
- **session_id**：183da5c9-7165-491d-a861-895441b20a17
- **產品 commit**：`cb22545b`（只有 2 個新 spec＋2 份 docs 各 1 行；`src/` / `electron/` / `scripts/` 都沒動）
- **落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 工單在 REPO_ROOT 底下；C-3 `affects_files` 的 `e2e/`、`docs/agent-guide/` 都存在（新檔的上層目錄存在）；沒有 `branch` 欄位（C-2 不適用）。沒有設 `CT_HOME`（不是 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。
- **受測的 build**：17:41 自己跑 `npx vite build`（exit 0，dist 17:42:20），內容是 HEAD `fa5a6823` 的產品碼（= pre.8 發版 `cf71bf6f` 的 `src` / `electron` / `scripts`）。執行中同一個 checkout 另有 T0741 改 `src/components/TerminalPanel.tsx` 等檔（17:48 之後才改，未 commit）；dist 沒有它的 `canFitTerminalContainer`，所以本單所有 e2e 都沒有包到 T0741 的變更。

#### 新增的檔案

| 檔案 | 內容 |
|---|---|
| `e2e/v072-pre7-bat-scripts-log-rotation.spec.ts` | BUG-179，4 個 test（①＋④、②、③、⑤），每個都是新的 `--runtime=e2e-t0737-rot*` 隔離實例，啟動前在 `<userData>/Logs` 放檔；大檔用 `truncate` 產生 |
| `e2e/v072-pre7-claude-panel-ui.spec.ts` | BUG-177（A1–A3）與 BUG-178（B1–B5）各 1 個 test，從介面操作，不直接呼叫 IPC 做驗收動作（IPC 只用在植入工作區種子與讀 session id / 存檔做比對） |
| `docs/agent-guide/logging.md` | T0732 驗證段後加 1 行指向新 spec |
| `docs/agent-guide/claude-agent-sdk-cli.md` | Claude 設定目錄驗證段後加 1 行指向新 spec |

`e2e/fixtures/` 沒有改（不需要共用新 helper）。

#### BUG-179 情境結果（`v072-pre7-bat-scripts-log-rotation.spec.ts`）

| 情境 | 結果 | 證據（第 1 次執行） |
|---|---|---|
| ① > 10 MiB 改名 | PASS | 放 11,534,336 B 的 `bat-scripts.log` → 啟動後只剩 `bat-scripts-20261101-174525.log`（大小相同，第一行標記還在），原檔不存在；debug log 一行 `[bat-scripts-log] rotated bat-scripts.log (11534336 bytes > 10485760) -> bat-scripts-20261101-174525.log`，沒有 failed 行；檔名時間介於放檔與現在之間 |
| ② 只留最新 3 份 | PASS | 放 `bat-scripts-20250101-000001` / `0102` / `0103`（刻意倒序寫入，檔案時間與檔名相反）＋ 10,485,761 B 現行檔 → 剩 `20250102`、`20250103`、`20261101-174528`；debug log `removed old bat-scripts-20250101-000001.log (keeping newest 3)` |
| ③ ≤ 10 MiB 不動 | PASS | 剛好 10,485,760 B → 啟動後大小與 SHA-256 相同（`c12355b8…`），沒有輪替檔、沒有 `[bat-scripts-log]` 行 |
| ④ 輪替後寫入路徑不受影響 | PASS | ① 同一個實例，在一般 shell 分頁輸入 `node …/bat-terminal.mjs --set-role tower --agent claude` → 新的 `bat-scripts.log` 1,562 B、7 行全部可解析為 JSON，含 `bat-terminal` 的 `invoke` / `parsed` / `await-auth-response` / `await-invoke-response` / `set-role` / `exit`（`BAT_TERMINAL_ID` = 該分頁）；分頁標題變 `· Tower`；沒有第二次輪替 |
| ⑤ 改名失敗（選做） | PASS | 另一個 PowerShell 以 `FileShare.None` 開著 12,582,912 B 的現行檔 → BAT 照常啟動（`workspace.load()` 正常回應），debug log 只有一行 `rename bat-scripts.log (12582912 bytes) failed, will retry next startup (EBUSY: …)`，放開後檔案還在、大小不變、沒有輪替檔 |
| ⑥ headless（選做） | 由既有整合測試涵蓋，e2e 未另做 | 沒有在 e2e 啟動 headless：本機要跑 server bundle 需另外打包，且 headless 端 `<dataDir>/Logs` 的輪替已由 `electron/remote/__tests__/headless-bat-scripts-log-rotation.test.ts` 以真的 `createHeadlessServer({ dataDir: <temp>, port: 0 }).start()` 驗（本單閘門有跑，綠）。遠端主機上的 bat-server（WSL / SSH）實機輪替列入〈仍需手動實機驗收〉 |

#### BUG-177 介面情境（`v072-pre7-claude-panel-ui.spec.ts` 第 1 個 test，無 `CLAUDE_CONFIG_DIR`）

| 步驟 | 結果 | 證據 |
|---|---|---|
| A1 縮圖列「+」→ Claude Agent，放著 6 s | PASS | 假 API 0 個請求；暫存 HOME `.claude/projects` 0 個 session 檔 |
| A2 輸入 `/model`（斜線選單補全 → Enter 送出）→ 等清單載入 → 選另一個模型 | PASS | 清單 12 列（含 CLI 回的「Claude Agent」群組），選 `Sonnet 4.6 (200k)`，底部變 `</> claude-sonnet-4-6`；之後 5 s 內仍 0 個請求、0 個 session 檔 |
| A3 送一則訊息 → `/resume` | PASS | 1 個請求（`model=claude-sonnet-4-6`，即 A2 選的模型）；只產生 1 個 session 檔；`/resume` 對話框只列 1 筆，就是這個 session 的前 8 碼；全程沒有不帶情境標記的對話請求 |

#### BUG-178 介面情境（第 2 個 test，`CLAUDE_CONFIG_DIR` 指向暫存目錄，HOME 是另一個暫存目錄並放誘餌）

| 步驟 | 結果 | 證據 |
|---|---|---|
| B1 「+」新增 Claude Agent、送一則 | PASS | session 檔在 `CLAUDE_CONFIG_DIR/projects/…`，HOME/.claude 沒有 session 檔 |
| B2 plugins（從介面看） | PASS | 輸入框打 `/t0737`，斜線選單只列 `/t0737-cfg:t0737-cfg`（裝在 `CLAUDE_CONFIG_DIR/plugins`）；HOME/.claude 的誘餌 `t0737-home` 沒出現 |
| B3 塔台 › 總覽 `*config` 預設值層 | PASS | 右側邊欄（預設 docking）點塔台 → 子頁「總覽」：預設層顯示 `<暫存>\claude-config\skills\control-tower\references\tower-config.md`；`t0737_probe` = `t0737-from-config-dir`，來源「預設」；HOME/.claude 的誘餌 `t0737-from-home` 沒被讀（T0730 修的 `ct-config.ts`） |
| B4 重開 BAT → 歷史 → 新分頁 `/resume` 接續 | PASS | 同一個 runtime 重開：還原的分頁顯示原本的提問與回答；再用「+」開新分頁，`/resume` 列出該 session → 點選 → 歷史重建 → 送下一則，請求帶著前面的對話（3 則 messages） |
| B5 HOME 下的 `.claude` 沒被寫入 | PASS | 放的 4 個誘餌檔，跑完後檔案、大小、mtime 都相同，沒有新檔 |

與 e2e ⑪ / ⑫ 重複的部分（session 檔位置、`listSessions`、plugins 從 `CLAUDE_CONFIG_DIR` 載入的日誌、重開後歷史重建）本單也重跑了 ⑪ / ⑫（綠），介面層補的是 B2 / B3 / B4 的新分頁 `/resume` 與 B5。

#### 對外請求數

- 兩個 test 都是：阻擋 proxy 收到 **0** 次嘗試；主行程 `fetch` 與 `webRequest` 的非本機請求 **0**；所有模型請求都只打本機假 API 的 `/v1/messages`（BUG-177 test 1 個、BUG-178 test 3 個）。沒有用使用者的登入或真實 API。
- 使用者真正的 `~/.claude/projects` 沒有 `t0737` 相關項目（spec 前後都斷言）。

#### 驗證閘門

| 閘門 | 結果 |
|---|---|
| 新 spec 連跑 2 次（兩檔一起跑） | 第 1 次 6 passed（31.6 s）、第 2 次 6 passed（31.4 s）；除錯階段另有個別重跑 |
| `e2e/v072-pre6-claude-panel.spec.ts`（①–⑫） | 2 passed（①–⑫ 全部 PASS） |
| `electron/__tests__/bat-scripts-log-rotation.test.ts`、`electron/remote/__tests__/headless-bat-scripts-log-rotation.test.ts` | 2 files / 21 tests passed |
| `npm run typecheck` | 0 |
| `npm run typecheck:electron` | 0 |
| 新 spec 的型別 | `e2e/` 不在兩個 tsconfig 的範圍內；另外以 `npx tsc --noEmit --strict --target ES2022 --module esnext --moduleResolution bundler --esModuleInterop --skipLibCheck --types node <兩個 spec>` 檢查 = 0 |

- **暫存清理**：`%TEMP%\bat-t0737-*`、`%ProgramData%\bat-e2e-t0737-*`、`%APPDATA%\BetterAgentTerminal-runtime-e2e-t0737-*` 跑完都不存在（已核對）。`e2e-results/`（被 `.gitignore` 擋住）留有截圖 `t0737-a3-resume-list.png`、`t0737-b3-config-layers.png`、`t0737-b4-resumed.png`，下次執行會覆蓋。
- **去識別化**：新 spec 與 docs 兩行依 `.private/` 的檢查樣式掃過，0 命中；路徑一律在執行期由 `os.homedir()` / `%APPDATA%` 取得，沒有寫死。

### 相關通過案例判定

本單不改產品程式碼（`src/` / `electron/` / `scripts/` 都沒動），沒有任何已驗收通過的案例會因本單改變；重跑的 pre6 ①–⑫ 也全部維持通過。

### 發現的問題

沒有發現產品缺陷。以下是寫 spec 時確認的行為（不是缺陷，記下來給之後寫 e2e 的人）：

1. 斜線指令要按兩次 Enter：輸入 `/model` 時斜線選單開著，第一次 Enter 只把選單選中項補進輸入框，第二次才送出（`ClaudeAgentPanel.tsx` `handleKeyDown`）。spec 以 `runSlash()` 照使用者的操作做。
2. 塔台面板預設在右側邊欄（`DEFAULT_DOCKING_CONFIG['control-tower'] = 'right'`），開起來停在上次的子頁（本次是「工單」），要再點「總覽」。
3. BUG-178 test 的 `/resume` 接續後，假 API 多收到 1 個不帶情境標記的請求（5 則 messages、帶 15 個工具、內容含本單的標記對話），是 CLI 自己在已標記對話後的附帶請求；只打本機假 API，沒有對外。T0727 的 spec 對這類請求的判定相同（「requests without a scenario inside a marked conversation are the CLI's own follow-ups」）。

### BUG 結案建議

| BUG | 建議 | 依據 |
|---|---|---|
| BUG-179（`bat-scripts.log` 啟動輪替） | 本機（Electron 主行程）部分可 CLOSED；headless 遠端主機視塔台是否要求實機 | 本單 ①–⑤ 在真的 source build 啟動流程驗過：改名、只留 3 份、剛好 10 MiB 不動、輪替後 helper 照常寫、檔案被鎖時照常啟動且只記一行；headless 端由 `headless-bat-scripts-log-rotation.test.ts`（真的 `createHeadlessServer().start()`）涵蓋。安裝版（packaged）與遠端 bat-server 未實測，見下節 |
| BUG-177（讀模型清單觸發額外 turn） | 可 CLOSED | 介面路徑（新分頁、`/model` 載入並切換模型）0 個模型請求、0 個 session 檔；送一則後只 1 個 session、`/resume` 只列它；加上既有 ⑩（IPC 層）本單重跑也綠 |
| BUG-178（`CLAUDE_CONFIG_DIR` 不被尊重） | 可 CLOSED | 介面路徑：session 檔、`/resume` 清單與接續、plugins 指令、`*config` 預設值層都讀 `CLAUDE_CONFIG_DIR`，HOME/.claude 誘餌全部沒被讀也沒被寫；⑪ / ⑫ 本單重跑也綠 |

### 仍需手動實機驗收

- **BUG-179**：使用者自己的 BAT（安裝版、非隔離 userData）在 `bat-scripts.log` 實際超過 10 MiB 時重開一次，確認 `<appData>\BetterAgentTerminal\Logs` 出現 `bat-scripts-<stamp>.log`、debug log 有 `[bat-scripts-log] rotated` 一行（本單依規定不碰真正的 userData，也不執行安裝檔）。
- **BUG-179 headless**：遠端（WSL / SSH）bat-server 重啟一次，確認 `<dataDir>/Logs/bat-scripts.log` 超過 10 MiB 時被輪替（本單只有 in-process 的 `createHeadlessServer` 測試）。
- **BUG-177 / BUG-178**：用真實模型與登入帳號時的行為（本單一律假 API）；BUG-178 在使用者真正設了 `CLAUDE_CONFIG_DIR` 的環境開一次 Claude 面板，看 `/resume` 清單與塔台總覽的預設值層路徑。
- 安裝版（packaged）上的行為：本單只驗 source build（`BAT_E2E_EXECUTABLE` 未設）。

### 互動紀錄

- 無使用者互動、無塔台提問（yolo；沒有需要塔台裁示的範圍內選擇）。
- 沒有使用子代理或 Workflow。
- 執行中發現同一個 checkout 有 T0741 的未提交產品變更：沒有碰那些檔案，commit 用 `git commit --only` 只帶本單的 4 個檔，並核對受測 dist 不含 T0741 的變更（見〈完成狀態〉）。

### 回報時間

2026-11-01T17:55:17+0800
