# project-context.md — better-agent-terminal

> 本文件記錄專案願景、技術決策與邊界定義。
> 建立時間：2026-04-13 (UTC+8)（T0097 產出）
> 最後更新：2026-04-13 (UTC+8)

---

## 願景

結合 Control Tower 工單系統與 BMad-Method 開發流程，提供以語音優先的 AI 協作終端工作環境，讓開發者能以更自然、高效的方式操作多個終端工作區。

### 核心問題

- **痛點**：傳統終端機操作需要全程鍵盤，切換多個工作區和追蹤 AI Agent 狀態費力且容易中斷思考流
- **差異化定位**：相比上游 tony1223/better-agent-terminal，本 fork 強化了：
  - 語音輸入（Whisper 離線辨識，隱私優先）
  - Control Tower 工單追蹤系統整合
  - BMad-Method AI 協作流程支援
  - Windows 平台優先的開發體驗

### 解決方案

- **Voice-first Terminal**：語音輸入優先，不排斥鍵盤，按 Alt+M 隨時切換
- **AI 輔助工作流**：結合 Claude Agent SDK，提供 sub-agent 追蹤、active tasks bar、/login 攔截等輔助功能
- **Control Tower 整合**：工單系統（T####）直接在 App 內管理，BUG/PLAN 單一站追蹤
- **跨平台支援**：Windows/macOS/Linux 統一體驗，Windows 為主要開發平台

---

## 技術棧

| 層 | 技術 | 版本 | 決策原因 |
|----|------|------|--------|
| 運行時 | Electron | 最新穩定版 | 跨平台桌面應用，原生系統整合 |
| 渲染層 | React | 18.2.0 | 組件化 UI，Hooks 模式易維護 |
| 後端 | Node.js | Electron 內建 LTS | 無需額外安裝，統一環境 |
| 終端模擬 | @xterm/xterm | 5.5.0 | VT100 相容，v5 穩定（D025：已從 v6 revert） |
| 語音辨識 | whisper-node-addon | 1.0.2 | 離線支援，CPU/GPU 加速，隱私優先 |
| AI SDK | @anthropic-ai/claude-code | ^2.1.97 | Claude Code CLI 整合 |
| AI SDK | @anthropic-ai/claude-agent-sdk | ^0.2.104 | Agent 任務追蹤 |
| 資料庫 | better-sqlite3 | ^12.5.0 | 本地持久化（session、偏好設定） |
| Markdown | marked + highlight.js + mermaid | 最新 | 訊息渲染 |
| 國際化 | i18next | ^25.x | 中文（繁）/ 英文支援 |
| E2E 測試 | Playwright | ^1.59.1 | 自動化 UI 測試 |

---

## 主要架構決策

| ID | 日期 | 決策 | 說明 |
|----|------|------|------|
| D001 | 2026-04-11 | 語音引擎選型：whisper.cpp | 離線、隱私優先、CPU/GPU 皆支援 |
| D025 | 2026-04-12 | xterm v5（從 v6 revert）+ ErrorBoundary | v6 造成 BUG-013/014/015，v5 穩定 |
| D026 | 2026-04-12 | Fork 獨立版號從 1.0.0 開始 | 與上游版號脫鉤，package.json 管理 |
| D027 | 2026-04-12 | 上游追蹤：tony1223，lastSyncCommit: 079810025 | 明確 fork 關係，方便上游評估 |
| D028 | 2026-04-12 | 模組化文件結構（BUG/PLAN/Decision 獨立單據） | `_tower-state.md` 瘦身，便於 UI 顯示 |
| D029 | 2026-04-12 | BUG 狀態流新增 🧪 VERIFY 中間態 | 區分「code 修了」和「真人確認修好了」 |

---

## 平台支援政策

| 平台 | 優先級 | 支援狀態 | 備註 |
|------|--------|--------|------|
| Windows (x64) | 🔴 優先 | ✅ 全面支援 | 開發者主用平台 |
| macOS (Intel / Apple Silicon) | 🟡 次要 | ✅ 全面支援 | macOS Metal GPU 加速已啟用 |
| Linux（含 WSL / Docker） | 🟢 可選 | ✅ 基本支援 | 社群貢獻主導 |

---

## 功能邊界

### ✅ 已支援

- 語音輸入（Whisper CPU/GPU 離線辨識）
- 多工作區管理（多 terminal tab + 縮圖列）
- 右鍵選單（智慧邊界定位，BUG-023 修復）
- VS Code 整合開啟（點按直接開啟編輯器）
- PTY 終端（完整 VT100 支援，ANSI 色彩）
- Claude Agent SDK 整合（active tasks bar、/login 攔截）
- 佈局持久化（30s auto-save，PLAN-008 Phase 1）
- 工單系統（Control Tower T####、BUG-###、PLAN-### 管理）
- 本地 SQLite 儲存
- macOS Metal GPU 加速語音辨識

### 🔜 暫未支援（Phase 2+ 計畫）

- 語音輸出 / TTS
- 遠端 SSH 終端（PLAN-008 Phase 2 評估中）
- 自訂終端主題 API（待設計）
- BAT agent orchestration 自動化閉環（PLAN-007，研究階段）

### 🚫 明確不支援

- 遠端終端伺服器模式（僅本地 PTY）
- 非標準 shell（僅支援 bash / zsh / PowerShell）

---

## 里程碑規劃

| 階段 | 狀態 | 工單範圍 | 主要產出 |
|------|------|---------|---------|
| **Phase 1 — Voice Input** | ✅ 完成 | T0001~T0097 | 語音辨識、多工區 UI、工單管理系統、佈局持久化 |
| **Phase 2 — Terminal Architecture** | 📋 規劃中 | T0098+ | Terminal Server 獨立進程、PTY 生命週期管理（PLAN-008） |
| **Phase 3+** | 💡 Backlog | — | BAT agent orchestration（PLAN-007）、遠端 SSH（PLAN-006 dropped）、其他 PLAN-001~005 |

### 相關 Backlog

- `_ct-workorders/_backlog.md` → PLAN-001~008 完整清單
- `_ct-workorders/_bug-tracker.md` → Bug 追蹤（Open: 0，已清零）

---

## 版本資訊

| 欄位 | 內容 |
|------|------|
| Fork 版號（我們） | 1.0.0（package.json 管理，D026） |
| 上游版號 | 2.1.3（tony1223/better-agent-terminal） |
| lastSyncCommit | 079810025 |
| 塔台版本 | Control Tower v3.x |

---

## 相關文件

- 決策日誌 → [`_ct-workorders/_decision-log.md`](_ct-workorders/_decision-log.md)
- 本地規則 → [`_ct-workorders/_local-rules.md`](_ct-workorders/_local-rules.md)
- 工單索引 → [`_ct-workorders/_workorder-index.md`](_ct-workorders/_workorder-index.md)
- Bug 追蹤 → [`_ct-workorders/_bug-tracker.md`](_ct-workorders/_bug-tracker.md)
- Backlog → [`_ct-workorders/_backlog.md`](_ct-workorders/_backlog.md)
- 塔台狀態 → [`_ct-workorders/_tower-state.md`](_ct-workorders/_tower-state.md)
- 上游專案 → [tony1223/better-agent-terminal](https://github.com/tony1223/better-agent-terminal)
