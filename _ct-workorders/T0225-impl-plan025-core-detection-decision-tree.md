# T0225 — 實作:PLAN-025 核心偵測層重構(A.2 決策樹)

## 元資料

- **編號**:T0225
- **類型**:implementation(實作工單)
- **狀態**:📋 TODO
- **建立時間**:2026-04-20 (UTC+8)
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

### 必驗(R4 🔴 高風險)

**VS Code 現行自動開分頁行為**:
- T0224 Q7 R4 標示「現行 VS Code 走 `claude "/ct-exec T####"` 依賴 VS Code 自動開新 terminal tab;**實測可疑**」
- 本工單**必須**跑一次實測(或要求使用者協助驗證):
  1. 在 VS Code 內建 terminal 執行 `claude "/ct-exec T-TEST"` 字面
  2. 觀察是否真開新 tab(或是在當前 tab 繼續跑)
- 結論寫入 `auto-session.md`,若**失效**則 VS Code non-devcontainer 情境走**剪貼簿 + 提示 Ctrl+Shift+\`** 路徑(非 on)

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
- [ ] R4 VS Code 自動分頁行為**已驗證**(結果明確:仍然能用 / 已失效)
- [ ] 偵測結果 struct 欄位定義清楚,T0226/T0227 可直接 consume
- [ ] 現行 Windows Terminal / BAT_SESSION 路徑**未破壞**(R1/R2 緩解:BAT_SESSION 最優先)
- [ ] commit 落地(單一 atomic 或拆分,Worker 決定)

## 塔台筆記

- 本工單**不派 yolo**(建議 `--mode on --interactive`)—— R4 需實測 VS Code,很可能需要使用者協助;另外 struct 設計有決策點
- T0226 / T0227 可等 T0225 DONE 後再建,或使用者要求一次建齊 roadmap
- T0228 Selene 驗證必然 `--interactive`,需 Selene 在 devcontainer 實機跑

---

## 回報區(Worker 填寫)

<!-- Worker 完成後在此填寫 diff 摘要、R4 驗證結果、struct 規格、commit SHA -->
