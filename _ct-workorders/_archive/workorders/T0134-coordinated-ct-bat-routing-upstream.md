# 工單 T0134-coordinated-ct-bat-routing-upstream

## 元資料
- **工單編號**：T0134
- **任務名稱**：【統籌】CT 上游整合 — BAT auto-session 路由 + Worker 自動通知
- **狀態**：DONE
- **建立時間**：2026-04-17 00:03 (UTC+8)
- **開始時間**：（sub-session 開始時填入）
- **完成時間**：（完成時填入）
- **關聯 PLAN**：PLAN-011

## 跨專案協調
- **協調類型**：COORDINATED
- **受影響專案**：

| 專案 | 路徑 | 子任務 | 對應 DELEGATE 工單 | 狀態 |
|------|------|--------|-------------------|------|
| BMad-Control-Tower | `D:\ForgejoGit\BMad-Guide\BMad-Control-Tower\BMad-Control-Tower-v4.1.0` | CT skill 修改（auto-session + bash 白名單 + ct-exec/ct-done 通知步驟） | CT-T001 | DONE |

- **統籌狀態**：DONE

## 背景

BAT 專案（better-agent-terminal）已完成以下基礎設施（T0126-T0133）：

| 功能 | 工單 | 說明 |
|------|------|------|
| ct-exec/ct-done 按鈕修復 | T0126 | command 改為 `claude "/ct-exec T####"` |
| Agent 自訂參數 | T0128 | Settings UI + 7 處啟動路徑套用 |
| RemoteServer 自動啟動 | T0129 | BAT_REMOTE_PORT / BAT_REMOTE_TOKEN env vars |
| 外部終端 UI 同步 | T0130 | WebSocket 建立的終端 → 縮圖 + xterm |
| CLI helper | T0131 | `bat-terminal.mjs`（WebSocket invoke） |
| Worker→Tower 通知 | T0133 | `bat-notify.mjs` + Toast + 三層 badge 冒泡 |

**目標**：將 BAT 路由和自動通知能力整合到 CT 上游 skill 定義中，讓任何安裝了 CT 的 BAT 使用者自動受益。

## 子任務規格（CT-T001 DELEGATE 工單內容）

### 需修改的 CT 檔案

#### 1. `control-tower/SKILL.md` — Bash 白名單擴充

在「Bash 白名單」表格中新增：

```markdown
| BAT 內部終端 | `node scripts/bat-terminal.mjs --notify-id $BAT_TERMINAL_ID claude "/ct-exec T####"` | BAT（BAT_SESSION=1） |
| BAT 內部終端 | `node scripts/bat-terminal.mjs --notify-id $BAT_TERMINAL_ID claude "/ct-done T####"` | BAT（BAT_SESSION=1） |
```

在「auto-session 偵測邏輯」或 Step 0 環境偵測中新增 BAT 偵測項：

```markdown
| 17 | BAT 終端環境 | `test "$BAT_SESSION" = "1"` | 未偵測到（非 BAT 環境） |
```

#### 2. `control-tower/references/auto-session.md` — BAT 路由段落

新增「BAT 內部終端路由」章節：

```markdown
## BAT 內部終端路由

### 偵測條件
- `BAT_SESSION=1` 環境變數存在

### 執行方式
- 使用 `bat-terminal.mjs` CLI helper 透過 WebSocket 在 BAT 內建立新終端分頁
- 新終端自動出現在 BAT UI 縮圖列（T0130 UI 同步機制）
- 支援 `--notify-id` 傳遞 Tower 終端 ID，供 Worker 完成後自動通知

### 路由決策樹
偵測 BAT_SESSION？
├─ BAT_SESSION=1 → node scripts/bat-terminal.mjs --notify-id $BAT_TERMINAL_ID claude "/ct-exec T####"
├─ $WT_SESSION 存在 → wt -w 0 nt claude "/ct-exec T####"
└─ 其他 → 剪貼簿 / 文字提示降級鏈

### 依賴的 BAT 基礎設施
- BAT_REMOTE_PORT / BAT_REMOTE_TOKEN env vars（RemoteServer 連線）
- BAT_TERMINAL_ID env var（PTY 自我識別）
- scripts/bat-terminal.mjs（終端建立）
- scripts/bat-notify.mjs（Worker→Tower 通知）
```

#### 3. `ct-exec/SKILL.md` — 收尾步驟新增自動通知

在 ct-exec 的「收尾步驟」中新增：

```markdown
### Step 11（可選）：自動通知 Tower

若偵測到 `BAT_TOWER_TERMINAL_ID` 環境變數：
1. 執行 `node scripts/bat-notify.mjs "T#### 完成"`
2. 通知管道：
   - PTY write → Tower 終端輸入行預填完成訊息（不自動送出）
   - terminal:notify → Toast 彈窗 + Tab badge + Workspace badge 冒泡
3. 失敗時靜默降級（不影響工單完成）
```

#### 4. `ct-done/SKILL.md` — 同上

與 ct-exec 相同的自動通知步驟。

### 驗收條件
- [ ] SKILL.md Bash 白名單包含 bat-terminal.mjs 指令
- [ ] auto-session.md 有完整的 BAT 路由章節
- [ ] ct-exec SKILL.md 收尾步驟包含自動通知
- [ ] ct-done SKILL.md 收尾步驟包含自動通知
- [ ] 所有修改向下相容（非 BAT 環境不受影響）

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態
（DONE / FAILED / BLOCKED / PARTIAL）

### 產出摘要
（列出修改的 CT 檔案）

### 遭遇問題
（若有問題或需要指揮塔介入的事項）

### 回報時間
（填入當前時間）
