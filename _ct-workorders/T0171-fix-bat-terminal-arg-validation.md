# T0171-fix-bat-terminal-arg-validation

## 元資料
- **工單編號**：T0171
- **任務名稱**：修復：`bat-terminal.mjs` 加未識別參數驗證 + `--help` / `--version` 支援
- **狀態**：FIXED
- **類型**：bug-fix
- **互動模式**：disabled
- **建立時間**：2026-04-18 13:50 (UTC+8)
- **開始時間**：2026-04-18 14:35 (UTC+8)
- **完成時間**：2026-04-18 14:41 (UTC+8)
- **預估工時**：45 min - 1h（含 bat-notify.mjs 波及檢查 + 雙腳本驗證）
- **實際工時**：~6 min
- **關聯 BUG**：BUG-039 🟡 Medium
- **關聯 PLAN**：PLAN-020（工單 5 dogfood 前置清理）
- **依賴**：無（可並行 CT-T002）
- **風險**：🟢

## 目標

修復 `scripts/bat-terminal.mjs` 的「未識別參數靜默 passthrough」問題（BUG-039），改為：
- 無後接命令時 error 退出（不開終端）
- 未識別 `--flag` 一律報錯
- 支援 `--help` / `-h` / `--version`

並檢查 `scripts/bat-notify.mjs` 是否有相同缺陷，一併修。

## 範圍

**納入**：
1. `scripts/bat-terminal.mjs` argv 解析重構
2. `scripts/bat-notify.mjs` 同類問題檢查 + 修復（若存在）
3. P0-P3 全數修復（見下方優先順序）
4. 回歸驗證

**排除**：
- 不改 `electron/` 任何檔案
- 不改 `package.json`
- 不新增 CLI 框架依賴（保持零依賴，原生 argv 處理）

## 詳細規格

### P0：無後接命令時 error（核心防呆）

**現狀**：`node scripts/bat-terminal.mjs --help` → 開新終端標題 `--help`

**目標**：必須有至少一個**非 flag** 參數作為要執行的命令，否則：
```
Error: No command specified
Usage: bat-terminal.mjs [options] <command> [args...]
Run with --help for details.
```
退出 code 1，**不開終端**。

### P1：未識別 `--` 參數報錯

**白名單 flag**（僅允許這些）：
- `--notify-id <id>`
- `--help` / `-h`
- `--version`

其他 `--*` 形式的參數一律報錯：
```
Error: Unknown option '--nofity-id' (did you mean '--notify-id'?)
Usage: bat-terminal.mjs [options] <command> [args...]
```
退出 code 1，**不開終端**。

**拼字建議**（可選）：若錯字與白名單 edit-distance ≤2，建議正確拼字。

### P2：`--help` / `-h` 輸出 usage

內容至少涵蓋：
```
Usage: bat-terminal.mjs [options] <command> [args...]

Open a new BAT terminal and run <command> in it.

Options:
  --notify-id <id>   Target terminal ID for Worker->Tower notification binding
  --help, -h         Show this help message
  --version          Show version

Examples:
  node scripts/bat-terminal.mjs claude "/ct-exec T0001"
  node scripts/bat-terminal.mjs --notify-id abc123 claude "/ct-exec T0001"
```

退出 code 0。

### P3：`--version`

輸出格式：
```
bat-terminal.mjs v<version>
```

版號來源：讀 `package.json` 的 `version` 欄位（require/readFile）。或若嫌麻煩可硬編碼 `0.1.0`（Worker 判斷）。

退出 code 0。

### 對 `bat-notify.mjs` 的波及檢查

讀 `scripts/bat-notify.mjs` 的 argv 解析邏輯（line 88-180 附近）：
- 若有未識別 flag passthrough 問題 → 同步修復
- 若已有 unknown flag 檢查 → 標註於回報區「已有防護，無需修改」

## 驗收條件

### P0 驗證
- ✅ **P0-1**：`node scripts/bat-terminal.mjs` (空 args) → exit 1 + 「No command specified」 + **不開終端**
- ✅ **P0-2**：`node scripts/bat-terminal.mjs --notify-id abc` (只有 flag 無命令) → exit 1 + 錯誤訊息

### P1 驗證
- ✅ **P1-1**：`node scripts/bat-terminal.mjs --unknown-flag cmd` → exit 1 + 「Unknown option」
- ✅ **P1-2**：`node scripts/bat-terminal.mjs --nofity-id xxx cmd` → exit 1 + 「did you mean '--notify-id'?」（若實作拼字建議）
- ✅ **P1-3**：`node scripts/bat-terminal.mjs --notify-id abc claude "/test"` → 正常開終端（白名單通過）

### P2 驗證
- ✅ **P2-1**：`node scripts/bat-terminal.mjs --help` → 輸出 usage + exit 0 + **不開終端**
- ✅ **P2-2**：`node scripts/bat-terminal.mjs -h` → 同 P2-1

### P3 驗證
- ✅ **P3-1**：`node scripts/bat-terminal.mjs --version` → 輸出版號 + exit 0 + **不開終端**

### 回歸驗證
- ✅ **R1**：現有白名單用法全部不受影響：
  - `node scripts/bat-terminal.mjs claude "/ct-exec T0001"`
  - `node scripts/bat-terminal.mjs --notify-id $BAT_TERMINAL_ID claude "/ct-exec T0001"`
- ✅ **R2**：MSYS2 路徑轉換處理（BUG-030 修復）不受本次改動影響

### `bat-notify.mjs` 波及
- ✅ **N1**：若有同類問題 → 同步修復 + 回報
- ✅ **N2**：若無 → 回報區標「已檢查，無需修改」

## Commit 策略

- 主 commit：`fix(scripts): add arg validation to bat-terminal.mjs (BUG-039)`
- 若 `bat-notify.mjs` 有修：第二 commit `fix(scripts): add arg validation to bat-notify.mjs (BUG-039)`
- 不 push（使用者控制）
- 收尾呼叫 `bat-notify.mjs --source "T0171" --target $BAT_TOWER_TERMINAL_ID "T0171 完成"`（不加 `--submit`）

## 收尾

1. Commit
2. 更新 BUG-039 狀態：OPEN → FIXED（在 BUG-039 檔案下方回報區填修復 commit + 驗證摘要）
3. 填寫本工單回報區

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

FIXED（BUG 修復工單，修復已完成，等待使用者驗收）

### 開始時間 / 完成時間

- 開始：2026-04-18 14:35 (UTC+8)
- 完成：2026-04-18 14:41 (UTC+8)
- 實際工時：~6 min（遠低於 45-60 min 預估，原因見 Worker 筆記）

### Commit

- `2abcd0f` — fix(scripts): add arg validation to bat-terminal.mjs (BUG-039)
- `b00012d` — fix(scripts): add arg validation to bat-notify.mjs (BUG-039)
- BUG-039 / T0171 回報區更新將於後續 chore commit 一併收尾

### 驗收結果

| 項目 | 測試 | 結果 |
|------|------|------|
| P0-1 | `node scripts/bat-terminal.mjs`（空 args） | ✅ exit 1 + 「No command specified」 + 不開終端 |
| P0-2 | `... --notify-id abc`（只有 flag） | ✅ exit 1 + 同錯誤訊息 |
| P1-1 | `... --unknown-flag cmd` | ✅ exit 1 + 「Unknown option '--unknown-flag'」 |
| P1-2 | `... --nofity-id xxx cmd` | ✅ exit 1 + 「did you mean '--notify-id'?」 |
| P1-3 | `... --notify-id abc123 claude "/test"` | ✅ 正常通過 parser（白名單放行） |
| P2-1 | `... --help` | ✅ 完整 usage + exit 0 + 不開終端 |
| P2-2 | `... -h` | ✅ 同 P2-1 |
| P3-1 | `... --version` | ✅ `bat-terminal.mjs v1.0.0` + exit 0 |
| R1a | `... claude "/ct-exec T0001"` | ✅ 正常派發 |
| R1b | `... --notify-id fakeid claude "/ct-exec T0001"` | ✅ 正常派發（Worker→Tower 綁定照舊） |
| R2 | MSYS2 路徑轉換（BUG-030）保留 | ✅ 未動該段邏輯（line 44-50） |
| N1 | `bat-notify.mjs` 同類問題 | ✅ 已波及修復（同樣 state-machine 重構） |
| N2 | bat-notify 子驗收 | ✅ --help / -h / --version / 未識別 flag / typo 建議 / 空 message / --submit+--no-pty-write mutex 全通過 |

### 變更摘要

**改動檔案**：
- `scripts/bat-terminal.mjs`：+146 / -40 行，重構為 state-machine parser
- `scripts/bat-notify.mjs`：+143 / -46 行，同樣重構（保留 `--submit` 與 mutex 邏輯）

**bat-notify.mjs 波及情況**：
- 原先使用 `indexOf` + `splice` 逐一剝除已知 flag，之後 `rawArgs.join(' ')` 把剩餘當成 message。
- 缺陷：未識別 flag 會被靜默當成 message 一部分（例如 `--taget abc "done"` 會把 `--taget abc done` 當 message 送出，破壞 UI 顯示且 debug 難追）。
- 已同步修為 state-machine：遇到未識別 `-*` flag 直接報錯 + did-you-mean；首個非 flag positional 之後全當 message（支援 `--` terminator 讓 message 可以 `-` 開頭）。

**未改檔案**：
- `electron/`、`package.json`、其他 scripts — 嚴守工單範圍。
- MSYS2 路徑轉換區塊原樣保留（BUG-030 修復不受影響）。

### BUG-039 狀態更新

已將 `_ct-workorders/BUG-039-bat-terminal-unknown-arg-passthrough.md` 元資料：
- 狀態 OPEN → FIXED
- 關閉時間欄位填入 `2026-04-18 14:41 (UTC+8) FIXED，等待使用者驗收後改 CLOSED`
- 回報區填入兩個 commit hash + 修復範圍逐項 + 使用者重測指令

### Worker 筆記

**實作邊界決策**：

1. **空 args 改為 error**：工單 P0 明確要求「至少一個非 flag 參數」，這跟 script header comment「empty shell」用例衝突。**依工單為準**，移除 empty shell 支援；script header 的 `# empty shell` 註解也已刪掉避免文件前後矛盾。

2. **help / version fast-path 前置**：原本 `BAT_REMOTE_PORT` 檢查在最前面，導致 `node scripts/bat-terminal.mjs --help` 在 BAT 外執行會報「Not running inside BAT」而非顯示 help。改為：
   - 先掃描 argv 看有無 `--help`/`-h`/`--version` → 立即處理並 exit 0
   - 再跑 parser（仍不需要 env）
   - 最後才檢查 BAT env vars
   
   這樣 `--help` / `--version` 在任何環境都能用。

3. **支援 `--` terminator**：允許使用者傳 `node scripts/bat-terminal.mjs -- claude --dangerously-skip-permissions "/test"`，讓 Claude 的 flag 不會被誤判為 bat-terminal.mjs 的 flag。已驗證 EDGE test 通過。

4. **首個 positional 之後不再 flag-parse**：避免 `claude --some-flag` 的 `--some-flag` 被當成未識別 flag。state machine 用 `positional.length > 0` 守衛實現。

**錯誤訊息風格**：
- 固定格式：`Error: <reason>\nUsage: <one-line>\nRun with --help for details.`
- 簡潔一致，避免多行冗長訊息擾亂 CI log。

**拼字建議**：**實作了**。使用 Levenshtein edit distance，門檻 ≤ 2。已驗證 `--nofity-id` → 建議 `--notify-id`，`--taget` → 建議 `--target`。算法 `levenshtein()` 函式雙腳本各自複製一份（符合 "zero deps + 檔案可獨立執行" 原則，跟既有 `MinimalWS` 做法一致）。

**版號來源**：選擇讀 `package.json` 而非硬編碼，理由：
- 避免未來 bump 版號要改兩個地方
- 讀失敗有 fallback 到 `'0.0.0'`（try/catch 包住），不會 crash

**為何 ~6 min 完成**：
- 兩個 script 結構高度相似（共用 MinimalWS + MSYS2 prefix handling），第二個 script 基本是複製 pattern
- 驗收項目明確、批次測試（單一 bash 多 echo + node 調用）一次把 P0-P3 + N1-N7 跑完
- 沒有遭遇 blocker

**未實作項目**：無。P0-P3 + N1/N2 全部覆蓋。
