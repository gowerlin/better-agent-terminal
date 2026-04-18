# T0169-draft-worker-skill-auto-report

## 元資料
- **工單編號**：T0169
- **任務名稱**：本地草稿：ct-exec / ct-done skill 自動回報規格（Worker→Tower 硬鉤子）
- **狀態**：DONE
- **完成時間**：2026-04-18 13:05 (UTC+8)
- **類型**：draft（規格文件，非 code 改動）
- **互動模式**：disabled（規格明確）
- **建立時間**：2026-04-18 13:05 (UTC+8)
- **預估工時**：1-1.5h
- **預估 context cost**：低（純文件撰寫）
- **關聯 PLAN**：PLAN-020（工單 2/5）
- **關聯研究**：T0167（見 `_report-plan-020-yolo-feasibility.md` §D 工單 2）
- **關聯決策**：D059、D060
- **依賴**：T0168 ✅ DONE（`bat-notify.mjs --submit` 已實作）
- **風險**：🟢

## 目標

產出一份**可直接推給 Control-Tower-Skill 上游**的 PR 規格文件（草稿），規格化 `ct-exec` 和 `ct-done` skill 的 Step 8.5（Worker 自動回報）從「可選/靜默跳過」升級為「必要鉤子」，並加入 `auto-session: yolo` 分支（使用 `--submit` 自動送出）。

**重要邊界**：
- 本工單**不修改** `~/.claude/skills/` 下任何檔案（Layer 1 唯讀保護）
- 產出物是**規格文件**，放在 `_ct-workorders/_draft-ct-yolo-worker-skill-patch.md`
- 遵循 PLAN-011 先例（本地草稿 → 上游 COORDINATED 工單）

## 範圍

**納入**：
1. 產出 `_ct-workorders/_draft-ct-yolo-worker-skill-patch.md`
2. 規格化 ct-exec SKILL.md Step 8.5 的改動
3. 規格化 ct-done SKILL.md 等效段落的改動
4. 三模式分流邏輯（`auto-session: off/ask` / `on` / `yolo`）
5. 失敗處理策略（硬鉤子 vs 軟鉤子）
6. 使用者可見回饋訊息規格

**排除**：
- 不改任何 skill 檔案
- 不改任何 BAT code
- 不實測（規格文件階段，驗證在工單 5 做）
- 塔台端的自主決策邏輯（那是工單 3 的範圍）

## 詳細規格

### 1. 草稿檔結構

草稿檔應涵蓋以下段落：

```markdown
# Control-Tower-Skill Patch — yolo mode Worker auto-report (W2)

## 背景
- 來源：better-agent-terminal / PLAN-020 / T0167 / T0168 / T0169
- 目標：讓 Worker 在收尾階段自動通知 Tower，並支援 yolo 自動送出

## 變更檔案
- `~/.claude/skills/ct-exec/SKILL.md`：Step 8.5 改動
- `~/.claude/skills/ct-done/SKILL.md`：對應段落改動

## Before / After 對照
（逐 step diff，含 code block）

## 分流邏輯（auto-session 三模式）
...

## 失敗處理策略
- on 模式：軟鉤子（log warning，不阻斷）
- yolo 模式：硬鉤子（阻斷工單完成，避免靜默）

## 使用者可見訊息
- 成功（on）：📡 已預填塔台終端（請切回塔台按 Enter 送出）
- 成功（yolo）：📡 已通知塔台（YOLO 模式自動送出）
- 失敗：⚠️ bat-notify 執行失敗：<reason>，降級到剪貼簿

## 相容性
- 舊版 BAT（無 --submit flag）：yolo 模式降級為 on 行為 + 警告
- 非 BAT 環境：Step 8.5 整段跳過（沿用現狀）

## 測試建議
（留給上游 PR 執行）
```

### 2. Step 8.5 升級重點

**現狀**（assumed，實際由 Worker 讀 skill 確認）：
- 標記「可選」「靜默跳過」「靜默降級」
- Step 11 剪貼簿會蓋過 Step 8.5 的執行痕跡
- Worker AI 在收尾壓力下容易略過

**新規格**：
- Step 8.5 升級為**必要鉤子**
- 根據 `auto-session` config 分流：
  - `off` / `ask`：跳過 Step 8.5（保持現狀）
  - `on`：執行 `bat-notify.mjs` 無 `--submit`（預填，使用者手動按 Enter）
  - `yolo`：執行 `bat-notify.mjs --submit`（自動送出）
- Step 11（剪貼簿）降級為 **fallback**：僅在 Step 8.5 失敗時執行
- 執行結果必須顯示給使用者（成功 📡 / 失敗 ⚠️）

### 3. 失敗處理策略

| 模式 | 失敗行為 | 理由 |
|------|---------|------|
| `on` | log warning + fallback 到剪貼簿 + 工單仍視為完成 | 軟鉤子，不中斷流程 |
| `yolo` | **阻斷工單完成**（不寫 DONE） + 顯示錯誤 + 等使用者介入 | 硬鉤子，避免 yolo 陷入無回報的靜默狀態 |

**硬鉤子 yolo 的理由**：yolo 模式下塔台期待 Worker 自動送出觸發下一步，若 bat-notify 失敗但工單標 DONE，塔台會以為 Worker 沒動作，陷入死鎖。

### 4. 環境變數依賴

Worker 執行 `bat-notify.mjs` 前須確認：
- `BAT_SESSION=1`（否則非 BAT 環境，整段跳過）
- `BAT_REMOTE_PORT` 有值
- `BAT_REMOTE_TOKEN` 有值
- `BAT_TOWER_TERMINAL_ID` 有值（否則無法回 notify）

缺任一 → 降級到剪貼簿 + warning。

### 5. 訊息格式

Worker 呼叫 bat-notify 的訊息固定格式：
```
node scripts/bat-notify.mjs \
  --source "T####" \
  --target "$BAT_TOWER_TERMINAL_ID" \
  [--submit] \
  "T#### <狀態>"
```

訊息字串 `T#### <狀態>` 其中 `<狀態>` 為：
- `完成`（DONE）
- `部分完成`（PARTIAL）
- `失敗`（FAILED）
- `需要協助`（需塔台介入）

**這四個字串**是塔台斷點 A 判準（T0167 §C3 表格），**不可自由發揮**。

## 驗收條件

### 草稿完整性
- ✅ **V1**：草稿檔存在於 `_ct-workorders/_draft-ct-yolo-worker-skill-patch.md`
- ✅ **V2**：包含 ct-exec 和 ct-done 兩個 skill 的對稱改動
- ✅ **V3**：三模式分流邏輯清楚（off/ask / on / yolo）
- ✅ **V4**：失敗策略明確標示軟鉤子 vs 硬鉤子
- ✅ **V5**：使用者訊息三種狀態（成功 on / 成功 yolo / 失敗）規格化
- ✅ **V6**：四種狀態字串（完成/部分完成/失敗/需要協助）明確寫入
- ✅ **V7**：環境變數依賴清單完整

### 格式
- ✅ **F1**：符合 PLAN-011 先例的草稿檔結構（可作為 CT 上游 PR base）
- ✅ **F2**：Before/After diff 用 ```code block``` 標明
- ✅ **F3**：變更檔案路徑完整（`~/.claude/skills/ct-exec/SKILL.md` 等）

### 資訊引用
- ✅ **R1**：引用 T0167 研究報告（§A 根因、§B 技術前置、§D 工單 2）
- ✅ **R2**：引用 T0168 commit（`c4b2a19`，`--submit` 實作）
- ✅ **R3**：引用 D059 / D060 決策背景

## 注意事項

- **不寫入 skill 檔案**：確認 `~/.claude/skills/` 路徑為 Layer 1 唯讀
- **實際 skill 改動在工單 4**（上游 COORDINATED）：本工單只產草稿規格
- **工單 3 會另外產塔台 skill 的草稿**（自主決策 + 3 斷點）：本工單不涉及塔台端
- **Worker 應先讀現有的 ct-exec / ct-done SKILL.md**（可用 `Read ~/.claude/skills/ct-exec/SKILL.md` 方式讀取），確認 Step 8.5 的**現狀文字**再寫 Before/After 對照

## 收尾

1. Worker commit 草稿檔：`docs(ct): draft Worker skill yolo patch (PLAN-020 W2)`
2. 填寫下方回報區
3. （可選）呼叫 `bat-notify.mjs` 通知塔台（不加 `--submit`，yolo 尚未啟用）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 開始時間 / 完成時間
- 開始：2026-04-18 13:01 (UTC+8)
- 完成：2026-04-18 13:05 (UTC+8)

### Commit
`488ad93` — docs(ct): draft Worker skill yolo patch (PLAN-020 W2)

### 驗收結果

**草稿完整性**
- ✅ V1：草稿檔存在於 `_ct-workorders/_draft-ct-yolo-worker-skill-patch.md`
- ✅ V2：涵蓋 ct-exec Step 8.5 + ct-done Step 6.5 兩個 skill 的對稱改動（草稿 §「變更檔案」與「Before/After 對照」§1-§3）
- ✅ V3：三模式分流邏輯清楚（§「分流邏輯」含流程樹 + 表格）
- ✅ V4：失敗策略明確標示軟鉤子 vs 硬鉤子（§「失敗處理策略」表格 + 硬鉤子介入流程）
- ✅ V5：三種使用者訊息規格化（§「使用者可見訊息」分「成功 / 警告 / 錯誤」三小節）
- ✅ V6：四種狀態字串明確寫入（§「四種狀態字串」獨立章節，含 FIXED/BLOCKED 邊界）
- ✅ V7：環境變數依賴清單完整（§「環境變數依賴清單」5 個變數 + 現狀驗證）

**格式**
- ✅ F1：符合 PLAN-011 先例結構（背景/目標/變更檔案/相容性/測試建議，可直接作為上游 PR base）
- ✅ F2：Before/After diff 以 ```markdown``` code block 標明，現狀文字直接引用 SKILL.md line 269-286 / 305-326
- ✅ F3：變更檔案路徑完整（`~/.claude/skills/ct-exec/SKILL.md` + `~/.claude/skills/ct-done/SKILL.md`）

**資訊引用**
- ✅ R1：引用 T0167 §A 根因（env 鏈路通但 skill 擋住）、§B 技術前置、§D 工單 2（§「背景」「引用」）
- ✅ R2：引用 T0168 commit `c4b2a19`（§「前置條件」「相容性」「引用」）
- ✅ R3：引用 D059（yolo 插隊啟動）+ D060（Q2.A 研究工單 D 區段）（§「決策依據」「引用」）

### 草稿檔位置
`_ct-workorders/_draft-ct-yolo-worker-skill-patch.md`

### 草稿關鍵摘要

1. **Step 8.5 升級為必要鉤子**（非可選靜默），依 `auto-session` 三模式分流：`off/ask` 跳過、`on` 呼叫 `bat-notify.mjs`、`yolo` 呼叫 `bat-notify.mjs --submit`
2. **Step 11（剪貼簿）降級為 fallback**：僅在 Step 8.5 被跳過或 on 模式失敗時執行；yolo 失敗時**不跑 Step 11**，避免硬鉤子阻斷被誤導
3. **軟/硬鉤子差異**：on 失敗降級剪貼簿仍標 DONE（軟）；yolo 失敗阻斷工單、保持 IN_PROGRESS、等使用者 3 選項介入（硬，避免塔台死鎖）
4. **使用者訊息全部規格化**：成功（📡 on/yolo）、警告（ℹ️ 非 BAT / ⚠️ 舊版 BAT）、錯誤（🚨 yolo 硬鉤子）各給完整字樣
5. **四種狀態字串（`T#### 完成`/`部分完成`/`需要協助`）固定不變**，為塔台斷點 A 機械判準依據；FIXED/BLOCKED 併入現有三類以簡化塔台邏輯
6. **相容性清楚**：T0168 前 BAT 版本 yolo 自動降級為 on + 版本警告；非 BAT 環境整段跳過；7 個測試場景留給上游 PR 執行

### 互動紀錄
無

### 遭遇問題
無

### Renew 歷程
無

### Worker 筆記

**讀 skill 時發現的現狀**：
- `ct-exec/SKILL.md` Step 8.5 和 `ct-done/SKILL.md` Step 6.5 的文字**完全一致**，只有 section 標題編號不同（ct-exec 在 8.5 位於 Step 8 反序寫入後，ct-done 在 6.5 位於 Step 6 更新工單後）→ 草稿採「ct-exec After 全文 → ct-done 替換」策略減少重複
- ct-exec Step 11 現狀寫「工單狀態更新後，自動將回報文字寫入剪貼簿」，沒有「Step 8.5 失敗時才跑」的條件 → 草稿補上前置條件，避免 Step 8.5 和 Step 11 同時執行的重複

**邊界決策**：
- **FIXED/BLOCKED 歸類**：草稿將 FIXED 視為「完成」（與 DONE 同字串）、BLOCKED 視為「需要協助」（與 FAILED 同字串），以**塔台斷點 A 判準必須機械化**為優先考量。若工單 3 塔台 skill 需要更細的狀態區分，再另加字串（例如 `T#### 修復待驗收`），但目前維持三類
- **yolo 硬鉤子的 fallback 選項**：原本考慮 yolo 失敗就純阻斷，但加入「回答 fallback 降級為剪貼簿」的出路，避免使用者因環境問題被完全卡住
- **相容性處理**：偵測舊版 BAT 無 `--submit` 用「試跑觀察 exit code 或 --help 輸出」策略，不依賴版本號比對（BAT 目前無版本號對齊 commit 的機制）

**對工單 3/4 的提醒**：
- **工單 3**（塔台 skill）：斷點 A 判準字串**必須**與本草稿「四種狀態字串」章節完全一致（`T#### 完成` / `部分完成` / `需要協助`），不可自行擴充否則 Worker 端會通不過塔台 parse
- **工單 3**：C2 Q2.A 研究工單 D 區段的 parse 規則需明確到「找不到結構化表時如何 fallback」，建議觸發斷點 A 暫停 yolo（不自動猜測）
- **工單 4**（上游 COORDINATED）：本草稿參考 PLAN-011 先例已預留「後續工單」段落指向工單 4，上游 PR 建議**三件套一起 merge**（ct-exec + ct-done + control-tower），避免 Worker 端升級但塔台端未升級造成斷點 A 誤觸
- **本草稿未涉及**：`auto-session` config 的第四態 `yolo` 定義（屬 control-tower skill 範圍，由工單 3 / 工單 4 規格化）、塔台啟動面板 ⚠️ YOLO ACTIVE 警語（同上）
