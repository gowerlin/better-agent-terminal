---
schema_version: 1
schema_kind: workorder
id: T0692
title: "claude CLI 的 `Usage limit reset · continuing automatically` 不被 `src/lib/usage-limit.ts` 辨識：查清出現時機與影響，依結果修正辨識或以測試鎖定現況"
type: bugfix
status: FIXED
repo: better-agent-terminal
project: T0690
priority: P3
sizing: S
created_at: "2026-10-21T23:48:08+0800"
started_at: "2026-10-21T23:49:08+0800"
updated_at: "2026-10-21T23:54:08+0800"
completed_at: "2026-10-21T23:54:08+0800"
depends_on: []
related:
  - "T0690 回報區「觀察（非本單範圍）」第 1 點：2.1.306 的 auto-continue 字串另有 `Usage limit reset · continuing automatically`；`CLAUDE_AUTO_RE`（`src/lib/usage-limit.ts:128`）只認行首 `Usage limit reached[ again] · ` 或直接 `continuing automatically`，所以這句不會被辨識成 `claude-cli-auto`。2.1.300 已存在（計數 6→6），不是升版回歸；它是 reset 後的提示，不是撞到限制時的句子"
  - "PLAN-044 / T0566 / D148：用量限制自動繼續；CLAUDE.md「用量限制自動繼續」節：辨識唯一實作 `src/lib/usage-limit.ts`（main / headless / renderer 共用），句型取自 CLI 二進位，CLI 改字串時同步改此檔與測試；🔴 claude **絕不送文字**"
  - "同檔相關 regex：`CLAUDE_RESUMED_RE`（`Usage limit available again` / `Continuing shortly`）、`CLAUDE_STOPPED_RE`、`CLAUDE_STALE_HEAD_RE`（`Your usage limit has reset`）、`CLAUDE_STALE_PRESS_RE`"
  - "內嵌 CLI：`@anthropic-ai/claude-code` 2.1.306（T0690 `09509698`）"
affects_files:
  - src/lib/usage-limit.ts
  - src/lib/__tests__/usage-limit.test.ts
  - electron/usage-limit-continue.ts
  - electron/__tests__/**usage-limit**
  - docs/agent-guide/usage-limit-continue.md
  - CLAUDE.md
  - _ct-workorders/T0692-usage-limit-reset-continuing-string.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 先查清再改：從內嵌 CLI 2.1.306 的二進位找出 `Usage limit reset · continuing automatically` 的建構位置與前後文，回答：① 什麼情況、什麼時間點顯示（撞到限制時？倒數中？reset 之後？），同一流程前後還會顯示哪些句子（例如 `Usage limit reached · continuing automatically at …`、`Usage limit available again`、`Continuing shortly`）；② `continuing automatically` 那 6 處建構式各是哪一句；③ 這句應該屬於哪一類：`claude-cli-auto`（等待中）、resumed（已恢復）、stale 或其他。附二進位中的原文片段當證據（只引必要的短片段）。"
  - "🔴 再評估影響：沿 `src/lib/usage-limit.ts` 的分類結果，追到它的消費端（`electron/usage-limit-continue.ts` `UsageLimitContinueScheduler`、headless、renderer 的提示等），說明這句「沒被辨識」時實際會發生什麼：例如前一句 limit / auto 的狀態沒被清掉、提示一直掛著、排程沒取消、或完全沒差。對照 Settings 開關關閉（預設）與開啟、yolo 與非 yolo 分頁。"
  - "🔴 依結果處理（塔台已決定，不必再問）：A. 有使用者看得到的影響 → 修正 `usage-limit.ts` 的辨識（歸到 ③ 判定的類別，可能是 `CLAUDE_RESUMED_RE` 而不是 `CLAUDE_AUTO_RE`），補正反測試（新句型、既有句型不變、不會誤判其他 2.1.306 新字串，例如 T0690 列的 `Session limit reset`、`Limits reset`、`Approaching your 5-hour usage limit …`）。B. 沒有影響 → 不改辨識邏輯，只在測試加一筆鎖定現況的案例（註明出處與理由），並在 docs 的已知句型記一筆。兩種都要把結論寫進回報。若查到第三種情況（例如需要改 scheduler 的行為、或影響涉及 codex），先停，用 BAT 通道問塔台。"
  - "🔴 不變式：claude 分頁**絕不送文字**（CLI 2.1.234 起內建 `autoContinueAtUsageLimit`，雙送會產生兩個續行 turn）；Settings 開關預設關、關閉時完全不偵測。修正不得讓 claude 路徑出現任何寫入 PTY 的動作。`usage-limit.ts` 維持不 import electron / DOM。"
  - "🔴 驗證：`npx vitest run src/lib/__tests__/usage-limit.test.ts` 與有改到的其他測試綠；`npm run typecheck` = 0；改到 `electron/**` 時 `npm run typecheck:electron` = 0；最後整包 `npm run test:unit`（基線 5805 passed / 326 files / 3 skipped，只能增加，0 failed）。跑測試時 `BAT_HELPER_LOG_DIR` / `BAT_USER_DATA` 指到 temp。不需要 build。"
  - "🔴 文件：`docs/agent-guide/usage-limit-continue.md` 的句型表補這一句（出處：CLI 2.1.306、T0692）；CLAUDE.md「用量限制自動繼續」節只在必守規則有變時改（遵守開頭撰寫規則，`##` 標題不改名），通常不必改。"
  - "🔴 Git：`git commit --only <檔案>`；不 push；不觸發任何 workflow。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」：回報裡的路徑用 repo 相對路徑或 `<使用者資料夾>`。yolo：不得問使用者，判讀問題問塔台。"
---

# T0692 — `Usage limit reset · continuing automatically` 的辨識

## 元資料

- **工單編號**：T0692
- **類型**：bugfix（先查證，依結果修正或鎖定現況）
- **優先級**：P3
- **建立時間**：2026-10-21T23:48:08+0800
- **預估規模**：S

## 目標

T0690 追版 claude CLI 2.1.306 時發現有一句 `Usage limit reset · continuing automatically`，`src/lib/usage-limit.ts` 不會辨識它。這句從 2.1.300 就有，不是升版回歸。本單查清它何時出現、該歸哪一類、沒被辨識時使用者實際會不會碰到問題，再依結果處理：有影響就修正辨識，沒影響就以測試鎖定現況並記進文件。

## 要做的事

1. 從 CLI 2.1.306 二進位找出這句的前後文與顯示時機，判定類別。
2. 追 `usage-limit.ts` 的消費端，評估沒被辨識的實際影響（開關關／開、yolo／非 yolo）。
3. A（有影響）修正辨識 + 正反測試；B（沒影響）加鎖定現況的測試。
4. docs 句型表補這一句。
5. 測試、typecheck。

## 驗收

- 回報有：顯示時機與前後文（附二進位原文片段）、類別判定、影響評估、採 A 或 B 與理由。
- claude 路徑沒有任何寫入 PTY 的新動作。
- `usage-limit.test.ts` 綠；`npm run typecheck` = 0（改到 electron 另加 `typecheck:electron` = 0）；整包 `test:unit` ≥ 5805 passed、0 failed。
- 只改 `affects_files`；未 push、未觸發 workflow。

---

## 回報區

### 待塔台決策（僅 yolo Worker 有問題時）

### 完成狀態

**FIXED**（採 A：修正辨識）。產品 commit `560409a3`。

### 產出摘要

**落地檢查**：PASS。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 工單在 repo 內；C-3 `affects_files` 皆存在（informational）；無 `branch` 欄位（C-2 不適用）；無 `CT_HOME`（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。

**① 顯示時機與前後文**（內嵌 `node_modules/@anthropic-ai/claude-code/bin/claude.exe` 2.1.306；這段 JS 在二進位裡有兩份：位移約 127.1 MB 的編譯版與約 273.8 MB 的原始碼版，所以每個字串都算兩次）：

同一個元件（自動繼續狀態列 hook）裡：

```js
case"auto-armed":{I(pt(kSe(),Date.now()),"notice");return}          // started 句
case"taken-over":{I(bt(kSe(),Date.now()),"notice");return}          // rearmed 句
case"fired-now":{I("Usage limit available again \xB7 continuing now","notice"),F("Usage limit available \u2014 Claude is continuing your task","quota_auto_resume_fired");return}
case"stale":{I("Usage limit has reset \xB7 press enter to continue","notice"),F("Usage limit reset \u2014 press enter to continue","quota_auto_resume_stale");return}
...
be=()=>{if(Hio(Date.now(),s)==="fired")I("Usage limit reset \xB7 continuing automatically","notice"),F("Usage limit reset \u2014 Claude is continuing your task","quota_auto_resume_fired")}
...ya(be,A.phase==="armed"?ct:null)      // ct=30000：phase 為 armed 時每 30 s 檢查一次
```

`I(...)` = `transcript.apply({type:"append",messages:[...]})`（寫進對話紀錄的 notice），`F(...)` = 桌面 / 終端通知。所以這句是**自動繼續已 armed、計時器檢查到時間到並觸發續行的那一刻**印進對話紀錄的通知，與 `fired-now` 的 `Usage limit available again · continuing now` 是同一事件的兩條路徑（通知文字都是「Claude is continuing your task」）。不是撞到限制時、也不是倒數中的句子。

同一流程前後的句子（依時間）：撞限制 `You've hit your … · resets …` → 對話紀錄 notice `Usage limit reached · continuing automatically at 4pm · esc to cancel`（`auto-armed`）；狀態列 `status` = `Usage limit reached · limit resets 4pm`、`next` = `Continuing automatically at 4pm · esc to cancel`（快到時 `Continuing shortly · esc to cancel`）→ 到點：`Usage limit reset · continuing automatically` 或 `Usage limit available again · continuing now` → Claude 開始新 turn。休眠跨過重置則走 stale：狀態列 `Your usage limit has reset` / `Press enter to continue`，另印 notice `Usage limit has reset · press enter to continue`。

**② `continuing automatically` 6 處**（大小寫敏感計數；3 個字串 × 2 份）：
1. `started`：`Usage limit reached · continuing automatically {when} · esc to cancel`
2. `rearmed`：`Usage limit reached again · continuing automatically {when} · esc to cancel`
3. `Usage limit reset · continuing automatically`（本單）

另有 `waiting`：`Continuing automatically {when} · esc to cancel`（大寫 C，不在 6 處內；`CLAUDE_AUTO_RE` 有 `i` 旗標，已辨識）。

**③ 類別**：resumed（`claude-cli-resumed`）。

**影響評估**（沿 `classifyUsageLimitScreen` → `decideUsageLimit` → `UsageLimitContinueScheduler.evaluate` → `terminal:usage-limit-status` 徽章）：
- **Settings 開關關閉（預設）**：`onOutput` 立即返回，完全沒影響。
- **開啟，claude 分頁（yolo 與非 yolo 相同，提示路徑不看 yolo）**：CLI 到點續行、turn 結束後分頁安靜 5 s 時分類。這句不被辨識 → 由下往上掃到較早的 `Usage limit reached · continuing automatically at 4pm · esc to cancel` notice → `cli-auto` 提示 → 縮圖徽章仍顯示「CLI 將於 4pm 自動繼續」，但 CLI 已經續行。徽章要等那行被擠出最後 40 個非空行、或使用者輸入（`handledSeq`）才清掉；transcript 重繪（例如縮放）時舊 notice 重新出現在畫面底部附近也會再觸發。修正前以 scheduler 測試實證（新測試在修正前 `lastStatus` 仍是 `cli-auto`）。這是使用者看得到的影響（輕微，只是錯誤提示）→ 採 A。
- **送出路徑**：claude 的 `cli-auto` 只提示，從不送出；stale 的 Enter 排程靠狀態列的 `Your usage limit has reset` / `Press enter to continue`，與這句無關。修正後這句歸 resumed → `action: 'none'`，只會清除提示、取消等待中的 Enter（CLI 已自己續行時取消是正確的），**不新增任何寫入 PTY 的動作**。
- **codex**：不受影響（codex regex 未改，新句型也不會出現在 codex 畫面）。
- 不需要改 scheduler，不是第三種情況，沒問塔台。

**變更**
- `src/lib/usage-limit.ts`：`CLAUDE_RESUMED_RE` 加 `Usage limit reset\s*[·•]\s*continuing automatically\b`（同樣只認行首、允許 TUI 前綴）；檔頭句型來源註解補上兩個續行句。仍不 import electron / DOM。
- `src/lib/__tests__/usage-limit.test.ts`：正向（單行、`⎿` 前綴、在舊 started notice 之下 → `none`、更新的 rearmed 在其下仍 `cli-auto`）、負向（回覆中引用、引號）、不誤判 `Session limit reset` / `Limits reset` / `Weekly limits reset` / `Usage limit reset. Re-running 2 waiting agents.`（workflow 等待）/ `Approaching your 5-hour usage limit · resets 4pm (Asia/Taipei)`。
- `electron/__tests__/usage-limit-continue.test.ts`：yolo 與非 yolo 分頁，`cli-auto` 提示在這句之後清為 `null`，24 h 內不送任何東西。
- `docs/agent-guide/usage-limit-continue.md`：claude 規格段補這句（出處 CLI 2.1.306、2.1.300 已有、T0692），驗證清單補兩項測試。
- CLAUDE.md：必守規則沒變，未改。`electron/usage-limit-continue.ts`：未改。

**驗證**
- `npx vitest run src/lib/__tests__/usage-limit.test.ts electron/__tests__/usage-limit-continue.test.ts electron/remote/__tests__/headless-usage-limit-e2e.test.ts`：3 files / 80 passed（修正前新加的 2 筆失敗，修正後通過）。
- `npm run typecheck`：exit 0（0 errors）。
- `npm run typecheck:electron`：exit 0（只改了 electron 的測試檔，仍跑過）。
- `npm run test:unit`：**326 files passed、5812 passed / 3 skipped、0 failed**（基線 5805，+7 = 本單新增測試數）。`BAT_HELPER_LOG_DIR` / `BAT_USER_DATA` 指到 `%TEMP%` 下的暫存目錄。
- 未 build（工單不需要）。

**Commit**：`560409a3`（`git commit --only` 四個產品 / 文件檔）；工單檔另一個 commit。未 push、未觸發 workflow。

### 互動紀錄

無（沒有向塔台提問）。

### 遭遇問題

- 無阻擋。觀察（非本單範圍）：stale 階段另有對話紀錄 notice `Usage limit has reset · press enter to continue`（不是 `Your usage limit has reset`），目前不被辨識；BAT 的 stale 偵測靠的是狀態列兩行，仍會正常觸發，所以沒影響，未改。
- 工作樹另有 `_ct-workorders/T0693-research-worker-tab-check-after-renew.md` 的未提交修改（非本單），未動。

### 回報時間

2026-10-21T23:54:08+0800
