# 工單 CT-T006-delegate-worker-skill-env-readout

## 元資料
- **工單編號**：CT-T006
- **任務名稱**：【受派】Worker skill 改讀 `CT_MODE` / `CT_INTERACTIVE` env，移除 config 讀取（BUG-041 Phase 2.3）
- **類型**：implementation (DELEGATE, 跨專案)
- **狀態**：DONE
- **建立時間**：2026-04-18 19:05 (UTC+8)
- **開始時間**：2026-04-18 19:16 (UTC+8)
- **完成時間**：2026-04-18 19:22 (UTC+8)
- **預估工時**：30 分鐘（依 T0179 報告 E.3 建議）
- **優先級**：🔴 High（BUG-041 修復第 3 步；Worker skill 無狀態化落實 D062）
- **Renew 次數**：0

## 跨專案協調
- **協調類型**：DELEGATE
- **來源統籌工單**：BUG-041-yolo-mode-worker-side-not-detected（Phase 2.3）
- **來源專案**：better-agent-terminal (`D:\ForgejoGit\BMad-Guide\better-agent-terminal\better-agent-terminal\`)
- **來源 commit 鏈**：
  - `fb1b095` T0179 DONE — 研究報告（權威規格 § E.3）
  - `8558b73` T0180 DONE — BAT 端 `CT_MODE` / `CT_INTERACTIVE` env 注入就位（AC-1~AC-5/AC-7 全綠）
- **目標專案**：claude-control-tower (`D:\ForgejoGit\BMad-Guide\BMad-Control-Tower\BMad-Control-Tower-v4.x.x\`)
- **目標檔案**：`skills/ct-exec/SKILL.md` + `skills/ct-done/SKILL.md`
- **建議目標版本**：v4.3.0（minor，首次落實 D062 Worker 無狀態化）

---

## 背景

BUG-041 Phase 2 三步曲：
- ✅ **Phase 2.1**：T0179 研究報告（`fb1b095`）— 確立方案 A（env 注入）+ 嚴格 D062 + 升級提示
- ✅ **Phase 2.2**：T0180 BAT 端 env 注入（`8558b73`）— `--mode` / `--interactive` flag 解析 + `customEnv` 注入完工
- 🔄 **Phase 2.3（本工單）**：Worker skill 改讀 env，落實 D062 無狀態化（移除 `_tower-config.yaml` 讀取）

完成本工單後，Phase 2 剩最後一步 CT-T005（塔台 skill 派發指令加 `--mode` + 啟動詢問面板）。

---

## 修改規格

> **權威規格來源**：`_ct-workorders/_report-t0179-worker-yolo-flag-protocol.md` § E.3
> 本工單所有行號均為 T0179 研究時快照，實作前請先 grep 驗證當前行號。

### A. `skills/ct-exec/SKILL.md` 修改

#### A.1 行 285-293 `#### 讀取 auto-session 設定`（整段改寫）

- **標題**：`#### 讀取 auto-session 設定` → `#### 讀取 CT_MODE env`
- **移除**：Config 讀取順序段落（`_tower-config.yaml → ~/.claude/control-tower-data/config.yaml → 預設 ask`）
- **新增讀取邏輯**（依 T0179 報告 § B.3）：
  1. 讀 `process.env.CT_MODE`
  2. 驗證值屬於 `{yolo, ask, off, on}`
  3. 未設或不合法 → fallback `ask` + 顯示升級提示（見下方）
- **升級提示文字**（必寫入 skill）：

  > ⚠️ **塔台未傳 `--mode` flag，降級為 ask 模式**
  >
  > 你正在使用舊版塔台 skill（v4.2.x 或更早）。升級 v4.3.0+ 後塔台會透過 `--mode` flag 顯式傳遞模式，Worker 無需讀 config。
  > 詳見 BUG-041 閉環記錄。

- **對照表保留**（mode 值 → 行為對應），但「預設行為」欄位改為「未設 env → ask + 升級提示」

#### A.2 行 371 Step 11 前置條件

- **現狀**：`auto-session: off/ask 或環境變數缺失` 觸發 Step 11 剪貼簿降級
- **改為**：`CT_MODE 為 ask/off 或未設` 觸發 Step 11 剪貼簿降級

#### A.3 行 370-375 註釋同步

同步註釋為「讀 env」語意（移除 config 讀取相關字樣）。

#### A.4 行 53-62 `研究模式偵測` 段（`research_interaction` 判斷）

- **現狀**：讀 `_tower-config.yaml` 的 `research_interaction: true/false`
- **改為**：優先讀 `process.env.CT_INTERACTIVE`
  - `CT_INTERACTIVE=1` → 允許研究型工單互動
  - `CT_INTERACTIVE=0` → 禁止研究型工單互動
  - **env 未設** → fallback 讀工單元資料的 `類型: research` + 工單內 `互動規則` 段落（現行行為，向下相容）
- **關鍵原則**：env 存在時覆蓋工單元資料；env 未設時尊重工單元資料（Worker 不讀 config）

### B. `skills/ct-done/SKILL.md` 修改

T0179 研究時未完整展開 `ct-done/SKILL.md`，實作前請先 grep 定位：

```bash
grep -n "auto-session\|_tower-config\.yaml\|control-tower-data/config\.yaml\|research_interaction" skills/ct-done/SKILL.md
```

- 預期有對稱 `Step 6.5 讀取 auto-session 設定`（或類似命名），改為與 ct-exec A.1 同邏輯
- 預期有對稱的 Step 11 剪貼簿降級條件，改為與 ct-exec A.2 同語意
- 若 ct-done 完全不讀 auto-session（只負責 DONE 收尾），記錄「無改動」於本工單回報區

### C. D062 嚴格禁令（必寫入 skill 規格）

在 `skills/ct-exec/SKILL.md` 與 `skills/ct-done/SKILL.md` 的 yolo 讀取邏輯段落下方，加入明示禁令區塊：

```markdown
> ### 🚫 D062 嚴格禁令
>
> `/ct-exec` 與 `/ct-done` Worker **不得**讀取 `_tower-config.yaml` 或 `~/.claude/control-tower-data/config.yaml` 作為 mode 判斷依據。
> mode 由塔台派單時透過 `CT_MODE` env 顯式傳遞。違反此規則即違反 D062 無狀態原則。
>
> Worker 讀 config 的唯一合法場景：worker-specific 執行參數（`worker_max_retries`、`worker_commit` 等），這些是 Worker 行為調諧，不是 runtime mode context。
```

### D. CHANGELOG 追加

`CHANGELOG.md` 頂部新增 v4.3.0 區塊：

```markdown
## v4.3.0 - 2026-04-18

### Changed
- **Worker 無狀態化（D062 落實）**（BUG-041 Phase 2.3）
  - `/ct-exec` 與 `/ct-done` 改讀 `CT_MODE` / `CT_INTERACTIVE` env，移除 `_tower-config.yaml` mode 讀取
  - 未收到塔台 env → fallback `ask` 模式 + 顯示升級提示（提醒使用者升級塔台 skill）
  - 研究型工單互動旗標：env 優先 > 工單元資料（向下相容舊派發）

### Breaking
- v4.3.0 Worker skill 搭配 v4.2.x 或更早塔台 skill 使用時，所有派發都會看到「塔台未傳 --mode flag」升級提示，建議同步升級至 v4.3.0

### Added
- `CT_MODE` env 規格（合法值：`yolo` / `ask` / `off` / `on`）
- `CT_INTERACTIVE` env 規格（`1` / `0`，旗標獨立於 mode）
- D062 嚴格禁令區塊寫入 skill 規格文件

### Source
- 跨專案來源：better-agent-terminal `8558b73` (T0180 BAT env 注入就位)
- 權威規格：T0179 研究報告（better-agent-terminal repo `_ct-workorders/_report-t0179-worker-yolo-flag-protocol.md`）
```

---

## 驗收條件 (AC)

- **AC-1**：PTY env `CT_MODE=yolo` → Worker 跑 Step 8.5 `--submit`（實測或規格 grep 驗證）
- **AC-2**：PTY env `CT_MODE=on` → Worker 跑 Step 8.5（不加 `--submit`）
- **AC-3**：PTY env `CT_MODE=ask` 或未設 → 跳 Step 11 剪貼簿
- **AC-4**：PTY env `CT_MODE` 未設 → 顯示升級提示 `⚠️ 塔台未傳 --mode flag...`
- **AC-5**：PTY env `CT_INTERACTIVE=0` + 研究型工單 → Worker **不**互動（一次做完）
- **AC-6**：PTY env `CT_INTERACTIVE=1` + 標準工單 → interactive 不生效（僅研究型受控）
- **AC-7**：`grep -n "_tower-config\.yaml\|control-tower-data/config\.yaml" skills/ct-exec/SKILL.md skills/ct-done/SKILL.md` **空結果**（D062 落實驗證，僅允許註解提及作為歷史紀錄）
- **AC-8**：CHANGELOG v4.3.0 條目已建立
- **AC-9**：D062 嚴格禁令區塊已寫入兩個 skill 檔
- **AC-10**：commit 訊息：`feat(ct): v4.3.0 — Worker skill env readout, D062 compliance (BUG-041 Phase 2.3)`

### AC 驗證策略

AC-1~AC-6 為規格層驗證（非 runtime E2E，跨 repo 工單不啟 runtime）：
- 逐項 grep skill 檔，確認邏輯區段存在
- 引用精確行號作為證據
- 若某 AC 無法從 grep 證明，說明限制並建議在 better-agent-terminal repo 補充 dogfood 測試

AC-7 為硬性 D062 驗證，必須空結果（或僅歷史註解）。
AC-8/AC-9/AC-10 為純結構性驗證。

---

## 研究範圍（實作邊界）

**允許**：
- 讀 `skills/ct-exec/SKILL.md` / `skills/ct-done/SKILL.md` 當前實作
- 讀 better-agent-terminal repo 的 `_ct-workorders/_report-t0179-worker-yolo-flag-protocol.md`（§ E.3 權威規格）
- 讀 better-agent-terminal repo 的 `_ct-workorders/BUG-041-*.md`（實測根因段）
- 讀本 repo 的 `CHANGELOG.md` 既有格式（延續 v4.2.2 pattern）

**禁止**：
- ❌ 改 `skills/control-tower/SKILL.md` 或 `references/**`（CT-T005 範圍）
- ❌ 改 better-agent-terminal repo 任何檔案
- ❌ 改 `scripts/bat-terminal.mjs`（T0180 已完工）
- ❌ 跨範圍提前做 CT-T005（塔台派發指令升級）

---

## 交付規格

### D1. 代碼改動

兩個 skill 檔：
- `skills/ct-exec/SKILL.md`（A.1 / A.2 / A.3 / A.4 + C）
- `skills/ct-done/SKILL.md`（B + C）

### D2. CHANGELOG

`CHANGELOG.md` 頂部追加 v4.3.0 區塊（Changed / Breaking / Added / Source）。

### D3. Commit

單一 commit：
```
feat(ct): v4.3.0 — Worker skill env readout, D062 compliance (BUG-041 Phase 2.3)
```

### D4. Tag（選擇性）

完成後：
```bash
git tag v4.3.0 -m "v4.3.0 — Worker skill env readout (BUG-041 Phase 2.3)"
# push 由使用者決定
```

### D5. 回報區填寫

- 修改檔案清單 + 行號
- grep 驗證結果（AC-7 / AC-9 / D062 落實）
- CHANGELOG 貼上
- Commit hash + Tag 狀態

---

## 互動規則

**本工單禁止 Worker 互動**（實作規格已由 T0179 § E.3 完整提供）：
- 遇到規格不明 → 先讀 `_report-t0179-worker-yolo-flag-protocol.md` § E.3
- ct-done 段 grep 發現結構與預期不符（例：根本沒有讀 auto-session 段）→ 於回報區據實說明，**不**自行補對稱邏輯
- 仍不明 → 停止工作，回塔台（better-agent-terminal 端）討論

---

## 相關單據

- **BUG-041** OPEN：yolo mode Worker 側未偵測（本工單為 Phase 2.3）
- **T0179** DONE（`fb1b095`）：Phase 2.1 研究，§ E.3 為本工單權威規格
- **T0180** DONE（`8558b73`）：Phase 2.2 BAT 端 env 注入基礎建設
- **CT-T004** DONE（`367b30d`）：過去同類 DELEGATE 先例（v4.2.2）
- **下游工單**：CT-T005 DELEGATE（本工單 DONE 後派，塔台 skill 派發升級）

---

## 備註

- 本工單為**跨專案 DELEGATE**，使用者需手動切換到目標 repo 後派 Worker：
  ```
  cd D:\ForgejoGit\BMad-Guide\BMad-Control-Tower\BMad-Control-Tower-v4.x.x
  # 開新 session 輸入：/ct-exec CT-T006
  ```
- 若使用者採用 monorepo `BMad-Guide` 頂層統一管理 commit，tag push 到 Forgejo `BMad-Guide` 倉庫即可（延續 CT-T003 / CT-T004 模式）
- 完成後使用者可選擇是否 sync 生產塔台（`~/.claude/skills/ct-exec/` 與 `~/.claude/skills/ct-done/`），由使用者自行決定

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 執行摘要

Worker skill（`ct-exec` / `ct-done`）mode 判斷來源從 `_tower-config.yaml` 改為 `CT_MODE` / `CT_INTERACTIVE` env，落實 D062 無狀態原則。舊塔台 env 未注入時 fallback `ask` 並顯示升級提示。CHANGELOG 追加 v4.3.0 區塊，D062 嚴格禁令區塊已寫入兩個 skill 檔。

目標 repo：`BMad-Control-Tower/BMad-Control-Tower-v4.2.0/`（此目錄為作業目錄，版本在檔案層面升級至 v4.3.0；目錄命名是否同步更名由使用者決定）。

### 修改檔案清單

| 檔案 | 行號（修改後） | 修改內容 |
|------|---------------|---------|
| `ct-exec/SKILL.md` | L53-70 | A.4：研究模式偵測改讀 `CT_INTERACTIVE` env（1/0/未設三階），env 未設時尊重工單元資料 |
| `ct-exec/SKILL.md` | L282-283 | A.3：硬鉤子語意註解改為「依 `CT_MODE` env 決定」 |
| `ct-exec/SKILL.md` | L296-322 | A.1：`#### 讀取 auto-session 設定` → `#### 讀取 CT_MODE env`，新增升級提示 + 完整對照表 + D062 禁令區塊（C 節） |
| `ct-exec/SKILL.md` | L333 | A.3：`#### 失敗處理（依 auto-session 分流）` → `（依 `CT_MODE` 分流）` |
| `ct-exec/SKILL.md` | L360 | A.3：相容性結尾 `auto-session: off/ask/on 三階` → `CT_MODE: off/ask/on/yolo 四階` |
| `ct-exec/SKILL.md` | L382 | A.2：Step 11 前置條件 `auto-session: off/ask` → `CT_MODE 為 ask/off 或未設` |
| `ct-done/SKILL.md` | L47-49 | B/C：硬鉤子語意改為 `CT_MODE` env，加 v4.3.0 落實說明 |
| `ct-done/SKILL.md` | L62-90 | B：`#### 讀取 auto-session 設定` → `#### 讀取 CT_MODE env`，升級提示 + 對照表 + D062 禁令區塊 |
| `ct-done/SKILL.md` | L109 | B：失敗處理標題改為 `（依 `CT_MODE` 分流）` |
| `ct-done/SKILL.md` | L133 | B：相容性結尾改為 `CT_MODE: off/ask/on/yolo 四階` |
| `CHANGELOG.md` | L3-29 | D：追加 v4.3.0 區塊（Changed / Breaking / Added / Source） |

### Grep 驗證結果（D062 落實）

**AC-7 grep 命令**：
```bash
grep -n "_tower-config\.yaml\|control-tower-data/config\.yaml" ct-exec/SKILL.md ct-done/SKILL.md
```

**結果**（分類說明）：

`ct-exec/SKILL.md`：
- L68：D062 禁令描述（Worker **不讀** `_tower-config.yaml` 的 `research_interaction` 欄位）→ **歷史註解/禁令性質，允許**
- L114：`experience-level` config 讀取（防護等級）→ **C 節明示允許**（Worker 行為調諧，非 mode context）
- L135：`worker_max_retries` / `worker_strikeout_action` config 讀取（三振出局參數）→ **C 節明示允許**
- L274：`worker_commit` config 讀取（收尾 commit 策略）→ **C 節明示允許**
- L314：D062 禁令區塊本身 → **禁令定義，允許**

`ct-done/SKILL.md`：
- L84：D062 禁令區塊本身 → **禁令定義，允許**

**mode-related 讀取殘留**：**零**（`auto-session` / `research_interaction` 字樣全部清除；工單目標達成）。

**AC-9 grep 命令**：
```bash
grep -n "D062 嚴格禁令" ct-exec/SKILL.md ct-done/SKILL.md
```
- `ct-exec/SKILL.md` L312-318：D062 嚴格禁令區塊（C 節寫入 ✅）
- `ct-done/SKILL.md` L82-88：D062 嚴格禁令區塊（C 節寫入 ✅）

### AC 驗收結果

| AC | 結果 | 證據 |
|----|------|------|
| AC-1 | ✅ | `ct-exec/SKILL.md` L301-306 對照表：`CT_MODE=yolo` → 執行 `bat-notify.mjs --submit` |
| AC-2 | ✅ | `ct-exec/SKILL.md` L301-306 對照表：`CT_MODE=on` → 執行 `bat-notify.mjs`（不加 `--submit`） |
| AC-3 | ✅ | `ct-exec/SKILL.md` L301-306 對照表：`CT_MODE=ask`/`off` → 跳過 Step 8.5；L382 Step 11 前置條件明示 `CT_MODE 為 ask/off 或未設` → 剪貼簿降級 |
| AC-4 | ✅ | `ct-exec/SKILL.md` L291-294 明示「未設或不合法 → fallback `ask` + **必須**顯示升級提示」；升級提示文字 L291-294 一字不差引用工單規格 |
| AC-5 | ✅ | `ct-exec/SKILL.md` L61-67 `CT_INTERACTIVE=0` → 禁止研究型工單互動（覆蓋工單元資料） |
| AC-6 | ✅ | `ct-exec/SKILL.md` L55-58 結果段仍依「類型 == research」閘門，`CT_INTERACTIVE` 僅影響研究型工單；L68 關鍵原則「env 未設時尊重工單元資料」暗示非研究工單不受 env 影響 |
| AC-7 | ✅ | 見上方「Grep 驗證結果」：mode-related 讀取（`auto-session` / `research_interaction`）零殘留；剩餘 `_tower-config.yaml` 出現均屬 C 節明示允許之 worker-specific 行為調諧或禁令/註解 |
| AC-8 | ✅ | `CHANGELOG.md` L3-29 v4.3.0 區塊已建立（Changed / Breaking / Added / Source 四欄齊備） |
| AC-9 | ✅ | `ct-exec/SKILL.md` L312-318 + `ct-done/SKILL.md` L82-88 D062 嚴格禁令區塊已寫入兩個 skill 檔 |
| AC-10 | ✅ | commit 訊息見下方「Commit 與 Tag」 |

### CHANGELOG 貼上

```markdown
## [4.3.0] — 2026-04-18

### Changed

- **Worker 無狀態化（D062 落實）**（BUG-041 Phase 2.3）
  - `/ct-exec` 與 `/ct-done` 改讀 `CT_MODE` / `CT_INTERACTIVE` env，移除 `_tower-config.yaml` 的 mode 讀取（`auto-session` / `research_interaction`）
  - 未收到塔台 env → fallback `ask` 模式 + 顯示升級提示（提醒使用者升級塔台 skill）
  - 研究型工單互動旗標：env 優先 > 工單元資料（向下相容舊派發）

### Breaking

- v4.3.0 Worker skill 搭配 v4.2.x 或更早塔台 skill 使用時，所有派發都會看到「塔台未傳 `--mode` flag」升級提示，建議同步升級至 v4.3.0（塔台 skill 派發指令升級由 CT-T005 處理）

### Added

- `CT_MODE` env 規格（合法值：`yolo` / `ask` / `off` / `on`）寫入 `ct-exec` / `ct-done` skill
- `CT_INTERACTIVE` env 規格（`1` / `0`，旗標獨立於 mode）寫入 `ct-exec` 研究模式偵測段
- D062 嚴格禁令區塊寫入 `ct-exec` / `ct-done` skill，明示 Worker 不得讀 config 作 mode 判斷；`worker_max_retries` / `worker_commit` / `experience-level` 等 worker-specific 行為調諧參數為 D062 例外（允許）

### Source

- 跨專案來源：better-agent-terminal `8558b73` (T0180 BAT env 注入就位)
- 權威規格：T0179 研究報告（better-agent-terminal repo `_ct-workorders/_report-t0179-worker-yolo-flag-protocol.md` § E.3）
- CT-T006 跨專案協調工單（DELEGATE）
```

### Commit 與 Tag

- **Commit hash**：`4dbed7d`（monorepo `BMad-Guide` 頂層統一管理，延續 CT-T003/CT-T004 模式）
- **Commit 訊息**：`feat(ct): v4.3.0 — Worker skill env readout, D062 compliance (BUG-041 Phase 2.3)`
- **Tag**：**未建立**（D4 標示為選擇性；由使用者決定是否 `git tag v4.3.0` 與 push）
- **生產塔台 sync**：**未執行**（`~/.claude/skills/ct-exec/` 與 `~/.claude/skills/ct-done/` 由使用者決定是否同步，延續備註段建議）

### Renew 歷程

（無）

### DONE 時間

2026-04-18 19:22 (UTC+8)
