# PLAN-025 — Auto-session 終端偵測跨平台擴展

| 欄位 | 內容 |
|------|------|
| **狀態** | 📐 PLANNED |
| **優先級** | 🔴 High |
| **類型** | 技術改善 |
| **建立時間** | 2026-04-20 |
| **建立者** | Gower |
| **驅動契機** | Selene 在 devcontainer(Debian 12)環境實測,`$WT_SESSION` 和 `$TERM_PROGRAM` 皆空 → auto-session 降級為文字提示。Selene 主力使用 macOS + devcontainer,此為日常阻塞點。 |

---

## 動機 / 背景

目前 `auto-session` 終端偵測僅支援兩個環境:
- `$WT_SESSION` → Windows Terminal
- `$TERM_PROGRAM` → VS Code / macOS Terminal

其他情境一律落到「未知終端」→ 降級剪貼簿 → 降級文字提示。

**實際阻塞**:
- macOS + devcontainer:`$TERM_PROGRAM` 不穿透進容器,導致明明在 VS Code Remote 也偵測不到
- WSL:`$WT_SESSION` 可能可見但行為與純 Windows Terminal 不同(剪貼簿需 `clip.exe`)
- Linux 原生桌面:GNOME Terminal / Konsole / Alacritty / Kitty 沒有統一的偵測變數
- tmux / screen:即使外層是已知終端,內層也會影響新分頁指令
- SSH:完全無法開新分頁,但剪貼簿可能 via OSC 52 或 SSH forwarding

**目標**:
1. 擴大偵測覆蓋面,讓 Selene(macOS + devcontainer)和其他常用環境都能走 on / yolo 路徑
2. 每層降級都有明確行為(不要全部掉到文字提示)
3. 完整整合 BAT 的 `off` / `ask` / `on` / `yolo` 四種模式

---

## 涵蓋範圍(使用者確認「最好常用都要支援」)

### A. macOS(Selene 主力環境)
- **原生 Terminal.app**:`$TERM_PROGRAM=Apple_Terminal`(已支援)
- **iTerm2**:`$TERM_PROGRAM=iTerm.app`(需驗證分頁指令)
- **Warp**:`$TERM_PROGRAM=WarpTerminal`(新增)
- **Alacritty / Kitty**:無 `$TERM_PROGRAM`,需透過 `$TERM` 或程序偵測
- **tmux 於 macOS**:`$TMUX` 存在時改用 `tmux new-window`

### B. devcontainer(Selene 主力環境)
- 偵測變數:`$REMOTE_CONTAINERS=true` 或 `$CODESPACES=true`
- 行為:VS Code 端無法從容器內 shell 直接開新分頁;需與 VS Code 整合(或降級剪貼簿 + OSC 52)
- 剪貼簿:`xclip` / `xsel` 通常無 X server;改用 OSC 52 escape sequence 寫入宿主剪貼簿

### C. WSL
- 偵測變數:`$WSL_DISTRO_NAME` / `$WSL_INTEROP`
- 行為:`$WT_SESSION` 可能穿透,可用 `wt.exe -w 0 nt wsl ~ -e claude`
- 剪貼簿:`clip.exe`(WSL → Windows 剪貼簿)

### D. Linux 原生桌面
- GNOME Terminal:`gnome-terminal --tab -- claude "..."`
- Konsole:`konsole --new-tab -e ...`
- Alacritty / Kitty:各有自己的 remote control API
- 剪貼簿:`wl-copy`(Wayland)/ `xclip -selection clipboard`(X11)

### E. tmux / screen
- 偵測變數:`$TMUX` / `$STY`
- 行為:`tmux new-window 'claude "/ct-exec T####"'` / `screen -X screen claude ...`
- 剪貼簿:tmux buffer(`tmux set-buffer`)或延用宿主

### F. SSH 遠端 session
- 偵測變數:`$SSH_CONNECTION` / `$SSH_TTY`
- 行為:無法開新分頁;剪貼簿走 OSC 52(若 terminal 支援)
- 降級:顯示指令提示 + 給使用者剪貼簿替代選項

---

## 完整 BAT 整合目標(使用者確認「off → ask → on → yolo 都要支援」)

| Mode | 需求行為 |
|------|---------|
| `off` | 不開新 session,顯示指令提示 |
| `ask` | 偵測終端後詢問使用者(A 開新分頁 / B 剪貼簿 / C 文字) |
| `on` | 自動開新分頁;失敗 fallback 剪貼簿;再失敗 fallback 文字 |
| `yolo` | 同 `on`,加上 Worker 自動送出完成訊息 + 塔台自主判定下一張 |

**每個偵測到的終端都要能跑完上述四模式**,而不是只有 Windows Terminal 走 on/yolo、其他都只能 ask。

---

## 技術路徑初步盤點(非定案,僅供 PLANNED 階段拆解)

### 偵測層(優先順序由具體到寬鬆)
1. `$BAT_SESSION=1` → BAT 內部終端(已存在,最特定)
2. `$REMOTE_CONTAINERS` / `$CODESPACES` → devcontainer
3. `$TMUX` / `$STY` → tmux/screen(先於外層終端)
4. `$WSL_DISTRO_NAME` → WSL
5. `$WT_SESSION` → Windows Terminal
6. `$TERM_PROGRAM` → VS Code / macOS Terminal / iTerm2 / Warp
7. `$SSH_CONNECTION` → SSH session
8. `$TERM` + 程序偵測 → Linux 原生桌面終端
9. Fallback → 剪貼簿 → 文字提示

### 剪貼簿層(按平台)
- macOS:`pbcopy`
- Linux Wayland:`wl-copy`
- Linux X11:`xclip -selection clipboard` / `xsel --clipboard`
- WSL:`clip.exe`
- devcontainer / SSH:OSC 52 escape sequence
- Windows(Git Bash):`clip` / `pwsh Set-Clipboard`

### 新分頁指令層(按終端)
- Windows Terminal:`wt -w 0 nt claude "..."`
- VS Code:無原生 CLI,需透過 workbench API(或降級剪貼簿)
- macOS Terminal:`open -a Terminal` + AppleScript
- iTerm2:AppleScript / Python API
- GNOME Terminal:`gnome-terminal --tab -- bash -c '...'`
- Konsole:`konsole --new-tab -e ...`
- tmux:`tmux new-window`
- screen:`screen -X screen`

---

## 拆解(T0224 研究收斂版)

研究工單 T0224 ✅ DONE(2026-04-20,`aea9373`)已收斂拆單為 **4 張主 + 2 張可選**。

### 主線(相依圖)

```
T0225 ──┬──→ T0226 ──┐
        │            ├──→ T0228(Selene 整合驗證)
        └──→ T0227 ──┘
```

| 編號 | 範圍 | 優先級 | 預估 | 相依 | 類型 |
|------|------|--------|------|------|------|
| **T0224** | 研究:偵測矩陣 + 決策樹 + 拆單建議 | 🔴 | 9 min / est 60-90 | — | ✅ research DONE |
| **T0225** | 核心偵測層重構(A.2 決策樹實作) | 🔴 阻擋 | 60-90 min | 無 | implementation |
| **T0226** | 開新分頁指令擴展(17 終端 × B 面矩陣) | 🟡 | 90-120 min | T0225 | implementation |
| **T0227** | 剪貼簿層擴展 + OSC 52(C 面矩陣) | 🟡 | 60-90 min | T0225 | implementation(可與 T0226 並行) |
| **T0228** | Selene devcontainer 主場景整合驗證 | 🔴 收斂 | 30-60 min | T0225+T0226+T0227 | integration |

### 可選延伸

| 編號 | 範圍 | 觸發條件 |
|------|------|---------|
| T0229 | Warp / Alacritty daemon / Kitty remote control 深度 | 使用者實際使用任一 + 需要 on 模式(非剪貼簿) |
| T0230 | SSH 場景端到端驗證 | 使用者從 SSH 跳板機派工單 + OSC 52 穿透測試 |

---

## 驗收標準(概念層,PLANNED 時細化)

1. **Selene 主場景**:macOS + devcontainer 能走 on/yolo 模式(或至少 OSC 52 剪貼簿),不再落到文字提示
2. **WSL**:`auto-session: on` 能開 Windows Terminal 分頁跑 wsl
3. **Linux 桌面**:至少 GNOME Terminal + Konsole 能開新分頁
4. **tmux**:外層無論什麼終端,tmux 內都能開新 window
5. **SSH**:明確降級到 OSC 52 剪貼簿或文字提示,不假裝能開分頁
6. **環境偵測面板**:Fast Path / Full Scan 準確顯示當前終端類型,不再只顯示「未知」

---

## 引用 / 相關

- `auto-session.md` reference(現行偵測邏輯)
- `yolo-mode.md` reference(yolo 模式需相依終端支援)
- BUG-050 樣本累積(YOLO clean 案例,目前 7/10)

---

## 塔台筆記

- 2026-04-20:使用者在 devcontainer(Debian 12)實測發現偵測落空,Selene 觸發登記
- 優先級 High 的關鍵理由:**Selene 主力環境**受阻,等同塔台高頻互動場景不順
- **2026-04-20**:使用者選 A,IDEA → **PLANNED**,派 T0224 研究工單盤點各環境偵測矩陣

## 關聯工單

- **T0224**(research,✅ DONE `aea9373`)— 跨平台終端偵測矩陣盤點 + 拆單建議
- **T0225**(implementation,📋 TODO,建立中)— 核心偵測層重構
- T0226 / T0227 / T0228:T0225 完成後再建(避免 stale)或使用者要求一次建齊
- T0229 / T0230:可選,視 T0226 / T0228 結果決定是否啟動

## 研究結論精要(來自 T0224)

- **20 個環境變數 + 10 Step 決策樹**:BAT_SESSION > CODESPACES/REMOTE_CONTAINERS > SSH > tmux/screen > WSL > WT > TERM_PROGRAM > Linux 桌面變數
- **OSC 52 穿透**:**VS Code 1.79+(含 Remote-SSH / Remote-Containers)**、iTerm2、WT、Kitty、Alacritty、WezTerm、GNOME 3.36+、Konsole 22.04+
- **最大缺口**:macOS Terminal.app **預設不支援 OSC 52**(需換 iTerm2 / WezTerm / Warp)
- **Selene 主場景**(macOS + VS Code + devcontainer)**可走 on 模式**:透過 OSC 52 穿透至 macOS host 剪貼簿
- **🔴 高風險 R4**:VS Code 現行「走 claude 依賴自動開 tab」實測可疑,T0225 要先驗證
- 詳細矩陣見 T0224 工單回報區
