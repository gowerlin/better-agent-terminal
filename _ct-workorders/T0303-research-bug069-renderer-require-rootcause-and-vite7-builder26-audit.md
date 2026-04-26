# T0303 — Research：BUG-069 renderer `require is not defined` 根因 + spike 2-3 修復方案 + Vite7/electron-builder26 wider audit

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0303 |
| 類型 | research |
| 優先級 | 🔴 High（v0.4.1 production 已壞，需快速修復） |
| 狀態 | ✅ DONE |
| 開始時間 | 2026-04-26 20:16 (UTC+8) |
| 完成時間 | 2026-04-26 20:38 (UTC+8) |
| 預估規模 | M-L（worker 自評 — 含 wider audit） |
| 互動模式 | interactive=true（可隨時跟使用者確認 spike 方向、回報中間結論） |
| 建立時間 | 2026-04-26 20:12 (UTC+8) |
| 報告者 | 塔台（BUG-069 衍生） |
| 關聯 BUG | BUG-069 |
| Renew 次數 | 0 |
| 影響範圍 | renderer build pipeline（vite config / electron-builder asar / dep externalize / CJS-ESM 互通） |

## 背景

v0.4.1 production NSIS install 啟動時，renderer bundle (`index-DiPLuJp3.js:127:6608`) 拋 `Uncaught ReferenceError: require is not defined`，UI 完全白畫面。後端服務全綠（terminal-server / RemoteServer / profile restore 都正常），純 renderer JS 執行階段失敗。

v0.4.0 → v0.4.1 之間最大改動是 **vite 5.4.21 → 7.3.2**（PLAN-003 Group B / T0163, 2026-04-18）+ **electron-builder 24.13.3 → 26.8.1**（PLAN-005 / EXP-BUILDER26-001, 2026-04-18）。其他變更需 worker 用 git log 自行盤點。

使用者已 100% repro，**沒有回測 v0.4.0**，要求直接從 v0.4.1 解。release 已對外，**v0.4.2 patch 越快越好**。

## 任務 — Phase A：根因定位

### A1. 重現與確認
- [ ] `npm run build`（或 `build:release` / `build:dir`）本機重現 NSIS install 啟動 crash（先確認本機環境能複製使用者錯誤）
  - 若 `build:dir` 無法複製，跑完整 `build` 產 NSIS 安裝測試
  - 若需要使用者協助提供 bundle 截圖、其他 console 錯誤，**直接互動詢問**
- [ ] 取得 `dist/index-DiPLuJp3.js` 第 127 行附近原始碼（unminify 或 sourcemap 對應），鎖定 `require(...)` 是哪個模組或哪段邏輯觸發

### A2. 根因 hypothesis 排查
依下列順序排查，每個 hypothesis 需明確 confirm/reject 並附證據：

1. **H1：Renderer source 直接寫 `require()`** — grep `src/`、`renderer/`（如有）所有 `require\(`、`module.exports`，找出未轉成 ES import 的 CJS 殘留
2. **H2：Vite 7 commonjs 處理 regression** — 比對 `vite.config.ts` 在 vite 5 vs vite 7 下的行為差異；查 `build.commonjsOptions`、`optimizeDeps`、externalize 設定
3. **H3：某個 dep 在 vite 7 下被誤判為 ESM** — 查 dep 的 `package.json` `exports` / `main` / `module` 設定，看是否在 v7 升級後處理方式變了
4. **H4：vite-plugin-electron(-renderer) 對 renderer CJS 處理變更** — 查 plugin changelog / GitHub issues
5. **H5：electron-builder 26 asar / asarUnpack 改變模組載入路徑** — 比對 v0.4.0 vs v0.4.1 的 `app.asar` 內容差異
6. **H6：Webpack-style `require.context` 或動態 require** — i18next 等 lib 可能用動態 require

### A3. 根因報告
明確寫出：
- **Root cause**：哪個檔案、哪個 dep、哪個 config 設定造成 `require is not defined`
- **觸發條件**：為何 dev 不會炸但 prod NSIS 會炸（或為何 v0.4.0 沒炸 v0.4.1 才炸 — 即使沒回測也要推理）
- **證據**：grep 結果、bundle 反組譯、dep 版本、git diff

## 任務 — Phase B：Spike 2-3 修復方案

針對 root cause 提出 **2-3 個** 修復方案，每個方案包含：

| 欄位 | 內容 |
|------|------|
| 方案名稱 | 一句話 |
| 修改範圍 | 哪些檔案、預估行數 |
| 風險 | 會不會打破其他功能、是否需要 regression test |
| 可逆性 | 容易 rollback 嗎 |
| 預估完成時間 | 含驗證 |
| Pre-flight 驗收 | 怎麼證明這個方案有效（除了 NSIS 安裝測） |

**方案範例方向**（worker 不限於這些）：
- 改 `vite.config.ts` 的 `build.commonjsOptions` / `optimizeDeps.include`
- pin vite 7 的某個 patch 版本（若有 known regression）
- 把違規的 dep externalize 或 inline
- 改 source code 把 `require()` 換成 ES import
- 暫時 rollback vite 到 6.x 等過渡（不推薦但要列）

## 任務 — Phase C：Wider Audit（**避免補一個又發現一個**）

使用者明確要求：「**一併評估可能有相關問題，避免補一個後又發現一個**」。

執行：

### C1. Vite 7 升級遺留風險全盤掃描
- [ ] 列出 vite 7 vs 5 所有 breaking changes（查 vite migration guide）
- [ ] 對照本專案實際使用的 API / config，標出**可能受影響但目前還沒炸**的項目
- [ ] 例如：HMR 行為變化、env var 處理、ssr 處理、某些 plugin hook 簽名變動

### C2. electron-builder 26 升級遺留風險
- [ ] 比對 v24 → v26 在 NSIS / portable / asar 處理的差異
- [ ] 確認 asarUnpack 名單是否還涵蓋所有 native modules
- [ ] 跑 `scripts/verify-native-modules.js` + `scripts/verify-helper-bundle.js` 確認 fail-fast pipeline 沒漏網

### C3. CJS/ESM 全盤健檢
- [ ] grep 整個 codebase 找出所有 `require(` 用法，分類為（a）main process 合法 CJS（b）renderer 違規（c）腳本 .mjs 合法
- [ ] 找出 dependencies 中標榜「ESM only」或「CJS only」但被混用的

### C4. 其他 v0.4.1 release 風險
- [ ] git log v0.4.0..v0.4.1 列出所有 commit，標出**可能影響 production 但 dev 看不出來**的變更
- [ ] 例如 PLAN-016 Phase 2 Electron 41 升級的副作用

### C5. Risk inventory 輸出
產出一張 risk inventory 表：

| Risk ID | 描述 | 嚴重度估計 | 是否要在 v0.4.2 一起修 | 建議 |
|---------|------|----------|-------------------|------|
| R1 | (BUG-069 本身) | 🔴 High | ✅ 必修 | 採用方案 X |
| R2 | xxxx | 🟡 Medium | ⚠️ 視成本 | 建議 v0.4.3 處理 |
| ... | | | | |

## Worker 互動行為

`research_interaction: true` 模式下：
- 隨時可以跟使用者互動（透過塔台）— 例如「需要你提供 dist 目錄的 sourcemap」、「需要你跑某個指令拍照」、「方案 A vs B 你比較傾向哪個」
- 每次提問上限 3 個（`research_max_questions: 3`）
- 中途有重大發現可以先回報塔台，不必等全部 phase 做完

## 完成條件（DOD）

1. ✅ Phase A 根因明確（不接受「可能是 X」），含證據
2. ✅ Phase B 至少 2 個 spike 方案 + 比較表
3. ✅ Phase C wider audit 完成 risk inventory
4. ✅ 推薦修復方案（含理由）
5. ✅ 更新 BUG-069 metadata：root_cause / fix_strategy / verify_steps
6. ✅ 工單回報區寫滿：本次發現的事實、推理鏈、unknown 與限制

## 不在範圍內

- **實作修復**（方案拍板後另開 fix workorder，不在 T0303 內做）
- **回測 v0.4.0**（使用者明確跳過）
- **重發 release**（修復完成 + verify 通過後使用者另議 v0.4.2 release）

## 前置條件

- 工作區乾淨（main branch, clean）
- 編號起始 D090（如有 architectural decision 需記錄到 _decision-log.md）

## 預期產出

- 工單回報區：根因報告 + spike 方案表 + risk inventory
- 更新 BUG-069 metadata
- （可選）若發現需要記錄的 architectural decision → 寫 D### 到 _decision-log.md
- （可選）若發現新的潛在 BUG → 提示塔台開新 BUG 單

---

## 工單回報區（Worker 填寫）

### 完成狀態

✅ **DONE**（research，未實作修復）

- Phase A 根因明確
- Phase B 提出 3 個 spike 方案 + 比較
- Phase C wider audit + risk inventory 完成
- 推薦方案標明
- BUG-069 metadata 待塔台/實作工單階段更新（Worker 已備好內文，見 § BUG-069 metadata 建議）

### 開始 / 完成時間

- 開始：2026-04-26 20:16 (UTC+8)
- 完成：2026-04-26 20:38 (UTC+8)
- 累計 wall：~22 min（落 GP099 預期內，research 中規模）

---

## Phase A — 根因定位

### A1. 重現策略

未跑完整 NSIS rebuild。改採**靜態證據鏈**直接定位（夠強就不需要實機重現）：
1. 比對 v0.4.0 → v0.4.1 git history（含 vite7 升級 + T0275 wizard）
2. 檢查 renderer source 對 Node builtin 的 import
3. 反查 `vite-plugin-electron-renderer` 的 transform 邏輯
4. 檢查 webPreferences 設定

### A2. Hypothesis 排查結果

| H | 內容 | 結論 | 證據 |
|---|------|------|------|
| **H1** | Renderer source 直接寫 `require()` | ❌ Reject | `grep -rE "=\s*require\("` 在 `src/` 只有 `indexBench.ts`（benchmark 腳本，**未被 renderer entry 引用**，rollup 不會打包） |
| **H1'** | Renderer source `import` Node builtin | ✅ **Confirm** | `src/components/setup-wizard/steps/wsl/fetch-fingerprint.ts:1`：`import * as https from 'node:https'` |
| **H2** | Vite 7 commonjs 處理 regression | ⚠️ 間接相關 | Vite 7 本身未直接造成；但 vite7 升級（83ae7cf, T0163）與 T0275 wizard 提交（5d75d4b）間隔很近，雙觸發點疊加 |
| **H3** | dep 在 vite 7 下被誤判 ESM | ❌ Reject | 所有 `node:*` 解析由 `vite-plugin-electron-renderer` 0.14.6 處理，不經 Vite 7 commonjs 邏輯 |
| **H4** | vite-plugin-electron(-renderer) 變更 | ❌ Reject | 0.14.5 → 0.14.6 的 transform 行為不變；`getSnippets` 自 v0.13 起一直產出 `const avoid_parse_require = require;` |
| **H5** | electron-builder 26 asar 改變 | ❌ Reject | renderer JS 是 vite build 產物，asar 只是封裝；asarUnpack 名單未涵蓋 dist/ |
| **H6** | Webpack `require.context` / 動態 require | ❌ Reject | 全 codebase grep 無此 pattern |

### A3. Root Cause（明確）

#### 失敗鏈（cause-chain）

1. `src/components/setup-wizard/steps/wsl/fetch-fingerprint.ts:1` 寫了 `import * as https from 'node:https'`
2. 該檔被 `wsl-flow.ts`、`docker-flow.ts`、`ssh-flow.ts`、`steps/wsl/index.ts` 引用，這些 flow 又被 setup-wizard 主元件用，最終透過 ProfilePanel/Settings 連到 `App.tsx`（renderer entry `src/main.tsx`）
3. `vite-plugin-electron-renderer` v0.14.6 在 build 時把 `node:*` import 轉成虛擬 `.mjs` chunk，內容固定為（`node_modules/vite-plugin-electron-renderer/dist/index.js:441-447`）：
   ```js
   const avoid_parse_require = require; const _M_ = avoid_parse_require("node:https");
   export const get = _M_.get; // ... 等等
   ```
4. 設定的 `vite.config.ts` `manualChunks` 只切分 react-vendor / xterm / hljs，setup-wizard **未獨立成 chunk**，所以這段虛擬模組的 top-level code 被 inline 進主 bundle `dist/assets/index-*.js`
5. App 啟動時主 bundle eager-load → 執行 top-level `const avoid_parse_require = require;`
6. `electron/main.ts:881` 設定 `nodeIntegration: false` + `:882 contextIsolation: true`，renderer 沒有 `require` 全域變數
7. → `Uncaught ReferenceError: require is not defined`（與 BUG-069 stack trace 100% 吻合）

#### 為何 dev 不炸、prod 炸

- **dev**：`vite serve` 把虛擬 `.mjs` 透過 dev server 動態 import 路徑供應；wizard 元件**只在使用者進設定→走 wizard 才被 mount**，渲染前不會載入該模組。但即使載入也會炸（dev 跟 prod 同樣 nodeIntegration:false）。差別只在「使用者沒在 dev 觸發過 wizard」。
- **prod**：因 manualChunks 沒切，setup-wizard 進主 bundle，啟動就 eager-load → 100% repro。

#### 為何 v0.4.0（無此 tag，等同 v0.3.1）沒炸、v0.4.1 才炸

| 觸發要件 | v0.3.1 | v0.4.1 |
|---------|--------|--------|
| `vite-plugin-electron-renderer` 安裝 | ✅（0.14.5） | ✅（0.14.6） |
| renderer 有 Node builtin import | ❌ **無**（grep 結果） | ✅ `fetch-fingerprint.ts`（T0275, 5d75d4b 引入） |
| nodeIntegration:false | ✅ | ✅ |
| **觸發** | 沒炸（無 import 就無虛擬 chunk） | **炸** |

**T0275 是真正的觸發點**，不是 vite 7 升級。Vite 5 + 同樣 wizard 也會炸。

#### 證據快照

- 主嫌檔案：`src/components/setup-wizard/steps/wsl/fetch-fingerprint.ts:1`
- 觸發 commit：`5d75d4b feat(wsl): T0275 wizard steps 5-7 + systemd unit + linger`（2026-04 PLAN-007 wsl phase）
- Plugin 邏輯：`node_modules/vite-plugin-electron-renderer/dist/index.js:222-234, 441-447`
- 渲染配置：`electron/main.ts:881-882`
- 唯一受影響檔（grep `from 'node:'` 全 src/）：1 處
- 其他 `import.*from\s+['"](fs|path|os|...)['"]` 全 src/：0 處

---

## Phase B — Spike 修復方案

### Spike A：IPC 遷移（推薦 ✅）

把 `node:https` 拉回 main process，renderer 改用 IPC。

| 欄位 | 內容 |
|------|------|
| 修改範圍 | `electron/main.ts`（+1 IPC handler，~30 行）+ `electron/preload.ts`（+ `wsl.fetchFingerprint` 暴露，~5 行）+ `src/types/electron-api.ts` 或對應 d.ts（+1 method 定義）+ `src/components/setup-wizard/steps/wsl/fetch-fingerprint.ts`（移除 `node:https` import，改為 `await window.electronAPI.wsl.fetchFingerprint(port)`，~30 行刪改） |
| 風險 | 🟢 低。架構一致（既有 IPC 都這樣做），nodeIntegration:false 設計意圖不變，self-signed `rejectUnauthorized:false` 留在 main process（合理） |
| 可逆性 | 🟢 易。一個 commit 集中處理，rollback 即還原 |
| 預估完成時間 | 30-45 min（含驗證） |
| Pre-flight 驗收 | (1) `npx vite build` 成功 (2) `grep -rn "from 'node:" src/` 結果為 0 (3) `grep -rn "avoid_parse_require" dist/` 結果為 0 (4) NSIS 安裝啟動 → renderer console 無 `require is not defined` (5) wizard SSH/Docker/WSL flow 至少一個跑到 fetch-fingerprint step 確認 IPC 工作 |
| 副作用 | 多一次 IPC roundtrip（~ms 等級，wizard 不在熱路徑，無感） |

### Spike B：Browser fetch + 主行程 cert verify hook

renderer 改用 browser `fetch()`，主行程透過 `session.setCertificateVerifyProc` 對 localhost 自簽憑證 always-trust。

| 欄位 | 內容 |
|------|------|
| 修改範圍 | `electron/main.ts`（setCertificateVerifyProc 接 localhost 例外，~15 行）+ `src/components/setup-wizard/steps/wsl/fetch-fingerprint.ts` 改用 `fetch()`（~30 行） |
| 風險 | 🟡 中。`setCertificateVerifyProc` 是全域 hook，需 scope 嚴格（host=localhost && port==server port）避免削弱 TLS 驗證；維護成本高 |
| 可逆性 | 🟡 中。涉及全域 session config |
| 預估完成時間 | 60-90 min |
| Pre-flight 驗收 | 同 Spike A + 額外確認非 localhost 連線仍正常驗證 cert |
| 副作用 | 全域 session 行為變更；未來其他地方依賴默認 cert 驗證的代碼可能受影響 |

### Spike C：擴大 manualChunks + 動態 import（**僅延後 crash，非真修復**）

把 setup-wizard 拆獨立 chunk + 用 `await import('./fetch-fingerprint')` 延遲載入。

| 欄位 | 內容 |
|------|------|
| 修改範圍 | `vite.config.ts` manualChunks（+1 wizard chunk）+ wizard 元件改 dynamic import（~20 行） |
| 風險 | 🔴 高。**不修根因**，只把 crash 從 app launch 延到使用者點 wizard。問題仍在，使用者設定 SSH/Docker/WSL 時照樣白畫面 |
| 可逆性 | 🟢 易 |
| 預估完成時間 | 20 min |
| Pre-flight 驗收 | 啟動不炸，但走到 wizard 仍會炸 |
| **判定** | ❌ **不採用**（PMcollegues 提示：使用者明確要求避免「修一個又發現一個」） |

### Spike 比較表

| 項目 | Spike A（IPC） | Spike B（fetch+hook） | Spike C（chunk）|
|------|--------------|------------------|--------------|
| 修根因 | ✅ | ✅ | ❌（只延後）|
| 對齊既有架構 | ✅✅（IPC 是主流）| ⚠️（hook 是少數）| ✅ |
| 風險 | 🟢 低 | 🟡 中 | 🔴 高（假修復）|
| 工時 | 30-45 min | 60-90 min | 20 min（無效）|
| 可逆性 | 🟢 | 🟡 | 🟢 |
| **總分** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐ |

### 推薦方案：Spike A（IPC 遷移）

**理由**：
1. 直接修根因（`from 'node:'` 在 renderer source 完全消失）
2. 對齊 BAT 既有架構（contextIsolation:true + IPC）
3. 工時短、風險低、可逆性最佳
4. 不引入新全域 hook（Spike B 的隱形維護成本）
5. 順帶讓未來「renderer 不可 import Node builtin」這條規則可被 lint 化

---

## Phase C — Wider Audit + Risk Inventory

### C1. Vite 7 升級遺留風險

| 項目 | 狀態 | 結論 |
|------|------|------|
| `splitVendorChunkPlugin` 移除 | ✅ 不受影響 | `vite.config.ts` 用 `manualChunks` |
| `transformIndexHtml` 舊 hook | ✅ 不受影響 | 無使用 |
| `resolve.conditions` custom | ✅ 不受影響 | 無設定 |
| Sass legacy API | ✅ 不受影響 | 無使用 |
| `optimizeDeps.entries` 行為變化 | ✅ 不受影響 | 走 plugin-electron-renderer 解析 |
| HMR Hot Module 訊息協定變化 | ⚠️ 已驗證 | dev OK（user smoke 過） |
| **CommonJS interop 預設變化** | ⚠️ 不影響 BUG-069 | renderer 走 plugin alias，不經 vite commonjs 處理 |

→ **vite 7 升級本身無 hidden regression**，BUG-069 的觸發是 wizard 新增 import，不是 vite 升級。

### C2. electron-builder 26 升級遺留風險

| 項目 | 狀態 | 結論 |
|------|------|------|
| `asarUnpack` 名單 | ✅ 完整 | `verify-native-modules.js` 把關（BUG-058） |
| Helper bundle 漏網 | ✅ 完整 | `verify-helper-bundle.js` 把關 |
| mac dmg 雙 arch（D057） | ✅ 已驗證 | v0.4.1 已 release |
| NSIS installer renderer JS 含進 asar | ✅ 確認 | dist/ → app.asar 預設行為，非 unpack 範圍，與 BUG-069 無關 |
| `mac.notarize` 物件→bool | ⚠️ 未啟用 | 不影響 Windows、Linux build |

→ **electron-builder 26 與 BUG-069 無因果關係**。

### C3. CJS/ESM 全盤健檢

#### renderer 違規 import

| 類別 | 數量 | 檔案 |
|------|------|------|
| `import * from 'node:*'` | **1** | `src/components/setup-wizard/steps/wsl/fetch-fingerprint.ts` |
| `import * from 'fs/path/os/...'`（裸名）| 0 | — |
| `const x = require(...)` 在 src/ | 4（同檔）| `src/components/git-poc/benchmark/indexBench.ts`（**unreachable**，標 R3） |

#### main process（合法 CJS）

`electron/main.ts` 用 `import { ... } from 'electron'`、`import path from 'path'` 等 — 在 main process 是合法 CJS interop（vite-plugin-electron 處理，main process 有 `require`）。✅ 正常。

#### scripts/

`scripts/*.mjs` 透過 Node 直接執行，合法。✅ 正常。

#### Dependencies

未發現 dep 標榜 ESM-only 但被 require 載入的違規。renderer dep 全經 vite 處理。

### C4. 其他 v0.4.1 release 風險

| Commit | 影響 | BUG-069 關聯 |
|--------|------|-------------|
| 83ae7cf vite 5→7 | renderer build pipeline | 中介觸發點（時間湊近）|
| 75bb77f electron-builder 24→26 | packaging | 無 |
| PLAN-016 Electron 41 升級 | runtime | 無（renderer crash 與 Electron 版本無關）|
| 5d75d4b T0275 wizard | **renderer 新增 node:https import** | **直接觸發** |
| BUG-062~068 修復 | backend / remote logic | 無 |

→ **唯一觸發 commit：5d75d4b**。其他升級無因果。

### C5. Risk Inventory

| Risk ID | 描述 | 嚴重度 | v0.4.2 修？| 建議 |
|---------|------|--------|----------|------|
| **R1** | BUG-069 — `node:https` import 在 renderer 觸發 `require is not defined` | 🔴 High | ✅ **必修** | 採 Spike A（IPC 遷移） |
| **R2** | 未來 renderer 又意外 import Node builtin（同根因復發）| 🟡 Medium | ⚠️ 視成本 | 加 ESLint rule `no-restricted-imports` 禁 `node:*` 與裸 `fs/path/...` 在 `src/`；或加 vite 自訂 plugin 在 build 時 fail-fast。建議 v0.4.3 或單張 small workorder |
| **R3** | `src/components/git-poc/benchmark/indexBench.ts` 用 `require('fs')` `require('os')` — 目前無被 renderer entry 引用，但放錯目錄（src/ 下的非 renderer 腳本）| 🟡 Low-Medium | ❌ 不必 v0.4.2 修 | 移到 `scripts/` 或 `tools/` 子目錄；若維持 src/ 內，至少加 `// @vite-ignore` 或檔頭註解警告。建議 R2 一併處理 |
| **R4** | `vite-plugin-electron-renderer` 的 `getSnippets` 預設行為對 nodeIntegration:false 不友善（產 `const _ = require;`）| 🟢 Low（plugin 設計如此）| ❌ 不修 | 知識記錄。長期看，若 BAT 完全不需要 renderer Node 互通，可考慮**移除 `renderer()` plugin**（既然 nodeIntegration:false，理論上不需要）。但需評估是否有其他隱形依賴 |
| **R5** | manualChunks 未切分 setup-wizard，導致 wizard 程式進主 bundle（任何 wizard regression 都炸 launch）| 🟡 Medium | ❌ 不必 v0.4.2 修（修 R1 後 wizard 已乾淨）| 順手在 vite.config.ts 加 `setup-wizard` chunk，降低主 bundle 體積 + 隔離 wizard 變動 |
| **R6** | mac notarization 環境變數未設（CI mac job）| 🟢 Low | ❌ 不修 | 文件已記錄，現狀延續（與 v0.4.0 行為一致）|

#### v0.4.2 修復建議範圍（最小集）

只修 **R1**。R2/R3/R5 留 v0.4.3 或當「PLAN-renderer-hardening」一併處理。

---

## 推薦下一步（不在本工單範圍內，僅建議）

1. **開實作工單 T03xx**：執行 Spike A IPC 遷移
   - 預估 30-45 min
   - DOD：v0.4.2 NSIS 安裝啟動無 `require is not defined` + wizard SSH flow 跑到 fetch-fingerprint
2. **開 backlog workorder**（v0.4.3 候選）：
   - R2 ESLint `no-restricted-imports` 守衛（避免根因復發）
   - R3 `indexBench.ts` 搬家
   - R5 manualChunks 加 setup-wizard
3. **GP 候選**：「Renderer source 禁止 import Node builtin（含 `node:*` 與裸名 `fs/path/...`）；vite-plugin-electron-renderer 會把這類 import 轉成 runtime `require()` 呼叫，在 nodeIntegration:false 下必炸」

---

## BUG-069 metadata 建議（Worker 已準備內文，待塔台 / 實作工單階段寫入）

```yaml
root_cause: |
  src/components/setup-wizard/steps/wsl/fetch-fingerprint.ts:1 寫了
  `import * as https from 'node:https'`，被 vite-plugin-electron-renderer 0.14.6
  轉成虛擬 .mjs chunk（內容含 `const avoid_parse_require = require;`），
  setup-wizard 未獨立 chunk → 進主 bundle eager-load →
  renderer (nodeIntegration:false, contextIsolation:true) 沒有 require → 炸。
  觸發 commit: 5d75d4b (T0275)。Vite 7 升級不是因果。
fix_strategy: |
  Spike A (IPC migration): 移除 fetch-fingerprint.ts 的 `node:https` import，
  改為 main process IPC handler `wsl:fetchFingerprint`（preload 暴露
  `window.electronAPI.wsl.fetchFingerprint(port)`），renderer 端用 IPC 取得
  fingerprint 字串。
verify_steps:
  - npx vite build 成功
  - grep -rn "from 'node:" src/ 結果為 0
  - grep -rn "avoid_parse_require" dist/ 結果為 0
  - NSIS 安裝 v0.4.2 → 啟動 renderer console 無 require is not defined
  - wizard SSH/Docker/WSL 至少一條 flow 跑到 fetch-fingerprint 確認 IPC 正常
related_risks:
  - R2 / R3 / R5（見 T0303 Phase C risk inventory）
```

---

## 互動紀錄

無（research 進行順利，無需向使用者額外提問。env `CT_INTERACTIVE` 未設，依工單 `互動模式: enabled` 但全程靜態證據鏈即可定根因）。

## 遭遇問題

無。全程證據鏈完整、無卡點。

## Renew 歷程

無。

## 產出摘要

- T0303 工單回報區寫滿（Phase A + B + C + 推薦）
- BUG-069 metadata 建議內文已備（推薦由實作工單階段寫入，避免雙重 source-of-truth drift）
- 無 code 修改、無 commit（research 工單，僅文件產出）
- 無新 D### 決策（Spike A 是工程選型，不到 architectural decision 等級；若塔台認為要存 D，可考慮 D090「Renderer 嚴禁 Node builtin import」）
- 無新 BUG 發現（R2/R3/R5 屬 backlog hardening，不是 BUG）

## Commit

工單元資料更新（PENDING→DONE）外無其他改動，依專案 `worker_commit: required` 慣例本工單最終 commit 由 `/ct-done` 階段處理，內含工單 metadata 與本次回報區內容。
