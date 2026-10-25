---
schema_version: 1
schema_kind: bug
id: BUG-140
title: "`--close-worker` 延遲期間，使用者只是在 BAT 切換工作區 / 終端焦點（沒有在 Worker 分頁打字），排程仍被當成「使用者輸入」取消，Worker 分頁沒有回收"
status: CLOSED
severity: medium
reproducibility: likely
created_at: "2026-10-16T02:49:49+0800"
updated_at: "2026-10-16T14:09:53+0800"
impact:
  - worker-auto-close
  - terminal-input
links:
  discovered_in: "T0550 收單後的 Worker 分頁回收（第六十六 session，0.6.1-pre.4）"
  related: [PLAN-041, T0535, T0545, T0549, T0550, D145]
---

# BUG-140 — 切換焦點被算成使用者輸入，Worker 回收被取消

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（`worker_auto_close: done` 時，使用者在延遲期間只要在 BAT 內切換就可能讓回收失敗、分頁保留；塔台只知道 exit 0，不會得知取消。繞行：再請求一次 / 手動關閉） |
| 可重現 | 推測可重現（單次觀察；根因待 Worker 確認） |
| **狀態** | 🚫 CLOSED（T0551 `92655e00`；pre.5 實機驗收 PASS，T0558，2026-10-16） |
| 回報者 | 塔台觀察 + 使用者確認（「我在 BAT 操作切換工作區或終端 focus」，未在 Worker 分頁打字） |

## 現象

- **重現（觀察到的那一次）**：T0550 Worker（claude-cli 2.1.300）回報後，塔台 02:44:46 呼叫 `--close-worker T0550 --delay-ms 10000` → exit 0，主行程 `→ scheduled delayMs=10000 (output 846 ms ago; will wait for quiet)`。延遲期間使用者在 BAT 切換工作區 / 終端焦點，**沒有**在 Worker 分頁輸入。
- **實際**：02:44:56 到期時記 `→ cancelled (user input during the delay)`，分頁保留。02:45:14 塔台再請求（使用者未操作）→ 02:45:24 `close requested`，正常關閉。
- **預期**：只有使用者真正對該分頁鍵入（D145 / T0545 的「使用者輸入」語意）才取消；焦點切換、xterm 自動產生的回應不算。
- 對照：T0549（02:15:59 請求，延遲期間使用者未操作 BAT）正常關閉。

## 推測根因（未驗證，交給修復工單確認）

- `handlers/pty.ts` 對本機視窗（`ctx.connectionId` 為空）的每一次 `pty:write` 都呼叫 `noteUserInput`（CLAUDE.md「Worker 分頁回收」節）。renderer 的 xterm 除了使用者鍵入，也會經同一路徑送出**自動回應**：程式啟用 focus reporting（DECSET 1004，claude CLI 的 TUI 會開）時，分頁取得 / 失去焦點會送 `ESC [ I` / `ESC [ O`；另有 DA / DSR（游標位置）等查詢回覆。切換工作區 / 終端焦點因此可能產生一次 `pty:write`，被當成使用者輸入。
- 也可能是切換時的其他寫入（例如重新掛載分頁時的 replay / resize 連帶寫入），需以日誌或測試確認實際寫入內容。

## 修正方向（待派工時定案）

- 只把「使用者鍵入」記為輸入：在 renderer 區分 xterm `onData` 的來源（鍵盤 / 貼上 vs. 終端自動回應），或在 main 端排除純 focus report / 終端查詢回覆序列（`ESC [ I`、`ESC [ O`、`ESC [ … R`、`ESC [ ? … c` 等）。需涵蓋本機與遠端 headless 兩條路徑（遠端以 client 連線的 `pty:write` 判定，T0536）。
- 補測試：延遲期間送 focus report / DSR 回覆不取消；真正鍵入仍取消。

## 修正（T0551，commit `92655e00`）

- **根因已證實**：xterm 的 focus report。隔離實例 e2e（`e2e/t0551-close-worker-focus.spec.ts`）中 Worker 腳本開 DECSET 1004 並記錄 stdin；延遲期間切換分頁 / 工作區，Worker 只收到 `ESC [ I` / `ESC [ O`，修正前分頁沒有關閉（重現）。DSR 等查詢回覆同樣走 `pty:write`。
- **修正**：`isTerminalAutoReply`（`electron/close-worker.ts`）排除完全由終端自動回應組成的寫入（focus、CPR、DSR、DA、DECRQM、XTWINOPS、kitty 旗標、滑鼠回報、OSC / DCS 回覆）；`registerPtyHandlers`（本機與 headless 共用）只在非自動回應時 `noteUserInput`。寫入照常送進 PTY；打字、Enter、貼上、IME、夾帶一般字元的混合寫入仍取消。
- 已知重疊：帶修飾鍵的 F3（`ESC [ 1 ; <m> R`）與游標位置回報同形，不算輸入。
- 驗證：unit 4133 passed / 243 files、兩個 typecheck = 0、vite build、`e2e/t0551-close-worker-focus.spec.ts` 與 `e2e/t0535-close-worker.spec.ts` 通過、headless e2e 8 passed。細節見 T0551 回報區。

## 驗收（pre.5 實機，T0557 / T0558，2026-10-16）

- 本機 BAT `0.6.1-pre.5`，真實 claude CLI Worker（`2.1.300`，會開 focus reporting）。
- T0558：14:08:40 `--close-worker T0558 --delay-ms 60000` → exit 0；延遲期間使用者切換分頁 / 工作區、不打字（日誌：Worker 分頁 3 次 `active=true`，其他工作區縮圖 render）；14:09:40 `→ close requested (windows=1)`、renderer `closing tab`，無 `cancelled`；registry 已無此分頁。
- T0557 同樣結果（13:53:04 → 13:54:04），但當時使用者未確認有切換焦點，以 T0558 為準。
- → **CLOSED**。
