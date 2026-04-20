# T0225 — 實作:PLAN-025 核心偵測層重構(A.2 決策樹)

## 元資料

- **編號**:T0225
- **類型**:implementation(實作工單)
- **狀態**:✅ DONE
- **建立時間**:2026-04-20 (UTC+8)
- **開始時間**:2026-04-20 10:48 (UTC+8)
- **完成時間**:2026-04-20 10:58 (UTC+8)
- **Commit**:`c6e1f3c(後續如回填 SHA 會 amend,以 `git log -1` 為準)`
- **派發模式**:待塔台與使用者對齊(建議 `--mode on --interactive`,有關鍵決策點)
- **優先級**:🔴 High(PLAN-025 阻擋後續 T0226/T0227/T0228)
- **前置條件**:PLAN-025(PLANNED)、T0224(✅ DONE,`aea9373`)
- **關聯**:PLAN-025、T0224(研究產出)、`references/auto-session.md`(改寫目標)、`references/yolo-mode.md`(相依 auto-session)
- **預估時間**:60-90 min(重構 reference 文件,無 code 異動)
- **Renew 次數**:0

## 背景

T0224 研究完成,交付 20 條環境變數表 + 10 Step 決策樹 + B/C/D 面矩陣。本工單實作**偵測層核心**,改寫 `references/auto-session.md` 以落實 A.2 決策樹。

B 面(開新分頁指令)和 C 面(剪貼簿)**不在本工單範圍**,分給 T0226 / T0227。

## 實作範圍

### 必改

**`references/auto-session.md` 的偵測邏輯段落**:

1. **加入 A.1 完整變數表**(T0224 回報區 A.1,20 條):BAT_SESSION / CODESPACES / REMOTE_CONTAINERS / SSH_CONNECTION / TMUX / STY / WSL_DISTRO_NAME / WT_SESSION / TERM_PROGRAM / KITTY_WINDOW_ID / KONSOLE_VERSION / GNOME_TERMINAL_SERVICE / ALACRITTY_LOG / 等
2. **落實 A.2 決策樹**(T0224 回報區 A.2,10 Step):文件化為「由特定到寬鬆」的優先順序表
3. **短路規則**:BAT_SESSION 最優先(避免 BAT 內部遞迴派發);容器類優先於 SSH;tmux/screen 優先於外層 term;WSL 優先於 WT_SESSION
4. **偵測結果 struct**:定義 `{ type, primary_var, additional_vars, wrapping_layers[] }` 欄位規格,供 T0226/T0227 消費

### R4 VS Code 自動分頁(🔴 延後到 T0228)

**更新(2026-04-20 塔台 Renew-lite)**:
- 使用者(Gower)目前在 **BAT 開發環境**,Worker 也在 BAT,**兩者皆無法實測 VS Code 行為**
- R4 驗證**移交 T0228**(Selene 在 macOS VS Code + devcontainer 實測)
- 本工單**不要**對 VS Code 自動分頁做任何結論或降級決定
- `auto-session.md` 中 VS Code non-devcontainer 段落**保持現行行為不改**,加註「R4 VS Code 自動分頁行為待 T0228 驗證」備註即可
- 若 T0228 驗證結果為失效 → 另派補丁工單修改 VS Code 段落

### 可不改

- B 面(開新分頁指令)具體指令 → T0226
- C 面(剪貼簿)具體寫入 → T0227
- D 面四模式映射表 → T0226 + T0227 完成後,在 T0228 前最終整合

## 禁止

- ❌ 改動 B 面具體指令(保留給 T0226)
- ❌ 改動 C 面具體剪貼簿寫入(保留給 T0227)
- ❌ 改動 `yolo-mode.md`(相依 auto-session,但本工單不動)
- ❌ 跳出本工單範圍(不要順手改其他 reference)
- ❌ 未驗證 R4 就收工

## Worker 執行指引

### 可能需要互動的點(若 `--interactive`)

1. **A.2 決策樹分支順序**:T0224 已明確,但實作時若發現邊緣情境可諮詢塔台
2. **R4 VS Code 實測**:若 Worker 無法自行實測(不在 VS Code 內),需請使用者協助
3. **偵測結果 struct 欄位設計**:影響 T0226/T0227 消費,若有替代設計可討論

### 允許的 shell 指令

- `grep -rn "auto-session" references/`(找現有引用)
- `cat references/auto-session.md`(讀當前內容)
- `env | grep -iE "TERM|WSL|TMUX|SSH|REMOTE|BAT|WT_"`(實測偵測變數)
- 文件改寫相關的 Read / Write / Edit

### 禁止的 shell 指令

- 任何會離開 `_ct-workorders/` 和 `references/` 範圍的 code 修改
- `npm install` / `package.json` 變動

## 交付物

在本工單回報區填寫:

1. **`auto-session.md` diff 摘要**:改了哪些段落,加了什麼表格
2. **A.2 決策樹落實確認**:10 Step 是否全部進入文件
3. **R4 驗證結果**:VS Code 自動分頁行為實測結果,影響後續 T0226 設計
4. **偵測結果 struct 規格**:給 T0226/T0227 consume 的欄位定義
5. **commit SHA**(一張或合併)

## 驗收標準

- [ ] `auto-session.md` 包含 A.1 完整變數表(≥20 條)
- [ ] `auto-session.md` 包含 A.2 決策樹(10 Step,短路規則清楚)
- [ ] R4 **不在本工單驗收範圍**(移交 T0228),但需在 `auto-session.md` VS Code 段落加註「R4 待 T0228 驗證」備註
- [ ] 偵測結果 struct 欄位定義清楚,T0226/T0227 可直接 consume
- [ ] 現行 Windows Terminal / BAT_SESSION 路徑**未破壞**(R1/R2 緩解:BAT_SESSION 最優先)
- [ ] commit 落地(單一 atomic 或拆分,Worker 決定)

## 塔台筆記

- 本工單**不派 yolo**(建議 `--mode on --interactive`)—— R4 需實測 VS Code,很可能需要使用者協助;另外 struct 設計有決策點
- T0226 / T0227 可等 T0225 DONE 後再建,或使用者要求一次建齊 roadmap
- T0228 Selene 驗證必然 `--interactive`,需 Selene 在 devcontainer 實機跑

---

## 回報區(Worker 填寫)

### 執行摘要

- **完成狀態**:DONE
- **派發模式**:實際 `CT_MODE=yolo / CT_INTERACTIVE=0`(與工單建議的 `on --interactive` 不一致,Worker 依 D062 尊重 env,0 次使用者互動)
- **檔案異動**:單一檔案 `C:\Users\Gower\.claude\skills\control-tower\references\auto-session.md`(466 行,從原 253 行擴展)
- **程式碼異動**:無(工單為 reference 文件重構)

### auto-session.md diff 摘要

**重寫段落(§5-41 原偵測區):**

| 原內容 | 新內容 |
|-------|-------|
| 5 級優先表(WT / VSCode / macOS / iTerm2 / 其他) | 10 Step 決策樹(A.2)+ 20 條變數表(A.1)+ 5 條短路規則 |
| `detect_terminal()` 虛擬碼(4 個 if 分支) | 擴展虛擬碼(Step 0-10 完整)+ `build()` / `infer_platform()` helper |
| 無 struct 定義 | 新增 `TerminalDetection` interface + `TerminalType` union(19 種類型) |
| 無 Selene 主場景範例 | 新增 devcontainer 預期偵測結果 JSON |
| 無 R4 備註 | 新增「VS Code(non-devcontainer)備註:R4 待 T0228 驗證」段 |

**保留未動段落:**

- `## 派發後行為`(on/ask/off/yolo 四模式)
- `## Mode 與互動旗標協定(v4.3.0+)`(flag 規格 / env 對照 / 向下相容)
- `## BAT 內部終端路由`(整段,含偵測條件、執行方式、Worker 完成通知、路由優先級、向下相容)
- `## 降級鏈`、`## 安全邊界`(Bash 白名單 + 安全規則)、`## 回報快捷`

**驗收條目對照:**

| 驗收項 | 狀態 | 證據 |
|-------|------|-----|
| A.1 完整變數表(≥20 條) | ✅ | §61 表格共 20 列(BAT_SESSION … COLORTERM) |
| A.2 決策樹(10 Step,短路規則清楚) | ✅ | §86 Step 0-10 全列 + §155「短路規則」5 條 |
| R4 **不在本工單驗收範圍**,但 VS Code 段落加註「R4 待 T0228 驗證」備註 | ✅ | §247 `VS Code(non-devcontainer)備註:R4 待 T0228 驗證` |
| 偵測結果 struct 欄位定義清楚,T0226/T0227 可直接 consume | ✅ | §11 TypeScript interface:`type / primary_var / additional_vars / wrapping_layers[] / platform / is_bat_internal` |
| 現行 Windows Terminal / BAT_SESSION 路徑未破壞 | ✅ | BAT_SESSION 為 Step 0 最優先短路;WT_SESSION 位於 Step 7(WSL 子決策 6 優先)——R1/R2 緩解到位 |
| commit 落地 | ✅ | 見下方 |

### A.2 決策樹落實確認

10 Step 全進入文件,順序與 T0224 研究結論一致:

| Step | 偵測條件 | 文件行號 |
|------|---------|---------|
| 0 | `BAT_SESSION=1` | §89 |
| 1 | `CODESPACES=true` | §94 |
| 2 | `REMOTE_CONTAINERS=true` | §98 |
| 3 | `SSH_CONNECTION` 存在 | §105 |
| 4 | `TMUX` 存在 | §112 |
| 5 | `STY` 存在 | §117 |
| 6 | `WSL_DISTRO_NAME` 存在 | §121 |
| 7 | `WT_SESSION` 存在(Step 6 未命中) | §127 |
| 8 | `TERM_PROGRAM` 分支(vscode/Apple_Terminal/iTerm.app/WarpTerminal/WezTerm) | §131 |
| 9 | Linux 桌面(KITTY/ALACRITTY/GNOME/KONSOLE) | §139 |
| 10 | 降級識別(MSYSTEM=MINGW64) + Fallback | §146 |

短路規則 5 條(§155):BAT_SESSION 最優先 / 容器類優先於 SSH 與外層 / tmux-screen 優先於外層 / WSL 優先於 WT_SESSION / REMOTE_CONTAINERS 優先於 TERM_PROGRAM。

### R4 驗證結果

**狀態**:🟡 移交 T0228(依工單 Renew-lite 指示)

**處置**:
- Worker 在 Windows BAT 內執行,無 VS Code 實測環境
- 使用者也在 BAT,雙方皆無法實測
- `auto-session.md` §247 已加註「R4 待 T0228 驗證」備註,明確標示不在本工單範圍
- VS Code(non-devcontainer)路徑**維持現行行為不改**——T0226 開新分頁指令表沿用現行 `claude "/ct-exec T####"` 字面指令
- T0228 在 macOS VS Code + devcontainer 實機跑出結論後,若需降級另派補丁工單

### 偵測結果 struct 規格

`auto-session.md` §11-59 定義(TypeScript interface + union type),給 T0226 / T0227 / T0228 實作時 import:

```typescript
interface TerminalDetection {
  type: TerminalType;              // 19 種具名類型(見 union)
  primary_var: string;             // 觸發此分類的主要環境變數名稱
  additional_vars: string[];       // 共存信號
  wrapping_layers: string[];       // 由內到外的包裹層(tmux/screen/wsl/vscode 等)
  platform: "windows" | "macos" | "linux" | "wsl" | "container" | "ssh" | "unknown";
  is_bat_internal: boolean;        // Step 0 短路旗標
}
```

**T0226 消費點**:依 `type` 選 B 面開新分頁指令,依 `wrapping_layers` 決定是否雙層包裹(如 WSL+WT)。

**T0227 消費點**:依 `platform` 選剪貼簿工具,依 `type` + `wrapping_layers` 決定 OSC 52 策略。

### 互動紀錄

無(`CT_INTERACTIVE=0`;Worker 依 D062 尊重 env,執行中未向使用者提問)。

### Renew 歷程

- **Renew #1**(執行中,工單被靜默更新 — 實質為 Renew-lite,無正式 `## 塔台補充` 區段)
  - 補充摘要:R4 VS Code 自動分頁驗證**移交 T0228**(使用者在 BAT,Worker 也在 BAT,雙方皆無法實測);驗收條目改為「VS Code 段落加註『R4 待 T0228 驗證』備註即可」,禁止對 VS Code 自動分頁做任何結論或降級決定
  - 執行結果:Worker 已將原本的「實作階段建議處置」段落改寫為單純備註「R4 待 T0228 驗證」,移除所有降級建議;VS Code 段落維持 Step 8 vscode 分支現行行為

### 遭遇問題

**環境旗標不一致(非阻斷)**:

- 工單建議 `--mode on --interactive`(有關鍵決策點,R4 需使用者協助)
- 實際 env 為 `CT_MODE=yolo / CT_INTERACTIVE=0`
- 處置:依 D062「Worker 尊重 env、不讀 config」,以 yolo 模式執行;R4 原需使用者協助的部分,因 Renew-lite 已移交 T0228,不再阻擋本工單
- 建議:塔台派類似「有關鍵決策點」的工單時,派發 flag 宜與工單建議對齊(或工單元資料提早標記「依塔台派發為準」)

### 產出摘要

**檔案異動**:
- `auto-session.md`:466 行(原 253 行 → +213 行淨增)
  - 偵測段落大幅擴充:變數表 20 條、決策樹 10 Step、短路規則 5 條、struct 定義(TypeScript)、Selene 預期結果、R4 備註
  - 其餘段落(yolo 模式 / flag 協定 / BAT 路由 / 降級鏈 / 安全邊界 / 回報快捷)未動
- `T0225-impl-plan025-core-detection-decision-tree.md`:狀態 IN_PROGRESS → DONE + 完成時間 + 回報區填寫

**程式碼異動**:無

**未動**:yolo-mode.md、B 面具體指令(T0226)、C 面具體剪貼簿寫入(T0227)、D 面四模式映射(T0228 前整合)

### 完成時間

2026-04-20 10:58 (UTC+8) — 實耗約 10 分鐘(工單估 60-90 min,實際因 T0224 研究已產出完整 A/B/C/D 矩陣,本工單主要為格式化 + 落地文件,Renew-lite 後移除 R4 驗證項亦縮短時程)

### Commit

`c6e1f3c(後續如回填 SHA 會 amend,以 `git log -1` 為準)` — `feat(ct): T0225 偵測層重構 — A.1 20 條變數表 + A.2 10 Step 決策樹 + TerminalDetection struct`
