# Tower State — better-agent-terminal

> 最後更新：2026-04-14 00:24 (UTC+8)（T0118 DONE：T0117 regression 修復，BUG-027 全部解決）

---

## 🌅 起手式（Quick Recovery）
> 最後更新：2026-04-16 17:40 UTC+8

### 立即待辦
1. **BUG-031 待修**（🟡 Medium）— 外部 PTY 被分配到錯的 workspace（非 active）。建議開 Worker 修復工單調查 `addExternalTerminal` 的 workspace 分配邏輯
2. **T0135 9 項 MANUAL 待驗**（使用者手動）：1.3/1.4 Cache History/abort UI、2.3 CT 按鈕 PTY write、3.3 Settings UI、5.3 外部 PTY UI 同步、7.5/7.6 Toast/Badge、8.5 端到端
3. **T0135 1 項 PARTIAL**（6.2 `--help` 沒實作）— 可開小 PLAN 收尾
4. Backlog 5 張 PLAN 待排優先級（PLAN-001~005, 007）

### 本 session 新增工單
- T0135 BAT v2.x + CT v4.1.0 全鏈路驗收 ✅ DONE（c98a04c, 8ec97ad）
- T0136 BUG-030 修復 ✅ FIXED (f77d2d0)
- BUG-030 MSYS 路徑轉換 🚫 CLOSED
- BUG-031 PTY 分配到錯 workspace 🔴 OPEN

### 近期完成摘要（本 session）
- **T0126** DONE：修復 CT 面板工單按鈕命令格式（`/ct-exec` → `claude "/ct-exec"`）
- **T0127** DONE：研究 BAT 內部終端建立機制 → 推薦方案 A
- **T0128** DONE：Agent 自訂參數 Settings UI + 7 處啟動路徑套用
- **T0129** DONE：RemoteServer 自動啟動 + BAT_REMOTE_PORT/TOKEN env vars 注入
- **T0130** DONE：外部建立終端 UI 同步（縮圖 + xterm + 自動聚焦）
- **T0131** DONE：CLI helper bat-terminal.mjs（零依賴 WebSocket invoke）
- **T0132** DONE：研究 Worker→Tower 自動通知 → 推薦方案 A（雙管道）
- **T0133** DONE：Worker→Tower 自動通知實作（雙管道 + 三層 badge 冒泡）
- **T0134** DONE：【統籌】CT 上游整合（COORDINATED → CT-T001 DONE）
- **CT-T001** DONE：CT v4.0.1 → v4.1.0（BAT 路由 + Worker 通知整合）
- **PLAN-011** DONE：CT 上游 PR 完成（v4.1.0 發布）
- `_local-rules.md` 更新：BAT auto-session 路由規則 + Bash 白名單

### 工單統計
- Done: 137 + CT-T001 | Active: 0 | 總計: 138
- 最高編號：T0137 / BUG-031 / PLAN-011 / D031
- FIXED BUG（待 rebuild 驗證）: BUG-031（Medium，T0137 commit f325d1d）
- Closed BUG（本輪）: BUG-030（High → CLOSED, 02:42）

## 🌅 明日起手式（Quick Recovery）<!-- ORIGINAL -->

**目前進度**：單據系統遷移 + 歸檔完成。20 張工單全部 DONE。目錄已清理。

**最後完成工單**：T0085（Commit all + v0.0.9-pre.1 pre-release）
**本輪完成**：T0065-T0085（21 張），涵蓋 BMad UI 整合、workspace 切換修復、VS Code 開啟功能、BUG-012 根因確認與修復

**下一步建議**：
1. 參考 `_backlog.md` 的 PLAN-001~007 決定下一批工作
2. BUG-001 待 runtime 驗收（最後一張 VERIFY bug）

**快速連結**：
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（Open: 0，Closed: 24）
- Backlog → [_backlog.md](_backlog.md)（Active: 6）
- 工單索引 → [_workorder-index.md](_workorder-index.md)（Active only）
- 決策日誌 → [_decision-log.md](_decision-log.md)（最新：D028）
- 學習紀錄 → [_learnings.md](_learnings.md)
- 歷史 Checkpoint → [_archive/checkpoint-2026-04.md](_archive/checkpoint-2026-04.md)

---

## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（lastSyncCommit: 079810025，上游版號 2.1.3） |
| **Fork 版號** | 1.0.0（獨立版號，從 1.0.0 開始，D026） |
| **目前里程碑** | Phase 1 — Voice Input（實作完成，收官驗收中） |
| **工單最大編號** | T0125 |
| **BUG 最大編號** | BUG-029 |
| **PLAN 最大編號** | PLAN-010 |
| **上游同步版本** | v2.1.42-pre.2（2026-04-16） |
| **決策最大編號** | D031 |
| **塔台版本** | Control Tower v4.0 |

---

## 📊 進度快照

**Phase 1 語音功能**：✅ 實作完成
- 工單 T0001~T0062 執行完畢
- BUG-001~015 全部處理（1 個上游追蹤，1 個關閉，13 個已修復）
- 語音辨識：Whisper CPU + macOS Metal GPU 已啟用
- npm 安全：漏洞從 27 個降至 17 個（減少 48%）

**近期完成**：
- T0060：Metal GPU 加速（macOS）+ npm 安全修復
- T0061：文件結構設計
- T0062：_tower-state.md 瘦身 + 文件系統遷移

**塔台語氣校準**：
- 使用繁體中文
- 偏好決策速度快（選項式回答）
- 務實路線（先求有再求好，接受分階段交付）
- 重視細節，會主動回報 bug

---

## 📝 管理筆記

**2026-04-13 16:20 T0094 批次結案**：
- 所有 FIXED 狀態 BUG 人工驗收通過，批次更新為 CLOSED
- 共 20 筆：BUG-003~006, 008~011, 013~022, 023, 024
- BUG-023（右鍵選單智慧定位，T0092）驗收通過
- BUG-024（CT 面板不監聽索引文件，T0095）驗收通過
- T0091（BUG Detail 工作流 UI）驗收通過
- T0092（右鍵選單智慧定位實作）驗收通過
- Bug Tracker 統計：Open 0 / Fixed 0 / Closed 24

**2026-04-13 13:43 T0086 結案**：
- BUG-002 CLOSED（人工驗收通過）
- BUG-012 CLOSED（人工驗收通過，v0.0.9-pre.1 確認修復）
- Worktree 檢查：無 bug012 worktree 存在（已自行清理或未建立）
- Bug Tracker 統計：Open 0 / Verify 1 / Fixed 18 / Closed 3

**2026-04-13 13:14 Session 結束筆記**：
- 本輪 21 張工單（T0065~T0085），生產力高
- **BUG-012 重大突破**：EXP-BUG012-001 實驗確認根因為 `convertEol: true`，5 輪排除法，2 行修復
- 新功能：VS Code 開啟工作區（T0078~T0082）、BMad Workflow/Epics 頁籤（T0072~T0073）
- 新規範：`_local-rules.md` 加入 EXP-/跨專案工單前綴規範
- v0.0.9-pre.1 pre-release 已推出，BUG-012 待 runtime 驗收後 CLOSED
- worktree `../better-agent-terminal-bug012` 待清理

**2026-04-12 21:43 Session 結束筆記**：
- 本輪 20 張工單，生產力極高
- 新單據系統（BUG/PLAN/Decision 獨立檔 + 歸檔原則）是本專案實驗，成功後推回 BMad-Control-Tower
- `_local-rules.md` 教塔台認識新單據，下輪 session 驗證是否有效
- 4 commits 待使用者 push

---

## 🗂️ 歸檔索引

歷史 Checkpoint（2026-04-11 至 2026-04-12）：
→ [_archive/checkpoint-2026-04.md](_archive/checkpoint-2026-04.md)（2016 行，完整保留）

---

## 🔍 環境快照
> 最後掃描：2026-04-15 20:59 (UTC+8)

| 偵測項 | 狀態 | 備註 |
|--------|------|------|
| BMad-Method | ✅ | _bmad/ 已偵測到 |
| ECC 學習 | ✅ Level 1 | ~/.claude/homunculus/ |
| bmad-guide skill | ✅ | 可用 |
| mem0 REST | ✅ | memsync healthy, queue:2 |
| 終端環境 | better-agent-terminal | TERM_PROGRAM 偵測 |
| ct-exec | ✅ | |
| ct-done | ✅ | |
| ct-status | ✅ | |
| ct-evolve | ✅ | |
| ct-insights | ✅ | |
| ct-fieldguide | ✅ | |
| ct-help | ✅ | |
| _archive/ | ✅ | ~80 張歸檔 |
| _playbooks/ | ✅ | 🆕 本次建立 |
| _decision-log | ✅ | D031 (18+ 條) |
| 跨專案參照 | 📋 | 無關聯 |
| Global 學習 | ✅ | 2 learnings, 4 fieldguide |
| BUG/PLAN 追蹤 | ✅ | BUG:15熱+13冷 PLAN:9 |
| 實驗追蹤 | ✅ | EXP:1 |
| 設定來源 | project | _tower-config.yaml (v4 已補齊) |
| 能力等級 | Level 2 | ECC + mem0 |
