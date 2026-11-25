---
schema_version: 1
schema_kind: workorder
id: T0920
title: "補驗 BUG-220／221／222：用新測試版（`0.0.0-exp.21`，`v0.8.x` `6d7b4cd3`）與真 claude 塔台重跑 M-C1-2、M-C2-b、M-C5 排隊權限詢問"
type: verification
status: DONE
repo: better-agent-terminal
project: PLAN-068
priority: P1
sizing: M
created_at: "2026-11-25T13:02:50+08:00"
started_at: "2026-11-25T13:27:47+08:00"
updated_at: "2026-11-25T14:07:30+08:00"
completed_at: "2026-11-25T14:07:30+08:00"
session_ids:
  - "f96d94a8-e96a-4015-960c-c9b2a4e55f0a"
target_version: "0.8.0-pre.3（與 CT 6.1.0 同日發佈）"
depends_on: [T0915, T0919]
related:
  - "PLAN-068；D337；BUG-220（T0916）／BUG-221（T0917）／BUG-222（T0918）；T0915 驅動（`e2e/manual/ct610-driver.ts` 等，已在 `v0.8.x`）與回報區；CT D878（CT 端判定已完成；本單不改 `--set-role` 輸出與契約欄位，CT 不必重判）"
affects_files:
  - _ct-workorders/T0920-reverify-bug220-222-real-claude-tower.md
  - e2e/manual/
renew_count: 0
isolation: worktree
workdir: "worktree ct/T0920（塔台已預先從 `v0.8.x` `6d7b4cd3` 建立分支 `ct/T0920`）"
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0920` 寫檔；開工確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = `6d7b4cd3ec4b301424f1a5866321cf71251f456d`，不符就停下問塔台。不 merge / rebase / push、不動 `main` 與 `v0.8.x`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。🔴 不改產品程式；驅動腳本若要修，只改 `e2e/manual/`。"
  - "🔴 外部路徑（只在本機，不進 repo；repo 內與回報區一律寫 `<使用者資料夾>` 或 `%LOCALAPPDATA%`，D176）：驗收根目錄 `%LOCALAPPDATA%/ct610-accept`（ACCEPT，結構同 T0915：`checklist.md`、`claude-config/`（CFG，目前 CT 6.1.0-pre.1、使用者已登入）、`ct-test-project/`、`runs/`、`results/`）。新測試版：`%LOCALAPPDATA%/BAT-TestBuilds/0.0.0-exp.21-win/BetterAgentTerminal.exe`（塔台已下載解壓並核對 SHA-256）。"
  - "🔴 前置條件（任一不成立 → 不開任何 claude 回合，BLOCKED，通知塔台）：① 新測試版 exe 存在且 `resources/package.json` 版本 = `0.0.0-exp.21`；② `CFG/.credentials.json` 存在（🔴 只檢查存在，不讀、不複製、不記內容）；③ `ct-swap.py status --target CFG/skills` 顯示 6.1.0-pre.1。④ `CFG` 裡 T0915 在 M-C5 裝的 `bat-hooks` plugin 的 marketplace 指向已刪除的 T0915 worktree：若它讓 claude 啟動報錯或擋住測試，用同一個 `CLAUDE_CONFIG_DIR` 以 `claude plugin` 指令停用（不要手改設定檔），在回報區記錄；🔴 使用者層 `~/.claude` 不得有任何變更（前後雜湊比對）。"
  - "🔴 啟動與操作完全照 T0915：`launchIsolated`＋`BAT_E2E_EXECUTABLE`（獨立 `--runtime=e2e-*`）、env `CLAUDE_CONFIG_DIR=CFG`、`dropEnv` 去掉 `CLAUDECODE` / `CLAUDE_CODE_*`；塔台是 BAT 開的 claude-cli 分頁；鍵盤 / 滾輪 / 點擊走 Playwright。每個情境一份新副本 `ACCEPT/runs/R1`、`R2`、`R3`（從 `ct-test-project` 複製，保留不刪）。"
  - "🔴 補驗項目：R1＝M-C1-2（BUG-220）：沒有 `_ct-workorders/` 的副本 → 加工作區 → 開契約 2 塔台 `/control-tower` → **不按 ↻**，待辦分頁應在數秒內變「契約 v2 ✓」；再刪除 `_ct-workorders/` 讓塔台重建一次，確認也自動恢復。R2＝M-C2-b（BUG-221）：真 claude 全螢幕塔台滾輪往上捲、停 15 s 以上後讓 Worker 送通知 → 通知保留（debug log `[notify-hold] held … reason=reading`、`[tower-reading] … alt scrolled-up=true`），畫面不被拉回底部；之後按一個鍵 → 約 1–2 s 內送出。R3＝BUG-222：manual mode 塔台（工作區 claude-cli 參數設空字串＋Shift+Tab 切 manual，同 T0915 M-C5）讓 claude 同一回合平行送出 ≥ 2 個需要權限的工具呼叫（例：Bash＋2 個 Read），回答第一個後 → debug log 有 `kept: user input while <n> permission prompts are open`、縮圖 ⚠️ 仍在；「2 of n」期間送達的 Worker 通知 `[notify-hold] held`，Enter 沒有替使用者回答；全部回答完、批次結束後通知才送出。另：單一權限詢問回答後 ⚠️ 照舊立即消失（回歸檢查）。需要模型配合的狀態同一項最多試 3 次，仍沒出現判「未觸發」，🔴 不得硬判 PASS。"
  - "🔴 結果：更新 `ACCEPT/results/M-C1.md`、`M-C2.md`、`M-C5.md`：在檔尾新增〈補驗（T0920，BAT `0.0.0-exp.21`）〉段（執行時間系統取時、步驟、觀察、BAT 端判定、證據檔名、claude 回合數），截圖放 `results/M-Cn/reverify/`。🔴 不改 T0915 原有內容與「CT 端判定」欄。FAIL：不修產品，記重現與證據，回報區建議處置。"
  - "🔴 清理（D308）：結束前以 `closeIsolated` 關閉、確認 Terminal Server 已結束；比對 `ExecutablePath` 含 `BAT-TestBuilds` 或命令列含 `runtime-e2e-` / `ct610-accept` 的程序，只結束本單建立的；runtime userData 在日誌複製到 `results/` 後刪除。驅動狀態檔刪除。"
  - "🔴 驗證與 Git：若改了 `e2e/manual/`，`npx vite build` exit 0、兩個 typecheck = 0；worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag；禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；收單前 worktree `status --porcelain` 為空。yolo：不得問使用者，判讀問題問塔台。"
---

# T0920 — 補驗 BUG-220／221／222（真 claude 塔台）

| 情境 | 項目 | 對應修正 |
|---|---|---|
| R1 | M-C1-2 待辦分頁自動讀到新建的 `_ct-workorders/` | T0916 |
| R2 | M-C2-b 全螢幕塔台往上捲停住時保留通知 | T0917 |
| R3 | 排隊的權限詢問期間維持 `blocked`、通知保留 | T0918 |

## 驗收

- [x] 前置條件 ①–④
- [x] R1／R2／R3 各自 BAT 端判定（PASS／FAIL／未觸發，附證據）
- [x] 結果檔補驗段、截圖
- [x] 程序與 runtime 清理、使用者層 `~/.claude` 未變

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **狀態**：DONE（R1／R2／R3 的 BAT 端全部 PASS；沒有 FAIL、沒有未觸發）
- **開始／完成**：2026-11-25T13:27:47+08:00 ～ 2026-11-25T14:07:30+08:00
- **session_id**：f96d94a8-e96a-4015-960c-c9b2a4e55f0a
- **branch**：`ct/T0920`
- **base_sha**：`06c3b8843caf4f34bbec6117b0de443b7a3fdbf9`（`CT_WORKTREE_BASE`）；`merge-base HEAD v0.8.x` = `6d7b4cd3ec4b301424f1a5866321cf71251f456d`，開工時核對相符
- **validated_sha**／**head_sha**：`6d7b4cd3ec4b301424f1a5866321cf71251f456d`（本單沒有產品 commit，worktree 沒有任何變更）

### 落點檢查
- C-0：PASS（frontmatter `repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal`）
- C-1：PASS（工單在 `$CT_HOME/_ct-workorders/`）；C-3：PASS（`e2e/manual/` 存在）；C-2：沒有 `branch` 欄位，略過
- 證據：`CT_HOME`、`CT_WORKTREE_BRANCH=ct/T0920`、`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）；`BAT_REMOTE_TOKEN` 已設定

### 前置條件
| # | 條件 | 結果 |
|---|---|---|
| ① | 新測試版 exe 存在、`resources/package.json` 版本 | PASS：`BAT-TestBuilds/0.0.0-exp.21-win/BetterAgentTerminal.exe` 存在，版本 `0.0.0-exp.21` |
| ② | `CFG/.credentials.json` 存在 | PASS（只檢查存在，沒有讀取） |
| ③ | `ct-swap.py status --target CFG/skills` | PASS：`結論：9 個 skill 都是 6.1.0-pre.1` |
| ④ | T0915 的 `bat-hooks` plugin | `claude plugin list`（測試版內嵌 claude 2.1.331，`CLAUDE_CONFIG_DIR=CFG`）顯示 `✘ failed to load`（`Marketplace better-agent-terminal failed to load: cache-miss`）→ 以 `claude plugin disable bat-hooks@better-agent-terminal` 停用（exit 0，`✘ disabled`）。`CFG/settings.json` 只改了 `enabledPlugins` 的值（true → false）。證據 `ACCEPT/results/T0920/plugin-disable.txt`、`cfg-settings-before.json`／`after.json` |

### 總表（BAT 端判定）
| 情境 | 項目 | BAT 端判定 | 塔台 claude 回合數 | 結果檔 |
|---|---|---|---|---|
| R1 `ACCEPT/runs/R1` | M-C1-2 待辦分頁自動讀到新建的 `_ct-workorders/`（不按 ↻） | **PASS**：`_tower-state.md` 13:32:08 寫入 → 13:32:09 已是「契約 v2 ✓」 | 2 | `results/M-C1.md`〈補驗〉 |
| R1 | 刪除 `_ct-workorders/` 後由塔台重建 | **PASS**：刪除後 1 s 內 P-3；重建 13:33:38 → 13:33:39 自動恢復 | （同上） | 同上 |
| R2 `ACCEPT/runs/R2` | M-C2-b 停手 15 s 以上後到達的通知保留（`held … reason=reading`、`alt scrolled-up=true`），畫面不被拉回底部 | **PASS**（兩次：停手 106 s／78 s 後到達都保留） | 6（＋Worker 2） | `results/M-C2.md`〈補驗〉 |
| R2 | 之後按一個鍵 → 約 1–2 s 內送出 | **PASS**（第 2 次：按 ← 後 1.08 s `sent`）；第 1 次按 ↓ 時閱讀狀態同樣立即解除，但 ↓ 依 `trackDraft` 設計算草稿，改成 `draft` 保留，Ctrl+C 後 1.07 s 送出——是我選錯鍵，不是 BUG-221 | | 同上 |
| R3 `ACCEPT/runs/R3` | BUG-222：回答第一個後 `kept: user input while 2 permission prompts are open`、⚠️ 仍在 | **PASS**（第 1 次就觸發） | 5（＋Worker 1） | `results/M-C5.md`〈補驗〉 |
| R3 | 「2 of 2」期間送達的 Worker 通知 `[notify-hold] held … reason=permission`，Enter 沒有替使用者回答 | **PASS** | | 同上 |
| R3 | 全部回答完、批次結束（`cleared (hook post-tool-batch)`）後 1.0 s 通知才送出 | **PASS** | | 同上 |
| R3 | 回歸：單一權限詢問回答後 ⚠️ 立即消失（`cleared (user input)`，約 90 ms） | **PASS**（收單時 7 次單一詢問都一樣） | | 同上 |

截圖在 `ACCEPT/results/M-C1/reverify/`（3 張）、`M-C2/reverify/`（9 張）、`M-C5/reverify/`（11 張），另有各塔台的對話紀錄（`tower-output.txt`）、PTY 輸出、狀態檔複本；runtime 日誌（debug log、bat-scripts.log）在 `ACCEPT/results/T0920/logs/`，驅動日誌 `ACCEPT/results/T0920/driver-t0920.log`。T0915 原有內容與「CT 端判定」欄沒有改動，補驗段都加在檔尾。

### 做法說明
- 一個隔離 BAT（`launchIsolated`＋`BAT_E2E_EXECUTABLE`，runtime `e2e-t0920-1795584621958`，`CLAUDE_CONFIG_DIR=CFG`，`dropEnv` 去掉 `CLAUDECODE`／`CLAUDE_CODE_*` 等；主行程 env 檢查 `claudeSessionVars: []`、`ctVars: []`），以 `workspace.save`＋reload 建 3 個工作區 `t0920-R1`／`R2`／`R3`（claude-cli／claude-code 參數 `--dangerously-skip-permissions`），三個塔台都是 UI「＋ → 以塔台開啟 Claude」開的 claude-cli 分頁。鍵盤、滾輪、點擊走 Playwright；Worker 都是塔台用 helper 派的真 Worker。
- R3 的 manual mode 與 T0915 不同：沒有改工作區參數、沒有 reload；塔台以 bypass 開啟、完成派工後按 Shift+Tab 兩下（bypass → auto → manual）。
- 按鍵前以程式 `focus()` xterm 的 textarea（不用滑鼠點擊，因為點擊本身也會結束閱讀狀態）。

### 環境與清理
- 使用者層 `~/.claude`：開工前與結束後雜湊相同（`ACCEPT/results/T0920/user-claude-before.txt`／`after.txt`：`.credentials.json`、`settings.json`、`CLAUDE.md`、`plugins/*`、skills 樹）。
- 程序（D308）：驅動以 `closeIsolated` 結束（`Terminal Server pid 50052 alive after teardown: false`、`runtime userData removed: true`），runtime userData 已在日誌複製後刪除，驅動狀態檔已刪。之後比對 `ExecutablePath` 含 `BAT-TestBuilds`：還有 7 個 `claude.exe`（13:44:51 建立，命令列含本單 runtime `e2e-t0920-…`）——是我在 R2 全螢幕塔台按 ← 時觸發 claude 的「← for agents」，claude 起了自己的背景 daemon（`daemon run --origin transient`）並帶起本工作區的 session；以 `taskkill /F /T` 結束該 daemon 樹（只結束本單建立的），之後再查 0 個。
- `CFG/` 因此多了 claude daemon 的 `daemon/`、`daemon.lock`、`daemon.log`、`daemon.status.json`、`jobs/`（測試專用目錄，沒有刪）；`bat-hooks` plugin 維持停用。`ACCEPT/runs/R1`、`R2`、`R3` 保留未刪。

### 驗證
| 關卡 | 結果 |
|---|---|
| `npx vite build`、兩個 typecheck | 不適用：本單沒有改 `e2e/manual/` 或任何 repo 檔案（worktree `status --porcelain` 為空） |
| 相依 | worktree 沒有 `node_modules`，依專案慣例 `npm ci` 後才跑驅動（exit 0） |

### 建議（給塔台，非 FAIL）
1. 縮圖 `📨` 在 `reason=reading` 時的 tooltip 仍寫「停手 10 秒後送出（最長 60 秒）」，T0917 後 alt screen 往上捲是「一直保留到按鍵／點擊／切走／捲回（上限 60 秒）」，文字可考慮更新（`results/M-C2/reverify/03-held-reading.png`）。
2. 全螢幕 claude 塔台的「中性鍵」：↑／↓ 算草稿、← 會開 claude 的 agents 畫面；之後的驗收或文件若要寫「按一個鍵」，建議寫 End／Home 一類。
3. 測試塔台（`CFG/` 以使用者的 claude.ai 帳號登入）在 R3 首次啟動時誤用 artifact 發布工具，把 R3 的 `_tower-state.md`（13:47 版）發成私人 artifact `https://claude.ai/artifact/2qqGGbpS4AjbWV8GNAnB7o`（塔台自述內容沒有權杖；`results/M-C5/reverify/tower-output.txt` 第 2538、2611 行）。與 BAT 判定無關；要不要刪除請使用者決定（本單沒有刪）。若這是 CT 6.1.0-pre.1 的行為（狀態檔寫入時選錯工具），可轉 CT 塔台參考。

### 遭遇問題
- R2 第 1 次按 ↓ 造成 `draft` 保留（見總表），改用 ← 重做一次通過；← 又觸發 claude 背景 daemon（見〈環境與清理〉）。
- R3 收單時塔台在 manual mode 對每個工具都要詢問（含 MCP `bat_list_terminals`，選「switch to auto mode」後 MCP／Edit 仍會問），腳本當時只等回合結束、沒有回答，塔台在 MCP 詢問停了約 5 分鐘（13:53:28～13:58:59），之後逐一回答完成收單。

### 互動紀錄
- [13:27] 開工；落點檢查 PASS、前置條件 ①②③ PASS、④ plugin `failed to load` → 依工單以 `claude plugin disable` 停用。
- 沒有向塔台提問、沒有使用者輸入。

### 相關通過案例判定
- 工單沒有〈相關通過案例〉段落；本單不改任何程式，不適用。
