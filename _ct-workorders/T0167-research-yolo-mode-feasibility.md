# T0167-research-yolo-mode-feasibility

## 元資料
- **工單編號**：T0167
- **任務名稱**：研究：PLAN-020 yolo 模式技術可行性 + bat-notify 觸發機制調查
- **狀態**：DONE
- **類型**：research
- **互動模式**：enabled
- **Renew 次數**：0
- **建立時間**：2026-04-18 12:15 (UTC+8)
- **開始時間**：2026-04-18 12:25 (UTC+8)
- **完成時間**：2026-04-18 12:39 (UTC+8)
- **預估工時**：1.5-2h（純靜態分析 + 現況調查）
- **預估 context cost**：中（~15-20% window）
- **關聯**：PLAN-020（本研究為其前置）
- **報告檔案**：`_ct-workorders/_report-plan-020-yolo-feasibility.md`

## 研究目標

為 PLAN-020 yolo 模式找出技術落地路徑。重點回答三組問題：

1. **現況為何不通**：為何 `auto_session: on` 的反向通道（Worker → 塔台）沒有自動觸發？`bat-notify.mjs` 存在但未被呼叫的根因是什麼？
2. **技術前置**：要讓「Worker 自動送出到塔台並觸發塔台下一步」這條路打通，BAT code / skill / env 各需做什麼改動？
3. **塔台自主決策邏輯**：哪些決策可自主（基於研究報告拆單建議）、哪些必須斷點問人？3 次斷點如何實作？

產出 **4 張實作工單的拆單建議 + 技術路徑圖**，讓使用者決策後直接派發。

## 範圍

**納入分析**：

### A. 現況根因分析
1. `scripts/bat-notify.mjs` 完整行為（雙管道：`terminal:notify` + `pty:write`）
2. `scripts/bat-terminal.mjs` 開新終端時有沒有注入 `BAT_TOWER_TERMINAL_ID` env？若沒有，為什麼？
3. 塔台本身的 terminal-id 從哪取得？塔台怎麼讓 Worker 知道「我是誰」？
4. `ct-exec` / `ct-done` skill 當前工單完成流程：是否有呼叫 `bat-notify.mjs`？為何沒有？
5. `pty:write` 送出的字串為何不含 `\r`？是故意設計還是遺漏？（讀 terminal-server.ts / pty-manager.ts）

### B. 技術前置方案
1. `bat-notify.mjs --submit` flag 設計：送 `\r` 的副作用（搜尋「預填但不送出」的原設計意圖）
2. `BAT_TOWER_TERMINAL_ID` 注入鏈路：塔台 session 啟動時如何得知自己的 terminal-id，並讓後續 Worker sub-session 繼承？
3. `terminal-server` / `pty-manager` 是否需要新增 IPC channel 支援 submit？
4. skill 層（ct-exec / ct-done）如何在結尾呼叫 bat-notify？是寫死還是受 config 控制？

### C. 塔台自主決策邏輯設計
1. 塔台如何識別「yolo 模式開啟」？從 `_tower-config.yaml` 讀？還是 env？
2. 塔台如何判斷「下一張工單」？有哪些資訊來源（研究報告拆單建議、PLAN 文件、工單間依賴）？
3. 3 大斷點條件的**具體判準**：
   - A（無法判斷）：Worker 回報 FAILED / PARTIAL / 非預期狀態時觸發
   - B（死迴圈）：Renew ≥3 或連續 3 FAILED 時觸發
   - C（跨範圍）：Worker 建議的下一步超出 PLAN 定義時觸發
4. 斷點觸發後的通知機制（Worker 不會再進，塔台如何「等」？）
5. yolo 啟動時的視覺標示（啟動面板是否該加 ⚠️ 警語）

### D. 拆單建議
產出 4 張實作工單的草稿，每張：
- 暫訂 ID（T#### 本專案 / CT-T### 上游）
- **專案歸屬**：本專案（better-agent-terminal）/ 跨專案（Control-Tower-Skill 上游）
- 標題 + 依賴順序
- 核心變更清單（檔案路徑 + 新增/修改/移除）
- 驗收條件
- 預估工時
- 風險旗 🔴 / 🟡 / 🟢

**重要邊界**：
- BAT code 改動（`scripts/bat-*.mjs` / `electron/terminal-server.ts` / `electron/pty-manager.ts`）→ 本專案工單（`T####`）
- skill 改動（`~/.claude/skills/control-tower/` / `~/.claude/skills/ct-*/`）→ **不可直接寫入**（Layer 1 唯讀保護），需：
  1. 本專案先產出 skill 草稿檔（`_ct-workorders/_draft-ct-yolo-*.md`）作為規格
  2. 產出 COORDINATED 工單（`CT-T###` 前綴）推回 Control-Tower-Skill 上游專案
  3. 遵循 PLAN-011 先例流程（CT v4.0.1 → v4.1.0）

拆單表格必須標示每張工單的**專案歸屬**。

**排除範圍**：
- 不改任何程式碼（純研究）
- 不跑 dev server、不打包
- 不修改 `_tower-config.yaml` / skill 檔案
- 不處理 PLAN-018（已冷凍，等 PLAN-020 完成再回復）

## 已知資訊

| 項目 | 值 |
|------|---|
| bat-notify.mjs 存在 | ✅（已確認） |
| bat-terminal.mjs 存在 | ✅（已確認，用於開新 Worker terminal） |
| 當前塔台 session 的 `BAT_TOWER_TERMINAL_ID` | 空字串（**未設定**，推測為根因） |
| 當前塔台 session 的 `BAT_TERMINAL_ID` | `c8a43b60505544cf573367ebb45d7bcb`（有值） |
| `BAT_REMOTE_PORT` | 9876（有值） |
| T0133 整合工單 | 已歸檔（Worker→Tower 雙管道，本 PLAN 延伸） |

## 研究指引

### 關鍵問題 1：為什麼 auto_session on 不觸發 Worker 回報？

調查步驟建議：
1. Grep `bat-notify` 在 skill 檔案中（`~/.claude/skills/ct-exec/`、`~/.claude/skills/ct-done/`、`~/.claude/skills/control-tower/`）是否有呼叫
2. Grep `BAT_TOWER_TERMINAL_ID` 整個 repo 看哪裡設定
3. 讀 `bat-terminal.mjs` 確認開新終端時 env 傳遞機制
4. 讀塔台 skill 環境偵測段落，看是否應該設 `BAT_TOWER_TERMINAL_ID`

結論必須回答三個子問題：
- bat-notify.mjs 應由誰呼叫？（Worker skill？BAT hook？）
- `BAT_TOWER_TERMINAL_ID` 應由誰設定？（塔台啟動自設？BAT 建立終端時傳？）
- 當前設計是否就該 work（只是缺 env）？還是設計本來就漏掉這段？

### 關鍵問題 2：pty:write 為何不送 `\r`？

讀 `electron/terminal-server.ts` 和 `electron/pty-manager.ts`：
- 找 `pty:write` handler
- 查 `write` 函式是否會自動加 `\r`
- 如果不加，是刻意的安全考量嗎？（避免注入攻擊？）
- 若加 `\r` 有副作用，yolo 模式需要獨立 channel 還是 flag 控制？

### 關鍵問題 3：塔台自主決策邏輯要多「聰明」？

設計層面評估：
- 塔台能自動決策的情境（建議列清單）：
  - PLAN 有明確拆單順序
  - 工單回報 DONE 無 FAILED
  - 無衝突、無需使用者決定的問題
  - 下一張工單不需新的 C1/C2/C3 式決策點
- 塔台必須停下的情境（對應斷點 A/B/C）

### 關鍵問題 4：驗證策略

yolo 完成後如何驗證？
- 用 PLAN-018 剩下 4 張工單（推薦）
- 或用新造的小 PLAN 跑測試
- 驗收條件應涵蓋：
  - Worker 自動送出有效
  - 塔台收到後自動派下一張
  - 斷點 A/B/C 各至少觸發一次
  - 過程無手動介入

## 互動規則

- Worker 可主動提問（`research_max_questions: 3`）
- 提問必須用選項式：`[A] ... [B] ... [C] ... 其他：________`

**預期可能提問**：
- `pty:write` 加 `\r` 若有安全考量 → 請使用者決定是否接受 `yolo` 限定 flag
- 若發現根本設計缺陷（如 BAT_TOWER_TERMINAL_ID 沒有合理注入點）→ 請使用者決定是否調整 PLAN-020 範圍
- 拆單粒度是否要更細（如把 BAT 改動拆 2 張）→ 請使用者決定

## 產出

### 主要產出
報告檔案：`_ct-workorders/_report-plan-020-yolo-feasibility.md`

報告結構：
```
# PLAN-020 yolo Mode Feasibility Research (T0167)

## 總覽
- 根因結論（為何 auto_session on 反向沒觸發）
- 技術前置難度（🟢/🟡/🔴）

## A. 現況根因分析
### A1. bat-notify.mjs 設計與呼叫點
### A2. BAT_TOWER_TERMINAL_ID 注入鏈路
### A3. pty:write 不送 \r 的原因
### A4. skill 層呼叫空白點

## B. 技術前置方案
### B1. bat-notify.mjs --submit flag 設計
### B2. BAT_TOWER_TERMINAL_ID 注入機制
### B3. terminal-server / pty-manager 改動
### B4. skill 層改動

## C. 塔台自主決策邏輯設計
### C1. yolo 啟動識別
### C2. 下一張工單判定規則
### C3. 3 大斷點判準與機制
### C4. 視覺警示與日誌

## D. 4 張實作工單拆單建議
### 工單 1: BAT 通知鏈路打通
### 工單 2: Worker skill 自動回報
### 工單 3: 塔台 skill 自主決策
### 工單 4: PLAN-018 驗證場景

## E. 技術路徑圖（Mermaid / ASCII）

## 下一步選項
- [A] 接受拆單，依序派發 4 張實作工單
- [B] 調整拆單（合併或拆細）
- [C] 揭示需調整 PLAN-020 範圍（某能力先 skip）
```

### 回報區要求
- 根因結論必須具體（為何 on 反向沒觸發）
- 拆單建議必須可直接成為實作工單骨架
- 下一步選項必須三選一

## 執行注意事項

- 本研究在**主線**執行（純讀碼）
- 不需要 `git worktree add` 或 `npm install`
- 允許 `git log` / `git show` / `grep` / `find` 任意讀取
- Worker 可用 `env` 命令驗證自己 session 的環境變數
- 不修改任何檔案（報告檔案除外）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 互動紀錄
[12:31] Q1: `\r` 實作策略 A vs B vs C → A: 使用者請求比較 A 和 C 的穩定性/程序 → Action: 提供比較表，明確推薦 A（C 實務上不可行：shell argv 難乾淨傳 CR byte，最終仍需改 bat-notify）
[12:33] Q1 確認: 使用者回覆 `Q1.A` → Action: 固定 Q1 為 flag 方案（bat-notify.mjs --submit）
[12:32] Q2: 塔台自主派下一張的資訊來源 A/B/C → A: 使用者表示 Q2 需塔台參與討論，自己難決定 → Action: Q2 保留決策，D 區改為「條件式拆單」，工單 3 規格寫三平行分支，工單 4 啟動前需塔台決策

### 調查結論

**技術前置難度**：🟢 BAT code（1 檔 ~5 行）+ 🟡 skill 層（3 skill 需改，走上游 COORDINATED）
**拆單可行性**：✅ 可行，但因 Q2 未決策，D 區採「條件式」5 張工單（1 可立即開工，4 需 Q2 固定後啟動）

### 根因結論

`auto_session: on` 反向沒觸發並非 env 注入機制缺失，而是：
1. ✅ env 注入鏈路完整（本 session 實測 `BAT_TOWER_TERMINAL_ID=c8a43b...` 有值，`pty-manager.ts:410/456/532` 正確 spread `customEnv`）
2. ❌ **ct-exec Step 8.5 / ct-done 等效 step 被標記為「可選」「靜默跳過」「靜默降級」**，Worker AI 收尾壓力下易略過
3. ❌ 即使 Step 8.5 有執行，`pty:write`（`terminal-server/server.ts:256`）直接透傳 message，`bat-notify.mjs:305` 不附加 `\r`，塔台終端僅「預填」而非自動送出
4. ❌ 缺乏可見回饋，Step 11（剪貼簿）會蓋過 Step 8.5 的執行痕跡，使用者誤以為沒發生

工單原描述「塔台 BAT_TOWER_TERMINAL_ID 未設定」是方向誤解——塔台自己本來就不該有 BAT_TOWER_TERMINAL_ID（沒 parent tower），關鍵在 Worker env 是否正確注入（實測已通）。

### 拆單建議摘要

| # | 標題 | 專案 | 依賴 | 工時 | 風險 |
|---|------|------|------|------|------|
| 1 | BAT code: `bat-notify.mjs --submit` flag | 本專案 T#### | — | 1-1.5h | 🟢 |
| 2 | 本地草稿: Worker skill 自動回報規格 | 本專案 T#### | 1 | 1-1.5h | 🟢 |
| 3 | 本地草稿: 塔台 skill 自主決策 + 3 斷點規格 | 本專案 T#### | 2 | 2-3h | 🟡 |
| 4 | 上游 COORDINATED: skill 三件套推 Control-Tower-Skill | 上游 CT-T### | 2+3（含 Q2 決策） | 2-3h | 🟡 |
| 5 | 本專案驗收: PLAN-018 剩 4 張工單 yolo 實跑 | 本專案 T#### | 4 | 1-2h | 🟢 |

**合計**：7-11h（略高於 PLAN-020 原估 6-9h，因拆單更細緻）

### 下一步建議

**[A] 接受條件式拆單（研究者推薦）** — 理由：
1. 工單 1 無 Q2 依賴，可立刻開工不阻塞
2. 條件式拆單讓塔台有時間討論 Q2，不阻塞 BAT code 工作
3. 符合 PLAN-011 先例（本專案草稿 → 上游 COORDINATED）
4. 3 斷點機制與 Q2 選項**正交**，不因 Q2 決策延遲而重做

**塔台需優先討論**：Q2 選 A/B/C 決策（工單 3 才能收斂、工單 4 才能啟動）。

### Commits / 檔案改動

- 新增：`_ct-workorders/_report-plan-020-yolo-feasibility.md`（研究報告主產出）
- 修改：`_ct-workorders/T0167-research-yolo-mode-feasibility.md`（狀態更新 + 回報區）

commit：`de2e711` — docs(ct): T0167 research report — PLAN-020 yolo mode feasibility

### Worker 筆記

- 研究過程中「當前塔台 `BAT_TOWER_TERMINAL_ID` 空字串」的「已知資訊」條目實際是對塔台自己 session 的觀察，這本來就正確。調查時混淆了「塔台自身 env」與「Worker env」兩個不同物件，本報告 A2 明確區分
- Q1 A vs C 比較時發現 C 有隱藏技術障礙：shell argv 難以乾淨傳 CR byte，C 方案最終仍需在 bat-notify 內解 escape，等於退化為 A。這個發現讓 A 成為唯一穩定可行方案
- 本研究**刻意不決策 Q2**，保留給塔台。D 區三份平行規格讓塔台決策後可直接使用，不需重寫
- 拆單從 PLAN-020 原訂 4 張調整為 5 張，主要差異在把「本地草稿」與「上游 COORDINATED」分離為獨立工單，符合 PLAN-011 的雙軌協調模式
