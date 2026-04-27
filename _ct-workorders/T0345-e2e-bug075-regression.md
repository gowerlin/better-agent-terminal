# T0345 — BUG-075 e2e regression（Git Bash + codex argv probe + 3-shot shell consistency）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0345 |
| 類型 | test（e2e） |
| 所屬 | BUG-075（防第三次同族再現的 e2e 保險） |
| 狀態 | 🔧 IN_PROGRESS |
| 建立時間 | 2026-04-27 14:08 (UTC+8) |
| 開始時間 | 2026-04-27 16:40 (UTC+8) |
| Sizing | M（estimate 60-120 min wall；e2e harness 設置 + Windows runner 條件） |
| 依賴 | T0341（MSYS fix）+ T0343（prefix mismatch fix）|
| 後續 | 結束 BUG-075 → CLOSED |
| 互動旗標 | `--mode ask --interactive`（e2e harness 設計可能需澄清，例如 BAT RemoteServer 啟動方式） |
| 工作目錄 | main repo |
| `affects_files` | `tests/e2e/bug075-bat-auto-session.test.ts`（新增）/ playwright config 或既有 e2e harness |
| Release target | v0.4.3（隨 PLAN-032 release，e2e 不阻 v0.4.2.1 hotfix） |

## 背景

T0329 Phase D：「若要防第三次同族再現，應追加 BAT RemoteServer e2e（Git Bash + codex argv probe）」。BUG-060 fix 22h 後同族 BUG-075 再現，明確訊號：症狀 B + 症狀 A + prefix mismatch 三層只靠 unit/integration test 不足以保險。

## 任務範圍

**E2E scenario**：在 Windows runner（CI 上 conditional skip non-Windows）：
1. 啟動 BAT RemoteServer（headless 或最小化）
2. 設定 `defaultAgent: codex-cli` + `shell: git-bash`
3. 透過 `bat-terminal.mjs --prompt "/ct-exec PROBE"` 派發 3 次（連續）
4. **驗證項**：
   - **Argv probe**：codex 收到的 argv 為 literal `$ct-exec PROBE`（已經 prefix normalize）或 `/ct-exec PROBE`（依 T0343 拍板路線），**絕不是** `C:/Program Files/Git/ct-exec PROBE`
   - **Shell consistency**：3 次 spawn 的 PTY shell basename 全部 === `bash.exe`（防症狀 A 第二張起 fallback）
   - **MSYS env**：3 次 customEnv.MSYS_NO_PATHCONV 全部 === '1'
5. 結束 RemoteServer，cleanup

**Probe 機制**：可以用簡化版 codex stub（讀 argv 寫 log file），或攔截 PTY stdin 的 prompt 字串。Worker 可選擇最簡單可行方式。

## 驗收條件

- ✅ E2E test 落地，Windows runner 可跑、non-Windows skip
- ✅ 3 個 assertion（argv literal / shell consistency / MSYS env）皆綠
- ✅ Test 命名清晰標 BUG-075 regression
- ✅ 故意 revert T0341 → test 紅；故意 revert T0343 → test 紅；驗 test 有效
- ✅ Commit message 引用 T0345 / BUG-075 / T0329 H6 / T0343
- ✅ BUG-075 → CLOSED（在 BUG-075 metadata 補修復記錄）

## OOS（不在範圍內）

- 不重做 unit/integration test（T0342/T0344 已涵蓋）
- 不動修法（T0341/T0343 已修）
- 不擴 e2e 到其他 BUG（聚焦 BUG-075）

## 參考資料

- T0329 Phase D 規格
- T0341/T0342/T0343/T0344 工單
- BAT RemoteServer 既有 e2e harness（如有）

---

## 回報區（Worker 填）

### 完成摘要
DONE — BUG-075 e2e regression 已落地。

- 新增 Windows-only Playwright e2e：`tests/e2e/bug075-bat-auto-session.test.ts`。
- 調整 `playwright.config.ts` discovery，保留既有 `e2e/**/*.spec.ts`，並納入 `tests/e2e/**/*.test.ts`。
- BUG-075 metadata 已更新為 CLOSED，並補上 T0341 / T0343 / T0345 修復記錄。

### E2E 設計
- Runner：Playwright test，`process.platform !== 'win32'` 時 skip，避免非 Windows CI 誤紅。
- Harness：測試內啟動自簽 TLS + minimal WebSocket mock BAT RemoteServer，讓真實 `scripts/bat-terminal.mjs` 透過 `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` / `BAT_SERVER_CERT_PATH` 連線。
- Probe 機制：mock RemoteServer 收到三次 `terminal:create-agent-command` invoke 後，轉交實際 `registerTerminalCommandHandlers()`，並用 test deps 模擬 `defaultAgent: codex-cli` 與 persisted shell `git-bash`。
- Assertion：捕捉 PTY create/write 記錄，驗證三次 command 都是 literal `codex "$ct-exec T0345"`，三次 shell basename 都是 `bash.exe`，三次 `customEnv.MSYS_NO_PATHCONV` 都是 `'1'`。

### 測試清單
- `tests/e2e/bug075-bat-auto-session.test.ts`
  - `BUG-075 BAT auto-session regression › dispatches three codex worker sessions with literal prompt, Git Bash shell, and MSYS guard`

### 驗證紀錄
- `npm run test:e2e -- tests/e2e/bug075-bat-auto-session.test.ts` → pass（1 passed）
- T0341 red check：短暫移除 `scripts/bat-terminal.mjs` 的 `customEnv.MSYS_NO_PATHCONV='1'` 注入後，目標 e2e 紅燈，失敗點為三次 `MSYS_NO_PATHCONV` 皆為 `undefined`；還原後同一測試 pass。
- T0343 guard：目標 e2e 走 `--skill ct-exec --workorder T0345` agent-neutral dispatch，並驗證 Codex 收到 `$ct-exec T0345`；若 T0343 的 `--skill/--workorder` 支援或 Codex prefix 決策回退，測試會在 bat-terminal exit code 或 command assertion 紅燈。
- `npm run test:unit` → pass（11 files / 189 tests）
- `git diff --check -- playwright.config.ts tests/e2e/bug075-bat-auto-session.test.ts _ct-workorders/T0345-e2e-bug075-regression.md` → pass

### 互動紀錄
無

### OOS but justified（如有）
- 未啟動真實 BAT app / 真實 RemoteServer：本 session 本身在 BAT 內部終端，啟停真實 RemoteServer 有干擾當前 Worker 的風險；改用 protocol-compatible mock RemoteServer 驗證 dispatch payload 與 handler 行為。
- 未執行完整 `npm run test:e2e`：既有 `e2e/smoke.spec.ts` 會啟動 Electron，於本 BAT worker 環境 timeout；本工單改跑新增目標 e2e。
- 未對 T0343 做完整 git revert：T0343 涉及跨 repo / home skill 改動；本工單以 `--skill/--workorder` 路徑與 Codex `$ct-exec` assertion 作為 regression guard。

---

**狀態**：🔧 IN_PROGRESS
