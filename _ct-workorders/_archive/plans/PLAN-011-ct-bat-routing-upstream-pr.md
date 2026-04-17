# PLAN-011-ct-bat-routing-upstream-pr

## 元資料
- **編號**：PLAN-011
- **標題**：Control Tower 上游 PR — BAT 內部終端路由標準化
- **狀態**：DONE
- **優先級**：🟡 Medium
- **建立時間**：2026-04-16 23:10 (UTC+8)
- **完成時間**：2026-04-17 01:25 (UTC+8)

## 描述

將 BAT 內部終端建立功能（T0127-T0131）推回 Control Tower 上游專案（BMad-Control-Tower），列為 auto-session 的標準路由策略。

**功能內容**：
- auto-session 偵測 `BAT_SESSION=1` 時，自動走 BAT 內部終端（WebSocket invoke）
- Bash 白名單擴充 `bat-terminal` helper 指令
- auto-session.md 新增 BAT 路由段落
- 無需 local-rules 手動設定，偵測到即自動啟用

**前置條件**：
- T0126-T0131 全部完成 ✅
- Runtime 驗收通過（實際點擊測試）
- 穩定運行一段時間（無 regression）

**PR 範圍**（預估）：
- `references/auto-session.md` — 新增 BAT 路由段落 + 偵測邏輯
- SKILL.md Bash 白名單 — 新增 `bat-terminal` 相關指令
- 文件更新 — 環境偵測面板新增 BAT 終端項目

## 相關工單
- T0127：研究 BAT 內部終端建立機制
- T0128：Agent 自訂參數（配套功能）
- T0129：RemoteServer 自動啟動 + env vars 注入
- T0130：外部建立終端 UI 同步
- T0131：CLI helper script

## 相關工單（跨專案）
- T0134：COORDINATED 統籌工單（BAT 端）
- CT-T001：DELEGATE 受派工單（BAT 端存檔）
- CP-T0091：研究 BAT 整合結構（BMad-Guide 端）
- CP-T0092：Source 端 4 檔修改（BMad-Guide 端）
- CP-T0093：v4.1.0 snapshot + CHANGELOG + ZIP（BMad-Guide 端）

## 完成紀錄
- CT v4.0.1 → **v4.1.0**（minor bump）
- Source 端（`~/.claude/skills/`）4 檔修改完成
- Snapshot `BMad-Control-Tower-v4.1.0/` 已建立
- ZIP `BMad-Control-Tower-v4.1.0.zip`（299 KB）已產生
- CHANGELOG + 安裝指南已更新
- 向下相容驗證全通過（非 BAT 環境不受影響）

## 備註
CT v4.1.0 已發布。BAT 端待 runtime 整合驗證（啟動 Tower 觀察 BAT_SESSION 偵測行為）。
