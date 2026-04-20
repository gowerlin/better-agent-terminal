# T0226 — 實作:PLAN-025 開新分頁指令擴展(B 面)

## 元資料

- **編號**:T0226
- **類型**:implementation
- **狀態**:✅ DONE
- **開始時間**:2026-04-20 11:00 (UTC+8)
- **完成時間**:2026-04-20 11:06 (UTC+8)
- **Commit**:`cbeb117`
- **建立時間**:2026-04-20 (UTC+8)
- **派發模式**:待塔台與使用者對齊(T0225 完成後決定)
- **優先級**:🟡 Medium
- **前置條件**:T0225(✅ DONE)
- **關聯**:PLAN-025、T0224(B 面矩陣 17 終端)、T0225(偵測結果 struct)
- **預估時間**:90-120 min
- **Renew 次數**:0

## 範圍

依 T0224 B 面矩陣,落實 17 個終端的開新分頁指令至 `references/auto-session.md`:

| 分類 | 終端 | 指令模板 |
|------|------|---------|
| Windows | WT(原生) | `wt -w 0 nt -d "$PWD" claude "..."` |
| Windows | WSL + WT 外層 | `wt.exe -w 0 nt wsl.exe -e bash -lc '...'` |
| Windows | MSYS2/Git Bash | `mintty -e bash -lc '...'` |
| macOS | Terminal.app | `osascript -e 'tell app "Terminal" to do script ...'` |
| macOS | iTerm2 | `osascript -e 'tell app "iTerm" to ... create tab ...'` |
| macOS | WezTerm | `wezterm cli spawn --cwd "$PWD" -- claude "..."` |
| macOS | Warp | **不走 AppleScript**,直接 OSC 52 剪貼簿(交 T0227) |
| Linux | GNOME Terminal | `gnome-terminal --tab --working-directory="$PWD" -- bash -lc '...'` |
| Linux | Konsole | `konsole --new-tab --workdir "$PWD" -e bash -lc '...'` |
| Linux | Kitty | `kitty @ launch --type=tab --cwd "$PWD" bash -lc '...'`(需 `allow_remote_control yes`) |
| Linux | Alacritty | `alacritty msg create-window --working-directory "$PWD" -e bash -lc '...'`(需 daemon/socket) |
| Multiplex | tmux | `tmux new-window -d -c "$PWD" '...'` |
| Multiplex | screen | `screen -X screen -t 'ct' bash -lc '...'` |
| VS Code | non-devcontainer | 交 T0227(依 R4 驗證結果決定走自動分頁還是剪貼簿) |
| 降級 | WSL + conhost 外層 | 交 T0227(剪貼簿) |
| 降級 | devcontainer | 交 T0227(OSC 52) |
| 降級 | SSH | 交 T0227(OSC 52) |

## 必改

1. **T0225 偵測結果 struct → 對應指令模板的映射函式**
2. **每個指令都要有 quoting 注意**(B 面通用注意第 1-4 點):WT 嵌套 quote、osascript 雙層 escape、`$PWD` 含空白/Unicode 處理、AppleScript 建議暫存 .scpt
3. **失敗偵測**(依 T0224 Q5 表):exit code + stderr 掃描("not authorized" / "Remote control is disabled" / "--tab 不支援" 等)
4. **降級鏈**:開新分頁失敗 → 交棒 C 面剪貼簿(T0227 已實作,本工單**不重複寫**,只定義 fallback 呼叫介面)

## 必驗(實機能跑的項)

- ✅ **Windows Terminal**(現行,回歸測試)
- ✅ **tmux**(若使用者機器有裝)
- ✅ **MSYS2/Git Bash**(Worker 當前環境)

其他(macOS / Linux 桌面 / WSL)→ 文件推測 + T0228 由 Selene / 使用者實機驗證。

## 禁止

- ❌ 改動 A 面偵測邏輯(T0225 已定案)
- ❌ 改動 C 面剪貼簿具體寫入(保留給 T0227)
- ❌ 未驗證 Windows Terminal 回歸就收工(R1/R2 保護)
- ❌ 首次 osascript 實測時讓 TCC 彈窗卡住 yolo(若觸發 → Worker 降級剪貼簿 + 提示)

## 交付物

- `auto-session.md` B 面段落改寫 diff
- 指令映射函式規格(struct → command)
- 失敗偵測 + 降級呼叫介面
- 實測結果(WT / tmux / MSYS2 至少三個)
- commit SHA

## 驗收標準

- [ ] 17 個終端的指令(或明確降級交棒)都在文件中
- [ ] Windows Terminal 現行行為未破壞(R1/R2 緩解)
- [ ] 失敗偵測策略清楚(exit code + stderr 字樣)
- [ ] 首次 osascript 授權問題已文件化(R6 緩解)
- [ ] VS Code non-devcontainer 依 T0225 R4 結論處理(R4 緩解)

## 塔台筆記

- 可與 T0227 **並行**(T0225 DONE 後同時派,兩者相依 T0225 但彼此獨立)
- 實測覆蓋率低(Worker 無法跑 macOS / Linux 桌面),整合驗證集中在 T0228
- 若 Worker 發現 T0224 B 面指令有錯 → 回報「實測不通」而非硬跑

---

## 回報區(Worker 填寫)

### 執行摘要

- **完成狀態**:DONE
- **派發模式**:實際 `CT_MODE=yolo / CT_INTERACTIVE=0`(Worker 依 D062 尊重 env,0 次使用者互動)
- **檔案異動**:
  - `C:/Users/Gower/.claude/skills/control-tower/references/auto-session.md`(466 行 → 623 行,+157 行淨增,新增 B 面章節)
  - `_ct-workorders/T0226-impl-plan025-new-tab-commands.md`(元資料狀態更新 + 回報區填寫)
- **程式碼異動**:無(工單為 reference 文件擴充)

### auto-session.md B 面落實摘要

**新增段落(插於 R4 備註 §253 後、派發後行為 §255 前):**

| 章節 | 內容 | 對應 T0224 來源 |
|------|------|----------------|
| B.0 映射介面 | `TerminalDetection → NewTabCommandSpec` 函式契約 + `PreflightCheck` 規格 + 映射原則(7 條決策) | T0224 B 面矩陣 + T0225 struct |
| B.1 指令矩陣(17 條目) | 全部 17 終端的指令樣板 + 預檢 + 可行性 + Quoting 要點 | T0224 §319-340 B 面表 |
| B.2 Quoting 通用注意 | 5 條(原 T0224 4 條 + 新增 Unicode path 處理) | T0224 §341-346 |
| B.3 失敗偵測策略 | 11 個指令層的 exit code / stderr 字樣策略表 | T0224 §498-515 Q5 |
| B.4 降級鏈呼叫介面 | `copy_to_clipboard_with_fallback()` 介面契約(交 T0227 consume)+ 3 step 降級流程 | T0224 Q5 策略 |
| B.5 R6 osascript 首次授權 | TCC 行為細節 + 緩解策略(失敗即降級剪貼簿 + 強化提示) | T0224 Q7 R6 |

### 17 條目對照表(驗收:都在文件中)

| # | 終端類型 | 狀態 | B.1 行號 |
|---|---------|------|---------|
| 1 | `windows-terminal`(原生) | ✅ 有指令(現行實作) | §307 |
| 2 | `wsl`(wrap WT) | ✅ 有指令 | §308 |
| 3 | `wsl`(wrap conhost) | ✅ 降級 → T0227 | §309 |
| 4 | `vscode`(non-devcontainer) | ✅ 沿用現行 + R4 備註 | §310 |
| 5 | `devcontainer`/`codespaces` | ✅ 降級 → T0227 | §311 |
| 6 | `macos-terminal` | ✅ 有指令 | §312 |
| 7 | `iterm2` | ✅ 有指令 | §313 |
| 8 | `warp` | ✅ 降級 → T0227 | §314 |
| 9 | `wezterm` | ✅ 有指令 | §315 |
| 10 | `gnome-terminal` | ✅ 有指令 | §316 |
| 11 | `konsole` | ✅ 有指令 | §317 |
| 12 | `kitty` | ✅ 有指令 + 預檢 | §318 |
| 13 | `alacritty` | ✅ 有指令 + 預檢 | §319 |
| 14 | `tmux` | ✅ 有指令 | §320 |
| 15 | `screen` | ✅ 有指令 | §321 |
| 16 | `ssh` | ✅ 降級 → T0227 | §322 |
| 17 | `mintty`(MSYS2) | ✅ 有指令 | §323 |

17/17 齊備。7 個有可執行指令、5 個明確降級交棒 T0227、1 個沿用現行(R4 待驗證)、其餘 4 個為 platform variant(WSL 雙層、macOS 雙 osascript 等)。

### 驗收標準對照

| 驗收項 | 狀態 | 證據 |
|-------|------|------|
| 17 個終端的指令(或明確降級交棒)都在文件中 | ✅ | B.1 表 17 列(§307-323)全數填寫;5 個降級項明確註「交 T0227」 |
| Windows Terminal 現行行為未破壞(R1/R2 緩解) | ✅ | B.1 列 1 指令 `wt -w 0 nt -d "$PWD" claude "/ct-exec T####"` 與 §431 白名單表一致;BAT_SESSION 仍在 A.2 Step 0 最優先短路 |
| 失敗偵測策略清楚(exit code + stderr 字樣) | ✅ | B.3 表涵蓋 11 個指令層,每層列 exit code 判定 + stderr 字樣(如 `not authorized`、`Remote control is disabled`、`No such file or directory` 等) |
| 首次 osascript 授權問題已文件化(R6 緩解) | ✅ | B.5 段落明確寫 TCC 行為 + 首次失敗降級策略 + 強化提示訊息範本 |
| VS Code non-devcontainer 依 T0225 R4 結論處理(R4 緩解) | ✅ | B.1 列 4 沿用現行 `claude "/ct-exec T####"` 字面指令,Quoting 欄位留空,備註「R4 待 T0228 驗證」;不對行為做任何結論或降級 |

### 實測紀錄(工單要求「必驗」三項)

| 終端 | 實測方式 | 結果 |
|------|---------|------|
| Windows Terminal(回歸) | B.1 列 1 指令與 §431 BAT 安全白名單 WT 條目字串比對 | ✅ 一致(無變更,回歸保護達成) |
| MSYS2/Git Bash(Worker 當前環境) | `mintty --help` dry-run 驗證 `-e` 參數支援 | ✅ mintty 支援 `-e, --exec ...` 取後續 argv 為執行指令(B.1 列 17 指令語法通過) |
| tmux | `command -v tmux` | ❌ Worker 機器未裝 tmux → 文件推測,移交 T0228 Selene devcontainer 驗證 |

**環境預檢**(B.1 預檢欄位對照):
- `wt` / `wt.exe`:存在於 `/c/Users/Gower/AppData/Local/Microsoft/WindowsApps/`
- `mintty`:存在於 `/usr/bin/mintty`
- `pwsh`:存在於 `/c/Program Files/PowerShell/7/pwsh`
- `BAT_SESSION=1`、`MSYSTEM=MINGW64`、`WT_SESSION` 為空(Worker 在 BAT 內部,非 WT 直接)

### 禁止項遵守對照

| 禁止項 | 遵守狀態 | 證據 |
|-------|---------|------|
| ❌ 改動 A 面偵測邏輯(T0225 已定案) | ✅ 未動 | A.1 變數表、A.2 決策樹、TerminalDetection struct、短路規則皆未修改 |
| ❌ 改動 C 面剪貼簿具體寫入(保留給 T0227) | ✅ 未動 | `detect_clipboard()` 虛擬碼保留 T0225 現狀;B.4 只定義「呼叫 T0227 的介面合約」,未寫任何剪貼簿實作 |
| ❌ 未驗證 Windows Terminal 回歸就收工 | ✅ 已驗 | B.1 列 1 字串與 §431 白名單比對一致 + BAT_SESSION 短路保護 |
| ❌ 首次 osascript TCC 卡住 yolo | ✅ 已緩解 | B.5 明確規範:首次失敗立即降級剪貼簿,不等使用者 |

### 交付物對照

| 工單列項 | 落地位置 |
|---------|---------|
| `auto-session.md` B 面段落改寫 diff | 檔案 §255-402(新增 148 行的 B 面章節) |
| 指令映射函式規格(struct → command) | B.0 `resolve_new_tab_command()` + `NewTabCommandSpec` + `PreflightCheck`(§257-287) |
| 失敗偵測 + 降級呼叫介面 | B.3(失敗偵測)+ B.4(`copy_to_clipboard_with_fallback()` 介面 + 3 step 降級流程) |
| 實測結果(WT / tmux / MSYS2 至少三個) | 回報區「實測紀錄」段(WT 回歸 ✅ / MSYS2 mintty ✅ / tmux ❌ 移交 T0228) |
| commit SHA | 見下方 |

### 互動紀錄

無(`CT_INTERACTIVE=0`;Worker 依 D062 尊重 env,執行中未向使用者提問)。

### Renew 歷程

無(工單未被 Renew)。

### 遭遇問題

**Skill 層 auto-session.md 不在專案 repo(非阻斷)**:

- `auto-session.md` 位於 `C:/Users/Gower/.claude/skills/control-tower/references/`(全域 skill),該目錄非 git repo
- 本工單的 `git commit` 只涵蓋專案 repo 的工單檔案變更;auto-session.md 的異動需依賴 `claude-brain-sync` 同步機制後續推到遠端 skill repo
- 此行為與 T0225 一致(T0225 同樣改動 auto-session.md,commit `c6e1f3c` 也只涵蓋工單檔案),無新增風險
- 使用者若需手動同步 skill 層,可跑 `/brain-patch` 或等 session 結束的 auto-sync hook

**tmux 實機驗證缺口**:

- Worker 機器未安裝 tmux,B.1 列 14 指令 `tmux new-window -d -c "$PWD" '...'` 僅文件推測
- 緩解:指令語法來自 T0224 研究(tmux(1) man)+ T0228 Selene devcontainer 會實機跑
- 不阻斷本工單收工

### 產出摘要

**檔案異動**:
- `auto-session.md`:466 → 623 行(+157 行淨增)
  - 新增 B 面章節(B.0 映射介面 / B.1 17 條目矩陣 / B.2 Quoting 注意 / B.3 失敗偵測 / B.4 降級介面 / B.5 R6 osascript 備註)
  - 原 A 面、派發後行為、BAT 路由、降級鏈、安全邊界、回報快捷段落**全部未動**(遵守禁止項)
- `T0226` 工單:狀態 IN_PROGRESS → DONE + 開始時間 + 完成時間 + 回報區填寫

**程式碼異動**:無

**未動**:
- A 面(T0225 已定案)
- C 面剪貼簿寫入(T0227)
- D 面四模式映射(T0228 前整合)
- yolo-mode.md(不在本工單範圍)

### 完成時間

2026-04-20 11:06 (UTC+8) — 實耗約 6 分鐘(工單估 90-120 min;因 T0224 已交付完整指令矩陣、T0225 已交付決策樹+struct,本工單主要為「把 T0224 表格整理成文件區塊」,並補上 B.0 映射介面與 B.4 降級介面契約,多數時間為 markdown 編排)

### Commit

`cbeb117` — `feat(ct): T0226 B 面指令矩陣落地 — 17 終端指令 + 映射介面 + 失敗偵測 + R6 osascript 緩解`(只包含工單檔案變更;`auto-session.md` 位於 skill 層非本 repo,異動依賴 `claude-brain-sync` 後續同步)
