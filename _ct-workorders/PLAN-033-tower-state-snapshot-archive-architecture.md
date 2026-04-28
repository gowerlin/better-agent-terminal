---
schema_version: 1
schema_kind: plan
id: PLAN-033
title: Tower State Snapshot Archive Architecture（hot/cold 分離 + 上游 PR）
status: PLANNED
priority: high
created_at: "2026-04-27T16:55:00+08:00"
---
# PLAN-033 — Tower State Snapshot Archive Architecture（hot/cold 分離 + 上游 PR）

## Metadata

| 欄位 | 內容 |
|------|------|
| PLAN 編號 | PLAN-033 |
| 標題 | Tower State Snapshot Archive Architecture（hot/cold 分離） |
| 類型 | A + B 混合（架構調整 + 技術改善 + 上游 PR 候選） |
| 優先級 | 🔴 High |
| 狀態 | 📋 PLANNED |
| 建立時間 | 2026-04-27 16:55 (UTC+8) |
| Release target | v4.4.1 / v4.5.0（control-tower skill 升版） |
| 上游 PR 候選 | ✅（同類問題會發生在所有長期 dogfood 的 BAT/CT 用戶） |

## 背景與動機

`_tower-state.md` 已成長至 **264 KB**（37 session 累積 36 個收工快照），實證影響：

- **Read 工具 256 KB 上限觸發**（session 37 起手實測，塔台被迫只讀前 200 行 + 用 grep 補資料）
- **Fast Path 啟動成本遞增**：每新增一個 session 增加 ~7 KB，預計 session 50 時達 ~350 KB（多次 Read offset）
- **Cold path 資料無索引**：歷史快照只在 retrospective / debug 用，但每次 Read 都連帶載入

**根因**：v4.4.0 設計收工流程只「append + 前 N 標題降級」，缺少封存路徑。

## 設計範圍

### 1. 檔案結構

```
_ct-workorders/
├── _tower-state.md                   # hot path（本 + 前 1 session，目標 < 30 KB）
└── _archive/
    └── state-snapshots/              # cold path
        ├── INDEX.md                  # session# → 檔案/時間/摘要
        ├── 2026-Q1.md                # 季度封存（多 session 合併）
        ├── 2026-Q2.md                # 當季累積
        └── ...
```

### 2. 收工流程新增步驟

收工寫快照前：
1. 讀現有 `_tower-state.md`
2. 識別「前 Session 收工快照」段落（即將被擠出）
3. 內容 append 到 `_archive/state-snapshots/<YYYY-Q?>.md`（無檔則建）
4. 更新 `INDEX.md`（session 號 + 檔案 + 一行摘要）
5. 從 `_tower-state.md` 移除該段
6. 寫入新「本 Session」段，原「本」降級為「前」

### 3. 啟動偵測強化（Step 0）

Full Scan / Fast Path 額外驗證：
- `_tower-state.md` size < 50 KB（軟警告，> 100 KB 強制提示 archive）
- `_archive/state-snapshots/` 存在且 INDEX.md 格式合法

### 4. 一次性遷移（本專案）

將 session 1-35 共 34 個歷史快照搬到 `_archive/state-snapshots/`，瘦身 `_tower-state.md` 到 ~20 KB（保留 session 36 + 37）。

### 5. 上游 PR 候選

修改範圍（僅本專案先做，再評估 PR）：
- `~/.claude/skills/control-tower/SKILL.md`：收工流程 + Step 0 偵測
- `~/.claude/skills/control-tower/references/memory-protocol.md`：state 檔案管理章節

## Sprint 大綱（暫定 3 sprint）

| Sprint | 工單 | 範圍 | 預估 |
|--------|------|------|------|
| Sprint 1 | T#### research | hot/cold 切點規格 + INDEX 格式 + 季度切割策略 + 拍板候選列出 | 30-45 min |
| Sprint 2 | T#### 本專案一次性遷移 + 收工流程 patch | session 1-35 archive + `_tower-state.md` 瘦身 + INDEX 初版 | 60-90 min |
| Sprint 3 | T#### control-tower skill PR 草稿 | SKILL.md / memory-protocol.md 修改 + 上游 PR 草稿（commit 到 fork） | 45-60 min |

> 實際拆單表由 Sprint 1 research 工單產出。

## 待釐清拍板候選（Sprint 1 research 處理）

1. **季度切割 vs session 數量切割**：每季一檔 vs 每 N session 一檔（影響檔案大小可預期性）
2. **Quick Recovery 是否也歸檔**：Quick Recovery 段落每 session 都更新，是否封存歷史版本（一般不需要）
3. **INDEX.md 格式**：純表格 vs frontmatter+表格（Read 工具友善度）
4. **遷移觸發條件**：每次收工自動 vs 每 N session 一次 vs `*archive --state` 手動
5. **state file 大小門檻**：軟警告 50 KB / 強制 100 KB 是否合理
6. **跨 quarter 切換時機**：自然季度（4/1, 7/1, ...）vs session 號（每 50 session）vs 檔案大小（每 50 KB）

## 影響評估

| 維度 | 影響 |
|------|------|
| Fast Path 啟動 | 本專案：~5x 加速（264KB → ~20KB）；通用：每月節省每位 dogfood 用戶 ~10-30 KB Read |
| Read 工具上限 | 解除 256 KB 風險（短期 + 長期） |
| 歷史可追溯 | 保留（INDEX 索引 + 檔案內容完整） |
| 向下相容 | 完全相容（_archive/ 已存在，新增 state-snapshots/ 子目錄） |
| Worker session | 無影響（Worker 不讀 _tower-state.md） |

## OOS（不在範圍內）

- 不改 `_learnings.md` 結構（已 2936 行，但純 append 不撞 hot path）
- 不改 worker skill（ct-exec / ct-done）— 純塔台 + memory-protocol 範圍
- 不做即時自動 archive（保守先做收工 trigger，避免 *sync 期間複雜化）

## 參考資料

- 本 session（37）實證：264 KB Read 撞上限
- v4.4.0 SKILL.md 收工流程現況（references/memory-protocol.md）
- `_archive/` 既有設計（archive-system.md，原本只用於 workorder/bug/plan）
- GP116（self-hosted 工具鏈撞線時 graceful degrade）— 同類議題

## 關聯

- 上游 PR 候選：control-tower skill v4.4.1 或 v4.5.0
- 萃取候選：Sprint 完成後 *evolve（state 管理 pattern）

---

**狀態**：📋 PLANNED — 等下 session 起手評估派 Sprint 1 research 工單
