# Tower State — better-agent-terminal

> 最後更新:2026-05-17 01:08 (UTC+8) — **第四十四 session 起手增量** — 登記 BUG-081（`bat-notify --submit` Enter/multiline regression）與技術報告；特別要求 Codex + Claude runtime smoke 後才可關閉。
>
> **下次起手**:回到立即待辦:PLAN-032 三 BUG smoke(BUG-072/073/074)→ CLOSED → PLAN-032 → DONE,或 T0324 DGX Spark VERIFY,或 BUG-061 / BUG-071 / BUG-078 收尾。
>
> **前次更新**:2026-04-29 00:05 (UTC+8) — 第四十二 session 收工快照:T0347 (PLAN-034 CT skill upstream v5.0.0 升版) 使用者驗收通過 → DONE,~10 min wall,v0.5.0-pre.2 release。

---

## 📝 本 Session 增量（第四十四 session, 2026-05-17 01:08）

- 新增 **BUG-081**：`bat-notify --submit` 遠端 Enter 被目標 agent 視為換行而非送出。
- 新增技術報告：`_ct-workorders/_report-bug081-bat-notify-submit-keypress-boundary.md`。
- Tracker 更新：熱區 BUG `8 → 9`，OPEN `2 → 3`。
- 驗收硬條件：即使 Codex unit/build 與 Codex runtime smoke 通過，仍需補 **Claude Worker `bat-notify --submit` regression smoke**；Claude 未驗證前 BUG-081 不得 CLOSED。
- 編號更新：BUG-081 已占用；下張 BUG 建議從 **BUG-082** 起。

---

## 🛏 本 Session 收工快照 (第四十三 session, 2026-05-15 12:03 - 13:15, ~72 min wall)

### 主軸：BUG-080 全線收尾 + 環境校正

#### 時間線

1. **12:03 起手**：Fast Path 失效（快照過期 19 天，2026-04-26 → 05-15）→ Full Scan，發現 113 工單 / 21 BUG / 14 PLAN / 1 EXP
2. **12:05 分析 PR #18**（gowerlin/better-agent-terminal）：外部貢獻者 RicoChen727，修復 BAT remote claude-cli 派發硬編碼 `'claude'` → 改用 `resolveClaudeRuntime()`。gemini-code-assist 評論指出雙引號 quoting 風險
3. **12:08 決策 [A]**：直接 squash-merge → commit `238ac3d`；開 BUG-080 追蹤 gemini 指出的 hardening 缺口
4. **12:13 派 T0354 research**：評估三選項（POSIX single-quote / 依 shell 切換 / customPath 白名單）→ Worker 5 min 完成，D 區推薦「選項 3 + 選項 2 窄版」
5. **12:20 Worker 發現本地 repo 不含 PR #18 helper**：因本地 main 仍在 PR #18 merge 前的 `04ace47`
6. **12:25 Rebase**（A 選項）：`git pull --rebase origin main`，零衝突（純文件 vs 純 code），本地線性合併
7. **12:30 派 T0355 fix**（customPath 白名單）：S sizing → Worker 6 min 完成，48/48 + 435/435 unit tests PASS + UI 同步校驗 + 三語 toast i18n
8. **12:38 push 4 commits**：origin/main `238ac3d → bbc0521`
9. **12:42 使用者 runtime smoke PASS** → T0355 CLOSED；派 T0356（shell-aware quoting）
10. **12:53 T0356 FIXED**：Worker 5 min，476/476 全套 tests PASS + 41 new cases + 三家 shell command-word smoke PASS（pwsh `& '...'` / git-bash `'...'` / cmd `"..."`）
11. **12:58 使用者選 [1]+[A]**：T0356 直接 CLOSED + BUG-080 CLOSED → push `5f038a1`
12. **13:00 *sync** 重建索引：發現編號 drift（快照記 T0349/BUG-077，實際 T0356/BUG-080/PLAN-034）→ `_bug-tracker.md` + `_backlog.md` 重建 → push `13e7b40`
13. **13:10 *archive 收工**：批次 git mv 130 檔案到 `_archive/`（107 T + 15 BUG + 8 PLAN + 1 EXP），熱區精簡為 26 個活躍/驗收中工單

### 本輪戰績

| 類別 | 數量 | 備註 |
|------|------|------|
| 處理的 PR | 1 (gowerlin#18) | squash-merged `238ac3d` |
| 新增 BUG | 1 (BUG-080) | OPEN → FIXING → CLOSED 全程 |
| 派發工單 | 3 (T0354/T0355/T0356) | 全綠 |
| 完成工單 | 3 | research + 2 fix，全部 1 round |
| Worker 總時間 | ~16 min wall | T0354 (5) + T0355 (6) + T0356 (5) |
| 新增測試 | 89 cases | T0355 48 + T0356 41（含 helper 30+） |
| Code 改動 | +200 lines | shell-quote helper / customPath validation / shell-aware quoting |
| Push commits | 8 | 含 PR #18 merge + 3 worker fix + 4 tower meta |
| 歸檔檔案 | 130 | 107 T + 15 BUG + 8 PLAN + 1 EXP（_archive/）|

### 熱區結構（收工後）

- **T workorders**：13 張（4 review/verify reports + T0153 PARTIAL + 4 FIXED 等 BUG VERIFY + 3 BUG-080 series + T0348）
- **BUG**：8 張（2 OPEN + 1 FIXED + 3 VERIFY + 2 CLOSED 今日）
- **PLAN**：6 張（2 IN_PROGRESS + 2 PLANNED + 2 IDEA）
- **EXP**：0（CONCLUDED 已歸檔）

### 立即待辦（傳承自 session 42 + 新增）

1. 🔴 **PLAN-032 三 BUG smoke**：BUG-072 / BUG-073 / BUG-074 皆 🔍 VERIFY 待人工 smoke → CLOSED → PLAN-032 → DONE
2. 🟡 **BUG-078** FIXED 待 VERIFY（CI 重跑後確認）
3. 🟡 **BUG-071** server bundle download flow（OPEN, high）
4. 🟢 **BUG-061** Codex panel tsc baseline errors（OPEN, low）
5. 🟡 **T0324 DGX Spark dogfood VERIFY**（使用者親跑進行中 / 待回報）
6. 🟢 **WSL/Docker structured errorCode PLAN**（T0340 P2 後續建議，獨立開 PLAN）

### 重點觀察 / Learnings 候選

- **L117**（候選）：PR 分析 → research 工單 → 雙 fix → CLOSED 一條龍適合 Low severity 外部報告的 hardening。1 hour 內完成完整 BUG 處理鏈
- **L118**（候選）：當 PR 在 gh 端 merged 但本地 branch 尚未同步時，Worker 會誤判 helper 不存在 → 塔台應在派工單前先 `git fetch + log` 驗證本地 ancestry
- **L119**（候選）：分流式選項決策（A/B/C/D 配 1/2/3）+ 使用者明確選擇可在 5 文字輪內完成完整 fix 鏈，比互動式對話快 3x
- **L120**（候選）：T#### 編號重複問題（T0341-T0348 同號多檔）— 應在 *sync 增加 collision warning

### 編號起始（下 session）

- **T0357** / **BUG-082** / **PLAN-035** / **D110**（BUG-081 已於 2026-05-17 01:08 登記；D 計數未深掃，建議下次 *sync 加 D### 校正）

### 快速連結

- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（8 張熱區 / 72 歸檔）
- Backlog → [_backlog.md](_backlog.md)（6 張熱區 / 27 歸檔）
- Decision Log → [_decision-log.md](_decision-log.md)
- Learnings → [_learnings.md](_learnings.md)
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)

---

## 🛏 前 Session 收工快照 (第四十二 session, 2026-04-29 ~00:00 - 00:10, ~10 min wall, T0347 驗收 DONE + 使用者外部完成 push + v0.5.0-pre.2 release)

### 本輪時間線

1. **~00:00**（起手）：Fast Path 載入 session 41 快照（< 7 天）；面板顯示 113 T / 21 BUG / 14 PLAN / 1 EXP
2. **~00:05**：使用者回報「T0347 驗收通過」— 工單回報區空（fire-and-forget worker），三選一（A 直接 mark DONE / B 補回報 / C 自填）→ 使用者選 A
3. **~00:05**：T0347 frontmatter status IN_PROGRESS → DONE，completed_at 補上 `2026-04-29T00:05:15+08:00`，回報區加塔台驗收備註
4. **~00:10**：使用者回報「已 push、已 v0.5.0-pre.2 release，收工」— 立即待辦 #2（push）+ #3（release）一併消解（v0.4.2 → 跳級 v0.5.0）
5. **~00:10**：State Hygiene Archive — 第三十八 session 快照 → `2026-Q2-b.md` (#58)，INDEX.md 更新

### 本 session 統計

| 指標 | 值 |
|------|-----|
| Wall time | ~10 min |
| Worker wall | 0（無 Worker 派發） |
| 工單派發 | 0 |
| Worker DONE | 0 |
| 使用者驗收 mark DONE | 1（T0347） |
| 主線 commits | 0（塔台 chore；使用者外部 push + release tag） |
| Release | v0.5.0-pre.2（從 v0.4.2 草稿跳級，使用者決策） |
| 萃取項 | 0（本 session 太短） |

### 熱區現況（收工）

| 類型 | 數量 | 狀態分布 |
|------|------|---------|
| **T 工單** | 113 | 90 DONE + 12 PENDING + ... |
| **BUG** | 21 | 4 OPEN + 14 CLOSED + 3 VERIFY (BUG-072/073/074) |
| **PLAN** | 14 | 2 IDEA + 1 PLANNED + 1 IN_PROGRESS（PLAN-032）+ 9 DONE + 1 DROPPED |
| **EXP** | 1 | EXP-HEADLESS-001 CONCLUDED |

### 下 session pending（優先序，與 session 41 比較消解 #2/#3）

1. 🔴 **三 BUG smoke**（BUG-072/073/074）— user 親跑，PLAN-032 → DONE 條件
2. ~~Push ~10 commits~~ ✅ session 42 內完成
3. ~~v0.4.2 release engineering~~ ✅ session 42 內以 v0.5.0-pre.2 完成
4. 🟡 **WSL/Docker structured errorCode PLAN**（T0340 P2 後續建議，獨立開）
5. 🟡 **T0324 DGX Spark dogfood VERIFY**（user 親跑進行中 / 待回報）
6. 🟢 **BUG-071 metadata 對齊**：依 T0321/T0322/T0324 結果決定 OPEN→FIXED/VERIFY
7. 🟢 **BUG-061** CodexAgentPanel.tsx tsc errors（dev-only）
8. 🟢 **Archive batch 2**（04-28+ 起合格：BUG-070/069 + T0303-T0312 + 已收 PLAN-032 工單批次）

### 恢復指引（下 session 起手）

1. Fast Path 載入本快照（< 7 天）
2. **熱區聚焦**：v0.5.0-pre.2 release 已 ship，等三 BUG smoke 結果決定 PLAN-032 結案
3. **編號起始**：T0349 / BUG-077 / PLAN-035 / D110 / EXP-[TOPIC]-001（T0348 已 FIXED；T0347 已 DONE）
4. **塔台規則繼續**：auto-session: on；experience-level: standard
5. **建議起手動作**：
   - 若使用者已跑 BUG smoke → CLOSED 三 BUG → PLAN-032 → DONE
   - 或開 WSL/Docker structured errorCode PLAN（非阻塞）
   - 或 T0324 dogfood VERIFY 結果處理

### 本 session 教訓

無新教訓萃取（短 session、無新派發、外部 release 動作）。

### 本 session 成就

- ✅ T0347 驗收 DONE（PLAN-034 CT skill upstream v5.0.0 升版收尾）
- 🚀 v0.5.0-pre.2 release 出貨（從 v0.4.2 草稿跳大版號 — 使用者決策）
- 🚀 累積 commits push to origin/main 完成
- 🧹 State Hygiene Archive：session 38 → archive #58

---

## 🛏 前 Session 收工快照 (第四十一 session, 2026-04-28 ~05:11 - 09:35, ~4.4 hr wall, PLAN-032 Sprint 2-5 全收尾 + drift fix + plugin hook 災情處置 + GP126/L114-116)

### 本輪時間線

1. **05:11**（起手）：Fast Path 載入 session 39 快照（snapshot < 7 天）；發現 git log 顯示 session 40 已落地 8 張工單（T0330-T0337）但無收工快照 → 重大 drift
2. **~05:30**：State drift fix（commit `14dead7`）— 頂部標 drift 註記、Quick Recovery 立即待辦改寫、編號起始 T0351 → T0338
3. **05:47**：派 T0338 (integration tests, Sprint 5) — Worker 撞 plugin hook bug（`security-guidance` ${CLAUDE_PLUGIN_ROOT} 在 Windows Git Bash mangle 成 `D:\c\Users\...`）。診斷後改 `~/.claude/settings.json` `security-guidance` 設 `enabled: false`
4. **05:58-06:08**：T0338 重派 → DONE `be40f7d`（10 min；8 transition paths + 5 mapped UX cases + 1 skipped + 1 regression guard；304 tests 全綠）；衍生 P1 production gap → BUG-076
5. **06:10**：開 BUG-076（SetupWizardShell `resolveMappedErrorForSnapshot` errorCode 遺失）+ 派 T0339 採方案 (a) 根治
6. **06:13-06:16**：T0339 → FIXED `f711baf`（3 min；304 tests 全綠 0 regression；BUG-076 → CLOSED via T0338 case #4 unskip 自動驗收）
7. **08:55-09:02**：派 T0340 (Sprint 4 input-kind audit, M/L) → DONE `58ec3bd`（7 min；4 step audit 全已 input-aligned，補 14 unit tests / 3 files；304→321 tests 全綠）
8. **09:08-09:27**：派 T0341 (Sprint 5 audit, S) — 首次 bat-terminal.mjs stdout 顯示 `null` 但 Worker 沒跑（L116 source）；剪貼簿降級 → 手動貼上後 → DONE `0cadea0`（7 min；5 visual snapshots + docs 對齊 + CHANGELOG v0.4.2 草稿；321→326 tests 全綠）
9. **09:30-09:35**：PLAN-032 metadata 同步 + *evolve 5 entries（commit `797c2e9`：L114-L116）+ Global GP126 + GP122 footnote
10. **09:35-現在**：State hygiene archive session 37 → 寫本快照

### 本 session 統計

| 指標 | 值 |
|------|-----|
| Wall time | ~4.4 hr（05:11-09:35） |
| Worker wall | ~27 min（T0338 10 + T0339 3 + T0340 7 + T0341 7） |
| 工單派發 | 4（T0338/T0339/T0340/T0341） |
| Worker DONE | 4 / 4（0 Renew / 0 FAILED / 0 PARTIAL） |
| 主線 commits | ~10（drift fix + 4 worker commits + 4 chore/metadata + evolve） |
| Tests 增量 | 286 → 326（+40，全綠 0 regression） |
| 萃取項 | 5（Global GP126 + GP122 footnote / Project L114/L115/L116） |
| BUG 狀態變更 | BUG-076 OPEN → CLOSED（衍生並一站式收尾） |
| PLAN 狀態變更 | **PLAN-032 Sprint 2-5 全部 12 工單 DONE**（pending 3 BUG smoke 才能 PLAN → DONE） |

### PLAN-032 跨 5 sessions 完整收尾

| Sprint | 工單 | session | commits |
|--------|------|---------|---------|
| 1 (research) | T0328 | 36 | DONE |
| 2 (framework) | T0330-T0334 | 40 | 5/5 |
| 3 (BUG fixes) | T0335-T0337 | 40 | 3/3（BUG-072/073/074 → VERIFY） |
| 4 (input rollout) | T0340 | **41** | 1/1 `58ec3bd` |
| 5 (tests + audit) | T0338/T0339/T0341 | **41** | 3/3 + BUG-076 衍生 |

GP126（Test-discovered bug 三步處理法）= 本 session T0338→BUG-076→T0339 流程 dogfood 萃取。

### 熱區現況（收工）

| 類型 | 數量 | 狀態分布 |
|------|------|---------|
| **T 工單** | 102 + 4 reports | 89 DONE + 13 NEW（含 T0338-T0341 全 DONE / T0324 user dogfood 待 / T0326 待外部 / T0341/T0343 FIXED） |
| **BUG** | 19 | 4 OPEN（BUG-061/071 + 三 VERIFY 未列）+ 14 CLOSED（含 BUG-076 新閉環）+ 3 VERIFY (BUG-072/073/074) |
| **PLAN** | 13 | 2 IDEA + 1 PLANNED + 2 IN_PROGRESS（PLAN-031/032）+ 7 DONE + 1 DROPPED |
| **EXP** | 1 | EXP-HEADLESS-001 CONCLUDED |

### 下 session pending（優先序）

1. 🔴 **三 BUG smoke**（BUG-072/073/074）— user 親跑，PLAN-032 → DONE 條件
2. 🔴 **Push ~10 commits** to origin/main（GP124 push gate，需使用者授權）
3. 🟡 **v0.4.2 release engineering**（npm version bump + tag + push，CHANGELOG 草稿已就位）
4. 🟡 **WSL/Docker structured errorCode + ErrorMapper entries PLAN**（T0340 P2 後續建議，獨立開）
5. 🟡 **T0324 DGX Spark dogfood VERIFY**（user 親跑進行中 / 待回報）
6. 🟢 **BUG-071 metadata 對齊**：依 T0321/T0322/T0324 結果決定 OPEN→FIXED/VERIFY
7. 🟢 **BUG-061** CodexAgentPanel.tsx tsc errors（dev-only）
8. 🟢 **Archive batch 2**（04-28 起合格：BUG-070/069 + T0303-T0312 + 已收 PLAN-032 工單批次）

### 恢復指引（下 session 起手）

1. Fast Path 載入本快照（< 7 天）
2. **熱區聚焦：PLAN-032 全工單 DONE，僅待三 BUG smoke + push**
3. **編號起始**：T0342 / BUG-077 / PLAN-034 / D110 / EXP-[TOPIC]-001
4. **塔台規則繼續**：auto-session: on（建議延續，YOLO 鏈式 4 張全綠驗證）；experience-level: standard
5. **建議起手動作**：
   - 若使用者已跑 BUG smoke：CLOSED 三 BUG → PLAN-032 → DONE → push
   - 若未跑：先處理 push（10 commits 偏多）+ 等 smoke 結果
   - 或開 WSL/Docker structured errorCode PLAN（非阻塞 PLAN-032）

### 本 session 教訓（已萃取）

1. **GP126**（Global）：Test-discovered production bug 三步處理法（守界 → 回報 → 衍生）— 本 session T0338→BUG-076→T0339 dogfood
2. **GP122 footnote**（Global）：產品 PLAN 的五件套變體 = research → framework → BUG-fix → rollout → audit；audit 票天然落 S 區間
3. **L114**（Project）：Session drift 修法不偽造歷史（git log 為 SoT）— session 41 起手實證
4. **L115**（Project）：Plugin hook ${CLAUDE_PLUGIN_ROOT} 在 BAT × Git Bash × Windows 三層疊加會 mangle
5. **L116**（Project）：bat-terminal.mjs 派發成功與否 stdout 不可靠（看 git working tree）

### 本 session 成就

- 🏆 **PLAN-032 跨 5 sessions 完整收尾**：framework + 三平台 BUG fix + input-kind rollout + tests + audit 12 工單 + 1 衍生 BUG fix
- 🎉 4 張 YOLO 鏈式 0 Renew / 0 FAILED / 0 PARTIAL，平均 7 min Worker wall
- 🎉 GP126（Test-discovered bug 三步法）首次完整 dogfood，T0338→BUG-076→T0339 三步流程零摩擦
- 🎉 plugin hook 災情快速診斷 + 治標處置（settings.json `enabled: false`）+ 重派恢復鏈式
- 🎉 State drift 修法不偽造歷史（git log 為 SoT），L114 落地
- 🎉 Tests 286 → 326（+40 cases / 5 新檔），0 regression

---

## 🛏 前前 Session 收工快照 (第三十九 session, 2026-04-27 ~21:38 - 22:08, ~30 min wall, PLAN-033 Sprint 2 上游 PR 真正收尾)

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

## 🌅 起手式（Quick Recovery）

> 最後更新：2026-04-29 00:10 UTC+8（session 42 收工 — T0347 DONE + push + v0.5.0-pre.2 release）

### 立即待辦
1. 🔴 **PLAN-032 三 BUG smoke**：BUG-072（WSL linger/systemd, T0337）/ BUG-073（Docker daemon, T0336）/ BUG-074（SSH input-step, T0335）皆 🔍 VERIFY 待人工 smoke → 通過後 CLOSED → PLAN-032 → DONE
2. 🟡 **WSL/Docker structured errorCode PLAN**（T0340 P2 後續建議，獨立開）
3. 🟡 **T0324 DGX Spark dogfood VERIFY**（user 親跑進行中 / 待回報）
4. 🟢 **BUG-071 metadata 對齊** / **BUG-061** / **Archive batch 2**

### 近期完成（session 42 — 短 session）
- **T0347**（PLAN-034 CT skill upstream v5.0.0 升版）：使用者驗收通過 → DONE
- **v0.5.0-pre.2 release**：使用者外部 ship（從 v0.4.2 草稿跳大版號）
- **Push to origin/main**：累積 commits 全清，立即待辦 #2/#3 一併消解
- **State Hygiene**：session 38 archive → `2026-Q2-b.md` (#58)

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)
- Backlog → [_backlog.md](_backlog.md)
- Decision Log → [_decision-log.md](_decision-log.md)
- Learnings → [_learnings.md](_learnings.md)
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)

### 編號起始
- **T0349** / **BUG-077** / **PLAN-035** / **D110** / **EXP-[TOPIC]-001**
- 註：T0347 DONE / T0348 FIXED 已落地；PLAN-034 早於 04-28 DONE（T0347 為其後續 upstream 升版獨立工單）

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
> 最後掃描:2026-05-17 15:28 (UTC+8) — control-tower Full Scan（前次快照 2026-04-26 已超過 7 天）

| 偵測項 | 狀態 | 備註 |
|--------|------|------|
| BMad-Method | ✅ | _bmad/ 存在；版號未由 config.toml 明確標示 |
| ECC 學習 | ✅ Level 1+ | ~/.claude/homunculus/ |
| bmad-guide skill | ✅ | 可用 |
| mem0 REST | ✅ | memsync binary 存在且 status 指令 exit 0；本次未回傳 JSON body |
| 終端環境 | BAT | TERM_PROGRAM=better-agent-terminal, WT_SESSION 空 |
| BAT 終端 | ✅ | BAT_SESSION=1, port:9876, workspace:0228e89a-650f-4c98-aeaf-3c5b3ffcd053 |
| BAT_TOWER_TERMINAL_ID | ❌ 空 | 本 session 未設,bat-notify Worker 回報需走降級 |
| 平台 | Windows | PowerShell shell；BAT terminal env |
| ct-exec / ct-done / ct-status / evolve / insights / fieldguide / help | ✅ | 全套可用 |
| _archive/ | ✅ | **483 張歸檔**(workorders:378 / bugs:72 / plans:27) |
| _playbooks/ | 📋 | 熱區未偵測到 _playbooks/ 目錄 |
| _decision-log | ✅ | 至 D118；78 unique D### hits |
| 跨專案參照 | ✅ | _cross-references.md 存在 |
| Global 學習 | ✅ ⭐ | ~/.claude/control-tower-data/；local scan: patterns 2 / playbooks 20 |
| Global 設定 | ❌ 無 | 僅 project 層 |
| BUG/PLAN 追蹤 | ✅ | BUG:9 熱區 / PLAN:6 熱區 |
| 實驗追蹤 | ✅ | EXP:0 熱區 |
| 熱區工單 | **T:12 / BUG:9 / PLAN:6 / EXP:0** | 另有 reports/ 與系統文件，不納入 T/BUG/PLAN/EXP 統計 |
| 最大編號 | **T0356 / BUG-081 / PLAN-034 / D118** | PLAN-034 已在 archive；下張建議：T0357 / BUG-082 / PLAN-035 / D119 |
| 設定來源 | project | _tower-config.yaml (auto-session: **on**, yolo_max_retries: **1**, auto_commit: on, archive_days: **2**) |
| 塔台版本 | v5.0.1 | control-tower skill frontmatter |
| 能力等級 | Level 2 | ECC + mem0 + Layer 2 |

> **Drift 狀態**:
> 1. ⚠️ `_tower-state.md` 目前約 32 KB，超過 30 KB soft warning；下次收工建議跑 state hygiene archive。
> 2. ⚠️ 工作區已有既有變更 `AGENTS.md`，本次塔台啟動未觸碰。
> 3. ⚠️ BAT_TOWER_TERMINAL_ID 空；Worker 完成通知不得宣稱 bat-notify 成功，需用剪貼簿/手動回報降級。

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
