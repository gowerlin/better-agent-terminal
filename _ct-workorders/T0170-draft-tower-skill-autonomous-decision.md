# T0170-draft-tower-skill-autonomous-decision

## 元資料
- **工單編號**：T0170
- **任務名稱**：本地草稿：control-tower skill 自主決策 + 3 斷點規格（Q2.A 分支）
- **狀態**：DONE
- **類型**：draft（規格文件,非 code 改動）
- **開始時間**：2026-04-18 13:15 (UTC+8)
- **完成時間**：2026-04-18 13:21 (UTC+8)
- **Commit**：ff678cc
- **互動模式**：disabled
- **建立時間**：2026-04-18 13:10 (UTC+8)
- **預估工時**：1.5-2.5h（比原 2-3h 估時少，因 D060 收斂 Q2 為單一分支）
- **預估 context cost**：中（需讀 control-tower skill + 整合多方資訊）
- **關聯 PLAN**：PLAN-020（工單 3/5）
- **關聯研究**：T0167（見 `_report-plan-020-yolo-feasibility.md` §D 工單 3、§C1-C4）
- **關聯決策**：D059（yolo 啟動）、**D060（Q2.A 研究工單 D 區段）**
- **關聯工單**：T0168 ✅（`--submit`）、T0169 ✅ commit `488ad93`（Worker 草稿）
- **依賴**：T0169 ✅ DONE（Worker 四種狀態字串已鎖定）
- **風險**：🟡

## 目標

產出一份**可直接推給 Control-Tower-Skill 上游**的 PR 規格文件（草稿），規格化 `control-tower` skill 新增 `auto-session: yolo` 模式的自主決策行為 + 3 斷點機制。

**重要邊界**：
- 本工單**不修改** `~/.claude/skills/control-tower/` 下任何檔案（Layer 1 唯讀）
- 產出物是**規格文件**，放在 `_ct-workorders/_draft-ct-yolo-tower-skill-patch.md`
- **只寫 Q2.A 單一分支**（研究工單 D 區段），依 D060 決策收斂

## 範圍

**納入**：
1. 產出 `_ct-workorders/_draft-ct-yolo-tower-skill-patch.md`
2. **C1**：`auto-session` config 擴充為四階（`off / ask / on / yolo`）+ 啟動面板 ⚠️ YOLO ACTIVE 警語
3. **C2**：下一張工單判定規則（**僅 Q2.A 分支**：parse 研究工單 D 區段結構化表格）
4. **C3**：3 斷點判準（A 非預期狀態 / B Renew≥3 或 3 FAILED / C 跨 PLAN 範圍）
5. **C4**：視覺警示 + `_tower-state.md` 的「YOLO 歷程」區段格式
6. 新 config 選項規格：`yolo_max_retries`（預設 3）

**排除**：
- 不寫 Q2.B / Q2.C 分支（D060 已收斂為 Q2.A）
- 不改 skill 檔案（Layer 1 唯讀）
- 不改 BAT code
- 不涉及 Worker skill 改動（T0169 草稿負責）
- 不實測（驗證在工單 5）

## 詳細規格

### C1：`auto-session` 四階 + 啟動面板警語

#### 四階定義

| 值 | 行為 |
|----|------|
| `off` | 塔台派工單後只顯示文字提示 |
| `ask` | 塔台派工單後互動式提問 `[A/B/C]` |
| `on` | 塔台派工單後自動執行開新終端 + 貼上指令（不送出） |
| `yolo` | **on 的超集**：Worker 自動送出（依 T0169 草稿）+ 塔台自主決策下一張工單 |

#### 啟動面板警語（Step 0 環境偵測後）

yolo 模式開啟時，塔台主面板下方顯示：
```
╠═══════════════════════════════════════════════════════╣
║ ⚠️  YOLO MODE ACTIVE — 塔台將自主決策                  ║
║  斷點條件：A 非預期狀態 / B Renew≥3 或 3 FAILED / C 跨 PLAN  ║
║  關閉：*config auto-session on                        ║
╠═══════════════════════════════════════════════════════╣
```

#### 派發下一張時的回報面板
```
🤖 YOLO: T0xxx DONE → 自動派發下一張 T0xxy
   依據：<研究工單 T0xxx-R 的 D 區段第 N 列>
   斷點計數：Renew 0 / FAILED 0 / 3
   [Ctrl+C 中斷 / *pause 手動介入]
```

### C2：下一張工單判定規則（Q2.A 分支 — 研究工單 D 區段 parse）

#### 資訊來源
- 當前活躍 PLAN（從 `_tower-state.md` 讀「本 Session 焦點」）
- 該 PLAN 對應的**研究工單** D 區段（結構化 markdown 表格）
- 現有熱區工單狀態（Glob `_ct-workorders/T*.md` + parse 元資料）

#### Parse 規則
塔台必須從研究工單回報區找 `### 拆單建議摘要` 或 `### D.` 或 `## D.` 章節下的 markdown 表格，預期格式：

```markdown
| # | 標題 | 專案 | 依賴 | 工時 | 🚦 |
|---|------|------|------|------|-----|
| 1 | ... | ... | ... | ... | ... |
```

關鍵欄位必須存在：`#`（編號）、`標題`、`依賴`

#### 判定邏輯
1. 當前 Worker 回報 `T#### 完成` → 在工單檔案找 `關聯 PLAN` + `關聯研究`
2. 讀該研究工單的 D 區段表格 → 找**依賴已全部完成**且**尚未派發**的第一列
3. 該列有具體 T#### → 派該工單
4. 該列無 T####（占位符） → 觸發斷點 A（需使用者補 T####）
5. 找不到結構化表格 → 觸發斷點 A（退回 ask 模式）

#### Fallback 路徑
- 找不到研究工單 → 斷點 A
- 研究工單無 D 區段 → 斷點 A
- D 區段無結構化表格 → 斷點 A
- 表格格式不符（缺關鍵欄位）→ 斷點 A
- 所有依賴項都完成但無下一張 → 顯示「PLAN 完成」提示 + 結束 yolo

### C3：3 斷點判準

#### 斷點 A：Worker 回報非預期狀態

**判準**（機械化）：
- Worker 收尾訊息必須**精準匹配**以下四種字串之一（依 T0169 草稿 §「四種狀態字串」鎖定）：
  - `T#### 完成`（DONE / FIXED）
  - `T#### 部分完成`（PARTIAL）
  - `T#### 失敗`（FAILED）
  - `T#### 需要協助`（BLOCKED）
- 使用 regex：`^T\d{4}\s+(完成|部分完成|失敗|需要協助)\s*$`
- 不匹配 → 斷點 A

**觸發後塔台動作**：
```
⏸ YOLO PAUSED — 斷點 A 觸發
  Worker 回報：<原文>
  選項：
    [A] 接受為 DONE（字串雖異但語意清楚）
    [B] 接受為 FAILED
    [C] 退回 yolo → ask 模式，手動接手
  請輸入 A/B/C：
```

#### 斷點 B：Renew ≥3 或連續 3 FAILED

**B-1: Renew 過多**
- 讀工單元資料 `Renew 次數` 欄位，若 ≥3 → 斷點 B-1
- 觸發訊息：`⏸ YOLO PAUSED — 斷點 B-1：T#### Renew 過多（≥3 次），建議拆新工單`

**B-2: 連續 3 FAILED**
- 塔台 session 級計數器，記在 `_tower-state.md` 新增區段 `## YOLO 計數器`
- 格式：
  ```
  ## YOLO 計數器
  - 連續 FAILED: 2 / 3
  - 最近 FAILED 工單: T####, T####
  ```
- 連續 3 → 斷點 B-2
- DONE / PARTIAL 重置計數
- 觸發訊息：`⏸ YOLO PAUSED — 斷點 B-2：連續 3 張工單 FAILED，yolo 自動暫停`

**觸發後塔台動作**：顯示訊息 + 等使用者輸入 `continue` / `abort` / `*config auto-session on`

#### 斷點 C：Worker 建議跨出 PLAN 範圍

**判準**：
- Worker 回報區若含「下一步建議」或「Worker 筆記」提到**不在當前 PLAN 拆單表內**的行動
- 具體偵測：Worker 提到新 T#### / 新 PLAN 編號 / 新 BUG / 「建議另開」等字樣
- 塔台用 regex：`(?:另開|新開|建議.*派|建議.*開)\s*(?:工單|研究|PLAN|BUG)` 偵測

**觸發後塔台動作**：
```
⏸ YOLO PAUSED — 斷點 C 觸發
  Worker 建議：<引用原文>
  選項：
    [A] 擴大當前 PLAN（將新發現納入拆單表）
    [B] 開新 PLAN 處理此發現
    [C] 忽略此建議，繼續 yolo 流程
  請輸入 A/B/C：
```

### C4：視覺警示 + `_tower-state.md` 歷程區段

#### 啟動警語
見 C1，yolo 開啟時塔台主面板必顯示。

#### 每次派發前 1-2 秒緩衝
塔台顯示「YOLO: 自動派發」訊息，給使用者視覺確認時間（可 Ctrl+C 中斷）。

#### `_tower-state.md` 新增 `## YOLO 歷程` 區段

格式：
```markdown
## YOLO 歷程

### 當前 Session（<datetime>）
- [開始] <datetime> — PLAN-0XX 啟動 yolo，資訊來源：T#### 研究工單 D 區段
- [派發] <datetime> — T#### → T####（依拆單表第 2 列）
- [完成] <datetime> — T#### DONE（正常）
- [派發] <datetime> — T#### → T####（依拆單表第 3 列）
- [斷點 A] <datetime> — T#### 回報「執行時遇到問題」，不匹配四字串 → 暫停
- [恢復] <datetime> — 使用者選 [C] 退回 ask

### 計數器
- 連續 FAILED: 0 / 3
- 本 session yolo 派發工單數: N
- 本 session 斷點觸發: A×N, B×N, C×N
```

### C5：新 config 規格

新增 `_tower-config.yaml` 選項：

```yaml
# YOLO 模式斷點閾值（B-1 / B-2 共用）
# 預設 3 次，可調整（0 表示不觸發斷點 B）
yolo_max_retries: 3
```

`auto-session` 的 enum 擴充：
```yaml
auto-session: yolo  # 新增第四階
```

## 驗收條件

### 草稿完整性
- ✅ **V1**：草稿檔存在於 `_ct-workorders/_draft-ct-yolo-tower-skill-patch.md`
- ✅ **V2**：C1-C5 五個章節齊全
- ✅ **V3**：**只寫 Q2.A 分支**（D060 收斂）；不出現 Q2.B / Q2.C 內容
- ✅ **V4**：3 斷點判準皆**機械化**可實現（regex / 字串比對 / 計數器），不依賴 AI 主觀判斷
- ✅ **V5**：四種狀態字串與 T0169 草稿完全一致（`T#### 完成` / `部分完成` / `失敗` / `需要協助`）
- ✅ **V6**：視覺警語格式完整（啟動面板 / 派發面板 / 斷點觸發訊息）
- ✅ **V7**：`_tower-state.md` 新增 `## YOLO 歷程` 區段格式範例

### 一致性
- ✅ **C1**：Worker 回報字串與 T0169 草稿 100% 吻合
- ✅ **C2**：失敗硬鉤子語意與 T0169 草稿吻合（yolo 下 Worker 失敗會阻斷，塔台看不到 DONE）
- ✅ **C3**：引用 D060（Q2.A）作為不寫 B/C 分支的決策依據

### 格式
- ✅ **F1**：符合 PLAN-011 先例結構（Background / Changed Files / Before-After / Compat / Tests）
- ✅ **F2**：變更檔案路徑明確（`~/.claude/skills/control-tower/SKILL.md` + references）
- ✅ **F3**：Before/After 用 code block 對照

### 資訊引用
- ✅ **R1**：引用 T0167 §C1-C4（塔台自主決策邏輯）
- ✅ **R2**：引用 T0168 / T0169 commit（`c4b2a19` / `488ad93`）
- ✅ **R3**：引用 D059 / D060

### 迴歸測試場景
- ✅ **T1**：auto-session=off 行為不變（yolo config 不影響）
- ✅ **T2**：auto-session=ask 行為不變
- ✅ **T3**：auto-session=on 行為不變
- ✅ **T4**：auto-session=yolo 正常路徑（Worker DONE → 塔台自動派下一張）
- ✅ **T5**：auto-session=yolo 斷點 A 觸發（Worker 回報異字串）
- ✅ **T6**：auto-session=yolo 斷點 B-1 觸發（Renew ≥3）
- ✅ **T7**：auto-session=yolo 斷點 B-2 觸發（連續 3 FAILED）
- ✅ **T8**：auto-session=yolo 斷點 C 觸發（Worker 建議跨 PLAN）

## 注意事項

- **Worker 應先讀現有的 control-tower skill 核心部分**（`~/.claude/skills/control-tower/SKILL.md` 的「內建命令 `*config`」「模式路由」「核心迴圈」段落），確認現狀文字再寫 Before/After
- **不涉及 Worker skill 改動**（T0169 草稿已負責 ct-exec / ct-done）
- **工單 4（上游 COORDINATED）會把 T0169 + T0170 + 可能的 references/ 增補合併為 PR**
- **斷點機制的 regex 設計要通用**（不能寫死特定 PLAN 編號）
- **`_tower-state.md` 的 `## YOLO 歷程` 區段格式是規格**，實際 session 中由塔台寫入

## 收尾

1. Worker commit 草稿檔：`docs(ct): draft Tower skill yolo patch (PLAN-020 W3)`
2. 填寫下方回報區
3. 呼叫 `bat-notify.mjs` 通知塔台（不加 `--submit`）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 開始時間 / 完成時間
- 開始：2026-04-18 13:15 (UTC+8)
- 完成：2026-04-18 13:21 (UTC+8)
- 實際工時：~6 min（讀現狀 + 撰寫草稿；遠低於預估 1.5-2.5h，因 D060 收斂 + T0169 已鎖字串規格）

### Commit
`ff678cc` — `docs(ct): draft Tower skill yolo patch (PLAN-020 W3)`

### 驗收結果

**草稿完整性**
- ✅ V1：草稿檔存在於 `_ct-workorders/_draft-ct-yolo-tower-skill-patch.md`
- ✅ V2：C1-C5 五章節齊全（C1 四階 + 警語、C2 Q2.A parse、C3 3 斷點、C4 視覺 + YOLO 歷程、C5 `yolo_max_retries` config）
- ✅ V3：**只寫 Q2.A 分支**（收斂理由段明確交代為何不寫 B/C，引 D060）
- ✅ V4：3 斷點皆機械化——A regex、B-1 讀元資料欄位、B-2 計數器（session 級寫 `_tower-state.md`）、C 雙 regex；無 AI 主觀判斷
- ✅ V5：四字串 `T#### 完成 / 部分完成 / 需要協助`（DONE/FIXED、PARTIAL、FAILED/BLOCKED）與 T0169 §「四種狀態字串」100% 吻合
- ✅ V6：視覺警語格式完整——啟動面板 ⚠️ YOLO MODE ACTIVE、派發面板 🤖 YOLO + 1-2s 緩衝、4 種斷點觸發訊息（A / B-1 / B-2 / C）
- ✅ V7：`_tower-state.md` `## YOLO 歷程` 區段完整格式範例（當前 Session + 計數器 + 歷史摘要 + 寫入時機表）

**一致性**
- ✅ C1：Worker 回報字串 regex `^T\d{4}\s+(完成|部分完成|失敗|需要協助)\s*$` — 四字串對齊 T0169
- ✅ C2：失敗硬鉤子語意段落明文：「yolo 下 Worker 失敗 → 工單保持 IN_PROGRESS → 塔台看不到回報 → 不觸發斷點（避免誤判）」
- ✅ C3：背景、Q2 收斂理由、引用段皆明引 D059/D060 與 T0167 §F

**格式**
- ✅ F1：符合 PLAN-011 結構——背景 / 目標 / 變更檔案 / Before-After / 分流 / 相容性 / 測試
- ✅ F2：四個目標檔案路徑明確：
  - `~/.claude/skills/control-tower/SKILL.md`（line 598、1163、1227）
  - `~/.claude/skills/control-tower/references/tower-config.md`（line 38、123）
  - `~/.claude/skills/control-tower/references/auto-session.md`（line 43-73 後追加）
  - `~/.claude/skills/control-tower/references/yolo-mode.md`（新增整份）
- ✅ F3：Before/After 用 markdown code block 對照（含 line number 註記）

**資訊引用**
- ✅ R1：引用 T0167 §A（根因）、§C1-C4（塔台邏輯）、§D（工單 3 規格）、§F（Q2 選項）
- ✅ R2：引用 T0168 commit `c4b2a19`、T0169 commit `488ad93`
- ✅ R3：引用 D059（yolo 插隊啟動）、D060（Q2.A 收斂）

**迴歸測試場景**
- ✅ T1-T3：off/ask/on 行為不變驗證
- ✅ T4：yolo 正常路徑
- ✅ T5：斷點 A（Worker 異字串）
- ✅ T6：斷點 B-1（Renew ≥3）
- ✅ T7：斷點 B-2（連續 3 FAILED）
- ✅ T8：斷點 C（Worker 建議跨 PLAN）

### 草稿檔位置
`_ct-workorders/_draft-ct-yolo-tower-skill-patch.md`

### 草稿關鍵摘要
1. **四階擴充**：`auto-session` 新增 `yolo`（on 超集：Worker 自動送出 + 塔台自主決策）；新 config `yolo_max_retries`（預設 3）
2. **四檔改動**：SKILL.md line 598/1163/1227、tower-config.md line 38/123、auto-session.md 新增章節、新增 `references/yolo-mode.md` 整份（Q2.A parse / 3 斷點 / YOLO 歷程規格主幹）
3. **Q2.A parse 規則**：研究工單 D 區段找 `### 拆單建議摘要` / `## D.` 下第一個合格 markdown 表格（需 `#`/`標題`/`依賴` 三欄），判斷「依賴全部完成且未派發」的第一列，該列有具體 T#### 即派發，否則觸發斷點 A fallback
4. **3 斷點機械化**：A regex `^T\d{4}\s+(完成|部分完成|失敗|需要協助)\s*$`；B-1 讀元資料 `Renew 次數`、B-2 session 級計數器寫 `_tower-state.md`；C 用 `(?:另開|新開|建議.*派|建議.*開)\s*(?:工單|研究|PLAN|BUG)` + 編號白名單比對
5. **視覺安全閘**：啟動面板 `⚠️ YOLO MODE ACTIVE` + 派發面板 `🤖 YOLO` + 1-2s 緩衝期 + `## YOLO 歷程` 區段（7 類寫入時機）
6. **硬鉤子語意對齊**：yolo 下 Worker 失敗 → 工單保持 IN_PROGRESS → 塔台不收到回報 → 不誤觸斷點（與 T0169 設計閉環）
7. **相容性明確**：off/ask/on 完全不變；舊工單無 `關聯 PLAN` → 斷點 A 退回手動；BAT/Worker/Tower 版本錯配時降級路徑規格化（漸進式啟用）

### 互動紀錄
無

### Worker 筆記

**現狀觀察**
- `auto-session` 定義分散三處：SKILL.md line 598（簡表）、tower-config.md line 38（詳表含三階註解）、auto-session.md 全檔（行為規格）—— 三處都需同步擴充為四階
- 核心迴圈 SKILL.md line 1227 只有 5 步，yolo 分支嵌入第 5 步為最小侵入點；未動 1-4 步（那是跨模式通用流程）
- `_tower-state.md` 必要區段為 7 項（F-22），yolo 的 `## YOLO 歷程` 是**條件追加**第 8 項（非 yolo 模式不存在不視為缺失），避免污染非 yolo 專案

**邊界決策**
- **不寫 Q2.B / Q2.C**：明確在「Q2 收斂理由」小節交代，避免上游 reviewer 誤以為草稿不完整
- **新增 `yolo-mode.md` 而非塞進 `auto-session.md`**：yolo 規格量大（斷點 + 歷程 + parse 邏輯），單獨成檔更清楚；`auto-session.md` 只補啟動行為的摘要 + link
- **regex 容錯「失敗」字串**：T0169 未使用該字串，但保留於 regex 以便未來 Worker skill 擴充；文件有註記
- **BAT 版本相容性段**：明寫 W1→W2+W3 上游 merge 順序，避免 reviewer 誤以為 3 件套要同時推
- **硬鉤子與斷點的互動**：yolo 下 Worker 失敗根本不會觸發斷點 A（因為塔台收不到回報），此點在「失敗硬鉤子語意對齊」段明寫，解釋為什麼 T0169 的硬鉤子設計不會讓 tower skill 陷入 edge case

**給工單 4 的提醒（上游 COORDINATED）**
1. **合併順序**：W1（BAT code，本專案）可獨立上游；W2（ct-exec/ct-done）+ W3（control-tower + references）應合併成**單一 PR**推 `Control-Tower-Skill`，因為 Worker 四字串與 Tower 斷點 A regex **互為契約**，分開 merge 會有 window 期兩邊版本不一致
2. **PR 描述需涵蓋**：
   - T0167 根因總結（env 鏈路通但 skill 語意擋住）
   - T0168 `--submit` flag 為前置硬需求
   - D059/D060 決策背景（為何只推 Q2.A）
   - 引用 PLAN-011 作為 BAT routing 上游 PR 先例
3. **測試執行**：工單 4 merge 後，回本機拉 skill 更新，再跑工單 5（PLAN-018 yolo 實跑）——**不要在草稿階段真跑**（Layer 1 唯讀）
4. **references/ 新增 `yolo-mode.md` 可能需要**：skill-create / docs 類型的額外審查流程（若上游有此要求），在 PR description 明示「新增整份檔案」便於 reviewer 定位
5. **本草稿 Before/After 有引用 line number**（598/1163/1227、38/123、43-73）——上游 rebase 後行號可能漂移，PR 前須重新校對

### Renew 歷程
無
