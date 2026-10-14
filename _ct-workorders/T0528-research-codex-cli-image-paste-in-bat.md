---
schema_version: 1
schema_kind: workorder
id: T0528
title: "研究：BAT 終端分頁裡的 Codex CLI 能否貼圖 / 貼檔案（pre.8 的貼圖轉送鍵是 claude CLI 的 Alt+V（Windows），Codex 提示是 Ctrl+V）"
type: research
status: PENDING
repo: better-agent-terminal
project: BUG-130
priority: P2
sizing: S
created_at: "2026-10-14T17:22:38+0800"
started_at: ""
updated_at: "2026-10-14T17:22:38+0800"
completed_at: ""
related:
  - BUG-130
  - BUG-128
  - "T0524（終端貼上統一規則：檔案 → 路徑、圖片 → 送 CLI 貼圖鍵、文字 → 一般貼上）"
affects_files:
  - _ct-workorders/T0528-research-codex-cli-image-paste-in-bat.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **只讀不改產品程式碼**：本單是實測 + 建議；需要修正時在回報區給方案，由塔台另開實作單。"
  - "🔴 **剪貼簿是使用者共用的**：實測要寫入系統剪貼簿時，先存下原內容、測完還原，且整段測試盡量短；不要在使用者的 BAT（port 9876）分頁裡測，一律用隔離實例（e2e 隔離 runtime）或 BAT 外的獨立終端。"
  - "🔴 **不得送出任何 prompt 給 Codex / Claude**（只觀察 composer 是否出現附件 `[Image #1]` 之類，然後 Ctrl+C / Esc 離開），不消耗 token。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push。`src/styles/settings.css` 的 M 狀態不是你的變更，不要 commit 它；commit 用 `--only`。"
  - "🔴 時間戳一律取自系統（R-G001）。"
---

# T0528 — 研究：BAT 裡的 Codex CLI 貼圖 / 貼檔案

## 研究目標

使用者想知道 Codex CLI 是否也支援貼上圖片或檔案連結，並特別要確認**在 BAT 終端分頁裡**是否可用。

塔台初查（本機 `codex-cli 0.162.1`，`C:\Users\Gower\AppData\Local\Programs\OpenAI\Codex\bin\codex.exe` 字串）：
- Codex TUI 內建貼圖：`Paste an image with \`Ctrl+V\` to attach it to your next message.`、keymap `fixed.paste_image`、`tui\src\clipboard_paste.rs`、`clipboard image opened from file` / `from image`（剪貼簿是圖片檔也可）、`paste_image_as_png`
- 檔案引用：keymap `fixed.file_paths`、說明「Mention files」（composer 以 `@` 搜尋檔案路徑）
- 啟動參數：`codex -i, --image <FILE>...`（附在第一個 prompt）

**落差**：T0524（pre.8）的終端貼上規則在剪貼簿是圖片時，**送 claude CLI 的貼圖鍵：Windows 為 Alt+V，macOS / Linux 為 Ctrl+V**。Codex 的提示是 Ctrl+V。第三方資料提到 Codex 在原生 Windows 加過 Alt+V 偵測，但未在官方文件確認。⇒ 在 Windows 的 BAT 分頁跑 Codex 時，pre.8 送出的 Alt+V 可能不會觸發 Codex 貼圖。

## 調查範圍

1. **Windows 實測**（本機）：在**隔離的 BAT 實例**（或 BAT 外的獨立終端作為對照）啟動 `codex`，剪貼簿放一張 PNG：
   - (a) 直接按 Ctrl+V（BAT 外的對照組，以及 BAT 內若可繞過 T0524 的轉送）
   - (b) BAT 內依 T0524 規則按 Ctrl+V（實際送給 PTY 的是 Alt+V）
   - (c) 直接送 Alt+V
   - (d) 檔案總管「複製」一個 PNG 檔後在 BAT 內 Ctrl+V（T0524：檔案 → 貼路徑；Codex 收到路徑後是否會當附件？）
   - (e) 非圖片檔（例如 `.md`）複製後貼上 → 路徑；以及 composer 內 `@` 檔案搜尋是否可用
   - 每種情況記錄：composer 是否出現圖片附件、或只出現文字 / 路徑、或沒反應
2. **讀 T0524 的實作**（只讀）：貼圖轉送鍵是否依分頁的 agent preset 或前景程式區分？Codex CLI preset 分頁與一般分頁裡手動執行 `codex` 各自走哪條路？
3. **mac / Linux**：無法實測；依程式碼與 Codex 的 Ctrl+V 提示推論 pre.8 在 mac / Linux 是否可用（T0524 在 mac / Linux 送 Ctrl+V，理論上與 Codex 一致），標明為推論
4. **Codex 面板**（BAT 內建的 Codex Agent 面板，非終端）：附件 / 貼圖是否已支援（BUG-128 修正提到 Claude / Codex 面板可用 Command+V 加附件），只需依程式碼確認

## 研究指引

- 判斷 Codex 的貼圖鍵時，以實測為準；`codex` 的 keymap 可能可透過設定（`/keymap` 或 config）查看預設綁定，能查到就附上
- 若 (b) 失效：給方案，例如 [A] 依前景程式 / agent preset 選貼圖鍵（claude → Alt+V、codex → Ctrl+V）、[B] Windows 一律送 Ctrl+V 並確認 claude CLI 在 Windows 也接受、[C] 讓使用者在 Settings 選；評估各自對 claude CLI（BUG-130）的回歸風險
- 若 (b) 可用：寫明證據，塔台可直接回覆使用者

## 互動規則

- 本單以 `--no-interactive` 派發：不向使用者提問。需要真人操作才能判定的項目（例如必須實體按鍵且無法自動化），列為 NEEDS-HUMAN 並寫出 2 分鐘內可完成的手動步驟

## Sub-session 執行指示

1. 讀本工單、T0524、BUG-130
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實測 / 調查 → 填回報區（DONE / PARTIAL / BLOCKED）
4. commit 本單（`--only`）；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 實測結果（Windows）

| 情況 | 結果 | 證據 |
|---|---|---|

### T0524 轉送路徑（程式碼）

### mac / Linux 推論

### Codex 面板

### 建議方向

### NEEDS-HUMAN 手動步驟（若有）

### 遭遇問題
