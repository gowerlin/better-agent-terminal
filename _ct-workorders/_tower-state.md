# Tower State — better-agent-terminal

> 最後更新：2026-04-14 00:24 (UTC+8)（T0118 DONE：T0117 regression 修復，BUG-027 全部解決）

---

## 🌅 明日起手式（Quick Recovery）
> 最後更新：2026-04-13 17:51 UTC+8（session context 耗盡，正常切換）

### 立即待辦
1. **T0103** ✅ DONE：索引架構改革（_workorder-index 移除，bug-tracker/backlog sync 重建）
2. **T0104** ✅ DONE：4 commits 入庫（394bede / 3d80fd1 / 1ecb6b9 / 62399e4）
3. **BUG-025** ✅ CLOSED
4. **T0105** ✅ DONE：BUG-026 修復
5. **BUG-026** 🚫 CLOSED（人工驗收通過 2026-04-13）
6. **PLAN-008 Phase 2 工單排程**：
   - T0106 ✅ DONE：Terminal Server 骨架（c1d238a）
   - T0107 ✅ DONE：PtyManager proxy（55d33d8）**← Milestone: Terminal Server 可用**
   - T0108 ✅ DONE：TCP 重連 + buffer 重播（c65fb6e）
   - T0109 ✅ DONE：孤兒回收 + Settings UI + ASAR（ab98120）
   - T0110 ✅ DONE：復原提示 UI（5b8d99a）**← PLAN-008 Phase 2 全部完成**

### 本 session 完成摘要（T0097~T0101）
- **配置補齊**：project-context.md + sprint-status.yaml（T0097/T0098）
- **技術債清理**：批次 commit 43 個文件，git history 整齊（T0099）
- **BUG-025 診斷 + 修復**：CT 面板 emoji 前綴狀態解析問題，1 行 regex 修復（T0100/T0101）
- **PLAN-009 登記**：Sprint 儀表板 UI，待技術債清完後實作
- **架構決策**：sprint-status.yaml 放根目錄（不放 _bmad-output/），BMad 層次補 User Story 討論

### 工單統計
- Done: 118 | Active: 0 | 總計: 118
- 最高編號：T0111 / BUG-026 / PLAN-009 / D031

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
| **工單最大編號** | T0096 |
| **BUG 最大編號** | BUG-024 |
| **PLAN 最大編號** | PLAN-007 |
| **決策最大編號** | D028 |
| **塔台版本** | Control Tower v3.x |

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
