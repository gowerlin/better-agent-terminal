# Tower State — better-agent-terminal

> 最後更新:2026-04-27 22:08(**第三十九 session 收工快照:輕量 session, ~30 min wall, PLAN-033 Sprint 2 真正收尾(上游 PR 階段)。(1) T0350a 預掃發現上游 working tree 有 v4.4.1↔v4.4.0 同步錯誤 + BAT args 重構 working M。(2) T0350 派發(YOLO mjs `--mode yolo --no-interactive`),Worker 6 min DONE — 7 entries drift 決策表 + 兩個獨立 commit(基底對齊 e92bb01 + PLAN-033 三段 794f0ea)。(3) push 上游 dev-main(`ca5097b..794f0ea`)。(4) *evolve 4 entries — Global GP122-124(sprint 五件套節奏 / drift 決策表 / push gate)+ Project L113(monorepo dev-main 直接 commit)。下次起手:PLAN-032 Sprint 2 解封 — T0330 keystone(YOLO 鏈式可重啟),或 T0324 DGX Spark dogfood VERIFY,或上游目錄 rename 評估(v4.4.1 → v4.4.2)。**)

---

## 🛏 本 Session 收工快照 (第三十九 session, 2026-04-27 ~21:38 - 22:08, ~30 min wall, PLAN-033 Sprint 2 上游 PR 真正收尾)

### 本輪時間線

1. **21:38**（起手）：Fast Path 載入 session 38 快照；使用者選 [A] 派 T0350 上游 SKILL.md PR
2. **21:39-21:48**：需求對齊 3 輪 — Q1（產出形式）、Q2（上游路徑）、Q3（合併範圍）；使用者反饋「應該是 v4.4.1，全部合併」→ 範圍從精準三段擴為全量 drift
3. **21:46**：T0350a 預掃 — 上游 dev-main 既有 M（5 處 v4.4.1→v4.4.0 降版 + 4 處 BAT args 重構），與 PLAN-033 三段零 conflict
4. **21:48**：T0350 工單產出 + YOLO mjs 派發（`--mode yolo --no-interactive`）
5. **21:51-21:54**：Worker DONE（6 min）— 兩個 commit `e92bb01` + `794f0ea`，7 entries drift 決策表，Phase 4 自檢全綠
6. **21:55**：塔台 chore commit `6c0951b`（T0350 工單檔回報區 backfill）
7. **21:56**：Push 上游 `ca5097b..794f0ea` on dev-main
8. **21:58-22:05**：*evolve 4 entries — GP122-124（Global，commit `028000b`）+ L113（Project，commit `d31ace9`）
9. **22:05-22:08**：Session 36 entry archive 至 2026-Q2-b.md (#56) + 收工快照寫入

### 本 session 統計

| 指標 | 值 |
|------|-----|
| Wall time | ~30 min（21:38-22:08） |
| Worker wall | ~6 min（T0350 21:51-21:54） |
| 工單派發 | 1（T0350，YOLO） |
| Worker DONE | 1 / 1（0 Renew / 0 FAILED / 0 PARTIAL） |
| 上游 commits | 2（`e92bb01` 基底對齊 + `794f0ea` PLAN-033 三段，已 push） |
| 本專案 commits | 3（`6c0951b` T0350 backfill / `028000b` GP122-124 / `d31ace9` L113） |
| 萃取項 | 4（3 Global GP + 1 Project L） |
| BUG 狀態變更 | 無 |
| PLAN 狀態變更 | PLAN-033 Sprint 2 真正收尾（含上游 PR） |

### PLAN-033 Sprint 2 完整五件套（跨 3 sessions）

| 工單 | 階段 | Session | Commit |
|------|------|---------|--------|
| T0346 | research | 38 | DONE |
| T0347 | implement (archive) | 38 | `a9a5c82` |
| T0348 | codify-rule | 38 | `dea3281` |
| T0349 | dogfood (hygiene) | 38 | `ff528ee` |
| **T0350** | **upstream-PR** | **39** | **`e92bb01` + `794f0ea`** |

GP122（五件套節奏）+ GP123（drift 決策表）+ GP124（push gate）完整 dogfood 閉環。

### 熱區現況（收工）

| 類型 | 數量 | 狀態分布 |
|------|------|---------|
| **T 工單** | 94 + 4 reports | 81 DONE + 9 PENDING（T0324 user dogfood / T0326 待外部 / T0329 DONE / T0341/T0343 FIXED / T0330-T0340 PENDING Sprint 2-5） |
| **BUG** | 18 | 5 OPEN + 13 CLOSED |
| **PLAN** | 13 | 2 IDEA + 1 PLANNED + 2 IN_PROGRESS（PLAN-031/032）+ 7 DONE（含 PLAN-033 Sprint 2 真正完成）+ 1 DROPPED |
| **EXP** | 1 | EXP-HEADLESS-001 CONCLUDED |

### 下 session pending（優先序）

1. 🔴 **PLAN-032 Sprint 2 解封 — T0330 keystone**（YOLO 鏈式可重啟，BUG-075 三層防線 + 五件套節奏已驗證）
2. 🔴 **T0324 DGX Spark dogfood VERIFY**（user 親跑 / 待回報）
3. 🟡 **PLAN-032 Sprint 2 後續 T0331-T0334**（依賴 T0330）
4. 🟡 **上游目錄 rename 評估**（v4.4.1 → v4.4.2 承載 PLAN-033 三段是否值得 bump）
5. 🟡 **BUG-071 metadata 對齊**（依 T0321/T0322/T0324 結果決定 OPEN→FIXED/VERIFY）
6. 🟢 **BUG-061** CodexAgentPanel.tsx tsc errors（dev-only 非阻塞）
7. 🟢 **Archive batch 2**（04-28 起合格：BUG-070/069 + T0303-T0312）

### 恢復指引（下 session 起手）

1. Fast Path 載入本快照（< 7 天）
2. **熱區乾淨，PLAN-033 Sprint 2 真正完整收尾（含 upstream PR）**
3. **編號起始**：T0351 / BUG-076 / PLAN-034 / D110 / EXP-[TOPIC]-001
4. **塔台規則**：auto-session: yolo（建議延續）；experience-level: standard
5. **建議起手動作**：
   - **PLAN-032 Sprint 2 鏈式派發**（T0330 keystone → T0331-T0334，業務邏輯）
   - 或 T0324 VERIFY 結果處理（若 user 已測完）
   - 或上游目錄 rename 工單（v4.4.1 → v4.4.2，承載 PLAN-033 三段）

### 本 session 教訓（已萃取至 GP122-124 + L113）

1. **GP122**：Sprint 五件套節奏（research → implement → codify-rule → dogfood → upstream-PR）— GP119 三件套擴展版
2. **GP123**：Drift 決策表取代盲目合併（雙向 sync 場景通用，T0350 7 entries 0 conflict 證實）
3. **GP124**：上游 PR / fork sync 工單必設 push gate（搭配 Never Auto-Push 全局規則）
4. **L113**：Monorepo dev-main 直接 commit（不開 feature branch）的適用條件（BMad-Guide monorepo 專屬）

### 本 session 成就

- 🏆 PLAN-033 Sprint 2 跨 3 sessions（38+39）完整五件套閉環，GP119 三件套節奏升級為 GP122 五件套
- 🎉 T0350 7 entries drift 決策表設計優雅 — 0 conflict 一次到位，使用者驗收 OK
- 🎉 GP123（drift 決策表）+ GP124（push gate）兩條 cross-project pattern 落地
- 🎉 全 session 0 Renew / 0 FAILED / 0 PARTIAL，1 工單 YOLO 派發 + 自然收斂
- 🎉 上游 brain-sync 自動拉到 v4.4.1 skill（system-reminder skills list 證實）

---

## 🛏 前 Session 收工快照 (第三十八 session, 2026-04-27 ~18:00 - 21:35, ~3.5 hr wall, PLAN-033 Sprint 2 完整四件套收尾 + dogfood 驗證)

### 本輪時間線

1. **18:00**（起手）：Fast Path 載入 session 37 快照；偵測 T0346/T0347/T0348 三件套已落地（`d1f92dd` / `a9a5c82` / `dea3281` / `4775c6d`），熱區待辦 = T0345 漏 commit + Quick Recovery 仍 48 KB 違反 GP121 hygiene
2. **18:01-18:02**：使用者選 [3]→[5]→[2]→[1] 建議順序執行
3. **18:02**：T0345 chore commit `f56fe5e`（純 metadata 補登 + 5/-2 行，GP078 自主 commit 範圍）
4. **18:03-18:08**：`*evolve` 3 條 Global GP 萃取（GP119 三件套節奏 / GP120 skill 本地先行 / GP121 實證驅動補規則），commit `1c163fe`
5. **18:08**：T0349 派發（mjs `--mode on --no-interactive`），commit `fa44905`
6. **21:23-21:29**：Worker T0349 DONE — 起手式 232→28 行，size 49.5 KB→24 KB（軟警告綠燈），Session 31 archive 至 2026-Q2-b.md row #55，commit `ff528ee`（過程曾撞 PowerShell `AddRange(System.Object[])` 型別錯誤，apply_patch 修復）
7. **21:35**：T0349 chore commit `5499509`（worker 漏 commit 工單檔，GP118 範圍）；本快照寫入

### 本 session 統計

| 指標 | 值 |
|------|-----|
| Wall time | ~3.5 hr（18:00-21:35） |
| Worker wall | ~6 min（T0349 21:23-21:29） |
| 工單派發 | 1（T0349） |
| Worker DONE | 1 / 1（0 Renew / 0 FAILED / 0 PARTIAL） |
| Tower chore commits | 3（`f56fe5e` T0345 / `5499509` T0349 / `fa44905` dispatch） |
| 主線 commits | 3（`f56fe5e` / `1c163fe` learnings / `fa44905` dispatch / `ff528ee` worker / `5499509` backfill = 5 total） |
| 萃取項 | 3 Global GP（GP119/120/121） |
| _tower-state.md size | 49,502 → 24,077 bytes（軟警告綠燈） |
| 起手式行數 | 232 → 28（hygiene 規則達標） |

### 熱區現況（收工）

| 類型 | 數量 | 狀態分布 |
|------|------|---------|
| **T 工單** | 93 + 4 reports | 80 DONE + 9 PENDING（T0324 user dogfood / T0326 待外部 / T0329 DONE / T0341/T0343 FIXED / T0330-T0340 PENDING Sprint 2-5） |
| **BUG** | 18 | 5 OPEN（BUG-061/071/072/073/074）+ 13 CLOSED |
| **PLAN** | 13 | 2 IDEA + 1 PLANNED + 2 IN_PROGRESS（PLAN-031/032）+ 1 Sprint 2 進行中（PLAN-033）+ 6 DONE + 1 DROPPED |
| **EXP** | 1 | EXP-HEADLESS-001 CONCLUDED |

### PLAN-033 Sprint 2 完整收尾

| 工單 | 標題 | Commit |
|------|------|--------|
| T0346 | research（規格收斂） | DONE |
| T0347 | archive 結構落地（270→48 KB） | `a9a5c82` |
| T0348 | _local-rules.md 三段規則 | `dea3281` |
| T0349 | Quick Recovery hygiene 重構（48→24 KB） | `ff528ee` |

GP119（三件套節奏）+ GP121（實證驅動補規則）完整 dogfood 閉環。

### 下 session pending（優先序）

1. 🔴 **T0350 上游 SKILL.md PR**（PLAN-033 Sprint 2 收尾，把 _local-rules.md 三段規則合進 `~/.claude/skills/control-tower/SKILL.md` 主檔）
2. 🔴 **PLAN-032 Sprint 2 解封 — T0330 keystone**（YOLO 鏈式可重啟，BUG-075 三層防線已落地）
3. 🔴 **T0324 DGX Spark dogfood VERIFY**（user 親跑進行中 / 待回報）
4. 🟡 **PLAN-032 Sprint 2 後續 T0331-T0334**（依賴 T0330）
5. 🟡 **PLAN-032 Sprint 3-5 — T0335-T0340**
6. 🟢 **BUG-071 metadata 對齊**：T0321/T0322 已實作 + 等 T0324 dogfood
7. 🟢 **BUG-061** CodexAgentPanel.tsx tsc errors（dev-only 非阻塞）
8. 🟢 大批歸檔 batch 2（04-28 起合格）
9. 🟢 `*archive --state` 命令程式碼實作（T0348 OOS 列入後續 sprint）

### 恢復指引（下 session 起手）

1. Fast Path 載入本快照（< 7 天）
2. **熱區乾淨，PLAN-033 Sprint 2 四件套收尾完整**
3. **編號起始**：T0350 / BUG-076 / PLAN-033 仍 IN_PROGRESS（T0350 後 → DONE 候選）/ D110 / EXP-[TOPIC]-001
4. **塔台規則繼續**：auto-session 切回 yolo（建議）；experience-level: standard
5. **建議起手動作**：
   - **T0350 上游 SKILL.md PR**（PLAN-033 Sprint 2 真正收尾，建議優先）
   - 或 PLAN-032 Sprint 2 鏈式派發（T0330 keystone）
   - 或 T0324 VERIFY 結果處理（若 user 已測完）

### 本 session 教訓（已萃取至 GP119-121）

1. **GP119**：規格 → 實作 → 規則文案 三件套 sprint 節奏（T0346→T0347→T0348→T0349 完整 dogfood）
2. **GP120**：skill/library 開發採「本專案先行 + 上游 PR」分流（T0348 → T0350 鋪路）
3. **GP121**：實證驅動補規則（T0347 落地後實測 232 行 hygiene 違規 → T0348 補規 → T0349 dogfood 驗證）

### 本 session 成就

- 🏆 PLAN-033 Sprint 2 完整四件套（research → implement → codify-rule → dogfood-validate）一次閉環
- 🎉 _tower-state.md size 270 KB → 48 KB → **24 KB**，撞 256 KB Read 上限解除 + 軟警告綠燈
- 🎉 GP121（實證驅動補規則）完整 self-validation：T0347 暴露問題 → T0348 補規則 → T0349 dogfood 驗證規則可執行
- 🎉 *evolve 3 條 Global GP 落地，含跨專案高價值 sprint pattern
- 🎉 全 session 0 Renew / 0 FAILED / 0 PARTIAL，1 工單派發 + 4 chore commits 乾淨收尾

---

## 🛏 前前 Session 收工快照 (第三十七 session, 2026-04-27 ~16:21 - 16:50, ~30 min wall, BUG-075 三層防線收尾 + *sync + *evolve)
> 第三十六 session 收工快照已 archive 至 `_archive/state-snapshots/2026-Q2-b.md` (#56)。

### 本輪時間線

1. **16:21**（起手）：Fast Path 載入 session 36 快照；偵測 session 36→37 之間已落地 7 commits（T0341/T0343 fix + 3 regression test PENDING + server bundle workflow + verify-imports fix），但 BUG-075 metadata 仍 OPEN，T0342/T0344/T0345 PENDING
2. **16:21-16:25**：使用者選 [A] 派 BUG-075 regression tests；確認 [A3] 並行 T0342+T0344 → T0345 收尾、走 mjs 派發（順便當 e2e 驗證）、`auto-session: on`
3. **16:25**：mjs 並行派發 T0342 + T0344（`--mode on --no-interactive`）
4. **16:31**：T0342 DONE — `tests/bat-terminal-msys.test.mjs` 1 unit + 1 integration，189 tests 綠，revert T0341 → 紅；commit `873435a`
5. **16:34**：T0344 DONE — `electron/terminal-command-handlers.ts` 抽出 + diagnostics log + 3-shot integration test，189 tests 綠；commit `f98a495` + close `f26e0db`
6. **16:35**：塔台 chore commit `a60f38a`（T0342 工單檔回報區 BAT 通知段落 backfill +8/-3）
7. **16:35**：mjs 派發 T0345（`--mode on --interactive`）
8. **16:42**：T0345 DONE — Playwright e2e + Mock BAT RemoteServer，三 shot 全綠（codex argv probe `$ct-exec T0345` literal + bash.exe basename + MSYS_NO_PATHCONV=1），revert T0341 → 紅；commit `6d4da38`；BUG-075 metadata → CLOSED
9. **16:42-16:45**：*sync patch — _bug-tracker.md（OPEN +1 / FIXING -1 / CLOSED +1）+ _backlog.md（PLAN-032 IN_PROGRESS 加入）；歸檔候選 0 張（archive_days 7 未到）
10. **16:45-16:50**：*evolve 7 entries — Global GP113-118（6）+ Project L112（1）；commits `d42cb42`（_learnings + indices）+ `f465548`（Global learnings 含 session 36 留下的 GP110-112）
11. **16:50**：使用者選 [F] 收工 → 寫本快照

### 本 session 統計

| 指標 | 值 |
|------|------|
| Wall time | ~30 min（16:21-16:50） |
| Worker wall | ~17 min（T0342+T0344 並行 ~9 min + T0345 ~7 min） |
| 工單派發 | 3（T0342 / T0344 / T0345） |
| Worker DONE | 3 / 3（無 PARTIAL，無 FAILED，無 Renew） |
| 主線 commits | 7（`873435a` T0342 + `f98a495` T0344 + `f26e0db` close + `a60f38a` chore backfill + `6d4da38` T0345 + `d42cb42` sync/L112 + `f465548` Global learnings） |
| 萃取項 | 7（GP113-118 + L112） |
| Tests 增量 | +2 unit + 1 e2e（189 → 191 unit + 1 e2e） |
| BUG 狀態變更 | BUG-075 OPEN → CLOSED；BUG-071 FIXING → OPEN（per metadata SoT 修正） |
| PLAN 狀態變更 | 無 |

### 熱區現況（收工）

| 類型 | 數量 | 狀態分布 |
|------|------|---------|
| **T 工單** | 89 + 4 reports | 79 DONE + 10 NEW（T0324 user dogfood / T0326 待外部 / T0329 DONE / T0341/T0343 FIXED / T0342/T0344/T0345 DONE / T0330-T0334 PENDING Sprint 2 / T0335-T0340 PENDING Sprint 3-5） |
| **BUG** | 18 | 5 OPEN（BUG-061/071/072/073/074）+ 13 CLOSED（含 BUG-075 新閉環） |
| **PLAN** | 12 | 2 IDEA + 1 PLANNED + 2 IN_PROGRESS（PLAN-031/032）+ 6 DONE + 1 DROPPED |
| **EXP** | 1 | EXP-HEADLESS-001 CONCLUDED |

### 下 session pending（優先序）

1. 🔴 **PLAN-033 Sprint 1 research 派發**（state snapshot archive 架構 — 解封自身基礎設施 264KB 撞 256KB Read 上限，dogfood 自治；session 37 實證觸發）
2. 🔴 **PLAN-032 Sprint 2 解封 — T0330 keystone**（YOLO 鏈式可重啟，BUG-075 三層防線已落地）
3. 🔴 **T0324 DGX Spark dogfood VERIFY**（user 親跑進行中 / 待回報，BUG-071 VERIFY 路徑）
4. 🟡 **PLAN-032 Sprint 2 後續 T0331-T0334**（依賴 T0330）
5. 🟡 **PLAN-032 Sprint 3-5 — T0335-T0340**
6. 🟢 **BUG-071 metadata 對齊**：T0321/T0322 已實作 + 等 T0324 dogfood，建議 OPEN→FIXED 或 VERIFY（當前工單檔仍 OPEN）
7. 🟢 **BUG-061** CodexAgentPanel.tsx tsc errors（dev-only 非阻塞，long-tail）
8. 🟢 大批歸檔 batch 2（04-28 起合格：BUG-070/069 + T0303-T0312）
9. 🟢 PLAN-014 啟動評估 / v0.4.3 release 評估

> 🟡 **PLAN-033 vs PLAN-032 派發順序**：兩者皆 High，PLAN-033 解封基礎設施（Read 上限 + Fast Path 加速），PLAN-032 推進業務邏輯。建議下 session 起手讀 backlog 後一起決策。若 *evolve / 收工頻繁，PLAN-033 收益更立即；若集中 ship feature，PLAN-032 優先。

### 恢復指引（下 session 起手）

1. Fast Path 載入本快照（<7 天）
2. **熱區乾淨，BUG-075 已 CLOSED，YOLO 鏈式解封**
3. **編號起始**：T0346 / BUG-076 / PLAN-033 / D110 / EXP-[TOPIC]-001
4. **塔台規則繼續**：auto-session 切回 yolo（建議）；experience-level: standard
5. **建議起手動作**：
   - **PLAN-033 Sprint 1 research 派發**（自治優先 — 解封自身 Read 上限）
   - 或 PLAN-032 Sprint 2 鏈式派發（T0330 keystone → T0331-T0334，業務邏輯）
   - 或 T0324 VERIFY 結果處理（若 user 已測完）
   - 或 BUG-071 metadata 對齊（OPEN→FIXED）

### 本 session 教訓（已萃取至 GP113-118 + L112）

1. **GP113**：22h 同族再現 → 三層防線升級規則（fix + unit/integration + e2e）
2. **GP114**：Worker 拍板採納率 100% 反映研究品質（YOLO 綠燈訊號）
3. **GP115**：BUG 識別 5 min 內預備下 session 研究工單（0 冷啟動）
4. **GP116**：self-hosted 工具鏈撞線時 graceful degrade（PLAN 推進不停擺）
5. **GP117**：派發鏈本身可當 BUG fix 的 e2e（dogfood your own fix）
6. **GP118**：塔台 chore commit 處理 worker 漏 commit 工單檔（自然分工）
7. **L112**：BAT mjs 派發鏈三層防線（BUG-060→BUG-075 lineage，BAT 專屬）

### 本 session 成就

- 🏆 BUG-075 22h 內同族再現 → 三層防線（T0341/T0343 fix + T0342/T0344/T0345 test）一氣收尾，30 min 內完整閉環
- 🎉 派發鏈雙重用途實證：T0342+T0344 mjs 派發 = e2e 驗證，0 regression
- 🎉 T0345 e2e Mock BAT RemoteServer 設計優雅，避免 self-disrupt 當前 worker session
- 🎉 *sync patch 精準（不全 rebuild），_bug-tracker 認知對齊
- 🎉 *evolve 7 entries 落地，含 GP116（infrastructure 撞線降級）+ GP117（dogfood your own fix）兩條跨專案重要 pattern
- 🎉 全 session 0 Renew / 0 FAILED / 0 PARTIAL，3 工單神速並行 + 收尾

---


## 🌅 起手式（Quick Recovery）

> 最後更新：2026-04-27 22:08 UTC+8（session 39 收工）

### 立即待辦
1. **PLAN-032 Sprint 2 解封**：T0330 keystone → T0331-T0334（YOLO 鏈式已由 BUG-075 三層防線 + 五件套節奏雙重解封）。
2. **T0324 DGX Spark dogfood VERIFY**：等待使用者實機回報，作為 BUG-071 VERIFY/CLOSED 路徑。
3. **上游目錄 rename 評估**：v4.4.1 → v4.4.2 是否值得 bump 承載 PLAN-033 三段規則。
4. **BUG-071 metadata 對齊**：依 T0321/T0322/T0324 結果決定 OPEN→FIXED/VERIFY。
5. **Archive batch 2**：04-28 起合格（BUG-070/069 + T0303-T0312）。

### 近期完成
- **T0350**：上游 SKILL.md PR — commits `e92bb01` + `794f0ea`，已 push dev-main。
- **GP122-124 + L113**：sprint 五件套節奏 / drift 決策表 / push gate / monorepo 直接 commit。
- **PLAN-033 Sprint 2 真正收尾**：跨 3 sessions 五件套（research → implement → codify-rule → dogfood → upstream-PR）。

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)
- Backlog → [_backlog.md](_backlog.md)
- Decision Log → [_decision-log.md](_decision-log.md)
- Learnings → [_learnings.md](_learnings.md)
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)

### 編號起始
- T0351 / BUG-076 / PLAN-034 / D110 / EXP-[TOPIC]-001

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
| **工單最大編號** | T0251(session 25 完成:T0250→T0251 全綠,commit `426d6fc`,DISABLE_AUTOUPDATER env 注入 4 處) |
| **BUG 最大編號** | BUG-059(🔴 High 🚫 CLOSED 2026-04-25,T0251 runtime 驗收通過;BUG-055 連帶 CLOSED,D088) |
| **PLAN 最大編號** | PLAN-028 |
| **EXP 最大編號** | EXP-GPUWHIS-001(session 21 新增,📊 CONCLUDED) |
| **上游同步版本** | v2.1.42-pre.2(2026-04-16)— ⏸ 版號 bump 暫停待 BUG-056 CLOSED |
| **決策最大編號** | D088(session 25:BUG-059 + BUG-055 一同 CLOSED,T0250→T0251 修復鏈閉環,L067-070 候選待 *evolve) |
| **塔台版本** | Control Tower v4.3.0 |

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
> 最後掃描:2026-04-26 19:36 (UTC+8) — *rescan + *sync(session 32 起手,session 31 PLAN-007 全收 + v0.4.1 GO 後首掃)

| 偵測項 | 狀態 | 備註 |
|--------|------|------|
| BMad-Method | ❌ | _bmad/ 不存在(專案自訂工作流程);commit cee4fbc 升 v6.5 但未啟用 |
| ECC 學習 | ✅ Level 1+ | ~/.claude/homunculus/ |
| bmad-guide skill | ✅ | 可用 |
| mem0 REST | ✅ | memsync healthy, updated 2026-04-26 19:35, queue_size:2 |
| 終端環境 | BAT | TERM_PROGRAM=better-agent-terminal, WT_SESSION 空 |
| BAT 終端 | ✅ | BAT_SESSION=1, port:9876, workspace:0228e89a-650f-4c98-aeaf-3c5b3ffcd053 |
| BAT_TOWER_TERMINAL_ID | ❌ 空 | 本 session 未設,bat-notify Worker 回報需走降級 |
| 平台 | Windows | MINGW64 (Git Bash, Msys),Win11 Pro WS (26200) |
| ct-exec / ct-done / ct-status / evolve / insights / fieldguide / help | ✅ | 全套可用 |
| _archive/ | ✅ | **345 張歸檔**(workorders:269 / bugs:57 / plans:19;vs. 上次 304,session 26-31 累積 +41) |
| _playbooks/ | ✅ 空 | 目錄存在,0 張 |
| _decision-log | ✅ | 至 D089(PLAN-007 全案閉環);63 entries 含 D001-D012 collapsed |
| 跨專案參照 | 📋 | 無 _cross-references.md |
| Global 學習 | ✅ ⭐ | ~/.claude/control-tower-data/learnings/ + 6 個 GP playbooks(GP076-080 + GP-COOP-001) |
| Global 設定 | ❌ 無 | 僅 project 層 |
| BUG/PLAN 追蹤 | ✅ | BUG:11 熱區(8 OPEN v0.4.1 backlog,3 historical)/ PLAN:8 熱區 |
| 實驗追蹤 | ✅ | EXP:2 熱區(EXP-GPUWHIS-001 CONCLUDED + EXP-HEADLESS-001) |
| 熱區工單 | **T:54 + 4 reports / BUG:11 / PLAN:8 / EXP:2** = 79 張(含 reports) | T0295/T0300 TODO,其餘 DONE |
| 最大編號 | **T0302 / BUG-068 / PLAN-028 / EXP-HEADLESS-001 / D089** | session 31 收工後 |
| 設定來源 | project | _tower-config.yaml (auto-session: **on**, yolo_max_retries: **1**, auto_commit: on, archive_days: **2**) |
| 塔台版本 | v4.4.0 | SKILL.md frontmatter |
| 能力等級 | Level 2 | ECC + mem0 + Layer 2 |

> **Drift 狀態**:
> 1. ✅ `_decision-log.md` D084-D088 body 已補入(2026-04-26 13:55,session 31)
> 2. `_tower-state.md` 頂部「最後更新」仍標 2026-04-23 16:02 (session 23) — 待後續 session 退場快照時更新

---

## YOLO 歷程

> 本區段依 `references/yolo-mode.md` § 「`_tower-state.md` 新增 `## YOLO 歷程` 區段」規格產生。
> **Footnote**：本 session [斷點 C] 標記僅取狹義（Worker 跨 PLAN 建議）；使用者手動「停」暫不歸 A/B/C，列為 `[使用者中斷]` 自訂事件（待 L064 上游修正）。

### 當前 Session（2026-04-18 ~16:10 啟動，第三 session，收尾）

- [啟動] 2026-04-18 ~16:10 — 塔台 Fast Path 恢復，YOLO MODE ACTIVE 警語自動顯示（配置 `auto-session: yolo`, `yolo_max_retries: 1`）
- [派發] 2026-04-18 ~16:12 — CT-T003 DELEGATE 派發指引已送出（跨專案，目標 `BMad-Control-Tower-v4.x.x/`），使用者選 [B] 手動切換；本端更新 CT-T003 狀態 TODO → DISPATCHED
- [部分完成] 2026-04-18 16:18 — CT-T003 PARTIAL（commits monorepo:`1d02727` + 本地:`c73a23b`）。Worker 規格三步 + CHANGELOG 完成；Worker 自主 inference 調整 Step 2（工單預設字串在 v4.2.0 不存在，改為新增「使用者中斷快捷」段落，符合互動規則第 1 條）。剩餘 Step A(push) / C(sync) / D(tag) 待使用者決策。L065 候選：跨專案 DELEGATE 工單 monorepo vs 獨立 repo 結構假設缺口
- [完成] 2026-04-18 16:25 — CT-T003 DONE（使用者收尾全綠）。A-1: better-agent-terminal push origin/main（27 commits，`6ccf369..c73a23b`）; A-2: BMad-Guide monorepo push origin/dev-main（`d65f451..1d02727`）; D: v4.2.1 tag 打於 1d02727 並 push; C: 生產塔台 sync 驗證通過（grep 三處命中）。L064 drift 修正閉環
- [evolve] 2026-04-18 ~16:35 — `*evolve` 批次萃取 L057-L065 + L066，寫入 GP038-GP043（6 Global）+ L062/L063/L066（3 Project）+ L065 補充。GP039/GP042 直接升 🟢
- [archive-test] 2026-04-18 ~16:45 — `*archive --dry-run` → 3 張候選（T0149/T0150/BUG-034）→ 執行 → 全數觸發活躍引用豁免還原（PLAN-013 🟢 IDEA 引用鎖）→ L066 記錄 → archive_days 1→7 恢復保守設定

### 上個 Session（2026-04-18 ~15:30 啟動，T0174 Phase 2-6）

- [啟動] 2026-04-18 ~15:30 — 塔台啟動偵測 `auto-session: yolo` (持久化於 `_tower-config.yaml`)，自動顯示 YOLO MODE ACTIVE 警語面板（驗證 Phase 1 session-to-session 延續）
- [派發] 2026-04-18 15:45 — T0173 (BUG-040 研究，Phase 2 dogfood 首張，BAT 內部終端 `--notify-id $BAT_TERMINAL_ID`)
- [完成] 2026-04-18 15:50 — T0173 DONE (commit `5a2030c`，Worker 自動回報「T0173 完成」經斷點 A regex 通過)
- [斷點 C] 2026-04-18 15:55 — T0173 回報「建議實作工單列表 T-NEXT-1/2/3」跨出 PLAN-020 → 塔台 PAUSE（當下未明確識別為斷點 C，事後對照規格才確認 — L064 候選）
- [使用者中斷] 2026-04-18 ~16:00 — Phase 5 dogfood 測試：使用者輸入「停」→ 塔台正確 abort 派發。事件類型規格未定義（沿用 SKILL.md 警語語意，L064 已記錄）
- [完成] 2026-04-18 15:59 — Phase 6 區段建立中（本條為 self-recursive 紀錄）

### 計數器

- 連續 FAILED: 0 / 1（`yolo_max_retries: 1` dogfood 設定）
- 本 session yolo 派發工單數: 1（T0173）
- 本 session 斷點觸發: A×0, B×0, C×1, 使用者中斷×1
- 本 session 學習候選新增: L064（規格 drift）

### 歷史 Session（摘要）

- 2026-04-18 上半場（PLAN-020 開發）：派發 7 張本專案工單 + 1 跨專案 DELEGATE，全 DONE，無斷點觸發（pre-yolo / 早期 yolo 混用）
- 2026-04-18 下半場第二 session：T0174 Phase 0-1 dogfood 完成（無工單派發，純 setup + 警語驗證）
