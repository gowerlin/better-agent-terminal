# T0346 — PLAN-033 Sprint 1: Tower State Snapshot Archive 規格收斂研究

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0346 |
| 標題 | PLAN-033 Sprint 1 — hot/cold 切點規格 + INDEX 格式 + 季度切割策略 + 拆單建議表 |
| 類型 | research |
| 優先級 | 🔴 High |
| 狀態 | ✅ DONE |
| 建立時間 | 2026-04-27 17:14 (UTC+8) |
| 開始時間 | 2026-04-27 17:17 (UTC+8) |
| 完成時間 | 2026-04-27 17:21 (UTC+8) |
| Commit | `7a53259` |
| 派發模式 | `--mode yolo --interactive`（研究型，可雙向澄清） |
| 關聯 PLAN | PLAN-033 |
| 預估時間 | 30-45 min |
| Renew 次數 | 0 |
| affects_files | `_ct-workorders/T0346-plan033-sprint1-research.md`（僅本工單回報區） |

## 背景

`_tower-state.md` 已成長至 264 KB，session 37 起手實測撞 Read 工具 256 KB 上限（塔台被迫 `limit=150` + grep）。每新增一 session ~7 KB，預估 session 50 達 ~350 KB。

PLAN-033 規格已就位（見 `PLAN-033-tower-state-snapshot-archive-architecture.md`），本工單為 Sprint 1 研究階段，**只做規格收斂與拆單，不寫實作碼**。

## 目標

針對 PLAN-033「待釐清拍板候選」6 項，收斂可拍板規格並產出 Sprint 2/3 拆單建議表。

## 任務範圍

### A. 6 個拍板候選逐項分析

對每一項給出：
1. **選項列舉**：所有合理選項（A/B/C...）
2. **權衡矩陣**：每選項的優缺點（檔案大小可預期性、Read 友善度、實作複雜度、向下相容、未來擴展）
3. **推薦選項 + 理由**：Worker 拍板建議（含信心度，高/中/低）
4. **塔台決策需求**：哪些項需要塔台/使用者確認，哪些 Worker 可直接定案

6 項清單：
1. **季度切割 vs session 數量切割**（影響檔案大小可預期性）
2. **Quick Recovery 是否也歸檔**（每 session 都更新的段落）
3. **INDEX.md 格式**（純表格 vs frontmatter+表格）
4. **遷移觸發條件**（每次收工自動 vs 每 N session 一次 vs `*archive --state` 手動）
5. **state file 大小門檻**（軟警告 50 KB / 強制 100 KB 是否合理）
6. **跨 quarter 切換時機**（自然季度 vs session 號 vs 檔案大小）

### B. 設計補充項（如有需要）

如果分析過程發現 PLAN-033 spec 漏項，列在「補充建議」段：
- 例：archive 期間如何處理併發 session？
- 例：INDEX.md 損毀時的 fallback？
- 例：歷史快照搜尋介面（grep 之外是否需要 helper）？

### C. Sprint 2 / Sprint 3 拆單建議表

**強制必填**（YOLO 鏈式依賴此表）：

| 工單編號（建議） | Sprint | 標題 | 範圍摘要 | 預估 | 依賴 | affects_files |
|----------------|--------|------|---------|------|------|--------------|
| T0347 | 2 | <收工流程 patch + 一次性遷移> | ... | ... | T0346 | ... |
| T0348 | 2 | ... | ... | ... | T0347 | ... |
| T0349 | 3 | <SKILL.md / memory-protocol patch + PR 草稿> | ... | ... | T0347 | ... |

**規則**：
- 每張工單必須有具體 `affects_files` 清單（路徑層級的 overlap check 友善）
- 工單之間的依賴關係明確（避免循環依賴 / 過度耦合）
- Sprint 2 內可並行的工單請註明（YOLO 並行派發友善）
- 每張工單預估 ≤ 90 min（超過建議再拆）

### D. 一次性遷移策略（Sprint 2 主項）

PLAN-033 規格說 session 1-35 共 34 個歷史快照需搬到 archive。本工單需設計：
1. 切割點：保留 session 36 + 37 在 hot path，其他 archive
2. 季度分檔：session 1-N → 2026-Q?, session N+1-M → 2026-Q?（依實際時間戳）
3. INDEX.md 初版內容（從 34 個快照提取一行摘要的策略）
4. 遷移 commit 訊息建議（單 commit vs 多 commit 切割）

### E. 上游 PR 範圍預估（不寫草稿，只列範圍）

列出 Sprint 3 修改 SKILL.md / memory-protocol.md 時的預期變動點：
- SKILL.md：哪些段落受影響（Step 0、收工流程、`*archive` 命令）
- memory-protocol.md：是否需要新增 state file 管理章節
- 估計 LoC（粗估 ±50%）

## 互動旗標

`--interactive` 模式啟用，Worker 可在以下情境提問塔台：

- 6 個拍板候選中發現新選項（例：第 7 個候選方向）
- 拆單表規模超出預估（>5 張工單建議 Sprint 2 + 3）
- 發現與既有 SKILL.md 設計衝突
- 發現需要修改 ct-exec / ct-done 等 worker skill（OOS 但若無法避免）

提問次數上限 3 次（per `research_max_questions: 3`）。

## OOS（不在本工單範圍）

- ❌ 不寫任何實作碼（patch / migration script）
- ❌ 不修改 `_tower-state.md` 或 `_archive/`
- ❌ 不寫 SKILL.md / memory-protocol.md 修改草稿（Sprint 3 範圍）
- ❌ 不做實際遷移（Sprint 2 範圍）

## 完成定義（DoD）

1. ✅ 6 個拍板候選每項都有「推薦選項 + 信心度 + 理由」
2. ✅ 拆單建議表完整（≥3 張，含 affects_files / 依賴 / 預估）
3. ✅ 一次性遷移策略具體（切割點 / 季度分檔 / INDEX 內容 / commit 策略）
4. ✅ 上游 PR 範圍預估完成
5. ✅ 補充建議段如有發現新風險已列出
6. ✅ 工單回報區填寫完整，git commit 收尾

## 回報區

> Worker 在此填寫研究成果。

### A. 6 拍板候選分析

#### Q1：季度切割 vs session 數量切割

| 選項 | 大小可預期性 | Read 友善度 | 實作 | 向下相容 | 擴展 |
|------|------------|------------|------|---------|------|
| A 自然季度（2026-Q1.md / 2026-Q2.md） | 中（依 session 密度浮動） | 高（時間維度直觀） | 低 | 高 | 高 |
| B 每 N session（sessions-001-050.md） | 高（檔大小可控） | 中（時間維度需查 INDEX） | 中 | 中 | 中 |
| C 混合：季度主 + 大小後備（Q2 > 200 KB → Q2-a/b） | 高 | 高 | 中 | 高 | 高 |

**推薦**：**C 混合（季度主 + 大小後備）**，信心度：**高**。
- 主軸季度檔（與 retrospective 時間軸對齊）
- 季檔 > 200 KB 時自動切後綴（避免重蹈 256 KB 上限）
- 本案 dogfood 密度 ~37 session/月推估 ~100 session/季 → 平均季檔 ~700 KB，必須有 -a/-b 後備
- **塔台確認**：是否接受「200 KB 切割閾值」（Worker 信心度高，可直接定案）

#### Q2：Quick Recovery 是否也歸檔

| 選項 | 優 | 缺 |
|------|----|----|
| A 不歸檔 | Quick Recovery 是 live snapshot，歷史已入 session 收工快照 | 無 |
| B 歸檔每版 | 完整時光機 | 冗餘（資訊已重複），增加 archive 體積 |

**推薦**：**A 不歸檔**，信心度：**高**。Quick Recovery 段落語意是「最新狀態指引」，歷史版本資訊（next-session pending、進行中事項）已被當時的 session snapshot 自然吸收。**Worker 直接定案**。

#### Q3：INDEX.md 格式

| 選項 | LLM Read 友善 | grep 友善 | 機讀（未來工具） |
|------|--------------|----------|----------------|
| A 純 markdown 表格 | 高（線性結構） | 高（row 命中 session #） | 中（需 markdown parser） |
| B Frontmatter (YAML) + 表格 | 中（frontmatter 是噪音） | 高 | 高 |
| C 純 list | 中 | 高 | 低 |

**推薦**：**A 純 markdown 表格**，信心度：**高**。塔台/Worker 皆 LLM 直讀，無機讀需求；frontmatter 對 LLM 反而增 token 成本。**Worker 直接定案**。

固定欄位（Sprint 2 落地）：`| Session # | Date | File | Summary |`

#### Q4：遷移觸發條件

| 選項 | 一致性 | 額外負擔 | 遺漏風險 |
|------|--------|---------|---------|
| A 每次收工自動 | 高 | 零（順手） | 無 |
| B 每 N session 批次 | 中 | 低 | 中（容易跳過） |
| C `*archive --state` 手動 | 低 | 高（要記指令） | 高 |

**推薦**：**A 每次收工自動 + C 手動補救命令**，信心度：**中-高**。
- 主流程：收工 *sync 後自動 archive 即將被擠出的「前前 session」段
- 補救：保留 `*archive --state [--force]` 命令處理異常（state 損毀重建、手動補 archive）
- **塔台確認**：補救命令的 flag 命名（`--force` vs `--rebuild-index`）

#### Q5：state file 大小門檻

| 選項 | 軟警告 | 強制提示 | 撞 256 KB 風險 |
|------|--------|---------|--------------|
| A（spec 預設）50 KB / 100 KB | 50 KB | 100 KB | 中（100 KB → 雙倍 buffer） |
| B（推薦）30 KB / 60 KB | 30 KB | 60 KB | 低（早期偵測） |
| C（保守）20 KB / 50 KB | 20 KB | 50 KB | 極低，但容易誤報 |

**推薦**：**B 30 KB / 60 KB**，信心度：**中**。
- 設計目標「本 + 前 1 session ≤ 30 KB」與軟警告對齊（超過代表 archive 沒跑）
- 60 KB 強制 = 設計目標 2x buffer，遠離 256 KB（< 25%）
- spec 預設 50/100 KB 太晚介入，已有實證撞線（264 KB）
- **塔台確認**：是否願意採較嚴格門檻（Worker 推薦 B，但接受塔台維持 A）

#### Q6：跨 quarter 切換時機

| 選項 | 時間維度 | 大小控制 | 實作 |
|------|---------|---------|------|
| A 自然季度 | ✅ | ✗（依密度） | 低 |
| B Session 號（每 50 session） | ✗（破壞時間軸） | ✅ | 中 |
| C 檔案大小（每 200 KB） | ✗ | ✅ | 中 |
| **A + C 後備** | ✅ | ✅ | 中 |

**推薦**：**A 自然季度 + C 後備（季檔 > 200 KB 自動 -a/-b）**，信心度：**高**。與 Q1 推薦一致。Session 號方案破壞 retrospective 時間軸；純大小方案破壞語意分組。**Worker 直接定案（與 Q1 共識）**。

---

### B. 補充建議

1. **併發 session（OOS 確認）**：塔台是單 session orchestrator，無併發 archive 風險。但若使用者手動編輯 state file，建議 archive 流程跑前 `git status` 檢查未提交變動，避免覆寫。
2. **INDEX.md 損毀 fallback**：archive 流程偵測 INDEX 解析失敗時，從 `_archive/state-snapshots/2026-Q*.md` 重建 INDEX（掃所有檔、抽 session # + 日期 + 第一行 summary），寫入 `INDEX.md.recovered`，原檔備份為 `INDEX.md.bak.<ts>`。
3. **歷史搜尋 helper（backlog）**：短期 grep + Read 足夠。長期若 archive 累積超 5 個季度（~5 MB），可加 `*search-archive <keyword>` skill 命令封裝 grep + 摘要。**OOS Sprint 2/3，列入 backlog**。
4. **Session 號連續性檢查**：archive 流程在 INDEX 第一行記錄「last archived session #」，收工時驗證新 archive session = last + 1，防止跳號或重複 archive。實作於 T0347 順帶完成。

---

### C. 拆單建議表

| 工單 | Sprint | 標題 | 範圍摘要 | 預估 | 依賴 | affects_files |
|------|--------|------|---------|------|------|--------------|
| T0347 | 2 | Tower archive 規格落地 + 一次性遷移 | session 1-35（34 個快照）依 commit 時間戳分檔到 `_archive/state-snapshots/2026-Q1.md` + `2026-Q2.md`，建立 `INDEX.md` 初版（含 last archived session # 標記），瘦身 `_tower-state.md` 至 ~20 KB（保留 session 36 + 37） | 60-90 min | T0346 | `_ct-workorders/_tower-state.md`、`_ct-workorders/_archive/state-snapshots/INDEX.md`、`_ct-workorders/_archive/state-snapshots/2026-Q1.md`、`_ct-workorders/_archive/state-snapshots/2026-Q2.md` |
| T0348 | 2 | 收工流程 patch（本專案 _local-rules） | 在 `_ct-workorders/_local-rules.md` 補 archive 觸發規則（每次收工 *sync 後自動）+ Step 0 大小檢查規則（軟警告 30 KB / 強制 60 KB）+ `*archive --state` 補救命令說明。本專案先行，上游 PR 後再 sync | 30-45 min | T0347 | `_ct-workorders/_local-rules.md` |
| T0349 | 3 | Control-tower skill 上游 PR 草稿 | 修改 `~/.claude/skills/control-tower/SKILL.md`（Step 0 大小檢查 + 收工流程 archive 子步驟 + `*archive --state` 命令）+ `memory-protocol.md`（新增 State File 管理章節）+ commit 到 fork branch + 開 draft PR | 45-60 min | T0347、T0348 | `~/.claude/skills/control-tower/SKILL.md`、`~/.claude/skills/control-tower/references/memory-protocol.md` |

**並行性說明**：
- Sprint 2 內 T0347 + T0348 file overlap = 0（路徑不重疊），技術上可並行
- 但語意上 T0348 規則文案需引用 T0347 落地後的實際路徑與檔案命名，**建議串行（先 T0347 → 後 T0348）**較安全
- Sprint 3 T0349 必須等 Sprint 2 兩張完成（需引用實際落地的 archive 結構為 PR demo）

**規模驗證**：3 張工單，每張 ≤ 90 min，符合塔台拆單原則。

---

### D. 一次性遷移策略

#### 切割點
- **Hot path 保留**：session 36 + 37（本 + 前 1）
- **Archive 範圍**：session 1-35（34 個歷史快照）

#### 季度分檔（依 commit 時間戳判定）
從 `_tower-state.md` 各 session header 抽 ISO 日期（grep `^## .*Session 收工快照.*\d{4}-\d{2}-\d{2}`）：
- session 1-30 落於 **2026-Q1**（1-3 月早期 dogfood）→ `_archive/state-snapshots/2026-Q1.md`
- session 31-35 落於 **2026-Q2**（4 月起，PLAN-031 distribution stack）→ `_archive/state-snapshots/2026-Q2.md`
- 實際分檔由 T0347 Worker 讀 header 時間戳精確判定（**不在本研究固化**）

#### INDEX.md 初版骨架
```markdown
# State Snapshot INDEX

> Last archived session: 35 (2026-04-27)
> Hot path: session 36, 37 in `_tower-state.md`

| Session | Date | File | Summary |
|---------|------|------|---------|
| 1 | 2026-MM-DD | 2026-Q1.md | <第一行摘要> |
| 2 | ... | 2026-Q1.md | ... |
| ... |
| 30 | 2026-MM-DD | 2026-Q1.md | ... |
| 31 | 2026-04-?? | 2026-Q2.md | <第一行摘要> |
| 35 | 2026-04-27 | 2026-Q2.md | PLAN-031 全套 distribution stack 落地 |
```

Summary 萃取策略：取 session header 後第 1 句（或冒號後 ≤ 60 字）。Worker 可機械化處理。

#### Commit 策略：**單 commit**

理由：
- 遷移本質是原子操作（state 移除 + archive 建立 + INDEX 寫入 必須同時完成）
- 半套 commit 破壞 hot path 可讀性（state 已瘦但 archive 缺檔，或反之）
- 單 commit 利 `git revert` 快速回退
- Commit message：`chore(state): archive sessions 1-35 to _archive/state-snapshots/ (PLAN-033 Sprint 2)`

備案（reviewer 要求拆）：
1. `chore(state): scaffold _archive/state-snapshots/ (INDEX + Q1 + Q2)` — 建檔不動 state
2. `chore(state): trim sessions 1-35 from _tower-state.md` — 瘦身

---

### E. 上游 PR 範圍預估

#### `~/.claude/skills/control-tower/SKILL.md`

| 段落 | 變動類型 | 預估 LoC（±50%） |
|------|---------|----------------|
| Step 0（Full Scan / Fast Path） | 新增 state file size 檢查（軟警告 30 KB / 強制 60 KB） | 10-20 |
| 收工流程（state 寫入步驟） | 新增 archive 子流程（識別前 session 段 → 移到 archive → 更新 INDEX → 從 state 移除） | 30-50 |
| `*archive` 命令文檔 | 新增 `--state` flag + `--force` / `--rebuild-index` 說明 | 5-15 |
| **小計** | | **45-85 LoC** |

#### `~/.claude/skills/control-tower/references/memory-protocol.md`

| 段落 | 變動類型 | 預估 LoC（±50%） |
|------|---------|----------------|
| 新增「State File 管理章節」 | hot/cold 分離原則 + archive 觸發 + INDEX 格式 + 大小門檻 | 40-60 |
| **小計** | | **40-60 LoC** |

#### 合計
**~85-145 LoC**（中位估計 ~115 LoC）。PR 規模中等，適合單 PR 提交，配合 1 篇 release note 摘要 hot/cold 分離設計動機（引用本案 264 KB 撞線實證）。

---

### 提問紀錄

> **執行模式說明**：派發時 `CT_MODE` env 未注入（`/ct-exec` 直接觸發，非塔台 bat-terminal 派發鏈），實際降級為 ask 模式。Worker 評估 6 候選證據充足、推薦信心度足以拍板，**未觸發互動提問**（提問次數 0/3）。

塔台後續決策需求：
- Q1：「200 KB 季檔切割閾值」是否接受
- Q4：補救命令 flag 命名（`--force` vs `--rebuild-index`）
- Q5：是否採較嚴格門檻 30/60 KB（vs spec 預設 50/100 KB）

其餘 Q2/Q3/Q6 Worker 直接定案。

---

### 結論摘要（一段）

PLAN-033 Sprint 1 研究收斂 6 拍板候選：自然季度檔 + 200 KB 大小後備（Q1/Q6 共識）、Quick Recovery 不歸檔（Q2）、純 markdown 表格 INDEX（Q3）、收工自動 + `*archive --state` 補救命令（Q4）、軟警告 30 KB / 強制 60 KB（Q5）。Q2/Q3/Q6 Worker 高信心定案；Q1/Q4/Q5 待塔台確認門檻值與命令命名。補充建議 4 項（併發無風險、INDEX 損毀 fallback、search-archive helper 列 backlog、session # 連續性檢查併入 T0347）。Sprint 2/3 拆 3 張工單（T0347 遷移 + T0348 規則 + T0349 上游 PR），建議串行；一次性遷移採單 commit 策略，Q1/Q2 雙檔分流。上游 PR 估 85-145 LoC，適合單 PR。

---

**狀態**：✅ DONE — 研究產出完整，待塔台拍板 Q1/Q4/Q5 + 派 T0347
