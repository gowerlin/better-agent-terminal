# Release Notes — Better Agent Terminal（gowerlin fork）

本 fork 各版的更版重點（內容取自 GitHub Releases，最新在上）。上游 tony1223/better-agent-terminal 的 v2.1.x 紀錄保留在檔案最下方。

## v0.7.2-pre.4（2026-11-01）

版號 0.7.2-pre.4，接續 `v0.7.2-pre.3`。

## 更新

- **Worker 一次問塔台多題時，塔台只被叫醒一次**（T0715 / T0716）：`bat-notify.mjs --ask --no-pty-write` 正式列為 BAT 的支援組合，只登記題目、跳通知，不會在塔台輸入框預填文字或按 Enter。Control Tower v5.15.0 起，Worker 一批多題時前面幾題用這個方式，只有最後一題叫醒塔台，可省下重複叫醒塔台的花費。已寫進說明文件，並加了自動測試把關
- **提問通知失敗時的訊息更清楚**（T0716）：Worker 提問時，如果預填文字已寫進塔台輸入框、但 Enter 沒送出，錯誤訊息改說「預填已寫入、Enter 沒送出」，不再誤說塔台沒收到通知；另外多輸出一行 `ask: NOTIFY_STEP <notify|pty-write|keypress>` 標出失敗在哪一步。既有的輸出與結束代碼不變

## 修正

- Worker 提問時，BAT 拒收通知的情況現在會當成失敗並取消題目，不會誤報成功（T0716；一般情況下不會發生）

## 待驗收（請更新到本版後協助確認）

以下修正已包含在本版，仍在等實機確認：

- **BUG-175**（`v0.7.2-pre.3` 起，macOS，GitHub #22）：派幾個 Claude CLI Worker 或開 Claude CLI / Codex CLI 分頁，看縮圖列的縮圖是否跟著分頁內容更新，不再停在啟動畫面，也沒有 `>0q>4m` 之類的字。如果縮圖出現 `38;5;246m` 這類殘骸，請截圖回報
- **BUG-174**（`v0.7.2-pre.2` 起，GitHub #20）：在終端印出含全形字的路徑，例如 `echo 'file:///Users/demo/專案/待處理/範例_v1.0.md'`（換成你機器上存在的檔案），滑過時底線涵蓋整段、點尾端也能開檔；把視窗縮窄讓路徑換行再試一次；在 Claude CLI 分頁請 Claude 用 Markdown 連結回覆某個檔案，點連結能開檔，滑過時顯示實際路徑
- **BUG-171**（`v0.7.1-pre.8` 起）：日常使用時，遇到系統自動校時、睡眠喚醒後，不再出現「終端已恢復」提示，閒置的 Claude CLI 分頁也不會變成 `[Process exited with code 1]`
- **BUG-169**（`v0.7.1-pre.6` 起）：執行 `node "<安裝目錄>/resources/scripts/bat-terminal.mjs" --version`，應顯示本版版號而不是 `v0.0.0`
- **BUG-156**（需 Docker Desktop）：Docker 設定精靈建立容器時，不再與 BAT 本機伺服器搶用 9876 埠
- **BUG-159**（需一般權限執行 BAT + codex）：Codex CLI 分頁內執行的 helper 讀到的是自己分頁的 `BAT_*`，不是其他分頁的

## 已知事項

- 多題提問只叫醒一次需要搭配 Control Tower v5.15.0 以上；舊版 Control Tower 照舊每題叫醒一次，不受影響
- 縮圖顯示的是「最近寫出的幾列」，不一定是畫面最下面幾列；縮圖修正尚未在 macOS 實機確認
- 跨行的超連結（OSC 8）每一列都能點，但底線只畫在滑鼠所在的那一列（終端元件 xterm.js 本身的行為）
- 終端伺服器真的停止時，BAT 仍只重建 shell，分頁裡原本執行的 Claude CLI / Codex CLI 不會自動接回（PLAN-055）
- Linux 版本未實機驗證

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.7.2-pre.3...v0.7.2-pre.4

## v0.7.2-pre.3（2026-10-30）

版號 0.7.2-pre.3，接續 `v0.7.2-pre.2`。

## 修正

- **終端縮圖不更新**（BUG-175）：Claude CLI、Codex CLI 這類全螢幕介面在 macOS / Linux 上重畫畫面時不送換行，縮圖會一直停在啟動畫面，還會出現 `>0q>4m` 之類的亂碼。現在縮圖會跟著畫面最新寫出的內容更新，倒數、計時器這類只改幾個字的更新不會塞滿縮圖，清畫面後縮圖也重新開始；亂碼不再出現
  - Windows 上原本會黏成一行的兩列（例如 PowerShell 啟動訊息與提示列），現在會分成兩行，比較接近實際畫面

## 待驗收（請更新到本版後協助確認）

以下修正已包含在本版，仍在等實機確認：

- **BUG-175**（本版，macOS）：派幾個 Claude CLI Worker 或開 Claude CLI / Codex CLI 分頁，看縮圖列的縮圖是否跟著分頁內容更新，不再停在啟動畫面，也沒有 `>0q>4m` 之類的字。如果縮圖出現 `38;5;246m` 這類殘骸，請截圖回報
- **BUG-174**（`v0.7.2-pre.2` 起）：在終端印出含全形字的路徑，例如 `echo 'file:///Users/demo/專案/待處理/範例_v1.0.md'`（換成你機器上存在的檔案），滑過時底線涵蓋整段、點尾端也能開檔；把視窗縮窄讓路徑換行再試一次；在 Claude CLI 分頁請 Claude 用 Markdown 連結回覆某個檔案，點連結能開檔，滑過時顯示實際路徑
- **BUG-171**（`v0.7.1-pre.8` 起）：日常使用時，遇到系統自動校時、睡眠喚醒後，不再出現「終端已恢復」提示，閒置的 Claude CLI 分頁也不會變成 `[Process exited with code 1]`
- **BUG-169**（`v0.7.1-pre.6` 起）：執行 `node "<安裝目錄>/resources/scripts/bat-terminal.mjs" --version`，應顯示本版版號而不是 `v0.0.0`
- **BUG-156**（需 Docker Desktop）：Docker 設定精靈建立容器時，不再與 BAT 本機伺服器搶用 9876 埠
- **BUG-159**（需一般權限執行 BAT + codex）：Codex CLI 分頁內執行的 helper 讀到的是自己分頁的 `BAT_*`，不是其他分頁的

BUG-165（macOS 觸控板 Codex 分頁捲動）與 BUG-166（滑鼠回報殘留）已由測試者確認，感謝協助。

## 已知事項

- 縮圖顯示的是「最近寫出的幾列」，不一定是畫面最下面幾列（全螢幕介面最下面通常是輸入框與狀態列）
- 縮圖修正只有自動測試與 Linux / Windows 的實錄對照，尚未在 macOS 實機確認
- 跨行的超連結（OSC 8）每一列都能點，但底線只畫在滑鼠所在的那一列（終端元件 xterm.js 本身的行為）
- 終端伺服器真的停止時，BAT 仍只重建 shell，分頁裡原本執行的 Claude CLI / Codex CLI 不會自動接回（PLAN-055）
- Linux 版本未實機驗證

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.7.2-pre.2...v0.7.2-pre.3

## v0.7.2-pre.2（2026-10-30）

版號 0.7.2-pre.2，接續 `v0.7.2-pre.1`。

## 修正

- **終端裡的 `file:///` 連結**（BUG-174，GitHub #20）：
  - 路徑含中文等全形字時，底線比網址短、尾端點了沒反應；網址前面有全形字時起點也會偏。現在底線涵蓋整段網址，任一處都能點開
  - 路徑太長換到下一行時，整段仍是同一個連結（最多往上下串 20 列）
  - Claude Code 等程式輸出的超連結（OSC 8，例如 Markdown 連結 `[說明](file:///...)`）以前點了沒反應，現在可以點開 `http`、`https`、`file` 連結；其他類型（例如 `javascript:`）不會開啟。滑鼠移上去會顯示實際要開的目標，連結文字與目標不同時也看得出來

## 待驗收（請更新到本版後協助確認）

以下修正已包含在本版，仍在等實機確認：

- **BUG-174**（本版）：在終端印出含全形字的路徑，例如 `echo 'file:///Users/demo/專案/待處理/範例_v1.0.md'`（換成你機器上存在的檔案），滑過時底線涵蓋整段、點尾端也能開檔；把視窗縮窄讓路徑換行再試一次；在 Claude CLI 分頁請 Claude 用 Markdown 連結回覆某個檔案，點連結能開檔，滑過時顯示實際路徑
- **BUG-171**（`v0.7.1-pre.8` 起）：日常使用時，遇到系統自動校時、睡眠喚醒後，不再出現「終端已恢復」提示，閒置的 Claude CLI 分頁也不會變成 `[Process exited with code 1]`
- **BUG-165**（macOS 觸控板，Codex 分頁捲動，`v0.7.1-pre.6` 起）：開 Codex CLI 分頁，在 Codex 畫面內快速、慢速捲動，看是否跟手、會不會捲過頭。如果之前照建議在 `~/.codex/config.toml` 的 `[tui]` 段加了 `mouse_scroll_speed = 3`，建議先移除那一行再試
- **BUG-166**（`v0.7.1-pre.4` 起）：在 macOS 的分頁執行 `printf '\e[?1003h\e[?1006h'` 後移動滑鼠，命令列最多冒出幾筆亂碼就停；Shift + 右鍵選單有「重設滑鼠模式」
- **BUG-169**（`v0.7.1-pre.6` 起）：執行 `node "<安裝目錄>/resources/scripts/bat-terminal.mjs" --version`，應顯示本版版號而不是 `v0.0.0`
- **BUG-156**（需 Docker Desktop）：Docker 設定精靈建立容器時，不再與 BAT 本機伺服器搶用 9876 埠
- **BUG-159**（需一般權限執行 BAT + codex）：Codex CLI 分頁內執行的 helper 讀到的是自己分頁的 `BAT_*`，不是其他分頁的

## 已知事項

- 跨行的超連結（OSC 8）每一列都能點，但底線只畫在滑鼠所在的那一列（終端元件 xterm.js 本身的行為）
- 遠端視窗（WSL / SSH / Docker）裡的 `file:///` 路徑指的是遠端主機的檔案，點擊時仍以本機開啟，與之前相同
- `file:///` 連結修正只有自動測試涵蓋，尚未在 BAT 視窗實機點擊確認
- 終端伺服器真的停止時，BAT 仍只重建 shell，分頁裡原本執行的 Claude CLI / Codex CLI 不會自動接回（PLAN-055）
- Linux 版本未實機驗證

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.7.2-pre.1...v0.7.2-pre.2

---

## v0.7.2-pre.1（2026-10-30）

版號 0.7.2-pre.1，接續 `v0.7.1-pre.9`。0.7.1 線的預覽版到 pre.9 為止，之後改走 0.7.2 線。

## 新增

- **支援以 plugin 安裝的 Control Tower**：Control Tower 5.14.0 起除了 zip 手動安裝，也可以用 plugin 安裝（`ct@control-tower`）。Codex 只裝 plugin 時，skill 名稱是 `$ct:ct-exec`，原本的 `$ct-exec` 不會載入 skill，而且不會報錯。現在：
  - 塔台派工給 Codex Worker、以及指揮塔的一鍵派工，會依 Codex 實際的安裝方式送 `$ct-exec` 或 `$ct:ct-exec`：有手動安裝（含兩種都裝）用 `$ct-exec`，只有啟用中的 plugin 用 `$ct:ct-exec`，判斷不了時照舊送 `$ct-exec`。判斷依分頁的 `CODEX_HOME`；遠端視窗由遠端主機判斷
  - 指揮塔總覽 `*config` 的「預設」層，只裝 plugin 時也讀得到 Control Tower 的預設設定
  - Claude CLI 面板的 skill 清單與 `*` 指令補全，只裝 plugin 時也列出 Control Tower 的 skill（手動與 plugin 同名只列一次）
  - Claude CLI 的派工字串不變（`/ct-exec` 三種安裝都能用）
- **Control Tower 同時以 zip 與 plugin 安裝時提示**：指揮塔總覽 `*config` 區塊會說明 `/ct-exec`、`$ct-exec` 實際使用的是 zip 那份；兩份版本不同時以警示顯示。只裝一種時不顯示

## 修正

- **指揮塔一鍵派工給 Codex 時，`$ct-exec` 被 shell 吃掉**：以前一鍵派工的命令在 PowerShell 與 bash 會把 `$ct` 當成變數展開，Codex 實際收到的是 `-exec T####`。現在由 BAT 依分頁的 shell 加上正確的引號

## 更新

- helper `bat-notify.mjs --help` 補充：`--source` 要和派工時的 `--workorder` 用同一個工單編號
- 開發者：單元測試在 Node 25 以上（例如 Node 26）也能直接執行，不需另設 `NODE_OPTIONS`

## 歡迎協助測試

本版改了 Codex Worker 的派工字串。如果你用 Codex，歡迎幫忙跑一次塔台 / Worker 流程（用 zip 或 plugin 安裝 Control Tower 都可以，兩種都試更好）：

1. 開一個 Codex CLI 分頁，呼叫 MCP tool `bat_whoami`，確認 `role` 與 `agent`
2. 由塔台派一張小工單給 Codex Worker（`--agent codex`），看 Worker 分頁送出的是 `$ct-exec` 還是 `$ct:ct-exec`，以及 Worker 有沒有照工單執行
3. 確認 Worker 完成後通知回到塔台，分頁被回收

結果請到 https://github.com/gowerlin/better-agent-terminal/issues 回報，附上 BAT 版本（`v0.7.2-pre.1`）、`codex --version`，以及 Control Tower 的安裝方式（zip / plugin / 兩種都裝）。

## 待驗收（請更新到本版後協助確認）

以下修正已包含在本版，仍在等實機確認：

- **BUG-171**（`v0.7.1-pre.8` 起）：日常使用時，遇到系統自動校時、睡眠喚醒後，不再出現「終端已恢復」提示，閒置的 Claude CLI 分頁也不會變成 `[Process exited with code 1]`
- **BUG-165**（macOS 觸控板，Codex 分頁捲動，`v0.7.1-pre.6` 起）：開 Codex CLI 分頁，在 Codex 畫面內快速、慢速捲動，看是否跟手、會不會捲過頭。如果之前照建議在 `~/.codex/config.toml` 的 `[tui]` 段加了 `mouse_scroll_speed = 3`，建議先移除那一行再試
- **BUG-166**（`v0.7.1-pre.4` 起）：在 macOS 的分頁執行 `printf '\e[?1003h\e[?1006h'` 後移動滑鼠，命令列最多冒出幾筆亂碼就停；Shift + 右鍵選單有「重設滑鼠模式」
- **BUG-169**（`v0.7.1-pre.6` 起）：執行 `node "<安裝目錄>/resources/scripts/bat-terminal.mjs" --version`，應顯示本版版號而不是 `v0.0.0`
- **BUG-156**（需 Docker Desktop）：Docker 設定精靈建立容器時，不再與 BAT 本機伺服器搶用 9876 埠
- **BUG-159**（需一般權限執行 BAT + codex）：Codex CLI 分頁內執行的 helper 讀到的是自己分頁的 `BAT_*`，不是其他分頁的

## 已知事項

- Control Tower 需 5.14.1 以上才會把「BAT `>= 0.7.2-pre.1` 支援 plugin 安裝」寫進文件；在那之前 Control Tower 文件仍建議 Codex 搭配 BAT 時用 zip 手動安裝
- plugin 判斷已用隔離環境實測 Codex（codex-cli 0.164.0）四種安裝狀態；Claude 的 plugin 安裝只有自動測試涵蓋
- 遠端視窗需把遠端的 BAT 伺服器升級到本版（重跑設定精靈）才會依安裝方式判斷；舊伺服器照舊送 `$ct-exec`
- 終端伺服器真的停止時，BAT 仍只重建 shell，分頁裡原本執行的 Claude CLI / Codex CLI 不會自動接回（PLAN-055）
- Linux 版本未實機驗證

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.7.1-pre.9...v0.7.2-pre.1

---

## v0.7.1-pre.9（2026-10-29）

版號 0.7.1-pre.9，接續 `v0.7.1-pre.8`。

## 修正

- **指揮塔的檔案太大時，頁面變成空白、工單從清單消失**（BUG-172）：Control Tower 的檔案超過 512 KB 時，以前只有「總覽」會說檔案太大，「臭蟲」、「待辦」、「決策」三頁卻顯示成空清單，超過大小的工單也直接從清單消失，看起來像是沒有資料。現在：
  - 「臭蟲」、「待辦」、「決策」、Epics、Sprint 讀不到檔案時，顯示「無法讀取 <檔名>」與原因（檔案太大時附大小與 512 KB 上限）
  - 讀不到的工單仍列在清單中，歸在沒有狀態（no status）的一類，標題位置顯示讀取錯誤
  - 勾選「包含封存」時，讀不到的封存 BUG／PLAN 列在該頁的錯誤訊息中
  - 專案本來就沒有該檔案（例如沒有 `_backlog.md`）時，照舊顯示空清單，不顯示錯誤
- **優先級／嚴重度寫成 critical 時顯示為未知**（BUG-173）：指揮塔的待辦與臭蟲頁，索引或 PLAN 檔把優先級寫成 `critical`（例如 `🔴 Critical`、`priority: critical`）時，以前顯示為未知；現在與 High 相同。

## 待驗收（請更新到本版後協助確認）

以下修正已包含在本版，仍在等實機確認：

- **BUG-172**（本版）：在專案的 `_ct-workorders/` 放一份超過 512 KB 的 `_decision-log.md`（或 `_bug-tracker.md`），開指揮塔的對應頁，應顯示「無法讀取」與檔案大小，而不是空白
- **BUG-173**（本版）：待辦或臭蟲索引中優先級／嚴重度寫 `critical` 的項目，指揮塔顯示為 High
- **BUG-171**（`v0.7.1-pre.8` 起）：日常使用時，遇到系統自動校時、睡眠喚醒後，不再出現「終端已恢復」提示，閒置的 Claude CLI 分頁也不會變成 `[Process exited with code 1]`
- **BUG-165**（macOS 觸控板，Codex 分頁捲動，`v0.7.1-pre.6` 起）：開 Codex CLI 分頁，在 Codex 畫面內快速、慢速捲動，看是否跟手、會不會捲過頭。如果之前照建議在 `~/.codex/config.toml` 的 `[tui]` 段加了 `mouse_scroll_speed = 3`，建議先移除那一行再試
- **BUG-166**（`v0.7.1-pre.4` 起）：在 macOS 的分頁執行 `printf '\e[?1003h\e[?1006h'` 後移動滑鼠，命令列最多冒出幾筆亂碼就停；Shift + 右鍵選單有「重設滑鼠模式」
- **BUG-169**（`v0.7.1-pre.6` 起）：執行 `node "<安裝目錄>/resources/scripts/bat-terminal.mjs" --version`，應顯示本版版號而不是 `v0.0.0`
- **BUG-156**（需 Docker Desktop）：Docker 設定精靈建立容器時，不再與 BAT 本機伺服器搶用 9876 埠
- **BUG-159**（需一般權限執行 BAT + codex）：Codex CLI 分頁內執行的 helper 讀到的是自己分頁的 `BAT_*`，不是其他分頁的

## 已知事項

- 本版兩項修正只有自動測試涵蓋，尚未在實際的大檔案專案中確認
- 終端伺服器真的停止時，BAT 仍只重建 shell，分頁裡原本執行的 Claude CLI / Codex CLI 不會自動接回；Claude CLI 可在原專案目錄執行 `claude --resume` 接回對話（之後的版本規劃改善，PLAN-055）
- Linux 版本未實機驗證

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.7.1-pre.8...v0.7.1-pre.9

## v0.7.1-pre.8（2026-10-25）

版號 0.7.1-pre.8，接續 `v0.7.1-pre.7`。

## 修正

- **系統校時後，執行中的分頁被結束、只剩 `[Process exited with code 1]`**（BUG-171）：Windows 自動校時讓系統時鐘往前跳幾秒時，BAT 會誤以為背景的終端伺服器已經停止，跳出「終端已恢復（歷史輸出已重置）」並重建所有分頁。分頁裡的 Claude CLI、Codex CLI 等程式因此被結束，畫面只剩新的 shell 提示字元，接著顯示 `[Process exited with code 1]`。現在：
  - 系統時鐘跳動不再影響判斷；伺服器要連續多次沒回應，而且程序或連線確實已經不在，才會重建
  - 伺服器只是一時沒回應、程序與連線都還在時，不重建
  - 真的需要重建時，先結束舊的伺服器，舊伺服器晚到的訊息不再影響重建後的分頁，也不會留下沒人管的背景程序
  - 這個問題從很早的版本就存在，不是近期改版造成的
- **背景終端伺服器的設定出現在每個分頁的環境變數**：分頁裡不再看得到 `BAT_IDLE_TIMEOUT_MS`、`BAT_SCROLL_BUFFER_LINES`（這兩個只給伺服器自己用）

## 更新

- **終端伺服器的恢復提示與 BAT 重開時的「恢復終端」對話框支援多語系**：英文與簡體中文介面下改顯示對應語言（以前一律是繁體中文），繁體中文的文字不變

## 待驗收（請更新到本版後協助確認）

以下修正已包含在本版，仍在等實機確認：

- **BUG-171**（本版）：日常使用時，遇到系統自動校時、睡眠喚醒後，不再出現「終端已恢復」提示，閒置的 Claude CLI 分頁也不會變成 `[Process exited with code 1]`
- **BUG-165**（macOS 觸控板，Codex 分頁捲動，`v0.7.1-pre.6` 起）：開 Codex CLI 分頁，在 Codex 畫面內快速、慢速捲動，看是否跟手、會不會捲過頭。如果之前照建議在 `~/.codex/config.toml` 的 `[tui]` 段加了 `mouse_scroll_speed = 3`，建議先移除那一行再試
- **BUG-166**（`v0.7.1-pre.4` 起）：在 macOS 的分頁執行 `printf '\e[?1003h\e[?1006h'` 後移動滑鼠，命令列最多冒出幾筆亂碼就停；Shift + 右鍵選單有「重設滑鼠模式」
- **BUG-169**（`v0.7.1-pre.6` 起）：執行 `node "<安裝目錄>/resources/scripts/bat-terminal.mjs" --version`，應顯示本版版號而不是 `v0.0.0`
- **BUG-156**（需 Docker Desktop）：Docker 設定精靈建立容器時，不再與 BAT 本機伺服器搶用 9876 埠
- **BUG-159**（需一般權限執行 BAT + codex）：Codex CLI 分頁內執行的 helper 讀到的是自己分頁的 `BAT_*`，不是其他分頁的

## 已知事項

- 終端伺服器真的停止時，BAT 仍只重建 shell，分頁裡原本執行的 Claude CLI / Codex CLI 不會自動接回；Claude CLI 可在原專案目錄執行 `claude --resume` 接回對話（之後的版本規劃改善，PLAN-055）
- 本版修正在 Windows 上以隔離實例實測（時鐘前跳、伺服器暫停、伺服器結束）；macOS / Linux 只有自動測試涵蓋
- Linux 版本未實機驗證

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.7.1-pre.7...v0.7.1-pre.8

## v0.7.1-pre.7（2026-10-25）

版號 0.7.1-pre.7，接續 `v0.7.1-pre.6`。

### 新增

- **指揮塔「總覽」改成顯示塔台狀態與設定**：「塔台 › 指揮塔 › 總覽」以前只看 `sprint-status.yaml`，沒有這個檔的專案只會看到「未找到 sprint-status.yaml」。現在依序顯示：
  - **塔台狀態**：最後更新時間、進行中的工單；Control Tower 在塔台狀態檔寫了摘要時，另外顯示下一個工單 / 決策編號與最近的待辦（最多 5 則）
  - **Control Tower 設定**：每個設定的生效值與來源（專案 / 使用者 / 預設），可展開被覆蓋的值；不含塔台本次對話裡的臨時設定
  - **Sprint**：只在專案有 `sprint-status.yaml` 時顯示，內容和以前一樣
- **總覽自動更新**：塔台狀態檔、專案設定檔、工單檔改了，總覽會自己更新，不用重新進入專案；使用者層設定與 Control Tower 預設值在切到總覽或按 ↻ 時重新讀取

### 修正

- **工單計數把報告檔算成「pending」**：沒有狀態欄位的報告或筆記檔，以前被當成待派工單。現在另列為「no status」，不算 pending；同編號的工單與報告並存時，也不會再讓報告蓋掉工單
- **舊格式工單讀不到寫在引用區塊裡的狀態**（例如 `> 狀態:✅ DONE`）：現在讀得到
- **Control Tower 的 `PAUSED` 狀態**：工單被緊急任務中斷暫停時顯示 `⏸ Paused`，列在總覽的進行中工單；工單狀態寫成 `TODO` 時視同 `PENDING`，不再標成無效

### 更新

- **專案網站與 README**：Control Tower 已公開（MIT 授權），「Control Tower 去哪取得」改為連到 Control Tower 安裝頁；網站導覽列與 Control Tower 相關頁面連到 Control Tower 站

### 待驗收（請更新到本版後協助確認）

以下修正已包含在本版，仍在等實機確認：

- **BUG-165**（macOS 觸控板，Codex 分頁捲動，`v0.7.1-pre.6` 起）：開 Codex CLI 分頁，在 Codex 畫面內快速、慢速捲動，看是否跟手、會不會捲過頭。如果之前照建議在 `~/.codex/config.toml` 的 `[tui]` 段加了 `mouse_scroll_speed = 3`，建議先移除那一行再試
- **BUG-166**（`v0.7.1-pre.4` 起）：在 macOS 的分頁執行 `printf '\e[?1003h\e[?1006h'` 後移動滑鼠，命令列最多冒出幾筆亂碼就停；Shift + 右鍵選單有「重設滑鼠模式」
- **BUG-169**（`v0.7.1-pre.6` 起）：執行 `node "<安裝目錄>/resources/scripts/bat-terminal.mjs" --version`，應顯示本版版號而不是 `v0.0.0`
- **BUG-156**（需 Docker Desktop）：Docker 設定精靈建立容器時，不再與 BAT 本機伺服器搶用 9876 埠
- **BUG-159**（需一般權限執行 BAT + codex）：Codex CLI 分頁內執行的 helper 讀到的是自己分頁的 `BAT_*`，不是其他分頁的

### 已知事項

- 總覽的「下一個編號」與「待辦」需要 Control Tower 在塔台狀態檔寫入摘要（Control Tower v6.0.0-pre.1 預覽版起）；較舊的 Control Tower 只顯示最後更新時間、進行中工單，並提示開檔查看
- 遠端視窗（WSL / SSH / Docker）要讀遠端主機上的 Control Tower 使用者設定與預設值，需把遠端的 BAT 伺服器升級到本版（重跑設定精靈）；未升級時總覽會標示無法讀取，專案設定照常顯示
- 遠端視窗的總覽、有 `sprint-status.yaml` 的 BMAD 專案的 Sprint 區塊，以自動測試確認，尚未實機確認
- Linux 版本未實機驗證

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.7.1-pre.6...v0.7.1-pre.7

## v0.7.1-pre.6（2026-10-22）

版號 0.7.1-pre.6，接續 `v0.7.1-pre.5`。

### 修正

- **Codex 分頁內用觸控板捲動不夠順**：Codex 在全螢幕畫面會自己處理滑鼠，以前快速滑動時每個滾輪事件只會傳給 Codex 一次，多捲的距離被丟掉，所以捲動跟不上手指。現在 BAT 會依實際滑動的距離換算行數，一次傳多個（每個事件最多 8 個），捲動手感接近 Claude CLI 分頁與 iTerm2。只影響你自己開的 Codex CLI 分頁在 Codex 畫面內的捲動；一般 shell、Claude CLI 分頁不變（BUG-165）
- **安裝版的 helper 版號顯示 `v0.0.0`**：`bat-terminal`、`bat-notify` 用 `--version` 查詢，以及 BAT MCP 回報的版本，現在會顯示安裝的版號（BUG-169）
- **用量限制重置、CLI 已自動繼續後，分頁上的「將於 … 自動繼續」提示沒有消失**：Claude CLI 重置後顯示 `Usage limit reset · continuing automatically` 時，BAT 現在會認得這行，把分頁狀態改成已繼續

### 新增

- **Worker 回報後又開始工作時，分頁標籤顯示 `↻`**：塔台 Renew 工單、Worker 繼續執行時，分頁不再停在 `✓` 看起來像已完成；這段期間不會被「批次關閉已回報的 Worker」關掉，回合結束後回到 `✓`。批次關閉的確認框也會標出最近 5 秒還在輸出的分頁

### 更新

- **內嵌 Codex 升級到 0.163.0**（原 0.160.0）：給 Codex 面板使用。BAT MCP、Worker 啟動確認與狀態偵測、用量限制提示的辨識都已對新版確認；Codex CLI 分頁使用你自己安裝的 codex，不受影響

### 待驗收（請更新到本版後協助確認）

以下修正已包含在本版，仍在等實機確認：

- **BUG-165**（macOS 觸控板，Codex 分頁捲動）：開 Codex CLI 分頁，在 Codex 畫面內快速、慢速捲動，看是否跟手、會不會捲過頭。如果之前照建議在 `~/.codex/config.toml` 的 `[tui]` 段加了 `mouse_scroll_speed = 3`，本版後可能捲得太快，建議先移除那一行再試
- **BUG-166**（`v0.7.1-pre.4` 起）：在 macOS 的分頁執行 `printf '\e[?1003h\e[?1006h'` 後移動滑鼠，命令列最多冒出幾筆亂碼就停；Shift + 右鍵選單有「重設滑鼠模式」
- **BUG-169**：執行 `node "<安裝目錄>/resources/scripts/bat-terminal.mjs" --version`，應顯示本版版號而不是 `v0.0.0`
- **BUG-156**（需 Docker Desktop）：Docker 設定精靈建立容器時，不再與 BAT 本機伺服器搶用 9876 埠
- **BUG-159**（需一般權限執行 BAT + codex）：Codex CLI 分頁內執行的 helper 讀到的是自己分頁的 `BAT_*`，不是其他分頁的

### 歡迎協助測試

本版更新了內嵌 Codex，也改了 Codex 分頁的捲動。如果你用 Codex，歡迎幫忙跑一次塔台 / Worker 流程：

1. 開一個 Codex CLI 分頁，呼叫 MCP tool `bat_whoami`，確認 `role` 與 `agent`
2. 由塔台派一張小工單給 Codex Worker（`--agent codex`）
3. 確認 Worker 完成後通知回到塔台，分頁被回收

結果請到 https://github.com/gowerlin/better-agent-terminal/issues 回報，附上 BAT 版本（`v0.7.1-pre.6`）與 `codex --version`。

### 已知事項

- Codex 分頁的捲動修正只涵蓋你自己開的 Codex CLI 分頁；塔台派工建立的 Codex Worker 分頁維持原本的捲動方式
- Windows / Linux 用滑鼠滾輪在 Codex 畫面內捲動，一格捲的行數會比以前多（大約與 Claude CLI 分頁相同），尚未實機確認是否太快
- 新版內嵌 Codex 已用自動測試與不呼叫模型的方式確認，Codex 面板實際對話尚未在本版實機確認
- 遠端視窗需把遠端的 BAT 伺服器升級到本版（重跑設定精靈）
- Linux 版本未實機驗證

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.7.1-pre.5...v0.7.1-pre.6

## v0.7.1-pre.5（2026-10-21）

版號 0.7.1-pre.5，接續 `v0.7.1-pre.4`。

### 修正

- **SSH 設定精靈：啟動遠端伺服器失敗時，錯誤訊息開頭與錯誤類型不一致**：服務已註冊、但啟動後無法執行時，錯誤類型是「啟動失敗」，詳細訊息開頭卻寫 `enable-failed:`，容易誤以為是註冊服務出錯。現在開頭會跟錯誤類型一致（`start-failed:` / `enable-failed:`）

### 更新

- **內嵌 Claude CLI 升級到 2.1.306**（原 2.1.300）：模型清單、價格、effort 等級皆無變動；BAT MCP、hooks、分頁名稱與用量限制提示的辨識都已對新版確認
- **安裝檔不再附帶開發用腳本**：安裝目錄的 `resources/scripts` 現在只放 BAT 執行時用到的 6 個 helper（`bat-terminal`、`bat-notify`、`bat-mcp`、`bat-hook` 與它們共用的兩個模組），建置與測試用的腳本不再打包。打包前與打包後都會檢查這份清單，避免漏放 helper
- **發版前先跑完整自動測試**：預覽版與正式版在打包前會先跑全部單元測試與舊版測試，任何一項失敗就不打包、不發佈（BUG-168）
- **BAT MCP 權限政策**：BAT MCP 目前 8 個 tool 全部唯讀；文件明訂日後若新增會寫入的 tool，不會開放給 workflow 子 agent 使用（PLAN-054）
- **官網新增「把腦力留給判斷」頁**：說明 BAT 與 Control Tower 的設計初衷，怎麼把需要記在腦中的狀態交給工具

### 已知事項

- 安裝版的 helper 用 `--version` 查詢時會顯示 `v0.0.0`，BAT MCP 回報的版本也是 `0.0.0`。只影響顯示，功能不受影響，修正排在後續版本（BUG-169）
- 新版內嵌 Claude CLI 已用自動測試與不呼叫模型的方式確認，Agent 面板實際對話尚未在本版實機確認。Claude Code 2.1.302 起，Agent SDK 預設以 fork 方式執行 subagent，若 Agent 面板的進行中任務列顯示異常請回報
- 程式異常結束後的滑鼠追蹤自動重設（`v0.7.1-pre.4`，BUG-166）以自動測試驗證，尚未在 macOS 實機確認
- `v0.7.1-pre.3` 在 macOS 停用 Graphite 後，已有使用者實機確認長時間使用不再出現 GPU 崩潰（BUG-164）；根本修正仍需升級 Electron 42 以上，已列入後續計畫
- Codex 分頁內用觸控板快速捲動時跟不上手指，修正排在後續版本。想先改善，可以在 `~/.codex/config.toml` 的 `[tui]` 段加 `mouse_scroll_speed = 3`（BUG-165）
- 遠端視窗需把遠端的 BAT 伺服器升級到本版（重跑設定精靈）
- Linux 版本未實機驗證

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.7.1-pre.4...v0.7.1-pre.5

## v0.7.1-pre.4（2026-10-19）

版號 0.7.1-pre.4，接續 `v0.7.1-pre.3`。

### 修正

- **程式異常結束後，滑鼠一動就在命令列冒出 `35;52;69M…` 這類亂碼**：Codex 這類全螢幕程式會開啟滑鼠追蹤。如果它不是正常離開，而是被系統結束或崩潰，就沒機會把滑鼠追蹤關掉。回到 shell 後，滑鼠的移動和滾輪會被當成文字插進命令列。現在 BAT 發現滑鼠回報被 shell 原樣印出來時，會自動關閉該分頁的滑鼠追蹤。最前面幾筆亂碼仍會留在命令列，按 Ctrl+U 清掉即可。macOS、Linux 與 WSL / SSH / Docker 分頁會發生，Windows 原生分頁不會（BUG-166）
- **終端右鍵選單新增「重設滑鼠模式」與「離開替代畫面（alt screen）」**：滑鼠被程式追蹤時，用 Shift + 右鍵開選單即可手動重設。分頁停在全螢幕程式的畫面時，「離開替代畫面」可回到原本的終端畫面與捲動紀錄（BUG-166）

### 已知事項

- `v0.7.1-pre.3` 修正的 macOS 打字延遲（BUG-136），已有使用者在 macOS 實機確認解決
- 滑鼠追蹤的自動重設以自動測試驗證，尚未在 macOS 實機確認
- Codex 分頁內用觸控板快速捲動時跟不上手指，原因已查明，修正排在後續版本。想先改善，可以在 `~/.codex/config.toml` 的 `[tui]` 段加 `mouse_scroll_speed = 3`（BUG-165）
- macOS 停用 Graphite（`v0.7.1-pre.3`）後是否不再出現 GPU 崩潰，仍待實機確認；根本修正需要升級 Electron 42 以上，已列入後續計畫
- 遠端視窗需把遠端的 BAT 伺服器升級到本版（重跑設定精靈）
- Linux 版本未實機驗證

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.7.1-pre.3...v0.7.1-pre.4

## v0.7.1-pre.3（2026-10-19）

版號 0.7.1-pre.3，接續 `v0.7.1-pre.2`。

### 修正

- **macOS 上長時間使用的分頁打字越來越卡**：Codex 這類全螢幕程式在 macOS / Linux 的輸出幾乎沒有換行。縮圖列的預覽文字因此一直累積，對話越長越大，使用者量到的單一分頁預覽有 70 萬到 100 萬字以上。每次更新縮圖都要重新排版整段文字，BAT 介面持續吃滿約一顆核心，打字明顯延遲。現在縮圖預覽有長度上限（約 2 KB），一般 shell 的縮圖照舊顯示最後 8 行。Windows 原本就不會累積，不受影響（BUG-136）
- **macOS 上 GPU 程序偶爾在建立或切換分頁時崩潰**：Chromium 146（Electron 41）的 Skia Graphite 繪圖後端遇到繪圖指令順序錯亂時，會直接讓 GPU 程序崩潰，5 分鐘內崩 3 次還會退回軟體繪圖，直到重開 BAT。現在 macOS 版預設停用 Graphite，改用另一個繪圖後端。如果停用後畫面或效能變差，可以用環境變數 `BAT_SKIA_GRAPHITE=1` 啟動 BAT 恢復原狀（BUG-164）
- **GPU 程序崩潰後終端畫面空白或殘影**：GPU 程序重新啟動後，當下看得到的終端會自動重畫，不必再切換分頁或手動重繪（BUG-164）

### 更新

- **專案網站**：各頁補上搜尋與分享用的說明文字，404 頁改為中文；故事插圖改用 Control Tower 實際的工單目錄名稱，SSH 頁補充範例主機名稱的說明。<https://gowerlin.github.io/better-agent-terminal/>

### 已知事項

- 這一版的兩項 macOS 修正以自動測試驗證，尚未在 macOS 實機確認：打字延遲是否消失、停用 Graphite 後是否不再出現 GPU 崩潰
- 停用 Graphite 只在 macOS 生效。GPU 崩潰的根本修正需要升級 Electron 42 以上，已列入後續計畫
- 遠端視窗需把遠端的 BAT 伺服器升級到本版（重跑設定精靈）
- Linux 版本未實機驗證

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.7.1-pre.2...v0.7.1-pre.3

## v0.7.1-pre.2（2026-10-18）

版號 0.7.1-pre.2，接續 `v0.7.1-pre.1`。

### 修正

- **Docker 設定精靈在預設設定下建立不了容器**：精靈原本固定把容器公開在 `127.0.0.1:9876`，正好是 BAT 自己的遠端存取伺服器預設使用的埠，「建立新容器」會失敗。現在精靈會挑一個沒被占用的埠（從 9877 起，避開 BAT 自己的伺服器埠）；「沿用既有容器」改用容器實際公開的埠，不再一律連 9876。埠真的不能用時，精靈會移除這次建立的容器，按「重試」換一個埠（BUG-156）
- **重新釘選的憑證指紋被「儲存」蓋回舊值**：在「編輯連線」按「重新釘選指紋」後再按「儲存」，會把舊指紋寫回去；釘選失敗也沒有任何提示。現在釘選後對話框會顯示並保存新指紋，失敗時顯示原因（BUG-157）
- **SSH 設定的「重新釘選指紋」連到錯的對象**：SSH 設定按這個按鈕時，BAT 不經 SSH 通道、直接連本機的同號埠；若本機剛好有別的 BAT 伺服器，會把它的指紋釘進 SSH 設定，並把 SSH 設定的權杖送給它。現在 SSH 設定的這個按鈕停用，請改用重跑設定精靈更新指紋（BUG-160）
- **Worker 已經不在等你，縮圖仍顯示 ⚠️**：Claude Worker 的權限對話框（例如 Claude 自己的「危險刪除」安全檢查，即使用 `--dangerously-skip-permissions` 也會出現）被自動拒絕或沒經過鍵盤就結束後，分頁一直停在「等使用者」，直到這一輪結束。現在權限請求一結束就恢復，背景子 Agent 的權限對話框也分開計算（BUG-162）
- **手動開的 Codex 分頁可能讀到別的分頁的身分**：Codex 的多個 session 共用背景程序時，分頁裡執行的命令拿到的是背景程序的環境變數。BAT MCP 沒有注入（例如在設定中關閉）的手動 Codex 分頁，現在會加 `--no-daemon`（需要 codex 0.156.0 以上，確認不了版本就不加）；派工的 Worker 與一般情況本來就不受影響（BUG-159）
- **設定精靈的按鈕是白底原生按鈕**：WSL / SSH / Docker 精靈的選項按鈕、輸入框與進度條沒有套用 App 的樣式（進度條原本根本看不到）。現在與 App 其他畫面一致；三個精靈的步驟說明也改寫成看得懂的說法，拿掉內部用語（BUG-163）
- **遠端設定畫面與精靈的英文字樣**：配置面板、編輯連線對話框、WSL / SSH / Docker 精靈的提示、警告與錯誤訊息改為介面語言（繁中 / 簡中 / 英文）；SSH 認證失敗的訊息改成提示檢查金鑰與 ssh-agent（BAT 不能用密碼登入）；縮圖列的「建議」、縮圖右鍵的「設為監督者」也已翻譯，各對話框的 × 關閉鈕補上無障礙標籤（BUG-158、BUG-161）

### 更新

- **專案網站**：新增「遠端開發」四頁（總覽、WSL、SSH、Docker 的設定步驟與常見狀況）；功能頁與遠端頁換上真實截圖，「與 Control Tower 協作」頁加了一段派工短片；分享連結時會顯示預覽卡片。<https://gowerlin.github.io/better-agent-terminal/>
- **README**：換上目前版本的截圖
- repo 內的遠端部署指南（`docs/` 的 WSL / SSH / Docker 與總覽）更新為目前的行為

### 歡迎協助測試

如果你平常使用 **Codex CLI**，歡迎幫忙確認這一版的 Codex 修正：

1. 到「設定」關閉 BAT MCP，開一個 Codex CLI 分頁，請 Codex 執行 `node -e "console.log(process.env.BAT_TERMINAL_ID)"`，確認印出的是這個分頁自己的 ID（可與另一個 Codex 分頁比較）。以系統管理員身分執行 BAT 時看不出差異，請用一般權限
2. 如果你也在用 Control Tower：由塔台派一張小工單給 Codex Worker，確認 Worker 完成後通知回到塔台、分頁被回收

不論成功或失敗，都歡迎到 [GitHub Issues](https://github.com/gowerlin/better-agent-terminal/issues) 回報，請附上 BAT 版本、Codex 版本（`codex --version`）、作業系統與安裝方式。

### 已知事項

- 這一版的修正以自動測試驗證，以下尚未實機驗證：Docker 精靈挑埠（需要 Docker Desktop）、指紋重新釘選、⚠️ 在權限請求結束後消失、非系統管理員下的 Codex `--no-daemon`
- 「沿用既有容器」仍會自動選最近建立的容器，不能自己挑
- 遠端視窗需把遠端的 BAT 伺服器升級到本版（重跑設定精靈）
- macOS / Linux 版本未實機驗證

## v0.7.1-pre.1（2026-10-18）

版號 0.7.1-pre.1，接續 `v0.7.0-pre.9`。

### 新增

- **在 Claude Code 的跨 session 清單裡認得出 BAT 的分頁**：BAT 開的 Claude CLI 分頁啟動時會自動帶上 session 名稱，顯示在 Claude Code 的跨 session 清單（ListAgents）、`/resume` 選單與輸入框上。塔台派出的 Worker 是「工作區 · Worker · T####」，其他 Claude CLI 分頁是「工作區 · 短 ID」。你自己在啟動參數裡加了 `--name` 時，以你的為準；系統安裝的 claude 低於 2.1.76 或判斷不到版本時，不會加名稱，避免 claude 啟動失敗（PLAN-050）
- **以塔台開啟 Claude**：分頁縮圖列的「+」選單，在「Claude CLI」下方多了「以塔台開啟 Claude」。開出的分頁名稱是「工作區 · Tower」，按 ⏻ 重啟或 BAT 重開還原後都不變。這個入口只負責命名，塔台角色仍由 Control Tower 啟動時宣告（PLAN-050）
- **查得到分頁對應哪個 Claude session**：BAT MCP 的 `bat_whoami`、`bat_list_terminals`、`bat_get_state` 多了 `claudeSessionName` 與 `claudeSessionId` 兩個欄位。已宣告的塔台可以用 `bat_list_terminals` 的 `scope: towers` 列出這台 BAT 上所有工作區的塔台與它們的 session 名稱，其他分頁的內容仍然看不到（PLAN-050）
- **專案網站新增「實戰案例」頁**：<https://gowerlin.github.io/better-agent-terminal/cases>，3 個情境案例與 3 個 BAT 自己的開發紀錄（PLAN-049）

### 修正

- **塔台派出的 Worker 查不到自己是哪個 agent**：由 `bat-terminal.mjs` 派出的 Worker（Claude 與 Codex 皆是），`bat_whoami` 沒有 `agent` 欄位；派出的 Claude Worker 也少了「不讓內嵌 claude 被手動更新」的防護。現在都與從 BAT 介面開的分頁相同（BUG-155）

### 歡迎協助測試

如果你平常使用 **Codex CLI**，歡迎幫忙確認一件事：

1. 開一個 Codex CLI 分頁，呼叫 MCP tool `bat_whoami`，確認有 `agent` 欄位，值是 Codex
2. 如果你也在用 Control Tower：由塔台派一張小工單給 Codex Worker，在 Worker 分頁呼叫 `bat_whoami`，確認 `agent` 是 Codex；Worker 完成後，確認通知回到塔台、分頁被回收

不論成功或失敗，都歡迎到 [GitHub Issues](https://github.com/gowerlin/better-agent-terminal/issues) 回報，請附上 BAT 版本、Codex 版本（`codex --version`）、作業系統與安裝方式。

### 已知事項

- session 名稱只用在 Claude CLI 分頁；Codex 分頁不會出現在 Claude Code 的跨 session 清單，兩個欄位一律是空值
- 名稱在 BAT 啟動 claude 時決定：在分頁裡 `/rename`，或之後改了工作區名稱，BAT 記錄的名稱不會跟著變；同一個工作區開兩個「以塔台開啟」分頁時名稱相同
- 側欄塔台面板的「執行工單 / 補結案」按鈕開出的分頁沒有 session 名稱
- WSL / SSH / Docker 遠端視窗派出的 Worker，名稱是「BAT · Worker · T####」（遠端沒有工作區名稱）；需把遠端 server 升級到本版
- Control Tower 依這些欄位找塔台的規則尚待 CT 新版；在那之前，名稱已經會出現在跨 session 清單上
- macOS / Linux 版本未實機驗證

## v0.7.0-pre.9（2026-10-18）

版號 0.7.0-pre.9，接續 `v0.7.0-pre.8`。

### 新增

- **Codex CLI 分頁也看得出「在等你」與「已啟動」**：Codex CLI 0.163.0 以上會自己回報狀態，BAT 據此判斷 Codex 分頁是否停在核准提示或提問等你回答，Worker 縮圖顯示 ⚠️（不算進「關閉已回報的 Worker 分頁」），`bat_get_state` 回報 `blocked` / `input`（`blockedDetection: osc`）。塔台派工時帶 `--wait-started`，也能確認 Codex Worker 真的啟動了。BAT 重開時，Codex 分頁最後的狀態會從保留的輸出補回（PLAN-047）
- **專案網站上線**：<https://gowerlin.github.io/better-agent-terminal/>——用一個早上的故事說明 BAT 與 Control Tower 一起用能解決哪些卡關時刻，另有功能介紹、Control Tower 功能導覽、安裝、常見問題與回報方式（PLAN-049）

### 修正

- **Claude CLI 分頁回答 MCP 表單後，「等人回答」狀態沒有清除**：MCP 伺服器跳出的表單在你回答、取消或請求逾時後，現在會立即清除 `blocked`（`elicitation`），不再停留到該回合結束（PLAN-047）

### 更新

- BAT 派出的 Codex Worker 啟動時不再跳出更新提示，避免 Worker 卡在提示畫面（只對塔台派出的 Worker、只影響該次啟動；你的自訂參數已設定這一項時以你的為準）
- Control Tower v5.8.0 已支援 Codex 的「在等你」告知與 Worker 啟動確認；需要 BAT `0.7.0-pre.9` 以上

### 歡迎協助測試

如果你平常使用 **Codex CLI 0.163.0 以上**，歡迎幫忙跑一次：

1. 開一個 Codex CLI 分頁，呼叫 MCP tool `bat_whoami`，確認 `agent` 是 Codex；再呼叫 `bat_get_state`，看 `blockedDetection` 是否變成 `osc`
2. 讓 Codex 停在需要你核准的提示，確認縮圖顯示 ⚠️、`bat_get_state` 回報 `blocked` / `input`；核准後 ⚠️ 消失
3. 如果你也在用 Control Tower（v5.8.0）：由塔台派一張小工單給 Codex Worker（`--agent codex --wait-started 30000`），確認塔台收到 `started: <時間>`；Worker 完成後，確認通知回到塔台、分頁被回收

不論成功或失敗，都歡迎到 [GitHub Issues](https://github.com/gowerlin/better-agent-terminal/issues) 回報，請附上 BAT 版本、Codex 版本（`codex --version`）、作業系統與安裝方式（npm / 官方 installer）。

### 已知事項

- Codex 的狀態判斷需要 Codex CLI 0.163.0 以上。BAT 以自己的 PATH 判斷版本：Windows 上若 PATH 裡第一個 codex 是 npm 安裝的 `codex.cmd`，判斷不到版本，派工的啟動確認回報 `unknown`，行為與先前相同；若分頁實際執行的 codex 比 BAT 判斷的舊，啟動確認可能回報 `unconfirmed`（分頁不會被關閉）
- Codex 的「在等你」不分種類（核准、提問都顯示為 `input`）；你在 Codex 分頁打字不會清除 ⚠️，要等 Codex 自己回報狀態改變
- 未信任的 git repo 會讓 Codex 停在「Trust this folder?」畫面，啟動確認回報 `unconfirmed`；先在該目錄手動開一次 Codex 並信任即可
- 需搭配本版內附的 helper；WSL / SSH / Docker 遠端視窗需把遠端 server 升級到本版
- macOS / Linux 版本未實機驗證

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.7.0-pre.8...v0.7.0-pre.9

## v0.7.0-pre.8（2026-10-18）

版號 0.7.0-pre.8，接續 `v0.7.0-pre.7`。

### 修正

- **Worker 問完塔台後，縮圖標示沒有恢復**：Worker 用 `bat-notify.mjs --ask` 提問、塔台答覆後，Worker 其實還在工作，縮圖卻停在 `?`（訊息以「提問」結尾時），或變成 `✓` 並被算進塔台分頁右鍵「關閉已回報的 Worker 分頁（N）」（其他訊息時）。現在答覆後縮圖回到「執行中」（沒有標示、不算進批次關閉），等 Worker 下一次回報（例如完成）才顯示 `✓`；先回報過再提問的 Worker 也一樣（BUG-154）

### 更新

- Control Tower v5.7.0 已支援「Worker 問塔台」：yolo Worker 改用 `--ask` 提問、塔台以 `bat_list_questions` / `bat-terminal.mjs --answer` 答覆，BAT 不支援或問題遺失時仍回到工單裡往返。需要 BAT `0.7.0-pre.7` 以上；本版另修正上面的縮圖問題

### 歡迎協助測試

如果你平常使用 **Codex CLI**，且 Control Tower 已是 v5.7.0，歡迎幫忙跑一次「Codex Worker 問塔台」：

1. 在塔台派一張小工單給 Codex Worker（`--agent codex`），內容請它向塔台提問一次
2. 確認塔台分頁收到通知、Worker 縮圖顯示 `?`，`bat_get_state` 回報 `blocked` / `tower`
3. 塔台答覆後，確認 Worker 繼續工作、縮圖沒有標示；Worker 完成回報後縮圖顯示 `✓`、分頁被回收

不論成功或失敗，都歡迎到 [GitHub Issues](https://github.com/gowerlin/better-agent-terminal/issues) 回報，請附上 BAT 版本、Codex 版本（`codex --version`）、作業系統與安裝方式（npm / 官方 installer）。

### 已知事項

- 提問的通知要搭配本版 BAT 內附的 helper 才會正確恢復縮圖；WSL / SSH / Docker 遠端視窗需把遠端 server 升級到本版
- 舊版 Control Tower（v5.6.x 以前）以「T#### 提問」在工單裡往返時，塔台答覆後縮圖的 `?` 仍會保留到 Worker 下一次通知
- Claude hook 的 `blocked`（權限確認 / 提問）偵測仍只支援 Claude CLI 分頁
- macOS / Linux 版本未實機驗證

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.7.0-pre.7...v0.7.0-pre.8

## v0.7.0-pre.7（2026-10-18）

版號 0.7.0-pre.7，接續 `v0.7.0-pre.6`。

### 新增

- **Worker 可以直接問塔台、等塔台答覆**：塔台派出的 Worker 遇到需要決定的事，可以用 `bat-notify.mjs --ask` 把問題（可附選項）送給派它的塔台，BAT 會同時通知塔台分頁；Worker 再用 BAT MCP 的 `bat_wait_question` 等答覆（每次最多 45 秒，沒等到就再呼叫）。塔台用 `bat_list_questions` 看題目、用 `bat-terminal.mjs --answer` 回答。問題與答案只放在 BAT 執行中的記憶體，不寫入任何檔案，日誌也不記內容；BAT 重開後尚未回答的問題會回報「已遺失」，Control Tower 會改回原本「寫在工單裡往返」的做法（PLAN-048）
- **狀態查詢看得出 Worker 在等塔台**：Worker 有待答問題時，`bat_get_state` / `bat_wait` / `bat_list_terminals` 回報 `blocked`，原因為 `tower`，並多一個 `pendingQuestions`（待答題數）欄位。Codex 分頁也適用。你在 Worker 分頁打字不會取消問題
- BAT MCP 新增兩個唯讀 tool：`bat_list_questions`、`bat_wait_question`（共 8 個，全部唯讀）

### 修正

- **Worker 向塔台提問時，縮圖就顯示 ✓**：Worker 送出「T#### 提問」後，縮圖立刻顯示和「已回報」一樣的 `✓`，塔台分頁右鍵「關閉已回報的 Worker 分頁（N）」也會把它算進去，有誤關仍在工作的 Worker 的風險。現在縮圖分三種：等你處理（權限確認、Claude 提問等）顯示 ⚠️、等塔台答覆顯示 `?`、已回報才顯示 `✓`，滑鼠移上去會說明原因與時間；只有 `✓` 會算進批次關閉（BUG-153）

### 更新

- `blockedDetection: "none"` 的意思改為「這個分頁不會回報 Claude hook 的三種原因（`permission` / `question` / `elicitation`）」；等塔台答覆的 `tower` 由 BAT 自己判斷，任何分頁都可能出現

### 歡迎協助測試

如果你平常使用 **Codex CLI**，歡迎幫忙確認新的 MCP tool 在 Codex 分頁可以用：

1. 在塔台派出的 Codex Worker 分頁（或任何 Codex CLI 分頁），請它呼叫 MCP tool `bat_list_questions`（不帶參數），應回傳 `0 pending questions`
2. 請它呼叫 `bat_whoami`，確認 `agent` 為 `codex-cli`
3. 如果你的 Control Tower 已支援「Worker 問塔台」（v5.7.0 起），讓 Codex Worker 提問一次，確認塔台收到通知、`bat_get_state` 回報 `blocked` / `tower`、答覆後 Worker 繼續工作

不論成功或失敗，都歡迎到 [GitHub Issues](https://github.com/gowerlin/better-agent-terminal/issues) 回報，請附上 BAT 版本、Codex 版本（`codex --version`）、作業系統與安裝方式（npm / 官方 installer）。

### 已知事項

- Control Tower 使用「Worker 問塔台」需要 v5.7.0（準備中）；在那之前 Control Tower 照舊在工單裡往返
- 問題與答案不寫入 BAT 的檔案或日誌，但 Claude / Codex 自己的對話紀錄仍會包含它們
- 縮圖的 ⚠️ / `?` 只存在視窗記憶體：重新載入視窗或遠端重新連線後，要等該分頁下一次狀態變化才會再出現
- 舊版 Control Tower 以「T#### 提問」通知時，塔台答覆後縮圖的 `?` 會保留到 Worker 下一次通知
- Claude hook 的 `blocked`（權限確認 / 提問）偵測仍只支援 Claude CLI 分頁
- macOS / Linux 版本未實機驗證

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.7.0-pre.6...v0.7.0-pre.7

## v0.7.0-pre.6（2026-10-18）

版號 0.7.0-pre.6，接續 `v0.7.0-pre.5`。

### 新增

- **確認塔台派出的 Worker 真的啟動了**：Claude CLI 分頁啟動時，BAT 會記下「已啟動」。BAT MCP 的 `bat_get_state` / `bat_wait` / `bat_list_terminals` 多一個 `agentStarted` 欄位（`true` 已啟動 / `false` 還沒 / `null` 無法判定），`bat_wait` 也可以等到啟動為止（`until: 'agent-started'`）。塔台派工時可以加 `--wait-started <毫秒>`，helper 會等到 Worker 啟動才回傳：已啟動回 `started: <時間>`；等不到時回 exit `8`（分頁保留，不要重派）；無法判定（例如 Codex）回 `started: unknown`，不算失敗。不加這個參數時，派工行為和以前完全一樣（D154）

### 修正

- **塔台派工時，Worker 分頁搶走鍵盤焦點**：塔台派出的 Worker 分頁會切到前景並取得焦點，你正在塔台分頁打的字會跑進 Worker 分頁。現在 Worker 分頁照常出現在分頁列與縮圖，但畫面和焦點都留在你正在用的分頁；手動開的分頁、Control Tower 面板按鈕開的分頁仍會切過去（BUG-152）
- **Claude 設定關閉 hooks 時，`blocked` 偵測誤以為有在偵測**：使用者或系統管理設定以 `disableAllHooks` 關閉 hooks 時，分頁現在回報 `blockedDetection: "none"`（原本是 `hook` 但永遠不會有事件）

### 歡迎協助測試

如果你平常使用 **Codex CLI**，歡迎幫忙跑一次塔台 / Worker 流程（需要 BMad Control Tower）：

1. 新開一個 Codex CLI 分頁，請它呼叫 MCP tool `bat_whoami`（不帶參數），確認回傳的 `role` 與 `agent`（應為 `codex-cli`）
2. 在塔台分頁派一張小工單給 Codex Worker（`--agent codex`）；如果你的塔台會帶 `--wait-started`，Codex Worker 應回 `started: unknown`（Codex 目前沒有啟動信號，這是預期結果）
3. 確認 Worker 完成後通知有回到塔台分頁，Worker 分頁也有被自動回收

不論成功或失敗，都歡迎到 [GitHub Issues](https://github.com/gowerlin/better-agent-terminal/issues) 回報，請附上 BAT 版本、Codex 版本（`codex --version`）、作業系統與安裝方式（npm / 官方 installer）。

### 已知事項

- 啟動確認只支援 Claude CLI 分頁；Codex、自訂 CLI 一律為無法判定
- Claude 的 hooks 若是在專案層設定（`.claude/settings.json`）或公司政策中關閉，BAT 偵測不到：`--wait-started` 會等到期限後回 exit `8`
- 以 server token 呼叫 helper（例如遠端 profile、測試程式）派出的分頁仍會取得焦點
- Worker 分頁在你第一次切過去之前，終端尺寸維持 120x30
- Control Tower 尚未使用 `--wait-started`（需 CT 後續版本）
- macOS / Linux 版本未實機驗證

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.7.0-pre.5...v0.7.0-pre.6

## v0.7.0-pre.5（2026-10-18）

版號 0.7.0-pre.5，接續 `v0.7.0-pre.4`。

### 修正

- **塔台派工時正在打字，Worker 會起不來**：塔台派出的 Worker 分頁會取得鍵盤焦點，而 BAT 要等分頁的 shell 準備好才送出啟動指令。這段時間打進來的字會接在指令前面，Worker 啟動失敗（例如 `bash: ,: command not found`），塔台卻收到派工成功。現在這段時間的輸入會在啟動指令之後才送出，不會丟失（BUG-151）
- **Claude 用 AskUserQuestion 提問時，`blocked` 的原因誤報為權限確認**：Claude 對提問也會送出權限請求，BAT 因此把原因從 `question` 改成 `permission`；用滑鼠回答後，`blocked` 也要等到該回合結束才清除。現在提問一律回報 `question`，用滑鼠或鍵盤回答後都會立即清除（BUG-150）

### 已知事項

- 塔台派出的 Worker 分頁仍會搶走鍵盤焦點；派工後接著打的字會進到 Worker 分頁（不再破壞啟動指令）
- 塔台派工時，helper 回傳成功只代表分頁已建立，不代表 Worker 已經啟動；請以 `bat_get_state` 確認 Worker 有沒有開始工作
- `blocked` 偵測目前只支援 Claude CLI 分頁；Codex 分頁回 `blockedDetection: "none"`（後續版本）。在權限確認上用**滑鼠**按允許 / 拒絕時，`blocked` 會維持到該回合結束或你下一次鍵盤輸入
- Control Tower v5.4.0 起支援 Worker 分頁關閉後查 worktree 狀態（`source`）；斷點 D（使用 `blocked`）在 Control Tower 後續版本
- 用量限制自動繼續（0.6.1-pre.6 新增）尚未在真實撞到限制時驗證，遇到時請留意 BAT 日誌中的 `[usage-limit]` 紀錄
- macOS / Linux 版本未實機驗證

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.7.0-pre.4...v0.7.0-pre.5

## v0.7.0-pre.4（2026-10-18）

版號 0.7.0-pre.4，接續 `v0.7.0-pre.3`。

### 新增

- **偵測 Claude 分頁卡在等人回答**：Claude CLI 分頁停在權限確認、AskUserQuestion 提問或 MCP 表單（elicitation）時，BAT MCP 的 `bat_get_state` / `bat_list_terminals` / `bat_wait` 會回 `blocked`，並附原因（`permission` / `question` / `elicitation`）。塔台可以藉此知道 Worker 是在等人，而不是還在工作。BAT 以 Claude 的 hooks 回報，hook 不影響 Claude 的任何判斷、不送出工具參數或對話內容；與「BAT MCP」用同一個 Settings 開關（預設開）。每個分頁另回 `blockedDetection`（`hook` / `none`），表示這個分頁有沒有在偵測（PLAN-047）
- **Worker 分頁關掉之後仍可查 worktree 狀態**：以 `--worktree keep` 回收 Worker 分頁、甚至 `--worktree remove` 刪掉 worktree 之後，`--worktree-status T####` / `bat_worktree_status` 仍會回答（`source` 為 `exited` 或 `git`），塔台合併時不必再自己用 git 重算（PLAN-047）

### 修正

- **全新安裝的 Windows 上，塔台派出的 Claude / Codex Worker 起不來**：從未在 Settings 存過任何設定時，BAT 派工以 bash 的方式替參數加引號，但分頁實際是 PowerShell，命令被拆壞，Worker 啟動即失敗。現在依分頁實際啟動的 shell 加引號（BUG-149）

### 更新

- 新增 Codex CLI 擔任塔台 / Worker 的自動化整合測試（用真的 Codex 連 BAT，不呼叫模型）；BUG-149 就是這組測試找到的

### 歡迎協助測試

如果你平常使用 **Codex CLI**，歡迎幫忙跑一次塔台 / Worker 流程（需要 BMad Control Tower）：

1. 新開一個 Codex CLI 分頁，請它呼叫 MCP tool `bat_whoami`（不帶參數），確認回傳的 `role` 與 `agent`（應為 `codex-cli`）
2. 在塔台分頁派一張小工單給 Codex Worker（`--agent codex`）
3. 確認 Worker 完成後通知有回到塔台分頁，Worker 分頁也有被自動回收

不論成功或失敗，都歡迎到 [GitHub Issues](https://github.com/gowerlin/better-agent-terminal/issues) 回報，請附上 BAT 版本、Codex 版本（`codex --version`）、作業系統與安裝方式（npm / 官方 installer）。如果你在 `~/.codex/config.toml` 改過 `shell_environment_policy`，也請一併註明（可能讓 Codex 執行的指令拿不到 BAT 的連線資訊）。

### 已知事項

- `blocked` 偵測目前只支援 Claude CLI 分頁；Codex 分頁回 `blockedDetection: "none"`（後續版本）。以 `--dangerously-skip-permissions` 執行時不會出現權限確認；在權限確認上用**滑鼠**按允許 / 拒絕時，`blocked` 會維持到該回合結束或你下一次鍵盤輸入
- `blocked` 的權限確認、AskUserQuestion、MCP 表單三種情況尚未在真實 Claude 互動中觸發驗證，遇到時歡迎回報
- Claude 設定了 `disableAllHooks` 時 BAT 的 hooks 也會停用，`blocked` 不會出現
- Control Tower 尚未使用 `blocked`（需 CT 後續版本）；本版其他功能沿用 Control Tower v5.3.x
- 用量限制自動繼續（0.6.1-pre.6 新增）尚未在真實撞到限制時驗證，遇到時請留意 BAT 日誌中的 `[usage-limit]` 紀錄
- macOS / Linux 版本未實機驗證

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.7.0-pre.3...v0.7.0-pre.4

## v0.7.0-pre.3（2026-10-18）

版號 0.7.0-pre.3，接續 `v0.7.0-pre.2`。

### 修正

- **Codex 分頁的 BAT MCP 無法連線**：0.7.0-pre.2 的 Codex CLI 分頁呼叫 `mcp__bat__*` 一律回 `CONNECT_FAILED: not running inside a BAT terminal`。原因是 Codex 啟動 MCP 程式時只傳少數系統環境變數，分頁的連線資訊沒有傳下去。現在 BAT 會告訴 Codex 要轉送哪些變數（只給變數名稱，權杖不會出現在命令列或設定裡）。需要新開的 Codex 分頁才會套用（BUG-148）

### 更新

- README「與 BMad Control Tower 協作」的版本對照表補上「唯讀查詢（MCP）」：BAT `>= 0.7.0-pre.2`，不需要特定 CT 版本

### 已知事項

- Control Tower v5.3.0 已在 0.7.0-pre.2 上完成實機驗收（worktree 隔離派工、合併工單），本版沿用
- Codex 分頁的 BAT MCP 修正已用 Codex 0.160.0 / 0.163.0 驗證轉送機制，實際分頁連線待本版安裝後驗證；以 npm 安裝的 `codex.cmd`、遠端（WSL / SSH / Docker）的 Codex 分頁未實測
- Claude / Codex 面板（非終端分頁）不掛 BAT MCP；BAT MCP 開關只影響之後啟動的分頁
- 「偵測 Worker 停下來等回答」尚未提供（後續版本）
- 用量限制自動繼續（0.6.1-pre.6 新增）尚未在真實撞到限制時驗證，遇到時請留意 BAT 日誌中的 `[usage-limit]` 紀錄
- macOS / Linux 版本未實機驗證

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.7.0-pre.2...v0.7.0-pre.3

## v0.7.0-pre.2（2026-10-17）

版號 0.7.0-pre.2，接續 `v0.7.0-pre.1`。

### 新增

- **分頁內的 agent 可以直接查詢 BAT（BAT MCP）**：BAT 啟動的 Claude CLI / Codex 分頁會自動掛上一組唯讀 MCP 工具（`mcp__bat__*`），可以查自己是誰、列出分頁、查分頁狀態（執行中 / 閒置 / 已結束）、讀取分頁輸出、等待分頁狀態改變、查 worktree 狀態。範圍依分頁權杖限制：塔台只能看自己與自己派出的 Worker，Worker 只能看自己。讀出的輸出會先遮蔽權杖、API key、私鑰等字串。設定檔不含任何權杖，也不會覆蓋你自己的 MCP 設定。可在 Settings → Advanced「BAT MCP」關閉（預設開啟）（PLAN-047）
- **Worker 可以在獨立的 git worktree 執行**：派工加 `--isolation worktree`，BAT 會在 repo 外建立 `.bat-worktrees/<repo>/<工單號>` 與分支 `ct/<工單號>`，Worker 在裡面工作，主 checkout 不受影響；回收 Worker 時可選擇保留、移除或封存 worktree（`--close-worker … --worktree keep|remove|archive`，預設保留）。依賴套件由 Worker 自行安裝。預設不隔離，不加參數時行為與先前相同（PLAN-047）
- **查詢 Worker 分支的合併狀態**：`bat-terminal.mjs --worktree-status T####` 回報分支相對 main 的領先 / 落後、未提交的檔案、實際改動、超出工單範圍的檔案、預測的合併衝突，只讀不改（PLAN-047）

### 已知事項

- Control Tower 要使用 worktree 隔離派工與合併工單，需等對應的 CT 版本（CT-T015 / CT-T016 進行中）；目前的 CT v5.2.4 不受影響
- Codex 分頁的 BAT MCP 只驗證到設定解析，尚未實際連線驗證；以 npm 安裝的 `codex.cmd` 在 PowerShell 下的參數引號未實測
- Claude / Codex 面板（非終端分頁）不掛 BAT MCP；BAT MCP 開關只影響之後啟動的分頁
- 「偵測 Worker 停下來等回答」尚未提供（後續版本）
- 用量限制自動繼續（0.6.1-pre.6 新增）尚未在真實撞到限制時驗證，遇到時請留意 BAT 日誌中的 `[usage-limit]` 紀錄
- macOS / Linux 版本未實機驗證

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.7.0-pre.1...v0.7.0-pre.2

## v0.7.0-pre.1（2026-10-17）

版號 0.7.0-pre.1，接續 `v0.6.1-pre.9`。這版更動了終端分頁裡 helper 腳本的權限，所以升到 0.7.0。

### 更新

- **每個終端分頁改用自己專屬的權杖**：本機分頁裡的 `BAT_REMOTE_TOKEN` 不再是可以操作整個 BAT 的全權 token，而是只屬於該分頁的 `batcap.` 權杖（遠端 WSL / SSH / Docker 分頁早已如此）。分頁裡的程式能透過 BAT 做的事，依分頁角色限制（PLAN-047）：
  - 一般分頁與塔台分頁：可以派工（agent 模式與 raw command 模式）、回收自己派出的 Worker 分頁、設定自己的塔台角色
  - 塔台派出的 Worker 分頁：只能通知 / 預填 / 送出給派出它的那個塔台
  - 其他操作（讀寫檔案、改設定、寫入別的分頁等）一律拒絕
- **權杖在 BAT 重開後仍有效**：退出 BAT 時選「不停止 Terminal Server」、重開後選「保留」，存活分頁裡的塔台與 Worker 照常可以派工、回報、回收（權杖紀錄只存雜湊，不存權杖本身）
- **遠端 Tower 也能用 raw command 派工**（`bat-terminal.mjs claude "/ct-exec T####"`），規則與本機相同；建議仍以 agent 模式（`--skill` / `--workorder`）為主

### 修正

- **BAT 重開時，回答 Recovery 提示之前不再多開一個 shell**：之前還原的分頁會在背景另起一個本機 shell，選「保留」後它仍在執行，輸出也混進同一個分頁。現在分頁會等你回答後才接回或建立；在提示開著時派工，BAT 最多等 2 秒，仍未回答就回報失敗（`RECOVERY_PENDING`），不會建立分頁（BUG-146）
- **Recovery 選「重新開始」後，新的 Terminal Server 不會再被當成不存在**：之前舊 server 結束時會刪掉新 server 剛寫好的紀錄檔，下次啟動又另開一個（BUG-147）

### 已知事項

- **行為改變**：Worker 分頁裡不能再派工、回收或設定塔台角色；也不能在一般分頁手動用 `bat-notify --target` 通知任意分頁。Control Tower 的正常流程不受影響，請在一般分頁（不是 Worker 分頁）啟動塔台
- 升級當下仍開著的舊分頁沿用舊的權杖，重開分頁後才會換成新的
- Control Tower 建議搭配 v5.2.4（文件與失敗提示對齊本版；舊版 CT 仍可正常使用）
- 遠端 raw command 用的是遠端使用者 `PATH` 上的 `claude`，不是 BAT 內建的版本
- 還沒切換過去的背景分頁，裡面的程式在第一次顯示前仍以 120 欄排版；Terminal Server 意外結束後重建的分頁要等下一次調整視窗大小或重繪才會同步寬度
- 用量限制自動繼續（0.6.1-pre.6 新增）尚未在真實撞到限制時驗證，遇到時請留意 BAT 日誌中的 `[usage-limit]` 紀錄
- macOS / Linux 版本未實機驗證

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.6.1-pre.9...v0.7.0-pre.1

## v0.6.1-pre.9（2026-10-17）

版號 0.6.1-pre.9，接續 `v0.6.1-pre.8`。

### 修正

- **claude CLI 分頁的 Shift + 右鍵「複製」**：pre.8 的修正在真實的 claude CLI 裡沒有作用，這版補上。以下兩種情況，原本 Shift + 右鍵選單只有「貼上」：
  - 從別的視窗或分頁切回來的那一下就用 Shift + 拖曳選取
  - 同一段文字選了第二次

  現在 Shift + 拖曳選取 → Shift + 右鍵，選單都會出現「複製」，複製到的就是反白的文字。claude CLI 自己的選取是藍底反白（不按 Shift 直接拖曳時出現，放開滑鼠時 claude 已經複製到剪貼簿）；BAT 的選取是另一種顏色（BUG-144）
- BAT 日誌會在每次開啟終端右鍵選單時記一行 `[terminal-context-menu]`，方便回報問題時判讀

### 已知事項

- 終端分頁裡的程式追蹤滑鼠時，Alt + Shift 拖曳的欄選取仍會在滑鼠移動時被清掉
- 還沒切換過去的背景分頁，裡面的程式在第一次顯示前仍以 120 欄排版（顯示後會自動調整）；Terminal Server 意外結束後重建的分頁也要等下一次調整視窗大小或重繪才會同步寬度
- macOS 上 Shift + 右鍵時，程式仍會收到右鍵（xterm 在 macOS 以 Option 繞過滑鼠追蹤）
- 用量限制自動繼續（pre.6 新增）尚未在真實撞到限制時驗證，遇到時請留意 BAT 日誌中的 `[usage-limit]` 紀錄
- macOS / Linux 版本未實機驗證

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.6.1-pre.8...v0.6.1-pre.9

## v0.6.1-pre.8（2026-10-16）

版號 0.6.1-pre.8，接續 `v0.6.1-pre.7`。

### 修正

- **Shift + 右鍵可以複製選取的文字**：在 claude CLI 等會追蹤滑鼠的程式分頁裡，按住 Shift 拖曳選取後再按 Shift + 右鍵，選單現在會出現「複製」，複製到的就是反白的文字。之前滑鼠一移動，選取就被清掉，選單只剩「貼上」。不按 Shift 直接拖曳時，反白是 claude CLI 自己的選取，放開滑鼠時 claude 已經複製到剪貼簿（BUG-144）
- **新分頁與重啟的分頁畫面寬度正確**：新開、還原或按 ⏻ 重啟的分頁，分頁裡的程式有時會以 120 欄排版，比實際視窗窄，要按重繪才恢復（重啟的分頁每次都會發生）。現在分頁一建立就會同步實際寬度（BUG-145）

### 更新

- repo 的 `CHANGELOG.md` / `release-note.md` 補齊 v0.4.3 起的各版內容
- 伺服器套件說明文件更正 GitHub 下載限流時的行為（遇到限流直接失敗、不重試，可改用「匯入本機 tarball…」）

### 已知事項

- 終端分頁裡的程式追蹤滑鼠時，Alt + Shift 拖曳的欄選取仍會在滑鼠移動時被清掉
- 還沒切換過去的背景分頁，裡面的程式在第一次顯示前仍以 120 欄排版（顯示後會自動調整）；Terminal Server 意外結束後重建的分頁也要等下一次調整視窗大小或重繪才會同步寬度
- macOS 上 Shift + 右鍵時，程式仍會收到右鍵（xterm 在 macOS 以 Option 繞過滑鼠追蹤）
- 用量限制自動繼續（pre.6 新增）尚未在真實撞到限制時驗證，遇到時請留意 BAT 日誌中的 `[usage-limit]` 紀錄
- macOS / Linux 版本未實機驗證

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.6.1-pre.7...v0.6.1-pre.8

---

## v0.6.1-pre.7（2026-10-16）

版號 0.6.1-pre.7，接續 `v0.6.1-pre.6`。

### 修正

- **終端右鍵不再「貼上又跳選單」**：claude CLI 等會自己處理滑鼠的程式（例如 claude CLI 右鍵直接貼上），在分頁裡按右鍵時，BAT 不再同時跳出「複製 / 貼上」選單。一般 shell 分頁照舊顯示選單。需要 BAT 選單時按 **Shift + 右鍵**（例如在 claude CLI 分頁以 Shift + 拖曳選取後複製）（BUG-142）
- **終端右鍵選單可用 Esc 關閉**：選單開著、終端仍有焦點時，按 Esc 會關閉選單，這次的 Esc 不會送進分頁裡的程式（不會中斷 claude CLI）。選單沒開時 Esc 照常送出（BUG-143）

### 已知事項

- macOS 上 Shift + 右鍵時，程式仍會收到右鍵（xterm 在 macOS 以 Option 繞過滑鼠追蹤）；claude CLI 在 macOS 不以右鍵貼上，所以不會重複動作
- 用量限制自動繼續（pre.6 新增）尚未在真實撞到限制時驗證，遇到時請留意 BAT 日誌中的 `[usage-limit]` 紀錄
- macOS / Linux 版本未實機驗證

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.6.1-pre.6...v0.6.1-pre.7

---

## v0.6.1-pre.6（2026-10-16）

版號 0.6.1-pre.6，接續 `v0.6.1-pre.5`。

### 新增

- **塔台分頁標題**：分頁內執行 `bat-terminal.mjs --set-role tower` 後，該分頁標題會改為 `<Agent 顯示名> · Tower`（例 `Claude CLI · Tower`），與 Worker 分頁（`Claude CLI · Worker · T####`）一致。自己改過名的分頁會保留原名。本機與遠端（WSL / SSH）都適用。搭配 Control Tower v5.2.0 以上，`/control-tower` 啟動時會自動設定（PLAN-045）
- **塔台模式宣告**：`--set-role tower --mode yolo|ask|off|on`，讓 BAT 知道塔台分頁目前的 auto-session 模式（PLAN-044 使用）
- **用量限制自動繼續**（Settings → Advanced，預設關閉）：yolo 分頁（`--mode yolo` 派出的 Worker，以及宣告為 yolo 的塔台）撞到 5 小時用量限制時：
  - **Codex**：在解鎖時間再加上設定的延遲（預設 2 分鐘）後，確認畫面仍停在限制訊息，就自動輸入設定的文字（預設「繼續」）並按 Enter
  - **Claude**：Claude Code CLI 2.1.234 起會自己在解鎖後繼續，BAT 不另外輸入，只在縮圖上標示；電腦休眠跨過解鎖時間、CLI 停在「Press enter to continue」時，BAT 只補一個 Enter
  - 週限制、非時間型限制（額度、預算）只標示，不自動輸入；等待期間在該分頁打字會取消；同一分頁連續自動送出最多 2 次
  - 縮圖顯示 ⏳ 與預計時間，或「限制」標示（PLAN-044）

### 更新

- **Dialog 不再因點擊外部而關閉**：設定、配置、工作區設定、各種確認框、About、Snippet、設定精靈、Claude / Codex 面板的視窗等，只能用 [×]、[取消] / [確認] 或 Esc 關閉，避免誤觸遮罩讓輸入到一半的內容消失。右鍵選單、下拉選單與小型 popover 照舊點外面就關（PLAN-046）
- **Dialog 統一支援 Esc**：Esc 等同 [×] 或取消，只關最上層的 Dialog；確認框按 Esc 是取消。輸入法組字中、或 Dialog 內的選單開著時，Esc 只處理該操作。只有一個「OK」按鈕的通知視窗補上 [×]（PLAN-046）
- **設定精靈開著時 Esc 不作用**：以前按 Esc 會連同配置面板一起關掉，精靈也被取消並還原已安裝的 server；現在只能用精靈自己的 [×] / 取消
- 修正：在配置面板上點刪除確認、遠端 profile 編輯或設定精靈的遮罩時，會連外層配置面板一起關掉

### 已知事項

- 塔台分頁標題需要 Control Tower v5.2.0 以上才會在 `/control-tower` 啟動時自動設定；舊版 Control Tower 不受影響
- Dialog 開著時，Esc 不會再傳到後面的 Claude / Codex 面板（例如中斷串流），需先關閉 Dialog
- 用量限制的訊息格式取自 Claude Code 2.1.300 / Codex 0.160–0.162 的程式字串，尚未在真實撞到限制時驗證；Codex 的自動輸入尚未在真實 Codex 上驗證。遇到時請留意 BAT 日誌中的 `[usage-limit]` 紀錄
- 兩台 BAT 互相作為遠端時，用量限制不會自動輸入（headless bat-server 正常）
- BAT 重開但 Terminal Server 仍在執行時，分頁的 yolo 記錄會遺失，需重新啟動塔台或重新派工
- macOS / Linux 版本未實機驗證

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.6.1-pre.5...v0.6.1-pre.6

---

## v0.6.1-pre.5（2026-10-16）

版號 0.6.1-pre.5，接續 `v0.6.1-pre.4`。

### 新增

- **Worker 分頁標題看得出是哪張單**：塔台派出的 Worker 分頁標題改為「Agent · Worker · 工單號」，例如 `Claude CLI · Worker · T0553`；Worker 回報後小標籤顯示 ✓。其他由外部建立的分頁改顯示 agent 名稱或命令名稱，不再是 `Remote: <完整路徑>`；真正由遠端 server 建立的分頁另有「遠端」小標籤。你改過名字的分頁不受影響，舊分頁重開 BAT 後也會套用新格式
- **遠端工具可以一鍵安裝 Node.js（透過 nvm）**：遠端（WSL / SSH）工具清單中的 Node.js 改為可安裝，使用 nvm（裝在 `~/.nvm`，不需 sudo）安裝最新 LTS，並可用「更新」升到新的 LTS。卡片會顯示 nvm 版本。安裝時除了 nvm 原本會改的 `~/.bashrc`，也會在 bash 登入設定檔（`~/.bash_profile`、`~/.bash_login` 或 `~/.profile`，取第一個存在的）加一段有標記的載入設定，讓 agent 以非互動方式執行的指令也找得到 node。已有系統 node 時保留不動。Alpine（musl）沒有官方 binary，維持安裝說明連結

### 修正

- **重跑 WSL 設定精靈升級 server 時會換 port，原本的連線設定失效**（BUG-138）：現在會沿用原本的 port，並更新既有的連線設定，不再另建一個。SSH 精靈也不再重複建立連線設定
- **覆蓋安裝時沒有清掉舊版檔案**（BUG-139）：WSL / SSH 安裝改為先解到暫存目錄再整批換入，舊版移除的套件不再殘留（實測 WSL 安裝目錄 708 → 390 MiB）
- **升級到一半取消，原本能用的 server 也一起被刪掉**（BUG-141）：升級後若後面的步驟失敗並取消，現在會換回升級前的版本與服務設定，並重新啟動原本的 server；第一次安裝取消仍會整個移除
- **塔台回收 Worker 分頁時，只是切換工作區或分頁焦點就讓回收被取消**（BUG-140）：終端機自動送出的訊號（焦點通知、游標位置回報等）不再被當成你在打字；在該分頁真正打字或貼上仍會取消回收

### 已知事項

- SSH 精靈的升級與取消還原只有自動化測試，尚未在真的 SSH 主機上實測
- 透過 nvm 安裝的 Node.js：zsh 非互動登入（`zsh -lc`）仍看不到；已有 `~/.bash_profile` 的環境，`sh -lc` 看不到（`bash -lc` 可以）
- Worker 分頁自動回收需搭配 Control Tower v5.1.0 並開啟 `worker_auto_close`
- 安裝檔不含遠端 server bundle（自 pre.4 起）：第一次設定 WSL / SSH 遠端需要連上 GitHub，或使用「匯入本機 tarball」
- 包含 pre.2 的 GPU 狀態日誌（BUG-136 仍在診斷）

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.6.1-pre.4...v0.6.1-pre.5

---

## v0.6.1-pre.4（2026-10-16）

版號 0.6.1-pre.4，接續 `v0.6.1-pre.3`。

### 新增

- **安裝檔大幅縮小**
  - 安裝檔不再內建遠端 server bundle。第一次設定 WSL / SSH 遠端時，BAT 會從 GitHub Release（`server-bundle-v<版號>`）下載，下載後留在快取，之後離線也能用
  - 移除重複或用不到的內容：Windows 重複的一份 Claude 執行檔、Agent SDK 內建但不會執行的 Claude 執行檔、介面已打包好的套件、其他平台的語音辨識檔案，以及 Linux 多帶的一份 arm64 server bundle
  - 遠端 server bundle 本身也變小（linux-x64 約 229 → 159 MiB）
  - AppImage 與 dmg 改用較高壓縮；Windows 維持一般壓縮（實測更高壓縮對 Windows 安裝檔沒有效果）
- **設定遠端時可以匯入本機的 server bundle**：下載失敗（離線、內網）時，WSL / SSH 設定精靈會出現「匯入本機 tarball」，選 `bat-server-<平台>-v<版號>.tar.gz`（同目錄要有 `.sha256`），驗證通過後繼續安裝。也可以設定 `BAT_SERVER_BUNDLE_BASE_URL` 指向內部鏡像

### 修正

- **塔台回收 Worker 分頁時，Worker 剛回報完常被判定「仍在輸出」而不回收**（PLAN-041 實機驗收發現）：現在 Worker 還在輸出時也會照常排程，等分頁安靜 5 秒後再關，最多再等 60 秒；延遲期間你在該分頁打字仍會取消回收
- 下載 server bundle 遇到暫時性連線錯誤時，判斷是否重試更準確

### 已知事項

- 本版起安裝檔不含遠端 server bundle：**第一次**設定 WSL / SSH 遠端需要連上 GitHub（約 160–230 MiB），或使用「匯入本機 tarball」
- dmg / AppImage 改用較高壓縮後的實際大小、掛載與啟動速度，以本版 CI 產物為準，尚未在 Mac / Linux 實機確認
- Worker 分頁自動回收需搭配 Control Tower v5.1.0 並開啟 `worker_auto_close`；Codex Worker 完成工作後的收尾時間尚未實測
- 包含 pre.2 的 GPU 狀態日誌（BUG-136 仍在診斷）

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.6.1-pre.3...v0.6.1-pre.4

---

## v0.6.1-pre.3（2026-10-15）

版號 0.6.1-pre.3，接續 `v0.6.1-pre.2`。

### 新增

- **塔台可以回收自己派出的 Worker 分頁**（PLAN-041）
  - BAT 新增 `bat-terminal.mjs --close-worker T#### --notify-id <塔台分頁 id> [--delay-ms N]`
  - 只能關「這個塔台為這張工單派出的」Worker 分頁，關不到你自己開的分頁，也關不到別的塔台派的
  - Worker 最近 5 秒內仍有輸出時不關；延遲期間 Worker 有新輸出，或你在該分頁打字，會取消這次回收
  - 關閉方式與按 ✕ 相同（不清 worktree），BAT 重開後依然有效
  - 遠端視窗（WSL / SSH / Docker）同樣支援
  - **自動回收需搭配 Control Tower v5.1.0**，並以 `*config worker_auto_close done` 開啟（預設關閉）。延遲由 `worker_close_delay` 設定，預設 10 秒。只有工單 DONE 且不 Renew 時才會回收
- **Worker 分頁標示與批次關閉**
  - Worker 分頁的標題後面會顯示工單編號；Worker 回報後變成綠色的 `✓ T####`，滑鼠移上去可看到回報內容與派工的塔台
  - 塔台分頁按右鍵：「關閉已回報的 Worker 分頁（N）」，關閉前會列出清單讓你確認
  - Worker 分頁按右鍵：「關閉此 Worker」（等同按 ✕）
  - 「已回報」包含「部分完成」與「需要協助」，批次關閉前請確認清單

### 修正

- **程序已結束的分頁按 ⏻ 重啟沒有反應**（BUG-137）：現在會在同一個分頁重新開一個 shell，沿用工作區環境變數；agent 分頁會重新執行啟動命令。
- **Windows：關閉分頁後，agent 以背景方式啟動的子程序殘留**：使用 Terminal Server（預設）時，關閉分頁、重啟分頁、退出 BAT 並停止 Terminal Server，現在都會結束整個程序樹。退出時選擇保留終端的行為不變。
- 塔台派工日誌的 `sourceTerminalId` 改為記錄派工的塔台（原本永遠是空的）。

### 更新

- 內嵌 Claude CLI：2.1.296 → 2.1.300（模型清單、價格、effort 等級皆無變動）。

### 已知事項

- 尚未在真實的 Claude / Codex Worker 上確認：Worker 閒置時如果畫面會定時重繪（例如 spinner），回收可能一直被判定為「仍在輸出」而不執行。遇到請回報。
- macOS / Linux 的程序樹處理只經程式碼確認，未實機驗證。本版以單元測試與 Windows 隔離實例 e2e 驗證。
- 包含 pre.2 的 GPU 狀態日誌（BUG-136 仍在診斷）。

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.6.1-pre.2...v0.6.1-pre.3

---

## v0.6.1-pre.2（2026-10-15）

版號 0.6.1-pre.2，接續 `v0.6.1-pre.1`。

### 新增

- **GPU 狀態日誌**（協助診斷 BUG-136：macOS 上使用已久的分頁打字嚴重延遲）：`debug-*.log` 新增 `[gpu]` 開頭的紀錄。
  - 啟動時記錄 GPU 型號、驅動版本，以及各項繪圖功能目前是硬體還是軟體繪圖
  - GPU 行程崩潰時，記錄這是本次第幾次崩潰、崩潰當下的狀態，以及和上次紀錄相比有哪些變化
  - 之後狀態有變化（例如退回軟體繪圖）也會記錄
  - 只記錄，不改變任何繪圖行為

### 已知事項

- BUG-136 的根因尚未確定，這版只是協助判斷。遇到卡頓時，請回傳：
  - 最新的 `debug-*.log`（macOS 位於 `~/Library/Application Support/BetterAgentTerminal/Logs/`）
  - `~/Library/Logs/DiagnosticReports/` 裡最新的 `BetterAgentTerminal Helper-*.ips`
- 內嵌 Claude CLI 仍為 2.1.296。

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.6.1-pre.1...v0.6.1-pre.2

---

## v0.6.1-pre.1（2026-10-15）

版號改為 0.6.1 線，接續 `v0.6.0-pre.11`（內容含 pre.11 之後的修正）。

### 修正

- **終端焦點不再跳到其他工作區**（BUG-135）：以下情況原本可能讓焦點指向其他工作區的終端，使 snippet 貼上、Skills / Agents 面板作用到錯的終端，現在都限定在目前的工作區：
  - 獨立視窗（detached）關閉、終端交回主視窗時
  - 刪除或封存目前的工作區時
  - 重新載入工作區資料時
- **塔台派工的 Worker 分頁開在你沒在看的工作區時，不再搶走目前的焦點**。Worker 分頁開在目前工作區時與先前相同。
- **新工作區第一次開啟時，不再短暫閃出「沒有終端」的空狀態**：預設終端建立期間改顯示不透明底色，建立完成後直接顯示終端，避免剛好點到「新增終端」多開一個。遠端視窗等待重新連線期間同樣不顯示該按鈕。關閉工作區的最後一個終端時，空狀態仍會立即出現（pre.11 的修正不變）。

### 已知事項

- 本版以單元測試與 Windows 隔離實例 e2e 驗證；macOS 尚未實機驗收。

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.6.0-pre.11...v0.6.1-pre.1

---

## v0.6.0-pre.11（2026-10-15）

### 修正

- **關閉工作區的全部終端後，畫面看起來像當機的問題已修正**（BUG-134）：原本主畫面會透出其他工作區的終端畫面，點擊、輸入都沒有反應，要新增終端才會恢復。現在沒有終端的工作區會顯示空狀態與「新增終端」按鈕，切到其他工作區再切回來也一樣。
  - 根因：切換走的工作區只是被隱藏，它目前所在分頁的面板仍會繪製在畫面底層；目前工作區沒有終端時，空的容器是透明的，底層畫面就透了出來，滑鼠與鍵盤則落在上層的空容器。
- 關閉目前焦點所在的終端後，焦點只會移到同一個工作區的其他終端；工作區已沒有終端時不再指向其他工作區的終端（影響 snippet 貼上等以焦點終端為對象的功能）。

### 已知事項

- 新工作區第一次開啟、預設終端建立完成前，可能短暫看到空狀態。
- 本版以單元測試與 Windows 隔離實例 e2e 驗證；macOS 尚未實機驗收。

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.6.0-pre.10...v0.6.0-pre.11

---

## v0.6.0-pre.10（2026-10-14）

### 重點

- **工作區設定：每個工作區可各自設定預設 Agent 與啟動參數**（PLAN-040）
  - 工作區右鍵選單的「環境變數」改為「**工作區設定…**」，環境變數成為其中一區
  - **預設 Agent**：可選「跟隨全域設定」或任一 Agent。查找順序不變：工作區 → Settings 預設 Agent → claude-code
  - **啟動參數**：每個 Agent 一列，勾「覆寫」後填入此工作區專用的參數，整串取代 Settings 的全域參數（不串接）；覆寫為空白代表此工作區不帶任何參數。未勾選時沿用全域值
  - 對話框會顯示目前生效的 Agent 與參數，以及來源（此工作區 / 全域設定 / 內建預設）
  - 套用範圍：派工按鈕、新建 Agent 終端、塔台用 `bat-terminal.mjs --agent …` 派工（以 Worker 落點的工作區為準）。以完整指令派工（例如 `bat-terminal.mjs codex --model …`）時不另外加參數
- **獨立視窗（detached）按「開啟設定」改為在主視窗開啟 Settings**（BUG-133）：原本按了沒有反應。主視窗被最小化或縮到系統匣時會一併叫回；找不到主視窗時顯示提示。

### 已知事項

- 獨立視窗中的工作區設定只能查看，請在主視窗修改。
- 工作區設定與 Settings 的 Agent 下拉選單都不會列出自訂 CLI。
- 遠端（WSL / SSH / Docker）profile 的塔台經遠端伺服器派工時，沒有工作區層級設定，仍使用遠端伺服器的全域設定。
- 本版以單元測試與 Windows 隔離實例 e2e 驗證；新的工作區設定對話框尚未實機驗收，macOS 尚未實機驗收。

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.6.0-pre.9...v0.6.0-pre.10

---

## v0.6.0-pre.9（2026-10-14）

### 重點

- **塔台派工的 cwd 檢查**（BUG-132）：`bat-terminal.mjs` 派工時，會比對派工目錄（`--cwd`）與 Worker 分頁落點工作區的資料夾：
  - 派工目錄不屬於任何工作區（例如跨專案派工）→ 照常建立，印出警告
  - 派工目錄屬於**另一個**工作區 → 照常建立並警告；若帶 `--mode yolo` 則**拒絕派工**（exit 1，錯誤碼 `DISPATCH_CWD_OTHER_WORKSPACE`），訊息列出兩個工作區
  - 背景：某些 agent CLI（目前觀察到 Codex）會沿用另一個分頁保存下來的環境，`$BAT_TERMINAL_ID` / `$BAT_WORKSPACE_ID` 指向別的工作區，導致 Worker 開在別的工作區、完成通知送進別的專案塔台。這個檢查讓這種情況被看見，yolo 下直接擋下
  - 路徑比對在 Windows / macOS 不分大小寫，也會比對 symlink 解開後的實際路徑（iCloud / 雲端硬碟資料夾）
- **`--agent` 簡寫**：`--agent codex` / `--agent claude` 會對應到 `codex-cli` / `claude-cli`；不認得的 agent id 會列出可用的 id（原本只顯示 `terminal-not-created`）。

### 已知事項

- 遠端（WSL / SSH / Docker）profile 的派工尚未做 cwd 檢查。
- 若刻意以 `--mode yolo` 把 Worker 派到另一個工作區的資料夾，會被擋下；不帶 `--mode yolo` 即可建立（附警告）。
- 工作區層級的預設 Agent 設定入口仍未提供（PLAN-040）；要讓 `--agent default` 開 Codex，請在 Settings 把預設 Agent 設為 Codex，或派工時帶 `--agent codex`。

macOS 仍只提供 Apple Silicon（arm64）版。本版改動以單元測試與 Windows 隔離實例 e2e 驗證，macOS 尚未實機驗收。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.6.0-pre.8...v0.6.0-pre.9

---

## v0.6.0-pre.8（2026-10-14）

### 重點

- **終端貼上統一規則（Windows / macOS / Linux）**：Ctrl+V、macOS 的 Command+V、右鍵選單「貼上」都依剪貼簿內容決定（BUG-128 / BUG-130）：
  - 檔案（Finder / 檔案總管拷貝）→ 貼上完整路徑，有空白或特殊字元時自動加引號，與拖放檔案相同；macOS 支援多檔
  - 圖片 → 送 claude CLI 的貼圖鍵（Windows 為 Alt+V，macOS / Linux 為 Ctrl+V），在終端執行的 `claude` 可直接貼圖
  - 文字 → 一般貼上
  - 剪貼簿同時有圖片與文字時（例如從 Excel 複製儲存格）視為圖片；要貼文字請用 Ctrl+Shift+V
  - 每次判斷都寫入 debug log（搜尋 `[terminal-paste]`），貼圖偶發失效時可據此回報
- **macOS：Finder 拷貝後 Command+V 貼不出東西的問題已修正**（BUG-128）。Claude / Codex 面板也能用 Command+V 把 Finder 拷貝的檔案加為附件。
- **塔台派工落點**（BUG-129）：`bat-terminal.mjs` 派工時，Worker 分頁改開在「下指令的塔台分頁目前所在的工作區」，`--agent default` 也依該工作區解析；與 `--workspace` 不一致時寫入警告。派工成功後會多印 `workspace:` / `agent:` 兩行實際落點，方便核對。

### 修正

- 指揮塔面板：切換工作區時不再把既有工單當成「新工單」或「已完成」跳出整排提示；同一工作區內的新增與狀態變更照常通知。提示框改為不透明底色，不再與底下面板文字重疊（BUG-127）。
- 分頁按 ↺ 重新啟動、或 Terminal Server 當掉後自動重建時，保留原本的環境變數（工作區 / 全域環境變數、Worker 回報塔台所需的變數），連線資訊取當下的值（BUG-131）。

### 已知事項

- `--agent default` 的查找順序：工作區預設 → Settings 預設 Agent → claude-code。目前**還沒有**工作區層級的設定入口（預計下一批補上，PLAN-040），要讓派工開 Codex，請在 Settings 把預設 Agent 設為 Codex，或派工時帶 `--agent codex`。
- Windows 終端貼圖偶發失效的原因尚未重現，本版改由主程序判斷剪貼簿並加上 log。
- macOS 的修正以單元測試驗證，實機驗收進行中。

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.6.0-pre.7...v0.6.0-pre.8

---

## v0.6.0-pre.7（2026-10-14）

### 重點

- **配置（Profile）對話框的遠端狀態燈改為反映本機實際連線**。之前 WSL / SSH / Docker profile 的燈號永遠是紅燈「Disconnected」，即使該 profile 的視窗開著、連線正常（BUG-123）。現在分為：
  - 🟢 已連線：本機持有此 profile 的連線
  - 🟡 連線中 / 重新連線中
  - 🔴 連線中斷或連線失敗，滑鼠移上去會顯示原因
  - ⚪ 未開視窗
  - 提示文字三語；對話框開著時，連線 / 斷線會即時更新。
  - 指向另一台完整 BAT 的舊式 remote profile：綠燈改為「本機已連上」才亮；遠端機器上該 profile 使用中但本機未連線時顯示 ⚪ 並註明。
- **SSH 設定精靈**：目標主機的 sshd 不允許 port forwarding（`AllowTcpForwarding no`）時，改為直接說明這個原因並建議修改 sshd 設定，不再顯示成「伺服器埠上的程式沒有提供 TLS 憑證」（BUG-124）。

### 修正

- Claude 面板的指令清單：`.claude/commands/*.md` 帶 YAML frontmatter 時，描述改讀 `description:`，不再顯示成 `---`（BUG-125）。
- skill 的 frontmatter 沒有 `description:` 時，描述改為 frontmatter 之後的第一行，不再是空白（BUG-126）。

### 已驗收（pre.6 自動化實機驗收）

- 以已安裝的 pre.6 搭配容器化的 SSH 主機與遠端 server，自動化驗收並結案 18 張既有修正，包括：SSH 精靈安裝 / 啟動 / 指紋 / 停止與移除 / 取消時 rollback、ProxyJump alias，遠端視窗斷線時不改在本機執行、detach 視窗、遠端重連帶指紋、`/snippet`、本機 snapshot 打包、Linux AppImage 內嵌 claude。

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.6.0-pre.6...v0.6.0-pre.7

---

## v0.6.0-pre.6（2026-10-14）

### 重點

- **SSH 設定精靈終於能在 Linux 主機上裝好並啟動 server**。自 `v0.4.1` 起，SSH 精靈的「安裝 server bundle」與「啟動 server」兩步都有缺陷，任何版本都無法在 Linux 目標完成（macOS 目標推定相同）。pre.5 release notes 所說的 alias 支援本身是對的，但被這兩個缺陷擋住，本版一併修正：
  - 上傳的 bundle 多解了一層 `staging/`，服務找不到執行檔（BUG-120）。
  - 服務以錯誤的設定名稱傳 port，server 改聽 54321，精靈的啟動檢查因此失敗（BUG-121）。
  - 若 pre.5 曾在某台主機留下 `~/.local/bat-server/staging/`，用 pre.6 重跑精靈即會自動清除並裝成正確佈局；重跑時也會重新啟動已在跑的舊服務。
- **配置（Profile）對話框加寬**：remote 卡片展開後不再只用右半邊；「遠端 AI 工具」改為卡片排列，寬視窗可並排多欄，窄視窗自動縮回（BUG-122）。

### 修正

- SSH 精靈認證失敗（`permission-denied`）時，現在會顯示「修改 SSH 設定」並回到主機設定步驟。

### 已驗收（pre.5 實機）

- 本機派工 helper 遺失分頁（BUG-114）與設定 / 日誌目錄統一（BUG-119）已在 pre.5 實機驗收後結案；升版後既有遠端 client 不需重新配對。

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.6.0-pre.5...v0.6.0-pre.6

---

## v0.6.0-pre.5（2026-10-14）

### 重點

- **SSH 設定精靈**：選 `~/.ssh/config` 的 alias 現在可以完整走完（使用者 / Port / IdentityFile / ProxyJump 由 ssh config 決定）；也可以手動輸入 `user@host:port`。
- **內嵌 Claude Code CLI 升級到 2.1.296**，新增 **Haiku 5.5** 模型。
- **Cache History 成本修正**：總計不再重複加總（先前可能高估 45%–77%），Haiku 5.5 依每次呼叫的 prompt 長度分段計價，Sonnet 5.5 cache read 改為官方 0.05x。

### 修正

- 自訂 CLI Agents（Settings → Custom CLI Agents）的新增 / 移除先前從未寫入磁碟，重啟後會消失 —— 已修正。
- 本機派工 helper（`bat-terminal`）偶爾把其他分頁的輸出誤判為「分頁已建立」，造成派工遺失（BUG-114）；連線被拒時改為立即顯示原因，不再等到逾時。
- detached workspace 視窗內新增 / 關閉 / 改名的終端，會正確存回原視窗；關閉視窗前會先存檔。
- 設定精靈：跳回前面步驟時會回收本次建立的資源，且可以真的重新修改設定；「Use existing」但沒有容器時重試不再卡住；錯誤畫面改為依介面語言顯示。
- remote profile 連線失敗對話框改為依介面語言顯示（英 / 繁中 / 簡中）。
- 同時建立多個 remote profile 時可能出錯或遺失資料 —— 改為依序寫入。
- remote server 自簽憑證的有效期改為實際 10 年（先前誤為 365 天；用戶端以指紋驗證，既有連線不受影響）。
- 啟動早期就崩潰的情況現在也會寫入日誌，方便回報問題。
- 本機以 snapshot 版號打包時下載 server bundle baseline 會失敗（BUG-115）。

### 打包與相依

- 移除未使用的 `better-sqlite3`，`sharp` / `@img` 不再打包進安裝檔與 server bundle（安裝檔與 server bundle 變小）。
- server bundle 不再含指向建置機路徑的 symlink；macOS server bundle 最低需求 macOS 13.5。
- CI：新增型別檢查關卡；GitHub Actions 升級到原生 Node 24 版本；Linux runner 固定 `ubuntu-24.04`，server bundle 的 macOS runner 改為 `macos-15`。

macOS 仍只提供 Apple Silicon（arm64）版。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.6.0-pre.4...v0.6.0-pre.5

---

## v0.6.0-pre.4（2026-10-13）

### ⚠️ 資料目錄統一（升級前請先關閉舊版）

先前版本的資料分散在兩個目錄：設定在 `BetterAgentTerminal/`，日誌、Crashes、snippets 在 `better-agent-terminal/`（BUG-119）。自本版起統一為：

| 平台 | 資料目錄 |
|------|---------|
| Windows | `%APPDATA%\BetterAgentTerminal\` |
| macOS | `~/Library/Application Support/BetterAgentTerminal/` |
| Linux | `~/.config/BetterAgentTerminal/` |

日誌改寫到 `<資料目錄>/Logs/`。

**首次啟動時自動搬移（只執行一次，一律複製、不刪除舊目錄）：**
- `Local State`（遠端存取權杖的加密金鑰），讓既有的遠端配對繼續有效
- `snippets.json`：新目錄沒有就複製，兩邊都有就合併，合併前會先備份
- `message-archives/`
- `--runtime=<N>` 實例：整個 `better-agent-terminal-runtime-<N>` 目錄改名為 `BetterAgentTerminal-runtime-<N>`

**請注意：**
- 舊的 `better-agent-terminal/` 會保留、不會自動清除，以前的日誌仍在那裡
- `--runtime=<N>` 實例的 snippets 改為各自一份，不再共用預設實例的 snippets
- **不要同時執行新舊兩個版本**：兩者的單一實例鎖在不同目錄，會同時寫入設定
- 降回舊版時，設定與遠端權杖可沿用；在新版建立的 snippets 舊版看不到
- 若升級後遠端 client 需要重新配對，或日誌開頭出現 `[userdata-migration]` 的錯誤，請回報（附 `Logs/` 內最新的日誌）

### 修正

- 啟動時忽略 Settings 中的日誌開關與等級（同 BUG-119 根因），已修正
- 終端分頁內的 helper（`bat-terminal` / `bat-notify`）在 `--runtime=<N>` 實例中會找錯憑證，改為依實際資料目錄解析

### 其他

- macOS 仍只提供 Apple Silicon（arm64）版，不支援 Intel Mac（自 v0.6.0-pre.3 起）
- README 更新：版本 badge、技術堆疊、發行流程、資料與日誌路徑

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.6.0-pre.3...v0.6.0-pre.4

---

## v0.6.0-pre.3（2026-10-13）

### ⚠️ 不再支援 Intel Mac

自 v0.6.0-pre.3 起，macOS 只提供 **Apple Silicon（arm64）** 版：`BetterAgentTerminal-0.6.0-pre.3-arm64.dmg`。
先前的 Intel（x64）dmg 內含的內嵌 claude / codex / node-pty / 語音元件實際上都是 arm64，在 Intel Mac 上無法使用，因此停發（BUG-117 / D136）。

### 修正

- **macOS 啟動即崩潰**（BUG-116）：語音模組 `@kutalia/whisper-node-addon` 的 binary 目錄命名與套件內部尋找的路徑不一致，載入失敗導致 app 無法開啟。改為延遲載入並相容兩種目錄名；語音模組不可用時只影響語音輸入，不再拖垮整個 app。
- **macOS / Linux 打包版缺內嵌 claude**（BUG-118）：打包時非 Windows 平台會排除 `.exe`，內嵌 claude 指向的檔案不存在。改用隨套件打包的平台專用 binary；找不到時顯示列出搜尋路徑的明確錯誤。
- 簡繁轉換（opencc）改為使用時才載入，縮短啟動時間。

### 打包與建置

- CI 在 macOS / Linux 打包後檢查產物：所有原生 binary 的架構、內嵌 claude 是否存在且架構正確、語音模組 binary 是否存在。
- `package.json` 新增 `allowScripts`，支援 npm 12 預設阻擋相依套件 install scripts 的行為；postinstall 改以 `@electron/rebuild` 建置 Electron ABI 的 better-sqlite3。

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.6.0-pre.2...v0.6.0-pre.3

---

## v0.6.0-pre.2（2026-10-05）

（依 commit 整理；GitHub Release 只有自動產生的內容）

### 新增

- **可同時連線多個遠端 profile**（PLAN-039）：每個 profile 各自持有連線，最多 8 個；最後一個視窗關閉 15 秒後才斷線（T0462–T0466）
- **遠端塔台派工與 Worker 回報**（PLAN-036）：遠端視窗的塔台可用 `bat-terminal.mjs` 派工、Worker 可用 `bat-notify.mjs` 回報；遠端 server 為每個 PTY 簽發範圍權杖，helper 隨 server bundle 安裝（T0431–T0434、T0447–T0451、T0456）
- 遠端視窗新增「複製遠端路徑」（T0438）
- 拖放檔案到終端時插入加引號的路徑（T0439）
- 在遠端視窗的 prompt 輸入本機路徑時提示（T0440）
- 遠端 PTY 達上限時顯示提示，不再是空白終端（T0424）

### 修正

- 開啟外部連結 / 檔案的安全限制：只開 http(s)、執行檔需確認、每個視窗都有導覽保護（BUG-105，T0457 / T0458 / T0460 / T0461）
- 遠端連線：重連沿用已釘選的 client 與指紋、連線成功才替換、載入失敗時釋放（BUG-096，T0419 / T0430 / T0442）
- Docker：主機埠只綁 `127.0.0.1`，偵測舊版對外開放的容器（BUG-097，T0418 / T0427 / T0428）
- 設定精靈：取消時回收失敗的步驟、只回收本次建立的資源、Docker 重試重新啟動本次建立的容器（BUG-099 / BUG-100 / BUG-111，T0426 / T0444 / T0452）
- 拖放檔案路徑、Claude 面板圖片附件、`/snippet` 提示（BUG-107 / BUG-108 / BUG-109，T0435 / T0436 / T0441）
- 遠端視窗未連線時不改在本機執行（BUG-110，T0443）
- detached 工作區視窗綁定父視窗的 profile、讀取父視窗的工作區資料（BUG-112 / BUG-113，T0446 / T0453）
- client 心跳檢查 pong、SSH tunnel 本機埠衝突時重試一次（T0455 / T0465）

### 更新

- SSH 設定精靈只保留 tunnel 模式（BUG-098，T0425）
- 移除未使用的 `worktree:merge` 通道（BUG-106，T0417）

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.6.0-pre.1...v0.6.0-pre.2

---

## v0.6.0-pre.1（2026-10-05）

（依 commit 整理；GitHub Release 只有自動產生的內容）

### 新增

- **遠端視窗功能補齊**（PLAN-036）：WSL / SSH / Docker 遠端視窗的終端、Claude 面板、Git / GitHub / worktree、檔案與圖片功能改由遠端 server 處理（T0388–T0406）
- **遠端 AI 工具偵測與安裝**（PLAN-037）：遠端工具面板列出 claude / codex 等工具的安裝狀態，可在遠端視窗內一鍵安裝，設定精靈完成頁與配置卡片都有入口（T0408–T0415）
- Claude 面板未登入時顯示登入引導（T0402）
- 終端重新連上時重播先前的輸出，不重新啟動 agent（T0403）
- 遠端視窗的 shell 清單依遠端作業系統列出，WSL 工作區預設資料夾（T0393）
- 遠端 server 回收無人使用的 PTY 並設上限（BUG-103，T0404）

### 修正

- WSL 設定精靈：沒有 distro 被誤判為沒裝 WSL、linger 使用者與 unit 路徑、重試時不再 rollback、網路模式偵測、server port 避開本機 RemoteServer、TLS 指紋擷取逾時、每個 distro 保持一條 wsl.exe 連線（BUG-086 / 087 / 089 / 090 / 091 / 092，T0378–T0384）
- SSH 設定精靈：服務設定檔與 bundle 上傳改用絕對路徑、經 tunnel 驗證遠端 server（BUG-088 / BUG-093，T0379 / T0387）
- 遠端 server 缺少 profile / settings 處理、連線失敗原因分類（BUG-094，T0385）
- Claude 面板的中斷在遠端視窗無效（BUG-095，T0392）
- Terminal Server 重啟後舊 PTY 的結束事件誤關新分頁（BUG-101，T0394）
- Linux 不再強制使用 `en_US.UTF-8` locale（BUG-102，T0398）
- 遠端安裝 codex 不再卡在互動提示（BUG-104，T0415）
- 遠端視窗的路徑參數改依遠端主機解析（BUG-105，T0416）
- 以系統管理員身分執行 BAT 時不自動啟動 codex daemon（BUG-085，T0377）
- 本機打包的版號改以 `package.json` 為準（T0376）

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.5.9-pre.4...v0.6.0-pre.1

---

## v0.5.9-pre.4（2026-10-04）

（依 commit 整理；GitHub Release 只有自動產生的內容）

### 修正

- **內嵌 Claude Code CLI 升級到 2.1.289**，支援 Claude 5 模型（`claude-opus-5-5`、`claude-fable-5-1`、`claude-sonnet-5-5`）；舊版內嵌 CLI 會被服務端拒絕（BUG-084，T0371）
- Claude 面板遇到「CLI 版本太舊」的模型錯誤時附上說明與解法；內嵌 runtime 禁止 `claude update`；system runtime 的健康門檻提高到 2.1.280（BUG-084，T0372）
- Cache History 成本可計算 Claude 5 模型，並使用各模型的 cache read 費率（BUG-084，T0374）
- Codex 面板不再把設定檔警告與連線重試顯示為錯誤；設定檔版本不符、模型需要較新 Codex 時附上說明（BUG-083，T0367 / T0370）

### 更新

- 內嵌 Codex SDK 升級到 0.160，相容新的 binary 目錄佈局（BUG-083，T0369）
- Codex 模型清單改讀 Codex CLI 的 `models_cache.json`，新增 `max` / `ultra` effort，只列出所選模型支援的等級（BUG-083，T0370）
- BAT 改用找得到的最新版 Codex CLI（內嵌、官方安裝、Codex Desktop App、PATH），每個 session 顯示使用的版本；切換模型時自動修正不支援的 effort（BUG-083，T0373）

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.5.9-pre.3...v0.5.9-pre.4

---

## v0.5.9-pre.3（2026-10-04）

（依 commit 整理；GitHub Release 只有自動產生的內容）

### 修正

- 設定精靈的 server bundle 下載來源改為本 fork（`gowerlin`），desktop 發佈時同時發佈 `server-bundle-v<版號>`，先前安裝檔未內建的架構一律下載失敗（BUG-071，T0365，D120）

### 更新

- 移除 PTY 寫入路徑上的除錯輸出（T0363）

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.5.9-pre.2...v0.5.9-pre.3

---

## v0.5.9-pre.2（2026-09-02）

（依 commit 整理；GitHub Release 只有自動產生的內容）

### 修正

- 派工 prompt 依目標 shell（POSIX / PowerShell / cmd）加引號，prompt 含 `'` 時在 PowerShell 不再出錯（T0362，PR #19）

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.5.9-pre.1...v0.5.9-pre.2

---

## v0.5.9-pre.1（2026-09-01）

（依 commit 整理；GitHub Release 只有自動產生的內容）

### 修正

- 工單編號規則統一為 `^(?:[A-Z]{2,4}-)?T\d+$`：跨專案 / 委派工單（例 `CP-T0113`、`CT-T001`）可以用 `--skill` + `--workorder` 派工，指揮塔面板也不再忽略 `CT-T####` 工單（BUG-082，T0360）
- 工單 frontmatter 遷移腳本使用同一套編號規則（T0361）

### 更新

- `bat-terminal.mjs` 沒帶 `--workspace` 時提示改用 `--workspace "$BAT_WORKSPACE_ID"`（T0360）
- 外部建立的終端找不到指定工作區時寫入日誌，方便追查落點（T0361）

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.5.8...v0.5.9-pre.1

---

## v0.5.8（2026-05-24）

（依 commit 整理；GitHub Release 只有自動產生的內容）

> 這段期間 tag 為 v0.5.x，`package.json` 版號仍為 0.4.1 / 0.4.2（安裝檔版號由 CI 依 tag 決定）；CHANGELOG 的 `[0.4.2]` 段所列內容實際分散在 v0.5.0-pre.2–v0.5.8 發佈。

### 修正

- 指揮塔可解析首字大寫的 bug tracker 區段標題

### 更新

- `package.json` 版號同步為 0.4.2

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.5.7...v0.5.8

---

## v0.5.7（2026-05-23）

（依 commit 整理；GitHub Release 只有自動產生的內容）

### 修正

- 指揮塔支援 `ABANDONED` 工單狀態，視為已結束（T0359，CP-T1148）

### 更新

- 以 Claude 塔台實測 yolo 模式的 `--submit`（BUG-081，T0358）

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.5.6...v0.5.7

---

## v0.5.6（2026-05-17）

（依 commit 整理；GitHub Release 只有自動產生的內容）

### 修正

- `bat-notify --submit` 在預填文字之後延遲送出 Enter，避免 yolo 模式送出時文字還沒寫完（BUG-081，T0357）

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.5.5...v0.5.6

---

## v0.5.5（2026-05-17）

（依 commit 整理；GitHub Release 只有自動產生的內容）

### 修正

- `bat-notify --submit` 的 Enter 改經視窗內的鍵盤事件送出

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.5.4...v0.5.5

---

## v0.5.4（2026-05-17）

（依 commit 整理；GitHub Release 只有自動產生的內容）

### 修正

- `bat-notify --submit` 改以按鍵（keypress）方式送出 Enter

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.5.3...v0.5.4

---

## v0.5.3（2026-05-15）

（依 commit 整理；GitHub Release 自動產生的內容只列出 PR #18）

### 修正

- 遠端 claude-cli 派工會套用 Settings 的 `claudeRuntime.customPath`（PR #18，@RicoChen727）
- `claudeRuntime.customPath` 含 shell 特殊字元時拒絕使用（T0355，BUG-080）
- claude-cli 啟動命令依目標 shell 加引號（T0356，BUG-080）

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.5.2...v0.5.3

---

## v0.5.2（2026-05-15）

（依 commit 整理；GitHub Release 只有自動產生的內容）

### 修正

- GitHub 面板找不到 `gh` CLI 的問題：改為解析 `gh` 的實際路徑（BUG-079，T0352 / T0353）

### 更新

- GitHub 面板補齊簡體中文翻譯

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.5.1...v0.5.2

---

## v0.5.1（2026-05-07）

（依 commit 整理；GitHub Release 只有自動產生的內容）

### 修正

- `bat-terminal.mjs` 以 `--skill --workorder` 派工時，「Terminal created」訊息不再印出 `null`（T0110，BUG-020）

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.5.0-pre.2...v0.5.1

---

## v0.5.0-pre.2（2026-04-28）

（依 commit 整理；GitHub Release 只有自動產生的內容）

> 這段期間 tag 為 v0.5.x，`package.json` 版號仍為 0.4.1 / 0.4.2（安裝檔版號由 CI 依 tag 決定）；CHANGELOG 的 `[0.4.2]` 段所列內容實際分散在 v0.5.0-pre.2–v0.5.8 發佈。

### 新增

- **設定精靈錯誤處理全面整修**（PLAN-032）：等待輸入的步驟改為中性的「等待輸入」狀態、錯誤改顯示有標題與說明的面板並提供對應的恢復動作、步驟前置檢查（T0330–T0341；細節見 CHANGELOG `[0.4.2]` 段）
- **指揮塔面板改為優先讀取工單 / BUG / PLAN 的 YAML frontmatter**（PLAN-034，T0344–T0346）；狀態無法辨識時標示為無效，不再誤顯示為 PENDING（BUG-077）

### 修正

- 設定精靈：WSL linger / systemd 失敗、Docker daemon 未啟動、SSH 主機設定步驟一開始就顯示失敗、錯誤碼在畫面上遺失（BUG-072 / BUG-073 / BUG-074 / BUG-076，T0335–T0339）
- 指揮塔 drift 紀錄移到主程序寫入（BUG-078，T0348）

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.4.3...v0.5.0-pre.2

---

## v0.4.3（2026-04-27）

（依 commit 整理；GitHub Release 只有自動產生的內容）

### 新增

- **設定精靈改版**（PLAN-030）：WSL / Docker / SSH 設定精靈改為垂直步驟列（stepper），步驟與說明左右兩欄並排、各自捲動，對話框加寬（T0307、T0309、T0311、T0312）
- **配置（Profile）進階類型改為分類下拉選單**（BUG-070，T0306）
- **遠端 server bundle 發佈機制**（PLAN-031）：安裝檔依平台內建 server bundle baseline，缺少的架構改從 GitHub Release 下載並以 SHA-256 manifest 驗證；精靈自動偵測遠端架構，WSL / SSH / Docker 的「安裝 server bundle」步驟改用同一套分發流程（T0313–T0327）

### 修正

- **塔台派工的 shell 偏好與 MSYS 路徑改寫回歸**（BUG-075）：Worker prompt 帶 `MSYS_NO_PATHCONV`，避免 Git Bash 把參數中的路徑改寫；派工流程不再綁定特定 agent（T0329 研究，修正 T0341 / T0343）

### 更新

- 前端單元測試改用 vitest + jsdom + React Testing Library（T0307b）
- server bundle 建置 workflow 支援多平台並產生 manifest（T0315）

**Full Changelog**: https://github.com/gowerlin/better-agent-terminal/compare/v0.4.2...v0.4.3

---

## 上游歷史（tony1223/better-agent-terminal v2.1.x）

### v2.1.6

#### New Features

##### Keyboard Shortcuts (#68)
- `Ctrl+`` ` `` / `Cmd+`` ` ``: Toggle between Agent terminal and first regular terminal (press again to switch back)
- `Ctrl+←/→` / `Cmd+←/→`: Cycle workspace tabs (Terminal → Files → Git)
- `Ctrl+↑/↓` / `Cmd+↑/↓`: Switch to previous / next workspace (wraps around)

---

### v2.1.5

#### Bug Fixes
- **Model selector**: No longer shows "No models available" — models are now fetched on-demand when the selector opens, without requiring an active session
- **Model switching**: Switching models no longer clears the message input box (#65)

---

### v2.1.4

#### New Features

##### Cross-Window Workspace Drag-and-Drop
- Drag workspaces between different windows in the sidebar
- Drop position is respected — inserts at the exact target slot
- No session rebuild needed — pure registry re-index

##### Firefox Session Key Support
- Usage polling now supports Firefox cookies as a session key source (Chrome → Firefox → OAuth fallback chain)
- Cross-platform: macOS, Windows (`%APPDATA%`), Linux (standard + Snap + Flatpak)
- Reads `profiles.ini` to resolve the correct default profile
- EBUSY handling: if Firefox is running and DB is locked, returns stale cache for 10 min

##### Usage Polling Improvements
- Cumulative backoff: `60s × 2^streak` (streak capped at 3 → max 480s) for consecutive rate limits
- `refreshUsageNow()` is blocked during rate-limit backoff to prevent hammering
- localStorage cache: usage data persists across app restarts; expired windows are cleared on load
- Stale indicator: 10 min without fresh data marks the 5h usage as stale (dimmed)

##### 5h Pacing Indicator
- `usage5h` statusline item now shows ▼ (on pace) or ▲ (over pace) based on utilization vs time elapsed
- Tooltip shows time elapsed % and estimated minutes to limit

##### Context % Dynamic Color
- `ctx X%` statusline item now colors dynamically: green (≤50%) / yellow (≥50%) / red (≥80%)
- User-configured statusline color for `contextPct` is ignored — dynamic color always wins

##### PDF Preview
- Click `.pdf` file paths in Agent chat to open preview in right sidebar using Chromium's built-in viewer (#60, @handpower)

##### Simplified Chinese Locale
- Added 简体中文 (Simplified Chinese) language support

##### Multi-Window Enhancements
- Window index shown in profile badge (e.g. `Default:1`, `Default:2`)
- Closing an empty-workspace window skips confirmation dialog — removed silently
- Single instance lock with workspace save-to-snapshot on second launch attempt

#### Bug Fixes
- Fixed stale/wrong-account Chrome session key returning 0% usage after account switch
- Fixed `getSupportedModels` failing when no active session exists
- Fixed image resize error (`sharp` module not found in packaged app) — native binaries now unpacked from asar
- Fixed `sharp` platform-specific deps causing `EBADPLATFORM` on ARM64 CI runners
- Fixed markdown loose list item extra spacing
- Fixed cross-window workspace drop inserting at wrong position

---

### v2.1.3

#### New Features

##### Profile Workspace Isolation
- New profile opened in a new window now starts with empty workspace list (previously showed old profile's workspaces)

##### Drag-and-Drop Workspace
- Drag folders from Finder/Explorer directly onto the sidebar workspace list to add them
- Supports multiple folders at once
- Visual feedback with dashed blue outline during drag

##### Native Create Folder in Add Workspace
- Folder picker now natively supports creating new folders (macOS "New Folder" button / Windows native support)
- Simplified from split button back to single "Add Workspace" button

#### Bug Fixes
- Fixed extra line breaks in markdown preview (`breaks: false` for GFM standard behavior)
- Fixed `fs.readFile` error handling in MarkdownPreviewPanel (#51, @Owen0857)

---

### v2.1.2

#### New Features

##### Skills Panel
- Right sidebar new "Skills" tab (alongside Snippets) showing available slash commands
- Split into **Custom** (user-defined `.claude/commands/`) and **Built-in** (system) sections with separator
- Click any skill to insert `/command` into Agent chat input
- Auto-loads from SDK `supportedCommands()` with 3s retry for fresh sessions
- Only visible for Claude Code terminals
- Filesystem scan reads project-level and global `.claude/commands/*.md`

##### Markdown Preview Panel
- Click `.md` file paths in Agent chat to open live preview in right sidebar
- Auto-updates on file changes via `fs.watch`
- Header with filename, copy path, open file, and close buttons
- Reuses existing markdown pipeline (marked + DOMPurify + highlight.js + mermaid)

##### Workspace Context Menu
- Added "Copy Path" option to right-click workspace menu

#### Community Contributions
- **@Owen0857**: Collapse output for read-only tools (Read, Glob, Grep, LS) (#42)
- **@Owen0857**: Usage polling rate-limit backoff fix (#44)
- **@Owen0857**: SDK plugin loading support (#40)
- **@handpower**: File URL parsing fix (#41)
- **@handpower**: Markdown rendering in Agent chat panel (#39)

---

### v2.1.1

#### New Features

##### Default Model & Effort Settings
- New settings: Default Model (text input) and Default Effort Level (dropdown)
- Applied to new Agent sessions automatically
- Default effort changed from `high` to `medium`
- Removed `max` effort from UI (SDK still accepts it for Opus 4.6)

##### Enable 1M Context Toggle
- New checkbox in Settings to enable/disable 1M token context window
- Default: enabled (1M is GA for Opus 4.6 / Sonnet 4.6)

#### Improvements

##### Statusline
- **ctx%** now uses per-turn `usage.input_tokens` (actual context size) instead of cumulative total
  - Previously showed misleading values like "ctx 184%" after many turns
  - Tooltip shows both current context and total consumption
- **maxOut** statusline item shows max output tokens (e.g. `maxOut:64k`)
  - Default hidden, enable in statusline settings
- **last_tool_name** shown in active tasks bar (e.g. `Searching codebase [Grep]`)

##### Input
- Agent input textarea auto-grows up to ~8 lines as you type
- Shrinks back to 1 line on clear/send

##### SDK & Token Counting
- Updated claude-agent-sdk to 0.2.81 and claude-code to 2.1.81
- Fixed token counting to include cache tokens (cacheRead + cacheCreate)
- Removed blink animation from task elapsed time display

#### Bug Fixes
- Fixed usage polling rate-limit backoff (use retryAfterSec directly)
- Support `file://` URLs in LinkedText
- Restored original 2min usage polling (SDK rate_limits lacks 7d data)
