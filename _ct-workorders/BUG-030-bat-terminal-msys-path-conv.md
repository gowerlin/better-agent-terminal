# BUG-030 — bat-terminal.mjs 在 Git Bash 環境下命令字串被 MSYS2 路徑轉換污染

## 元資料
- **BUG 編號**：BUG-030
- **標題**：bat-terminal.mjs 在 Git Bash (MSYS2) 環境，slash-command 參數被誤判為 Unix 路徑
- **狀態**：⏳ FIXING
- **嚴重度**：🔴 High
- **可重現**：100%（Git Bash + 任何 `/` 開頭參數）
- **建立時間**：2026-04-17 02:13 (UTC+8)
- **修復工單派發**：2026-04-17 02:15 (UTC+8) — T0136
- **發現於**：T0135 派發過程（auto-session BAT 路由首次端到端測試）
- **關聯工單**：T0135（PAUSED，等本 BUG 修復後 resume）/ T0136（FIXING — 修復實作）
- **修復歸屬**：先修 BAT (`scripts/bat-terminal.mjs`) 治標 + workaround；視效果決定是否修 CT 上游 skill

---

## 現象描述

### 預期行為
塔台在 BAT 內使用白名單命令派發工單：
```bash
node scripts/bat-terminal.mjs --notify-id $BAT_TERMINAL_ID claude "/ct-exec T0135"
```
新 PTY 應該收到完整命令 `claude "/ct-exec T0135"`，並啟動 Claude Code 進入 ct-exec 模式。

### 實際行為
`bat-terminal.mjs` 的成功訊息顯示：
```
✓ Terminal created: claude 'C:/Program Files/Git/ct-exec T0135'
                            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                            /ct-exec 被 MSYS2 路徑轉換器誤轉
```

實際傳遞給 PTY 的命令是否同樣污染**待 Worker 端確認**（暫停前 Worker 已啟動並完成 Item 8.1 + 4.2，顯示部分執行成功 — 但顯示輸出的污染本身就是誤導性 bug，最低限度需修正 echo）。

### 影響範圍
- **環境**：Windows + Git Bash (MSYS2) — 包含 VS Code 內建終端、Cmder、Git for Windows shell
- **觸發條件**：`bat-terminal.mjs` 任何 `/` 開頭的字串參數（slash-command 場景）
- **影響功能**：
  - 塔台 auto-session BAT 路由派發
  - CT 面板 ct-exec/ct-done 按鈕（若呼叫 bat-terminal.mjs）
  - 使用者手動執行 `node scripts/bat-terminal.mjs claude "/ct-status"` 等
- **不受影響**：PowerShell、cmd.exe、macOS、Linux 環境

---

## 根因分析

MSYS2 (Git Bash) 的 POSIX-to-Windows 路徑自動轉換機制：當參數以 `/` 開頭且看起來像 Unix 絕對路徑時，會自動轉成對應 Windows 路徑（以 Git 安裝目錄為前綴）。`/ct-exec` 被誤判為 `/ct-exec` Unix 路徑 → 轉成 `C:/Program Files/Git/ct-exec`。

這個轉換發生在**參數傳遞給 node 之前**（bash → CreateProcess），因此 node `process.argv` 已經是污染後的字串。

---

## Workaround（暫時可用）

兩種方式繞過：

```bash
# 方法 1：環境變數關閉 MSYS 路徑轉換（單行）
MSYS_NO_PATHCONV=1 node scripts/bat-terminal.mjs --notify-id $BAT_TERMINAL_ID claude "/ct-exec T0135"

# 方法 2：用兩個正斜線（MSYS 慣例 — 但會傳兩個 / 給 Claude Code）
# 不建議，會破壞 slash-command 解析

# 方法 3：用 PowerShell 包裝執行
pwsh -Command "node scripts/bat-terminal.mjs --notify-id $env:BAT_TERMINAL_ID claude '/ct-exec T0135'"
```

---

## 修復方案（待 FIXING 工單實作）

### Phase B（治標 — 先做）：修 BAT `scripts/bat-terminal.mjs`

在腳本最開頭設定環境變數，然後 self-respawn 一次（或在 spawn 子程序時注入）：

```javascript
// scripts/bat-terminal.mjs 最開頭
if (process.platform === 'win32' && !process.env.MSYS_NO_PATHCONV) {
  // 偵測：argv 中有任何 'C:/Program Files/Git/' 前綴 → 表示已被污染
  // 修正：嘗試還原（將前綴剝離恢復 / 開頭）
  process.argv = process.argv.map(arg =>
    arg.replace(/^[A-Z]:[\/\\]Program Files[\/\\]Git[\/\\]/, '/')
  );
}
```

或更穩健的方式：在腳本說明文件 / `--help` 輸出加入 MSYS 警告，並偵測污染後拒絕執行 + 提示 workaround。

### Phase C（治源 — 視 Phase B 效果決定）：修 CT 上游 skill

**禁止塔台直接修** `~/.claude/skills/control-tower/`（Layer 1 唯讀保護）。
若需要修，應開**跨專案工單**派發到 BMad-Control-Tower upstream repo，更新白名單命令格式為：
```
MSYS_NO_PATHCONV=1 node scripts/bat-terminal.mjs ...
```
或加入平台偵測分支（Windows Git Bash → 自動加 prefix）。

---

## 驗收條件（修復後）

1. 在 Git Bash 中執行 `node scripts/bat-terminal.mjs --notify-id <id> claude "/ct-exec T0135"`：
   - 成功訊息顯示 `claude '/ct-exec T0135'`（無污染）
   - 新 PTY 內 Claude Code 啟動 + 進入 ct-exec 模式
2. 在 PowerShell 中執行同樣命令 → 行為一致（不應 regress）
3. 在 macOS / Linux 執行 → 行為一致（不應 regress）
4. T0135 PAUSED → 重新派發 → Worker 在新 PTY 完成全鏈路驗收

---

## 工單回報區（修復 Worker 填寫）

### 修復狀態
**FIXED**（T0136 完成於 2026-04-17 02:18 UTC+8，等待塔台驗收）

### 修復方式
採用工單 T0136 Phase B 治標方案：在 `scripts/bat-terminal.mjs` 和 `scripts/bat-notify.mjs` 解析 `process.argv` 之前主動偵測 + 還原 MSYS2 路徑污染前綴。

### 核心修復邏輯
```javascript
if (process.platform === 'win32') {
  const MSYS_GIT_PREFIX_RE = /^[A-Za-z]:[\/\\](Program Files[\/\\]Git|msys64|git)[\/\\](.*)$/
  process.argv = process.argv.map((arg) => {
    const m = arg.match(MSYS_GIT_PREFIX_RE)
    return m ? '/' + m[2].replace(/\\/g, '/') : arg
  })
}
```

- **Windows only**：非 Windows 平台整段跳過，macOS/Linux 無 regression 風險
- **僅匹配 Git Bash 污染前綴**：`X:/Program Files/Git/` / `X:/msys64/` / `X:/git/`
- **保守設計**：不匹配的參數原樣保留，其他字串路徑不受影響

### 驗收結果（Git Bash + `MSYS_NO_PATHCONV` 未設）
| Test | 輸入 | 輸出 | 結果 |
|------|------|------|------|
| 1 | `node bat-terminal.mjs echo "hello"` | `echo hello` | ✅ PASS |
| 2 | `node bat-terminal.mjs claude "/ct-status"` | `claude /ct-status` | ✅ PASS（BUG-030 原始場景完全修復） |
| 3 | `node bat-terminal.mjs --notify-id $ID claude "/ct-help"` | `claude /ct-help` | ✅ PASS |

**修復前（BUG-030 記錄）**：`claude 'C:/Program Files/Git/ct-status'` → 污染前綴
**修復後**：`claude /ct-status` → 前綴完全還原

### 產出檔案
- `scripts/bat-terminal.mjs`（+14 行 MSYS2 workaround）
- `scripts/bat-notify.mjs`（+12 行同邏輯，以防未來擴展）

### Phase C（治源）評估
- 治標已足，**不強制**動 CT upstream skill
- 塔台不得直接修 `~/.claude/skills/control-tower/`（Layer 1 唯讀保護）
- 若 T0135 全鏈路驗收發現仍有邊界 case 被污染，再考慮開跨專案工單派給 BMad-Control-Tower upstream

### 塔台建議動作
1. 標 BUG-030 → **FIXED**
2. `*resume T0135` → 在 BAT Git Bash 重新派發（不再需 `MSYS_NO_PATHCONV=1` workaround）
3. T0135 全鏈路驗收通過後，BUG-030 → **CLOSED**
