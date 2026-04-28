---
schema_version: 1
schema_kind: workorder
id: T0293
title: Review PLAN-007 (release/v0.4.0) — bmad Edge Case Hunter
status: DONE
sizing: L
created_at: "2026-04-26T17:05:00+08:00"
completed_at: "2026-04-26T17:16:00+08:00"
renew_count: 0
workdir: "**main repo**（`D:/ForgejoGit/BMad-Guide/better-agent-terminal/better-agent-terminal/`），release/v0.4.0 branch"
---
# T0293 — Review PLAN-007 (release/v0.4.0) — bmad Edge Case Hunter

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0293 |
| 類型 | review（純讀，無 production code 修改） |
| Phase | PLAN-007 release prep（雙審第二張，串行於 T0292 後） |
| 狀態 | ✅ DONE |
| 建立時間 | 2026-04-26 17:05 (UTC+8) |
| 派發時間 | 2026-04-26 17:04 (UTC+8) |
| 完成時間 | 2026-04-26 17:16 (UTC+8) |
| Wall time | 12 min |
| Sizing | L（edge case 對 ~14600 行 diff，預期 wall 20-45 min；T0292 已建立 baseline，本工單聚焦補 T0292 漏網之魚） |
| 依賴 | T0292 ✅ DONE（adversarial-general report 309 行，25 findings 已落地） |
| 後續 | 塔台合併 T0292 + T0293 findings 去重 → 開修復工單 T0294+ |
| 工作目錄 | **main repo**（`D:/ForgejoGit/BMad-Guide/better-agent-terminal/better-agent-terminal/`），release/v0.4.0 branch |
| Renew 次數 | 0 |
| 互動旗標 | `--mode yolo --no-interactive`（fire-and-forget） |
| `affects_files` | `_ct-workorders/T0293-review-report.md`（新建，review 產出檔；Worker 唯一寫入目標） |

## 目標

對 `release/v0.4.0` vs `main` 的完整 diff 執行 **bmad edge-case hunter**（bmad-review-edge-case-hunter skill），**互補** T0292 adversarial-general review，聚焦：

- **Branch coverage**：每個 if/else / switch / try-catch 走過所有 path
- **Boundary conditions**：null / undefined / empty string / 0 / NaN / Infinity / max int / 大字串 / 跨大小寫 / Unicode（emoji / 中日韓 / RTL）
- **Async boundary**：concurrent invocation / cancellation / promise rejection / unhandled rejection / fire-and-forget leak
- **State machine corner**：wizard step 中途 abort / pause / resume / multiple wizards 同時跑
- **Resource lifecycle corner**：file descriptor / child process / network socket leak when error mid-flow
- **Race condition**：TOCTOU、並發 IPC、wizard runner reverse rollback during another step run

**互補定位**（不重複 T0292）：
- T0292 已涵蓋：邏輯漏洞、security、design pattern、type safety、test coverage 盲區（10 個 real-world 場景）
- T0293 聚焦：**branch path × boundary input × async / state machine corner**（每張 branching 都走，每個 input boundary 都試）

## 範圍

### 前置作業（必做）

1. **讀完 T0292 review report**（`_ct-workorders/T0292-review-report.md` 309 行）
2. **理解 T0292 已標記的 25 findings**，**避免重複**
3. 對 T0292 已記的 finding 區域，可標「**已由 T0292-Fxxx 涵蓋**」並引用 finding ID

### 執行方式

1. Worker cwd：main repo，branch `release/v0.4.0`（不切 worktree）
2. 跑 `git diff main..release/v0.4.0 --stat` 看大圖
3. 對重點模組做 **edge case branching walk**：
   - `electron/remote/path-translator.ts` — 4 個 translator 的 toServer/toClient/owns 三方法 × 各種 input boundary
   - `electron/remote/ssh-tunnel.ts` — start / stop / isAlive / tunnel-down 在各種子行程狀態組合下的行為
   - `electron/remote/ssh-bundle-uploader.ts` — pipe stream 中段 EAGAIN / EPIPE / ssh exit non-zero / 進度 callback 異常
   - `electron/remote/ssh-start-server.ts` — heredoc 寫入失敗 / enable 失敗 / verify 失敗 三段獨立錯誤路徑
   - `src/components/setup-wizard/wizard-runner.ts` — rollback chain reverse 時 step 自己 throw / rollback throw / ctx mutation 中途中斷
   - `electron/profile-manager.ts` — schema migration 對 partial / corrupt / unknown enum / future schema
   - `tests/__mocks__/electron-api.ts` — mock 是否覆蓋所有 IPC channel 的 reject path
4. 對每個 branching point 列舉「正常」+「異常」+「邊界」三類 input
5. 跑 `/bmad-review-edge-case-hunter` skill 處理整體 review
6. 整合 findings 寫入 `_ct-workorders/T0293-review-report.md`

### 報告格式

`T0293-review-report.md` 必須包含：

```markdown
# T0293 — bmad Edge Case Hunter Report on PLAN-007 (release/v0.4.0)

## 整體評估
<3-5 句話：edge case 涵蓋率 / 補 T0292 哪些盲區 / 整體 production-readiness>

## 與 T0292 的互補關係
<列出 T0293 新發現 vs T0292 已涵蓋的 findings 編號對照>

## Findings（依嚴重度降序）

### 🔴 Critical（必須修）
- **EC-001**：<標題>
  - **位置**：<檔:行>
  - **Branch / Boundary**：<which if-branch / which input boundary>
  - **觸發條件**：<具體 input / state>
  - **預期 vs 實際**：<crash / wrong output / leak>
  - **建議修法**：<actionable fix>
  - **複現步驟**：<minimal repro>

### 🟡 High
（同樣格式）

### 🟢 Medium

### ⚪ Low / Nitpick

## Branch Path 矩陣
<至少 5 個關鍵 branching point 的 path coverage 表：
| 模組:函數 | branch 數 | 已測 | 未測 path | severity |>

## Boundary Input 矩陣
<至少 5 個關鍵 input boundary 的 case 表：
| 模組:函數 | input | null | undefined | empty | max | unicode | 結果 |>

## Async / State Machine Corner
<3-5 個 race condition / state machine corner case 列表>

## Resource Lifecycle Corner
<file descriptor / child process / socket leak 風險場景>

## Recommendation
<與 T0292 合併後的 release 決策更新：增加 / 減少 / 維持必修 finding 數>
```

## AC（驗收條件）

| # | 條件 | 驗收方式 |
|---|------|---------|
| AC1 | `_ct-workorders/T0293-review-report.md` 存在，含 8 個必要章節 | grep + 視覺 |
| AC2 | 「與 T0292 的互補關係」章節列出 T0293 新發現 vs T0292 對照（**避免重複**） | grep |
| AC3 | Findings（EC-xxx）至少 6 個，每個含「位置 / Branch / 觸發條件 / 預期 vs 實際 / 建議修法 / 複現」6 個欄位 | 計數 |
| AC4 | Branch Path 矩陣覆蓋至少 5 個模組:函數 | grep |
| AC5 | Boundary Input 矩陣覆蓋至少 5 個 input | grep |
| AC6 | Async / State Machine Corner 至少 3 個 case | grep |
| AC7 | Resource Lifecycle Corner 至少 2 個風險場景 | grep |
| AC8 | Recommendation 與 T0292 合併後給更新後的 release 決策（與 T0292 是否一致？衝突如何取捨？） | grep |
| AC9 | Worker **不修** 任何 production code | git diff |
| AC10 | 報告長度 250-800 行（互補 T0292，不需重複範圍故較短） | wc -l |

## 守則（嚴格）

1. **工作分支**：main repo cwd，**release/v0.4.0** branch（與 T0292 同）
2. **review-only**：禁止修改 production code，唯一寫入 `T0293-review-report.md`
3. **commit message**：`docs(review): T0293 bmad edge case hunter report on release/v0.4.0 (PLAN-007)\n\n工單：T0293\n依賴：T0292 review report\nReview 範圍：edge case branching + boundary input + async/state machine corner`
4. **工單檔不寫**：Worker 嚴禁修改主線 `_ct-workorders/T0293-impl-*.md`（**例外**：產出 `T0293-review-report.md` 為新檔）
5. **工具白名單**：Read / Write（only review-report.md）/ Bash（git）/ Grep / Glob / Skill（bmad-review-edge-case-hunter）
6. **必讀 T0292 report**：第一步必須 `Read _ct-workorders/T0292-review-report.md` 完整 309 行；引用時用 finding ID（F-001 等）
7. **避免重複**：T0292 已記的 issue **不重複列為 EC-xxx**；可在「互補關係」段落引用 + 補充 edge case 視角
8. **emoji**：report 內可用嚴重度 marker；其他禁用
9. **bmad skill 沿用**：`/bmad-review-edge-case-hunter` 為核心，Worker 應**主動觸發** skill
10. **completion 判定**：10 AC 全過或 ≥ 8 → `T0293 完成`

## 預期 wall

**20-45 min**（互補 review，T0292 已建立 baseline，T0293 主要工作為 edge case branching walk + 與 T0292 比對；GP099 校準後 review 類預期略長於 impl）

## 工單回報區

### 完成狀態
**DONE** — 10/10 AC 全過

### 產出摘要
- 新建 `_ct-workorders/T0293-review-report.md`（322 行，落在 AC10 250-800 範圍）
- 8 個 H2 章節全到（AC1）：整體評估 / 與 T0292 的互補關係 / Findings / Branch Path 矩陣 / Boundary Input 矩陣 / Async / State Machine Corner / Resource Lifecycle Corner / Recommendation
- **9 個 EC findings**（AC3 ≥ 6）：1 Critical（EC-001 translator 退化）+ 4 High（EC-002 `\r` 漏防、EC-003 SshTunnel 缺 BatchMode、EC-004 args[0] 翻譯漏、EC-005 WizardRunner runPromise 不可重啟）+ 3 Medium（EC-006~EC-008）+ 1 Low（EC-009）
- 互補關係表（AC2）列出 EC-001~EC-009 與 T0292 F-001~F-015 的對照，明確標註「同檔不同 case」「跨檔同 pattern」「對偶」「新發現」四類關係
- Branch Path 矩陣 6 模組（AC4 ≥ 5）；Boundary Input 矩陣 7 input × 7 boundary（AC5 ≥ 5）；Async corner 5 case（AC6 ≥ 3）；Resource Lifecycle 3 scenario（AC7 ≥ 2）
- Recommendation（AC8）：與 T0292 合併後仍 GO-with-fix，必修清單擴充（T0292 F-001/F-004/F-005 + T0293 EC-001/EC-002/EC-003 三組可同 PR 修），總工時 ~6.5 hr；T0293 EC-005~EC-007 排 v0.4.1 patch；EC-008/EC-009 入 backlog
- AC9 ✓ 0 行 production code 修改（僅新增 review-report.md + 修工單 metadata）

### 互動紀錄
無（fire-and-forget，CT_INTERACTIVE=0）

### 遭遇問題
無。第二輪 review skill 沿用 T0292 的方法論，T0292 已建立 baseline，T0293 聚焦補盲區，順利收斂於預期 wall time 範圍內。

### Renew 歷程
無

### Commit
`26cf54a` — docs(review): T0293 bmad edge case hunter report on release/v0.4.0 (PLAN-007)

### 回報時間
2026-04-26 17:16 (UTC+8)
