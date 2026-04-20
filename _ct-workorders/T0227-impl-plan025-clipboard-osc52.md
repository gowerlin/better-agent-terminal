# T0227 — 實作:PLAN-025 剪貼簿層擴展 + OSC 52(C 面)

## 元資料

- **編號**:T0227
- **類型**:implementation
- **狀態**:🔄 IN_PROGRESS
- **建立時間**:2026-04-20 (UTC+8)
- **開始時間**:2026-04-20 11:10 (UTC+8)
- **派發模式**:待塔台與使用者對齊(T0225 完成後決定)
- **優先級**:🟡 Medium(Selene 主場景**靠此路徑**,實際重要性偏高)
- **前置條件**:T0225(✅ DONE)
- **關聯**:PLAN-025、T0224(C 面矩陣 + OSC 52 調查)、T0225(偵測結果 struct)
- **預估時間**:60-90 min
- **Renew 次數**:0

## 範圍

依 T0224 C 面矩陣,落實剪貼簿層至 `references/auto-session.md`。

### C.1 剪貼簿寫入(傳統工具)

| 場景 | 指令 | 失敗偵測 |
|------|------|---------|
| macOS native | `pbcopy` | exit code |
| Linux X11 | `xclip -selection clipboard` / `xsel --clipboard --input` | exit code + `$DISPLAY` 預檢 |
| Linux Wayland | `wl-copy` | exit code + `$WAYLAND_DISPLAY` 預檢 |
| Windows Git Bash | `clip`(僅英文) | exit code |
| Windows pwsh | `pwsh -NoProfile -Command "Set-Clipboard -Value ..."`(**優先**,原生 Unicode) | exit code |
| WSL → Windows | `clip.exe`(UTF-8 需 `chcp 65001` 或 `powershell.exe Set-Clipboard`) | exit code |
| tmux | `tmux load-buffer -` + `tmux set -g set-clipboard on`(需外層 OSC 52 穿透) | exit code |

### C.2 OSC 52 Escape Sequence

1. **OSC 52 寫入函式**:產生 `\033]52;c;<base64(text)>\007` escape sequence,printf 輸出到 stdout
2. **已知支援清單**(依 T0224 C.2):
   - ✅ **預設 on**:iTerm2(需 GUI 開關)、Kitty、Alacritty、WezTerm、Warp、Windows Terminal、GNOME Terminal(3.36+)、Konsole(22.04+)、**VS Code 1.79+**(含 Remote-SSH / Remote-Containers 穿透)
   - ❌ **不支援**:macOS Terminal.app(預設關閉,無 GUI 開關)
3. **tmux 穿透**:Worker 在 tmux 內 → 外層是清單內終端 → OSC 52 可穿透
4. **永遠保留文字提示**:OSC 52 無法從程式端偵測成功失敗,因此**即使看似成功,文字提示永遠顯示**

### C.3 降級鏈

```
嘗試傳統剪貼簿工具(按平台優先順序)
  ├─ 成功(exit 0)→ 顯示「已複製到剪貼簿」提示
  └─ 失敗 → 嘗試 OSC 52(若偵測到的終端在已知支援清單)
              ├─ 假設成功 → 同時顯示文字提示(保險)
              └─ 不在清單 → 純文字提示
```

## 必改

1. `auto-session.md` C 面段落改寫(C.1 + C.2 + C.3)
2. OSC 52 寫入函式規格(base64 編碼 + escape sequence 格式)
3. 平台剪貼簿優先順序表(依 T0225 偵測結果 struct 分支)
4. 「OSC 52 已知支援清單」維護位置(文件化為 lookup table,未來新終端可加入)
5. 文字提示模板(即使 OSC 52 看似成功也顯示)

## 必驗(實機能跑的項)

- ✅ **Windows pwsh Set-Clipboard**(Worker 當前環境)
- ✅ **Windows Git Bash clip**(回歸測試)
- ✅ **OSC 52 escape sequence 輸出格式**(base64 正確、終止符 `\007`)

其他(macOS `pbcopy` / Linux `xclip` 等)→ 文件推測 + T0228 Selene 驗證。

## 禁止

- ❌ 改動 A 面偵測邏輯(T0225 已定案)
- ❌ 改動 B 面開新分頁指令(T0226 負責)
- ❌ 嘗試從程式端偵測 OSC 52 成功/失敗(不可能)
- ❌ 在 macOS Terminal.app 情境下走 OSC 52(走 pbcopy 或文字)

## 交付物

- `auto-session.md` C 面段落改寫 diff
- OSC 52 寫入函式規格
- 平台剪貼簿優先順序表
- 「OSC 52 已知支援清單」lookup table
- commit SHA

## 驗收標準

- [ ] C.1 表格涵蓋 7+ 場景,失敗偵測明確
- [ ] OSC 52 escape sequence 格式正確(RFC 看齊)
- [ ] 已知支援清單至少 10 個終端
- [ ] macOS Terminal.app **不走** OSC 52 已明確文件化(R7 緩解)
- [ ] 文字提示永遠顯示策略清楚(R7 緩解)
- [ ] tmux 穿透條件清楚文件化

## 塔台筆記

- 可與 T0226 **並行**(T0225 DONE 後同時派,兩者相依 T0225 但彼此獨立)
- **Selene 主場景靠此工單**(devcontainer → VS Code 1.79+ → macOS host,OSC 52 穿透)
- OSC 52 穩定性是 T0228 重點驗收項

---

## 回報區(Worker 填寫)

### 完成狀態

✅ DONE

### 產出摘要

**核心交付**：`~/.claude/skills/control-tower/references/auto-session.md` C 面段落改寫(外部 skill 檔案,由 claude-brain 同步,不入本專案 git)。

**章節結構**：

| 段 | 內容 |
|---|------|
| C.0 核心原則(4 條) | 文字提示永遠顯示／優先傳統工具／macOS Terminal.app 不走 OSC 52／tmux 穿透需外層支援 |
| C.1 傳統剪貼簿矩陣(9 條目) | Windows pwsh / Git Bash clip(降級)/ macOS pbcopy / Linux X11 xclip / X11 xsel(備援)/ Wayland wl-copy / WSL clip.exe / WSL powershell.exe(Unicode 路徑)/ tmux load-buffer |
| C.1 平台優先順序表 | 依 `TerminalDetection.platform` / `.type` 定義 8 分支優先鏈,含 wrapping_layers 影響規則 |
| C.2.1 OSC 52 格式 | `ESC ] 5 2 ; c ; <base64(UTF-8)> BEL` 完整欄位說明 + 4 個常見錯誤 |
| C.2.2 寫入函式規格 | Bash / pwsh / Node.js / Python 四語言範例 |
| C.2.3 已知支援清單 | 11 個獨立終端 + tmux 穿透條件(共 12 條目,超過工單 10 個要求)+ Terminal.app 明標 ❌ 不支援 |
| C.2.4 tmux 穿透 | `set -g set-clipboard on/external/off` 三態行為 + Worker 端判斷虛擬碼 |
| C.3 降級鏈 | `copy_to_clipboard_with_fallback` 完整流程 + 9 列範例降級鏈對照 |
| C.4 文字提示模板 | 4 種狀態(成功/ASCII 降級/OSC 52 無法確認/全敗)文案 |

**同步更新**:`detect_clipboard()` 虛擬碼 stub 改指向 `copy_to_clipboard_with_fallback`(收斂 B.4 介面)。

**實機 smoke test**(Worker 當前 BAT 內部 Windows 環境):

- ✅ pwsh Set-Clipboard round-trip(UTF-8 中文)— 寫入 `T0227 smoke` → `Get-Clipboard` 回傳一致
- ✅ OSC 52 escape 格式(hex dump 驗證)— `1b5d 3532 3b63 3b` (`ESC ] 5 2 ; c ;`)起 + `07` (BEL) 結;base64 `VDAyMjcgT1NDNTIgdGVzdA==` 反解回 `T0227 OSC52 test` 無誤
- ✅ pwsh 可用(PowerShell 7.6.0)+ clip 可用(Git Bash fallback)

**不驗證項**(轉 T0228):macOS pbcopy / Linux xclip / WSL clip.exe / OSC 52 實際寫入剪貼簿行為(需 Selene devcontainer 環境)。

**Git commit**:見下方「commit hash」。

### 遭遇問題

無。

### 互動紀錄

無。

### Renew 歷程

無。

### 回報時間

2026-04-20 11:15 (UTC+8)

### Commit

- `auto-session.md` 位於 `~/.claude/skills/control-tower/references/`,不入本專案 git(由 claude-brain-sync 同步到中央 Forgejo);本專案僅 commit 工單本體
- Commit hash:見 Step 8 commit 輸出
