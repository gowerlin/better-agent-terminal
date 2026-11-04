---
schema_version: 1
schema_kind: workorder
id: T0836
title: "PLAN-038 U5：遠端上傳 e2e 與實機驗收清單（SSH sshd 容器、Docker 掛載外、WSL 其他 distro、WSL Alt+V 現況、SSH Ctrl+V 貼圖）"
type: verification
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-04T09:17:09+0800"
started_at: "2026-11-04T12:15:17+0800"
updated_at: "2026-11-04T12:33:40+0800"
completed_at: "2026-11-04T12:33:40+0800"
session_ids:
  - "4dd02e8c-d0da-4b86-9b2b-a7a1830065d7"
depends_on: [T0834, T0835]
related:
  - "PLAN-038；D272；T0828 回報區（〈調查結論〉7，〈建議下一步〉第 5 列）；`e2e/real-remote/`（t0510 / t0514 / t0520 / t0663 的 sshd / server Dockerfile）、`t0743` 系列、`t0550-wsl-acceptance.spec.ts`"
affects_files:
  - _ct-workorders/T0836-remote-upload-e2e-acceptance.md
  - e2e/
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只新增 e2e spec 與驗收紀錄，不改產品程式；發現缺陷寫進回報區〈發現的問題〉由塔台開 BUG，不在本單修。"
  - "🔴 e2e 一律隔離 runtime；不碰本機 BAT 安裝版與它的 Terminal Server、不連真實遠端主機（只用本機容器）；不動使用者既有的 WSL 發行版（WSL 其他 distro 的情境若需要新發行版，列進〈待實機驗收〉交使用者）。"
  - "🔴 yolo：不得問使用者；問題問塔台。不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0836 — PLAN-038 U5：e2e 與實機驗收

## 元資料
- **工單編號**：T0836｜**類型**：verification｜**狀態**：DONE｜**建立**：2026-11-04 09:17 (UTC+8)
- **依賴**：T0834、T0835｜**規模**：M

## 任務指令

1. 以 `e2e/real-remote/` 的 sshd / server 容器寫 e2e：SSH 視窗 Claude 面板附加本機檔 → 遠端暫存檔存在、內容雜湊相同、權限 0600、prompt 內是遠端路徑；面板關閉後暫存被刪；超過 50 MiB 退回拒絕。
2. Docker 掛載外附件、終端拖放、SSH Ctrl+V 貼圖：能自動化的寫 e2e，不能的列〈待實機驗收〉步驟（照 `work-order-template.md` § 撰寫 verification 工單的驗收步驟，分頁以標題描述）。
3. WSL Alt+V 現況（T0828 推論可用）：列成使用者實機確認步驟。
4. 回報區列出每項 PASS / FAIL / 待實機，附指令與輸出。
5. **塔台補充（開工前併入，來自 T0834 / T0835 回報）**：另列入驗收或〈待實機驗收〉——
   - SSH 視窗終端分頁 Ctrl+V 貼圖上傳後，claude CLI 是否把貼上的 `.png` 路徑認成圖片附件（T0828 推論）；codex CLI 收到路徑文字。
   - 終端分頁關閉後 10 s（`PTY_UPLOAD_DISPOSE_GRACE_MS`）暫存被刪、⏻ 重啟保留（T0835）。
   - 面板上傳中：進度、送出鍵停用、取消保留草稿（T0834）。
   - 已知不支援（只確認提示正確，不算 FAIL）：macOS Finder 複製的檔案貼進終端（T0435 / T0436 原則，照舊 T0437 拒絕）。
   - BUG-211（T0842）：遠端視窗附 3 張 > 8 MiB 圖片 → 提示、不送出、連線不斷；2 張照常 —— 能自動化就寫進 e2e，否則列〈待實機驗收〉。

### 驗收條件
- [ ] 新 e2e spec 在本機可跑通（附輸出）；`npm run test:unit` 不受影響
- [ ] 〈待實機驗收〉清單可直接交給使用者執行

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **狀態**：DONE（兩項驗收條件都達成；能自動化的 12 項全部 PASS，6 項列〈待實機驗收〉）
- **產品 commit**：`d99eac4c`（只新增 `e2e/t0836-remote-upload-acceptance.spec.ts`，不改產品程式）
- **落點檢查**：PASS。C-0 frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 `e2e/` 存在；C-2 無 `branch` 欄位。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`CT_HOME` 未設定（不隔離）
- **模式**：`CT_MODE=yolo`、`CT_INTERACTIVE=0`
- **session_id**：4dd02e8c-d0da-4b86-9b2b-a7a1830065d7

### 產出摘要

新增 `e2e/t0836-remote-upload-acceptance.spec.ts`（opt-in：`BAT_E2E_T0836=1`）。環境沿用 T0763 的做法（T0763 spec 未改）：

- 測試 server：WSL `Ubuntu-24.04` 內已安裝的 bundle（0.7.3-pre.3）唯讀複製到 `/tmp/bat-e2e-t0836/install`，再蓋上本 repo 的 headless JS 與 helper（確認含 `upload:begin` handler），`env -i`、HOME 是暫存目錄、每個程序帶 `T0836_E2E_TAG`。
- SSH：`apt-get download openssh-server` 解開後以一般使用者起臨時 sshd（127.0.0.1、隨機 port）；隔離實例 PATH 最前面放 `e2e/real-remote/t0763-ssh-shim.go`（真的 ssh 加 `-F none`、暫存 known_hosts），不讀寫使用者 `~/.ssh`。ssh-linux profile 視窗確實走 BAT 的 `ssh -N -L` tunnel。
- Docker：WSL Docker 起 `bat-e2e-t0836-server`（本機既有 `debian:bookworm-slim`，沒有 pull；label `bat.t0836=1`；只綁 127.0.0.1），docker-linux profile、沒有掛載（所有本機檔都在掛載外）。
- 在 main 端記錄 `claude:send-message` 的 prompt 與圖片數，再原樣轉給遠端（不呼叫模型：遠端 claude 沒有憑證）；檔案對話框在 main 端換成固定回傳；②的剪貼簿只在隔離實例 main 端替換 `clipboard.read()`，**不讀寫系統剪貼簿**。

**執行指令**（`npx vite build` 之後）：

```
$env:BAT_E2E_T0836='1'
npx playwright test e2e/t0836-remote-upload-acceptance.spec.ts
```

**最終一輪輸出**（2026-11-04 12:29:47 → 12:30:38 +0800，`3 passed (50.0s)`，exit 0；檔名中的標記字串以 `<mark>` 表示）：

| # | 項目 | 結果 | 證據 |
|---|---|---|---|
| ①a | SSH 面板：單檔 > 50 MiB 退回 | PASS | 50 MiB + 1 B → toast「此檔案不在遠端主機上，未附加：<file> 上傳到遠端主機失敗：<file> (超過單檔 50 MiB 上限)。」，chip 移除，沒有 `claude:send-message`，host `uploads/` 0 筆；client 日誌 `prepare … refused=1`、`[attachments] upload: files=1 ok=0 failed=1 codes=TOO_LARGE` |
| ①b | 面板上傳中：進度、送出停用、取消保留草稿（T0834） | PASS | 49 MiB 檔：顯示「上傳中 1%」，送出鍵 `disabled`、輸入框 `readOnly`、「+」隱藏、chip × 變「取消上傳（不送出）」→ 點擊 → toast「已取消上傳，沒有送出；訊息與附件都保留。」，草稿與 chip 保留、沒有送出；host 日誌 `[upload] abort id=… received=3670016 result=ok`，該 session 暫存為空 |
| ①c | SSH 面板附加本機檔 → 遠端暫存、雜湊、權限、prompt | PASS | 拖放（`file` 來源，307207 B，檔名含空白與中文）＋對話框（`path` 來源，1048579 B）→ prompt = `@/tmp/bat-e2e-t0836/ssh/data/uploads/<session>/<id>/t0836 拖放 <mark>.txt` / `@…/<id>/t0836-dialog-<mark>.log` / 空行 / 文字；prompt 不含任何本機路徑；server 端 `stat` + `sha256sum`：兩檔都是 `600 <size> <sha256 = 本機>`，upload / session / uploads 目錄 `700 700 700`；invoke 結果 `true` |
| ①d | BUG-211（T0842）：3 張 > 8 MiB 圖片 → 提示不送出、連線不斷；2 張照常 | PASS | 3 × 9.0 MiB → toast「遠端視窗的圖片太大：已附 27.0 MiB，每則訊息最多 20.0 MiB。訊息未送出，輸入與附圖已保留；…」，沒有送出、3 張圖與文字保留、仍連線；移除 1 張 → `claude:send-message` 帶 2 張圖（data URL 25166060 字元）經 WSS 送到 host，結果 `true`（沒有 FRAME_TOO_LARGE），2 s 後仍連線 |
| ①e | 面板關閉後暫存刪除 | PASS | 關閉 Claude Agent 分頁 → `claude:dispose-session` → `uploads/<session>` 不存在；host 日誌 `[upload] dispose session=89eb7464 result=ok` |
| ②a | SSH 終端拖放 | PASS | 先打 `printf "t0836-drop "; sha256sum `，拖放後分頁出現 `'/tmp/bat-e2e-t0836/ssh/data/uploads/e2e-t0836-ssh-shell/<id>/t0836 終端 <mark>.bin'`（單引號、沒有 Enter），按 Enter 後 server 端 sha256 = 本機、mode 600 |
| ②b | SSH 終端 Ctrl+V 貼圖 | PASS | 剪貼簿圖片（70 B PNG，main 端替身）→ Ctrl+V → 打出 `/tmp/bat-e2e-t0836/ssh/data/uploads/e2e-t0836-ssh-shell/<id>/clipboard-20261104-123007.png`，sha256 = 本機；日誌 `[terminal-paste] Ctrl+V → image terminal=e2e-t0836-ssh-shell`、`[terminal-paste] image upload terminal=e2e-t0836-ssh-shell: ok size=70` |
| ②c | ⏻ 重啟保留暫存（T0835） | PASS | ⏻ → 確認對話框 → shell pid 5175 → 5422（真的重啟）；13 s 後暫存內容與重啟前相同（6 筆） |
| ②d | 終端分頁關閉後 10 s 刪除（`PTY_UPLOAD_DISPOSE_GRACE_MS`） | PASS | 關閉分頁後 +5 s 仍在，約 10.6 s 消失（斷言 ≥ 10 s、≤ 30 s）；host 日誌 `[upload] dispose session=e2e-t083 result=ok` |
| ③ | Docker 掛載外附件（面板） | PASS | 拖放 716805 B → prompt `@/var/lib/bat-e2e-t0836/uploads/<session>/<id>/t0836-docker-<mark>.csv`；`docker exec` 內 `600 716805 <sha256 = 本機>`、目錄 `700 700 700`；關閉分頁 → 暫存刪除 |
| 日誌 | 檔名不進日誌（T0832 C-10） | PASS | 隔離實例 debug log、SSH server log、container log 都不含檔名中的標記字串；debug log 不含測試權杖 |
| 環境 | 不碰使用者環境 | PASS | 前後比對 12 項都 `same`：WSL 家目錄、`~/.local/bat-server`、systemd units、`bat-server.service`（MainPID 348，active）、帶標記程序 0、`/tmp/bat-e2e-t0836` absent、非 `bat-e2e-t0836-` 容器（id／狀態／啟動時間／重啟次數）、容器數、映像清單、Windows `~/.ssh`；收尾 `bat-e2e-t0836-server: removed`、`tagged after: 0`、`removed /tmp/bat-e2e-t0836`、Windows 暫存目錄已刪 |

**`npm run test:unit`**：`Test Files 2 failed | 428 passed | 3 skipped (433)`、`Tests 2 failed | 7549 passed | 40 skipped (7591)`。兩個失敗都與本單無關：

- `src/components/setup-wizard/__tests__/pick-wsl-distro.test.ts` › AC-2 #4
- `src/components/setup-wizard/__tests__/step-error-i18n.test.tsx` › pick-wsl-distro with only WSL 1 distros

它們測的 `src/components/setup-wizard/steps/wsl/pick-wsl-distro.ts` 在工作樹裡有**別的工單（T0840）尚未提交的改動**（`git diff --stat`：20 insertions / 22 deletions）。本單只新增 `e2e/` 下的檔，vitest 的 `test.include` 不收 `e2e/`，所以 `test:unit` 不受本單影響。

### 發現的問題

沒有產品缺陷。一個 UX 觀察（低優先，是否開單由塔台決定）：

- 單檔超過 50 MiB 時，面板 toast 先講「此檔案不在遠端主機上，未附加：<file>」（T0437 的句子），後面接「上傳到遠端主機失敗：<file> (超過單檔 50 MiB 上限)」。檔名出現兩次，而且真正原因是大小上限，第一句容易讓人以為是路徑問題。這是 docs「T0437 的句子後面接原因」的既定行為，不是回歸。

### 待實機驗收

以下 6 項需要真的模型、第二個 WSL 發行版或 macOS client，無法在隔離 e2e 內完成。前提：安裝含 T0832–T0835、T0842 的 BAT，遠端主機的 bat-server 也升到同版。

1. **SSH 視窗終端 claude CLI 把貼上的 `.png` 路徑認成圖片**（T0828 推論）
   1. 開一個 SSH profile 視窗，「+」→ Claude CLI，開出 `Claude CLI` 分頁，等 claude 進入對話畫面。
   2. 在 Windows 複製一張截圖（Win+Shift+S）。
   3. 在 `Claude CLI` 分頁按 Ctrl+V。
   - 預期：分頁右上角短暫顯示「正在上傳到遠端主機… N%」，輸入列出現 `/…/uploads/<分頁 id>/<id>/clipboard-….png` 路徑。
   - 要記錄：claude 是否把它變成 `[Image #1]`（或類似的圖片附件標示）；送出「這張圖是什麼？」後回答是否描述了截圖內容。只出現路徑文字、claude 沒當成圖片 → 記為 FAIL 並附畫面。
2. **SSH 視窗 codex CLI 收到路徑文字**
   1. 同一個 SSH 視窗，「+」→ Codex CLI，開出 `Codex CLI` 分頁。
   2. 複製截圖，在 `Codex CLI` 分頁按 Ctrl+V。
   - 預期：輸入列出現同樣格式的 `.png` 遠端路徑（文字）。送出「讀這個檔案並描述」後，codex 能讀到該檔（回答提到圖片或檔案大小）。
3. **WSL Alt+V 現況**（T0828 推論可用；WSL 視窗不上傳，照舊送貼圖鍵）
   1. 開一個 WSL profile 視窗，「+」→ Claude CLI，開出 `Claude CLI` 分頁（claude 跑在 WSL 內）。
   2. 複製截圖，在 `Claude CLI` 分頁按 Ctrl+V（BAT 會送 Alt+V 給 CLI）。
   - 預期：**不**出現上傳提示；claude 自己經 interop 讀 Windows 剪貼簿，輸入列出現 `[Image #1]`。
   - 若沒有圖片附件：再在同一分頁直接按 Alt+V 一次，記錄兩次結果（區分是 BAT 的問題還是 CLI 讀不到剪貼簿）。
4. **WSL 其他 distro 的附件**（需要第二個 WSL 發行版；本單依規定不建立）
   1. 準備一個不是 bat-server 所在的發行版（例 `Debian`），在它裡面放一個檔：`\\wsl$\Debian\home\<你>\t0836-other.txt`。
   2. 在連到 `Ubuntu-24.04` bat-server 的 WSL 視窗，「+」→ Claude Agent，開出 `Claude Agent` 分頁，把那個檔從檔案總管拖進面板，輸入「讀這個檔」送出。
   - 預期：chip 顯示「上傳中 N%」後送出；回覆中引用的路徑是 `…/uploads/<session>/<id>/t0836-other.txt`；claude 讀得到內容。
   - 對照：同一視窗拖一個 `C:\` 下的檔（`/mnt/c` 可達）→ **不**上傳，prompt 裡是 `/mnt/c/…` 路徑。
5. **macOS Finder 複製的檔案貼進遠端終端**（已知不支援，只確認提示正確，不算 FAIL）
   1. macOS client，開一個 SSH profile 視窗，`Terminal` 分頁。
   2. 在 Finder 選一個檔，⌘C，回到 `Terminal` 分頁按 ⌘V。
   - 預期：不上傳、不貼任何路徑，出現 toast「此檔案不在遠端主機上，未附加：<檔名>」。
6. **真實拖放與真實 agent 讀檔**（e2e 用的是合成 DragEvent 加真檔案，模型不參與）
   1. 在 SSH 或 Docker profile 視窗開 `Claude Agent` 分頁，從 Windows 檔案總管實際拖一個 1–5 MiB 的文字檔進面板，輸入「這個檔案第一行是什麼？」送出。
   - 預期：送出前 chip 顯示「上傳中 N%」，claude 的回答是檔案的第一行。
   2. 關閉該分頁，到遠端主機執行 `ls ~/.local/share/bat-server/uploads/`（Docker：`docker exec <容器> ls <dataDir>/uploads/`）。
   - 預期：該 session 的目錄已不存在。

### 互動紀錄
- [12:15] 開工，`CT_MODE=yolo`、`CT_INTERACTIVE=0`；沒有向塔台提問。
- [12:24] 實跑（時間取自隔離實例 debug log 的 `04:24:41Z`）：① PASS，② Ctrl+V 失敗、③ 未執行。在這之前的一次執行全部 skipped（時間未記錄）：WSL `Ubuntu-24.04` 已因閒置停止，spec 與 T0763 一樣不自己啟動發行版；之後以一個 `sleep`（另一個環境變數標記，不算進測試的帶標記程序）維持發行版執行，全部跑完後結束它。
- [12:28] ② 失敗原因：Playwright `keyboard.press('Control+V')` 送出的 `event.key` 是 `'V'`，TerminalPanel 比對 `'v'`（加診斷確認 main 端剪貼簿替身有效、只是按鍵沒觸發）。改成 `Control+v`（與 T0524 spec 相同）後 ②③ PASS（debug log `04:28:32Z`）。是測試寫法問題、不是產品缺陷。
- [12:29] 補強證據（⏻ 前後 shell pid、等 send 回應後再記錄）後跑完整一輪：3 passed（12:29:47 → 12:30:38）。

### 遭遇問題
- e2e 用的 `dist-electron` 是在工作樹含 T0840 未提交改動（WSL wizard 相關：`electron/main.ts`、`preload.ts`、`wsl-*.ts`、`setup-wizard/**`、locales）時 `npx vite build` 的。上傳路徑不經那些程式，但嚴格說本單 e2e 驗的是「HEAD + T0840 工作中改動」的 build。工作樹不屬於本單，依規定不 stash / restore；T0840 提交後若要乾淨證據，重跑上面的指令即可（約 1 分鐘）。
- `npm run test:unit` 的 2 個失敗見〈產出摘要〉，屬 T0840 的未提交改動。

### 回報時間
2026-11-04T12:33:40+0800
