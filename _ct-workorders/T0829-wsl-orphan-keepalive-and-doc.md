---
schema_version: 1
schema_kind: workorder
id: T0829
title: "PLAN-043 小項：BAT 被強制結束時不留下孤兒 wsl.exe（keep-alive）＋ plan-007 checklist 的 NAT 措辭"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-04T08:52:59+0800"
started_at: "2026-11-04T09:14:49+08:00"
updated_at: "2026-11-04T09:19:51+08:00"
completed_at: "2026-11-04T09:19:51+08:00"
session_ids:
  - "48e0dad9-f672-46cb-a620-1f422ee5b380"
depends_on: [T0827]
related:
  - "PLAN-043 範圍 3；D271；T0384（`electron/wsl-keepalive.ts` keep-alive holder，回報區提出孤兒 `wsl.exe` / Job Object）；T0383 / T0653（NAT 不需強制改）；PLAN-035（`_ct-workorders/_archive/plans/`）"
affects_files:
  - _ct-workorders/T0829-wsl-orphan-keepalive-and-doc.md
  - electron/wsl-keepalive.ts
  - electron/main.ts
  - electron/__tests__/
  - docs/plan-007-release-checklist.md
  - docs/wsl-deployment.md
  - CHANGELOG.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 不新增 npm 依賴、不新增原生模組（`allowScripts` 是政策，CLAUDE.md「本機開發：npm 12 install scripts」）。若評估後唯一可行的是原生 Job Object API，先停，依 ct-exec § Questions For Tower 問塔台並附方案比較，不要自行加依賴。"
  - "🔴 keep-alive 正常路徑行為不變：何時啟動、哪些 distro、BAT 正常結束時的停止都照舊；只補「BAT 主行程被強制結束（工作管理員 / 當機 / NSIS 強制結束）」後不留下 `wsl.exe`。Child Process 規則照 CLAUDE.md（`execFile` / `spawn` ＋陣列參數，不經 shell）。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0829 — 孤兒 wsl.exe ＋ NAT 措辭（PLAN-043 小項）

## 元資料

- **工單編號**：T0829
- **類型**：implementation
- **狀態**：DONE
- **建立時間**：2026-11-04 08:52 (UTC+8)
- **依賴**：T0827（同改 `electron/main.ts`，等它 commit 後再派）
- **預估規模**：S；Context Window 風險：低

## 任務指令

### 前置條件
- `electron/wsl-keepalive.ts` 與 `electron/main.ts` 的 `wslKeepAlive` / `syncWslKeepAlive`
- `_ct-workorders/_archive/workorders/T0384-wsl-keepalive-holder.md`（回報區的孤兒 `wsl.exe` 說明）
- `_ct-workorders/PLAN-043-wsl-automation-phase2-3.md`

### 任務

**A. 孤兒 `wsl.exe`**
1. 先實測 / 讀碼確認現況：BAT 主行程被 `taskkill /F` 後，keep-alive 的 `wsl.exe`（與 distro 內的對應程序）是否殘留、殘留多久、對使用者的影響（distro 一直不閒置關機）。
2. 設計不需原生模組的解法，候選（Worker 評估後選一或組合，寫明理由）：
   - keep-alive 指令改成「stdin 關閉就結束」（例如 distro 內 `read` / `cat` 等待 stdin EOF，BAT 以 pipe 持有 stdin；主行程死亡 → pipe 關閉 → 結束）。須確認 `wsl.exe` 確實轉送 stdin EOF。
   - 啟動時清理上一次殘留：記錄 keep-alive 的 pid（與啟動時間 / 指令特徵）到 userData，下次啟動時只結束確認屬於 BAT 的那幾個（不得誤殺使用者自己的 `wsl.exe`）。
   - 其他（說明）。
3. 實作＋單元測試；Windows 實機以「啟動 BAT 開發版或隔離 runtime → 有 WSL keep-alive → `taskkill /F` 主行程 → 觀察 `wsl.exe`」驗證，記錄指令與結果。🔴 不碰使用者執行中的 BAT 安裝版；若需要 WSL profile 才會啟動 keep-alive 而環境做不到，改以單元 / 整合測試證明並在回報區列〈待實機驗收〉。

**B. 文件**
- `docs/plan-007-release-checklist.md` 約第 63 行：「Confirm `%UserProfile%\.wslconfig` uses `networkingMode=mirrored` (or document NAT mode …)」改為與 `docs/wsl-deployment.md` 一致：NAT 一般可用、連線測試失敗才需處理（2026-11-02 使用者決定下次 WSL 工單一併改）。
- 若 A 改變了 keep-alive 行為，`docs/wsl-deployment.md` 相關描述同步。

### 驗收條件
- [ ] `npm run typecheck:electron` = 0、`npm run typecheck` = 0
- [ ] `npm run test:unit` 全過；`npx vite build` 成功
- [ ] keep-alive 正常啟停的既有測試不改語意仍通過
- [ ] 強制結束情境的驗證證據（實機或測試）
- [ ] `CHANGELOG.md` `[Unreleased]` 一條；commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

- **狀態**：DONE
- **commit**：`841f5e6a`（產品：`electron/wsl-keepalive.ts`、`electron/__tests__/wsl-keepalive.test.ts`、新增 `electron/__tests__/wsl-keepalive-forced-kill.test.ts`、`docs/plan-007-release-checklist.md`、`docs/wsl-deployment.md`、`CHANGELOG.md`）；本工單檔另一個 commit
- **session_id**：48e0dad9-f672-46cb-a620-1f422ee5b380
- **落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 PASS；C-3 `affects_files` 皆存在（informational）；C-2 無 `branch` 欄位（`main`）。`CT_HOME` 未設（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`BAT_REMOTE_TOKEN`：已設定。

### 產出摘要

**A. 孤兒 `wsl.exe`：現況實測 —— 不存在，T0384 回報第 152 行的推論不成立。**

libuv 在 Windows 會把所有非 `detached` 的子行程放進它自己的 process-wide Job Object（`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`）；主行程不論怎麼結束（`taskkill /F`、工作管理員、當機、安裝程式），job handle 一關，OS 就結束 job 內的 `wsl.exe`。keep-alive 的 holder 沒設 `detached`，所以已經受到保護。內層 `C:\Program Files\WSL\wsl.exe`（silent breakaway，不在 job 內）與 distro 內的 `sleep infinity` 在外層結束後自行結束（與 T0384 對 `child.kill()` 的觀察一致）。

實測（2026-11-04，Windows 11 10.0.28000、WSL Ubuntu-24.04 Running、Electron 45.2.1；觀察 `Get-CimInstance Win32_Process -Filter "Name='wsl.exe'"` 與 `wsl.exe -d Ubuntu-24.04 -- pgrep -af 'sleep infinity'`）：

| # | 父行程 | holder spawn | `taskkill /F` 父行程後 | 結果 |
|---|---|---|---|---|
| 1 | 純 `node` | 現行（`sleep infinity`、`stdio: 'ignore'`） | 5 s：兩層 `wsl.exe` 與 `sleep` 都不在 | 無孤兒 |
| 2 | 純 `node` | 候選「stdin EOF」（`-- cat`、stdin pipe） | 5 s：都不在 | 無孤兒（同 job 機制） |
| 3 | 最小 Electron 45.2.1 main（同樣 spawn 參數） | 現行 | 1 s / 3 s / 10 s：都不在 | 無孤兒 |
| 4 | **BAT 開發版**（`npx vite build` → `electron.exe <repo> --runtime=t0829`，隔離 userData 放一筆 `targetOS: wsl-linux` / `wslDistro: Ubuntu-24.04` 的 profile；log `[wsl-keepalive] holding Ubuntu-24.04 (pid=41900)`） | 現行 | 主行程 41560 被 `taskkill /F` 後 2 s / 10 s：兩層 `wsl.exe`（41900 / 43536）與 `sleep` 都不在 | 無孤兒 |
| 5 | 反向對照：純 `node`，spawn 加 `detached: true` | — | 10 s：兩層 `wsl.exe` 與 `sleep infinity` **仍在** | 有孤兒（之後手動 `taskkill /F /T` 清除） |

對使用者的影響：現行版本沒有「distro 一直不閒置關機」的問題；唯一會造成孤兒的寫法是 `detached: true`（#5）。

**決定（不改正常路徑行為）**：不採 stdin EOF（換掉 `sleep infinity` 改變 holder 指令，且保護來源一樣是 job）、不採啟動時清 pid（要寫 userData、比對 pid 重用，問題本來就不存在）、不需要原生 Job Object API。改為把依賴寫明並加回歸防護：

- `electron/wsl-keepalive.ts`：holder 的 command / args / options 集中到匯出的 `holderSpawn(distro)`（內容與原本逐字相同：`wsl.exe -d <distro> -- sleep infinity`，`{ windowsHide: true, stdio: 'ignore' }`），`spawnHolder` 改呼叫它；檔頭與函式註解寫明「不得加 `detached`」與原因。何時啟動、哪些 distro、正常結束的 `stopAll()` 都沒動。
- `electron/__tests__/wsl-keepalive.test.ts`：+2 測試 —— 實際 spawn 呼叫等於 `holderSpawn()` 且 `detached` 未設；source guard（去掉註解後原始碼不得出現 `detached`）。既有 13 個測試未改。
- `electron/__tests__/wsl-keepalive-forced-kill.test.ts`（新）：可選實機測試，只在 Windows 且設 `BAT_TEST_WSL_DISTRO=<distro>` 時跑；`node` 父行程以 `holderSpawn()` 起 holder → 等內層 `wsl.exe` 出現 → `taskkill /F` 父行程 → 10 s 內兩個 `wsl.exe` pid 都必須消失；`finally` 清掉殘留。未設 env 時 skip（CI 不會啟動 WSL）。
- `electron/main.ts`：不需改（`syncWslKeepAlive` / `stopAll` 照舊）。

**B. 文件**

- `docs/plan-007-release-checklist.md`：「Confirm `.wslconfig` uses `networkingMode=mirrored` …」改為「記錄網路模式；NAT 一般可用、mirrored 選用，連線測試失敗才改 `.wslconfig`」，連到 `wsl-deployment.md#nat-warning`。
- `docs/wsl-deployment.md` Keepalive 段：補一句「BAT 被強制結束時 holder 隨主行程結束，不會有 `wsl.exe` 讓 distro 繼續執行」。
- `CHANGELOG.md` `[Unreleased]` › Changed 一條。

**驗收**

- [x] `npm run typecheck:electron` = 0、`npm run typecheck` = 0（`validated_sha` 基底 `94121f35` + 本單工作樹變更，即 `841f5e6a` 的內容）
- [x] `npm run test:unit`：409 檔通過、3 skipped（7178 passed / 39 skipped）；`npx vite build` 成功
- [x] keep-alive 既有測試未改語意、全部通過
- [x] 強制結束證據：上表 #1–#5 實測（含 BAT 開發版 #4）＋ `BAT_TEST_WSL_DISTRO=Ubuntu-24.04 npx vitest run electron/__tests__/wsl-keepalive-forced-kill.test.ts electron/__tests__/wsl-keepalive.test.ts` → 2 檔 16 測試通過；不設 env → 1 skipped
- [x] `CHANGELOG.md` 一條；commit 只含本單範圍（未 stage 的 Tower 檔 `BUG-211` / `T0832`–`T0837` 未碰）

**清理**：實驗起的程序全部結束（含隔離實例留下的 crashpad handler 與 Terminal Server，只限 parent = 41560 的那兩個；未碰使用者的安裝版 BAT）；隔離 userData `%APPDATA%\BetterAgentTerminal-runtime-t0829` 已刪除（內含權杖檔）。實驗腳本只在 scratchpad。

**後續建議（給塔台）**

- PLAN-043 範圍 3 的「孤兒 `wsl.exe`（Job Object）」候選可結案：不需要原生 Job Object，libuv 已提供；T0384 回報第 152 行可加註「T0829 實測不成立」。
- 同一機制也適用其他未 `detached` 的主行程子行程（例如 SSH tunnel），本單未查證、只列觀察。

### 互動紀錄

- [09:12] 工單 yolo（`CT_MODE=yolo`、`CT_INTERACTIVE=0`），無向塔台提問；實測顯示問題不存在後，依「in-scope 由 Worker 取最佳建議、事後回報」決定不改 holder 行為、改加防護（工單步驟 1「先實測確認現況」本即允許此結果）。

### Renew 歷程

（無）

### 遭遇問題

- 無阻塞。T0384 回報第 152 行（「BAT 被強制終止時父 `wsl.exe` 會留下」）是未實測的推論，本單實測推翻。
- 反向對照 #5 的 PowerShell 腳本解析 pid 時因 stdout 帶 BOM／不可見字元轉型失敗，改以手動 `taskkill /F /T /PID 27988` 清除，已確認 distro 內無殘留 `sleep infinity`。

### 回報時間

- 2026-11-04 09:19 (UTC+8)
