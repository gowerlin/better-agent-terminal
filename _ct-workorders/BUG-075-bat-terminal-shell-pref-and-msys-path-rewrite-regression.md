# BUG-075 — BAT 內部終端 default shell preference 失效 + MSYS slash-command path rewrite 雙 regression（BUG-060 / L103 同族再現）

## Metadata

| 欄位 | 內容 |
|------|------|
| BUG 編號 | BUG-075 |
| 標題 | 塔台透過 `bat-terminal.mjs` 派發 T0328 時，BAT 內部終端 (1) 沒按 default shell preference 開啟，(2) `/ct-exec T0328` 在某環境被自動 rewrite 為 `C:/Program Files/Git/ct-exec T0328`（MSYS POSIX→Win32 路徑轉換誤觸），導致 codex agent 拒絕執行 |
| 嚴重度 | 🔴 High（**塔台派發鏈完全斷裂**，YOLO 鏈式無法運作；本 session T0328 已撞，下個 PLAN 也會撞） |
| 可重現 | 100%（本 session 第一張派發即觸發；BUG-060 fix `fad2978` 後本是首次再現） |
| Workaround | 1. 使用者手動開新 BAT 終端，直接打 `/ct-exec T0328`（繞過 mjs 派發鏈）<br>2. 改用剪貼簿降級（pwsh `Set-Clipboard`），使用者貼上 |
| 狀態 | 🐛 OPEN |
| 建立時間 | 2026-04-27 13:00 (UTC+8) |
| 報告者 | Gower（塔台派發 T0328 即時觀察） |
| 影響範圍 | `scripts/bat-terminal.mjs` / BAT 終端 spawn 流程 / 塔台 auto-session 派發鏈 / YOLO 鏈式派發完全 broken |
| 相關 BUG | BUG-060 ✅ CLOSED（修復 commit `fad2978`，T0281）— 同族 shell preference 失效，**疑似回滾或新引入** |
| 相關 L | L103（2026-04-26）BAT 內部終端 yolo 派發 shell preference 第二張起 fallback bug |
| 相關 commits | T0281 fix (`fad2978`) 之後到今 (2026-04-27 13:00) 約 22h；需 git log 比對是否有 regression commit |
| Release target | 視根因確認：可能 v0.4.3 hotfix（與 PLAN-032 同 release）/ 或單獨 hotfix |

## 現象

### 觸發步驟

1. 塔台 session 派發 T0328：
   ```
   node scripts/bat-terminal.mjs --notify-id $BAT_TERMINAL_ID --workspace $BAT_WORKSPACE_ID --mode ask --interactive --agent default --prompt "/ct-exec T0328"
   ```
2. mjs script 回報 `✓ Terminal created: null`（看起來成功）
3. BAT 內部開了新終端（codex agent，看 message style）
4. 但實際 codex 收到的 prompt 變成 `C:/Program Files/Git/ct-exec T0328`（MSYS 路徑轉換誤觸 `/ct-exec`）
5. codex 回應：「`C:/Program Files/Git/ct-exec T0328` is not a valid executable on this machine」並拒絕執行
6. 同時使用者觀察到「default 終端沒照設定用 git bash」（shell preference 失效）

### 兩個獨立症狀

| 症狀 | 描述 | 候選根因 |
|------|------|---------|
| **A** | default shell preference 沒套用（應 git bash 卻不是 / 應非 git bash 卻是 git bash） | H1: BUG-060 fix `fad2978` 回滾 / 被覆蓋<br>H2: 新 commit 引入 regression<br>H3: shell preference 持久化 store 損壞（Settings JSON / electron-store） |
| **B** | `/ct-exec T0328` 被 MSYS rewrite 為 `C:/Program Files/Git/ct-exec T0328` | H4: bat-terminal.mjs 沒做 MSYS_NO_PATHCONV 防護<br>H5: codex agent 自身把 `/...` 當 path 處理（agent CLI 規範問題）<br>H6: terminal spawn 環境變數沒設 `MSYS_NO_PATHCONV=1` |

兩者**疊加**才導致 T0328 完全沒跑。**單獨 A 可能還能跑（PowerShell + codex 不會 mangle）**；**單獨 B 也可能還能跑（git bash + claude 對 `/...` 不 mangle）**。需研究確認。

### 預期行為

- BAT 內部終端開啟時嚴格遵循 default shell preference（與第一張派發行為一致，非「第二張起 fallback」也非「首張就錯」）
- `/ct-exec T0328` 透傳到 agent CLI，**不被任何中間層 path-rewrite**
- codex agent 收到 `/ct-exec T0328` 即觸發 `ct-exec` skill，跑 T0328 工單

## 後續處理

### 研究結論（T0329，2026-04-27 14:02 UTC+8）

T0329 初步確認：
- 症狀 A（shell preference 失效）未被證實。`settings.json` 仍為 `shell=git-bash`，`electron/main.ts` 的 BUG-060 fix 仍保留，`tests/shell-path-resolver.test.ts` 5/5 通過；且症狀 B 的二次 rewrite 需要新 Worker PTY 實際跑在 Git Bash 才成立。
- 症狀 B 根因高信心為 `MSYS_NO_PATHCONV` 未注入新 Worker PTY。`bat-terminal.mjs` 已修正塔台呼叫腳本時的外層 argv 污染（T0328 log 中 `parsed.promptLength=14`），但 Git Bash 中啟動 `codex --yolo '/ct-exec T0328'` 時，codex npm wrapper 再呼叫 Windows native Node，MSYS 會把 slash prompt 改成 `C:/Program Files/Git/ct-exec T0328`。
- 推薦修法：先在 `scripts/bat-terminal.mjs --prompt` 建立 Worker PTY 時注入 `customEnv.MSYS_NO_PATHCONV='1'`（精準保護 auto-session），並加 unit/integration/e2e regression test。

塔台建議流程：

1. **立即 workaround**（本 session）：使用者手動派發 T0328（開新 BAT 終端直接打 `/ct-exec T0328`）→ T0328 不阻塞
2. **派研究工單**（建議下個 session 處理 BUG-075）：
   - Phase A：git log 比對 `fad2978` 之後到今的 commits，找候選 regression
   - Phase B：實機 reproduce + isolate（症狀 A 與 B 是否同根因 / 各自獨立）
   - Phase C：candidate fix 提案 + tests（避免下次 regression 再來）
3. **塔台適配**：研究結論前，塔台暫時降級 auto-session 派發策略：
   - `[A]` 先用剪貼簿（pwsh `Set-Clipboard "/ct-exec T####"`）
   - `[B]` 顯示文字提示讓使用者手動派發
   - `[C]` 繼續用 mjs 但容忍每次都要 user 手動修

> 本 BUG 不阻擋 PLAN-032 推進（user 可手動派 T0328），但**阻擋 YOLO 鏈式派發**，PLAN-032 Sprint 2-5 若要保節奏需先修 BUG-075。

## 候選工單

- T0329（research）— BUG-075 root cause 三候選 H 群驗證 + git log diff `fad2978` ~ HEAD + reproduce isolation
- T03xx（fix）— 依研究結論派 fix 工單（範圍待定）
- T03xx（regression test）— 加 tests 避免 BUG-060 + BUG-075 同族第三次再現

## 觸發 *evolve 候選 L

L112（候選）— **「修復後 22 小時內再現」是 high-priority 信號，必加 regression tests**：BUG-060 fix `fad2978` 在 22 小時後同族 BUG-075 再現，說明只修症狀沒加 regression test。應該成為塔台 fix 工單的硬性檢查項。
