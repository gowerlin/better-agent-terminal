# Tower State — better-agent-terminal

> 最後更新:2026-09-02 00:00 (UTC+8) — **第四十七 session 收工** — BUG-082 / T0360 / T0361 落地，pre-release `v0.5.9-pre.1` 已發布，**待使用者安裝後 runtime 驗收**。
>
> **下次起手**:Fast Path 載入;立即待辦見「🌅 起手式」— 第一件事是確認安裝版是否真的換掉，再跑 CP-T#### smoke。
>
> **前次更新**:2026-05-23 21:10 (UTC+8) — 第四十六 session 收工:T0359 / CP-T1148 收尾 + BAT 0.4.2 換版。

---

## 🛏 本 Session 收工快照 (第四十七 session, 2026-09-01 22:05 - 2026-09-02 00:00, ~2h wall)

### 主軸：跨塔台 ADVISORY 處置 → BUG-082 修復 → v0.5.9-pre.1 發布

#### 起手狀態

Fast Path 失效（快照 2026-05-23，距今 **101 天**）→ Full Scan。熱區 T:11 / BUG:7 / PLAN:6 / EXP:0 / CT-T:1。

#### 時間線

1. **22:05 Full Scan** — 面板顯示；state 19.6 KB 正常，起手式 31 行（觸軟警告）
2. **22:05-22:40 ADVISORY 分析** — BMad-Guide 塔台來文 4 項（[1] `--workorder` 拒收跨專案前綴 / [2] B-1 workspace 預設 / [3] B-2 提示 / [4] 未知 workspaceId 行為）。塔台讀碼驗證，**發現問題比對方描述更大**：BAT 內部四個元件對工單 ID 格式有四種答案
3. **22:42 建 BUG-082 + T0360**，commit `3250bc2`
4. **22:45-22:55 T0360 FIXED**（Worker ~10 min）— commit `956c0f9`，9 files +557/-12
5. **22:56 塔台複驗** — 507/507 tests、四處 regex 零殘留、helper 拒收/接受/B-2 提示皆實測。**發現 runtime 驗收阻塞：安裝版 BAT 仍為修復前**（`app.asar` + `resources/scripts/` 皆 2026-05-24 20:29）
6. **23:20 發布路徑調查** — 揭露三個與既有認知不符的事實（見下「重點觀察」）
7. **23:34 建 T0361 + 派發** — 項目 4（migrate script 第五處 regex）+ miss 訊號；使用者選擇**不含 B-1**
8. **23:41 T0361 DONE**（Worker ~7 min）— commit `007adf8`；複驗 511/511
9. **23:45 push + 觸發 workflow** — `gh workflow run pre-release.yml -R gowerlin/... -f version=0.5.9-pre.1`
10. **00:00 build 全綠** — release `v0.5.9-pre.1` 發布（prerelease: true），5 個 artifact
11. **00:00 package.json 版本漂移修復** — `0.4.2` → `0.5.9-pre.1`，commit `a650754`

### 本輪戰績

| 類別 | 數量 | 備註 |
|------|------|------|
| 新增 BUG | 1（BUG-082） | OPEN → FIXED（待 runtime 驗收） |
| 派發工單 | 2（T0360 / T0361） | 全綠，各 1 round，共 ~17 min Worker wall |
| 新增測試 | +28 cases | 483 → 511（T0360 +24 / T0361 +4） |
| Code 改動 | +805 lines | 跨 helper / main / renderer 三層 |
| Push commits | 8 | `a3a9489..a650754` |
| Release | 1 | `v0.5.9-pre.1`（三平台 + server bundle × 3） |

### 重點觀察 / Learnings 候選

- **L122**（候選，🔴 高價值）：**本 repo 有三個 remote**（`origin`=gowerlin / `upstream`=tony1223 / `scandnavik`），`gh` 預設解析到 **upstream**。本次 `gh workflow run` 首發 HTTP 404 打到 tony1223。**所有 `gh` 指令必須顯式帶 `-R gowerlin/better-agent-terminal`**。本次是唯讀操作只是報錯；若是 `gh release create` / `gh pr` 等寫入操作解析錯 repo，後果嚴重。**已寫入 `_local-rules.md`**
- **L123**（候選）：`pre-release.yml` 是 **`workflow_dispatch` only**，push tag 不會觸發它（push `v*` 會觸發 `release.yml` 正式版線）。CLAUDE.md 的「Release」節描述與此不符，需修
- **L124**（候選）：workflow 自動遞增取 `git tag -l 'v*' --sort=-v:refname | head -1`，在**多版本線混雜**的 fork（v0.x / v2.2.x / v4.0.x 共 257 tag）會取到 `v4.0.3-pre.1` → 產出 `4.0.4-pre.1`。**必須顯式指定版本號**
- **L125**（候選）：「source 已修但 installed bundle 落後」是 BAT 反覆出現的驗收陷阱（2026-05-24 bug tracker parser 修復時同款）。凡涉及 `app.asar` 或 `resources/scripts/` 的修復，**source lane 綠燈 ≠ runtime lane 可驗**，必須分兩條 lane 回報
- **L126**（候選）：Worker 對工單原文的合理偏離（T0361「fallback 前發出 warn」→ 改為「前判定、後輸出」，因為要印 landed 值必須先解析 fallback）——工單寫死實作順序不如寫清楚**訊號要含哪些欄位**

### 編號起始（下 session）

- **T0362** / **BUG-083** / **PLAN-035** / **D119**

---

## 🛏 前 Session 收工快照 (第四十五 session, 2026-05-19 14:38 - 15:10, ~32 min wall)

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

- **T0360** / **BUG-082** / **PLAN-035** / **D119**

### 快速連結

- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（7 張熱區）
- Backlog → [_backlog.md](_backlog.md)（6 張熱區）
- Decision Log → [_decision-log.md](_decision-log.md)（最大 D118）
- Learnings → [_learnings.md](_learnings.md)
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)（61 entries）

---

## 🌅 起手式（Quick Recovery）

> 最後更新：2026-09-02 00:00 UTC+8（第四十七 session 收工 — v0.5.9-pre.1 已發布，待安裝驗收）

### 🔴 第一件事：v0.5.9-pre.1 安裝驗收（BUG-082 CLOSED 的唯一阻塞）

使用者已下載 `BetterAgentTerminal.Setup.0.5.9-pre.1.exe`（535 MB，NSIS）。**用新版 BAT 重開後**依序：

1. **確認安裝版真的換掉**（最關鍵，過去兩次都栽在這）：
   `grep 'expected T followed by digits' "C:/Program Files/BetterAgentTerminal/resources/scripts/bat-terminal.mjs"`
   → **應查無**（舊版才有此字串）。查得到代表安裝沒生效，勿往下走
2. **runtime smoke**：實際派一張 `CP-T####` 走 `--skill` + `--workorder` 結構化模式（舊版會 exit 1）
3. **查 `[T0361] Workspace miss`**：正常**不該出現**；若出現即 workspace 錯派實證，供 ADVISORY B-1 復議
4. 全綠 → BUG-082 → CLOSED → **回函 BMad-Guide 塔台**（使用者已定案：**smoke 通過後才發**，讓回函能寫「已 runtime 驗證」而非只是「已 commit」）

**回函五項**（前四項對應 ADVISORY，第 5 項是我方回饋的新發現）：
[1] 接受，v0.5.9-pre.1 已 runtime 驗證 ｜ [2] B-1 暫緩 + Part C 結論（安全但不可觀測，採納須同批補 miss 訊號）｜ [3] B-2 同版落地（採用其建議文案）｜ [4] 已調查，見 Part C
**[5] 回饋**：查證 CT v5.0.5（`references/auto-session.md:908-909` + v5.0.4/5.0.5 changelog）確認**其 `--prompt` 繞道並未寫進 skill**，故 CT 端零改動即可用新版 BAT。但建議補「最低 BAT 版本標註 + 舊版降級規則」——因為此限制的真正觸發面是 **`project-prefix` 設定**（`cross-project-coordination.md:164` 會自動替工單加前綴），比 ADVISORY 描述的跨專案場景大得多。
⚠️ CT skill 屬 `~/.claude/skills/**`，塔台硬邊界禁止寫入，只能回函請對方處理。

### 其餘待辦
1. 🟡 **PLAN-032 三 BUG smoke**：BUG-072 / BUG-073 / BUG-074 皆 VERIFY 待人工 smoke（本 session 未動）
2. 🟡 **BUG-078** FIXED 待 VERIFY / **BUG-071** server bundle download flow（OPEN, high）
3. 🟢 **ADVISORY B-1 復議**：待安裝後 miss 訊號有真實資料再決定，決定採納則須同批補 renderer 訊號
4. 🟢 **CLAUDE.md「Release」節需修**：描述與實際 workflow 不符（見 L123/L124）
5. 🟢 T0324 DGX Spark dogfood / BUG-061 / WSL-Docker structured errorCode PLAN

### ⚠️ 本專案 gh 鐵則（L122）
**所有 `gh` 指令必須帶 `-R gowerlin/better-agent-terminal`** —— 三個 remote，預設會解析到 upstream tony1223。

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（8 熱區）｜ Backlog → [_backlog.md](_backlog.md)（6 熱區）
- Decision Log → [_decision-log.md](_decision-log.md)｜ Learnings → [_learnings.md](_learnings.md)
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)（62 entries）

### 編號起始
- **T0362** / **BUG-083** / **PLAN-035** / **D119** / **EXP-[TOPIC]-001**

---

## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（另有 `scandnavik` remote；⚠️ gh 預設解析到 upstream，見 L122） |
| **目前版號** | **0.5.9-pre.1**（package.json + lock 已同步，commit `a650754`；前次漂移停在 0.4.2） |
| **最新 release** | `v0.5.9-pre.1`（2026-09-01，prerelease，三平台 + server bundle × 3） |
| **前一 tag** | `v0.5.8`（指向 `a3a9489`） |
| **目前主軸** | BUG-082 跨專案工單前綴 — 待 runtime 驗收 |
| **工單最大編號** | T0361（DONE，commit `007adf8`） |
| **BUG 最大編號** | BUG-082（FIXED，待 runtime 驗收；fix commit `956c0f9`） |
| **PLAN 最大編號** | PLAN-034（已 archive；熱區最大 PLAN-033） |
| **決策最大編號** | D118 |
| **EXP 最大編號** | EXP-GPUWHIS-001（CONCLUDED，已歸檔） |
| **塔台版本** | Control Tower v5.0.5 |
| **unit test 基線** | **511**（41 files） |

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
> 最後掃描:2026-09-01 22:05 (UTC+8) — control-tower Full Scan（前次快照 2026-05-17，距今 101 天已失效）

| 偵測項 | 狀態 | 備註 |
|--------|------|------|
| 終端環境 | BAT | `BAT_SESSION=1`, port `9876`, workspace `2eda2f34-9f69-4704-895e-494d9ec0054b` |
| BAT 派發 | ✅ | 五項 dispatch env 齊備；本 session 成功派發 2 張（T0360 / T0361） |
| BAT_HELPER_DIR | ✅ | `C:/Program Files/BetterAgentTerminal/resources/scripts` |
| 平台 | Windows | PowerShell 主，Bash tool 並存 |
| gh CLI | ✅ | 已登入 `gowerlin`（scopes: gist / read:org / repo）。⚠️ **必須帶 `-R gowerlin/better-agent-terminal`**（L122） |
| git remote | 3 個 | `origin`=gowerlin / `upstream`=tony1223 / `scandnavik` |
| ct-exec / ct-done / ct-status / evolve / insights / fieldguide / help | ✅ | 全套可用 |
| 熱區工單 | **T:13 / BUG:8 / PLAN:6 / EXP:0 / CT-T:1** | 本 session 新增 T0360 / T0361 / BUG-082 |
| 最大編號 | **T0361 / BUG-082 / PLAN-034(archived) / D118** | 下張：T0362 / BUG-083 / PLAN-035 / D119 |
| unit test | ✅ **511 passed / 41 files** | 本 session 基線由 483 → 511 |
| tsc --noEmit | ⚠️ 42 既有 error | 全落在 `CodexAgentPanel.tsx` / `agent-profiles.ts` 等未觸及檔案，為既有 baseline |
| 設定來源 | project | `_tower-config.yaml`（auto-session **on**, yolo_max_retries 1, auto_commit on, archive_days 2） |
| 塔台版本 | v5.0.5 | control-tower skill |

> **Drift / 注意事項**:
> 1. ✅ `_tower-state.md` 18.8 KB（正常）；起手式 35 行（略超 30 行軟警告，內容全為可執行待辦，無歷史內嵌）
> 2. ⚠️ 工作區長期存在 `AGENTS.md` dirty（claude-mem 自動產生的 context 區塊，非程式碼）。本 session 全程以 `git commit --only` 精確指定路徑，未觸碰
> 3. 🔴 **安裝版 BAT 落後 source**：驗收前必先確認 `resources/scripts/bat-terminal.mjs` 已換新（見起手式第 1 步）
> 4. ⚠️ CLAUDE.md「Release」節描述與實際 workflow 不符（pre-release 為 workflow_dispatch，非 tag 觸發），待修

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
