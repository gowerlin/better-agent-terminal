# Tower State — better-agent-terminal

> 最後更新:2026-05-19 15:10 (UTC+8) — **第四十五 session 收工** — BUG-081 結案校正 + 使用者驗收通過；*sync 重建索引（編號 drift 修正）；*archive 6 檔；state hygiene archive sessions 42/41/39 → 2026-Q2-c.md。
>
> **下次起手**:Fast Path 載入;立即待辦見「🌅 起手式」— 主軸 PLAN-032 三 BUG smoke(BUG-072/073/074)→ CLOSED → PLAN-032 → DONE。
>
> **前次更新**:2026-05-15 13:15 (UTC+8) — 第四十三 session 收工:BUG-080 全線收尾 + 環境校正。

---

## 🛏 本 Session 收工快照 (第四十五 session, 2026-05-19 14:38 - 15:10, ~32 min wall)

### 主軸：BUG-081 結案校正 + *sync + *archive + state hygiene

#### 時間線

1. **14:38 起手**：Fast Path 恢復（快照 2026-05-17，< 7 天）；面板 T:14 / BUG:9 / PLAN:6
2. **14:38 BUG-081 驗收通過**（使用者確認）→ session 44 硬條件（Claude Worker `bat-notify --submit` regression smoke）滿足。BUG-081 實際早於 2026-05-18 已 CLOSED（T0357 修復 + T0358 Claude runtime smoke, commit `7327c03`），本 session 補登驗收
3. **14:38 校正 BUG-081**：frontmatter 移除重複 `closed_at` + 補 `verified_at`/`verified_by`；body Metadata 表 `狀態` OPEN→CLOSED（PLAN-034 drift 修正）
4. **14:58 *sync**：重建 `_bug-tracker.md`（前次同步停在 05-17 01:08，已過期）+ `_backlog.md`；編號 drift 修正 state 編號起始 T0357/D110 → T0359/D119
5. **15:02 *archive**：6 檔 git mv 至冷區（T0354/T0355/T0356/T0357 + BUG-079/080），熱區 BUG 9→7；再 sync 重建 tracker
6. **15:10 state hygiene**：sessions 42/41/39 → `2026-Q2-c.md`（-b 已 195KB 近 cap），INDEX +3（total 61），state 瘦身

### 本輪戰績

| 類別 | 數量 | 備註 |
|------|------|------|
| BUG 結案校正 | 1（BUG-081） | drift 修正 + 使用者驗收補登 |
| *sync | 2 次 | 重建 tracker/backlog，編號 drift 修正 |
| 歸檔工單/BUG | 6 | T0354-57 + BUG-079/080 → _archive/ |
| state 快照歸檔 | 3 | sessions 42/41/39 → 2026-Q2-c.md |
| Worker 派發 | 0 | 純塔台維運 session |
| 主線 commits | 0（塔台 chore；待使用者授權 push） | |

### 立即待辦（傳承）

1. 🔴 **PLAN-032 三 BUG smoke**：BUG-072/073/074 皆 🔍 VERIFY 待人工 smoke → CLOSED → PLAN-032 → DONE
2. 🟡 **BUG-078** FIXED 待 VERIFY（CI 重跑後確認）
3. 🟡 **BUG-071** server bundle download flow（OPEN, high）
4. 🟡 **T0324 DGX Spark dogfood VERIFY**（使用者親跑 / 待回報）
5. 🟢 **BUG-061** Codex panel tsc baseline errors（OPEN, low）
6. 🟢 **WSL/Docker structured errorCode PLAN**（T0340 P2 後續，獨立開）

### 重點觀察 / Learnings 候選

- **L121**（候選）：frontmatter 重複欄位（duplicate `closed_at`）+ body/frontmatter status drift 應在 `*sync` 加 lint warning
- 既有 drift：state 編號起始長期落後（snapshot D118 vs 起手式 D110）— *sync 編號校正應納入每次收工

### 編號起始（下 session）

- **T0359** / **BUG-082** / **PLAN-035** / **D119**

### 快速連結

- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（7 張熱區）
- Backlog → [_backlog.md](_backlog.md)（6 張熱區）
- Decision Log → [_decision-log.md](_decision-log.md)（最大 D118）
- Learnings → [_learnings.md](_learnings.md)
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)（61 entries）

---

## 🛏 前 Session 收工快照 (第四十三 session, 2026-05-15 12:03 - 13:15, ~72 min wall)

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

- **T0359** / **BUG-082** / **PLAN-035** / **D119**（2026-05-19 *sync 校正：實際最大 T0358 / BUG-081 / PLAN-034[archived] / D118；前記 T0357/D110 為 drift，已修正）

### 快速連結

- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（8 張熱區 / 72 歸檔）
- Backlog → [_backlog.md](_backlog.md)（6 張熱區 / 27 歸檔）
- Decision Log → [_decision-log.md](_decision-log.md)
- Learnings → [_learnings.md](_learnings.md)
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)

---

## 🌅 起手式（Quick Recovery）

> 最後更新：2026-05-19 15:10 UTC+8（第四十五 session 收工 — BUG-081 結案校正 + *sync + *archive + state hygiene）

### 立即待辦
1. 🔴 **PLAN-032 三 BUG smoke**：BUG-072（WSL linger, T0337）/ BUG-073（Docker daemon, T0336）/ BUG-074（SSH input-step, T0335）皆 🔍 VERIFY 待人工 smoke → 通過後 CLOSED → PLAN-032 → DONE
2. 🟡 **BUG-078** FIXED 待 VERIFY（CI 重跑後確認）
3. 🟡 **BUG-071** server bundle download flow（OPEN, high）
4. 🟡 **T0324 DGX Spark dogfood VERIFY**（使用者親跑 / 待回報）
5. 🟢 **BUG-061**（dev-only tsc）/ **WSL/Docker structured errorCode PLAN**（T0340 P2，獨立開）

### 近期完成（第四十五 session）
- **BUG-081 CLOSED + 使用者驗收通過**（Claude runtime regression smoke 硬條件滿足）
- **frontmatter/body drift 校正**（BUG-081 重複 closed_at + body OPEN→CLOSED）
- **\*sync** 重建 _bug-tracker / _backlog（前次同步停在 05-17，已過期）
- **\*archive** 6 檔 → 冷區（T0354-57 + BUG-079/080），熱區 BUG 9→7
- **state hygiene**：sessions 42/41/39 → 2026-Q2-c.md（INDEX 61 entries）

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（7 熱區）
- Backlog → [_backlog.md](_backlog.md)（6 熱區）
- Decision Log → [_decision-log.md](_decision-log.md)（最大 D118）
- Learnings → [_learnings.md](_learnings.md)
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)

### 編號起始
- **T0359** / **BUG-082** / **PLAN-035** / **D119** / **EXP-[TOPIC]-001**

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
