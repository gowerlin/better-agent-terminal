# 工單 T0179-research-worker-yolo-flag-protocol

## 元資料
- **工單編號**：T0179
- **任務名稱**：Worker yolo flag 傳遞協定研究（BUG-041 Phase 2.1）
- **類型**：research（研究型工單，允許 Worker 互動）
- **狀態**：IN_PROGRESS
- **建立時間**：2026-04-18 18:30 (UTC+8)
- **開始時間**：2026-04-18 18:37 (UTC+8)
- **預估工時**：60-90 分鐘（深研究 + 替代方案比較 + 規格文件）
- **優先級**：🔴 High（BUG-041 修復路徑必經步驟）
- **Renew 次數**：0

## 前置條件

- **BUG-041**：yolo mode Worker 側未偵測，自動化鏈路斷半（OPEN）
- **D062 決策**：Worker 應為無狀態，所有 runtime context 由塔台派單當下 explicit 傳遞
- **BUG-040 CLOSED**：Phase 1 完結（BAT `BAT_WORKSPACE_ID` env 注入先例 `6282ea0` + CT skill `--workspace` flag `367b30d`），本工單可借鏡同樣架構設計 `--mode` flag
- **相關 commit 先例**：
  - T0175（BAT env 注入研究報告）→ `_report-bat-workspace-id-injection.md`（commit `23d75f3`）— 可作為本工單報告格式範本
  - T0176 / CT-T004（實作落地路徑）— 可作為 flag 傳遞實作範本

## 背景

當前 yolo mode 斷鏈（BUG-041 現象）：
- ✅ 塔台側：讀 `_tower-config.yaml` `auto-session: yolo` → 自主派發下一張工單
- ❌ Worker 側：讀不到塔台的 yolo 設定 → 完成工單後走 Step 11 剪貼簿（降級）而非 Step 8.5 `--submit` 自動送出
- 結果：使用者仍需手動把剪貼簿貼到塔台 session，yolo 只有半邊自動化

使用者要求遵循 **D062 無狀態原則**：Worker 不讀 config，由塔台派單時顯式傳遞 mode 資訊。

## 研究目標

本工單為**純研究工單**，**不得改任何程式碼或 skill 檔**（僅產出報告 + 規格建議）。實作在後續 T0180 / CT-T005 / CT-T006 處理。

### G1. Worker 現況盤點

在不改動程式碼的前提下，定位 `/ct-exec` skill 當前的 yolo 判斷路徑：

- 找出 `ct-exec` skill 檔案位置（`~/.claude/skills/ct-exec/SKILL.md` 或 skill 源碼 repo）
- 定位 Step 8.5（`--submit` 自動送出）與 Step 11（剪貼簿降級）的分支判斷
- 找出 Worker 判斷 yolo 的實際程式碼/文字行號
- 確認 Worker **目前是怎麼判斷的**（讀 config？讀 env？其他？）— 這是 BUG-041 推測根因欄位的驗證

### G2. Flag 傳遞契約設計

設計 **`--mode <name>` + `CT_MODE=<name>`** 協定：

- Flag 格式：`--mode <name>`（`<name>` 允許值定義：yolo / ask / off / 其他？）
- Env 變數名：`CT_MODE`
- 傳遞鏈路：塔台 SKILL.md Bash 白名單 → `bat-terminal.mjs` 參數解析 → BAT `terminal-server` 建 PTY 時注入 env → Worker `/ct-exec` 讀 `process.env.CT_MODE`
- 不允許 Worker 讀 config 作 fallback（D062）：讀不到 env 一律走 ask 模式
- 向下相容：舊塔台派發（無 `--mode` flag）時 Worker 行為等同 `CT_MODE=ask`（預設安全模式）

### G3. 塔台 session 層互動旗標設計

**擴充需求**（使用者本次對齊新增）：

塔台啟動時偵測 `auto-session: yolo`，在現有「YOLO MODE ACTIVE 警語面板」**追加**一個使用者選擇：

> 「本 session 是否允許 Worker 在研究型工單中向你提問？[A] 允許 [B] 不允許」

研究內容：
- 這個旗標放哪裡？（`_tower-state.md` session 區？記憶體變數？）session 結束後**不落盤**（下次啟動重新問）
- 旗標怎麼跟 `CT_MODE` 組合？例：`--mode yolo --interactive` / `CT_MODE=yolo CT_INTERACTIVE=1`
- 若使用者選「不允許」，派發研究型工單時 Worker 讀到 `CT_INTERACTIVE=0` → 不啟用 Worker 互動區段（一次做完）
- 塔台啟動面板新增這一段的**具體位置**（改哪個 reference 的哪一段）— 只標位置不寫 diff

### G4. 替代方案評估

除了 env 注入，評估至少 2 個替代方案並列優缺點：

- **方案 A（env 注入）**：本工單主線，延續 BUG-040 Phase 1 經驗
- **方案 B（塔台直接下 command 到 Worker stdin）**：塔台在派發時透過 stdin pipe 下一條 context 設定指令
- **方案 C（派發訊息中嵌入 mode 旗標）**：例在 `/ct-exec T0179` 之後加 `?mode=yolo` 查詢字串式語法，Worker skill 解析
- **方案 D（其他）**：研究過程若發現其他路徑請列出

比較維度：
- 實作複雜度（改幾個檔案？）
- 向下相容性（舊塔台 + 新 Worker、新塔台 + 舊 Worker 是否可共存）
- 安全邊界（env 會不會被其他 process 讀到、stdin pipe 會不會被污染）
- 與現有 Bash 白名單的契合度

### G5. 實作建議（規格片段，不寫 diff）

產出「實作建議清單」，描述後續 T0180 / CT-T005 / CT-T006 要改的檔案與改動方向，但**只列位置與方向，不寫實際 diff**：

- **T0180**（BAT 端）：`scripts/bat-terminal.mjs` 要加的 flag 解析邏輯、terminal-server 建 PTY 時 env 注入位置
- **CT-T005**（塔台 skill）：`SKILL.md` Bash 白名單要怎麼加 `--mode`、安全邊界新增什麼規則、`references/auto-session.md` / `yolo-mode.md` 要同步的範例
- **CT-T006**（Worker skill）：`ct-exec` skill 要改的 yolo 判斷邏輯、Step 8.5 / Step 11 分支條件、config 讀取路徑如何移除

## 研究範圍

**允許讀取的資源**：

- `~/.claude/skills/ct-exec/**`（Worker skill 源碼）
- `~/.claude/skills/control-tower/**`（塔台 skill 源碼）
- 本專案 `scripts/bat-terminal.mjs`
- 本專案 `_ct-workorders/_report-*.md`（T0175 報告作為格式範本）
- 本專案 `_ct-workorders/_decision-log.md`（D062 決策原文）
- `_ct-workorders/BUG-041-*.md`（推測根因欄位）
- Forgejo `BMad-Control-Tower-v4.x.x/` 目錄（若可讀）

**禁止觸碰**：

- ❌ 任何 `.ts` / `.tsx` / `.mjs` / `.md` skill 檔案的**修改**（只讀不寫）
- ❌ 派工單／修改其他工單
- ❌ 執行 `git commit`（研究報告 commit 由 Worker 收尾步驟統一做一次）

## 交付規格

### D1. 研究報告

**檔名**：`_report-t0179-worker-yolo-flag-protocol.md`
**位置**：`_ct-workorders/` 根目錄

**結構**（必備區段）：

```markdown
# T0179 研究報告 — Worker yolo flag 傳遞協定

## 摘要
一段話：推薦方案、核心決定、實作工時估計

## A. Worker 現況盤點（G1）
- Worker skill 位置
- Step 8.5 / Step 11 分支的精確行號
- Worker **當前** yolo 判斷邏輯（源碼引用 + 行號）
- BUG-041 推測根因的驗證結果（確認是 1/2/3/4 哪一個，或是其他）

## B. Flag 傳遞契約（G2）
- 完整 env 命名規範
- 完整派發鏈路（塔台 → BAT → PTY env → Worker）
- 允許值列表與 fallback 行為
- 向下相容性分析

## C. 塔台 session 互動旗標（G3）
- 旗標儲存位置與生命週期
- 塔台啟動面板 diff 指引（改哪個 reference 哪一段）
- 旗標如何組合進派發命令

## D. 替代方案評估（G4）
| 方案 | 實作複雜度 | 向下相容 | 安全邊界 | Bash 白名單契合度 | 推薦度 |
|------|----------|---------|---------|----------------|-------|
| A env | ... | ... | ... | ... | ⭐⭐⭐ |
| B stdin | ... | ... | ... | ... | ... |
| C URL query | ... | ... | ... | ... | ... |

## E. 實作建議（G5）
### T0180 — BAT 端
- 修改檔案：`scripts/bat-terminal.mjs`（行 XX-YY）
- 改動方向：...（不寫 diff）

### CT-T005 — 塔台 skill
- 修改檔案：`SKILL.md`（Bash 白名單段）
- ...

### CT-T006 — Worker skill
- 修改檔案：`~/.claude/skills/ct-exec/SKILL.md`（Step 8.5 / 11）
- ...

## F. 風險與待定項
- 研究過程中未解問題
- 需要使用者額外決策的 edge cases
```

### D2. 更新 BUG-041

在 BUG-041 的「推測根因」欄位下方追加 `## 實測根因（T0179 結論）` 區段，引用研究報告的 A 節摘要。

### D3. Commit 收尾

一次 commit：
```
docs(ct): T0179 — Worker yolo flag 傳遞協定研究報告 (BUG-041 Phase 2.1)
```

**只 commit 新增的報告 + BUG-041 更新，其他檔案不動。**

## 驗收條件 (AC)

- **AC-1**：研究報告 `_report-t0179-worker-yolo-flag-protocol.md` 存在，六個主要區段（摘要 + A/B/C/D/E/F）均有內容
- **AC-2**：A 節明確列出 Worker skill 檔案路徑 + Step 8.5 / Step 11 的精確行號
- **AC-3**：D 節至少比較 3 個方案（A env + B stdin + C URL query 或替代）
- **AC-4**：E 節為每一個後續工單（T0180 / CT-T005 / CT-T006）列出至少 1 個具體檔案 + 改動方向
- **AC-5**：BUG-041 檔案已追加 `## 實測根因（T0179 結論）` 區段
- **AC-6**：commit 訊息符合規格（單一 commit，只含報告 + BUG-041 更新）

## 互動規則

**本工單允許 Worker 互動**（`research_interaction: true`，依 Q4.A 對齊）：

- 每輪最多 3 個問題（見 config `research_max_questions: 3`）
- 問題必須具體、帶選項（例：「發現 Worker skill 讀 `yolo_config.yaml`，是否視為 D062 違規？[A] 是 [B] 否」）
- 使用者回答後 Worker 繼續，不重覆問同一題
- 若發現對齊時未涵蓋的重大決策（例：多個方案都可行、命名取捨），**必須**問使用者再繼續

**不得**：

- 問只能 Grep 就知道的問題（例：「skill 檔在哪？」— 自己找）
- 一次問超過 3 個問題
- 問完不等回答就繼續做

## 相關單據

- **BUG-041** OPEN：yolo mode Worker 側未偵測（本工單為 Phase 2.1 研究）
- **D062**：Worker 無狀態原則（本工單設計依據）
- **T0175 / T0176 / CT-T004**：BUG-040 Phase 1 先例（env 注入架構範本）
- **下游未來工單**（T0179 完成後依結論開）：
  - T0180：BAT 端 `--mode` flag + env 注入
  - CT-T005：塔台 skill 派發指令加 `--mode`
  - CT-T006：Worker skill 改讀 env、移除 config 讀取

## 備註

- 本工單為純研究，產出內容會決定後續 3 張工單的派發方向，**深度優先 > 速度**
- 若研究過程發現 D062 原則與現實技術限制衝突，立刻停止並回塔台討論（不自作主張妥協）
- Worker 完成後若塔台 session 在 yolo mode 下運作，Worker 側可能走 Step 11 剪貼簿（BUG-041 本身未修，預期現象）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 執行摘要

**狀態**：DONE（18:37 → 18:52，實際 15 min，預估 60-90 min）

**核心產出**：研究報告 `_report-t0179-worker-yolo-flag-protocol.md`（~620 行），六個主要區段 + 附錄齊備：

- **A. Worker 現況盤點**：定位 `ct-exec/SKILL.md` 違反 D062 的精確行號（Step 8.5 行 285-293、Step 11 行 371），驗證 BUG-041 四項推測根因 → 實測根因為「時序性規格落差」（skill v4.2.0 先於 D062 決策，未同步更新）
- **B. Flag 傳遞契約**：依 Q1.A + Q2.C 規格化 `--mode <yolo|ask|off|on>` + `--interactive` / `--no-interactive` flag，對應 `CT_MODE` + `CT_INTERACTIVE` env（獨立），完整派發鏈路圖 + Q3.C fallback 規則（讀不到 env → ask + 升級提示）
- **C. 塔台 session 互動旗標**：記憶體變數 `session.allow_worker_interactive`（不落盤，session 間重啟）+ 啟動面板 diff 指引（改 `yolo-mode.md` 行 18-30 + 新增 `### 啟動詢問` 段）+ 組合邏輯偽碼
- **D. 替代方案評估**：5 方案比較表（A env 注入 ⭐⭐⭐⭐⭐ / B stdin 管線 ⭐ / C URL query ⭐⭐ / D marker 檔 ⭐ / E prompt 預填 ⭐），每案列實作複雜度、向下相容、安全邊界、Bash 白名單契合度
- **E. 實作建議（T0180 / CT-T005 / CT-T006）**：三工單各自修改檔案、行號定位、改動方向、AC 驗證建議 + 工時估計（BAT 30 min + 塔台 20 min + Worker 30 min）
- **F. 風險與待定項**：5 項已知風險（heartbeat recovery / 版本相容 / 命名衝突 / 非 BAT env 傳遞等）+ 3 項邊界決策（大小寫、interactive 範圍、升級提示抑制）

**BUG-041 檔案追加**：`## 實測根因（T0179 結論）` 區段，引用報告 A 節結論與 Phase 2 下游工單拆解。

**關鍵設計決策確立**：
1. **BAT 端實作成本極低** — 借力 T0176 已建立的 `customEnv` spread 架構，只需改 `scripts/bat-terminal.mjs` 單檔（補 flag 解析 + KNOWN_FLAGS 擴充 + customEnv 組裝），`pty-manager.ts` / `main.ts` **零改動**
2. **D062 嚴格落實** — Worker skill 明文禁令：不得讀 `_tower-config.yaml` 作 mode 判斷，只能讀 env；違反即違反無狀態原則
3. **升級順序** — BAT 先 → Worker skill → 塔台 skill，保護使用者漸進升級不 break

### 交付內容

**新增檔案**：
- `_ct-workorders/_report-t0179-worker-yolo-flag-protocol.md`（研究報告主檔）

**修改檔案**：
- `_ct-workorders/BUG-041-yolo-mode-worker-side-not-detected.md`（追加實測根因區段）
- `_ct-workorders/T0179-research-worker-yolo-flag-protocol.md`（工單回報區 + 元資料狀態）

**commit**：
- `docs(ct): T0179 — Worker yolo flag 傳遞協定研究報告 (BUG-041 Phase 2.1)`
- hash：待 commit 後填入

### 遇到的問題與決策

**問題**：無

**互動紀錄**（研究模式 3 輪 Q&A）：
- `[18:45]` Q1: flag 命名策略（`--mode <name>` vs `--yolo` vs 混合）→ A: A（通用 `--mode`）→ Action: 以 `--mode` 作 flag 主軸，補 `CT_MODE` env
- `[18:47]` Q1 follow-up: multi-mode 擴充性疑慮？→ A（Worker 解析）: mode 本質互斥、modifier 走獨立 flag 是 Unix 慣例 → 推薦 A + Q2.C 組合 → Action: 推薦組合確立
- `[18:48]` Q2: G3 互動旗標 env 策略（獨立 / 組合 / flag 獨立 env 獨立）→ A: C（flag 獨立、env 獨立，同推薦）→ Action: `--interactive` + `CT_INTERACTIVE` 獨立於 `--mode` / `CT_MODE`
- `[18:49]` Q3: D062 fallback 嚴格度（嚴格 / 過渡相容 / 嚴格 + 升級提示）→ A: C（嚴格 + 升級提示）→ Action: Worker 讀不到 `CT_MODE` → ask + 顯示升級提示，不讀 config

**關鍵決策**（依使用者對齊，均寫入報告 § B-E）：
- D-T0179-001：採方案 A（env 注入 via `bat-terminal.mjs` customEnv），排除 B（stdin）/ C（URL query）/ D（marker 檔）/ E（prompt 預填）
- D-T0179-002：`--mode` 為主模式 flag（四值 enum），modifier 走獨立 `--interactive` flag
- D-T0179-003：env 獨立（`CT_MODE` + `CT_INTERACTIVE`），關注點分離
- D-T0179-004：fallback 嚴格 D062 —— Worker 讀不到 env 一律當 `ask` + 升級提示，**不讀** config 作 last resort
- D-T0179-005：G3 互動旗標以塔台 session 記憶體變數儲存，不跨 session 落盤

**範圍守護**：未觸發（研究全程讀取資源均在工單 § 研究範圍「允許讀取」清單內，未動任何 skill 或程式碼）

**熔斷計數器**：未觸發（無重試）

### Renew 歷程

（無）

### DONE 時間

2026-04-18 18:52 (UTC+8)
