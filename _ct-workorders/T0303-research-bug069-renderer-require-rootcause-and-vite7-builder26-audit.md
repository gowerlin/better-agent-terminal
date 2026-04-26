# T0303 — Research：BUG-069 renderer `require is not defined` 根因 + spike 2-3 修復方案 + Vite7/electron-builder26 wider audit

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0303 |
| 類型 | research |
| 優先級 | 🔴 High（v0.4.1 production 已壞，需快速修復） |
| 狀態 | 📋 TODO |
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

> （Worker 完成後填寫，包含發現、推理、結論、建議）
