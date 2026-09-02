---
schema_version: 1
schema_kind: workorder
id: T0359
title: "CP-T1148: support ABANDONED workorder status parsing"
type: fix
status: FIXED
priority: P1
sizing: S
created_at: "2026-05-23T20:13:40+08:00"
started_at: "2026-05-23T20:22:55+08:00"
completed_at: "2026-05-23T20:31:16+08:00"
updated_at: "2026-05-23T20:31:16+08:00"
commit: d3f6580
source_workorder: CP-T1148
source_project: 2026_Cooperative
target_project: BMad-Guide
target_subproject: better-agent-terminal/better-agent-terminal
depends_on:
  - CP-T1148
related:
  - D:/ForgejoGit/@Gower_Labs/BMad-Guide/_ct-workorders/CP-T1148-bat-support-abandoned-workorder-status.md
  - D:/ForgejoGit/@合庫/2026_Cooperative/_ct-workorders/CP-T1148-bat-support-abandoned-workorder-status.md
affects_files:
  - "workorder status parser / enum / normalizer"
  - "workorder status badge / color / tooltip mapping"
  - "workorder list filter / count aggregation"
  - "tests or fixtures for CT workorder parsing"
  - CHANGELOG.md
interaction:
  mode_hint: ask
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "Do not expand ABANDONED into BUG or PLAN status sets unless existing code already shares a common final-state enum; CP-T1148 only requires T#### / CP-T#### workorders."
---

# T0359 — CP-T1148：支援 ABANDONED 工單狀態解析

- **狀態**：FIXED
- **來源跨專案工單**：CP-T1148
- **任務類型**：fix
- **工作量預估**：S
- **Context Window 風險**：低

## 背景

`2026_Cooperative` 已正式使用 `status: ABANDONED` 表示被新設計、新工單或 runtime 結論取代的舊工單。這類工單保留歷史脈絡，但應視為 final / inactive：

- 不應再派發
- 不應算 pending
- 不應算 blocked
- 不應算 partial

BAT 目前尚未明確支援 `ABANDONED` workorder status。CP-T1148 要求 BAT 在解析、badge、filter、count 與最小測試上支援此狀態。

## 前置條件

需載入的文件清單：

- `D:/ForgejoGit/@Gower_Labs/BMad-Guide/_ct-workorders/CP-T1148-bat-support-abandoned-workorder-status.md`
- 本工單全文
- Worker 搜尋到的 BAT workorder status parser / enum / badge / filter / count 相關檔案

## 任務

1. 掃描 BAT 中所有 workorder status 相關 enum、parser、normalizer、badge mapping、filter 與 count 聚合邏輯。
2. 讓 `T####` / `CP-T####` workorder frontmatter 的 `status: ABANDONED` 成為合法狀態。
3. UI 呈現需落在 final / inactive 類別：
   - label 可用 `Abandoned` 或 `Abandoned / 不處理`
   - 中性灰或低飽和色
   - 不使用 pending 黃色，也不使用 error 紅色
4. 統計與篩選需符合：
   - 不計入 pending
   - 不計入 blocked
   - 不計入 partial
   - 可計入 done/final/closed 類聚合，或提供獨立 inactive/final 分類
5. 增加最小測試或 fixture，至少覆蓋一份 `status: ABANDONED` 的 workorder sample。
6. 更新 `CHANGELOG.md` 或 release note，記錄 BAT 支援 `ABANDONED` workorder status。
7. 完成後回填本工單回報區，包含 commit SHA、測試命令與結果，以及 CP-T1148 是否需要 source project 端額外同步。

## 邊界

- 僅要求 workorder `T####` / `CP-T####` 支援 `ABANDONED`。
- 不要把 `ABANDONED` 擴散成 BUG / PLAN 專用狀態，除非現有實作本來就共用同一個 final-state enum，而且測試能證明不會改變 BUG / PLAN 語意。
- 不修改 `2026_Cooperative` 專案程式碼。
- 不把 `ABANDONED` 顯示成 unknown、pending、blocked、partial 或 error。

## 驗收條件

- [x] BAT 可讀取含 `status: ABANDONED` 的 `T####` / `CP-T####` 工單，不顯示 unknown parse error
- [x] BAT UI badge / color / tooltip 能辨識 `ABANDONED`
- [x] BAT 工單 counts 不把 `ABANDONED` 算入 pending / blocked / partial
- [x] BAT filter / tab 中 `ABANDONED` 落在 final/inactive 類別，或有獨立篩選
- [x] 增加最小測試或 fixture：至少一份 `status: ABANDONED` workorder sample
- [x] 更新 `CHANGELOG.md` / release note
- [x] 回報 commit SHA 與測試證據，供 BMad-Guide 塔台回填 CP-T1148

## 建議驗證

Worker 先依實際 package scripts 判斷最小驗證集。至少需要：

- targeted parser / status tests：PASS
- 相關 UI mapping / count tests：PASS（若已有）
- repo 既有單元測試中與 CT workorder parser 相關的 subset：PASS

若全量 test 太重或有既有 unrelated failure，請明確列出未跑或失敗邊界，不得把 partial proof 寫成全量 PASS。

## Worker 執行規則

1. 讀取本工單全部內容。
2. 更新 frontmatter `status` 為 `IN_PROGRESS` 並填入 `started_at`。
3. 讀取 CP-T1148 鏡像工單。
4. 用 `rg` 搜尋狀態解析與 UI mapping，不要猜檔案。
5. 實作最小修補與測試。
6. 執行驗證。
7. Commit 變更，commit message 必須含 `T0359` 與 `CP-T1148`。
8. 更新本工單回報區，並把完成狀態改為 `FIXED`、`PARTIAL`、`BLOCKED` 或 `FAILED`。

---

## Worker 回報

### 完成狀態

FIXED — 修復已完成，等待塔台驗收 / CP-T1148 回填。

### 產出摘要

- `src/types/control-tower.ts` / `src/utils/ct-frontmatter.ts`：將 workorder `ABANDONED` 加入合法 frontmatter / legacy status set，保留 `INVALID` 防線；同時支援 `CP-T####` 檔名辨識。
- `src/components/ControlTowerPanel.tsx` / `src/components/KanbanView.tsx` / `src/styles/control-tower.css`：`ABANDONED` 顯示為灰色 final/inactive badge，獨立 `inactive` count 與 filter，不計入 pending / blocked / partial。
- `src/types/__tests__/control-tower.test.ts`：新增 `CP-T1148` `status: ABANDONED` fixture，覆蓋 parser、badge class/label、`T####` / `CP-T####` 檔案辨識。
- `src/types/__tests__/parser-parity.test.ts`：更新已 archived 的 parity samples，讓全量 unit suite 回到可執行狀態。
- `CHANGELOG.md`：記錄 BAT 支援 `ABANDONED` workorder status。
- `sprint-status.yaml`：最小同步 `last_updated` 與 next id（不改舊統計）。

### Commit SHA

d3f6580

### 驗證證據

- `npx vitest run src/types/__tests__/control-tower.test.ts src/types/__tests__/ct-frontmatter.test.ts` → PASS（2 files / 27 tests）
- `npm run test:unit` → PASS（39 files / 483 tests）
- `npm run compile` → PASS（Vite build 成功；僅既有 chunk size / static+dynamic import warnings）
- `git diff --check` → PASS（exit 0；僅 Git 的 LF→CRLF 工作區提示）

### 需要塔台或 2026_Cooperative 端配合事項

需要 BMad-Guide / 2026_Cooperative 塔台將 CP-T1148 回填 BAT implementation commit `d3f6580`。若 2026_Cooperative 端要驗證實機 BAT，需安裝或更新到包含 `d3f6580` 的 BAT build；本工單未修改 2026_Cooperative 專案程式碼。

### 回報時間

2026-05-23T20:31:16+08:00
