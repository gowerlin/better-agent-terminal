# T0179 研究報告 — Worker yolo flag 傳遞協定

**工單**：T0179
**日期**：2026-04-18
**上游**：BUG-041（OPEN）、D062（Worker 無狀態原則）、PLAN-020（yolo mode dogfood）
**下游**：T0180（BAT 端實作）、CT-T005（塔台 skill DELEGATE）、CT-T006（Worker skill DELEGATE）
**研究型態**：純研究（不改程式碼 / 不派工單 / 不 commit skill）

---

## 摘要

**結論**：推薦 **方案 A（env 注入 via `bat-terminal.mjs` customEnv）**。

**協定設計**（依 Q1.A + Q2.C + Q3.C 決策）：

- **Flag**：`--mode <yolo|ask|off|on>`（主模式，互斥）+ `--interactive` / `--no-interactive`（modifier，副維度）
- **Env**：`CT_MODE=yolo` + `CT_INTERACTIVE=1`（獨立、關注點分離）
- **Fallback**：Worker 讀不到 `CT_MODE` → 一律當 `ask` + 顯示 `⚠️ 塔台未傳 --mode flag，可能版本過舊` 升級提示（嚴格 D062，不讀 config）

**實作成本**：
- **BAT 端（T0180）**：~30 min，僅改 `scripts/bat-terminal.mjs` 一個檔案（補 2 flag、擴充 `KNOWN_FLAGS`、customEnv 組裝增 2 欄）。`pty-manager.ts` / `main.ts` **不用動**（已 spread `...customEnv`）。
- **塔台端（CT-T005 DELEGATE）**：~20 min，改 `SKILL.md` Bash 白名單（行 40-41）+ `auto-session.md`（行 81）+ `yolo-mode.md` 派發模板一致化。
- **Worker 端（CT-T006 DELEGATE）**：~30 min，改 `ct-exec/SKILL.md` Step 8.5（行 285-293）與 Step 11（行 371）為讀 env，移除 config 讀取鏈。`ct-done` 同步。

**BUG-041 推測根因驗證**：四項推測**皆非實然 bug**，實測根因是**規格設計時機差** —— Worker skill v4.2.0 設計時寫「讀 `_tower-config.yaml`」是照當時架構合理選項，但後來的 D062（2026-04-18）把原則改為「Worker 無狀態」，導致現行 skill 與原則出現**應然 vs 實然**落差。修復 = skill 規格同步 D062。

---

## A. Worker 現況盤點（G1）

### A.1 Worker skill 位置

| 檔案 | 路徑 | 行數 |
|------|------|------|
| ct-exec 主檔 | `~/.claude/skills/ct-exec/SKILL.md` | 416 行 |
| ct-exec 參考 | `~/.claude/skills/ct-exec/references/session-guardrails.md` | 未展開（本工單不相關） |
| ct-done 主檔 | `~/.claude/skills/ct-done/SKILL.md` | 未讀（應有對稱 Step 6.5） |

### A.2 Step 8.5 / Step 11 精確行號

**`ct-exec/SKILL.md`**：

| 段落 | 行號 | 內容摘要 |
|------|------|---------|
| Step 8.5 區塊開頭 | 行 269 | `### Step 8.5（必要）：BAT 自動通知 Tower` |
| 環境偵測表 | 行 274-283 | 檢查 `BAT_SESSION` / `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` / `BAT_TOWER_TERMINAL_ID` |
| **config 讀取（違反 D062）** | 行 285-293 | `#### 讀取 auto-session 設定` + 對照表（`off/ask/on/yolo` → 行為） |
| **具體 config 讀取路徑** | 行 287 | `Config 讀取順序：_tower-config.yaml → ~/.claude/control-tower-data/config.yaml → 預設 ask` |
| 執行通知 | 行 295-313 | `node scripts/bat-notify.mjs ... [--submit] ...` |
| 成功回饋 | 行 315-320 | 兩階訊息（`on` / `yolo`） |
| 失敗處理（硬鉤子分流） | 行 322-342 | yolo 失敗阻斷工單、on 失敗降級剪貼簿 |
| 相容性段 | 行 344-349 | 舊版 BAT 降級、非 BAT 跳過 |
| Step 11 區塊開頭 | 行 368 | `### Step 11：收尾後剪貼簿快捷（fallback）` |
| **Step 11 前置條件（再次讀 config）** | 行 370-375 | 判斷 `auto-session: off/ask` 或環境變數缺失時才跑 Step 11 |
| **config 讀取（違反 D062）** | 行 371 | `Step 8.5 被跳過（auto-session: off/ask 或環境變數缺失）` |
| 剪貼簿偵測與寫入 | 行 377-396 | 跨平台 `pwsh` / `clip` / `pbcopy` / `xclip` |

### A.3 Worker 當前 yolo 判斷邏輯（源碼引用）

**違反 D062 的精確原文**（`ct-exec/SKILL.md` 行 285-293）：

```markdown
#### 讀取 auto-session 設定

Config 讀取順序：`_tower-config.yaml` → `~/.claude/control-tower-data/config.yaml` → 預設 `ask`。

| auto-session 值 | 行為 |
|----------------|------|
| `off` / `ask` | 跳過 Step 8.5 整段（等同環境偵測失敗路徑） |
| `on` | 執行 `bat-notify.mjs`（**不加** `--submit`） |
| `yolo` | 執行 `bat-notify.mjs --submit` |
```

**關鍵問題**：
1. Worker 被明確要求**主動讀檔**（`_tower-config.yaml`），違反 D062「Worker 應為無狀態」原則
2. fallback 路徑（global config）是同類違規的第二層
3. Step 11 行 371 再次引用同一讀取來源，形成雙重依賴

### A.4 BUG-041 推測根因驗證

| 推測 | BUG-041 描述 | 驗證結論 |
|------|------------|---------|
| **1** | `/ct-exec` Worker skill 未讀 project `_tower-config.yaml` | ❌ 錯誤 —— skill 規格**明寫**要讀，且本專案 `_tower-config.yaml` 確實存在（`auto-session: yolo`） |
| **2** | Worker 讀 global `~/.claude/control-tower-data/config.yaml`（通常沒改過） | ⚠️ 部分正確 —— 規格寫 global 為 fallback，但本專案 project config 已設 yolo，應該讀得到，**不應 fallback** |
| **3** | Worker 依賴環境變數（例：`CT_AUTO_SESSION`）但塔台派發未注入 | ❌ 錯誤 —— 現行 skill 規格**沒要求讀 env**，這是**應然的方向**而非**實然的 bug** |
| **4** | Worker 讀 config 但欄位名解析錯誤（`auto_session` underscore vs `auto-session` dash） | ❌ 錯誤 —— project config 與 skill 規格都用 `auto-session`（dash），命名一致 |

**實測根因**（`## 實測根因（T0179 結論）`，BUG-041 檔將追加此區段引用）：

> **時序性規格落差 —— Worker skill v4.2.0（2026-04-18 tag）先寫「讀 config」作為 mode 判斷機制，同日釋出的 D062 決策改為「Worker 無狀態」原則，skill 尚未同步更新。Worker 依現行規格忠實讀 config，但該行為本身違反 D062。** 修復方向不是「讓 Worker 讀對檔」而是「改 skill 規格：不讀 config，改讀塔台注入的 env」。

**輔助觀察**：為何使用者 dogfood 時 Worker 仍走 Step 11 剪貼簿（而非 Step 8.5 `--submit`）？

檢查 `ct-exec/SKILL.md` Step 8.5 的 `#### 環境偵測` 段（行 274-283）：

> 缺任一 → 跳過 Step 8.5 整段，直接跑 Step 11（剪貼簿 fallback）。

本專案觀察到的「Worker 走 Step 11」**不是因為 config 讀錯**，而是可能：
- **假設 1**：Worker sub-session 缺 `BAT_TOWER_TERMINAL_ID`（塔台派發時未帶 `--notify-id`？或帶了但 BAT 未 forward 進 customEnv？— 需 T0180 搭配 AC 驗證）
- **假設 2**：Worker 讀到 config 但 `auto-session: yolo` parse 失敗（yaml 欄位存在性檢查）
- **假設 3**：Worker skill 版本在使用者機器上是 < v4.2.0（Step 8.5 區段不存在）→ 只能走 Step 11

本工單**不深入驗證假設 1-3**（超出研究範圍），留給 T0180 實作時一併觀察。**核心結論不變**：移除 config 讀取、改讀 env，同時解決 D062 違規與 BUG-041 症狀。

---

## B. Flag 傳遞契約（G2 + Q1.A + Q2.C + Q3.C）

### B.1 命名規範

| 項目 | 名稱 | 取值範圍 | 預設 |
|------|------|---------|------|
| **主模式 flag** | `--mode <value>` | `yolo` / `ask` / `off` / `on` | 不傳 → Worker 讀 env 失敗 → fallback `ask` + 升級提示 |
| **主模式 env** | `CT_MODE` | 同上四值 | 未設 → Worker 當 `ask` |
| **互動旗標 flag** | `--interactive` / `--no-interactive` | boolean（存在即 true / `--no-interactive` 明示 false） | 不傳 → `CT_INTERACTIVE` 未設 |
| **互動旗標 env** | `CT_INTERACTIVE` | `1` / `0` / 未設 | 未設 → Worker 按工單 `research_interaction` 欄位決策（現有邏輯） |

**為何 `--interactive` 與 `CT_INTERACTIVE` 獨立**（Q2.C 決策理由）：
- 關注點分離：主模式（自動化程度）與互動允許度是**正交**概念
- 未來擴充零成本：再加 `--dry-run` / `--verbose` 等 modifier 都用同樣 pattern
- 除錯友善：`printenv | grep CT_` 一眼看出三個獨立開關
- 塔台側邏輯清晰：`yolo` 模式下預設 `--interactive`（研究型工單仍可問），`yolo --no-interactive` 則為「嚴格自動化，禁止 Worker 提問」（G3 旗標的典型應用）

### B.2 完整派發鏈路

```
[塔台 session]
  讀 project _tower-config.yaml → auto-session: yolo
  讀 session 互動旗標記憶體變數 → allow_worker_interactive: true
  ↓
[塔台 Bash 執行白名單指令]
  node scripts/bat-terminal.mjs
    --notify-id $BAT_TERMINAL_ID
    --workspace "$BAT_WORKSPACE_ID"
    --mode yolo
    --interactive
    claude "/ct-exec T0180"
  ↓
[bat-terminal.mjs]
  parse args → mode='yolo', interactive=true
  組裝 invokePayload.customEnv = {
    BAT_TOWER_TERMINAL_ID: $notifyId,
    CT_MODE: 'yolo',
    CT_INTERACTIVE: '1'
  }
  WebSocket invoke → terminal:create-with-command
  ↓
[electron/main.ts 行 1558-1566]
  registerHandler('terminal:create-with-command', (_ctx, opts) => {
    ptyManager.create({
      ...
      customEnv: opts.customEnv,  // ← 已存在、無須改
      workspaceId: opts.workspaceId
    })
  })
  ↓
[electron/pty-manager.ts 行 408-474 / 529-552]
  三處 env 組裝區塊均已 `...customEnv` spread（T0176 DONE）
  → 新 PTY 的 process.env 含 CT_MODE / CT_INTERACTIVE
  ↓
[Worker sub-session - claude CLI]
  /ct-exec T0180 啟動
  ct-exec skill Step 8.5 讀 process.env.CT_MODE
  判斷：'yolo' → 執行 bat-notify.mjs --submit
  判斷：'on' → bat-notify.mjs（不加 --submit）
  判斷：'ask'/'off' 或 undefined → 跳過 Step 8.5 → Step 11
```

**關鍵觀察**：派發鏈**不動 `pty-manager.ts` / `main.ts`**，只補 `bat-terminal.mjs` 的 flag 解析與 customEnv 組裝。這是借力 T0176 已建立的 `...customEnv` spread 架構。

### B.3 Worker 讀取邏輯（CT-T006 規格指引）

虛擬碼（實際實作 by CT-T006）：

```
function detect_mode():
  const mode = process.env.CT_MODE
  if mode is undefined or empty:
    # Q3.C: 嚴格 + 升級提示
    display("⚠️ 塔台未傳 --mode flag，可能版本過舊（< v4.3.0），本 session 以 ask 模式執行")
    return 'ask'
  if mode not in ['yolo', 'ask', 'off', 'on']:
    display("⚠️ CT_MODE='<value>' 不合法，fallback ask")
    return 'ask'
  return mode

function detect_interactive(workorder):
  const env = process.env.CT_INTERACTIVE
  if env == '0':
    return false  # 塔台明確禁止
  if env == '1':
    return true   # 塔台明確允許
  # env 未設：按工單 research_interaction 決策（現有邏輯）
  return workorder.metadata['互動模式'] == 'enabled'
```

**嚴格禁令**（規格層面）：
- Worker **不得**讀 `_tower-config.yaml` 作 mode 決策
- Worker **不得**讀 `~/.claude/control-tower-data/config.yaml` 作 mode 決策
- 讀 config 的僅限於 worker-specific 設定（例：`worker_max_retries`、`worker_commit`），這些是 Worker 執行參數不是 runtime context

### B.4 允許值列表與 fallback

| 情境 | `CT_MODE` 值 | Worker 行為 | 提示訊息 |
|------|------------|------------|---------|
| 新塔台 + yolo | `yolo` | Step 8.5 跑 `--submit` | `📡 已通知塔台（YOLO 模式自動送出）` |
| 新塔台 + on | `on` | Step 8.5 跑（不加 `--submit`） | `📡 已預填塔台終端（請切回塔台按 Enter 送出）` |
| 新塔台 + ask | `ask` | 跳過 Step 8.5 → Step 11 | `📋 回塔台回報時輸入：T#### 完成` |
| 新塔台 + off | `off` | 跳過 Step 8.5 → Step 11 | 同 ask |
| 舊塔台（未傳 flag） | `undefined` | fallback ask + 升級提示 | `⚠️ 塔台未傳 --mode flag...` |
| 非 BAT 環境 | 任意 | 環境偵測失敗 → 跳 Step 11 | 現有行為 |

### B.5 向下相容性

**矩陣**（新舊塔台 × 新舊 BAT × 新舊 Worker skill）：

| 塔台 | BAT | Worker skill | 行為 | 備註 |
|------|-----|-------------|------|------|
| 新（傳 flag） | 新（解析 flag） | 新（讀 env） | ✅ yolo 全鏈路自動化 | 理想情境 |
| 新（傳 flag） | **舊**（不認 flag） | 任意 | ❌ `bat-terminal.mjs` exit 1（unknown option） | **升級前阻斷**，使用者需升級 BAT |
| **舊**（不傳 flag） | 新 | 新（讀 env） | ⚠️ Worker 讀不到 env → fallback ask + 升級提示 | Q3.C 設計的主要保護情境 |
| **舊**（不傳 flag） | 新 | **舊**（讀 config） | ⚠️ 現狀延續（BUG-041 症狀） | 使用者未升級任何一側 |
| 新（傳 flag） | 新 | **舊**（讀 config） | ⚠️ Worker 忽略 env，仍讀 config；若 config 與 env 一致則可用 | 不穩但非破壞 |

**關鍵升級順序建議**：**BAT 先升級** → **Worker skill 升級** → **塔台 skill 升級**。理由：
1. BAT 不升級會阻斷新塔台派發（硬失敗）
2. Worker skill 升級後即使塔台沒升仍有升級提示保護（軟失敗）
3. 塔台 skill 升級是最後一步 —— 它會開始傳新 flag，此時 BAT + Worker 都應該就位

**CLI exit code 處理**（BAT 舊版 + 塔台新版）：塔台 SKILL.md 白名單執行 `bat-terminal.mjs` 若 exit 非 0，塔台應偵測錯誤訊息並顯示：

```
⚠️ BAT 版本過舊，不認得 --mode flag
   建議：升級 BAT ≥ vX.X.X，或暫時手動開新 session 執行：
   claude "/ct-exec T####"
```

---

## C. 塔台 session 互動旗標（G3）

### C.1 旗標儲存位置與生命週期

| 屬性 | 設計 |
|------|------|
| **儲存位置** | **塔台 session 記憶體變數**（不寫檔） |
| **key 名** | `session.allow_worker_interactive`（或等價變數名，由塔台 skill 自選） |
| **生命週期** | 塔台 session 啟動至關閉；**不跨 session**（下次啟動重問） |
| **重啟行為** | 塔台偵測 `auto-session: yolo` → 再次問使用者 [A] 允許 / [B] 不允許 |
| **預設** | 無預設 —— `auto-session: yolo` 啟用時**強制詢問一次**（跳過即為拒答，視同不允許） |

**為何不落盤**（設計理由）：
1. 使用者心情會變 —— 今天可能允許互動、明天想嚴格自動化
2. 避免 staleness —— 跨 session 讀舊設定可能與當下意圖不符
3. 強制對齊 —— yolo 本身就是「使用者主動確認」的模式，每次啟動重問符合 yolo 的明確性精神
4. 簡化實作 —— 不用加新 config 欄位

### C.2 塔台啟動面板 diff 指引

**目標檔案**：`~/.claude/skills/control-tower/references/yolo-mode.md`

**目標段落**：`## 啟動識別` → `### 啟動面板警語`（行 18-30 區域）

**改動方向**（僅標位置與方向，不寫 diff）：

1. **擴充警語面板**：在現有 `⚠️ YOLO MODE ACTIVE` 框底下追加一行「本 session 互動旗標」顯示，例如：
   ```
   ║  Worker 互動：允許 / 不允許（啟動時決定）           ║
   ```

2. **新增啟動流程段**：在 `### 啟動面板警語` 之後、`### 派發下一張時的回報面板` 之前，插入新段 `### 啟動詢問（Q3 G3 新增）`：
   - 規格化「塔台偵測 `auto-session: yolo` → 顯示問題」的觸發時機（啟動 Step 0 環境偵測完成後、主面板顯示前）
   - 規格化問題文字（例：「本 session 是否允許 Worker 在研究型工單中向你提問？[A] 允許 / [B] 不允許」）
   - 規格化記憶體變數命名（`session.allow_worker_interactive`）
   - 規格化與派發指令的組合（`--interactive` flag 由此變數決定）

3. **同步派發面板**：修改 `### 派發下一張時的回報面板`（行 38-48 區域），在 `依據：` 之前加入 `互動：<允許/不允許>` 欄位，讓使用者時時可見當前旗標狀態。

**不需改動的段落**：
- `## 3 斷點判準`（A/B/C 機制與互動旗標正交）
- `## _tower-state.md 新增 ## YOLO 歷程區段`（歷程紀錄不影響旗標本身）
- `## 失敗硬鉤子語意對齊`

### C.3 旗標與 `CT_MODE` 組合規則

**塔台派發指令組裝邏輯**（規格層面，不寫實際 diff）：

```
function build_dispatch_command(workorder, session):
  cmd = [
    'node', 'scripts/bat-terminal.mjs',
    '--notify-id', '$BAT_TERMINAL_ID',
    '--workspace', '"$BAT_WORKSPACE_ID"',
    '--mode', session.auto_session_value  # yolo/ask/off/on
  ]

  if session.allow_worker_interactive == true:
    cmd.append('--interactive')
  elif session.allow_worker_interactive == false:
    cmd.append('--no-interactive')
  # 若使用者跳過啟動詢問（undefined）→ 不加任何 interactive flag
  # → Worker 環境 CT_INTERACTIVE 未設 → 按工單 research_interaction 決策

  cmd.extend(['claude', f'"/ct-exec {workorder.id}"'])
  return ' '.join(cmd)
```

**邊界情境**：

| session.allow_worker_interactive | auto-session | Worker 實際互動行為 |
|---------------------------------|-------------|-------------------|
| `true` | `yolo` | 研究型工單 → 啟用互動區段（按工單 `research_interaction`） |
| `false` | `yolo` | 即使工單標 `research_interaction: true`，Worker 也**不互動**（CT_INTERACTIVE=0 覆蓋） |
| `undefined`（使用者跳過） | `yolo` | Worker 按工單 `research_interaction` 現有邏輯 |
| 任意值 | `on`/`ask`/`off` | 同左側（interactive 不限於 yolo 模式，未來可推廣） |

---

## D. 替代方案評估（G4）

| 方案 | 實作複雜度 | 向下相容 | 安全邊界 | Bash 白名單契合度 | 推薦度 |
|------|----------|---------|---------|----------------|-------|
| **A. env 注入（bat-terminal.mjs customEnv）** | **🟢 低**（改 1 檔 ~30 min） | 🟢 好（Q3.C 保護） | 🟢 高（env 只對該 PTY 子孫可見） | 🟢 完美（延續 `--notify-id`/`--workspace` pattern） | **⭐⭐⭐⭐⭐** |
| B. stdin pipe（塔台派發後對 Worker stdin 注入指令） | 🔴 高（需改 claude CLI 或包裝腳本） | 🔴 差（破壞 CLI 輸入契約） | 🟡 中（污染 Worker 首行輸入） | 🔴 差（白名單需加「管線注入」危險例外） | ⭐ |
| C. URL query in slash command（`/ct-exec T0179?mode=yolo`） | 🟡 中（需改 skill API + claude CLI 解析） | 🟡 中（舊 claude CLI 視為工單編號一部分） | 🟢 高（純指令層傳遞） | 🟡 中（白名單需放寬 T#### 字元類） | ⭐⭐ |
| D. 共享 marker file（PTY 啟動前寫 `.ct-mode` 檔，Worker 讀） | 🔴 高（需協定啟動順序 + race condition 處理） | 🔴 差（需清理舊檔機制） | 🔴 差（其他 process 可讀寫） | 🔴 差（白名單需加檔案操作） | ⭐ |
| E. 派發訊息預填 prompt（Worker skill 解析 system prompt） | 🔴 高（需改 claude CLI 或 skill 層） | 🟡 中 | 🟡 中 | 🔴 差 | ⭐ |

### D.1 方案 A 詳述（推薦）

**實作路徑**：
1. `bat-terminal.mjs` 行 71 的 `KNOWN_FLAGS` 陣列加入 `'--mode'` / `'--interactive'` / `'--no-interactive'`
2. 行 117-175 的 state machine 追加三個 flag 處理分支
3. 行 389-393 的 `invokePayload.customEnv` 組裝加入 `CT_MODE` / `CT_INTERACTIVE` 欄位
4. `pty-manager.ts` / `main.ts` **零改動**（`...customEnv` spread 已就位）

**優點**：
- 借力 T0176 已建立的 `BAT_WORKSPACE_ID` 注入架構（同一 pattern、同一檔案、同一 spread 機制）
- env 生命週期 = PTY 生命週期，無手動清理負擔
- BAT 既有 flag 解析有 `levenshtein` suggestion（行 88-95）→ 使用者打錯 `--moed` 會得到提示，DX 好
- 完全符合 D062「explicit 傳遞」原則

**缺點**：
- env 無法在 PTY 建立後更新（使用者中途改 config 不生效）—— 但這**正是 D062 所要的**（工單派發後設定凍結）
- heartbeat recovery 重建 PTY 時 env 可能丟失（T0175 § 五 已記錄此類問題，T0180 實作時建議納入 AC 驗證）

### D.2 方案 B 詳述（不推薦）

**想法**：塔台派發時先 spawn Worker claude CLI，再透過 stdin pipe 下一條 `set CT_MODE=yolo` 類指令。

**致命問題**：
- Claude CLI 的 stdin **是使用者輸入**，塔台寫入會被視為 prompt 訊息發送給 LLM
- 無法區分「環境設定」與「使用者問題」
- 破壞 Unix 管線語意

**排除理由**：技術契約衝突，無論多少工程補償都會留下設計異味。

### D.3 方案 C 詳述（備案）

**想法**：派發指令改為 `/ct-exec T0179 mode=yolo interactive=true`，Worker skill 解析 `$ARGUMENTS`。

**分析**：
- 技術可行 —— `$ARGUMENTS` 本就是 skill 約定的參數傳遞機制
- 但 **Worker 的 `$ARGUMENTS` 由使用者（或塔台）顯式給定，每個 skill 自行解析** → 每次新增 mode 要改 skill 解析邏輯
- 與方案 A 比較：A 的 env 是**系統層注入**，C 的 query string 是**語意層注入**，後者耦合到 skill 內部解析，抽象層次較低
- 白名單字元類需放寬（`T####` 正則要加 `[=&a-z]` 等）→ 防注入邊界變寬

**結論**：可作為 A 的**備案**（若 env 注入鏈在某些環境失效 —— 例如非 BAT session 走外部終端機時），但不作為主線。

### D.4 方案 D / E（快速排除）

- **D. 檔案 marker**：race condition 風險、清理負擔、跨 process 不受控，淘汰
- **E. Prompt 預填**：改 claude CLI 或 skill 層成本遠高於 A，淘汰

---

## E. 實作建議（G5）

> 僅列檔案位置與改動方向，**不寫實際 diff**。實際 diff 由後續工單 Worker 撰寫。

### E.1 T0180 — BAT 端 `--mode` / `--interactive` flag 接收與 env 注入

**修改檔案**：`scripts/bat-terminal.mjs`（唯一檔）

**改動方向**：

1. **行 71 `KNOWN_FLAGS`**：陣列加入 `'--mode'`、`'--interactive'`、`'--no-interactive'`
2. **行 52-69 `HELP_TEXT`**：更新 Options 區段說明三個新 flag，補 Examples 示範 `--mode yolo --interactive` 組合
3. **行 120-123 變數宣告**：
   - 新增 `let mode = null`
   - 新增 `let interactive = null`（`null` / `true` / `false` 三態：明示允許 / 明示禁止 / 未指定）
4. **行 125-175 state machine**：
   - 新增分支處理 `--mode <value>`（需校驗 `value ∈ {yolo, ask, off, on}`，不合法 exit 1 + 錯誤訊息）
   - 新增分支處理 `--interactive`（設 `interactive = true`）
   - 新增分支處理 `--no-interactive`（設 `interactive = false`）
5. **行 389-393 `invokePayload.customEnv`**：擴充組裝邏輯
   - `if (mode) invokePayload.customEnv = { ...invokePayload.customEnv, CT_MODE: mode }`
   - `if (interactive === true) ... CT_INTERACTIVE: '1'`
   - `if (interactive === false) ... CT_INTERACTIVE: '0'`
6. **AC 驗證建議**：
   - AC-1：`node scripts/bat-terminal.mjs --mode yolo --interactive claude "/ct-exec T0000"` 啟動的新 PTY `printenv CT_MODE CT_INTERACTIVE` → `yolo` / `1`
   - AC-2：`--mode invalid` → exit 1 + 錯誤訊息
   - AC-3：不傳任何新 flag → 新 PTY 無 `CT_MODE` / `CT_INTERACTIVE`（向下相容）
   - AC-4：`--help` 輸出含三個新 flag 說明
   - AC-5：`npx vite build` 通過（雖然 mjs 不經 vite，但確認無 regression）
   - AC-6：heartbeat recovery 場景下 env 保留（延續 T0175 § 五警示）

**預估工時**：30 min（參考 T0176 同 pattern 6 min，新增 flag 解析稍複雜）

**不改動檔案**：`electron/pty-manager.ts` / `electron/main.ts`（`...customEnv` spread 已就位，零改動）

### E.2 CT-T005 — 塔台 skill DELEGATE

**修改檔案**（分 3 層）：

#### 1. `~/.claude/skills/control-tower/SKILL.md`

- **行 40-41 Bash 白名單**：BAT 內部終端兩行指令尾端補 `--mode <value> [--interactive|--no-interactive]`，規格化派發模板
- **行 44-49 安全邊界**：新增一條規則：「`--mode` 參數值僅允許 `yolo` / `ask` / `off` / `on`（正則 `^(yolo|ask|off|on)$`），防注入」
- **行 599（config 對照表）**：`auto-session` 欄位描述文字可選擇性補充「v4.3.0 起 Worker 無狀態，mode 改由派發指令傳遞」註記

#### 2. `~/.claude/skills/control-tower/references/auto-session.md`

- **行 81**：現有 `--yolo` flag 改為 `--mode yolo`（與本工單推薦命名一致），可加 `--interactive` 補註
- **行 186-192 Bash 白名單段**（與 SKILL.md 同步）
- **新增「Mode 協定」段**：可在 `## 派發後行為` 段之後、`## BAT 內部終端路由` 段之前，插入新段 `## Mode 與互動旗標協定（v4.3.0+）`，規格化：
  - `--mode` flag 四值定義
  - `--interactive` / `--no-interactive` 語意
  - 環境變數對照（`CT_MODE` / `CT_INTERACTIVE`）
  - Worker 側讀取規則（引用 CT-T006 規格）

#### 3. `~/.claude/skills/control-tower/references/yolo-mode.md`

- **行 18-30 啟動面板警語**（依本報告 § C.2 指引）
  - 警語面板加「Worker 互動：允許 / 不允許」欄位
  - 新增 `### 啟動詢問（G3 互動旗標）` 段
- **行 38-48 派發面板**：加 `互動：<允許/不允許>` 欄位
- **行 112（派發指令範例）**：將現有 `bat-terminal.mjs --workspace ... --yolo` 改為 `--mode yolo [--interactive]`

**預估工時**：20 min

**AC 驗證建議**：
- AC-1：塔台 session 啟動時偵測 `auto-session: yolo` → 顯示啟動詢問 → 使用者回答後記憶體變數正確
- AC-2：派發工單時指令含 `--mode yolo --interactive`（或 `--no-interactive`）
- AC-3：`auto-session: on` / `ask` / `off` 時指令含對應 `--mode` 值
- AC-4：派發面板顯示互動旗標當前狀態
- AC-5：使用者跳過啟動詢問時派發指令不含 `--interactive` flag（讓 Worker 按工單決定）

### E.3 CT-T006 — Worker skill DELEGATE（ct-exec + ct-done）

**修改檔案**：

#### 1. `~/.claude/skills/ct-exec/SKILL.md`

- **行 285-293 `#### 讀取 auto-session 設定`**：整段改寫
  - 標題改為 `#### 讀取 CT_MODE env`
  - 移除 `Config 讀取順序：_tower-config.yaml → ~/.claude/control-tower-data/config.yaml → 預設 ask`
  - 新增讀取邏輯（依本報告 § B.3）：讀 `process.env.CT_MODE`、驗證值、fallback `ask` + 升級提示
  - 對照表保留（mode 值 → 行為），但「預設」改為「未設 env → ask + 升級提示」
- **行 371 Step 11 前置條件**：`auto-session: off/ask 或環境變數缺失` 改為 `CT_MODE 為 ask/off 或未設`
- **行 370-375 註釋**：同步為讀 env 語意
- **第二階段 `研究模式偵測` 段（行 53-62）**：`research_interaction` 的判斷邏輯原本是讀 config，應改為優先讀 `CT_INTERACTIVE` env，env 未設才讀工單元資料（依本報告 § B.3）

#### 2. `~/.claude/skills/ct-done/SKILL.md`（未展開但結構對稱）

- 預期有對稱的 Step 6.5 讀 config 段，同樣改為讀 env
- 搜尋關鍵字：`auto-session` / `_tower-config.yaml`

**預估工時**：30 min（含 ct-exec + ct-done 雙檔 + AC 驗證設計）

**AC 驗證建議**：
- AC-1：PTY 環境 `CT_MODE=yolo` → Worker 跑 Step 8.5 `--submit`
- AC-2：PTY 環境 `CT_MODE=on` → Worker 跑 Step 8.5（不加 `--submit`）
- AC-3：PTY 環境 `CT_MODE=ask` 或未設 → 跳 Step 11 剪貼簿
- AC-4：PTY 環境 `CT_MODE` 未設 → 顯示升級提示 `⚠️ 塔台未傳 --mode flag...`
- AC-5：PTY 環境 `CT_INTERACTIVE=0` + 研究型工單 → Worker **不**互動
- AC-6：PTY 環境 `CT_INTERACTIVE=1` + 標準工單 → interactive 不生效（僅研究型受控）
- AC-7：檔案中**無** `_tower-config.yaml` 讀取文字（grep 驗證 D062 落實）

**CT-T006 規格嚴格禁令**（必寫入 skill 規格）：

> **嚴格禁止**：`/ct-exec` 與 `/ct-done` Worker 不得讀取 `_tower-config.yaml` 或 `~/.claude/control-tower-data/config.yaml` 作為 mode 判斷依據。mode 由塔台派單時透過 `CT_MODE` env 顯式傳遞。違反此規則即違反 D062 無狀態原則。
>
> Worker 讀 config 的唯一合法場景：worker-specific 執行參數（`worker_max_retries`、`worker_commit` 等），這些是 Worker 行為調諧，不是 runtime mode context。

---

## F. 風險與待定項

### F.1 已知風險

| 風險 | 等級 | 緩解 |
|------|------|------|
| heartbeat recovery 重建 PTY 時 env 丟失 | 🟡 中 | T0175 § 五已記錄；T0180 AC-6 驗證，若失敗拆 T0181 補 |
| BAT 舊版 + 塔台新版派發阻斷 | 🟡 中 | 塔台 skill 需偵測 `bat-terminal.mjs` exit 非 0 並顯示升級提示（CT-T005 範圍） |
| Worker 舊版 + 塔台新版 → Worker 忽略 env | 🟢 低 | 不 break，只是 BUG-041 症狀延續；使用者自然會升級 |
| `CT_MODE` / `CT_INTERACTIVE` 命名衝突 | 🟢 低 | `CT_*` 前綴受控，grep 全專案無佔用 |
| 非 BAT 環境（外部終端機）如何傳 env | 🟡 中 | 非 BAT 走 `wt -w 0 nt claude` 等路徑，env 傳遞另有機制（shell env inherit），需 CT-T005 規格化派發模板中的 env 組裝方式（例：`CT_MODE=yolo claude "/ct-exec T####"` 前綴） |

### F.2 待使用者決策的 edge case

1. **CT_MODE 值的大小寫處理**：`CT_MODE=YOLO` vs `yolo` 是否都接受？（建議 CT-T006 規格化為「一律 lowercase，不符直接 fallback ask」— 但這是實作細節）

2. **`--interactive` 語意是否要延伸到非研究型工單**？當前規格只影響研究型工單的提問行為；未來若要擴充到標準工單的 F-11 範圍守衛交互，需另開工單討論（非 T0179 範圍）。

3. **舊塔台升級過渡期的 Worker 行為**：Worker 顯示 `⚠️ 塔台未傳 --mode flag` 後，使用者可能**暫時**不想每次都看到 —— 是否要加 `CT_SUPPRESS_UPGRADE_HINT=1` env 讓使用者關掉？（建議 **不加** —— 提示本身是升級壓力，關掉就失去意義）

### F.3 研究過程未涵蓋

- **ct-done/SKILL.md 未展開讀取** —— 推測有對稱 Step 6.5 但未驗證行號，CT-T006 實作時需先 grep 定位
- **main.ts 完整 terminal:create-with-command handler** 未讀完整（只看 grep 結果確認 customEnv forward），T0180 實作前建議 Worker 完整閱讀 main.ts 行 1556-1590 確認無 edge case
- **非 BAT 降級鏈**（auto-session.md 行 163-177）的 env 傳遞機制未規格化 —— CT-T005 實作時需一併考慮（例：`wt` 指令前加 `CT_MODE=yolo` 的 shell 語法）

---

## 附錄：訪談摘要與決策軌跡

**2026-04-18 18:40-18:50 — Worker 互動 3 輪**（依研究模式 `research_interaction: true`、`research_max_questions: 3`）：

| 輪 | 問題 | 使用者答 |
|----|------|---------|
| Q1 | flag 命名策略（`--mode <name>` vs `--yolo` vs 混合） | A（通用 `--mode`）|
| Q1 follow-up | A 選擇下 multi-mode 擴充性是否受限？ | Worker 解析：mode 互斥，modifier 獨立 → A + Q2.C 最佳 |
| Q2 | G3 互動旗標 env 策略（獨立 / 組合 / flag 獨立 env 獨立） | C（flag 獨立、env 獨立） |
| Q3 | D062 fallback 嚴格度（嚴格 / 過渡相容 / 嚴格 + 升級提示） | C（嚴格 + 升級提示） |

**最終方案**：A（`--mode`）+ C（獨立 flag + env）+ C（嚴格 + 升級提示） = 本報告 § B-E 規格主線。

---

## 報告結束

**下一步**（依 BUG-041 Phase 2 計畫）：
1. 本工單 T0179 DONE → commit `docs(ct): T0179 — Worker yolo flag 傳遞協定研究報告 (BUG-041 Phase 2.1)`
2. 塔台依本報告派 **T0180**（BAT 端 `--mode` + `--interactive` flag 實作）
3. T0180 DONE → 塔台派 **CT-T005**（塔台 skill DELEGATE）
4. CT-T005 DONE → 塔台派 **CT-T006**（Worker skill DELEGATE）
5. 三者皆 DONE → BUG-041 FIXED → VERIFY（塔台 dogfood）→ CLOSED
