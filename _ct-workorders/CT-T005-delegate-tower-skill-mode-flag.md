# 工單 CT-T005-delegate-tower-skill-mode-flag

## 元資料
- **工單編號**：CT-T005
- **任務名稱**：【受派】塔台 skill 派發指令加 `--mode` + 啟動詢問面板（BUG-041 Phase 2.4）
- **類型**：implementation (DELEGATE, 跨專案)
- **狀態**：DISPATCHED
- **建立時間**：2026-04-18 19:25 (UTC+8)
- **預估工時**：20 分鐘（依 T0179 報告 E.2 建議）
- **優先級**：🔴 High（BUG-041 修復最後一步；搭配 CT-T006 形成閉環）
- **Renew 次數**：0

## 跨專案協調
- **協調類型**：DELEGATE
- **來源統籌工單**：BUG-041-yolo-mode-worker-side-not-detected（Phase 2.4）
- **來源專案**：better-agent-terminal (`D:\ForgejoGit\BMad-Guide\better-agent-terminal\better-agent-terminal\`)
- **來源 commit 鏈**：
  - `fb1b095` T0179 DONE — 研究報告（§ E.2 權威規格）
  - `8558b73` T0180 DONE — BAT 端 env 注入就位
  - `4dbed7d` CT-T006 DONE — Worker skill 讀 env 就位（v4.3.0）
- **目標專案**：claude-control-tower (`D:\ForgejoGit\BMad-Guide\BMad-Control-Tower\BMad-Control-Tower-v4.2.0\`)
- **目標檔案**：`skills/control-tower/SKILL.md` + `skills/control-tower/references/auto-session.md` + `skills/control-tower/references/yolo-mode.md`
- **建議目標版本**：v4.3.0（延續 CT-T006 同版本，形成 yolo 無狀態化閉環）

> 註：CT-T006 已在 `BMad-Control-Tower-v4.2.0/` 目錄下升級到 v4.3.0（commit `4dbed7d`）。本工單在同目錄繼續升級塔台 skill，commit 接同一 v4.3.0 發布。

---

## 背景

BUG-041 Phase 2 閉環最後一張：
- ✅ Phase 2.1 T0179 研究（`fb1b095`）
- ✅ Phase 2.2 T0180 BAT env 注入（`8558b73`）
- ✅ Phase 2.3 CT-T006 Worker skill 讀 env（`4dbed7d`）
- 🔄 **Phase 2.4（本工單）**：塔台 skill 派發指令加 `--mode` flag + 啟動詢問面板

完成後 BUG-041 → FIXED → VERIFY（塔台 dogfood）→ CLOSED。

---

## 修改規格

> **權威規格來源**：`_ct-workorders/_report-t0179-worker-yolo-flag-protocol.md` § E.2 + § C（G3 互動旗標）
> 本工單所有行號均為 T0179 研究時快照，實作前請先 grep 驗證當前行號。

### A. `skills/control-tower/SKILL.md`

#### A.1 行 40-41 Bash 白名單（BAT 內部終端兩行指令）

**現狀**（CT-T004 v4.2.2 產出）：
```markdown
| BAT 內部終端 | `node scripts/bat-terminal.mjs --notify-id $BAT_TERMINAL_ID --workspace "$BAT_WORKSPACE_ID" claude "/ct-exec T####"` | BAT（BAT_SESSION=1） |
| BAT 內部終端 | `node scripts/bat-terminal.mjs --notify-id $BAT_TERMINAL_ID --workspace "$BAT_WORKSPACE_ID" claude "/ct-done T####"` | BAT（BAT_SESSION=1） |
```

**改為**（加 `--mode <value>` + 可選 `[--interactive|--no-interactive]`）：
```markdown
| BAT 內部終端 | `node scripts/bat-terminal.mjs --notify-id $BAT_TERMINAL_ID --workspace "$BAT_WORKSPACE_ID" --mode <yolo|ask|off|on> [--interactive\|--no-interactive] claude "/ct-exec T####"` | BAT（BAT_SESSION=1） |
| BAT 內部終端 | `node scripts/bat-terminal.mjs --notify-id $BAT_TERMINAL_ID --workspace "$BAT_WORKSPACE_ID" --mode <yolo|ask|off|on> [--interactive\|--no-interactive] claude "/ct-done T####"` | BAT（BAT_SESSION=1） |
```

#### A.2 行 44-49 安全邊界（新增兩條規則）

在既有「`--workspace` 參數值僅允許 `$BAT_WORKSPACE_ID` 環境變數」條款後，追加：

```markdown
- `--mode` 參數值僅允許 `yolo` / `ask` / `off` / `on`（正則 `^(yolo|ask|off|on)$`），防注入
- `--interactive` / `--no-interactive` 為 flag（無參數），僅用於研究型工單互動旗標
```

#### A.3 行 599 config 對照表（選擇性註記）

在 `auto-session` 欄位描述文字追加：

> v4.3.0 起 Worker 無狀態，mode 改由派發指令 `--mode` flag 傳遞（見 `references/auto-session.md` § Mode 與互動旗標協定）

此為選擇性改動，若行號位移或對照表結構不同，可改在 config 說明段任何合理位置。

---

### B. `skills/control-tower/references/auto-session.md`

#### B.1 行 81（現有 `--yolo` flag 範例）

將 `--yolo` 改為 `--mode yolo`，補 `--interactive` 範例：

**現狀**：
```
bat-terminal.mjs --notify-id $BAT_TERMINAL_ID --workspace "$BAT_WORKSPACE_ID" --yolo
```

**改為**：
```
bat-terminal.mjs --notify-id $BAT_TERMINAL_ID --workspace "$BAT_WORKSPACE_ID" --mode yolo [--interactive|--no-interactive]
```

#### B.2 行 186-192 Bash 白名單段

與 SKILL.md A.1 同步（兩行範例指令補 `--mode <value>` + 可選 `--interactive`）。

#### B.3 新增「Mode 與互動旗標協定」段

在 `## 派發後行為` 段之後、`## BAT 內部終端路由` 段之前，插入新段：

```markdown
## Mode 與互動旗標協定（v4.3.0+）

塔台派發工單時透過指令 flag + env 顯式傳遞 runtime mode，Worker 不讀 config（D062 無狀態原則落實）。

### Flag 規格

| Flag | 合法值 | 作用 |
|------|-------|------|
| `--mode <value>` | `yolo` / `ask` / `off` / `on` | 指定派發模式，覆蓋 Worker 預設行為 |
| `--interactive` | （無參數） | 允許研究型工單 Worker 互動 |
| `--no-interactive` | （無參數） | 禁止研究型工單 Worker 互動 |

### 環境變數對照

| Env | 來源 | Worker 讀取 |
|-----|------|------------|
| `CT_MODE` | `--mode <value>` | `ct-exec` / `ct-done` Step 6.5 / Step 8.5 分流 |
| `CT_INTERACTIVE` | `--interactive` → `1`; `--no-interactive` → `0` | `ct-exec` 研究模式偵測 |

### Worker 側讀取規則

見 `~/.claude/skills/ct-exec/SKILL.md` § 讀取 CT_MODE env 與 § D062 嚴格禁令。
簡言之：
- `CT_MODE` 未設或不合法 → Worker fallback `ask` + 顯示升級提示
- `CT_INTERACTIVE` 未設 → Worker 尊重工單元資料的 `類型: research` + 工單內互動規則

### 向下相容

舊塔台派發（無 `--mode` flag）時 Worker 顯示升級提示，但不 break。建議使用者同步升級塔台 + Worker skill 至 v4.3.0+。
```

---

### C. `skills/control-tower/references/yolo-mode.md`

#### C.1 行 18-30 啟動面板警語（依 T0179 § C.2）

警語面板加「Worker 互動」欄位。現有範例若為：

```
╔═══════════════════════════════════════════════════════╗
║  🟠 YOLO MODE ACTIVE                                  ║
║  auto-session: yolo | yolo_max_retries: N             ║
║  ...                                                  ║
╚═══════════════════════════════════════════════════════╝
```

改為：

```
╔═══════════════════════════════════════════════════════╗
║  🟠 YOLO MODE ACTIVE                                  ║
║  auto-session: yolo | yolo_max_retries: N             ║
║  Worker 互動：<允許/不允許/未決定>                    ║
║  ...                                                  ║
╚═══════════════════════════════════════════════════════╝
```

#### C.2 新增「啟動詢問（G3 互動旗標）」段

在啟動面板警語段落後新增：

```markdown
### 啟動詢問（G3 互動旗標）

塔台偵測 `auto-session: yolo` 時，在顯示 YOLO MODE ACTIVE 警語後**追加**使用者選擇：

> 「本 session 是否允許 Worker 在研究型工單中向你提問？[A] 允許 [B] 不允許 [C] 跳過（讓 Worker 按工單決定）」

**旗標儲存**：塔台 session 記憶體變數 `session.allow_worker_interactive`，**不落盤**（每次啟動重新問）。

**選項行為**：
- `[A] 允許` → 派發指令加 `--interactive` flag（對應 `CT_INTERACTIVE=1`）
- `[B] 不允許` → 派發指令加 `--no-interactive` flag（對應 `CT_INTERACTIVE=0`）
- `[C] 跳過` → 派發指令**不**加互動旗標（Worker 讀工單元資料）

**生命週期**：本 session 內所有派發都套用此選擇。重新啟動塔台 session 時重新詢問。
```

#### C.3 行 38-48 派發面板

派發面板加 `互動：<允許/不允許/未決定>` 欄位，反映啟動詢問結果。

#### C.4 行 112 派發指令範例

**現狀**：
```
node scripts/bat-terminal.mjs --workspace ... --yolo claude "/ct-exec T####"
```

**改為**：
```
node scripts/bat-terminal.mjs --notify-id $BAT_TERMINAL_ID --workspace "$BAT_WORKSPACE_ID" --mode yolo [--interactive|--no-interactive] claude "/ct-exec T####"
```

---

### D. CHANGELOG 追加

`CHANGELOG.md` 已有 CT-T006 建立的 v4.3.0 區塊。本工單**在同一 v4.3.0 區塊內追加**內容（而非新建版本）：

在既有 v4.3.0 區塊的 `### Changed` 段追加：

```markdown
- **塔台 skill 派發指令加 `--mode` + `--interactive` flag**（BUG-041 Phase 2.4）
  - Bash 白名單兩行 BAT 內部終端派發指令加 `--mode <value> [--interactive|--no-interactive]`
  - 安全邊界新增 `--mode` 值校驗規則（防注入）
  - `references/auto-session.md` 新增「Mode 與互動旗標協定」段規格化 flag + env 對照
  - `references/yolo-mode.md` 啟動面板加「Worker 互動」欄位 + 新增「啟動詢問（G3 互動旗標）」段
```

在 `### Source` 段追加：

```markdown
- CT-T005 跨專案協調工單（DELEGATE，本工單）
- BUG-041 閉環 Phase 2.4
```

---

## 驗收條件 (AC)

- **AC-1**：`skills/control-tower/SKILL.md` Bash 白名單兩行 BAT 指令含 `--mode <value> [--interactive|--no-interactive]`
- **AC-2**：`skills/control-tower/SKILL.md` 安全邊界新增 `--mode` + `--interactive` 相關規則
- **AC-3**：`references/auto-session.md` 新增「Mode 與互動旗標協定」段，含 Flag 規格、Env 對照、Worker 側讀取規則、向下相容說明四小段
- **AC-4**：`references/auto-session.md` 行 81 + 行 186-192 Bash 白名單範例已同步補上 `--mode`
- **AC-5**：`references/yolo-mode.md` 啟動面板加「Worker 互動」欄位
- **AC-6**：`references/yolo-mode.md` 新增「啟動詢問（G3 互動旗標）」段，含選項 A/B/C + 旗標儲存 + 生命週期說明
- **AC-7**：`references/yolo-mode.md` 派發面板 + 派發指令範例已同步
- **AC-8**：CHANGELOG v4.3.0 區塊已擴充（Changed 追加 + Source 追加）
- **AC-9**：`grep -rn "bat-terminal.mjs --notify-id" skills/control-tower/` 所有命中皆已含 `--mode`（零漏網）
- **AC-10**：commit 訊息：`feat(ct): v4.3.0 — 塔台 skill --mode flag + 啟動詢問 (BUG-041 Phase 2.4)`

### AC 驗證策略

與 CT-T006 相同為規格層驗證（跨 repo 工單不啟 runtime）：
- AC-1~AC-8 逐項 grep 驗證，引用精確行號作為證據
- AC-9 為硬性 grep 驗證，必須全部命中含 `--mode`
- AC-10 為 commit log 結構驗證

---

## 研究範圍（實作邊界）

**允許**：
- 讀 `skills/control-tower/SKILL.md` / `references/auto-session.md` / `references/yolo-mode.md` 當前實作（CT-T004 v4.2.2 狀態）
- 讀 better-agent-terminal repo 的 `_ct-workorders/_report-t0179-worker-yolo-flag-protocol.md`（§ E.2 + § C 權威規格）
- 讀本 repo 的 `CHANGELOG.md`（v4.3.0 區塊 CT-T006 已建立）

**禁止**：
- ❌ 改 `skills/ct-exec/SKILL.md` / `skills/ct-done/SKILL.md`（CT-T006 範圍，已完工）
- ❌ 改 better-agent-terminal repo 任何檔案
- ❌ 改 `scripts/bat-terminal.mjs`（T0180 已完工）
- ❌ 新建 v4.3.1 或更新版號（本工單搭 v4.3.0 發布）

---

## 交付規格

### D1. 代碼改動

三個檔案：
- `skills/control-tower/SKILL.md`（A.1 / A.2 / A.3）
- `skills/control-tower/references/auto-session.md`（B.1 / B.2 / B.3）
- `skills/control-tower/references/yolo-mode.md`（C.1 / C.2 / C.3 / C.4）

### D2. CHANGELOG

既有 v4.3.0 區塊擴充（Changed + Source 追加）。

### D3. Commit

單一 commit：
```
feat(ct): v4.3.0 — 塔台 skill --mode flag + 啟動詢問 (BUG-041 Phase 2.4)
```

### D4. Tag

完成後由使用者決定是否 `git tag v4.3.0` + push（若 CT-T006 已打過 v4.3.0 tag，本工單 commit 需打 v4.3.0 重建或 v4.3.1）。

### D5. 回報區填寫

- 修改檔案清單 + 行號
- grep 驗證結果（AC-9 硬驗）
- CHANGELOG 擴充內容貼上
- Commit hash + Tag 狀態

---

## 互動規則

**本工單禁止 Worker 互動**（實作規格已由 T0179 § E.2 + § C 完整提供）：
- 遇到規格不明 → 先讀 `_report-t0179-worker-yolo-flag-protocol.md` § E.2 + § C
- 啟動面板 / 派發面板的原始結構與 T0179 快照不符 → 據實說明並沿用原結構邏輯補欄位，**不**自行重構
- 仍不明 → 停止工作，回塔台（better-agent-terminal 端）討論

---

## 相關單據

- **BUG-041** OPEN：yolo mode Worker 側未偵測（本工單為 Phase 2.4，閉環最後一張）
- **T0179** DONE（`fb1b095`）：Phase 2.1 研究，§ E.2 + § C 為本工單權威規格
- **T0180** DONE（`8558b73`）：Phase 2.2 BAT 端 env 注入
- **CT-T006** DONE（`4dbed7d`）：Phase 2.3 Worker skill 讀 env（同 v4.3.0 發布）
- **CT-T004** DONE（`367b30d`）：v4.2.2 先例（`--workspace` flag）

---

## 備註

- 本工單為**跨專案 DELEGATE**，使用者需手動切換到目標 repo 後派 Worker：
  ```
  cd D:\ForgejoGit\BMad-Guide\BMad-Control-Tower\BMad-Control-Tower-v4.2.0
  # 開新 session 輸入：/ct-exec CT-T005
  ```
- CT-T006 已在同目錄升級到 v4.3.0（`4dbed7d`），本工單 commit 接同一版本發布
- 完成後 BUG-041 → **FIXED** → VERIFY（使用者 dogfood 測試新派發指令 + Worker 讀 env 無錯）→ **CLOSED** → Phase 2 全結案

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 執行摘要

（待填）

### 修改檔案清單

| 檔案 | 行號 | 修改內容 |
|------|------|---------|

### Grep 驗證結果（AC-9 硬驗）

（待填）

### AC 驗收結果

| AC | 結果 | 證據 |
|----|------|------|
| AC-1 | ⬜ | |
| AC-2 | ⬜ | |
| AC-3 | ⬜ | |
| AC-4 | ⬜ | |
| AC-5 | ⬜ | |
| AC-6 | ⬜ | |
| AC-7 | ⬜ | |
| AC-8 | ⬜ | |
| AC-9 | ⬜ | |
| AC-10 | ⬜ | |

### CHANGELOG 擴充貼上

（待填）

### Commit 與 Tag

（待填）

### Renew 歷程

（無）

### DONE 時間

（待填）
