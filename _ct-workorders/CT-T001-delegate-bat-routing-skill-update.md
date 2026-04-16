# 工單 CT-T001-delegate-bat-routing-skill-update

## 元資料
- **工單編號**：CT-T001
- **任務名稱**：【受派】CT skill 修改 — BAT auto-session 路由 + Worker 自動通知
- **狀態**：PENDING
- **建立時間**：2026-04-17 00:08 (UTC+8)
- **開始時間**：（sub-session 開始時填入）
- **完成時間**：（完成時填入）

## 跨專案協調
- **協調類型**：DELEGATE
- **來源統籌工單**：T0134-coordinated-ct-bat-routing-upstream
- **來源專案**：better-agent-terminal
- **對應子任務**：CT skill 修改（auto-session + bash 白名單 + ct-exec/ct-done 通知步驟）

## 工作量預估
- **預估規模**：中
- **Context Window 風險**：低（4 個檔案，修改量不大）

## 任務指令

### 目標專案
- **專案**：BMad-Control-Tower v4.0.1
- **路徑**：`D:\ForgejoGit\BMad-Guide\BMad-Control-Tower\BMad-Control-Tower-v4.0.1\`

### 修改清單

#### 1. `control-tower/SKILL.md`

**A. Bash 白名單擴充**（在「Bash 白名單」表格中新增）：

```markdown
| BAT 內部終端 | `node scripts/bat-terminal.mjs --notify-id $BAT_TERMINAL_ID claude "/ct-exec T####"` | BAT（BAT_SESSION=1） |
| BAT 內部終端 | `node scripts/bat-terminal.mjs --notify-id $BAT_TERMINAL_ID claude "/ct-done T####"` | BAT（BAT_SESSION=1） |
| BAT Worker 通知 | `node scripts/bat-notify.mjs "T#### 完成"` | BAT（BAT_TOWER_TERMINAL_ID 存在） |
```

**B. Step 0 環境偵測表格**新增一行：

```markdown
| 17 | BAT 終端環境 | `test "$BAT_SESSION" = "1"` + `test -n "$BAT_REMOTE_PORT"` | 未偵測到（非 BAT 環境，正常） |
```

**C. 偵測面板**新增顯示行：

```
║ 17. BAT 終端     ✅ BAT_SESSION=1, port:9876 / 📋 非 BAT 環境      ║
```

#### 2. `control-tower/references/auto-session.md`

新增「BAT 內部終端路由」章節（放在現有降級鏈之前，作為最高優先路由）：

```markdown
## BAT 內部終端路由（Better Agent Terminal）

### 偵測條件

塔台偵測到以下環境變數**全部存在**時，啟用 BAT 路由：
- `BAT_SESSION=1`（BAT 內部終端標記）
- `BAT_REMOTE_PORT`（RemoteServer WebSocket 端口）
- `BAT_REMOTE_TOKEN`（RemoteServer 認證 token）
- `BAT_TERMINAL_ID`（當前終端 PTY ID）

### 執行方式

塔台使用 BAT 的 `bat-terminal.mjs` CLI helper 透過 WebSocket 在 BAT 內部建立新終端分頁：

```bash
node scripts/bat-terminal.mjs --notify-id $BAT_TERMINAL_ID claude "/ct-exec T####"
```

- `--notify-id`：傳入 Tower 的 PTY ID，供 Worker 完成後自動通知
- 新終端自動出現在 BAT UI 終端縮圖列
- xterm.js 自動綁定 PTY output，使用者可即時互動
- 終端標題顯示 `Remote: <command>` 方便辨識

### Worker 完成自動通知

Worker（ct-exec / ct-done）收尾時，若偵測到 `BAT_TOWER_TERMINAL_ID` 環境變數，自動執行：

```bash
node scripts/bat-notify.mjs "T#### 完成"
```

通知管道：
1. **PTY write**：Tower 終端輸入行預填完成訊息（不帶 `\r`，不自動送出）
2. **Toast**：BAT UI 右上角彈窗通知
3. **Badge 冒泡**：終端縮圖 badge → Workspace 頁籤 badge（跨 workspace 可見）

### 路由優先級

BAT 路由插入現有降級鏈的**最高優先位置**：

```
1. BAT_SESSION=1 → bat-terminal.mjs（BAT 內部終端）    ← 新增
2. $WT_SESSION 存在 → wt -w 0 nt（Windows Terminal）
3. $TERM_PROGRAM = vscode → 剪貼簿
4. 其他 → 文字提示
```

### 依賴的 BAT 基礎設施

| 元件 | 說明 |
|------|------|
| `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` | RemoteServer WebSocket 連線資訊（pty-manager 自動注入） |
| `BAT_TERMINAL_ID` | 每個 PTY 的 UUID（pty-manager 自動注入） |
| `scripts/bat-terminal.mjs` | 零依賴 Node.js CLI，WebSocket invoke 建立終端 |
| `scripts/bat-notify.mjs` | 零依賴 Node.js CLI，雙管道通知（PTY write + terminal:notify） |
| RemoteServer | BAT 啟動後自動運行的 WebSocket server |
| `terminal:created-externally` | 外部建立的終端 → UI 同步（縮圖 + xterm） |
| `terminal:notify` | 通知事件 → Toast + Badge 冒泡 |

### 向下相容

- 非 BAT 環境：所有 BAT env vars 不存在 → 跳過 BAT 路由 → 走現有降級鏈
- BAT RemoteServer 未啟動：`bat-terminal.mjs` 連線失敗 → timeout 3 秒 → fallback 到下一級
```

#### 3. `ct-exec/SKILL.md`

在收尾步驟中新增（放在 git commit 之後、填寫回報區之前）：

```markdown
### Step N（可選）：BAT 自動通知 Tower

若偵測到 `BAT_TOWER_TERMINAL_ID` 環境變數（表示由 BAT 內的 Tower 派發）：

1. 執行通知：
   ```bash
   node scripts/bat-notify.mjs "T#### 完成"
   ```
2. 通知效果：
   - Tower 終端輸入行預填 `T#### 完成`（使用者按 Enter 送出）
   - BAT UI 顯示 Toast 通知 + Tab badge
3. 環境變數不存在時：靜默跳過（非 BAT 環境或非 Tower 派發）
4. 執行失敗時：靜默降級（log warning，不影響工單完成）
```

#### 4. `ct-done/SKILL.md`

與 ct-exec 相同的自動通知步驟。

### 驗收條件
- [ ] SKILL.md Bash 白名單包含 3 條 BAT 相關指令
- [ ] SKILL.md 環境偵測新增 BAT 終端項目
- [ ] auto-session.md 有完整的 BAT 路由章節（含偵測條件、執行方式、通知機制、優先級、向下相容）
- [ ] ct-exec SKILL.md 收尾步驟包含 BAT 自動通知
- [ ] ct-done SKILL.md 收尾步驟包含 BAT 自動通知
- [ ] 所有修改向下相容（非 BAT 環境完全不受影響）

---

## 回報區

> 由 BMad-Guide 塔台代填（CT-T001 接收方塔台）

### 完成狀態
**DONE** — 全部驗收條件通過，v4.1.0 完整發布

### 產出摘要

CT 端以三張工單序列接收並完成本 DELEGATE：

| 工單 | 類型 | 狀態 | Commit |
|------|------|------|--------|
| **CP-T0091** | research | ✅ DONE | `2246748`, `9a81b05` |
| **CP-T0092** | implementation | ✅ DONE | `207b1a4` |
| **CP-T0093** | release | ✅ DONE | `98efd9c` (snapshot), `3ca0afc` (CHANGELOG+安裝指南+ZIP) |

#### 階段成果

**1️⃣ CP-T0091（research）— 釐清 source/snapshot 雙層架構**
- Source-of-truth = `~/.claude/skills/`（Claude Code 啟動實際讀取）
- Snapshot = `BMad-Control-Tower-v*.X.Y/`（distribution，純手動同步）
- 結論：BAT 整合策略 = source 修改 → 同步到下個 snapshot

**2️⃣ CP-T0092（implementation）— Source 端 4 檔修改完成**

修改清單（全部位於 `~/.claude/skills/`）：

| 檔案 | 變更 |
|------|------|
| `control-tower/SKILL.md` | Bash 白名單 +3 / 環境偵測第 17 項 BAT 終端 / 偵測面板新行 |
| `control-tower/references/auto-session.md` | BAT 路由章節（最高優先）+ 5 級降級鏈 |
| `ct-exec/SKILL.md` | Step 8.5「BAT 自動通知 Tower」（依完成狀態決定訊息） |
| `ct-done/SKILL.md` | Step 6.5「BAT 自動通知 Tower」（同 ct-exec） |

**向下相容驗證（all pass）**：
- 所有新增段落皆有「環境變數不存在 → 跳過」邏輯
- 「無 BAT env」5 點通讀驗證全通過
- 結論：**非 BAT 環境完全不受影響**

**3️⃣ CP-T0093（release）— v4.1.0 完整發布**

- **版本策略**：v4.0.1 → v4.1.0（minor bump）
- **Snapshot**：`BMad-Control-Tower-v4.1.0/`（從 v4.0.1 完整複製為基底 + 同步 source 改動）
- **CHANGELOG**：新增 `## [4.1.0] — 2026-04-17` 條目（涵蓋 6 項 BAT 整合變更 + 向下相容性說明 + 跨專案來源標註）
- **安裝指南**：內部版號升 v4.1.0 + 新增「2.5 v4.1 新功能 — BAT 整合」完整章節（觸發條件、4 個環境變數、使用者體驗、降級行為）
- **ZIP**：`BMad-Control-Tower-v4.1.0.zip`（299 KB）
- **版號處理**：當前版本標題升 v4.1（3 處），歷史/遷移引擎保留 v4.0（5 處）

#### 全部驗收條件

- [x] SKILL.md Bash 白名單包含 3 條 BAT 相關指令
- [x] SKILL.md 環境偵測新增 BAT 終端項目
- [x] auto-session.md 有完整 BAT 路由章節（含偵測條件、執行方式、通知機制、優先級、向下相容）
- [x] ct-exec SKILL.md 收尾步驟包含 BAT 自動通知
- [x] ct-done SKILL.md 收尾步驟包含 BAT 自動通知
- [x] 所有修改向下相容（非 BAT 環境完全不受影響，5 點驗證通過）

#### 對 BAT 端的後續建議

- ✅ **可立即使用**：CT skill source 已生效，下次 Claude Code 啟動即套用
- ✅ **可散布 ZIP**：`BMad-Control-Tower-v4.1.0.zip` 可放入 BAT 專案 reference 或共享給其他使用者
- ⏳ **待 BAT 端整合驗證**：建議在 BAT 內實際啟動 Tower 觀察派發是否走新路徑（測試 `BAT_SESSION=1` + `BAT_REMOTE_PORT` 等 env 齊備時的行為）
- 💡 **若有問題回報**：可建立新的 DELEGATE 工單回派 CT 端調整

### 遭遇問題

- **CP-T0092 過程中**：Edit 工具對全形冒號 `:` 字元匹配失敗（MSYS2 Bash 環境），Worker 改用半形標點重建工單避開。已記錄為 learning，後續工單模板將採半形標點。
- 其他無

### 回報時間
2026-04-17 01:25 (UTC+8)（由 BMad-Guide 塔台代填）

### 跨專案參照
- BMad-Guide 端三張工單路徑：
  - `D:\ForgejoGit\BMad-Guide\_ct-workorders\CP-T0091-research-bat-integration-structure.md`
  - `D:\ForgejoGit\BMad-Guide\_ct-workorders\CP-T0092-bat-integration-source-modify.md`
  - `D:\ForgejoGit\BMad-Guide\_ct-workorders\CP-T0093-v410-snapshot-changelog-release.md`
- BMad-Guide commit history（5 個 commit）：`9a81b05`, `e0cd284`, `207b1a4`, `98efd9c`, `3ca0afc`
