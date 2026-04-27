# Tower State — better-agent-terminal

> 最後更新:2026-04-27 16:50(**第三十七 session 收工快照:輕度 session, ~30 min wall, BUG-075 三層防線收尾 + *sync + *evolve。(1) T0342 (MSYS unit/integration regression) + T0344 (shell pref diagnostics + 3-shot integration) 並行派發 (mjs ask→on mode), 派發本身當 BUG-075 e2e dogfood。(2) T0345 (e2e Playwright + Mock BAT RemoteServer + 3-shot codex argv probe) 收尾, BUG-075 → CLOSED。(3) *sync patch _bug-tracker (BUG-075 OPEN→CLOSED, BUG-071 FIXING→OPEN per metadata SoT) + _backlog (PLAN-032 IN_PROGRESS 加入)。(4) *evolve 7 entries: 6 Global GP113-118 + 1 Project L112 (BUG-060→BUG-075 同族 lineage)。下次起手: PLAN-032 Sprint 2 解封 (T0330 keystone → T0331-T0334), 或 T0324 DGX Spark VERIFY。**)

---

## 🛏 本 Session 收工快照 (第三十七 session, 2026-04-27 ~16:21 - 16:50, ~30 min wall, BUG-075 三層防線收尾 + *sync + *evolve)

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

## 🛏 前 Session 收工快照 (第三十六 session, 2026-04-27 12:36 - 13:51, ~75 min wall, 輕度 session — 萃取 + PLAN-032 拍板 + BUG-075 識別)

### 本輪時間線

1. **12:36**（起手）：Fast Path 載入 session 35 快照；使用者選 [A] *evolve 萃取
2. **12:36-12:42**：*evolve 萃取 7 entries → 4 Global (GP110-112 + tech-gotcha) + 3 Project (L109-111)，commit `afb91c4`
3. **12:42**：使用者選 [B] PLAN-032 評估
4. **12:50-12:58**：3 BUG (072/073/074) 同族盤點 + 3 輪選項提問 (Q1.A 大規模 / Q2.A research-first / Q3.B v0.4.3 獨立 release)
5. **12:58-13:00**：PLAN-032 + T0328 spec freeze，commit `9489933`
6. **13:00**：T0328 派發 → BUG-075 撞線 (`/ct-exec T0328` 被 MSYS rewrite 為 `C:/Program Files/Git/ct-exec T0328`)
7. **13:00-13:05**：BUG-075 OPEN + T0329 PENDING 預備，commits `0136575` + `ff04973`
8. **13:05-13:30**：使用者手動派發 T0328（繞過 mjs，避開 BUG-075）
9. **13:30-13:50**：T0328 完成回報 — 8 拍板項 + 11 工單拆單 + spec 文件，commit `d89d867`
10. **13:50-13:51**：塔台拍板 D102-D109 全採 Worker 推薦 + finalize 拆單表，commit `b5ae862`
11. **13:51**：使用者選 [D] 收工 → 寫本快照

### 本 session 統計

| 指標 | 值 |
|------|------|
| Wall time | ~75 min（12:36-13:51） |
| Worker wall | ~30 min（T0328 manual dispatch concentrated） |
| 工單派發 | 1（T0328） |
| Worker DONE | 1 / 1 |
| Renew / FAILED | 0 / 0 |
| 主線 commits | 6（`afb91c4` learnings → `9489933` PLAN-032 → `0136575` BUG-075 → `ff04973` T0329 → `d89d867` T0328 worker → `b5ae862` PLAN-032 拍板） |
| 拍板項 | 8（D102-D109） |
| 萃取項 | 7（4 Global + 3 Project） |
| BUG 狀態變更 | BUG-075 NEW → OPEN |
| PLAN 狀態變更 | PLAN-032 NEW → IN_PROGRESS |

### 熱區現況（收工）

| 類型 | 數量 | 狀態分布 |
|------|------|---------|
| **T 工單** | 84 + 4 reports | 76 DONE + 8 NEW（T0324 進行中 + T0326 待外部 + T0328 ✅ + T0329 PENDING + T0330-T0334 PENDING Sprint 2 + T0335-T0340 PENDING Sprint 3-5） |
| **BUG** | 18 | 5 OPEN（BUG-072/073/074/075）+ 1 FIXING（BUG-071）+ 12 CLOSED |
| **PLAN** | 12 | 2 IDEA + 1 PLANNED + 2 IN_PROGRESS（PLAN-031, PLAN-032）+ 6 DONE + 1 DROPPED |
| **EXP** | 1 | EXP-HEADLESS-001 CONCLUDED |

### 下 session pending（優先序）

1. 🔴 **T0329 派發 — BUG-075 root cause research**（解封 YOLO 鏈式，PLAN-032 Sprint 2 前置）
2. 🔴 **T0324 DGX Spark dogfood VERIFY**（user 親跑進行中 / 待回報）
3. 🟡 **PLAN-032 Sprint 2** — T0330 keystone → T0331-T0334（5 工單）
4. 🟡 **PLAN-032 Sprint 3** — T0335-T0337（BUG-074/073/072 三 fix，依賴 Sprint 2）
5. 🟢 **PLAN-032 Sprint 4-5** — T0338-T0340
6. 🟢 大批歸檔 batch 2（04-28 起合格）
7. 🟢 PLAN-014 啟動評估 / v0.4.3 release 評估

### 恢復指引（下 session 起手）

1. Fast Path 載入本快照（<7 天）
2. **熱區進行中**：T0324 (user dogfood) + PLAN-032 Sprint 2 待派發
3. **編號起始**：T0341 / BUG-076 / PLAN-033 / D110 / EXP-[TOPIC]-001
4. **塔台規則**：auto-session: on（**但 BUG-075 阻擋 YOLO 鏈式，user 需手動派發直到 T0329 fix**）；experience-level: standard
5. **建議起手動作**：
   - 先派 T0329（user 手動，BUG-075 root cause research）→ 收斂 H1-H6
   - 或 T0324 VERIFY 結果處理（BUG-071 → CLOSED 路徑）
   - PLAN-032 Sprint 2 等 BUG-075 解封後再走 YOLO

### 本 session 教訓（候選下 session *evolve 萃取項）

1. **修復 22 小時內同族 BUG 再現是 high-priority 信號**（L 候選） — BUG-060 fix `fad2978` (T0281) 22h 後 BUG-075 同族再現，說明只修症狀沒加 regression test。應該成為塔台 fix 工單的硬性檢查項
2. **Worker T0328 拍板項 100% 採納率反映研究品質**（GP 候選） — 8 拍板 8 全採 Worker 推薦，無翻案。對照 T0313 的 7 拍板也類似比例 → 「研究型工單品質高 = 塔台拍板成本接近零」是可證實 pattern
3. **BUG 識別後 5 分鐘內預備下 session 研究工單是好實踐**（GP 候選） — BUG-075 OPEN → T0329 PENDING 草稿 5 min 內完成 + 預先列 6 H 候選，下 session 起手即派發無冷啟動成本
4. **不可控外部依賴撞線時的工作流降級**（GP 候選） — BUG-075 阻 YOLO 但研究工單可手動派發繞過 → 工作流 graceful degrade，PLAN 推進不受 infrastructure bug 完全阻擋

### 本 session 成就

- 🎉 *evolve 7 entries 落地（Global GP110/111/112 + tech-gotcha + Project L109/110/111）
- 🎉 PLAN-032 spec freeze + 8 拍板項一氣完成
- 🎉 T0328 研究工單繼承 PLAN-031 T0313 模式（6 phase + reachability matrix + 拍板 ≥5）
- 🎉 BUG-075 即時識別 + 預備研究工單 + workflow graceful degrade
- 🎉 T0328 spec 文件落地（`_spec-wizard-error-ux.md`），後續工單可直接引用

---

## 🌅 起手式（Quick Recovery）
> 最後更新：2026-04-26 19:25 UTC+8（session 31 收工）

### 🏆 Session 31 收工快照（2026-04-26 14:00-19:25，~5h25min，PLAN-007 全收 + 雙 release GO）

**史詩級單 session 成就**（21 工單派發 / 0 Renew / 0 真正 FAILED）：

- ✅ **PLAN-007 全 23 藍圖工單 DONE**（Phase 1-5 全收，commit `e01c34b` D089 全案閉環）
  - Phase 4 SSH (T0282-T0287, 6 張, 72 min wall)
  - Phase 5 整合 (T0288-T0291, 4 張, 49 min wall)
- ✅ **release/v0.4.0 分支建立**（merge `feature/plan-007-remote-dev` `--no-ff`，113 files / +14569 / -334 auto-merge 無衝突）
- ✅ **bmad 雙審完成**（T0292 adversarial 25 findings + T0293 edge-case 9 findings = 34 findings）
- ✅ **v0.4.0 fix chain 全綠**（T0294-T0298, 5 張, 29+5 min wall, GO verdict）
  - 6 必修 finding 修完：F-001 + EC-001 / F-002 / F-003 / F-004 + EC-002 + EC-003 / F-005
- ✅ **v0.4.1 patch chain 全綠**（T0299-T0302, 4 張, 47+10 min wall, GO verdict）
  - 7 緩修 BUG 修完：BUG-062~068（fingerprint return / SIGKILL escalation / i18n / schema-driven / runPromise reset / disconnect await / invoke translator freeze）
  - `package.json` bump `0.3.1 → 0.4.1`，CHANGELOG `[0.4.1]` section 完整
- ✅ **BUG-060 CLOSED**（YOLO 鏈式 shell preference fix `fad2978` 持久觀察 2 次連線通過）
- 🐛 **BUG-061 OPEN baseline**（CodexAgentPanel.tsx tsc errors 36 個，dev-only，不影響 runtime）
- 📚 **`*evolve` 萃取完成**（commit `9e83985`）：
  - **Global**：GP103（Worker 神速三要素）+ GP104（bmad 5 階段 release）+ GP105（Helper 抽取累積效應）
  - **Project**：L106（BAT YOLO 21 工單）+ L107（release branch + worktree merge pattern）

### 立即待辦（下一輪起手 — 由使用者人工執行）

1. **Push release/v0.4.0 to origin** — 使用者收工後人工執行（塔台不 push 規則）
2. **Pre-release 人工驗證**（依 `docs/plan-007-release-checklist.md`）：
   - NSIS / dmg 打包驗證
   - WSL real e2e（Win 11 23H2+ + Ubuntu + systemd）
   - Docker real e2e（Docker Desktop / colima）
   - SSH real e2e（linux-x64 / linux-arm64 / darwin-arm64 + 1 cross-OS）
   - Migration verification（legacy remote profile）
3. **Tag + GitHub Release**：`git tag v0.4.1` + `git push origin v0.4.1` 觸發 CI release
4. **Homebrew tap 更新**（v0.4.1 為非 prerelease）

### Session 31 數據（最終）

| 指標 | 值 |
|------|------|
| 時長 | ~5h25min（14:00-19:25）|
| 工單派發 | **21 張全 DONE** |
| BUG 處理 | 1 CLOSED + 7 OPEN→FIXED + 1 OPEN baseline |
| Worker wall total | ~235 min（平均 12 min/工單）|
| Renew / FAILED / PARTIAL | 0 / 0 / 1 環境 + 1 baseline 豁免 |
| GP099 下界次數 | **14+ 連續** |
| 雙 release verdict | v0.4.0 GO + v0.4.1 GO |
| Test suite | 250+ pass / 0 fail |
| Baseline drift | 36 → 36（0 變化）|
| Main commits | 30+（含 release/v0.4.0）|
| Worktree commits | 11 |

### 下 session 起手指引

- Fast Path 載入（快照 < 7 天）
- 優先序 1：確認使用者已 push release/v0.4.0 + tag v0.4.1
- 優先序 2：依 release 結果決定下一 PLAN（PLAN-013 / PLAN-021 / 其他 backlog）
- 下 session 新單編號起始：**T0303 / BUG-069 / PLAN-029 / D090 / EXP-[TOPIC]-002+**

---

### 🟠 上一輪起手式（2026-04-18 00:55 存檔，歷史追溯用）

### 🎉 BUG-037 全鏈路閉環（2026-04-18 00:23~00:43）

**本 session 成果**（~1.5h，4 commits unpushed）：
- **T0157** 研究 DONE（commit `378a124`）— 靜態 + 1 輪使用者互動定位根因：`WorkspaceView::renderTabContent` 缺 `case 'git-graph'`（T0155 commit 只補了 App.tsx，漏 WorkspaceView 的 main zone render path）
- **T0158** 修復 DONE（commit `fbcf2d2`）— 方案 A（最小修改）+ **Layer 2 範圍擴展**（UAT 發現 `electron/remote/protocol.ts::PROXIED_CHANNELS` 漏 `git-scaffold:*` 3 channels，Worker 依 F-11 問 [A/B/C]，使用者選 [B] 合併修復）
- **BUG-037** OPEN → CLOSED（使用者 runtime UAT 通過，VERIFY 決策流選項 [1] 直接 CLOSED）
- **2 條 learning 寫入**：
  - L035: Dockable panel 雙 render 路徑同步 checklist（App.tsx + WorkspaceView.tsx）
  - L036: Electron IPC PROXIED_CHANNELS scaffold checklist
- **PLAN-015** 入 backlog（🟢 Low IDEA — 抽 shared helper 消除雙 render path，塔台推薦 Phase 3 Tα3+ 完整收官後再動）
- **塔台 meta** 2 commit 批次收尾（`ad6f9e8` + `2def77a`）

### 立即待辦（本輪結束，下一輪從這裡接）
- ✅ **T0159 完成**（commit `4e5af2f`，01:32）— 三合一研究結論
- ✅ **EXP-ELECTRON41-001 CONCLUDED**（commit `ef3624f` on `exp/electron41`，02:16，27 分鐘）
- ✅ **T0160 DONE**（commit `e7eab33`，02:30）— PLAN-016 Phase 2 完成：FF merge + postinstall rebuild + CLAUDE.md + worktree 清理
- ✅ **T0161 DONE**（commit `9d734a8`，02:33 FIXED → 03:01 DONE）— 方案 B：pty-manager.ts + terminal-server.ts 在 spawn 前刪除 `ELECTRON_RUN_AS_NODE`；runtime 驗收通過
- ✅ **BUG-038 CLOSED**（03:01）— runtime 驗收通過
- ✅ **Electron 41 升級 CLOSED**（03:01，D051）— runtime 閉環完成
- 💡 **Learning candidates**（下次 `*evolve` 寫入）：
  - **L037**：一次性大批 deps 升級失敗率高（證據 `b5b3d1a` → `d8ee82a` revert +7557/-813）
  - **L038**：大型升級假設常過度悲觀（EXP 預估 4-8h / 實際 27 分鐘），研究階段應採「先 EXP 驗證再定優先級」
  - **L039**：BAT 內跑 Electron dev 需清 `ELECTRON_RUN_AS_NODE`（跨專案通用）
- 🟡 **待 push**：本 session ~8 個 commit 累計
- 📋 **PLAN-016 Phase 3（PLAN-005 builder 26）暫緩**：等 T0160 merged + 主線穩定 1-2 輪
- 📋 **其他下一輪候選**：
  1. **PLAN-014 Phase 3 Tα3**（若已定義）— 繼續 Git GUI 實作主線
  2. **PLAN-004** 🟡 Medium — GPU Whisper 加速（Win/Linux）
  3. **PLAN-009** 🟡 Medium — Sprint 儀表板 UI
- 💡 **可選 learning 晉升**：L003/L004/L005 等 `candidate: global` 標記已累積多時，下次 `/ct-evolve --playbook` 可評估晉升

### 🟠 上一輪起手式（2026-04-17 17:12 存檔，歷史追溯用）

### 🎉 PLAN-012 全案結案（2026-04-17 17:12）— 5 BUG 批次 CLOSED
**收官**：使用者 rebuild + 重裝後實測 T0145 情境 1-5 + 8 + 9 全綠，D044 批次結案：
- **PLAN-012** ✅ DONE（Quit Dialog + CheckBox 主動關 server，四路徑一致）
- **BUG-031** 🚫 CLOSED（外部 PTY workspace 分配）
- **BUG-033** 🚫 CLOSED（托盤 Quit bypass Dialog）
- **BUG-034** 🚫 CLOSED（checkbox 勾選後 reconnect 路徑 server 未結束）
- **BUG-035** 🚫 CLOSED（watchdog shutdown race 誤 re-fork）
- **T0145/T0147/T0148/T0149/T0150** 全數 DONE

**PLAN-013** 💡 IDEA（🟢 Low）：Installer 檔案鎖定詢問 kill（依 D033 劃出 PLAN-012 範圍，入 backlog）

**🟢 BUG-036** 🚫 CLOSED 🟢 Low（17:30）：T0151 三連修復 `cb0d535`+`feb84df`+`4d9fba4`（status + priority + meta），使用者驗證通過。

**本輪最大收穫**：T0144 實作引爆連環 bug（BUG-033 → BUG-034 → BUG-035），每層靠 log 鐵證定位根因，堅守「塔台不改 code」邊界；研究工單（T0146/T0148）+ 修復工單（T0147/T0149/T0150）節奏穩定。

### 🟠 舊起手式（2026-04-17 14:38 存檔，歷史追溯用）

### 🔴 BUG-033 發現（2026-04-17 14:35）— PLAN-012 T0144 regression
**現象**：使用者 rebuild + 重裝新版 BAT 實測 → **從系統托盤 Quit 時完全沒出現 Dialog**，直接退出，Terminal Server 殘留背景（使用者 Q1.A / Q2.D 確認）。
**影響**：T0145 驗收無法進行（Dialog 是所有情境前提），PLAN-012 設計失效，且破壞原版 Quit 行為（regression）。
**行動**：BUG-033 OPEN + T0146 研究工單已派發（允許 Worker 加 trace log 請使用者重測）。

### 🟢 BUG-032 已 CLOSED（2026-04-17 13:58）
T0143 Task B 全綠：`BAT_HELPER_DIR` 正確、helper 可執行、notify exit 0、UUID 路由無 cwd first-match 誤判。Helper packaging + path resolution 修復鏈（T0139/T0140/T0141）驗收通過。

### 🔴 當前焦點：BUG-033 → T0146 研究 → 修復 → T0145 驗收 → PLAN-012 DONE
T0143 研究定調：採 **Electron 原生 `dialog.showMessageBox`**（內建 checkboxLabel）。T0144 實作完成（commit 412d52c）但使用者實測托盤路徑 Dialog 未觸發。

### 🔴 BUG-035 發現（2026-04-17 16:49）— watchdog shutdown race
**現象**：打包版 T0149 實測勾 checkbox 退出，原 server 真的被殺（log `via TCP shutdown`），但 PtyManager heartbeat watchdog 把 TCP close 誤判為 crash，20ms 內 re-fork 出 PID 26412 孤兒 server → 孤兒持 refed TCP socket → main event loop 卡住 → `crashpad-handler` 殘留。
**性質**：pre-existing watchdog（T0108 期間的 crash recovery 邏輯）+ T0149 graceful TCP close 觸發的 race，**不是 T0149 引入**，是 T0149 才讓它顯現化。
**BUG-034 不退回 FIXING**（原始根因 early-return 已修好，log 為證）；開 BUG-035 另案追蹤。
**修復方向**（T0150）：`PtyManager.beginShutdown()` + `attemptRecovery` guard，shutdown 期間跳過 re-fork。根因明確不需研究工單。

### 🟢 BUG-034 已 FIXED（2026-04-17 16:20）— 等 T0145 情境 8 打包驗收
**現象**：打包版 T0147 修好 Dialog 出現（BUG-033 → VERIFY）後，使用者勾選「一併結束 Terminal Server」checkbox 實測 → `terminal-server.js` 子進程 + `crashpad-handler` 殘留；托盤 + File 兩路徑皆中（Q2.A+B）。
**根因**（T0148 確認）：T0144 `stopTerminalServerGracefully()` 只處理 fork 路徑（`_terminalServerProcess` 有值），BAT reconnect 路徑 `_terminalServerProcess=null` → 早退，SIGTERM 從未發出。
**修復**（T0149 commit `cd460d2`）：方案 C — Step A `child.kill('SIGTERM')` → Step B `sendShutdownToServer(port)` TCP shutdown → Step C `waitForPidFileRemoval` 1500ms → Step D Unix `SIGKILL` / Windows `execFile('taskkill', ['/F','/T','/PID', pid])`；各路徑 log `via <method>`，失敗則 `logger.error`。+ `pty-manager.dispose()` 補 destroy tcpSocket（修 crashpad-handler leak 候選）+ 移除 main.ts:1491 誤報 log。
**驗收計畫**：T0145 擴增**情境 8**（4 子情境 8a/8b/8c/8d，涵蓋 fork/reconnect × dev/packaged × 成功路徑 + fallback）→ 使用者 rebuild + 打包驗收。

### 立即待辦（全部完成 ✅，下一輪新起點）
1. ~~T0144 實作~~ ✅ commit `412d52c`
2. ~~T0146 研究（BUG-033 根因）~~ ✅ commit `4bc8d26`
3. ~~T0147 修復（BUG-033 Tray handler）~~ ✅ commit `ef867a2`
4. ~~T0148 研究（BUG-034 根因）~~ ✅ commit `98be02d`
5. ~~T0149 修復（reconnect + tcpSocket + 誤報 log）~~ ✅ commit `cd460d2`
6. ~~T0150 修復（watchdog guard）~~ ✅ commit `31b4ec2`
7. ~~T0145 驗收（情境 1-5 + 8 + 9 全綠）~~ ✅ 使用者打包實測通過
8. ~~批次 CLOSED + PLAN-012 DONE + PLAN-013 IDEA~~ ✅（D044）

### 下一輪候選（優先級待定）
- **PLAN-004** 📋 PLANNED 🟡：GPU Whisper 加速（Win/Linux）
- **PLAN-009** 📋 PLANNED 🟡：Sprint 儀表板 UI
- **PLAN-013** 💡 IDEA 🟢：Installer 檔案鎖定詢問 kill（本 session 新開）
- **PLAN-001/002/003/005/007** 💡 IDEA 🟢：Vite 升級、Dynamic Import、npm audit、Electron Builder 升級、遠端容器
- **`*evolve`**：本 session 有 learning 候選（T0144 連環 bug 模式 + 工單引用檔案路徑前應驗證存在 + BUG 不退回假 FIXING 的追蹤紀律）
8. BUG-031 runtime 驗證（🟡 Medium，FIXED → CLOSED）— 低優先
9. T0135 PARTIAL（6.2 `--help` 未實作）— 獨立處理
10. Backlog 剩餘 PLAN 待排優先級（PLAN-001~007）

### 本 session 決策
- **D032**：BUG-032 拆單方案 [A]（一張統籌 BUG + 一張研究 + N 張修復）；`_local-rules.md` 暫不動 [A]（避免破壞 baseline，等 BUG-032 整體方案敲定一起改）
- **追加**：BUG-031 維持 FIXED 狀態（PTY allocation 邏輯本身已透過使用者實測驗證），副作用檢查併入 BUG-032 範圍
- **D033**（2026-04-17 13:15）：建立 PLAN-012 — Quit Dialog 加「一併結束 Terminal Server」CheckBox，預設**不勾選**（避免誤按關掉背景 server）；Installer 強制 kill 另開 PLAN；時程緊急，排 T0142 驗收後
- **D034**（2026-04-17 13:25）：PLAN-012 拆單策略 Q1.D + Q2.A — 先派研究工單 T0143 摸清 Quit Dialog + Terminal Server 現狀；T0142 驗收 checklist Phase 2-5 內嵌到 T0143「Task B」觀察表，T0142 狀態改 🔀 MERGED；dogfood 驗收（派 T0143 行為本身即為 BUG-032 鏈路驗證）；CT 上游回 PR 編號順延
- **D035**（2026-04-17 13:58）：PLAN-012 UI 路線定調 — 採 **Electron 原生 `dialog.showMessageBox`**（內建 checkboxLabel），放棄 Custom React Modal；main.ts +~50 行 + i18n 6 行，零 React 改動，零 IPC 擴充
- **D036**（2026-04-17 13:58）：**BUG-032 → CLOSED** — T0143 Task B B1/B3/B4/B5 全綠（BAT_HELPER_DIR 正確、helper 可執行、notify exit 0、UUID 路由無 cwd 誤判），BUG-032 原範圍（helper packaging + path resolution）完全驗收通過；**版本更新檔案鎖定**問題屬 PLAN-012 範圍，獨立追蹤不混為一談
- **D037**（2026-04-17 14:00）：PLAN-012 拆單定案 — 採 T0143 Worker 推薦方案 B（2 張）：**T0144 實作**（`before-quit` 原生 Dialog + CheckBox + SIGTERM+timeout fallback + i18n，~60-80 行）+ **T0145 驗收**（6 情境 + 版本更新安裝場景）；T0142 合併完成後狀態改 ✅ DONE
- **D038**（2026-04-17 14:35）：**BUG-033 建立 + T0146 派發** — 使用者實測 rebuild + 重裝後托盤 Quit 無 Dialog 直接退出（Q1.A/Q2.D 確認），Terminal Server 殘留；屬 T0144 regression。策略：開研究工單（非直接修復）— 根因不明（可能 Tray handler bypass `before-quit` / Dialog async race / packaging 未涵蓋 / i18n init 失敗）；研究允許 Worker 加 trace log 請使用者重測（使用者已主動授權）。不直接派修復因為風險：盲修可能再 regression，也無從驗證其他 Quit 路徑（File/Ctrl+Q/視窗X）是否同病
- **D046**（2026-04-17 17:30）：**BUG-036 CLOSED + T0151 DONE（含 priority follow-up）** — Worker 實際根因比塔台假設精確：`src/types/backlog.ts:55` `sectionToStatus` 只認 `DONE`/`已完成`，不認 `COMPLETED`（而 skill 模板 `_backlog.md` 用的是 `## Completed`）→ fallback 'IDEA'；外加 Completed 表 schema 無「狀態」欄 → `rowStatusToStatus` 無法 override。雙因合力。修復三連：`cb0d535`（加 COMPLETED match 主修）+ `feb84df`（meta）+ `4d9fba4`（使用者追加反映 priority 也 Unknown，Worker 新增 `extractPriorityFromPlanContent` 從 PLAN metadata 補讀）。使用者驗證通過 → BUG-036 OPEN→CLOSED + T0151 DONE。**潛在上游 PR 候選**：本修復對所有使用 CT Panel 框架的專案都有用，類似 PLAN-011 模式可推回 CT 上游（留待後續評估）。
- **D045**（2026-04-17 17:22）：**BUG-036 建立 + T0151 派發（UI parser 缺 DONE 支援）** — D044 批次結案後使用者在 CT panel Backlog tab 發現 PLAN-012 顯示 Unknown 而非 Done，右側詳細頁正確顯示 ✅ DONE → UI 列表 parser 問題（列表 parser 可能只讀 `_backlog.md` Active 表找不到 Completed 區塊的 PLAN / 或 status enum mapping 缺 DONE case / 或 regex 未覆蓋）。非緊急純 UI 顯示缺陷，嚴重度 🟢 Low，不影響資料正確性。使用者選項 [B]：直接派修復工單（T0151），Worker 自行 grep 定位 parser，不另派研究工單。預期修完後類似 PLAN-008/010/011 歸檔前的 DONE 顯示邏輯將補齊。
- **D044**（2026-04-17 17:12）：**PLAN-012 全案結案 + 5 BUG 批次 CLOSED + PLAN-013 開立（IDEA）** — 使用者完成 rebuild + 重裝後實測：BUG-031 / BUG-033 / BUG-034 / BUG-035 **全部通過驗收**（T0145 情境 1-5/8/9 全綠）。一次結案：BUG-031 FIXED→CLOSED（T0137 runtime 驗證通過）、BUG-033 VERIFY→CLOSED（T0147 四路徑通過）、BUG-034 FIXED→CLOSED（T0149 方案 C 通過）、BUG-035 OPEN→CLOSED（T0150 watchdog guard 通過）、PLAN-012 PLANNED→DONE（四個實作 commits `412d52c`+`ef867a2`+`cd460d2`+`31b4ec2`）、T0145 READY→DONE、T0149/T0150 FIXED→DONE。**情境 7（installer 強制 kill 檔案鎖定場景）依 D033 劃出範圍**，使用者選項 [B] 另開 PLAN-013 IDEA 🟢 Low 入 backlog，不排入本輪結案。本輪最大收穫：T0144 實作引爆連環 bug（BUG-033 regression + BUG-034 reconnect early-return + BUG-035 watchdog race），每一層都靠 log 鐵證快速定位根因，堅守「塔台不直接改 code」邊界讓所有決策透明可追。
- **D043**（2026-04-17 16:49）：**BUG-035 建立 + T0150 派發（不退回 BUG-034）** — 使用者實測 T0149 打包版勾 checkbox 退出，觀察到 `terminal-server.js` + `crashpad-handler` 仍殘留。Log 鐵證（08:42:48 時間序）：`.814 TCP closed` → `.814 Terminal Server died — attempting recovery` → `.815 re-forking` → `.833 re-forked with pid 26412` → `.839 [quit] terminal server stopped (via TCP shutdown)`。性質明確：**BUG-034 根因已修好**（原 server graceful close，log `via TCP shutdown` 為證），但 PtyManager heartbeat watchdog（pre-existing T0108 期間的 crash recovery 邏輯）把 T0149 觸發的 graceful TCP close 誤判為 crash → 20ms 內 re-fork 孤兒 server PID 26412 → 孤兒持 refed TCP socket 卡住 main event loop → crashpad-handler 殘留。不是 T0149 引入，是 T0149 才讓它顯現化（之前 SIGTERM 根本沒送，watchdog 自然不觸發）。**BUG-034 保持 FIXED**（避免假退回汙染追蹤），開 BUG-035 另案追蹤。修復方向明確（`PtyManager.beginShutdown()` + `attemptRecovery` guard）→ 不需研究工單直接派 T0150。
- **D042**（2026-04-17 16:20）：**T0149 完成採 Worker 方案偏差合理化** — Worker 實作方案 C 時遭遇 2 處工單指示與現實衝突：(1) 工單要求用 `src/utils/execFileNoThrow.ts`，但此 util **不存在於本專案** → Worker 採專案既有 pattern（main.ts:1696、2353 已用動態 import + `execFile` 非 `exec` + Promise wrapper），安全性等價（`execFile` 天生無 shell 解析、`windowsHide: true`、`timeout: 3000`）；(2) `getPidFilePath` 為 pid-manager.ts module-local 未匯出 → Worker 硬編碼 `path.join(userDataPath, 'bat-pty-server.pid')` 並在註解標註「與 pid-manager.ts:4 `PID_FILENAME` 常數保持一致，若未來檔名變更需同步兩處」。兩處偏差塔台**批准合理化**：Worker 判斷正確（安全性等價 + 不新建 util 檔符合保守原則），但塔台寫工單時**未驗證 `execFileNoThrow.ts` 存在**是疏漏，learning 候選（工單引用具體檔案路徑前應先 grep 確認）。BUG-034 FIXING → FIXED（等 T0145 情境 8 打包驗收）
- **D041**（2026-04-17 16:04）：**T0148 結論採方案 C + 派發 T0149** — Worker Static 分析 + log 證據鏈完整確定根因：T0144 `stopTerminalServerGracefully()` 只處理 fork 路徑（`_terminalServerProcess` 有值），reconnect 路徑 `_terminalServerProcess=null` → `if (!child) return` 早退，SIGTERM 從未發出。log L123→L124 只差 1ms 鐵證。使用者在 T0148 互動 [15:54] 選定**方案 C**（TCP shutdown 優先 → PID SIGTERM fallback → Windows taskkill 兜底）+ 同意併修 tcpSocket leak（`pty-manager.dispose` 漏 destroy tcpSocket，疑似 crashpad-handler 殘留根因）+ 修誤報 log。T0149 範圍：3 檔案修改（main.ts 重寫 stop 函式 / pty-manager dispose 補 destroy / main.ts:1424 移除誤報 log）。**關鍵約束**：Windows taskkill 必須用專案 util `src/utils/execFileNoThrow.ts`（shell-safe，security hook 約束）。BUG-034 → FIXING
- **D040**（2026-04-17 15:38）：**BUG-034 建立 + T0148 研究工單派發** — 使用者重測打包版（含 T0147 `ef867a2`）確認 Dialog 會問 ✅ + checkbox 可勾 ✅，但勾選後仍殘留 `terminal-server.js` 子進程 + `crashpad-handler`（暗示 main 也沒完全退）。使用者確認托盤 + File 選單**兩條路徑都中**（Q2.A+B）→ 非路徑特定，是 checkbox → kill-server 邏輯本身失效。與 BUG-033（Dialog 不出現）性質不同，開新 BUG-034 另案追蹤避免 scope 爆炸。派研究工單而非直接修復 — 理由：可能根因多元（SIGTERM 對象 / Windows signal 行為 / child handle 遺失 / timeout race / main exit 未觸發），盲修風險高。Q3.C 授權 Worker 自行判斷 static vs trace log 策略。嚴重度 🟡 Medium（Dialog 主功能 OK，checkbox 為延伸功能，workaround 為工作管理員手動結束）
- **D039**（2026-04-17 14:58）：**T0146 結論採方案 A + 派發 T0147** — Worker 靜態分析 + log 交叉驗證 100% 確定根因（電子證據鏈：main.ts:540-546 Tray handler / main.ts:1334-1339 before-quit 守護條件 / log 完全無 `[quit]` prefix），未使用 trace log。**性質確認**：pre-existing bug，非 T0144 引入（Tray handler 的 `isAppQuitting = true` 在 commit `d09c45e` 就存在），但 T0144 才顯現化（T0144 前沒 Dialog 感知不到）。採方案 A（刪除 1 行）而非 B（改守護條件，跨路徑驗證面積大）或 C（重構 ~80 行 overkill）。雖僅 1 行改動仍派工單而非塔台自主 commit — 理由：屬邏輯變更 + regression 修復 + 需 4 路徑冒煙測試，超出 `auto_commit` 小變動範圍

### 本 session 新增工單
| ID | 標題 | 狀態 |
|----|------|------|
| BUG-032 | Helper scripts 打包與路徑解析設計缺漏 | 🚫 CLOSED |
| T0138 | 研究：BAT Helper Scripts 打包與路徑解析設計 | ✅ DONE |
| PLAN-012 | Quit Dialog 新增「一併結束 Terminal Server」CheckBox | 🔄 IN_PROGRESS |
| T0143 | 研究：Quit Dialog + Terminal Server 現狀（PLAN-012 起手 + T0142 驗收內嵌） | ✅ DONE (commit 215e8757) |
| T0144 | PLAN-012 實作：Quit Dialog + CheckBox（原生 dialog + SIGTERM fallback + i18n） | ⚠️ DONE but regression 顯現化（commit 412d52c） |
| T0145 | PLAN-012 驗收：6 情境 + 版本更新安裝場景 + BUG-033 四路徑打包覆蓋 | 📋 READY（等 build） |
| BUG-033 | 托盤 Quit 無 Dialog 直接退出，Terminal Server 殘留背景 | 🔍 VERIFY（dev serve 四路徑通過，等打包驗收） |
| T0146 | 研究：托盤 Quit 為何 bypass Dialog（BUG-033 根因調查） | ✅ DONE（推薦方案 A） |
| T0147 | 修復：刪除 Tray handler 的 `isAppQuitting = true`（方案 A，1 行） | ✅ DONE（commit `ef867a2`） |
| BUG-034 | Quit Dialog checkbox 勾選後 Terminal Server 未結束（托盤 + File 皆中） | 🔧 FIXING |
| T0148 | 研究：checkbox → kill-server 邏輯失效根因（BUG-034 根因調查） | ✅ DONE（commit `98be02d`，推薦方案 C） |
| T0149 | 修復：stopTerminalServerGracefully 支援 reconnect 路徑 + tcpSocket leak + 誤報 log（方案 C） | ✅ FIXED（commit `cd460d2`，log `via TCP shutdown` 證實 early-return 已修；T0145 情境 9.1 發現 watchdog race → BUG-035） |
| BUG-035 | PtyManager watchdog 在 shutdown 期間誤觸發 re-fork，孤兒 server 卡住 main event loop | 🚫 CLOSED（D044） |
| T0150 | 修復：PtyManager.beginShutdown() + attemptRecovery guard 避免 graceful shutdown 被誤判 crash | ✅ DONE（commit `31b4ec2`，T0145 情境 9.1 驗收通過） |
| PLAN-013 | NSIS Installer 偵測檔案鎖定時詢問 kill Terminal Server | 💡 IDEA 🟢 Low（D044 依 D033 剝離，入 backlog） |
| BUG-036 | CT Panel Backlog 列表對 DONE 狀態的 PLAN 顯示 Unknown | 🚫 CLOSED（D046） |
| T0151 | 修復：CT Panel Backlog 列表讓 DONE PLAN 正確顯示 Done（BUG-036） | ✅ DONE（commits `cb0d535`+`4d9fba4`，使用者驗證通過） |

### 本 session 新增工單（2026-04-17 02:00-03:05）
| ID | 標題 | 狀態 | Commit |
|----|------|------|--------|
| T0135 | BAT v2.x + CT v4.1.0 全鏈路驗收（統籌） | ✅ DONE | c98a04c, 8ec97ad |
| T0136 | BUG-030 修復 — MSYS 路徑轉換 | ✅ FIXED | f77d2d0 |
| T0137 | BUG-031 修復 — PTY workspace 分配 | ✅ FIXED | f325d1d |
| BUG-030 | bat-terminal.mjs Git Bash MSYS 路徑污染 | 🚫 CLOSED | c23bae2 |
| BUG-031 | 外部 PTY 被分配到錯 workspace（cwd first-match） | ✅ FIXED（待驗） | 7fdd76a |

### 本 session 關鍵發現
1. **BUG-030**：Git Bash MSYS2 把 `/ct-exec` 誤轉成 `C:/Program Files/Git/ct-exec`，T0136 加 regex 還原
2. **BUG-031 真根因**：不是「default workspace」，是 `cwd.startsWith(folderPath)` first-match，當 parent + 子專案 workspace 都打開時 match 到較早建立的
3. **PARTIAL**：`bat-terminal.mjs --help` 未實作（會被當命令執行）
4. **Worker→Tower 通知鏈路** 不受 BUG-031 影響（PTY 預填用 targetId 全域唯一；Toast 廣播到所有 BrowserWindows）— 仍需 T0138 runtime 確認

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（Open: 0 / Fixed: 1 / Closed: 1）
- Backlog → [_backlog.md](_backlog.md)
- 工單列表 → 熱區 14 + EXP/CP 雜項 — 全部 ✅ DONE 或 ✅ FIXED

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
