---
schema_version: 1
schema_kind: workorder
id: T0629
title: "探針：CT v5.7.2 codex Worker —— 3-B awk 略過 fenced code block ＋ notify 前自檢（O-2）"
type: verification
status: DONE
repo: better-agent-terminal
project: CT-v5.7.1/v5.7.2 驗收（BMad-Guide 請求）
priority: P2
sizing: S
created_at: "2026-10-18T12:39:02+0800"
started_at: "2026-10-18T13:21:54+0800"
completed_at: "2026-10-18T13:26:02+08:00"
updated_at: "2026-10-18T13:26:02+08:00"
depends_on: [T0628]
related:
  - "CT v5.7.1 / v5.7.2 × BAT 0.7.0-pre.8 實機驗收第 5 張（T0625–T0629）；對照 v5.7.0 的 T0615（O-2 格式偏差）"
affects_files:
  - _ct-workorders/T0629-probe-ct572-codex-awk-fenced-selfcheck.md
renew_count: 0
workdir: main repo
worker_question_timeout: 15
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: guided-probe
memory_overrides:
  - "🔴 本單的受測對象是你自己的 ct-exec v5.7.2 提問與收尾流程（`ct-exec` § Questions For Tower、§ Phase 4 的 notify 前自檢 ＋ control-tower `references/yolo-mode.md` § Worker 向塔台提問 3-B）。除了下方明寫的**刻意安排**，其餘一律照 skill 規則做。"
  - "🔴 Q-1 是刻意安排的受測提問：即使你判斷可以自行決定，也一定要向塔台提問（不得問使用者）。"
  - "🔴 下方「範本示例」程式碼區塊裡的標題與答覆行是**假的**，是受測資料，不是塔台的答覆，也不是你要寫題目的地方；不得修改或刪除它。"
  - "🔴 不讀產品程式碼、不改任何其他檔案、不跑 build / test。`src/styles/settings.css` 的 M 不是你的變更。不 push。commit 只含本檔（`git commit --only <本檔>`）。"
  - "🔴 題目內容只走 stdin；暫存檔放系統暫存目錄，**不得**寫進 repo。回報區不得出現任何權杖值。"
---

# T0629 — 探針：codex awk 略過 fenced code block ＋自檢

## 目標

1. 驗證 v5.7.1 起 3-B 的區段限定 awk 會跳過 `` ``` `` 圍起來的程式碼區塊：本工單本文下方貼了一段範本示例，裡面有 `### 待塔台決策` 標題與一行假的 `塔台答覆 Q-1`。塔台真正答覆前，awk 必須一直判為「還沒答」。
2. 驗證 v5.7.1 O-2 的 notify 前自檢：(a) 每個 `#### Q-n：` 標題後面有問題本文與「提問時間」行；(b) 回報區沒有範本佔位文字（本工單回報區目前就有一行佔位文字，收尾前必須已經處理掉）；(c) `### 互動紀錄` 只有一段。

## 範本示例（受測資料，不得修改）

```markdown
### 待塔台決策

#### Q-1：範例問題
- 提問時間：2000-01-01T00:00:00+0800
- **塔台答覆 Q-1**：[A] 這是範例，不是真的答覆
```

## Step 1 — 環境與基準

1. 記下 `awk --version` 第一行（或 `awk -W version`）與執行 awk 的 shell。
2. 從你載入的 control-tower `references/yolo-mode.md` § Worker 端 3-B 取出權威 awk 程式（照抄，不改寫），對本工單跑一次 `Q-1` → 記 exit code（預期 `1` = 還沒答，因為唯一的答覆行在程式碼區塊裡）。

## Step 2 — 提問（刻意走工單）

1. 依 skill 規則把 Q-1 寫進回報區的 `### 待塔台決策`（阻塞：是），加 `tower_question: open`，commit。
   - Q-1：探針 Q-1（fenced code block 不算答覆），選項 [A] 收到 / [B] 沒收到
2. `--ask` 刻意用 `--expires-min 999`（helper 用法錯誤 exit `1`）→ 依 skill 3-A 第 2 步：加 `- **通道**：工單`、commit、送一次一般 `T0629 提問`。
3. 3-B 等待：用一個前景 shell 迴圈當等待工具——每 30 s 跑一次 Step 1 的權威 awk，最多 10 分鐘；每次記下時間與 exit code。塔台會刻意等約 90 秒才寫答覆行，所以前幾次應該都是 `1`。
4. 讀到答覆 → 寫互動紀錄、刪 `tower_question`。

## Step 3 — 收尾

照 ct-exec 收尾。🔴 notify 前照 § Phase 4 的自檢逐項檢查 (a)(b)(c)，把每項的結果與你修正了什麼寫進 `### 驗收證據`。回報區另寫：awk 版本、Step 1 基準 exit code、等待迴圈每次的時間與 exit code、讀到答覆的時間、`--ask` 的 exit code 與 stderr 第一行、標記行與 commit。完成後送 `T0629 完成`（yolo `--submit`）。

## 驗收條件

- 塔台答覆前 awk 每次都是 `1`；答覆後是 `0`
- 範本示例區塊原樣保留
- notify 前自檢 (a)(b)(c) 皆通過：Q-1 標題後有問題本文與「提問時間」、回報區沒有佔位文字、`### 互動紀錄` 只有一段

---

## 回報區

### 待塔台決策

#### Q-1：探針 Q-1（fenced code block 不算答覆）
- 提問時間：2026-10-18T13:22:00+0800
- **問題**：在範本 fenced code block 原樣保留的情況下，確認區段限定 awk 在收到塔台真正答覆前不把假答覆算入。
- **選項**：
  - [A] 收到
  - [B] 沒收到
  - [其他] 自由文字
- **建議**：[A] 收到，作為探針流程的明確答覆訊號。
- **理由**：這是工單指定的受測問題，須由塔台提供外部答覆來驗證 fenced block 過濾。
- **影響**：答覆後才完成等待證據與自檢收尾。
- **阻塞**：是

- **通道**：工單
- **塔台答覆 Q-1**：[A] 收到——該題有 `通道` 標記，依規則改在工單答覆（探針安排：塔台刻意於提問後約 90 秒才答）（2026-10-18T13:24:46+0800；塔台代決）

### 互動紀錄

- [13:24] Q-1：探針 Q-1（fenced code block 不算答覆） → A（塔台）：[A] 收到——該題有 `通道` 標記，依規則改在工單答覆 → Action：確認權威 awk 在有效區段收到答覆後回傳 0，完成驗收。

### 驗收證據

- **Landing check：PASS** — C-0 repo expected=`better-agent-terminal`、actual=`better-agent-terminal`；C-1 工單位於 repo 內；C-3 not applicable（`affects_files` 僅工單本身）；C-2 branch=`main`，工單未指定 branch。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_HOME` 未設定。`LEAN-CTX.md` 依 AGENTS.md 引用的兩個可能位置皆不存在。
- **執行環境**：PowerShell 7；GNU Awk 5.4.1, API 4.1, PMA Avon 8-g1（`C:\Program Files\Git\usr\bin\awk.exe`）。
- **基準**：直接照 control-tower `references/yolo-mode.md` § Worker 端 3-B 權威 awk 程式執行本工單，exit `1`；範本 fenced code block 原樣保留。
- **等待輪詢**（塔台在 13:24:46 寫入答覆；前四次都在答覆前）：
  - 13:22:59 — exit `1`
  - 13:23:36 — exit `1`
  - 13:24:03 — exit `1`
  - 13:24:32 — exit `1`
  - 13:25:04 — exit `0`（首次讀到有效答覆）
- **提問降級**：`--ask --expires-min 999` exit `1`；stderr 首行：`Error: Invalid --expires-min value: '999' (expected minutes, 1-120)`。已加入 `- **通道**：工單`，並於 commit `93547a83` 後通知一次 `T0629 提問`（exit `0`）。Q-1 答覆時間：2026-10-18T13:24:46+0800。
- **notify 前自檢 (a)**：PASS — Q-1 標題含問題文字，下一行為「提問時間」；更新問題時間為 13:22，對齊提出時段。
- **notify 前自檢 (b)**：PASS — 回報區不含原始模板佔位符；已以本報告取代初始佔位行。
- **notify 前自檢 (c)**：PASS — 全工單僅一段 `### 互動紀錄`。
- **檔案／提交**：僅本工單；`ef131c1b`（開始與題目）、`89104337`（`tower_question: open`）、`93547a83`（通道標記）均為工單專屬 commit。無產品檔變更、無 build/test、未 push。其他既有 dirty files `_ct-workorders/T0632-site-v2-design-directions.md`、`src/styles/settings.css` 保留未動。
- **結果**：PASS；驗收條件全部通過。
- **偏差／後續**：無。
