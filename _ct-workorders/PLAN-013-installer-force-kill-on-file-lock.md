# PLAN-013-installer-force-kill-on-file-lock

## 元資料
- **編號**：PLAN-013
- **標題**：NSIS Installer 偵測檔案鎖定時詢問使用者強制 kill Terminal Server
- **狀態**：💡 IDEA
- **優先級**：🟢 Low
- **類型**：安裝體驗改善
- **建立時間**：2026-04-17 17:12 (UTC+8)
- **建立 Session 決策**：D044（驗收全通過 + 依 D033 另開本 PLAN）
- **來源**：D033（PLAN-012 拆分決策 — 「Installer 強制 kill 另開 PLAN」）

---

## 動機

PLAN-012 已完成 Quit Dialog + CheckBox 的**使用者主動路徑**（使用者在退出 BAT 時主動勾選關閉 server，以便後續安裝 installer）。但仍存在**被動路徑**缺口：

1. 使用者**忘記勾 checkbox**退出（或使用「不勾保留 server」的正常路徑）→ server 仍在背景
2. 使用者下載新版 installer 執行覆蓋安裝
3. Installer 偵測到 `terminal-server.js` / `@lydell/node-pty.node` 檔案鎖定 → **彈出「檔案正在使用」錯誤**
4. 使用者必須手動：退出 installer → 退出 BAT 並勾 checkbox → 重跑 installer

**理想行為**：
Installer 偵測到檔案鎖 → 跳出提示 Dialog：「Terminal Server 仍在執行，是否關閉並繼續安裝？」→ 使用者選 Yes → installer 自動 `taskkill /F /T terminal-server.js` → 繼續安裝。

---

## 解決方案（草案，待深入調查）

### 技術路線候選

| # | 路線 | 實作面 | 優點 | 缺點 |
|---|------|--------|------|------|
| A | NSIS script `FindProc` + `MessageBox` + `KillProc` | NSIS 原生 | 零依賴、installer 時期觸發 | NSIS plugin 依賴（`nsProcess.dll` 等） |
| B | electron-builder `beforePack` + NSIS custom | electron-builder | 可複用既有 config | 仍需 NSIS plugin |
| C | Installer 啟動時 shell out to `taskkill /F /IM BetterAgentTerminal.exe` + prompt | PowerShell pre-install hook | 簡單 | UAC 提權、使用者體驗較重 |
| D | BAT 自己實作 `bat-installer.exe` wrapper | 自製 | 完全可控 | 維護成本大 |

推薦 **A 或 B**（NSIS 方案），視 electron-builder hook 擴展性而定。

### 必要條件

- 偵測進程存在：`nsProcess::FindProcess "BetterAgentTerminal.exe"` + 檢查 `terminal-server.js` 子進程
- i18n：zh-TW / en 雙語 prompt
- Fallback：使用者拒絕 kill → installer 放棄安裝（退出 + 錯誤碼）

---

## 預期影響

- **改善版本更新體驗**：使用者不需手動結束 BAT 即可安裝新版
- **不破壞 PLAN-012 Dialog**：兩者互補（主動關 → 快速；被動偵測 → 兜底）
- **風險**：Installer 權限 + 進程偵測在 Windows Controlled Folder 場景的行為需驗證

---

## 相關單據

- PLAN-012（✅ DONE）：Quit Dialog + CheckBox 主動路徑
- D033（PLAN-012 建立時決策，明確將 installer 強制 kill 劃出 PLAN-012 範圍）
- D044（驗收全通過 + 本 PLAN 建立）
- T0149 commit `cd460d2` / T0150 commit `31b4ec2`：PLAN-012 最終實作
- BUG-034/035：PLAN-012 收官路上的障礙（現已全 CLOSED）

---

## 開工前置

本 PLAN 為 IDEA 狀態，轉 PLANNED 前需：
1. 確認需求優先級（使用者親身遇到頻率 → 是否值得投入）
2. 調查 electron-builder + NSIS 原生整合成本
3. 評估其他 electron app 的既有方案（如 VS Code / Discord 的 installer 行為）

---

## 備註

當初 D033 時標註「時程緊急」所以劃出 PLAN-012 範圍；現在主流程已穩定，可依使用者遇到頻率決定是否升級優先級。
