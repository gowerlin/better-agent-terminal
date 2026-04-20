# T0226 — 實作:PLAN-025 開新分頁指令擴展(B 面)

## 元資料

- **編號**:T0226
- **類型**:implementation
- **狀態**:📋 TODO
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
