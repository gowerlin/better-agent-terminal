# T0344 — BUG-075 症狀 A diagnostics + regression guard（shell preference）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0344 |
| 類型 | diagnostics + test |
| 所屬 | BUG-075（症狀 A：shell preference 失效，T0329 未證實） |
| 狀態 | 📋 PENDING |
| 建立時間 | 2026-04-27 14:08 (UTC+8) |
| Sizing | S（estimate 30-45 min wall） |
| 依賴 | 無（可獨立進行） |
| 後續 | 若 e2e 證實 A 仍發生 → 升級為 fix 工單 |
| 互動旗標 | `--mode ask --no-interactive` |
| 工作目錄 | main repo |
| `affects_files` | `electron/main.ts`（resolved shell basename 加 log）/ `tests/shell-path-resolver.test.ts`（擴充）/ 新增 integration test |
| Release target | v0.4.2.1 hotfix（與 T0341/T0343 同 release，低風險） |

## 背景

T0329 Phase B/C 結論：症狀 A（shell preference 失效）目前未被證實。`settings.json` 仍為 `git-bash`，resolver test 5/5 通過，BUG-060 fix `fad2978` 仍在。但使用者主觀觀察「default 終端沒照設定用 git bash」需 regression guard 預防實際 regression。

## 任務範圍

### 1. 觀察性 logging

`electron/main.ts` `terminal:create-with-command` / `terminal:create-agent-command` handler 中，PTY 建立前：
- Log `resolved shell basename`（如 `bash.exe` / `pwsh.exe` / `cmd.exe`，**不**記錄完整 path 避免敏感 env）
- Log `persistedShell` setting 值
- Log 是否走 fallback 路徑

### 2. Unit test 擴充

`tests/shell-path-resolver.test.ts`：
- 補測 actual settings shape（含 `customShellPath: ""` 空字串 case）
- 補測 `git-bash` + missing executable fallback 行為

### 3. Integration test（新增）

- Mock `readPersistedSettingsSync()` 回傳 `{shell: "git-bash"}`
- Invoke `terminal:create-agent-command` 模擬 IPC
- Assert forwarded `shell` 或 resolved create shell basename === `bash.exe`（Git Bash）
- 連續 invoke 3 次，assert 每次都 resolve 一致（防 fallback 第二張起的 regression）

## 驗收條件

- ✅ Logging 加好且不含敏感資訊
- ✅ Unit test 擴充 ≥2 case
- ✅ Integration test ≥1 case 含 3-shot consistency check
- ✅ 全 test 綠
- ✅ Commit message 引用 T0344 / BUG-075

## OOS（不在範圍內）

- 不修任何 shell resolver 邏輯（T0329 未證實有 regression）
- 不動 PTY env injection（T0341 處理）
- e2e 驗證 → T0345 一起涵蓋

## 參考資料

- T0329 Phase D「Fix-A1」段落
- L103（_learnings.md）
- BUG-060 fix commit `fad2978`

---

## 回報區（Worker 填）

### 完成摘要
（Worker 填）

### Logging 變更
（Worker 填）

### 測試清單
（Worker 填）

### 驗證紀錄
（Worker 填）

### OOS but justified（如有）
（Worker 填）

---

**狀態**：📋 PENDING
