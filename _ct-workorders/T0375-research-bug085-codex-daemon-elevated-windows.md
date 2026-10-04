---
schema_version: 1
schema_kind: workorder
id: T0375
title: "研究：BUG-085 Codex 0.160 daemon 在提權 Windows 拒絕啟動的影響範圍與 BAT 補強方案"
type: research
status: TODO
priority: P2
sizing: S
created_at: "2026-10-04T20:21:50+08:00"
updated_at: "2026-10-04T20:21:50+08:00"
started_at: null
completed_at: null
target_version: next
depends_on: []
related:
  - "BUG-085（本研究對象）"
  - "BUG-083 / T0366（Codex 版本研究，含 smoke 方法與隔離 CODEX_HOME 做法）"
  - "T0373（codex binary 選最新：electron/codex-runtime-resolver.ts）"
affects_files: []
interaction:
  mode_hint: on
  interactive: true
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **研究工單，不改產品程式碼、不升級依賴、不 commit `package.json` / `package-lock.json`**。實驗放 scratchpad 或 `git worktree`，結束前清乾淨；主工作樹除本工單檔外不得留下改動。"
  - "🔴 不要 `npm install -g` / `codex update` / 改動使用者全域 codex 安裝；`~/.codex/` 只讀（需要 smoke 時比照 T0366 用 scratchpad 隔離 CODEX_HOME，先問使用者）。"
  - "🔴 **不要改 UAC / 登錄檔 / 系統安全設定**。本機 `EnableLUA=0` 是使用者環境，只讀。"
  - "⚠️ 工作樹有使用者本機 build 留下的 dirty：`package.json`（version `1.26.1004195815`）與 `choco/better-agent-terminal.nuspec` —— 不要碰、不要 commit。"
---

# T0375 — 研究：BUG-085 Codex daemon 提權拒絕

## 元資料

- **類型**：research
- **互動模式**：enabled（每次 ≤ 3 題）
- **工作量預估**：S
- **Context Window 風險**：低

## 研究目標

1. **影響範圍**：除了終端 Codex CLI preset（互動 TUI），以下路徑在提權 Windows 是否也被擋？
   - Codex Agent 面板（SDK → `codex exec --experimental-json`，`electron/codex-agent-manager.ts`）
   - `codex --version` / 模型清單探測等 BAT 內部 spawn（`electron/codex-runtime-resolver.ts`）
   - BAT 內嵌 0.160 與使用者自裝 0.160 行為是否一致
2. **關閉 daemon 的手段**：`--no-daemon` 以外是否有 config.toml 鍵或 env（查 `codex --help`、`codex exec --help`、內嵌套件內的文件或字串）可停用 daemon？哪個最不侵入？
3. **`--no-daemon` 副作用**：對 resume / fork / exec 的相容性；舊版 codex（例如 0.124）遇到未知旗標會不會直接 exit（BAT 可能解析到使用者 PATH 上的舊版）
4. **BAT 補強方案**：比較並推薦
   - A：BAT 偵測自身行程提權（Windows）→ Codex CLI preset 自動補 `--no-daemon`（注入點：`src/types/agent-presets.ts` / `agent-registry.ts` / pty 啟動流程）
   - B：注入 env 或 config 覆寫（若研究目標 2 找到可用的方式）
   - C：不自動處理，只在 preset 失敗時顯示 i18n 提示
   - 也評估是否要在提權時給一次性警示（BAT 以管理員執行本身就是風險面）

## 已知資訊（塔台環境檢查，請自行複核）

- 錯誤原文：`Error: start the Windows daemon from a non-elevated terminal; shared clients must not inherit administrator privileges` / `To work without the background server, rerun the same command with --no-daemon (including resume or fork and its arguments).`
- 本機 `EnableLUA=0`（UAC 停用），BAT 父行程為 `explorer.exe`，子 shell 提權為 True
- 終端分頁 `codex` 解析為 `%LOCALAPPDATA%\Programs\OpenAI\Codex\bin\codex.exe`（`codex-cli 0.160.0`）；PATH 上另有 npm shim
- 已安裝 BAT `1.26.1004195815`（本機 build ≈ `v0.5.9-pre.4`），內嵌 `@openai/codex-sdk` 0.160.0；內嵌 binary 在 `C:\Program Files\BetterAgentTerminal\resources\app.asar.unpacked\node_modules\@openai\codex-win32-x64\...`
- preset 定義：`src/types/agent-presets.ts:75`；registry：`electron/agent-runtime/agent-registry.ts:157-161, 430`；使用者實際啟動指令為 `codex --yolo`（`--yolo` 可能來自 agentCustomArgs，請確認）
- 你自己的 shell 也繼承了提權（同一個 BAT），可以直接重現

## 調查範圍

- ✅ 上述檔案只讀；內嵌與 PATH 上 codex 的 `--help` / `--version` / 最小 smoke
- ✅ BAT debug log：`%APPDATA%\better-agent-terminal\Logs\debug-<stamp>.log`（L128）
- ❌ 不改 `src/` `electron/` `package*.json`；不改系統設定；不發 release

## 互動規則

- 每次 ≤ 3 題。需要真實 Codex 對話 smoke（消耗額度 / 使用 auth）前先問使用者
- 能用實驗回答的不要問

## 回報要求

- 研究目標 1-3 每項標註 **證實 / 排除 / 無法判定** 並附證據（指令輸出、行號）
- 目標 4 給推薦方案、改動檔案清單（可直接當實作工單的 `affects_files`）、測試建議、風險
- 若發現 BUG-085 嚴重度應調整（例如 Codex Agent 面板也壞），明確寫出建議

## Sub-session 執行指示

1. 讀取本工單全部內容 + `BUG-085`
2. 填入 `started_at`、`status: IN_PROGRESS`（**用 `date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，R-G001）
3. 依研究目標 1 → 4 調查
4. 填寫回報區、更新 `status` / `completed_at` / `updated_at`；完成請寫 **`DONE`**（不是 `FIXED`）
5. commit **僅本工單檔**（`git commit --only _ct-workorders/T0375-research-bug085-codex-daemon-elevated-windows.md`）
6. 依派發 mode 通知塔台（`bat-notify.mjs`）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
