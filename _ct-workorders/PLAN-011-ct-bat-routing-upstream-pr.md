# PLAN-011-ct-bat-routing-upstream-pr

## 元資料
- **編號**：PLAN-011
- **標題**：Control Tower 上游 PR — BAT 內部終端路由標準化
- **狀態**：IDEA
- **優先級**：🟡 Medium
- **建立時間**：2026-04-16 23:10 (UTC+8)
- **完成時間**：（完成時填入）

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

## 備註
待 runtime 驗收通過 + 穩定運行後再評估 PR 時機。
