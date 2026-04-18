# 工單 CT-T002-delegate-yolo-mode-skill-update

## 元資料
- **工單編號**：CT-T002
- **任務名稱**：【受派】CT skill 修改 — yolo 自主模式（Worker 自動回報 + 塔台自主決策 + 3 斷點）
- **狀態**：IN_PROGRESS
- **建立時間**：2026-04-18 13:25 (UTC+8)
- **開始時間**：2026-04-18 13:27 (UTC+8)
- **完成時間**：（完成時填入）

## 跨專案協調
- **協調類型**：DELEGATE
- **來源統籌工單**：PLAN-020-yolo-autonomous-mode（工單 4/5）
- **來源專案**：better-agent-terminal
- **對應子任務**：CT skill 三件套修改（ct-exec + ct-done + control-tower）

## 工作量預估
- **預估規模**：中（3 個 skill，~60-100 行改動）
- **Context Window 風險**：中（需讀 3 個 SKILL.md 現狀 + 整合 2 份草稿）
- **預估工時**：2-3h

## 前置條件

**必須先閱讀**（本專案產出，作為實作規格）：
1. `_ct-workorders/_draft-ct-yolo-worker-skill-patch.md`（T0169，Worker skill 草稿）
2. `_ct-workorders/_draft-ct-yolo-tower-skill-patch.md`（T0170，Tower skill 草稿）
3. `_ct-workorders/_report-plan-020-yolo-feasibility.md`（T0167 研究報告）

**相依 commits**（本專案）：
- `c4b2a19` — T0168：`scripts/bat-notify.mjs` 新增 `--submit` flag（yolo 的 BAT code 基礎）
- `488ad93` — T0169：Worker skill 草稿
- `ff678cc` — T0170：Tower skill 草稿

**PLAN-011 / CT-T001 先例**：本工單是同類型跨專案 DELEGATE，流程相同。

## 任務指令

### 目標專案
- **專案**：BMad-Control-Tower（最新版）
- **路徑**：`D:\ForgejoGit\BMad-Guide\BMad-Control-Tower\BMad-Control-Tower-v4.1.0\`（或更新版）
- **上游 repo**：https://github.com/gowerlin/BMad-Control-Tower

### 執行建議

**建議 Worker 流程**：
1. `cd` 到目標專案目錄
2. 開新分支 `feat/yolo-autonomous-mode`
3. 讀兩份本地草稿（路徑見「前置條件」）作為實作規格
4. 讀目標專案的三個 SKILL.md 現狀
5. 按草稿執行 Before/After 改動
6. 單一 commit per skill 或統一 commit（Worker 判斷）
7. 推分支 + 產生 PR（`gh pr create`）
8. 回本專案更新 CT-T002 狀態 DONE

### 修改清單（高層）

#### 1. `ct-exec/SKILL.md`
- Step 8.5 升級為必要鉤子（依 T0169 草稿 §「變更檔案」）
- 加 `auto-session` 三模式分流（off/ask / on / yolo）
- Step 11 降級為 fallback

#### 2. `ct-done/SKILL.md`
- 等效 Step 6.5 同步改動（與 ct-exec 對稱）

#### 3. `control-tower/SKILL.md`
依 T0170 草稿 §C1-C5 改動：
- **C1**：`auto-session` enum 擴充 `off / ask / on / yolo`（四階），啟動面板新增 `⚠️ YOLO MODE ACTIVE` 警語（條件顯示）
- **C2**：內建命令 `*config` 接受 `yolo` 值；核心迴圈段落新增「yolo 自主派發邏輯」
- **C3**：新增「3 斷點規格」章節（A 非預期狀態 / B-1 Renew≥3 / B-2 連續 3 FAILED / C 跨 PLAN）
- **C4**：`_tower-state.md` 新增 `## YOLO 歷程` 區段格式
- **C5**：`_tower-config.yaml` 新增 `yolo_max_retries: 3`

#### 4. `control-tower/references/`
- **新增**：`references/yolo-mode.md`（完整 yolo 行為規格、斷點機制、Parse 規則）
- 或放入現有 `auto-session.md` 擴充段落（Worker 判斷）

### 關鍵規格（不可自由發揮）

**四種狀態字串**（Worker 回報必須精準匹配）：
```
T#### 完成
T#### 部分完成
T#### 失敗
T#### 需要協助
```
對應 regex：`^T\d{4}\s+(完成|部分完成|失敗|需要協助)\s*$`

**斷點觸發訊息格式**：見 T0170 草稿 §C3。

**ct-exec 和 ct-done 的 Step 8.5 / 6.5 文字必須一致**（T0169 草稿明確指出）。

## 驗收條件

### 功能完整性
- ✅ **V1**：ct-exec Step 8.5 升級為必要鉤子，三模式分流清楚
- ✅ **V2**：ct-done 等效段落同步升級，與 ct-exec 對稱
- ✅ **V3**：control-tower `auto-session` 擴充為四階（含啟動面板警語）
- ✅ **V4**：3 斷點判準機械化可實現（regex + 計數器）
- ✅ **V5**：`## YOLO 歷程` 區段格式在 references 或 SKILL.md 有規格
- ✅ **V6**：新 config `yolo_max_retries` 有預設值（3）+ 說明

### 一致性
- ✅ **C1**：四種狀態字串在 ct-exec、ct-done、control-tower 三個 skill 完全一致
- ✅ **C2**：硬鉤子 yolo 失敗語意一致（Worker 側阻斷 DONE + 塔台側不自動派下一張）
- ✅ **C3**：實作結果與本專案兩份草稿 100% 對齊（不可偏離）

### 相容性
- ✅ **Compat-1**：舊版 BAT（無 `--submit` flag）自動降級為 on + 警告
- ✅ **Compat-2**：非 BAT 環境整段跳過 Step 8.5
- ✅ **Compat-3**：`auto-session: off/ask/on` 三階行為完全不變

### PR 格式
- ✅ **P1**：PR 標題：`feat: add yolo autonomous mode (PLAN-020)`
- ✅ **P2**：PR 描述引用本專案 PLAN-020 / T0167 / T0168 / T0169 / T0170 的 commits
- ✅ **P3**：PR 描述附上兩份草稿的相對路徑（讓 reviewer 快速對齊規格）
- ✅ **P4**：PR 描述列出 8 個迴歸測試場景（見 T0170 §驗收）

## 回本專案的收尾

1. 上游 PR 產生後，本工單狀態改 DONE
2. 本專案記 D061（CT-T002 閉環 + skill 版號更新到 yolo-ready）
3. 等上游 PR merge 後，本專案拉新版 skill 準備 T0171 驗證（PLAN-018 dogfood）

## 注意事項

- **不可在本專案直接寫入 `~/.claude/skills/`**（Layer 1 唯讀，本專案塔台硬限制）
- **執行位置**：目標專案的 clone 目錄（`D:\ForgejoGit\BMad-Guide\BMad-Control-Tower\BMad-Control-Tower-v4.1.0\`）
- **分支管理**：建議 `feat/yolo-autonomous-mode`，Worker 可視情況調整
- **版號**：上游版號 Worker 自行決定（建議 v4.2.0，major 功能加入）
- **若草稿規格不足**：Worker 可回本專案補問（但應避免，因兩份草稿應已完整）

## 收尾

1. 上游 PR 建立後，在本工單回報區填寫 PR 連結
2. 填寫驗收結果
3. 不呼叫 `bat-notify.mjs`（yolo 尚未啟用）

---

## 回報區

> 以下由 sub-session 填寫（來自目標專案）

### 完成狀態

**PARTIAL** — 技術實作 100% 完成、commit 已建立；push 與 PR 步驟因 remote 為 Forgejo 非 GitHub，由塔台決策（見下方「遭遇問題」）。

### 開始時間 / 完成時間

- 開始：2026-04-18 13:27 (UTC+8)
- 完成：2026-04-18 13:39 (UTC+8)
- 耗時：約 12 分鐘

### 上游 PR

**未建立**。原因：

- 目標專案路徑 `D:\ForgejoGit\BMad-Guide\BMad-Control-Tower\BMad-Control-Tower-v4.1.0\` 的 git remote 為 `sxnas:gower/BMad-Guide.git`（內部 Forgejo），非工單預期的 `https://github.com/gowerlin/BMad-Control-Tower`（GitHub）。
- `gh repo view` 報錯：`none of the git remotes configured for this repository point to a known GitHub host`。
- **CT-T001 先例**：對方塔台（BMad-Guide）當時的處理模式是 **直接 commit → push 到 Forgejo origin → snapshot + CHANGELOG + ZIP 發布**，未走 github PR 流程（見 CT-T001 產出摘要：CP-T0091/92/93 三張工單，所有 commit 在 Forgejo 上）。
- **建議**：本工單是否走同一 pattern（push 到 Forgejo origin 直接 merge 或由對方塔台排 CP-T00XX 吸收本分支），請塔台決策。

### 目標專案 commits

| 分支 | Commit | 訊息摘要 |
|------|--------|---------|
| `feat/yolo-autonomous-mode` | `bfc4ba5` | feat: add yolo autonomous mode (PLAN-020) |

分支基於 `dev-main@670b3c4`（對方塔台上個 session 結束的 commit）建立。

### 驗收結果

#### 功能完整性（V1-V6）

| 項目 | 狀態 | 證據 |
|------|------|------|
| V1 — ct-exec Step 8.5 升級為必要鉤子，三模式分流 | ✅ | `ct-exec/SKILL.md` Step 8.5 改寫為環境偵測 + auto-session 分流表（off/ask → 跳過、on → bat-notify、yolo → --submit） |
| V2 — ct-done 等效段落同步升級，與 ct-exec 對稱 | ✅ | `ct-done/SKILL.md` Step 6.5 與 ct-exec Step 8.5 採相同結構（環境偵測、config 讀取、訊息對照、失敗處理） |
| V3 — control-tower auto-session 擴充為四階（含啟動面板警語） | ✅ | `control-tower/SKILL.md` `*config` 選項表改為 `on/ask/off/yolo`；啟動面板警語規格移至 `yolo-mode.md`（完整 box-drawing 格式） |
| V4 — 3 斷點判準機械化可實現（regex + 計數器） | ✅ | `yolo-mode.md` 斷點 A regex `^T\d{4}\s+(完成\|部分完成\|失敗\|需要協助)\s*$`、B-1 讀 Renew 次數、B-2 session 級計數器、C 雙 regex |
| V5 — YOLO 歷程區段格式在 references 有規格 | ✅ | `yolo-mode.md` § `_tower-state.md 新增 YOLO 歷程區段` 含格式、寫入時機、必要區段清單更新 |
| V6 — 新 config yolo_max_retries 有預設值 + 說明 | ✅ | `control-tower/SKILL.md` + `tower-config.md` 雙處新增，預設 3，範圍 0-10，YAML 範例補齊 |

#### 一致性（C1-C3）

| 項目 | 狀態 | 驗證 |
|------|------|------|
| C1 — 四種狀態字串在三個 skill 完全一致 | ✅ | `ct-exec` Step 8.5 表、`ct-done` Step 6.5 表、`yolo-mode.md` 斷點 A 表三處對照：DONE/FIXED→完成、PARTIAL→部分完成、FAILED/BLOCKED→需要協助 |
| C2 — 硬鉤子 yolo 失敗語意一致 | ✅ | Worker skill 明文「工單狀態保持 IN_PROGRESS（不寫 DONE）」；塔台 `yolo-mode.md` § 失敗硬鉤子語意對齊 明文「塔台無訊息可 parse → 不觸發斷點」 |
| C3 — 實作結果與兩份草稿 100% 對齊 | ✅ | 草稿 T0169（Worker）/ T0170（Tower）所有段落按 Before/After 對照精確套用，未偏離 |

#### 相容性（Compat-1~3）

| 項目 | 狀態 | 證據 |
|------|------|------|
| Compat-1 — 舊版 BAT 自動降級為 on + 警告 | ✅ | `ct-exec/ct-done` Step 相容性段落明文：偵測 `--submit` 不支援 → 降級 on + 顯示版本警告 |
| Compat-2 — 非 BAT 環境整段跳過 Step 8.5 | ✅ | 環境偵測表 4 項任一缺失即跳過整段 |
| Compat-3 — auto-session: off/ask/on 三階行為完全不變 | ✅ | SKILL.md auto-session 讀取表 off/ask 為「跳過 Step 8.5 整段」；`auto-session.md` 三階章節未動（yolo 為第四章節追加） |

#### PR 格式（P1-P4）

| 項目 | 狀態 | 說明 |
|------|------|------|
| P1 — 標題 `feat: add yolo autonomous mode (PLAN-020)` | ✅ | commit message 標題即此格式，可直接作為 PR 標題使用 |
| P2 — 引用 PLAN-020 / T0167-T0170 commits | ✅ | commit message body 完整列出 c4b2a19、488ad93、ff678cc、CT-T002 |
| P3 — 附兩份草稿路徑 | ⚠️ 部分 | commit message 有提到草稿存在於 better-agent-terminal 本地；若建 PR 時需擴充描述附上草稿相對路徑 `better-agent-terminal/better-agent-terminal/_ct-workorders/_draft-ct-yolo-{worker,tower}-skill-patch.md` |
| P4 — 列出 8 個迴歸測試場景 | ⚠️ 部分 | `yolo-mode.md` § 迴歸測試場景 已列 T1-T8 完整 8 個；若建 PR 時可從此檔直接引用或摘要到 PR body |

**P3/P4 狀態**：因未實際建立 PR（remote 問題），PR body 未編寫。草稿與 8 場景已存在於本地與 yolo-mode.md，建 PR 時可直接組合。

### 變更摘要

| 檔案 | 改動 | 行數 |
|------|------|------|
| `control-tower/SKILL.md` | `*config` 選項表擴充 + 核心迴圈 yolo 分支 + Reference routing yolo-mode 條目 | +9/-2 |
| `control-tower/references/auto-session.md` | 新增 `auto-session = yolo` 章節（含差異點對比表） | +23 |
| `control-tower/references/tower-config.md` | `auto-session` 四階 + `yolo_max_retries` 選項 + YAML 範例 | +3/-1 |
| `control-tower/references/yolo-mode.md` | **新檔**：啟動識別 / Q2.A 判定邏輯 / 3 斷點判準 / `_tower-state.md` 歷程格式 / 8 迴歸測試場景 / 相容性 | +449 |
| `ct-exec/SKILL.md` | Step 8.5 升級為必要鉤子（環境偵測表 / auto-session 分流 / 成功回饋 / 失敗硬軟鉤子）、Step 11 降級為 fallback | +90/-16 |
| `ct-done/SKILL.md` | Step 6.5 對稱升級 | +79/-16 |
| **合計** | **6 檔（1 新增 + 5 修改）** | **+649 / -36** |

### Worker 筆記

#### 讀現狀發現

- 目標專案 `BMad-Control-Tower-v4.1.0` 當前在 `dev-main` 分支，領先 `origin/dev-main` 10 commit（對方塔台上個 session 收尾未 push）。本分支基於 `dev-main@670b3c4` 建立，含這 10 個 commit 加我的 1 個 commit。
- `control-tower/references/` 下原有 27 個 references 檔案，本工單僅**新增 1 個**（yolo-mode.md），符合工單「或放入現有 auto-session.md 擴充段落」的可選路徑之一——Worker 選擇獨立檔案以利未來章節擴充。
- `ct-exec/SKILL.md` 有 `references/session-guardrails.md` 參照但實際檔案不在 `control-tower/references/` 列表中，推測是 `ct-exec/references/`（未展開確認，本工單範圍不涉）。

#### 邊界決策

1. **yolo-mode.md 選擇獨立檔而非併入 auto-session.md**：`auto-session.md` 原本聚焦「終端偵測 + 降級鏈」，yolo 規格含 Q2.A 判定邏輯、3 斷點、`_tower-state.md` 歷程格式等重量級內容，併入會稀釋原檔主題。獨立檔允許 SKILL.md 與 auto-session.md 雙向交叉引用。
2. **commit 訊息 type = feat**：新增 yolo 第四階為新功能（非單純 docs/refactor），遵循工單驗收條件 P1 明確要求的 `feat:` 前綴。
3. **不自動 push**：即使 CT-T001 先例有 push 到 Forgejo 的做法，本 session 作為 Worker 身份，尚未獲得「push 到 Forgejo」的明確授權；本地 commit 是可逆安全動作，push 是跨 session 公開動作，應由塔台/使用者決策目的地（Forgejo vs GitHub 新設 remote）。

#### 遭遇問題

| # | 問題 | 處理 |
|---|------|------|
| 1 | remote 是 Forgejo（`sxnas:gower/BMad-Guide.git`）而非 GitHub，無法 `gh pr create` | 紀錄到本回報區由塔台決策（見「上游 PR」段） |
| 2 | 工單規格「上游 repo：https://github.com/gowerlin/BMad-Control-Tower」與實際 remote 不符 | 可能是工單舊資訊或對方 repo 已遷移；待塔台釐清 |

#### 對 T0171（PLAN-018 dogfood 驗證）的提醒

1. **驗證前置**：需要 `~/.claude/skills/` 的 source 端同步本 PR 內容（CT-T001 先例由對方塔台以 snapshot → source 同步流程處理），否則使用者端 Claude Code 仍跑舊版 skill。
2. **yolo_max_retries 預設 3**：T0171 驗證時建議先設 `yolo_max_retries: 1` 以快速觸發斷點 B 測試（避免浪費 3 輪工單才看到斷點行為）。
3. **斷點 A 測試**：可手動讓 Worker 回報 `T#### 搞定了`（不符合 regex）來驗證。
4. **斷點 C 測試**：可手動在 Worker 回報區寫「建議另開 BUG 單處理 XX」來驗證。
5. **硬鉤子測試**：關閉 BAT RemoteServer 後讓 Worker 在 yolo 模式下收尾，驗證工單保持 IN_PROGRESS（不寫 DONE）。

### Renew 歷程

無。

### 互動紀錄

無（標準模式執行，未觸發使用者提問）。

### 回報時間

2026-04-18 13:39 (UTC+8)
