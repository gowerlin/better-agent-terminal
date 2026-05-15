---
schema_version: 1
schema_kind: workorder
id: T0348
title: "PLAN-033 Sprint 2: 收工流程規則 patch（_local-rules）"
status: DONE
created_at: "2026-04-27T17:45:00+08:00"
started_at: "2026-04-27T17:59:00+08:00"
completed_at: "2026-04-27T18:01:00+08:00"
renew_count: 0
---
# T0348 — PLAN-033 Sprint 2: 收工流程規則 patch（_local-rules）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0348 |
| 標題 | _local-rules.md 補 archive 觸發規則 + Step 0 大小檢查 + Quick Recovery hygiene |
| 類型 | rule-update |
| 優先級 | 🔴 High |
| 狀態 | ✅ DONE |
| 建立時間 | 2026-04-27 17:45 (UTC+8) |
| 開始時間 | 2026-04-27 17:59 (UTC+8) (重派，前次 17:45 因 hook 錯誤中斷) |
| 完成時間 | 2026-04-27 18:01 (UTC+8) |
| 派發模式 | `--mode yolo --no-interactive` |
| 關聯 PLAN | PLAN-033 |
| 關聯研究 | T0346（規格收斂） |
| 關聯實作 | T0347（archive 落地，commit `a9a5c82`） |
| 預估時間 | 30-45 min |
| Renew 次數 | 0 |
| affects_files | `_ct-workorders/_local-rules.md` |

## 背景

T0347 完成 archive 結構落地（_tower-state.md 270 KB → 48 KB，撞 256 KB 上限解除）。但 48 KB 仍超 30 KB 軟警告，根因是 🌅 起手式區段內嵌 Session 31 大段摘要（~234 行）— 這是 PLAN-033 spec 未覆蓋的角落：**Quick Recovery 不應內嵌歷史 session 摘要**。

本工單在本專案 `_local-rules.md` 補完規則文案，作為上游 SKILL.md PR（T0349）的本地先行落地與驗證。

## 目標

在 `_ct-workorders/_local-rules.md` 補三組規則文案：

1. **State archive 觸發規則**（每次收工自動 + `*archive --state` 補救命令）
2. **Step 0 大小檢查規則**（軟警告 30 KB / 強制 60 KB）
3. **Quick Recovery hygiene 規則**（不內嵌歷史 session 摘要）

## 任務範圍

### A. State archive 觸發規則

寫入 `_local-rules.md` 新增段落「## Tower State Archive 規則」：

```markdown
## Tower State Archive 規則（PLAN-033）

### 自動觸發（收工流程整合）

每次收工寫快照前，塔台執行：
1. 識別 `_tower-state.md` 中即將被擠出 hot path 的「前前 session 收工快照」段落
2. 依 session header ISO 日期（regex `\d{4}-\d{2}-\d{2}`）判定季度
3. Append 到 `_archive/state-snapshots/<YYYY-Q?>.md`（無檔則建）
4. 若目標季檔 size > 200 KB → 自動切割為 `<YYYY-Q?>-a.md` / `<YYYY-Q?>-b.md`（依 entry count 對半）
5. 更新 `INDEX.md`（append session row + 更新 `Last archived session #`）
6. 從 `_tower-state.md` 移除該段
7. 寫入新「本 Session」段，原「本」降級為「前」

### 補救命令：*archive --state --rebuild-index

異常情境使用：
- INDEX.md 損毀或解析失敗
- 收工流程中斷（archive 半套）
- 手動補 archive（跳過某次 session）

行為：
1. 掃 `_archive/state-snapshots/2026-Q*.md` 所有檔案
2. 抽 session header + 日期 + summary 重建 INDEX.md
3. 原 INDEX.md 備份為 `INDEX.md.bak.<UNIX_TS>`
4. 報告新增/修正/重複的 row 數

### 季檔切割規則

- 主軸：自然季度（2026-Q1.md / 2026-Q2.md）
- 後備：單檔 > 200 KB 自動切 `-a/-b` 後綴
- 切割點：依 entry count 對半（非 byte 等分），確保時間軸連續性
- INDEX.md 表格 `File` 欄位記錄實際檔名（含後綴）

### INDEX.md 格式

固定欄位：`| Session | Date | File | Summary |`

- **Session**：原 header label（如「第三十五 session」），允許非整數命名
- **Date**：ISO `YYYY-MM-DD`
- **File**：實際季檔名（如 `2026-Q2-b.md`）
- **Summary**：header 後第一段截斷至 ≤ 60 字
```

### B. Step 0 大小檢查規則

寫入 `_local-rules.md` 新增段落「## Tower State Size 檢查」：

```markdown
## Tower State Size 檢查（PLAN-033）

啟動 Step 0（Full Scan / Fast Path）額外驗證 `_tower-state.md` 大小：

| 大小 | 行為 |
|------|------|
| < 30 KB | ✅ 正常 |
| 30 KB ~ 60 KB | ⚠️ 軟警告 — 顯示「state 已超軟警告閾值，建議下次收工後跑 *archive --state」 |
| 60 KB ~ 256 KB | 🔴 強制提示 — 顯示「state 接近 Read 上限，建議**立即** *archive --state --rebuild-index」 |
| > 256 KB | ❌ Read 工具上限觸發 — 強制走 `limit=N` + grep 降級恢復 |

實作位置：Step 0 偵測完成後、面板顯示前。
```

### C. Quick Recovery hygiene 規則（塔台增補）

寫入 `_local-rules.md` 新增段落「## Quick Recovery Hygiene」：

```markdown
## Quick Recovery Hygiene（PLAN-033 補規）

### 設計原則

`_tower-state.md` 開頭的 🌅 起手式（Quick Recovery）區段語意為「**最新狀態指引**」，不應內嵌歷史 session 完整摘要。

### 違規情境

T0347 落地後實測：起手式內嵌 Session 31 收工快照大段（~234 行），導致瘦身後 hot path 仍 48 KB（超 30 KB 軟警告）。

### 規則

1. ✅ 起手式可包含：
   - 立即待辦（≤ 5 條）
   - 近期完成摘要（≤ 5 條，每條一行）
   - 快速連結（指向其他文件）
   - 編號起始（T#### / BUG-### / PLAN-### / D###）

2. ❌ 起手式禁止內嵌：
   - 完整 session 收工快照（屬 archive 範圍）
   - 大段時間線（> 10 行）
   - 詳細統計表格（屬本 session / 前 session 區段）

3. **若起手式因任何理由超過 50 行**：
   - 視為違規，需重構
   - 大段內容應移到對應 session 收工快照區段
   - 若內容屬「跨 session 持續性指引」，移到 _local-rules.md 或獨立文件

### 自動偵測（Step 0 整合）

Step 0 額外掃 🌅 起手式區段行數：
- > 30 行 → ⚠️ 軟警告
- > 60 行 → 🔴 強制提示重構
```

### D. 寫入策略

讀取現有 `_ct-workorders/_local-rules.md`：
- 若三段規則皆不存在 → 在文件末尾追加（`---` 分隔）
- 若已有同名段落 → **stop and report**（觸發 *import 衝突檢查邏輯，不自動覆蓋）

### E. Commit

訊息：
```
chore(rules): add tower state archive + size check + Quick Recovery hygiene rules (PLAN-033 Sprint 2)

- State archive 觸發規則（收工自動 + *archive --state --rebuild-index 補救）
- Step 0 size 檢查規則（30/60/256 KB 三級）
- Quick Recovery hygiene 規則（起手式不內嵌歷史摘要）

本專案先行落地，T0349 同步上游 SKILL.md。

Closes T0348 (PLAN-033 Sprint 2)
```

## 完成定義（DoD）

1. ✅ `_local-rules.md` 三段規則寫入（A/B/C 全部）
2. ✅ 規則文案語氣與既有 `_local-rules.md` 一致（中文、表格、決策樹）
3. ✅ 衝突檢查通過（無同名段落覆蓋風險）
4. ✅ 單 commit 收尾

## OOS

- ❌ 不修改 SKILL.md / memory-protocol.md（T0349 上游 PR 範圍）
- ❌ 不實作 `*archive --state` 命令程式碼（規則文案而已，實作併入下個 sprint 或 T0349）
- ❌ 不重構 _tower-state.md 起手式（讓規則先就位，重構是另一回事 — 列入下次收工事項）

## 互動旗標

`--no-interactive`：純文案撰寫工作。

例外：若 `_local-rules.md` 已有同名段落 → 停手回報塔台處理衝突（避免覆蓋既有規則）。

## 回報區

### A. 寫入結果

- [x] `_local-rules.md` Tower State Archive 規則段落：**新增**（line 327）
- [x] `_local-rules.md` Tower State Size 檢查段落：**新增**（line 371）
- [x] `_local-rules.md` Quick Recovery Hygiene 段落：**新增**（line 386）
- [x] 衝突偵測：**無** — pre-write grep 三組關鍵字（`Tower State Archive` / `Tower State Size` / `Quick Recovery Hygiene` / `state-snapshots` / `軟警告`）皆零命中

### B. 文件 size

- _local-rules.md 修改前 size: 11,507 B
- _local-rules.md 修改後 size: 14,992 B
- 新增 LoC: ~95（三段含分隔線）

### C. Commit

- Commit hash: `dea3281`
- 訊息：`chore(rules): add tower state archive + size check + Quick Recovery hygiene rules (PLAN-033 Sprint 2)`

### 結論摘要

T0348 完成。`_local-rules.md` 末尾追加三段 PLAN-033 規則文案（archive 觸發 + size 三級檢查 + Quick Recovery hygiene），以 `---` 分隔，無衝突。文件 11.5 KB → 15.0 KB（+3.5 KB / +95 LoC）。為 T0349 上游 SKILL.md PR 鋪路。

---

**狀態**：✅ DONE — 2026-04-27 18:01
