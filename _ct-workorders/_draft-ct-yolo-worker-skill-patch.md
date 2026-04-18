# Control-Tower-Skill Patch — yolo mode Worker auto-report (W2)

> **狀態**：DRAFT（本地草稿，待上游 COORDINATED 推 `Control-Tower-Skill`）
> **來源**：better-agent-terminal / PLAN-020 / T0167 / T0168 / T0169
> **產出時間**：2026-04-18 (UTC+8)
> **先例**：PLAN-011（BAT routing 上游 PR，結構仿照之）

---

## 背景

### 根因（T0167 §A）

`auto_session: on` 下 Worker→Tower 反向通道機制上全通（env 注入鏈路完整、`BAT_TOWER_TERMINAL_ID` 正確傳到 Worker PTY），但**實務上幾乎沒被觸發**，三個阻斷點：

1. `ct-exec` / `ct-done` Step 8.5 標記為「可選」「靜默跳過」「靜默降級」 → Worker AI 在收尾壓力下容易略過
2. 即使成功呼叫 `bat-notify.mjs`，`pty:write` 不附加 `\r` → 僅「預填」而非「送出」（T0168 已修，加入 `--submit` flag）
3. Step 8.5 無可觀察成功反饋 → 使用者看不到 Step 8.5 是否執行，只看 Step 11 剪貼簿提示

### 前置條件

- **T0168 ✅ DONE**（commit `c4b2a19`）：`scripts/bat-notify.mjs` 新增 `--submit` flag（argv parsing line 88 附近、PTY write line 305 附近），`--submit` 時訊息後附加 `\r` 使目標 PTY 收到 Enter
- **env 注入鏈路**：`pty-manager.ts:410/456/532` 透過 `customEnv` spread 已把 `BAT_TOWER_TERMINAL_ID` 正確注入 Worker PTY（T0167 §A1 / §B1 已驗證）
- **塔台派發指令**：`control-tower/SKILL.md` 白名單已含 `bat-terminal.mjs --notify-id $BAT_TERMINAL_ID`（T0131 / PLAN-011）

### 決策依據

- **D059**：PLAN-020 yolo 模式插隊啟動（PLAN-018 冷凍作為驗證場景）
- **D060**：yolo 下一張工單資訊來源採 Q2.A（研究工單 D 區段），本草稿**不涉及 Q2**（Q2 屬塔台 skill 改動，另由工單 3 規格化）

---

## 目標

讓 `ct-exec` Step 8.5 和 `ct-done` Step 6.5 從「可選/靜默」升級為「**必要鉤子**」，支援三模式分流：

| 模式 | 呼叫 | PTY 行為 | 失敗策略 |
|------|------|---------|---------|
| `off` / `ask` | 跳過 Step 8.5 整段 | — | — |
| `on` | `bat-notify.mjs`（無 `--submit`） | 預填（等使用者按 Enter） | 軟鉤子：降級到剪貼簿 |
| `yolo` | `bat-notify.mjs --submit` | 預填 + `\r` 自動送出 | 硬鉤子：**阻斷工單完成** |

並讓 Step 11（剪貼簿）從「並行執行」降級為「**Step 8.5 失敗時才跑的 fallback**」。

---

## 變更檔案

| 檔案 | 改動範圍 |
|------|---------|
| `~/.claude/skills/ct-exec/SKILL.md` | Step 8.5 段落（line 269-286）；Step 11 段落（line 305-326）補上「fallback」前置條件 |
| `~/.claude/skills/ct-done/SKILL.md` | Step 6.5 段落（等效於 ct-exec Step 8.5） |

**不動**：
- Step 1-7（開工、執行、收尾前置）
- Step 8（反序寫入 + commit）
- Step 9（sprint-status.yaml 更新）
- Step 10（收尾摘要顯示）

---

## Before / After 對照

### 1. `ct-exec/SKILL.md` Step 8.5

**Before**（現狀 line 269-286）：

```markdown
### Step 8.5（可選）：BAT 自動通知 Tower

若偵測到 `BAT_TOWER_TERMINAL_ID` 環境變數（表示由 BAT 內的 Tower 派發）：

1. 執行通知：
   ```bash
   node scripts/bat-notify.mjs "T#### 完成"
   ```
2. 通知效果：
   - Tower 終端輸入行預填 `T#### 完成`（使用者按 Enter 送出）
   - BAT UI 顯示 Toast 通知 + Tab badge
3. 環境變數不存在時：靜默跳過（非 BAT 環境或非 Tower 派發）
4. 執行失敗時：靜默降級（log warning，不影響工單完成)

依完成狀態決定通知訊息：
- `DONE` → `T#### 完成`
- `PARTIAL` → `T#### 部分完成`
- `FAILED` / `BLOCKED` → `T#### 需要協助`
```

**After**：

```markdown
### Step 8.5（必要）：BAT 自動通知 Tower

> **硬鉤子語意**：本 step 依 `auto-session` config 決定行為與失敗策略，非可選。

#### 環境偵測（依序檢查，任一缺失即跳過整段）

| 環境變數 | 用途 | 缺失行為 |
|---------|------|---------|
| `BAT_SESSION=1` | 判定 BAT 內部終端環境 | 跳過（非 BAT 環境，沿用現狀） |
| `BAT_REMOTE_PORT` | WebSocket 連線埠 | 跳過 + 顯示 `ℹ️ 非 BAT 環境，跳過 Step 8.5`  |
| `BAT_REMOTE_TOKEN` | auth token | 跳過 + 同上 |
| `BAT_TOWER_TERMINAL_ID` | 回 notify 目標塔台 terminal id | 跳過 + 同上 |

**缺任一 → 跳過 Step 8.5 整段，直接跑 Step 11（剪貼簿 fallback）**。

#### 讀取 auto-session 設定

Config 讀取順序：`_tower-config.yaml` → `~/.claude/control-tower-data/config.yaml` → 預設 `ask`。

| auto-session 值 | 行為 |
|----------------|------|
| `off` / `ask` | 跳過 Step 8.5 整段（等同環境偵測失敗路徑） |
| `on` | 執行 `bat-notify.mjs`（**不加** `--submit`） |
| `yolo` | 執行 `bat-notify.mjs --submit` |

#### 執行通知

狀態訊息對照表（**字串固定，不可自由發揮**，為塔台斷點 A 判準）：

| 完成狀態 | 通知訊息 |
|---------|---------|
| `DONE` / `FIXED` | `T#### 完成` |
| `PARTIAL` | `T#### 部分完成` |
| `FAILED` / `BLOCKED` | `T#### 需要協助` |

執行指令：

```bash
node scripts/bat-notify.mjs \
  --source "T####" \
  --target "$BAT_TOWER_TERMINAL_ID" \
  [--submit] \
  "T#### <狀態>"
```

#### 成功回饋（**必須顯示，非靜默**）

| 模式 | 訊息 |
|------|------|
| `on` | `📡 已預填塔台終端（請切回塔台按 Enter 送出）` |
| `yolo` | `📡 已通知塔台（YOLO 模式自動送出）` |

#### 失敗處理（依 auto-session 分流）

| 模式 | 失敗行為 |
|------|---------|
| `on` | **軟鉤子**：顯示 `⚠️ bat-notify 執行失敗：<reason>，降級到剪貼簿`，繼續 Step 11，工單仍視為完成 |
| `yolo` | **硬鉤子**：**阻斷工單完成**（不寫 DONE），顯示 `🚨 YOLO 模式下 bat-notify 失敗：<reason>`，等待使用者介入 |

**硬鉤子 yolo 的理由**：yolo 模式下塔台期待 Worker 自動送出觸發下一步，若 bat-notify 失敗但工單標 DONE，塔台會以為 Worker 沒動作，陷入死鎖。阻斷 + 要求介入比「靜默完成」對使用者更友善。

#### 相容性

- **舊版 BAT（`bat-notify.mjs` 無 `--submit` flag）**：yolo 模式偵測 flag 不支援 → 降級為 on 行為 + 顯示 `⚠️ BAT 版本過舊，yolo 降級為 on（請升級 BAT ≥ PLAN-020 W1）`
  - 偵測方式：執行 `node scripts/bat-notify.mjs --help` 檢查輸出是否含 `--submit`，或直接試跑並觀察 exit code
- **非 BAT 環境**（`BAT_SESSION` 未設）：整段跳過，由 Step 11 接手
- **T0168 已於 commit `c4b2a19` 實作 `--submit`**，本 skill patch 僅在該 commit 之後的 BAT 版本才完整啟用 yolo
```

---

### 2. `ct-exec/SKILL.md` Step 11（降級為 fallback）

**Before**（現狀 line 305-326）：

```markdown
### Step 11：收尾後剪貼簿快捷

工單狀態更新後，自動將回報文字寫入剪貼簿：
... （寫入邏輯 + 跨平台偵測） ...
```

**After**（新增前置條件 + 邏輯不變）：

```markdown
### Step 11：收尾後剪貼簿快捷（fallback）

> **前置條件**：僅在以下任一情境執行：
> 1. Step 8.5 被跳過（`auto-session: off/ask` 或環境變數缺失）
> 2. Step 8.5 執行失敗且模式為 `on`（軟鉤子降級）
> 3. `yolo` 模式下 Step 8.5 失敗時**不執行** Step 11（硬鉤子已阻斷工單，使用者需自行決策是否要剪貼簿降級）

工單狀態更新後，自動將回報文字寫入剪貼簿：
... （現狀寫入邏輯 + 跨平台偵測保留不動） ...
```

**理由**：避免 Step 8.5 和 Step 11 同時執行造成「塔台收到通知 + 使用者剪貼簿也有文字」的重複狀態；yolo 失敗不跑 Step 11 則是為了讓使用者聚焦在「為何 yolo 沒送出」，而非被剪貼簿降級誤導。

---

### 3. `ct-done/SKILL.md` Step 6.5（對稱改動）

**Before**（現狀 ct-done SKILL.md Step 6.5，內容與 ct-exec Step 8.5 完全相同）：

```markdown
### Step 6.5（可選）：BAT 自動通知 Tower

若偵測到 `BAT_TOWER_TERMINAL_ID` 環境變數（表示由 BAT 內的 Tower 派發）：
... （同 ct-exec Step 8.5 舊版邏輯） ...
```

**After**：

- 替換為 ct-exec Step 8.5 **After** 的完整內容（section 標題改為 `### Step 6.5（必要）：BAT 自動通知 Tower`）
- 其他段落保持一致：環境偵測、auto-session 讀取、訊息對照表、成功回饋、失敗處理、相容性

**對稱理由**：`ct-exec` 為正常收尾路徑，`ct-done` 為補救收尾路徑（session 中斷恢復、AI 未收尾、手動標記）。yolo 模式下兩條路徑**都須**自動送出，否則補救場景會重現 T0167 §A 的「機制通但實務不觸發」困境。

---

## 分流邏輯（auto-session 三模式）

```
Worker 進入收尾階段 (Step 8.5 / Step 6.5)
  │
  ├─ 檢查 BAT 環境變數 (BAT_SESSION / PORT / TOKEN / TOWER_TERMINAL_ID)
  │   └─ 任一缺失 → 跳過 Step 8.5 → 直跑 Step 11 剪貼簿
  │
  └─ 讀取 auto-session config
      │
      ├─ off / ask → 跳過 Step 8.5 → 直跑 Step 11 剪貼簿
      │
      ├─ on → bat-notify.mjs (無 --submit)
      │       ├─ 成功 → 顯示 📡 預填訊息 → 不跑 Step 11（避免重複）
      │       └─ 失敗 → 軟鉤子：顯示 ⚠️ + 跑 Step 11 fallback → 工單標 DONE
      │
      └─ yolo → bat-notify.mjs --submit
              ├─ 成功 → 顯示 📡 YOLO 訊息 → 不跑 Step 11
              ├─ 失敗（--submit 不支援） → 降級為 on 行為 + 顯示 ⚠️ 版本警告
              └─ 失敗（其他原因） → 硬鉤子：顯示 🚨 + 阻斷工單（不寫 DONE） + 等使用者介入
```

---

## 失敗處理策略（軟鉤子 vs 硬鉤子）

| 模式 | 失敗行為 | 工單狀態 | 理由 |
|------|---------|---------|------|
| `on` | log warning + fallback 到剪貼簿 | 仍標 DONE | 軟鉤子：使用者回塔台仍可手動貼上訊息，流程不中斷 |
| `yolo` | 阻斷工單完成 + 顯示錯誤 + 等待介入 | **不寫 DONE**（停在 IN_PROGRESS） | 硬鉤子：yolo 期待塔台自動下派下一張工單，若 Worker 靜默標 DONE 而 bat-notify 失敗，塔台不會收到觸發訊號，陷入「Worker 以為完成、塔台以為未動」的死鎖 |

**硬鉤子介入流程**（yolo 失敗時）：

```
🚨 YOLO 模式下 bat-notify 執行失敗
   原因：<reason>
   工單狀態保持 IN_PROGRESS

後續建議：
[A] 使用者切回塔台，手動輸入「T#### 完成」觸發下一張
[B] 檢查 BAT 環境（RemoteServer 是否運行、token 是否有效）
[C] 降級：回答 "fallback"，Worker 將跑 Step 11 剪貼簿並標 DONE
```

---

## 使用者可見訊息（規格化）

### 成功訊息

| 模式 | 訊息 | 顯示時機 |
|------|------|---------|
| `on` | `📡 已預填塔台終端（請切回塔台按 Enter 送出）` | Step 8.5 / 6.5 bat-notify 退出碼 0 後 |
| `yolo` | `📡 已通知塔台（YOLO 模式自動送出）` | Step 8.5 / 6.5 bat-notify --submit 退出碼 0 後 |

### 警告訊息

| 情境 | 訊息 |
|------|------|
| 非 BAT 環境 | `ℹ️ 非 BAT 環境，跳過 Step 8.5（由 Step 11 剪貼簿接手）` |
| `on` 失敗 | `⚠️ bat-notify 執行失敗：<reason>，降級到剪貼簿` |
| `yolo` --submit 不支援 | `⚠️ BAT 版本過舊（bat-notify.mjs 無 --submit），yolo 降級為 on。請升級 BAT ≥ PLAN-020 W1（commit c4b2a19）` |

### 錯誤訊息（yolo 硬鉤子）

```
🚨 YOLO 模式下 bat-notify 失敗：<reason>
   工單狀態保持 IN_PROGRESS

後續建議：
[A] 切回塔台手動輸入「T#### 完成」
[B] 檢查 BAT 環境變數與 RemoteServer 狀態
[C] 回答 "fallback" 降級為剪貼簿
```

---

## 四種狀態字串（塔台斷點 A 判準）

**以下四個字串固定，Worker skill 不可自由發揮**（為塔台 `control-tower` skill 斷點 A 的機械比對依據，見 T0167 §C3）：

| Worker 完成狀態 | 通知字串 |
|---------------|---------|
| `DONE` / `FIXED` | `T#### 完成` |
| `PARTIAL` | `T#### 部分完成` |
| `FAILED` | `T#### 需要協助` |
| `BLOCKED` | `T#### 需要協助` |

其中 `FIXED` 為 BUG 修復工單的完成態（見 `_ct-workorders/_local-rules.md`），在通知字串上與 `DONE` 一致（皆為「完成」），以簡化塔台判準邏輯。

---

## 環境變數依賴清單

Worker 執行 `bat-notify.mjs` 前**須全部確認存在**，任一缺失跳過 Step 8.5 整段：

| 變數 | 來源 | 用途 |
|------|------|------|
| `BAT_SESSION` | BAT 啟動 PTY 時注入（值固定為 `1`） | 判定 BAT 內部終端環境 |
| `BAT_REMOTE_PORT` | BAT RemoteServer 啟動後注入 | WebSocket 連線埠（localhost） |
| `BAT_REMOTE_TOKEN` | BAT RemoteServer 啟動後注入 | auth token（防止誤連其他 BAT instance） |
| `BAT_TOWER_TERMINAL_ID` | 塔台派發時經 `bat-terminal.mjs --notify-id` 傳遞 | 回 notify 目標（塔台自己的 `BAT_TERMINAL_ID`） |
| `BAT_HELPER_DIR`（可選） | BAT 內建路徑 | 若 `scripts/bat-notify.mjs` 不在 cwd，用此路徑 |

**現狀驗證**（T0167 §A1 / §B1）：上述四個核心變數在 `BAT_SESSION=1` 的 Worker session 中均已正確注入，env 注入鏈路本身無改動需求。

---

## 相容性

### BAT 版本

| BAT 版本 | `--submit` 支援 | Skill 行為 |
|---------|----------------|-----------|
| T0168 之前 | ❌ | yolo 降級為 on，顯示版本警告 |
| T0168（commit `c4b2a19`）及以後 | ✅ | yolo 完整支援 |

### 環境

| 環境 | Skill 行為 |
|------|-----------|
| 非 BAT（無 `BAT_SESSION`） | Step 8.5 整段跳過，Step 11 接手（沿用現狀） |
| BAT 外部終端（`BAT_SESSION=1` 但為使用者手動 spawn） | 仍可運作（env 變數仍注入），行為同 BAT 內部終端 |
| WSL / Remote-SSH | 依是否有 `BAT_SESSION` 判定（目前 BAT 只在 Windows/macOS 原生運作，WSL 需進一步測試） |

### 向後相容

- 既有工單（PLAN-020 前建立，無 `auto-session` 設定）：預設 `ask` → 跳過 Step 8.5 → 沿用現狀剪貼簿流程，**零影響**
- Layer 1 唯讀保護：本 patch 僅修改 `~/.claude/skills/ct-exec/SKILL.md` 與 `~/.claude/skills/ct-done/SKILL.md`，不動其他 skill
- control-tower skill 不在本 patch 範圍（由本 PLAN 工單 3 規格化，另產 `_draft-ct-yolo-tower-skill-patch.md`）

---

## 測試建議（留給上游 PR 執行）

### 場景 1：`auto-session: off` 回歸驗證

- 預期：Step 8.5 整段跳過，Step 11 剪貼簿執行
- 驗收：Worker 終端輸出 `📋 已複製「T#### 完成」到剪貼簿`，塔台終端**無**任何訊息預填

### 場景 2：`auto-session: on` 正常路徑

- 預期：Step 8.5 執行 `bat-notify.mjs`（無 `--submit`），Step 11 跳過
- 驗收：
  - Worker 終端顯示 `📡 已預填塔台終端（請切回塔台按 Enter 送出）`
  - 塔台終端輸入行出現 `T#### 完成`（未按 Enter 不會執行）
  - BAT UI 顯示 Toast + Tab badge

### 場景 3：`auto-session: yolo` 正常路徑（需 BAT ≥ T0168）

- 預期：Step 8.5 執行 `bat-notify.mjs --submit`，塔台自動收到並觸發下一輪
- 驗收：
  - Worker 終端顯示 `📡 已通知塔台（YOLO 模式自動送出）`
  - 塔台終端**自動執行** `T#### 完成`（不需使用者按 Enter）
  - 塔台 skill 觸發斷點 A/B/C 檢查並自動派發下一張工單

### 場景 4：`auto-session: on` 失敗軟鉤子

- 觸發方式：關閉 BAT RemoteServer 後 Worker 收尾
- 預期：Step 8.5 失敗，降級到 Step 11 剪貼簿，工單標 DONE
- 驗收：
  - Worker 終端顯示 `⚠️ bat-notify 執行失敗：<reason>，降級到剪貼簿`
  - 剪貼簿含 `T#### 完成`
  - 工單元資料 `狀態: DONE`

### 場景 5：`auto-session: yolo` 失敗硬鉤子

- 觸發方式：同場景 4，但 `auto-session: yolo`
- 預期：Step 8.5 失敗，阻斷工單，**不標 DONE**
- 驗收：
  - Worker 終端顯示 `🚨 YOLO 模式下 bat-notify 失敗` + 3 個後續建議
  - 工單元資料 `狀態: IN_PROGRESS`（未變）
  - Worker 等待使用者輸入（A/B/C）

### 場景 6：BAT 舊版本 yolo 降級

- 觸發方式：Worker 所在 BAT 為 T0168 前版本（無 `--submit`），`auto-session: yolo`
- 預期：偵測到 `--submit` 不支援，降級為 on 行為
- 驗收：
  - Worker 終端顯示 `⚠️ BAT 版本過舊` 警告
  - 實際呼叫退回無 `--submit` 路徑
  - 塔台收到預填但**無** `\r`（需使用者按 Enter）

### 場景 7：非 BAT 環境

- 觸發方式：在一般 terminal（非 BAT）執行 `/ct-exec T####`
- 預期：Step 8.5 整段跳過
- 驗收：Worker 終端顯示 `ℹ️ 非 BAT 環境，跳過 Step 8.5`，Step 11 剪貼簿正常執行

---

## 引用

- **T0167 研究報告**：`_ct-workorders/_report-plan-020-yolo-feasibility.md`
  - §A 根因（env 鏈路通但 skill 語意擋住）
  - §B 技術前置（BAT code ≤ 1h、skill 改動可上游 PR）
  - §D 工單 2（本草稿對應工單）
- **T0168 commit**：`c4b2a19` — `feat(scripts): add --submit flag to bat-notify.mjs (PLAN-020 W1)`
- **D059**：PLAN-020 yolo 模式插隊啟動
- **D060**：yolo 下一張工單資訊來源採 Q2.A（研究工單 D 區段）
- **PLAN-011 先例**：`_ct-workorders/_archive/plans/PLAN-011-ct-bat-routing-upstream-pr.md`（本地 draft → 上游 COORDINATED → CT v4.1.0 發布）

---

## 後續工單

| 工單 | 內容 | 依賴 |
|------|------|------|
| 工單 3 | 本地草稿：塔台 skill 自主決策 + 3 斷點規格（`_draft-ct-yolo-tower-skill-patch.md`） | 工單 2（本草稿） |
| 工單 4 | 上游 COORDINATED：skill 三件套推 `Control-Tower-Skill`（ct-exec / ct-done / control-tower） | 工單 2 + 3 |
| 工單 5 | 本專案驗收：PLAN-018 剩餘工單以 yolo 實跑 | 工單 4 merge 回本機 |
