---
schema_version: 1
schema_kind: workorder
id: T0819
title: "PLAN-058 交付版驗收：以 `BAT_E2E_EXECUTABLE` 對安裝版 `v0.7.4-pre.5` 跑 Claude 面板假 API e2e（主回合中送出排隊、Esc 取消待送、卡片等待提示）"
type: verification
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-04T00:49:06+0800"
started_at: "2026-11-04T00:50:36+08:00"
updated_at: "2026-11-04T00:53:07+08:00"
completed_at: "2026-11-04T00:53:07+08:00"
session_ids:
  - "dfa3e60d-2848-4c3f-8414-7c79f6cdb130"
depends_on: []
related:
  - "PLAN-058；T0814（`fc22e04a`）；T0815（`0b67db03`）；D259 / D262 / D263；T0510（`BAT_E2E_EXECUTABLE`）"
affects_files:
  - _ct-workorders/T0819-plan058-verify-installed-claude-panel-e2e.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只做驗收，不改任何產品程式、測試、文件、workflow；repo 內唯一可改的檔案是本工單（回報區）。Playwright 輸出（`--output`）與暫存一律放系統暫存目錄，收尾刪除。spec 對安裝版跑不起來時不得改 spec 讓它通過：回報 PARTIAL 並寫明原因。"
  - "🔴 不碰使用者正在用的 BAT：e2e 只用 `launchIsolated` 的隔離 runtime（`--runtime=<id>`），結束一律 `closeIsolated`；不得結束、重啟或關閉使用者的 BAT 主實例、它的 Terminal Server 或任何分頁；不碰 `%APPDATA%\\BetterAgentTerminal` 主資料夾（隔離 runtime 的資料夾以外）。"
  - "🔴 不跑真實模型（`BAT_E2E_REAL_MODEL` 不設），只用 spec 內建的假 API；不登入任何 agent（L185）。回報不寫權杖值、不寫家目錄真實路徑（D176，用 `<使用者資料夾>`）。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。不發版、不 push。Git：只 commit 本工單（`git commit --only` 或明列路徑）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0819 — PLAN-058 交付版驗收（安裝版 `v0.7.4-pre.5`，假 API e2e）

## 元資料

- **工單編號**：T0819
- **類型**：verification
- **互動模式**：yolo（問題問塔台）
- **優先級**：P3
- **建立時間**：2026-11-04T00:49:06+0800
- **預估規模**：S

## 背景

PLAN-058（T0814 W1 `fc22e04a`＋T0815 W0 `0b67db03`，已在 `v0.7.4-pre.5`）：Claude 面板在主回合進行中送出的訊息，改以 `streamInput`＋uuid 排進同一個 query（`command_lifecycle` 回執 2 s；無回執 / reject → query 結束後 resume、只送一次）；面板顯示「待送」＋取消；Esc 先取消待送再 interrupt；提問 / 權限卡等待時提示「請先回答上方問題」。T0815 以**開發版 build** 跑假 API e2e（`e2e/v072-pre6-claude-panel.spec.ts` ⑦d / ⑦e / ⑦f / ⑥b 與不回歸 ①–⑫、`e2e/v072-pre7-claude-panel-ui.spec.ts`）與真實模型，皆 PASS；交付版未驗。

`e2e/fixtures/electron-isolation.ts` 的 `launchIsolated` 支援 `BAT_E2E_EXECUTABLE=<安裝版 exe>`（T0510），以隔離 runtime 啟動安裝版。塔台決定先由 Worker 以此對安裝版跑一輪，再交使用者手動確認（D263）。

## 範圍

1. 確認安裝版：`C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe` FileVersion = `0.7.4-pre.5`（第一百一十四 session NSIS 驗收已重裝；不重裝）。
2. 以 `BAT_E2E_EXECUTABLE="C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe"` 跑：
   - `npx playwright test e2e/v072-pre6-claude-panel.spec.ts --output <暫存>`（含 ⑦d 主回合中送第 2 則、⑦e 取消待送、⑦f Esc 取消待送、⑥b 與 ①–⑫ 不回歸）
   - `npx playwright test e2e/v072-pre7-claude-panel-ui.spec.ts --output <暫存>`（BUG-177 / BUG-178 不回歸）
   - 以 log 中 `build under test` 類訊息或程序路徑證明跑的是安裝版，不是 `dist-electron`。
3. 失敗時：先判斷是安裝版行為問題、還是 spec 依賴 source build（例：讀 `dist-electron`、repo 內腳本路徑）；後者寫明哪一行依賴什麼，**不改 spec**，回報 PARTIAL 並列出仍可在安裝版通過的情境。
4. 依結果在回報區寫一份**給使用者的手動確認清單**（3–6 步，以面板上看得到的行為描述：回合中送出 → 出現「待送」→ 同一段對話接著回答；按取消 → 待送消失；Esc → 停回合且待送消失；權限 / 提問卡等待時送出 → 看到「請先回答上方問題」）。

## 不做

- 不改產品程式、測試、文件；不修 BUG；不跑真實模型；不驗 macOS / Linux；不重裝 BAT。

## 驗收

- [ ] 安裝版 FileVersion 與「跑的是安裝版」的證據
- [ ] pre6 spec 結果（逐情境列 ⑦d / ⑦e / ⑦f / ⑥b 與 ①–⑫）
- [ ] pre7 spec 結果
- [ ] 失敗項（若有）的歸因：安裝版行為 / spec 依賴 source build
- [ ] 使用者 BAT 主實例未受影響（e2e 前後主實例的程序仍在、沒被關閉）；暫存輸出已刪
- [ ] 給使用者的手動確認清單
- [ ] 結論：PASS（交使用者手動確認後塔台結 PLAN-058）/ FAIL / PARTIAL

---

## 回報區

### 完成狀態

- **狀態**：DONE（結論 PASS：交使用者手動確認後由塔台結 PLAN-058）
- **完成時間**：2026-11-04T00:52:26+0800
- **session_id**：dfa3e60d-2848-4c3f-8414-7c79f6cdb130

### 落點檢查

- **結果**：PASS
- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在 REPO_ROOT 底下 → PASS
- C-3：`affects_files` 只有本工單（`_ct-workorders/` 排除）→ 不適用
- C-2：工單無 `branch` 欄位；目前在 `main`
- `CT_HOME` 未設（不是 worktree）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）；`CT_MODE` = `yolo`、`CT_INTERACTIVE` = `0`；`BAT_REMOTE_TOKEN` 已設定

### 驗收結果

| 項目 | 結果 | 證據 |
|---|---|---|
| 安裝版 FileVersion | PASS | `C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe` FileVersion `0.7.4-pre.5`（ProductVersion `0.7.4.0`）；未重裝 |
| 跑的是安裝版 | PASS | 兩份 spec 每次啟動的 fixture 日誌都是 `launched runtime=e2e-… executable=C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe`（`launchIsolated` 在 `BAT_E2E_EXECUTABLE` 有值時以 `executablePath` 啟動該 exe、只帶 `--runtime=<id>`，不帶 repo 路徑；Terminal Server 檢查路徑同時改指 `resources/app.asar/dist-electron/terminal-server.js`，`e2e/fixtures/electron-isolation.ts:30-34, 133`）。pre6 共 4 次啟動、pre7 共 3 次啟動，全部是這個 exe |
| pre6 spec | PASS | `npx playwright test e2e/v072-pre6-claude-panel.spec.ts` → `2 passed (42.0s)`，exit 0 |
| pre7 spec | PASS | `npx playwright test e2e/v072-pre7-claude-panel-ui.spec.ts` → `2 passed (21.8s)`，exit 0 |
| 失敗項歸因 | 不適用 | 沒有失敗項 |
| 使用者 BAT 主實例未受影響 | PASS | e2e 前後主實例 `BetterAgentTerminal` 程序 PID 完全相同（9504 / 24692 / 41124 / 43580 / 44104 / 47388，啟動時間 00:37:36）；每次 teardown 隔離 runtime 的 Terminal Server `alive after teardown: false`、`runtime userData removed: true`；`%APPDATA%\BetterAgentTerminal` 主資料夾未碰 |
| 暫存輸出已刪 | PASS | Playwright `--output` 與 log 放 `<使用者資料夾>\AppData\Local\Temp\ct-T0819\`，收尾已刪；spec 自己的 `bat-t07*` 暫存家目錄與 `C:\ProgramData\bat-e2e-*` 工作區由 spec 自行清除（收尾查無殘留） |

#### pre6 逐情境（`e2e/v072-pre6-claude-panel.spec.ts`，假 API、不設 `BAT_E2E_REAL_MODEL`）

| 情境 | 結果 | 摘要（取自 spec 日誌） |
|---|---|---|
| ① | PASS | claude-opus-5-5 第一個請求：tools[15] + deferred 17 個 |
| ② | PASS | claude-sonnet-4-6 第一個請求：tools[15] + deferred |
| ③ | PASS | 工作清單 0/1 → 0/2 → 0/3 → 1/3 …（`已完成 n/m`） |
| ④ | PASS | 重開 runtime：分頁以 sdkSessionId 還原，清單重播「已完成 2/3」，還原期間 0 個模型請求 |
| ⑤ | PASS | 串流中途顯示 "T0727" 加游標，最後完整文字 |
| ⑥ | PASS | 權限卡「允許此 Bash 呼叫？」：是 → mkdir 執行；否 → 模型收到拒絕並回答 |
| ⑥b | PASS | 待送提示「目前回合結束後送出。 取消」→ 權限卡出現時改成「請先回答上方問題，回答後送出。 取消」，卡片保留；按是 → mkdir 執行；CLI 把訊息併進同一回合（lifecycle `queued`/`started`/`completed`），只送一次、沒有「已中斷」、權限回合未重跑 |
| ⑦ | PASS | Agent 卡片＋active-task bar 1 項；結束後 bar 清空、卡片成功 |
| ⑦b | PASS | 背景子代理：主回合結束後 bar 仍 1 項（標「背景」），完成 → `[completed]`；從 bar 停止 → `[stopped by user]` |
| ⑦c | PASS | 背景子代理執行中追問 157 ms 得到回答；對注入回合按 Esc 子代理仍在跑；放行後完成 |
| ⑦d | PASS | 主回合進行中送第 2 則：提示「目前回合結束後送出。 取消」（waits-for=turn）；放行後同一段對話依序「turn-a answer」→「turn-b answer」（turn-b 請求 27 則訊息、只送一次、無「已中斷」前綴、turn-a 未重送）；提示消失、回合顯示結束 |
| ⑦e | PASS | 按待送提示上的「取消」：提示消失；進行中的回合正常回答；3 s 內沒有被取消訊息的請求 |
| ⑦f | PASS | 有待送訊息時按 Esc：提示消失、待送訊息沒有送出；下一則訊息正常回答 |
| ⑧ | PASS | 舊 `claude-code-v2` / "Claude Agent V2" 讀成 "✦Claude Agent"，下一則訊息 resume（47 則訊息，sdkSessionId 不變） |
| ⑨ | PASS | claude-cli PTY：`CLAUDE_CODE_ENABLE_TODO_TOOLS` / `CLAUDE_CODE_ENABLE_TASKS` 未設、`DISABLE_UPDATES=1`；主行程未設 TODO 變數 |
| ⑩ | PASS | getSupportedModels 12 列；4 s 內 0 個模型請求；暫存家目錄沒有新 session 檔 |
| ⑪ | PASS | session 寫在 `CLAUDE_CONFIG_DIR`（1 檔），暫存家目錄沒有；listSessions 找得到；只載入 `CLAUDE_CONFIG_DIR/plugins` 的 plugin（家目錄誘餌未載入） |
| ⑫ | PASS | 重開後分頁 resume，歷史由 `CLAUDE_CONFIG_DIR` 重建，還原期間 0 個模型請求 |

#### pre7（`e2e/v072-pre7-claude-panel-ui.spec.ts`，BUG-177 / BUG-178 不回歸）

| 情境 | 結果 | 摘要 |
|---|---|---|
| A1 | PASS | 縮圖「+」選單開 Claude Agent 分頁；閒置 6 s：0 個模型請求、0 個 session 檔 |
| A2 | PASS | `/model` 清單 12 列、選 "Sonnet 4.6 (200k)"；0 個模型請求 |
| A3 | PASS | 一則訊息 → 一個 session 檔；`/resume` 只列該 session；總共 1 個模型請求 |
| B1 | PASS | session 寫在 `CLAUDE_CONFIG_DIR`，`HOME/.claude` 沒有 |
| B2 | PASS | `/t0737` 補全只列 `CLAUDE_CONFIG_DIR` 的 plugin，家目錄誘餌不出現 |
| B3 | PASS | 塔台 › 總覽 預設值層讀 `CLAUDE_CONFIG_DIR` 下的 `tower-config.md` |
| B4 | PASS | 重開後還原分頁顯示問答；新分頁 `/resume` 挑該 session → 歷史重建、下一則訊息帶上前文 |
| B5 | PASS | `HOME/.claude` 4 個誘餌檔大小 / mtime 不變 |

### 給使用者的手動確認清單（安裝版 `v0.7.4-pre.5`，Claude Agent 面板）

1. 開一個 Claude Agent 分頁，送一則會跑一陣子的訊息（例：請它逐步讀幾個檔案再總結）。回答還在跑時，再送第 2 則。
   → 輸入框上方出現「目前回合結束後送出。 取消」；第 1 則回答完後，第 2 則在**同一段對話**接著回答（沒有「已中斷」字樣、第 1 則沒有重跑）。
2. 回合進行中再送一則，這次按提示上的「取消」。
   → 提示消失；目前的回合照常回答完；被取消的那則不會送出（對話裡看不到它的回答）。
3. 回合進行中再送一則，然後按 Esc。
   → 目前回合停止、待送提示消失、那則訊息不會送出；之後再送新訊息可正常回答。
4. 讓它跑一個需要權限的動作（例：請它用 Bash 建一個資料夾），權限卡出現時在輸入框送一則訊息。
   → 提示變成「請先回答上方問題，回答後送出。 取消」，權限卡還在；按「是」後動作執行，剛才那則訊息接著被處理、只送一次。
5. （選做）同上但用提問卡（AskUserQuestion）：卡片等待時送出，同樣看到「請先回答上方問題」。

### 變更檔案

- `_ct-workorders/T0819-plan058-verify-installed-claude-panel-e2e.md`（只有本工單）

### Commit

- 不需產品 commit（純驗收，未改任何產品程式 / 測試 / 文件）。
- 本工單回報 commit：見 git log（`T0819`）。

### 遭遇問題

- 無。說明：e2e 前 `git log` 的 HEAD 已從 session 起點的 `29944e22` 前進到 `c2e64321`（其他 session 的 commit），與本單無關。spec 的 `test.skip` 只檢查 repo 內 `node_modules/@anthropic-ai/claude-code/bin/claude.exe` 是否存在（存在，未 skip）；跑起來的面板用的是安裝版自己內嵌的 claude，spec 不依賴 source build。

### 互動紀錄

- [00:50] yolo、無問題需問塔台。

### 結論

**PASS** —— 安裝版 `v0.7.4-pre.5` 的假 API e2e：pre6 ①–⑫、⑥b、⑦b–⑦f 全數 PASS，pre7 A1–A3 / B1–B5 全數 PASS；使用者 BAT 主實例未受影響。建議塔台交使用者依上方清單手動確認後結 PLAN-058。
