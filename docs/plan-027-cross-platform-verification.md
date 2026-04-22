# PLAN-027 跨平台驗證 Playbook

> 產出單元:T0233(PLAN-027 Phase 1 #4)— Worker 僅能實測 Windows,本文為 macOS / Linux 的手動驗證清單。
> 目標讀者:Selene / 未來其他平台使用者。

## 適用範圍

- 版本:PLAN-027 Phase 1(T0230 + T0231 + T0232 合併完成)
- 檢查標的:BAT Settings → Advanced → **Claude Runtime** 切換功能
- 預期結果:在各平台都能偵測系統 `claude`、Browse 選檔、fallback/degraded toast 正確顯示

---

## macOS(Intel / Apple Silicon)

### 環境準備

1. **裝系統 claude**(官方推薦):

   ```bash
   # Homebrew(Apple Silicon 裝到 /opt/homebrew/bin)
   brew install --cask anthropic-claude   # 若已加入 Homebrew
   # 或官方安裝腳本
   curl -fsSL https://claude.com/install.sh | bash
   ```

   預期:`~/.local/bin/claude`(腳本預設)或 `/opt/homebrew/bin/claude`(Homebrew Apple Silicon)。

2. **確認 PATH**:

   ```bash
   which claude
   claude --version     # 應輸出 `X.Y.Z (Claude Code)`
   ```

3. **最低版本**:`2.1.111`(healthy 門檻)。`2.0.0 – 2.1.110` 會收 version-warning toast 但仍可用;< `2.0.0` 一律 fallback 或拒絕。

### 驗證 Checklist(5 條)

- [ ] **M-1**:`system` 模式 + customPath 空白 → Settings 面板 health pill 顯示 `Healthy` + 版本號
- [ ] **M-2**:Browse button 開啟原生檔案對話框;選 `/opt/homebrew/bin/claude` → customPath 欄位更新 + pill 立即刷新
- [ ] **M-3**:開新 session(workspace → `+` → Claude Agent)能正常對話,logger 顯示 `claudeCodePath=/opt/homebrew/bin/claude (source=system)`
- [ ] **M-4**:故意設 customPath 指到不存在路徑 + `fallbackToEmbedded: true` → 收到「Runtime degraded → embedded」toast + 新 session 仍能用
- [ ] **M-5**:Settings `fallbackToEmbedded: false` + 壞 customPath → 開 session 顯示錯誤 toast,拒絕啟動(無 crash)

### 失敗如何回報

在各 checklist 旁記錄:
- 期望 vs 實際
- `logger.log` 相關片段(`~/Library/Application Support/better-agent-terminal/debug.log`)
- 系統資訊:`uname -a` + `echo $PATH`

---

## Linux(Ubuntu / Fedora / Arch)

### 環境準備

1. **裝系統 claude**:

   ```bash
   # 官方安裝腳本(推薦)
   curl -fsSL https://claude.com/install.sh | bash
   # 預設裝到 ~/.local/bin/claude
   ```

   **確認 `~/.local/bin` 在 PATH**:部分發行版預設不包含,需手動加入 `~/.bashrc`/`~/.zshrc`:
   ```bash
   export PATH="$HOME/.local/bin:$PATH"
   ```

2. **確認 PATH**:

   ```bash
   which claude
   claude --version
   ```

3. **AppImage / Flatpak BAT 注意事項**:BAT 若從 AppImage 啟動,子進程 PATH 可能被 AppImage runtime 過濾。若 M-1 偵測失敗,以 customPath 手動指定 `/home/<user>/.local/bin/claude` 繞開。

### 驗證 Checklist(5 條)

- [ ] **L-1**:`system` 模式 + customPath 空白 → Settings pill 顯示 `Healthy` + 版本號
- [ ] **L-2**:Browse → 選 `~/.local/bin/claude`(對話框若不支援 `~` 展開,手動輸入 customPath) → pill 刷新
- [ ] **L-3**:開 session 能對話,logger 顯示正確 `source=system` + path
- [ ] **L-4**:壞 customPath + fallback=true → degraded toast + fallback 到內嵌
- [ ] **L-5**:壞 customPath + fallback=false → 錯誤 toast,session 無法啟動

### 失敗如何回報

- `uname -a` + `echo $PATH`
- logger 位置:`~/.config/better-agent-terminal/debug.log`
- 如果是 AppImage,附加 `APPIMAGE=<path>` 環境輸出

---

## 已知平台差異

| 議題 | Windows | macOS | Linux |
|------|---------|-------|-------|
| binary 名稱 | `claude.exe` / `claude.cmd` / `claude.bat` | `claude` | `claude` |
| `.exe` 優先 | ✅(T0230 AC-4,實測 T0233 通過) | N/A | N/A |
| `.cmd` / `.bat` shim probe | ⚠️ Node 20+ EINVAL(見 BUG-053) | N/A | N/A |
| 常見安裝路徑 | `%USERPROFILE%\.local\bin\`、`%APPDATA%\npm\` | `/opt/homebrew/bin`、`/usr/local/bin`、`~/.local/bin` | `~/.local/bin`、`/usr/local/bin` |
| PATH 展開 `~` | 不適用 | ✅(Shell 展) | ✅(Shell 展) |
| Gatekeeper / 簽章 | Windows Defender SmartScreen(首次執行可能阻擋) | macOS Gatekeeper(首次 `--version` 呼叫可能跳授權 toast) | 無 |

---

## 邊界情境

### macOS Gatekeeper toast

首次 spawn `/opt/homebrew/bin/claude` 可能觸發「無法驗證開發者」對話框。
處理:
1. 系統設定 → 隱私權與安全性 → 允許一次
2. 或執行 `xattr -dr com.apple.quarantine /opt/homebrew/bin/claude`
3. 通過後 BAT 下次 probe 會成功

### `~/` 展開

macOS / Linux 的 Browse button 回傳絕對路徑,不會有 `~`。若手動貼 `~/.local/bin/claude` 到 customPath 欄位:
- **資源層期望絕對路徑**(`electron/claude-resolver.ts:detectSystemClaude` 不做 `~` 展開)
- 請手動改為 `/Users/<you>/.local/bin/claude` 或 `/home/<you>/.local/bin/claude`

### 多 claude 並存

若系統上有多個 `claude`(例如 Homebrew + npm global + 手動下載),auto-detect 以 `$PATH` 順序為準。若要明確指定某一個,用 customPath 覆寫即可 — customPath 繞開 PATH 搜尋,只對該路徑做 health probe。

---

## 回報模板(複製給塔台)

```
Platform: macOS 14.x Apple Silicon / Ubuntu 22.04 x86_64 / ...
BAT version: v0.0.XX-pre.X
System claude: <which claude 輸出> / <version>

Checklist 結果:
- M-1 / L-1: ✅ / ❌(若失敗,貼 log)
- M-2 / L-2: ...
- ...

Logger 片段(搜 `[runtime-router]` / `[resolver]`):
<...>

異常截圖 / 錄影(若有):
<...>
```

---

## 關聯工單

- T0229 研究報告(跨平台假設來源)
- T0230 `claude-resolver.ts`(detection + probe 核心)
- T0231 `claude-runtime-router.ts`(routing + fallback)
- T0232 Settings UI(runtime 選擇 + toast)
- T0233 本文 + Windows 實測 + BUG-053
