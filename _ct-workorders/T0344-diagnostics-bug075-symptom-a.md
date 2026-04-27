# T0344 — BUG-075 症狀 A diagnostics + regression guard（shell preference）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0344 |
| 類型 | diagnostics + test |
| 所屬 | BUG-075（症狀 A：shell preference 失效，T0329 未證實） |
| 狀態 | ✅ DONE |
| 開始時間 | 2026-04-27 16:28 (UTC+8) |
| 完成時間 | 2026-04-27 16:34 (UTC+8) |
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
完成狀態：DONE

新增 shell preference diagnostics：
- `terminal:create-with-command` 在 PTY create 前記錄 resolved shell basename、persisted shell setting、shell source、fallback flag/reason。
- `terminal:create-agent-command` 透過同一 handler path 走 `terminal:create-with-command`，因此 agent auto-session 也覆蓋相同 diagnostics。
- 抽出 `electron/terminal-command-handlers.ts`，讓 IPC handler 可注入 fake PTY/settings 進行 integration regression guard。

修改/新增檔案：
- `electron/main.ts`
- `electron/shell-path-resolver.ts`
- `electron/terminal-command-handlers.ts`
- `tests/shell-path-resolver.test.ts`
- `tests/terminal-create-agent-command.integration.test.ts`
- `_ct-workorders/T0344-diagnostics-bug075-symptom-a.md`

### Logging 變更
- Log line：`[remote][terminal] shell-resolution ... basename=<bash.exe|pwsh.exe|cmd.exe|pty-default> persistedShell=<setting|unset> source=<explicit|persisted|pty-default> fallback=<yes|no> reason=<reason>`
- `mirrorToBatScripts('shell-resolution', ...)` 同步寫入安全欄位，僅包含 basename，不包含完整 path。
- `opts.shell` 明確傳入時標記 `source=explicit`；settings shell 解析成功時標記 `source=persisted`；無 persisted/custom 空字串等情境標記 `source=pty-default` 與 fallback reason。

### 測試清單
- Unit 擴充：
  - actual settings shape：`{ shell: "custom", customShellPath: "" }` 回報 fallback。
  - `git-bash` 且 known executable missing 時回報 fallback 到預設 Git Bash path。
- Integration 新增：
  - Mock persisted settings `{ shell: "git-bash" }`。
  - Simulate `terminal:create-agent-command` invoke 3 次。
  - Assert 每次 forwarded/resolved create shell basename 都是 `bash.exe`。
  - Assert diagnostics log 包含 `basename=bash.exe` / `persistedShell=git-bash`，且不含完整 Git Bash path。

### 驗證紀錄
- `npx tsx tests/shell-path-resolver.test.ts` → PASS（7 passed, 0 failed）
- `npx tsx tests/terminal-create-agent-command.integration.test.ts` → PASS
- `npx tsc --noEmit --skipLibCheck --target ES2020 --module commonjs --moduleResolution node electron/shell-path-resolver.ts electron/terminal-command-handlers.ts tests/shell-path-resolver.test.ts tests/terminal-create-agent-command.integration.test.ts` → PASS
- `npm run test:unit` → PASS（11 files, 189 tests）
- `npx tsc --noEmit` → BLOCKED by pre-existing unrelated `src/components/CodexAgentPanel.tsx` / `src/types/agent-profiles.ts` type errors; no errors from touched files in narrow check.
- `rg -n "T0344|0344|BUG-075|bug075" sprint-status.yaml _bmad-output docs ...` → no matching sprint-status entry; yaml update 不適用。

### OOS but justified（如有）
無。未修改 shell resolver 行為，只增加 diagnostics wrapper 與 regression coverage。

### 遭遇問題
無本工單阻塞。注意：工作樹已有未提交的 `_ct-workorders/T0342-test-bug075-msys-rewrite-regression.md` 修改，未納入本工單。

### 互動紀錄
無。

### Renew 歷程
無。

### Commit
Implementation commit：`f98a495`（`test(control-tower): guard shell preference resolution`）

---

**完成時間**：2026-04-27 16:34 (UTC+8)

**狀態**：✅ DONE
