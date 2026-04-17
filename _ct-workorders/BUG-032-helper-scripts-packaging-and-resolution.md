# BUG-032 — Helper Scripts 打包與路徑解析設計缺漏

## 元資料
- **BUG 編號**：BUG-032
- **標題**：BAT helper scripts（`bat-terminal.mjs` + `bat-notify.mjs`）未打包進安裝程式 + 塔台引用方式假設 cwd 在 source root，使用者環境無法可靠執行
- **狀態**：🔴 OPEN
- **嚴重度**：🔴 High（阻擋 v2.x 發布；使用者環境完全不可用 auto-session 通知鏈路）
- **建立時間**：2026-04-17 12:15 (UTC+8)
- **發現於**：2026-04-17 在 `D:\ForgejoGit\2026_Taipower` 實戰測試，使用者觀察到 helper scripts 沒打包但塔台仍能執行（巧合 — 因為 Claude Code session cwd 落在 BAT 原始碼目錄）
- **關聯 BUG**：BUG-031（FIXED — PTY workspace allocation；本 BUG 的 C 層症狀「通知鏈路 workspace 一致性」原計畫於 BUG-031 副作用檢查驗證，現併入 BUG-032 範圍）
- **關聯工單**：T0131（CLI helper bat-terminal.mjs 建立）、T0133（Worker→Tower 通知實作）、T0134（CT 上游整合）

---

## 現象描述

### 預期行為
1. 使用者安裝 BAT 後，安裝目錄包含 `bat-terminal.mjs` + `bat-notify.mjs`（透過 electron-builder 打包）
2. BAT 啟動 Claude session 時注入環境變數，告知 helper scripts 位置
3. 塔台白名單以可移植方式呼叫 helpers（不依賴 cwd）
4. Worker 完成工單後透過 `bat-notify.mjs` 主動通知塔台（非剪貼簿降級）

### 實際行為
1. **打包層（B）**：electron-builder `extraResources` 未把 `scripts/` 目錄打包，安裝目錄無 `bat-terminal.mjs` / `bat-notify.mjs`
2. **運行層（C）**：BAT 啟動 Claude session 時無 `BAT_HELPER_DIR` 之類的 env var 注入；Worker 完成工單後找不到 `bat-notify.mjs`，降級剪貼簿
3. **文件層（A）**：`_local-rules.md` L286 / L301 / L302 / L310 寫死 cwd-relative 路徑 `scripts/bat-terminal.mjs`，假設塔台 cwd 是 source root

### 開發機為何看似能跑（巧合）
- 開發機塔台 session cwd = `D:\ForgejoGit\BMad-Guide\better-agent-terminal\better-agent-terminal`（= BAT 原始碼）
- 相對路徑 `scripts/bat-terminal.mjs` 剛好解析到 source 目錄存在的檔案
- 在使用者環境（cwd = workspace 如 `2026_Taipower`，且無 source）會直接失敗

### 證據
- 使用者實測 `2026_Taipower`：問題 1 看似成功是巧合（路徑解析湊巧），問題 2 通知降級剪貼簿就是 helper 不存在的證據
- `_local-rules.md:286,301,302,310` grep 結果確認寫死相對路徑

### 影響範圍
- **環境**：所有使用者環境（非開發機）
- **阻擋功能**：
  - auto-session BAT 路由（塔台無法可靠開新 PTY）
  - Worker→Tower 自動通知（T0133 設計失效，被迫降級剪貼簿）
  - 塔台到 Worker 整條互動鏈路在使用者機器上完全壞掉
- **副作用**：使用者裝完 BAT 看似能用，實則所有「自動化」操作都靜默失敗

---

## 三層拆解

| 層 | 子問題 | 範圍 | 修法方向（待研究確認） |
|---|--------|------|---------------------|
| **A. 文件層** | `_local-rules.md` 寫死 cwd-relative 路徑 | 塔台 skill / 專案規則 | 改用 env var / 絕對路徑 / 包成 CLI binary |
| **B. 打包層** | electron-builder 沒打包 `scripts/` | `package.json` build 設定 | `extraResources` / `asarUnpack` / 獨立 binary |
| **C. 運行層** | BAT 沒注入 helper 路徑 env var | `electron/main.ts` PTY 建立流程 | 注入 `BAT_HELPER_DIR` 之類的 env var |

三層其實是同一個設計缺漏：**使用者環境的 helper script 解析路徑該長什麼樣，從未被完整想過**。

---

## 待研究問題（→ T0138）

1. electron-builder 目前 `package.json` 怎麼設定？`extraResources` / `asarUnpack` 哪個適合 `.mjs` ESM 模組？
2. 安裝後 helper scripts 應該落在哪？（`resources/scripts/` / `userData/scripts/` / 其他？）
3. 路徑解析機制怎麼設計才可攜？
   - 方案 A：BAT 啟動 Claude 時注入 `BAT_HELPER_DIR` env var → 塔台白名單改用 `node "$BAT_HELPER_DIR/bat-terminal.mjs" ...`
   - 方案 B：把 helpers 包成獨立 CLI binary（pkg/nexe/Bun compile）放到 PATH 或 BAT install dir
   - 方案 C：BAT 啟動 Claude 時把 helpers 複製到 workspace 隱藏目錄（如 `.bat/scripts/`），維持相對路徑
4. 既有的 `BAT_SESSION` / `BAT_REMOTE_PORT` / `BAT_TOWER_TERMINAL_ID` env var 注入點在哪？新增 `BAT_HELPER_DIR` 應該加在同一處
5. `_local-rules.md` 改寫策略：完全替換 / 留向後相容 fallback `${BAT_HELPER_DIR:-scripts}/`?

---

## 修復計畫（D033 拍板，依 T0138 結論展開）

**方案**：方案 A — 注入 `BAT_HELPER_DIR` env var（不 fallback，直接失敗）

**5 張工單依賴鏈**：

```
T0139 (打包) → T0140 (env var) → T0141 (_local-rules) → T0142 (整合驗收) → T0143 (上游 PR)
```

| 工單 | 範圍 | 難度 | 狀態 |
|------|------|------|------|
| T0138 | 研究：打包與路徑解析設計 | ⭐⭐ | ✅ DONE (commit 340dc9d) |
| T0139 | electron-builder `extraResources` 打包 helpers | ⭐ | 📋 派發中 |
| T0140 | `pty-manager.ts` 注入 `BAT_HELPER_DIR` env var | ⭐⭐ | ⏳ 等 T0139 |
| T0141 | `_local-rules.md` 改寫白名單（4 處） | ⭐ | ⏳ 等 T0140 |
| T0142 | END-TO-END 驗收（含 T0135 MANUAL + BUG-031 副作用） | ⭐⭐⭐ | ⏳ 等 T0141 |
| T0143 | CT 上游 skill 回 PR（v4.1.0 → v4.1.1） | ⭐⭐ | ⏳ 等 T0142 通過 |

**v2.x 發布策略**：5 張完成前不發正式版（不更新 Homebrew tap）；可發 `-pre` 給內部測試（標記 BUG-032 known issue）

---

## 工單回報區

（待 T0138 完成後由塔台統籌填寫）

---
