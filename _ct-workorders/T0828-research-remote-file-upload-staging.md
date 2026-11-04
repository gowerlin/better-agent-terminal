---
schema_version: 1
schema_kind: workorder
id: T0828
title: "研究：PLAN-038 本機檔案上傳到遠端暫存目錄（SSH / Docker 附件、WSL 其他 distro、遠端 CLI 貼圖）的設計與拆單"
type: research
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-04T08:52:59+0800"
started_at: "2026-11-04T08:56:21+0800"
updated_at: "2026-11-04T09:02:52+0800"
completed_at: "2026-11-04T09:02:52+0800"
session_ids:
  - "4d341745-7346-47b3-97ed-61fdf3b25073"
depends_on: []
related:
  - "PLAN-038；D271；T0421（研究：自由文字路徑轉譯，拆單第 7 列）；T0437（遠端解析本機路徑附件：拒絕並提示）；T0435 / T0436（拖放、圖片附件 client 端讀取）；T0406（`workspace:sync-roots` path sandbox）；PLAN-036 / D134（遠端權杖）"
affects_files:
  - _ct-workorders/T0828-research-remote-file-upload-staging.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 唯讀研究：只寫本工單檔，不改程式、不建檔、不開分支。可讀程式、跑唯讀指令與既有測試；不連任何實際遠端主機、不碰本機 BAT 安裝版與它的 Terminal Server。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台（研究型提問上限依 `research_max_questions`）。不 push。Git：只 commit 本工單檔（`git add <明確路徑>`，不用 `-A` / `.`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0828 — 研究：遠端附件上傳暫存（PLAN-038）

## 元資料

- **工單編號**：T0828
- **任務名稱**：研究：PLAN-038 遠端附件上傳的設計與拆單
- **狀態**：DONE
- **類型**：research
- **互動模式**：enabled（yolo：問塔台）
- **intervention_type**：context-dependent
- **Renew 次數**：0
- **建立時間**：2026-11-04 08:52 (UTC+8)

## 研究目標

使用者決定 PLAN-038 先研究再實作（D271）。產出可以直接拆成實作工單的設計：遠端視窗（SSH、Docker 掛載以外的路徑、WSL 其他 distro）把本機檔案拖放 / 附加到 Claude 面板（與 Codex 面板，若適用）時，把檔案內容傳到遠端暫存目錄，再把遠端路徑放進 prompt；並評估 WSL claude CLI 分頁 Alt+V 貼圖（讀遠端剪貼簿）能否經同一通道解決。

## 已知資訊

- 現況：T0437 對遠端無法解析的本機路徑附件「拒絕並提示」；T0436 圖片附件在 client 端讀取。
- 遠端連線：`RemoteConnectionRegistry`（PLAN-039）、proxied IPC、headless bat-server（`electron/remote/headless-*.ts`）、frame 協定 `electron/remote/protocol.ts`。
- path sandbox：T0406 `workspace:sync-roots`（client 推送 workspace roots，fail-closed）。

## 調查範圍與要回答的問題

1. **現況盤點**：附件從拖放 / 選檔 / 貼上到送出的完整路徑（本機、各遠端類型），T0437 拒絕點在哪；Codex 面板是否同樣需要。
2. **傳輸通道**：用既有 WSS frame 還是新 channel；分塊大小、單檔與單次總量上限、進度回報、取消、失敗重試；WSS 單 frame 上限與 backpressure；對既有連線的影響（大檔是否卡住其他 IPC）。
3. **遠端暫存目錄**：位置（例 `<dataDir>/uploads/<session>/` 或 `$TMPDIR`）、檔名（避免衝突與路徑穿越）、權限（0700 / 0600）、清理（分頁 / session 結束、BAT 重開、依時間）、磁碟滿的處理。
4. **安全**：誰能呼叫（renderer IPC only，不給 helper 權杖）、與 path sandbox 的關係（暫存目錄是否要加進 roots）、日誌不記內容、上傳後路徑是否揭露給 agent 以外。
5. **各遠端類型差異**：SSH、Docker（掛載內的路徑是否仍直接用）、WSL 其他 distro（同 distro 已可直接轉譯）。
6. **Alt+V 貼圖**：claude CLI 在 WSL / SSH 讀哪個剪貼簿（xclip / wl-paste / WSLg）、BAT 能否攔截並改成上傳後插入路徑；可行性與風險。
7. **測試策略**：哪些可單元測試、哪些需要 e2e（既有 WSL / Docker e2e 基礎設施）。

## 研究指引

- 先讀 T0421 / T0437 回報區（`_ct-workorders/_archive/workorders/`）與 `docs/agent-guide/multi-remote-profiles.md`、`remote-security.md`。
- 結論要「可決策」：每個問題給建議值與理由；列出需要使用者決定的事項（例如大小上限）。

## 預期產出（寫在回報區）

- 〈調查結論〉逐題回答
- 〈建議方向〉方案比較與推薦
- 〈建議下一步〉拆成實作工單（每張：範圍、`affects_files` 預估、規模 S/M/L、依賴、能否並行、驗收方式），以及需要使用者裁決的問題清單

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

**DONE**（研究完成；唯讀，只改本工單檔）

- **session_id**：4d341745-7346-47b3-97ed-61fdf3b25073
- 模式：`CT_MODE=yolo`、`CT_INTERACTIVE=0`
- **落點檢查**：PASS —— C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（REPO_ROOT=`D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 PASS；C-3 不適用（`affects_files` 只有本工單檔）；C-2 不適用（無 `branch`，HEAD=`main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_HOME` 未設（非 worktree）
- 證據分道：只有原始碼 / 文件閱讀與唯讀指令（含對內嵌 claude CLI 2.1.316 Windows 二進位做字串搜尋）。**沒有**跑 build / test、沒有連任何遠端主機、沒有實機驗證；以下凡標「推論」者皆未實測
- 工作樹另有其他 Worker 的未提交改動（T0827 / T0831 等），本單未碰；commit 只含本工單檔

### 互動紀錄

- 未向塔台提問（研究範圍內的選擇都能由程式碼與既有決策判斷；需使用者裁決的事項列在〈建議下一步〉末）

### 調查結論

#### 1. 現況盤點（附件從產生到送出）

| 來源 | 面板（Claude / Codex，兩者程式碼逐字相同） | 終端分頁 |
|---|---|---|
| 拖放非圖片 | `handleDrop` → `attachFile` → `addFileByPath(getPathForFile(file))`（`src/components/ClaudeAgentPanel.tsx:2285`、`:2226`） | `TerminalPanel.tsx:218` `handleDrop` → `insertFilePaths` → `buildTerminalDropInsertion`（`src/lib/terminal-drop.ts:56`），以引號路徑貼上（T0439） |
| 拖放 / 對話框 / 貼上的**圖片** | client 端讀成 data URL（T0436：`readFileAsDataUrl`、`dialog:select-attachments`、`clipboard:read-image-data-url`），隨 `claude:send-message` 第 3 個參數送出 | Ctrl+V 有圖片 → 送 CLI 的貼圖鍵 `imagePasteKey(client platform)`（`src/lib/terminal-paste.ts:42`、`TerminalPanel.tsx:248`），由 CLI 自己讀**它所在主機**的剪貼簿 |
| 對話框非圖片 | `dialog:select-attachments` 回傳路徑 → `addFileByPath` | — |
| **T0437 拒絕點** | `handleSend` 在清空輸入前呼叫 `resolveAttachmentPaths`（`ClaudeAgentPanel.tsx:1529`；`src/lib/client-paths.ts`）→ main `remote:resolve-client-paths`（`electron/main.ts:2857`，規則 `resolveClientPaths`，`electron/remote/path-translator.ts`）；不可達者 toast `claude.attachmentNotOnRemoteHost` 並移除 | 同一個 resolve（`buildTerminalDropInsertion` 內），不可達者 toast、不貼 |

- 不可達的情況（T0437 表）：SSH 一律（`ssh-local-file`）；WSL 其他 distro / 網路分享（`outside-wsl-distro`）；Docker 掛載外（`outside-docker-mounts`）。
- **Codex 面板同樣需要**：`handleSend` 與 Claude 面板同一套 `@` 前綴 + T0437 拒絕。另有前例：`electron/codex-agent-manager.ts:202` `dataUrlToTempFile` 在 **host 端**把 data URL 圖片落到 `os.tmpdir()/bat-codex-images/img-<時間>-<亂數>.<ext>`，回合結束 `unlink`（`:1351`）——即「內容先到 host、再給 agent 路徑」已在用，只是沒有權限 / 清理以外的治理。
- **終端分頁也需要**（工單問題 1 未列，但同一拒絕點）：SSH / Docker 掛載外的拖放現在被拒；SSH 視窗 Ctrl+V 貼圖必定失敗（見 6）。

#### 2. 傳輸通道

- 現況：WSS 只有 JSON 文字 frame（`RemoteFrame`，`electron/remote/protocol.ts`），server `maxPayload` = **32 MiB**（`electron/remote/remote-server.ts:126`），client（ws 8.20.0）未設、用預設 100 MiB；`RemoteClient.invoke` 預設逾時 30 s（`remote-client.ts:61`）；`sendFrame` 直接 `ws.send`，沒有 backpressure（`remote-server.ts:1154`）。server 對每個 message 各自 `await invokeHandler`，不排隊（`:751`）。
- **建議：沿用既有 invoke frame，新增 4 個 proxied channel，不加 binary frame**（binary frame 要動 helper / client / server 三端的協定解析，收益只有省 33% base64）：
  - `upload:begin({ sessionId, name, size })` → `{ uploadId }`（host 檢查配額、磁碟空間、建暫存目錄）
  - `upload:chunk(uploadId, offset, base64)` → `{ received }`（offset 必須等於已收位元組，否則拒；寫入用 append）
  - `upload:finish(uploadId, sha256)` → `{ serverPath }`（比對雜湊後 rename 成正式檔名）
  - `upload:abort(uploadId)` → 刪除部分檔
- **分塊 256 KiB（原始）**，base64 後約 342 KiB/frame，遠低於 32 MiB。理由：同一條 socket 也載 `pty:write` / 其他 invoke，TCP 有序 → 大 frame 造成鍵入延遲（head-of-line）。以 10 Mbit/s 的 SSH 連線估算，256 KiB ≈ 0.27 s，1 MiB ≈ 1.1 s（推論，未實測）。
- **一次只有 1 個 chunk 在途（stop-and-wait），等回應再送下一塊**：天然 backpressure，不需讀 `bufferedAmount`；也讓其他 invoke 能穿插。多檔依序上傳，不平行。
- 進度：client 端以已確認位元組回報（main → renderer 事件，本機 IPC，不經 WSS）。取消：client 停送並 `upload:abort`；連線中斷 → 該次上傳失敗，不續傳（host 端由逾時清理部分檔）。重試：只對單一 chunk 的 invoke 逾時重試 1 次（offset 檢查讓重送冪等），其餘失敗直接回報。
- 對既有連線的影響：每塊 ≤ 342 KiB + stop-and-wait，最壞是使用者鍵入多等一個 chunk 的傳輸時間；`RemoteClient` 的 heartbeat（`CLIENT_MAX_MISSED_HEARTBEATS` = 2 × 30 s）不受影響。
- **建議上限（需使用者確認）**：單檔 50 MiB、單次送出合計 100 MiB、每個 session 暫存配額 500 MiB、單次最多 10 檔（沿用 `MAX_FILES`）。理由：agent 的讀檔工具本來就讀不完超大檔；50 MiB 在 10 Mbit/s 約 40 s，可接受。

#### 3. 遠端暫存目錄

- **位置：`<dataDir>/uploads/<sessionId>/<uploadId>/<檔名>`**。headless 的 dataDir 是 `~/.local/share/bat-server`（Linux，`XDG_DATA_HOME` 優先）/ `%LOCALAPPDATA%\bat-server`（Windows）/ `~/Library/Application Support/bat-server`（macOS）（`electron/remote/dataDir.ts`）。不用 `$TMPDIR`：`/tmp` 多人共用、可能 noexec / tmpfs 容量小，且 systemd `PrivateTmp` 會讓 agent 與 server 看到不同的 `/tmp`（推論）。Docker：dataDir 在容器內，agent 也在容器內，一致。
- **檔名**：每次上傳一個獨立目錄 `<uploadId>`（server 產生，`crypto.randomBytes(8)` hex），裡面保留**原檔名**（agent 看得到有意義的名字）。檔名只取 basename，去掉 `/` `\` NUL 與控制字元、`.` / `..` 改成 `file`、Windows 保留名與結尾的點 / 空白處理、長度上限 120 字元（保留副檔名）。`sessionId` 走專案白名單 `/^[a-zA-Z0-9._-]+$/`（CLAUDE.md「Child Process Spawning」的外部輸入規則），不符即拒。寫入用 `<檔名>.part`，finish 時 rename；所有路徑 `path.resolve` 後確認仍在 `<dataDir>/uploads/` 之下。
- **權限**：POSIX 目錄 0700、檔案 0600（`mkdir({ mode })` + `open(…, 'wx', 0o600)`，不受 umask 放寬）；Windows host 依 `%LOCALAPPDATA%` 的 ACL。
- **清理**（三層）：① 面板關閉 / `claude:dispose-session`（`electron/handlers/claude.ts:231`）→ 刪該 session 目錄；② server 啟動時與每小時掃一次：刪除超過 **24 h** 的上傳、超過 10 分鐘未 finish 的 `.part`；③ 配額：超過每 session 500 MiB 時 `upload:begin` 拒絕（不自動刪舊的，避免刪掉 agent 還要讀的檔）。不採「回合結束即刪」（Codex 圖片的做法）：agent 之後的回合可能再讀同一檔。
- **磁碟滿**：`upload:begin` 以 `fs.statfs`（Node ≥ 18.15；server 的 bundled node 為 24）檢查可用空間 ≥ 檔案大小 + 64 MiB 保留，否則回 `NO_SPACE`；寫入遇 `ENOSPC` → 刪部分檔、回錯誤；client 端 toast 並退回 T0437 的拒絕。

#### 4. 安全

- **誰能呼叫**：只有 RemoteServer 的 client 連線（server token）。helper 權杖的角色表 `HELPER_CHANNEL_ROLES`（`electron/remote/helper-capability.ts:390`）預設拒絕，新 channel 不列入 → helper / PTY 內程式呼叫不到。持 server token 的 client 本來就能 `pty:write`（等同執行任意指令），上傳不增加權限。
- renderer 端：**不新增「main 讀任意 renderer 給的路徑」的入口**（T0436 的原則）。三種來源分開：拖放 → renderer 用手上的 `File` 物件 `slice()` 分塊交給 main；對話框 → main 自己選的路徑由 main 讀；剪貼簿圖片 → main 讀剪貼簿。client 端 IPC 是本機 `ipcMain.handle`（不在 `PROXIED_CHANNELS`，比照 T0436 的 `dialog:select-attachments`），由 main 依視窗綁定的 profile 轉送到對應 `RemoteClient`。
- **path sandbox（T0406）**：暫存目錄**不加進** `workspace:sync-roots`。sandbox 只管 BAT 自己的 `fs:*` / `image:read-as-data-url`（檔案樹、預覽，`electron/handlers/fs.ts:54`），agent 讀檔走它自己的工具、不受 roots 限制；加進 roots 反而讓檔案樹 / 預覽能讀所有 session 的上傳。
- channel 分類：4 個 channel 都放 `PATH_FREE_CHANNELS`（參數是檔名與資料、不是 client 路徑；**回傳的 `serverPath` 不得被 `toClient` 正規化**，因為它要原樣進 prompt），並通過既有 parity / path coverage / binding 守門。
- 日誌：只記 uploadId、session 前 8 碼、大小、副檔名、結果；**不記檔名與內容**（檔名可能含個資）。
- 揭露：遠端路徑只進 prompt（`@<serverPath>`），面板顯示仍用原檔名；路徑含遠端家目錄，與 agent 已知的 cwd 同等級。

#### 5. 各遠端類型

| 類型 | 規則 |
|---|---|
| WSL 同 distro / `C:\…`（`/mnt/c`） | 照舊直接轉譯（T0437），**不上傳** |
| WSL 其他 distro、網路分享 UNC | 上傳（client 讀得到 UNC，host distro 讀不到） |
| Docker 掛載內 | 照舊用容器路徑，**不上傳** |
| Docker 掛載外 | 上傳 |
| SSH | 一律上傳（T0421 Q1：home 對應不保證是同一檔） |
| 本機視窗 / legacy Identity profile | 不上傳，行為不變（T0437 遭遇問題 1 的殘留風險維持） |

判斷點直接沿用 `resolveClientPaths` 的 `reason`：有 reason（不可達）才上傳；上傳失敗、超過上限、舊 bat-server 沒有 `upload:*` handler → 退回現行的拒絕 + toast。

#### 6. Alt+V 貼圖

- 內嵌 claude CLI 2.1.316（Windows 二進位字串）的剪貼簿圖片讀法：linux `xclip -selection clipboard -t image/png -o … || wl-paste --type image/png …`（先以 `TARGETS` / `wl-paste -l` 檢查）；win32 用 `powershell … [System.Windows.Forms.Clipboard]::GetImage()`；同一段程式另有 `"$(command -v powershell.exe 2>/dev/null || echo /mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe)"`，**推論** Linux 版在 WSL 會經 interop 讀 Windows 剪貼簿（Linux 二進位未安裝，未查證；T0524 註解也記 CLI 對 `wsl` 綁 `alt+v`）。
- ⇒ **WSL 視窗**：CLI 很可能讀得到 Windows 剪貼簿，現行送 `\x1bv` 應可用，**需實機確認**，暫不改。**SSH 視窗**：CLI 讀的是遠端主機的剪貼簿（多半沒有 X / Wayland），必定失敗；而且 `imagePasteKey` 依 **client** 平台送 Alt+V，Linux CLI 綁的是 Ctrl+V，按鍵本身也不對。**Docker**：同 SSH。
- **BAT 攔截 CLI 讀剪貼簿：不可行**（CLI 自己 spawn xclip / wl-paste，BAT 沒有掛勾點；假造 xclip 進 PATH 太脆弱，否決）。
- **可行做法**：SSH / Docker 視窗的 Ctrl+V 遇到圖片 → main 讀 client 剪貼簿 PNG → 經同一上傳通道 → 以引號路徑貼進終端（和拖放一樣）。CLI 2.1.316 有 `/\.(png|jpe?g|gif|webp)$/i` 的「貼上的文字是圖片路徑」判斷（同一段程式），推論會轉成圖片附件；需實機確認。codex CLI 收到的是路徑文字，與拖放相同。風險：終端分頁沒有「session 關閉」的時機 → 用 PTY id 當 session key，分頁關閉時刪，另有 24 h TTL。

#### 7. 測試策略

- **單元（vitest，`electron/__tests__/`）**：host 端暫存模組（檔名清理表、路徑穿越、offset 不連續、雜湊不符、配額、`statfs` 不足、ENOSPC 模擬、TTL 掃描、dispose 刪除、0700 / 0600（POSIX only `it.skipIf(win32)`））；client 端分塊器（stop-and-wait、重試 1 次、取消、舊 server 無 handler → 退回拒絕）；channel 分類守門（parity / path coverage / binding、不在 `HELPER_CHANNEL_ROLES`、回傳不經 `normalizePathsInResult`）。
- **RTL（`src/__tests__/`）**：兩面板 × {全可上傳、部分超過上限、上傳失敗退回 toast、取消}；終端 drop / Ctrl+V 在 SSH 型視窗走上傳。
- **協定層 smoke**：`scripts/smoke-remote-headless.mjs` 加 S14（真 headless server + WSS + temp dataDir：上傳、權限、dispose 清理、未認證 / helper 權杖被拒）。
- **e2e（需真人或 CI 容器）**：`e2e/real-remote/` 已有 sshd / server Dockerfile（t0510 / t0514 / t0520 / t0663）可做 SSH 上傳；Docker 掛載外用 `t0743` 系列；WSL 其他 distro 與 Alt+V 只能實機（`t0550-wsl-acceptance.spec.ts` 是現成骨架）。

### 建議方向

| 方案 | 說明 | 優點 | 缺點 | 結論 |
|---|---|---|---|---|
| **A. WSS invoke 分塊（推薦）** | 4 個 proxied `upload:*` channel，256 KiB stop-and-wait | 三種遠端同一路徑；沿用既有認證、權杖、日誌、守門；headless 與本機共用 handler | base64 多 33%；大檔佔用同一條 socket | ✅ |
| B. 各類型原生工具 | SSH `scp`（`ssh-bundle-uploader.ts` 已有）、WSL 直接寫 `\\wsl.localhost\…`、Docker `docker cp` | 不佔 WSS、速度快 | 三套程式與錯誤處理；SSH 要另外認證 / known_hosts；Docker 要 docker CLI；權限與清理各自實作 | ❌ |
| C. WSS 新增 binary frame | 協定加 `upload-chunk` binary 類型 | 省 base64 | 動到 helper / client / server 的 frame 解析，風險面大 | ❌（日後有效能需求再評估） |
| D. 維持 T0437 拒絕 | 不做 | 零風險 | 問題不解決 | 若使用者不需要可選 |

上傳時機推薦「**送出時上傳**」（附件 chip 顯示進度、送出鍵在上傳期間停用、可取消），不採「附加時就上傳」：後者會上傳使用者之後又移除的檔，還要追蹤清理。不加 Settings 開關：失敗一律退回現行拒絕，行為只多不少。

另外發現（**推論，未重現**）：`claude:send-message` 把所有圖片 data URL 放在同一個 invoke frame；面板上限 5 張 × 10 MB，base64 後最多約 67 MB，**超過 server 的 32 MiB `maxPayload`**，ws 會以 1009 關閉連線（約 3 張接近 10 MB 的圖就會超過）。與本 PLAN 同屬「遠端大內容傳輸」，建議塔台另開 BUG 先重現；修法可在遠端視窗限制圖片合計大小，或讓圖片也走上傳通道。

### 建議下一步

| # | 工單 | 範圍 | `affects_files` 預估 | 規模 | 依賴 | 並行 | 驗收 |
|---|---|---|---|---|---|---|---|
| 1 | host 端暫存與 `upload:*` channel | 暫存模組（位置 / 檔名 / 權限 / 配額 / statfs / TTL / dispose 清理）、4 個 channel、分類、契約寫進工單「介面契約」 | `electron/upload-staging.ts`（新）、`electron/handlers/uploads.ts`（新）、`electron/handlers/claude.ts`（dispose 掛勾）、`electron/remote/protocol.ts`、`electron/remote/path-aware-channels.ts`、headless 註冊點（`electron/remote/headless-entry.ts` / `headless-handlers.ts`）、`electron/main.ts`（本機 host 註冊）、`electron/__tests__/**`、`scripts/smoke-remote-headless.mjs`、`docs/agent-guide/remote-file-upload.md`（新）、`CLAUDE.md` 一節 | M | — | 否（先做，定契約） | 單元 + smoke S14；`npm run typecheck:electron` = 0 |
| 2 | client 端上傳驅動 | main 本機 IPC（File 分塊 / 對話框 / 剪貼簿三來源）、依視窗 profile 轉送、stop-and-wait、重試、取消、進度事件、舊 server 偵測 | `electron/upload-client.ts`（新）、`electron/main.ts`、`electron/preload.ts`、`src/types/electron.d.ts`、`src/lib/remote-upload.ts`（新）、`electron/__tests__/**` | M | 1 | 否 | 單元；兩個 typecheck = 0 |
| 3 | 面板接線 | Claude / Codex `handleSend`：不可達 → 上傳 → `@<serverPath>`；chip 進度、取消、失敗退回 toast；i18n | `src/components/ClaudeAgentPanel.tsx`、`CodexAgentPanel.tsx`、`src/lib/client-paths.ts`、`src/locales/{en,zh-TW,zh-CN}.json`、`src/__tests__/**` | M | 2 | 可與 4 並行（locales 會衝突，需合併時注意，或序列） | RTL；`npm run typecheck` = 0；本機視窗回歸（附件照舊） |
| 4 | 終端接線 | SSH / Docker 掛載外 / 其他 distro 的拖放改上傳後貼路徑；SSH / Docker 視窗 Ctrl+V 圖片改上傳 PNG 後貼路徑；WSL 維持貼圖鍵；分頁關閉刪暫存 | `src/components/TerminalPanel.tsx`、`src/lib/terminal-drop.ts`、`src/lib/terminal-paste.ts`、`src/locales/*`、`src/__tests__/**` | S–M | 2 | 見 3 | RTL / 單元 |
| 5 | 實機驗收 | SSH（`e2e/real-remote` sshd 容器）、Docker 掛載外、WSL 其他 distro、WSL Alt+V 現況確認、SSH Ctrl+V 貼圖 | `e2e/**`（新 spec）、本工單回報 | M | 3、4 | 否 | e2e + 使用者實機清單 |
| — | （另案 BUG 候選）多張大圖超過 32 MiB frame | 先重現再決定修法 | — | S | — | 可 | 重現證據 |

**需要使用者裁決**：

1. 大小上限：建議單檔 50 MiB、單次送出合計 100 MiB、每 session 配額 500 MiB。
2. 保留時間：建議「session / 分頁關閉即刪 + 24 h TTL」（另一選項：回合結束即刪，省空間但 agent 之後無法再讀）。
3. 上傳時機：建議「送出時上傳」（另一選項：附加時上傳）。
4. 是否包含終端（工單 4），特別是 SSH / Docker 視窗 Ctrl+V 貼圖改成上傳後貼路徑。
5. 是否要 Settings 開關：建議不加，失敗退回 T0437 拒絕。
6. 是否另開 BUG 處理「多張大圖超過 32 MiB frame」。

### Renew 歷程

（無）

### 遭遇問題

1. 內嵌 claude CLI 只有 Windows 平台子套件；Linux 版在 WSL 是否經 `powershell.exe` 讀 Windows 剪貼簿，是從 Windows 二進位內的同一段字串推論，未查證 Linux 二進位、未實機。
2. 傳輸延遲數字（10 Mbit/s 下每塊秒數）為估算；agent（claude / codex）讀工作區外的 `@` 路徑是否需要額外權限，與本機視窗附加工作區外檔案的現況相同，未另行查證。
3. 研究指引列的 `docs/agent-guide/multi-remote-profiles.md`、`remote-security.md` 未逐字通讀，改以 CLAUDE.md 對應節與原始碼為準。

### 回報時間

2026-11-04T09:00:49+0800
