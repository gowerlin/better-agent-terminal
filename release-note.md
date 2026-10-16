# Release Notes — Better Agent Terminal（gowerlin fork）

本 fork 各版的更版重點（內容取自 GitHub Releases，最新在上）。上游 tony1223/better-agent-terminal 的 v2.1.x 紀錄保留在檔案最下方。

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
