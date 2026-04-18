# 工單 T0183-remote-path-sandbox

## 元資料
- **工單編號**：T0183
- **任務名稱**：Remote path sandbox + image cap（PLAN-018 第二張）
- **類型**：implementation
- **狀態**：DONE
- **建立時間**：2026-04-18 20:00 (UTC+8)
- **開始時間**：2026-04-18 20:36 (UTC+8)
- **完成時間**：2026-04-18 20:48 (UTC+8)
- **預估工時**：1-2h
- **實際工時**：約 0.2h
- **優先級**：🔴 High（P0 資安）
- **Renew 次數**：0

## 前置條件

- **PLAN-018 PLANNED**：Remote 資安加固
- **T0181 DONE**（`4822dbd`）：拆分研究報告 `_report-t0181-plan-018-breakdown.md` **§D 為本工單權威規格**
- **T0164 DONE**：Upstream sync 研究
- **Upstream commit**：`3a0af80`（path sandbox 部分）

## 權威規格

**閱讀順序**：
1. `_report-t0181-plan-018-breakdown.md` **§D**（完整規格：修改檔案清單含精確行號、改動方向、AC 對照表、測試策略）
2. `_report-t0181-plan-018-breakdown.md` **§H**（Fork 客製化熱區 — 必須保留）
3. `_report-t0181-plan-018-breakdown.md` **§I.1** R4（symlink 處理風險）

## 修改範圍（摘要，完整見報告 §D）

- **新增**：`path-guard.ts`（或集中於 `main.ts` IPC handler 的驗證邏輯）
- **工作流程**：
  - FS IPC handler 加 workspace 路徑沙盒驗證（reject `..` 跨越根目錄、reject absolute path 外部 workspace）
  - Image IPC 加大小上限（cap）
  - Symlink 處理：跳出 workspace 則 skip，**不 throw**（AC-7 明確要求）

## 驗收條件

見 `_report-t0181-plan-018-breakdown.md` §D 的 AC 對照表。

**commit 訊息**：`feat(remote): path sandbox + image cap (PLAN-018 T0183)`

## 互動規則

**禁止 Worker 互動**（規格已完整）。

## 依賴

- **可並行**：與 T0182 **無依賴**（不同模組），可同日執行
- **無下游依賴**

## 備註

- 實作時注意 Windows path separator（`\` vs `/`）— sandbox 驗證需統一用 `path.resolve` + `path.relative`
- 若發現 fork 既有 workspace loader 已有部分驗證邏輯 → 沿用並擴充，**不**重建（參考報告 §H fork 客製化熱區）

---

## 回報區

### 執行摘要

- **完成狀態**：DONE
- 實作 workspace 白名單沙盒（`path-guard.ts`），所有 `fs:*` handler 與 `image:read-as-data-url` 進入時檢查路徑
- 白名單來源：window registry 所有 entry 的 `workspace.folderPath` 集合；startup 階段與 `workspace:save` handler 尾端同步
- `fs:search` 遞迴 walk 遇到跳出 workspace 的 entry 時 `continue` 不 throw（AC-7）
- `image:read-as-data-url` 加 10 MB cap（`MAX_IMAGE_SIZE`）＋ try/catch 包整個 handler
- 註：Upstream (`3a0af80`) `path-guard.ts` 採「deny-list」設計；§D 權威規格要求「workspace allowlist」。以 §D 為準實作。

### AC 驗收結果

| AC | 結果 | 證據 |
|----|------|------|
| AC-1 | ✅ | `electron/path-guard.ts` 新檔（98 行），export `registerWorkspace/unregisterWorkspace/isPathAllowed/assertPathAllowed/rebuildWorkspaceAllowlist/MAX_IMAGE_SIZE` |
| AC-2 | ✅ | 7 個 `fs:*` handler（watch/reset-watch/unwatch/readdir/readFile/stat/search）入口皆有 `isPathAllowed` gate |
| AC-3 | ✅ | `image:read-as-data-url` 入口呼叫 `assertPathAllowed(filePath)` |
| AC-4 | ✅ | `MAX_IMAGE_SIZE = 10 * 1024 * 1024`；handler 檢查 `stat.size > MAX_IMAGE_SIZE` |
| AC-5 | ✅ | 白名單設計 + unit test「absolute path outside any workspace is blocked」、「Similar-prefix sibling is not allowed」 |
| AC-6 | ✅ | `syncPathGuardFromRegistry()` 於 startup 掃 `windowRegistry.readAll()` 註冊所有 workspace.folderPath；`workspace:save` 後重建 |
| AC-7 | ✅ | `fs:search` walk 內 `if (!isPathAllowed(fullPath)) continue`；外部 try/catch 不會 throw |
| AC-8 | ✅ | `workspace:save` handler 結尾 `await syncPathGuardFromRegistry()`，新增/刪除 workspace 立即反映 |
| AC-9 | ✅ | `npx vite build` exit 0；`npx tsc --noEmit` 我的檔案（main.ts / path-guard.ts）無新增錯誤；pre-existing 錯誤屬其他工單範圍（WorkspaceView worktree、settings-store 等）|

### 單元測試結果

```
npx tsx tests/path-guard.test.ts
─── path-guard tests: 12 passed, 0 failed ───
```

涵蓋：register/unregister 冪等、`..` traversal、相似前綴 sibling、多 workspace、empty allowlist fail-closed、無效輸入、throw message、MAX_IMAGE_SIZE 常數。

### 修改檔案清單

| 檔案 | 類型 | 說明 |
|------|------|------|
| `electron/path-guard.ts` | 新檔（98 行） | workspace allowlist API（register/unregister/rebuild/isPathAllowed/assertPathAllowed），`MAX_IMAGE_SIZE` 常數 |
| `electron/main.ts` | 修改（+55 行） | import path-guard、`syncPathGuardFromRegistry()` helper、startup seed、`workspace:save` 後 rebuild、8 個 IPC handler gate |
| `tests/path-guard.test.ts` | 新檔 | 12 個單元測試 |

### 遭遇問題

- **規格與 upstream 不一致**：Upstream `3a0af80` 的 `path-guard.ts` 實作為 deny-list（拒絕敏感路徑如 `~/.ssh`），而 T0181 報告 §D 明確要求 workspace allowlist 設計（見 AC-8「workspace 新增/刪除時白名單同步」）。採用 §D 為權威，以 workspace allowlist 實作。影響：Claude 讀 workspace 外路徑（如 `~/.bashrc`）將被 block — 若此破壞既有 workflow，塔台可考慮後續放寬到混合模式（workspace 內放寬 + deny-list 兜底）。
- **tsc pre-existing errors**：`tsc --noEmit` 有 10+ 既有錯誤（WorkspaceView worktree、settings-store setDockBadge 等），非本工單引入，`electron/main.ts` 與 `electron/path-guard.ts` 本身無新錯誤。

### 互動紀錄

無（本工單禁止互動，規格已完整）。

### Commit

`b12690f` — `feat(remote): path sandbox + image cap (PLAN-018 T0183)`

### Renew 歷程

無。

### 回報時間

2026-04-18 20:48 (UTC+8)
