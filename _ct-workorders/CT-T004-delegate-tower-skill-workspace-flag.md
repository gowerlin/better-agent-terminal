# 工單 CT-T004-delegate-tower-skill-workspace-flag

## 元資料
- **工單編號**：CT-T004
- **任務名稱**：【受派】CT skill 派發指令加 `--workspace "$BAT_WORKSPACE_ID"` flag（BUG-040 Phase 1.2）
- **狀態**：DONE
- **建立時間**：2026-04-18 17:52 (UTC+8)
- **開始時間**：2026-04-18 18:08 (UTC+8)
- **完成時間**：2026-04-18 18:11 (UTC+8)
- **預估工時**：20-30 分鐘（純文檔 + Bash 白名單規格調整）
- **優先級**：🔴 High（BUG-040 修復閉環必經步驟）

## 跨專案協調
- **協調類型**：DELEGATE
- **來源統籌工單**：BUG-040-bat-terminal-workspace-misroute（Phase 1.2）
- **來源專案**：better-agent-terminal (`D:\ForgejoGit\BMad-Guide\better-agent-terminal\better-agent-terminal\`)
- **來源 commit**：`6282ea0` T0176 DONE（BAT 端 env 注入實作，AC-1~AC-6 全部通過）
- **目標專案**：claude-control-tower (`D:\ForgejoGit\BMad-Guide\BMad-Control-Tower\BMad-Control-Tower-v4.x.x\`)
- **目標檔案**：`skills/control-tower/SKILL.md`（Bash 白名單段落 + 相關派發說明）
- **Renew 次數**：0
- **建議目標版本**：v4.2.2 (patch)

---

## 背景

BUG-040 根因（T0173 研究）：塔台派發 script `node scripts/bat-terminal.mjs ... claude "/ct-exec T####"` 未帶 `--workspace` flag → renderer 落入 `activeWorkspaceId` fallback → 前一張 Worker 結尾 cwd 黏著到下一張，導致 workspace 錯派。

修復方案 A 分兩階段：
- **Phase 1.1（BAT 側，已完成）**：T0176 在 BAT PTY env 注入 `BAT_WORKSPACE_ID`（`6282ea0`）。塔台 sub-session 執行 `echo $BAT_WORKSPACE_ID` 回傳 uuidv4 格式 workspace id。AC-1~AC-6 全部驗收通過（2026-04-18 17:52）。
- **Phase 1.2（塔台側，本工單）**：塔台派發指令加 `--workspace "$BAT_WORKSPACE_ID"`，bat-terminal.mjs 把 flag 傳給 terminal-server 建新 PTY 時指定 workspace，從源頭避開 activeWorkspaceId fallback。

## 修改規格

### Step 1：更新 BAT 內部終端派發白名單

**定位**：`skills/control-tower/SKILL.md` § `Bash 白名單（僅限 auto-session 功能）` 的表格。

**現狀**（兩行 BAT 內部終端項）：
```markdown
| BAT 內部終端 | `node scripts/bat-terminal.mjs --notify-id $BAT_TERMINAL_ID claude "/ct-exec T####"` | BAT（BAT_SESSION=1） |
| BAT 內部終端 | `node scripts/bat-terminal.mjs --notify-id $BAT_TERMINAL_ID claude "/ct-done T####"` | BAT（BAT_SESSION=1） |
```

**改為**（新增 `--workspace "$BAT_WORKSPACE_ID"` 緊接 `--notify-id $BAT_TERMINAL_ID` 之後）：
```markdown
| BAT 內部終端 | `node scripts/bat-terminal.mjs --notify-id $BAT_TERMINAL_ID --workspace "$BAT_WORKSPACE_ID" claude "/ct-exec T####"` | BAT（BAT_SESSION=1） |
| BAT 內部終端 | `node scripts/bat-terminal.mjs --notify-id $BAT_TERMINAL_ID --workspace "$BAT_WORKSPACE_ID" claude "/ct-done T####"` | BAT（BAT_SESSION=1） |
```

**安全邊界補充**（於白名單下方「安全邊界」區塊追加一條）：
```markdown
- `--workspace` 參數值僅允許使用 `$BAT_WORKSPACE_ID` 環境變數（不得為任意字串），防止塔台誤派到非預期 workspace
```

### Step 2：搜尋並同步其他派發範例

在 `skills/control-tower/SKILL.md` 與 `skills/control-tower/references/*.md` 全文搜尋：

```
node scripts/bat-terminal.mjs
```

凡 BAT 內部終端派發範例（含 `--notify-id $BAT_TERMINAL_ID`），一律追加 `--workspace "$BAT_WORKSPACE_ID"`。

**已知需檢查的檔案**（請用 Grep 驗證，不要假設）：
- `references/auto-session.md`（BAT 偵測與派發降級鏈）
- `references/yolo-mode.md`（yolo 模式派發面板）
- `references/work-order-system.md`（派發流程）
- `references/work-order-template.md`（若有派發指令範例）
- `references/interrupt-protocol.md`（`*pause`/`*resume` 若也走 bat-terminal.mjs）

### Step 3：版本標記與 CHANGELOG

**定位**：`skills/control-tower/SKILL.md` 第 1 行（頂部版本宣告）。

從：
```
# BMad Control Tower v4
```
更新版本號維持 `v4`（語意版對外），但在文末或 reference 中註明本次為 `v4.2.2` 增量。

**CHANGELOG 追加**（若 `skills/control-tower/CHANGELOG.md` 存在）：
```markdown
## v4.2.2 - 2026-04-18

### Changed
- **BAT 派發指令加 `--workspace "$BAT_WORKSPACE_ID"` flag**（BUG-040 Phase 1.2）
  - 從源頭指定新 PTY 所屬 workspace，避開 renderer `activeWorkspaceId` fallback 導致的 workspace 錯派
  - 前置條件：BAT `BAT_WORKSPACE_ID` 環境變數注入（BAT 端 commit `6282ea0`，v 對應 BAT 本版）
  - 向下相容：`bat-terminal.mjs` 若不認 `--workspace` flag，Bash 白名單仍會執行但 flag 被忽略（效果等同修復前，不會破壞現有環境）

### Fixed
- BUG-040（跨專案來源：better-agent-terminal）
```

### Step 4：驗收

本工單為純規格修改，AC 條件：

- **AC-CT-1**：白名單兩行 BAT 內部終端派發指令都含 `--workspace "$BAT_WORKSPACE_ID"`
- **AC-CT-2**：`references/*.md` 所有 BAT 派發範例已同步補上 flag（Grep 驗證：`grep -r "bat-terminal.mjs --notify-id" skills/control-tower/` 應無漏網）
- **AC-CT-3**：安全邊界補充條款已追加
- **AC-CT-4**：CHANGELOG v4.2.2 條目已建立（若 CHANGELOG 檔案存在）
- **AC-CT-5**：新 commit `docs(ct): v4.2.2 — BAT dispatch --workspace flag (BUG-040 Phase 1.2)`

### Step 5（選擇性，建議）：sync 到生產塔台 + 建 tag

完成後：
```bash
# 假設對方塔台有 /ct-sync 或類似 skill，若無則手動：
# 1. 從 BMad-Control-Tower-v4.x.x/skills/control-tower/ 複製到 ~/.claude/skills/control-tower/
# 2. 建 tag
git tag v4.2.2 -m "v4.2.2 — BAT dispatch --workspace flag"
git push origin v4.2.2
```

## 交付規格

工單回報區填寫：
- 修改的具體檔案清單 + 行號
- Grep 驗證結果（確認無漏網派發範例）
- Commit hash
- Tag（若建立）
- 對方塔台 sync 狀態

## 相關單據

- **BUG-040** OPEN → Phase 1.2 啟動後狀態 FIXING
- **T0173** DONE：BUG-040 根因研究（`_report-bug-040-workspace-misroute.md`）
- **T0175** DONE：BAT `BAT_WORKSPACE_ID` 注入研究（`_report-bat-workspace-id-injection.md`）
- **T0176** DONE：BAT 端 env 注入實作（commit `6282ea0`，AC-1~AC-6 通過）
- **CT-T001/CT-T002/CT-T003** DONE：過去同類 DELEGATE 先例（版本迭代 v4.1.x → v4.2.1）

## 備註

- 本工單為**跨專案 DELEGATE**，使用者需手動切換到 `D:\ForgejoGit\BMad-Guide\BMad-Control-Tower\BMad-Control-Tower-v4.x.x\` 目錄後派 Worker
- BAT 端 v4.2.2 對應的生產塔台 skill sync 可由使用者自行決定（若已經有自動化流程則走原有路徑）
- CT-T004 完成後 → 使用者實測跨 workspace 派發 → BUG-040 FIXED → VERIFY → CLOSED → Phase 1 全結案 → 啟動 Phase 2（BUG-041 yolo gap 研究）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 執行摘要

**狀態**：DONE（AC-CT-1 ~ AC-CT-5 全部通過）

Control Tower v4.2.2 純規格/文檔工單，BAT 派發白名單兩行 BAT 內部終端指令補上 `--workspace "$BAT_WORKSPACE_ID"`，安全邊界新增對應限制，references 中所有相關派發範例同步補上 flag，CHANGELOG 追加 v4.2.2 條目。Grep 驗證無漏網。

### 修改檔案清單

| 檔案 | 行號 | 修改內容 |
|------|------|---------|
| `control-tower/SKILL.md` | 40-41 | 白名單兩行 BAT 內部終端指令補上 `--workspace "$BAT_WORKSPACE_ID"` |
| `control-tower/SKILL.md` | 48（新增行） | 安全邊界新增「`--workspace` 僅允許 `$BAT_WORKSPACE_ID` 環境變數」條款 |
| `control-tower/references/auto-session.md` | 81 | yolo 預載指令範例補上 flag + 說明 |
| `control-tower/references/auto-session.md` | 113 + 新說明行 | BAT 內部終端路由指令範例補上 flag，新增 `--workspace` 參數說明條目 |
| `CHANGELOG.md` | 頂部新增 v4.2.2 區塊 | Changed + Fixed + Source 三個子節記載本次變更 |

### Grep 驗證結果

最終 `grep -rn "bat-terminal.mjs" control-tower/` 結果（BUG-040 相關派發指令全部就定位）：

```
control-tower/SKILL.md:40: ... --notify-id $BAT_TERMINAL_ID --workspace "$BAT_WORKSPACE_ID" claude "/ct-exec T####" ...     ✅
control-tower/SKILL.md:41: ... --notify-id $BAT_TERMINAL_ID --workspace "$BAT_WORKSPACE_ID" claude "/ct-done T####" ...     ✅
control-tower/references/auto-session.md:81:  bat-terminal.mjs --notify-id $BAT_TERMINAL_ID --workspace "$BAT_WORKSPACE_ID" --yolo                                    ✅
control-tower/references/auto-session.md:113: node scripts/bat-terminal.mjs --notify-id $BAT_TERMINAL_ID --workspace "$BAT_WORKSPACE_ID" claude "/ct-exec T####"      ✅
control-tower/references/auto-session.md:140: （降級鏈說明行，非指令範例，不需補）
control-tower/references/auto-session.md:152: （元件說明表行，非指令範例，不需補）
control-tower/references/auto-session.md:161: （錯誤處理說明行，非指令範例，不需補）
```

→ **所有帶 `--notify-id` 的派發指令範例均已補齊；無漏網。**

### Commit 與 Tag

- **Commit**：`367b30d`（BMad-Guide 倉庫，dev-main 分支）
  - `docs(ct): v4.2.2 — BAT dispatch --workspace flag (BUG-040 Phase 1.2)`
  - 3 files changed, 27 insertions(+), 4 deletions(-)
- **Tag**：尚未建立，建議使用者 push 後執行 `git tag v4.2.2 -m "v4.2.2 — BAT dispatch --workspace flag (BUG-040 Phase 1.2)"` 並 `git push origin v4.2.2`

### 對方塔台 sync 狀態

未執行自動 sync（工單 Step 5 標記選擇性，由使用者自行決定是否手動 sync 到 `~/.claude/skills/control-tower/` 生產環境）。本次修改位於 Forgejo 發佈倉庫 `BMad-Control-Tower-v4.2.0/`，使用者可依既有流程 sync 或重新打包。

### Renew 歷程

無

### DONE 時間

2026-04-18 18:11 (UTC+8)
