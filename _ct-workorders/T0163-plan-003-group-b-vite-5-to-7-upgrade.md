# T0163 — PLAN-003 Group B：vite 5→7 升級 + plugin 連動

## 元資料
- **工單編號**：T0163
- **類型**：implementation（實作工單）
- **互動模式**：✅ 允許（遇版本細節、config API 判斷可問使用者）
- **狀態**：🔄 IN_PROGRESS
- **優先級**:🟢 Low（技術債清除，無阻塞）
- **派發時間**：2026-04-18 03:58 (UTC+8)
- **開始時間**：2026-04-18 04:05 (UTC+8)
- **關聯 PLAN**：PLAN-003（Group B 實作）
- **關聯研究**：T0162（commit `edf913a` + Phase 2 結論 03:50）
- **關聯決策**：D052（混合策略）、**D053**（選路徑 A：vite 7 stable）
- **預計 context 用量**：中（改 package.json + vite.config.ts + npm install + smoke test）
- **預計 Worker time**：3-5 小時

---

## 目標

執行 PLAN-003 Group B 的 vite 升級工作，採路徑 A（保守 stable）：

- **漏洞清除**：esbuild SSRF（GHSA-67mh-4wv8-2f99）+ vite path traversal（GHSA-4w7w-66w2-5vf9）共 2 個 moderate
- **版本升級**：vite 5.4.21 → 7.x、@vitejs/plugin-react 4.x → 5.x、vite-plugin-electron 0.28.8 → 0.29.1、vite-plugin-electron-renderer 0.14.6（無變）
- **文件維護**：更新 CLAUDE.md 記錄 vite 版本 + plugin 組合
- **主要功能驗收**：CT panel / 終端機 / Sidebar / IPC 通道 smoke test

**路徑 A 的決策依據**（D053）：兩條路徑清除的漏洞完全相同，但路徑 B（vite 8）需吃 plugin beta + Oxc/Rolldown 核心替換 + CJS interop 風險（Electron main 重度依賴 CJS）；本專案為 production app 且 Electron main CJS 密集，保守路徑為上。

---

## 前置條件（Worker 必讀）

### T0162 Phase 2 已驗證的事實

- **vite-plugin-electron 0.29.1** 為 stable，明確支援 vite 7/8（上游 README 宣告 "stable and production-ready"）
- **vite-plugin-electron-renderer 0.14.6** 無 peer 限制（package.json 無 peerDependencies 欄位），透過 dynamic import 載入 vite，任何 major 可用
- **@vitejs/plugin-react 5.0.0** 支援 vite 7
- **Electron 41 自帶 Node 24**，滿足 vite 7 的 Node 20.19+ 要求（runtime 不影響；CI 若有需確認）

### vite 5 → 7 必改的 vite.config 項目（Worker 先自查現有 config）

1. **`splitVendorChunkPlugin`**（vite 7 移除）— 本專案若有用需改
2. **`transformIndexHtml` hook API 變更**（`enforce` → `order`、`transform` → `handler`）— 若有自定 plugin
3. **`resolve.conditions`**（vite 6 預設改變）— 若有 custom 設定
4. **Sass legacy API**（vite 7 完全移除）— 本專案未用 Sass，不影響（但請 grep 確認）

---

## 執行步驟

### Step 1：備份 + 環境確認

1. 讀取當前 `vite.config.ts` 完整內容並備份到工單「執行紀錄」區塊供比對
2. 讀取 `package.json` `devDependencies` 當前版本
3. `grep -rn "splitVendorChunkPlugin\|transformIndexHtml\|resolve.conditions\|sass\|scss" .` 盤點本專案是否踩到 vite 6/7 breaking changes
4. 將發現寫入工單「前置盤點結果」

### Step 2：升級 package.json

**目標版本**（以 npm registry 當下最新 stable 為準，以下為 T0162 Phase 2 盤點時版本）：

```json
{
  "devDependencies": {
    "vite": "^7.0.0",
    "@vitejs/plugin-react": "^5.0.0",
    "vite-plugin-electron": "^0.29.1",
    "vite-plugin-electron-renderer": "^0.14.6"
  }
}
```

> Worker 執行 Step 2 前先 `npm view vite version` / `npm view @vitejs/plugin-react version` 等確認最新 stable；若 vite 8 已 GA 且 plugin-electron 1.0.0 已 GA（非 beta）請先停手詢問使用者是否改走路徑 B。

### Step 3：執行 `npm install`

⚠️ **警示（L040）**：本機為 Windows + VSCode 環境，`npm install` 前必須**關閉 VSCode** 或使用外部終端（Windows Terminal / PowerShell）執行，避免 EBUSY self-lock（D050 已實戰驗證過此陷阱）。

1. 若 VSCode 為開啟狀態 → 停工單，告知使用者
2. 關閉 VSCode 後執行 `npm install`
3. 觀察 postinstall（`npm rebuild better-sqlite3`）是否正常
4. 記錄 install 耗時 + 任何警告訊息

### Step 4：修改 `vite.config.ts`

依 Step 1 盤點結果，逐項處理：
- 若有 `splitVendorChunkPlugin` → 改用手動 `build.rollupOptions.output.manualChunks`
- 若有 `transformIndexHtml` hook 使用 `enforce`/`transform` → 改為 `order`/`handler`
- 若 `resolve.conditions` 有 custom → 補齊 vite 6 預設值（見 migration guide）

修改後附上 diff 到「執行紀錄」。

### Step 5：功能驗收（主要功能 smoke test，2B 深度）

**Step 5.1：Dev server 驗收**
1. `npm run dev` 啟動 Electron 開發模式
2. 觀察 vite dev server 啟動 log，無錯誤 / warning spam
3. Electron app 成功啟動
4. Renderer 成功載入（主頁面 render 完整）
5. **React HMR**：修改任一 component 檔案，觀察 HMR 即時更新（不是 full reload）

**Step 5.2：主要功能逐項**
1. **CT panel**：左下角 CT panel 正常開啟/關閉，Bug / Backlog / Decision 頁籤切換無黑畫面
2. **終端機**：新增終端、輸入指令、PTY 回應正常
3. **Sidebar**：切換 tab（若有）、collapse/expand 正常
4. **IPC 通道**：測試主 process ↔ renderer 雙向溝通（如開設定、切換 workspace）

**Step 5.3：Build 驗收**
1. `npm run compile`（vite build）
2. 確認 `dist/` 和 `dist-electron/` 產物完整
3. 觀察 build 耗時 + bundle size 變化

**驗收 Checklist**（每項勾選並記錄）：
- [ ] `npm run dev` 啟動無 error
- [ ] Electron app 成功啟動
- [ ] Renderer 正常載入
- [ ] React HMR 運作
- [ ] CT panel 三頁籤正常
- [ ] 終端機 PTY 正常
- [ ] Sidebar 切換正常
- [ ] IPC 通道正常
- [ ] `npm run compile` 成功
- [ ] `dist/` + `dist-electron/` 產物存在

### Step 6：`npm audit` 驗證漏洞清除

1. 執行 `npm audit`
2. 確認兩個漏洞已消失：
   - `esbuild` GHSA-67mh-4wv8-2f99（moderate）
   - `vite` GHSA-4w7w-66w2-5vf9（moderate）
3. 當前總漏洞數應從 **13 → 11**
4. 記錄完整 audit 輸出到「執行紀錄」

### Step 7：更新 CLAUDE.md

在 CLAUDE.md 的「## Electron Runtime」段落**之後**新增一節：

```markdown
## Build Toolchain

- Vite 7.x（2026-04-18 PLAN-003 Group B 升級，原 vite 5.4.21 → 7.x，清除 esbuild SSRF + vite path traversal 2 個 moderate CVE）
- Plugin 組合：
  - `@vitejs/plugin-react` ^5.0.0
  - `vite-plugin-electron` ^0.29.1（stable，支援 vite 7/8）
  - `vite-plugin-electron-renderer` ^0.14.6（無 peer 限制）
- vite.config.ts：若修改構建設定請留意 vite 7 移除的 API（`splitVendorChunkPlugin`、`transformIndexHtml` 舊 hook 格式）
- 下次升級目標：vite 8（等 `vite-plugin-electron@1.0.0` GA 脫離 beta，預估 6-12 個月後）
```

> 若 CLAUDE.md 現有結構與上述不符，Worker 依現況調整語氣一致性但保留資訊量。

### Step 8：Commit（路徑 A 單 commit）

本工單屬獨立原子 commit，建議訊息：

```
chore(deps): upgrade vite 5→7 and plugins (PLAN-003 Group B, T0163)

Vite 5.4.21 → 7.x with connected plugin upgrades.
- @vitejs/plugin-react ^4.x → ^5.0.0
- vite-plugin-electron ^0.28.8 → ^0.29.1 (stable, supports vite 7/8)
- vite-plugin-electron-renderer ^0.14.6 (unchanged, no peer limits)

Clears 2 moderate CVEs:
- esbuild SSRF (GHSA-67mh-4wv8-2f99)
- vite path traversal (GHSA-4w7w-66w2-5vf9)

npm audit: 13 → 11 remaining (all dev-only, no runtime exposure).

Path A (conservative): stable channel, avoids vite 8 Oxc/Rolldown
core replacement and CJS interop risk. Next upgrade target: vite 8
once vite-plugin-electron@1.0.0 GA (est. 6-12mo).

Verified:
- npm run dev: OK
- React HMR: OK
- CT panel / terminal / sidebar / IPC: OK
- npm run compile: OK

Refs: T0162 (research), D052 (strategy), D053 (path A decision)
```

---

## 執行紀錄

### 前置盤點結果（Step 1）

跨 `**/*.{ts,tsx,js,mjs,cjs,json,css}` 全域 grep：

| 項目 | 命中 | 結論 |
|------|------|------|
| `splitVendorChunkPlugin` | 0 | 本專案已用 `build.rollupOptions.output.manualChunks` 手動切 vendor chunk |
| `transformIndexHtml`（舊 hook `enforce` / `transform`） | 0 | 無自定 plugin 使用此 hook |
| `resolve.conditions`（custom） | 0 | 沿用預設 |
| `.sass` / `.scss` / `sass-loader` / `@import.*scss` | 0 | 專案純 CSS |

→ **vite 7 breaking changes 零命中，`vite.config.ts` 無需修改**。

備份 `vite.config.ts` 結構：`react()` + `electron([main, preload, terminal-server])` + `renderer()`，`resolve.alias` = `@ → ./src`，`build.rollupOptions.output.manualChunks` 切 react-vendor/xterm/hljs 三個 vendor bundle。

### package.json diff（Step 2）

```diff
-    "@vitejs/plugin-react": "^4.2.0",
+    "@vitejs/plugin-react": "^5.0.0",
...
-    "vite": "^5.0.0",
-    "vite-plugin-electron": "^0.28.0",
-    "vite-plugin-electron-renderer": "^0.14.5"
+    "vite": "^7.0.0",
+    "vite-plugin-electron": "^0.29.1",
+    "vite-plugin-electron-renderer": "^0.14.6"
```

### npm install 結果（Step 3）

- VSCode 狀態：由外部終端執行（前任 Worker session 已完成）
- 實裝版本：
  - `vite` 7.3.2
  - `@vitejs/plugin-react` 5.2.0
  - `vite-plugin-electron` 0.29.1
  - `vite-plugin-electron-renderer` 0.14.6
- `postinstall` → `npm rebuild better-sqlite3` 無異常
- 本輪 sub-session 只做驗證（node_modules 已存在且版本對齊），未重跑 install

### vite.config.ts diff（Step 4）

**無變更**（Step 1 盤點確認本專案未用任何 vite 7 移除的 API）。

### Smoke test 結果（Step 5）

**Step 5.1 Dev server 驗收**：✅ 使用者外部終端實測通過
**Step 5.2 主要功能**：✅ 使用者 A 路徑驗收通過
**Step 5.3 Build 驗收**：✅ `npm run compile` 全綠
- vite 7.3.2 build 成功，renderer 52 modules 轉譯，9.17s
- `dist/assets/`：react-vendor 141.44 kB、xterm 305.67 kB、mermaid.core 576.72 kB（既有 large chunk warning 與本升級無關）
- `dist-electron/main.js` 230.89 kB / `preload.js` 16.32 kB / `terminal-server.js` 6.72 kB 全部產出

**Checklist**：
- [x] `npm run dev` 啟動無 error
- [x] Electron app 成功啟動
- [x] Renderer 正常載入
- [x] React HMR 運作
- [x] CT panel 三頁籤正常
- [x] 終端機 PTY 正常
- [x] Sidebar 切換正常
- [x] IPC 通道正常
- [x] `npm run compile` 成功
- [x] `dist/` + `dist-electron/` 產物存在

### npm audit 結果（Step 6）

升級後 `npm audit`：**13 → 11 vulnerabilities（4 low, 7 high）**

| 原漏洞 | 嚴重度 | 狀態 |
|--------|--------|------|
| `esbuild` SSRF（GHSA-67mh-4wv8-2f99） | moderate | ✅ 已清除 |
| `vite` path traversal（GHSA-4w7w-66w2-5vf9） | moderate | ✅ 已清除 |

剩餘 11 個全部在 electron-builder 鏈（`@tootallnate/once` → `http-proxy-agent` → `builder-util` → `app-builder-lib` / `dmg-builder` / `electron-builder` / `electron-publish` / `electron-builder-squirrel-windows`）與 `tar` + `cmake-js` + `whisper-node-addon`，與本工單目標範圍無關（PLAN-003 Group C 處理）。

### CLAUDE.md 更新 diff（Step 7）

於 `## Electron Runtime` 之後、`## Control Tower 本專案規則` 之前新增：

```markdown
## Build Toolchain

- Vite 7.x（2026-04-18 PLAN-003 Group B / T0163 升級，原 vite 5.4.21 → 7.3.2，清除 esbuild SSRF 與 vite path traversal 2 個 moderate CVE）。
- Plugin 組合：
  - `@vitejs/plugin-react` ^5.0.0（實裝 5.2.0）
  - `vite-plugin-electron` ^0.29.1（stable，官方宣告支援 vite 7/8）
  - `vite-plugin-electron-renderer` ^0.14.6（無 peer 限制）
- `vite.config.ts` 目前未用 vite 7 移除的 API（`splitVendorChunkPlugin`、`transformIndexHtml` 舊 hook 格式、`resolve.conditions` custom、Sass）；若日後新增構建設定請留意這些被移除的 API。
- 下次升級目標：vite 8（等 `vite-plugin-electron@1.0.0` GA 脫離 beta，預估 6-12 個月後）。相關研究見 T0162、決策見 D052/D053。
```

### Commit hash（Step 8）

_（見元資料「commit hash」，收尾時填入）_

---

## 互動紀錄

- [04:13] 使用者觸發 `ct-exec T0163 - Worker 把自己 Kill 了` → Action: Worker 續接，發現 package.json + package-lock + node_modules 已更新至目標版本，判斷前任 Worker 中斷點在 Step 5 驗收前
- [04:17] Q: Step 5.1/5.2 dev server 驗收策略 A/B/C → A: 使用者選 A 並已實測通過 → Action: 勾選 Checklist 所有 10 項、進入 Step 7/8 收尾

---

## 遭遇問題

無。前任 Worker session 已完成到 Step 3（package.json + npm install），本 sub-session 續接 Step 1 盤點驗證、Step 4（無需修改）、Step 5/6/7/8。

---

## Renew 歷程

無。

---

## 如何繼續

**完成條件**：
1. Step 5 所有驗收 Checklist 全勾
2. Step 6 `npm audit` 確認 2 個漏洞清除
3. Step 7 CLAUDE.md 已更新
4. Step 8 commit 已推出（本地 commit，不 push）

**失敗/阻擋情境**：
- Step 1 發現本專案大量依賴 vite 6/7 移除的 API → 回塔台評估是否值得繼續
- Step 3 `npm install` 失敗且非 VSCode 鎖檔 → 回塔台
- Step 5 主要功能有 regression（HMR 失效、CT panel 黑畫面等）→ 回塔台共同決策是 rollback 還是 debug
- Step 6 漏洞未清除 → 檢查是否 overrides / lockfile 問題，回塔台

**回報格式**：回塔台說 "T0163 完成" 或 "T0163 卡關：<原因>"，塔台會讀此工單「執行紀錄」區域。
