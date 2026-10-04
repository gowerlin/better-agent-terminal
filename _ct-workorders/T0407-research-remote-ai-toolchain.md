---
schema_version: 1
schema_kind: workorder
id: T0407
title: "研究：遠端 AI 工具套件檢查與一鍵安裝（PLAN-037）—— 工具清單、官方安裝方式、偵測、精靈 / 設定頁整合、拆單"
type: research
status: PENDING
repo: better-agent-terminal
project: PLAN-037
priority: P2
sizing: M
created_at: "2026-10-05T02:28:57+08:00"
target_version: next
depends_on: []
related:
  - "PLAN-037（本研究服務的計劃）/ D131"
  - "PLAN-036（headless handler 層；T0405 git 上遠端依賴本 PLAN）"
  - "PLAN-035（WSL 全自動化精靈）"
  - "T0386 回報區 §4（claude runtime / auth 現況）"
affects_files:
  - _ct-workorders/T0407-research-remote-ai-toolchain.md
interaction:
  mode_hint: on
  interactive: true
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **研究單不改產品程式碼**。只寫本工單回報區。"
  - "🔴 遠端實測只做**唯讀偵測**（`command -v`、`--version`、`cat /etc/os-release`、`sudo -n true` 之類）；**不得在 WSL / 任何遠端實際安裝或移除套件**，不得 restart `bat-server.service`，不得對 `~/.local/bat-server` 寫入。"
  - "🔴 不得把任何 token / credential 內容寫進回報區（只記「存在 / 不存在」）。"
  - "🔴 T0401 平行在改 `electron/` / `src/`：本單只讀。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0407 — 研究：遠端 AI 工具套件檢查與一鍵安裝

## 元資料
- **工單編號**：T0407
- **任務名稱**：研究：遠端 AI 工具套件
- **狀態**：PENDING
- **類型**：research
- **互動模式**：enabled（每次提問 ≤ 3 題，選項式 + 「其他」兜底）
- **intervention_type**：context-dependent
- **affects_files**：只寫本工單
- **建立時間**：2026-10-05 02:28 (UTC+8)

## 研究目標

使用者已裁決（D131）：做「**檢查＋一鍵安裝**」——偵測遠端各工具的安裝狀態 / 版本 / 登入狀態；缺的工具以按鈕在**遠端終端分頁**打入官方安裝指令（需 sudo 的在分頁內輸入密碼；不需 sudo 的裝到 `~/.local/bin`）；入口為 WSL / SSH 精靈最後一步＋遠端 profile 設定頁。本研究要產出**可直接拆成實作單**的設計。

## 已知資訊

- 遠端功能走 headless bat-server（PLAN-036）：client → `PROXIED_CHANNELS` → headless handler；共用模組在 `electron/handlers/*.ts`（`registerXxxHandlers(register, deps)`），parity / electron-free 守門
- server bundle 已內嵌 claude-code（Agent 面板用 `node_modules/@anthropic-ai/claude-code/bin/claude`），不含 codex；runtime router 可選 system claude（`electron/claude-resolver.ts` 會 fallback 掃 `~/.local/bin`）
- WSL Ubuntu 24.04 實測：無系統 claude、`~/.claude/.credentials.json` 不存在（T0386 §4）；systemd user service 的 PATH 不含 `~/.local/bin`
- 遠端終端分頁已可用（P0）；T0403 起 `pty:create` 回報 `created`
- 精靈：`src/components/setup-wizard/`（WSL / SSH / Docker 三條線；PLAN-035 持續改動中）
- 專案規則：child_process 一律 `execFile` / `spawn` + array args、外部輸入過白名單、必設 timeout（CLAUDE.md）

## 調查範圍與研究指引

1. **工具清單**：至少 claude CLI、codex CLI、git、gh；評估是否納入 node / npm（codex 若走 npm 安裝需要）、ripgrep、uv / python 等 AI agent 常用依賴。每項標「必要 / 建議 / 可選」
2. **官方安裝方式**（以官方文件為準，附來源 URL；查不到官方來源的標「未證實」）：
   - 依平台：Ubuntu / Debian（apt）、Fedora / RHEL（dnf）、Alpine（apk，Docker 常見）、macOS（SSH 目標，brew / 官方 installer）
   - 每項：是否需要 sudo、安裝位置、完整性校驗方式（簽章 / sha256 / apt repo key）、升級方式、與 BAT embedded claude 的關係（避免 BUG-059 類自我更新問題）
3. **偵測**：版本、PATH 可見性（login shell vs systemd service env 差異）、登入狀態（claude / codex / gh 各自的判斷方式，只判斷存在與否）、套件管理器與 sudo 可用性（`sudo -n true`）。以 WSL Ubuntu-24.04 唯讀實測
4. **執行模型**：偵測走新的 headless channel（命名、parity 分類）還是在終端分頁跑腳本？安裝一律走「在遠端終端分頁打入指令」——指令如何組（避免 shell injection；使用者可見、可中止）、如何得知完成並重新偵測
5. **UI 整合**：精靈最後一步與設定頁的共用元件；與 PLAN-035 精靈改動的檔案邊界；i18n
6. **安全**：不自動執行 `curl | sh` 而不顯示內容？（評估：顯示指令讓使用者確認 vs 直接打入）；來源 pin；不把 server token 暴露給安裝腳本
7. **拆單**：工單清單（標題 / sizing / affects_files / 依賴 / 可否與 PLAN-036 T0401-T0406 平行，**特別標出與 `main.ts` / `protocol.ts` / `headless-entry.ts` 的檔案鎖衝突**）

## 互動規則
- 可主動向使用者提問以縮小範圍；每次 ≤ 3 題；每題提供選項 + 「其他：________」
- 互動紀錄寫入回報區

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
（DONE / PARTIAL / BLOCKED）

### 互動紀錄

### 調查結論
（1-6 各節）

### 建議方向
- **推薦**：

### 建議工單清單

### Renew 歷程
無

### 遭遇問題

### 回報時間
