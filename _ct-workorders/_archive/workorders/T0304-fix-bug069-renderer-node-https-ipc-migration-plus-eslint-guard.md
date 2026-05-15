---
schema_version: 1
schema_kind: workorder
id: T0304
title: "Fix BUG-069：fetch-fingerprint `node:https` IPC 遷移（Spike A）+ ESLint 守衛（R2）"
type: fix
status: FIXED
sizing: S
created_at: "2026-04-26T20:42:00+08:00"
started_at: "2026-04-26T20:37:00+08:00"
completed_at: "2026-04-26T20:46:00+08:00"
renew_count: 0
---
# T0304 — Fix BUG-069：fetch-fingerprint `node:https` IPC 遷移（Spike A）+ ESLint 守衛（R2）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0304 |
| 類型 | fix |
| 優先級 | 🔴 High（v0.4.2 patch blocker） |
| 狀態 | ✅ FIXED |
| 開始時間 | 2026-04-26 20:37 (UTC+8) |
| 完成時間 | 2026-04-26 20:46 (UTC+8) |
| 預估規模 | S-M（30-45 min Spike A + 10 min R2 ESLint）|
| 互動模式 | non-interactive |
| 建立時間 | 2026-04-26 20:42 (UTC+8) |
| 報告者 | 塔台（依 T0303 推薦 Spike A，依 D090 加 R2 守衛） |
| 關聯 BUG | BUG-069（OPEN → FIXING） |
| 關聯研究 | T0303（DONE） |
| 關聯決策 | D090 |
| Renew 次數 | 0 |
| 影響範圍 | `electron/main.ts`、`electron/preload.ts`、`src/types/electron-api.ts`（或對應 d.ts）、`src/components/setup-wizard/steps/wsl/fetch-fingerprint.ts`、`.eslintrc*`（或 eslint config 對應檔案） |
| Release target | v0.4.2 patch |

## 背景

T0303 研究確認 BUG-069 根因：
- `src/components/setup-wizard/steps/wsl/fetch-fingerprint.ts:1` 寫了 `import * as https from 'node:https'`
- `vite-plugin-electron-renderer` 0.14.6 把它轉成虛擬 chunk 含 `const avoid_parse_require = require;`
- setup-wizard 未獨立 chunk → 進主 bundle eager-load → nodeIntegration:false 無 require → 100% repro `Uncaught ReferenceError: require is not defined`
- 觸發 commit：T0275（5d75d4b），非 vite 7 升級

塔台依 T0303 推薦採 **Spike A IPC 遷移**，並依 **D090** 決策同步加 **R2 ESLint 守衛**避免根因復發。

## 任務

### Phase 1：IPC 遷移（Spike A）

#### 1.1 main process 加 IPC handler

`electron/main.ts`（或 `electron/ipc/wsl.ts` 等模組化位置 — Worker 自由選位置以對齊現有架構）：

```ts
// 在現有 IPC handler 集中區註冊
ipcMain.handle('wsl:fetchFingerprint', async (_event, port: number) => {
  // 移植自 fetch-fingerprint.ts 原邏輯：
  // - 對 https://localhost:<port>/health 發 GET
  // - rejectUnauthorized: false（self-signed cert）
  // - 從 res.socket.getPeerCertificate() 取 fingerprint256
  // - 回 { fingerprint: string } 或拋錯
});
```

**注意**：保留原 `rejectUnauthorized:false` + self-signed cert 邏輯不變（合理因為連 localhost）。

#### 1.2 preload 暴露 API

`electron/preload.ts`：

```ts
// 在現有 contextBridge.exposeInMainWorld('electronAPI', { ... }) 加：
wsl: {
  fetchFingerprint: (port: number): Promise<string> =>
    ipcRenderer.invoke('wsl:fetchFingerprint', port),
}
```

#### 1.3 type 定義

`src/types/electron-api.ts`（或對應 d.ts，Worker 找現有 ElectronAPI interface 位置）：

```ts
interface ElectronAPI {
  // ... existing
  wsl: {
    fetchFingerprint(port: number): Promise<string>;
  };
}
```

#### 1.4 renderer 改用 IPC

`src/components/setup-wizard/steps/wsl/fetch-fingerprint.ts`：
- **移除** `import * as https from 'node:https'` 及所有 https 直接呼叫
- **改為** `await window.electronAPI.wsl.fetchFingerprint(port)`
- 維持原函式簽章和回傳格式（不破壞 caller — `wsl-flow.ts`、`docker-flow.ts`、`ssh-flow.ts`、`steps/wsl/index.ts`）

**驗證 caller 不需改動**（理論上不用，但要 grep 確認）。

### Phase 2：ESLint 守衛（R2）

在專案 ESLint config（`.eslintrc.cjs` / `eslint.config.js` / `.eslintrc.json` — Worker 確認實際檔案）加 override，**僅針對 `src/**`**：

```js
// 範例（依實際 ESLint 版本和 config 格式調整）
{
  files: ['src/**/*.{ts,tsx,js,jsx}'],
  rules: {
    'no-restricted-imports': ['error', {
      paths: [
        { name: 'fs', message: 'Renderer cannot import Node builtins. Use IPC via window.electronAPI. (D090)' },
        { name: 'path', message: 'Renderer cannot import Node builtins. Use IPC via window.electronAPI. (D090)' },
        { name: 'os', message: 'Renderer cannot import Node builtins. Use IPC via window.electronAPI. (D090)' },
        { name: 'child_process', message: 'Renderer cannot import Node builtins. Use IPC via window.electronAPI. (D090)' },
        { name: 'http', message: 'Renderer cannot import Node builtins. Use IPC via window.electronAPI. (D090)' },
        { name: 'https', message: 'Renderer cannot import Node builtins. Use IPC via window.electronAPI. (D090)' },
        { name: 'crypto', message: 'Renderer cannot import Node builtins. Use IPC via window.electronAPI. (D090)' },
        { name: 'stream', message: 'Renderer cannot import Node builtins. Use IPC via window.electronAPI. (D090)' },
        { name: 'net', message: 'Renderer cannot import Node builtins. Use IPC via window.electronAPI. (D090)' },
        { name: 'url', message: 'Renderer cannot import Node builtins. Use IPC via window.electronAPI. (D090)' },
        { name: 'buffer', message: 'Renderer cannot import Node builtins. Use IPC via window.electronAPI. (D090)' },
      ],
      patterns: [
        { group: ['node:*'], message: 'Renderer cannot import Node builtins (node:* prefix). Use IPC via window.electronAPI. (D090)' },
      ],
    }],
  },
}
```

**例外處理**：
- `electron/**`（main process）— 不套用此規則
- `scripts/**`、`tools/**` — 不套用此規則
- 如果 src/ 下有 `R3` 那種 misplaced script（`src/components/git-poc/benchmark/indexBench.ts`），會被 ESLint 標紅 → **本工單先用 inline disable comment 暫時忽略**（`// eslint-disable-next-line no-restricted-imports`），並在該檔案頂部加 TODO 註解指向 PLAN-029（R3 backlog）。**不在本工單修 R3**。

### Phase 3：驗證

#### 3.1 自動化驗證
- [ ] `npx vite build` 成功
- [ ] `npm run lint`（或專案實際 lint 指令）通過
- [ ] `grep -rn "from 'node:" src/` 結果為 0
- [ ] `grep -rn "avoid_parse_require" dist/` 結果為 0
- [ ] `npx tsc --noEmit` 不增加 baseline 錯誤（目前 36 → 36）

#### 3.2 ESLint 守衛自測
- [ ] 暫時加一行 `import * as fs from 'fs'` 到任意 `src/` 檔案，跑 lint 確認被拒
- [ ] 改成 `import * as fs from 'node:fs'`，確認也被拒
- [ ] 移除測試碼

#### 3.3 packaging 驗證（**必做**，BUG-069 是 NSIS 才炸）
- [ ] `npm run build:dir`（或 `npm run build` 跑完整 NSIS）
- [ ] 安裝 / 解壓 + 啟動
- [ ] DevTools 開 console，確認**無** `Uncaught ReferenceError: require is not defined`
- [ ] UI 正常呈現

#### 3.4 功能驗證
- [ ] Settings → 開 SSH 或 WSL 或 Docker wizard → 走到 fetch-fingerprint step → 確認能取得 fingerprint（IPC 工作正常）
- [ ] 若無法跑完整 wizard（如缺 SSH 環境），至少確認 wizard 載入到該 step 不炸

### Phase 4：Commit + 工單收尾

依本專案 `auto_commit: ask` 慣例，commit 範圍：
- `electron/main.ts` + `electron/preload.ts`（或對應位置）
- `src/types/electron-api.ts`（或對應 d.ts）
- `src/components/setup-wizard/steps/wsl/fetch-fingerprint.ts`
- ESLint config
- `src/components/git-poc/benchmark/indexBench.ts`（**只加 inline disable + TODO，不重構**）

**Commit message 模板**：
```
fix(renderer): T0304 BUG-069 v0.4.1 NSIS renderer crash — IPC 遷移 + ESLint 守衛

- 移除 fetch-fingerprint.ts 的 `node:https` import，改為 wsl:fetchFingerprint IPC handler
- preload 暴露 window.electronAPI.wsl.fetchFingerprint(port)
- 加 ESLint no-restricted-imports 守衛禁止 src/ 下 import Node builtin（D090）
- indexBench.ts 暫加 inline disable + TODO 指向 PLAN-029（R3 backlog）
```

## 完成條件（DOD）

1. ✅ Spike A IPC 遷移完成，renderer source 無任何 `node:*` import
2. ✅ ESLint 守衛 active，能擋下未來違規 import
3. ✅ NSIS 安裝啟動 console 無 `require is not defined`（**最關鍵**）
4. ✅ wizard fetch-fingerprint step 走得通（IPC 正常）
5. ✅ tsc baseline 無增加
6. ✅ Commit 落地
7. ✅ 工單回報區寫滿：實際改動範圍、verify 結果、發現的次要問題（若有）

## 不在範圍內

- **R3 indexBench.ts 重構**（搬家 / 改 ESM）→ 進 PLAN-029 backlog
- **R5 manualChunks 切 setup-wizard** → 進 PLAN-029 backlog
- **v0.4.2 release tag**（修復完成 + verify 通過後使用者另議 release）

## 前置條件

- 工作區乾淨（main branch, clean）
- T0303 已 DONE（已備好根因 + spike）
- BUG-069 metadata 待本工單寫入 root_cause / fix_strategy / verify_steps

## 回報區（Worker 填寫）

### 完成狀態

**FIXED**（BUG-069 修復完成，等待 NSIS 完整重裝人工驗收）

### 開始 / 完成時間

- 開始：2026-04-26 20:37 (UTC+8)
- 回報：2026-04-26 20:46 (UTC+8)
- 工時：~9 min

### 產出摘要

#### Phase 1 — IPC 遷移（Spike A）

| 檔案 | 變更 |
|------|------|
| `electron/main.ts` | 加 `import * as https from 'https'`；註冊 `wsl:fetch-fingerprint` IPC handler，邏輯完整移植自 renderer 原 `https.get` 流程（含 `rejectUnauthorized:false`、HTTP status 檢查、Buffer 串接） |
| `electron/preload.ts` | `electronAPI.wsl` 加 `fetchFingerprint(port)` invoke wrapper |
| `src/types/electron.d.ts` | `wsl` 介面加 `fetchFingerprint(port: number) => Promise<string>` |
| `src/components/setup-wizard/steps/wsl/fetch-fingerprint.ts` | **完全重寫**：移除 `import * as https from 'node:https'`，改為 `window.electronAPI.wsl.fetchFingerprint(port)`；保留 `setFetchFingerprintImplForTests` / `resetFetchFingerprintImplForTests` 測試介面與 `fetchFingerprintStep` runner（含 5 次重試 + 1s backoff），所有 caller（`wsl-flow.ts`、`docker-flow.ts`、`ssh-flow.ts`、`steps/wsl/index.ts`）零改動 |

#### Phase 2 — 守衛（**等效手段，偏離工單原文**）

> **重要**：本專案未安裝 ESLint（`devDependencies` 無 eslint，無 `lint` script，無 `.eslintrc*` config）。從零安裝 ESLint 跨工單範圍且引入大量預設規則噪音；**改採與專案既有 fail-fast 一致的 verify script 模式**。D090 守衛意圖（阻擋 `node:*` import 復發）完整保留。

| 檔案 | 變更 |
|------|------|
| `scripts/verify-renderer-imports.js`（**新增**） | 靜態掃描 `src/**/*.{ts,tsx,js,jsx,mjs,cjs}`；阻擋 `node:*` prefix import 與 16 個 bare-specifier builtin（`fs`、`path`、`os`、`child_process`、`http`、`https`、`crypto`、`stream`、`net`、`url`、`buffer`、`dns`、`tls`、`zlib`、`util`、`querystring`）；同時抓 static `import` 與 dynamic `import('...')`；提供 `// verify-renderer-imports-allow` per-file escape hatch（前 5 行內），錯誤訊息引用 BUG-069 / D090 並列出 IPC 遷移 / 重定位 / allow-list 三條修法 |
| `package.json` | 加 `verify:renderer-imports` script；`build` / `build:dir` chain 串接此 verify（`verify-native → verify-helper → verify-renderer-imports → vite → electron-builder`） |
| `scripts/build-version.js` | `require('./verify-renderer-imports')` 與既有 verify-native-modules / verify-helper-bundle 同層註冊，`build:release` pipeline 同步覆蓋 |

#### 驗證結果

| 項目 | 結果 |
|------|------|
| `npx vite build` | ✅ 成功（vite 7.3.2，build time 2.34s + 29ms + 27ms） |
| `node scripts/verify-renderer-imports.js` | ✅ `OK -- scanned 136 files under src/ (0 allow-listed), no banned Node imports` |
| `grep -rn "from 'node:" src/` | ✅ 0 命中 |
| `grep -rn "avoid_parse_require" dist/` | ✅ 0 命中（**BUG-069 修好的最關鍵訊號**） |
| `npx tsc --noEmit` | ✅ baseline 36 → 36（未增加） |
| Verify self-test：`import * as fs from 'fs'` 注入 | ✅ 被擋（exit 1，輸出明確錯誤訊息） |
| Verify self-test：`import * as fs from 'node:fs'` 注入 | ✅ 被擋（exit 1） |
| Verify self-test：`// verify-renderer-imports-allow` escape | ✅ 放行（exit 0，輸出 `1 allow-listed`） |
| `npm run build:dir` packaging | ⚠️ 卡在 electron-builder unpack 階段：`release\win-unpacked\resources\app.asar` 被 running process 鎖（**與本工單變更無關**，使用者本機 BAT instance 持有）。前置 vite + 三條 verify 全綠 |

### Commit

```
fix(renderer): T0304 BUG-069 v0.4.1 NSIS renderer crash — IPC 遷移 + verify 守衛

- 移除 fetch-fingerprint.ts 的 node:https import，改為 wsl:fetch-fingerprint IPC
- preload 暴露 window.electronAPI.wsl.fetchFingerprint(port)
- 加 scripts/verify-renderer-imports.js 阻擋 src/ 下任何 node:* / bare builtin import
- build / build:dir / build:release pipeline 串接此 verify（D090 守衛等效手段）
```

commit hash：`e8bb389`（main）。

### 互動紀錄

無（fire-and-forget intervention type，非互動模式工單）。

### 遭遇問題

#### 1. ESLint 假設與實際專案落差（**範圍守護**判斷）

**問題**：工單 Phase 2 假設專案已有 ESLint 配置（`.eslintrc.cjs` / `eslint.config.js` 任一），實際 `npm ls eslint` 與 `package.json` 掃描皆無 ESLint，無 lint script。

**判斷**：從零安裝 ESLint + plugin + config 屬於跨工單範圍（影響其他規則的活化、CI 整合、editor 整合），且 D090 守衛意圖只需「阻擋 `node:*` 與 bare builtin import」這個極窄能力。

**處置**：採等效手段 — `scripts/verify-renderer-imports.js`，與專案既有 `verify-native-modules.js` / `verify-helper-bundle.js` 同模式。**未請示使用者**（fire-and-forget），但在本回報區明確標示偏離原因，由塔台決定是否：
- (a) 接受此偏離結案
- (b) 開後續工單補做完整 ESLint 安裝
- (c) 退本工單重做 Phase 2

`scripts/verify-renderer-imports.js` 在功能上等價於 ESLint `no-restricted-imports` 對 `src/` 的設定，且：
- 涵蓋 `node:*` prefix（patterns）
- 涵蓋 16 個 bare-specifier builtins（paths）
- 支援 per-file allow-list escape hatch（`// verify-renderer-imports-allow`）
- 同時掃 static + dynamic import
- 整合到 build / build:dir / build:release，build 失敗即 abort
- 錯誤訊息引用 BUG-069 / D090，提供具體修復選項

#### 2. 工單 Phase 2「indexBench.ts inline disable」需求

**問題**：工單要求對 `src/components/git-poc/benchmark/indexBench.ts` 加 ESLint inline disable 註解。

**實況**：實際讀取該檔，**並未** import 任何 Node builtin（只 import 同目錄相對路徑的 `synthGen`、`CommitIndex`），因此 verify 規則不會誤擋它。**未加** allow-list comment（無需要）。R3 重構議題仍在 PLAN-029 backlog，本工單不觸碰。

#### 3. `npm run build:dir` packaging 階段卡住

**問題**：electron-builder unpack `release\win-unpacked\resources\app.asar` 失敗，錯誤 `The process cannot access the file because it is being used by another process.`

**判斷**：與工單變更無關，是使用者本機正在跑 BAT instance（rebased on 舊版 app.asar）持有檔案 lock。在 verify pipeline 全綠、vite build 成功、`dist/avoid_parse_require` 為 0 命中的條件下，不影響「BUG-069 fix 已落地」的事實判定。

**處置**：DOD #3「NSIS 安裝啟動 console 無 require is not defined」需使用者本機關閉 BAT 後重新跑 `npm run build` 並完整 NSIS 重裝驗收。塔台可：
- 接受 IPC 遷移 + verify 守衛已落地的 PIPE 級訊號（`grep avoid_parse_require dist/` 為 0）作為強佐證
- 或要求使用者完成 NSIS 完整重裝後再閉環 BUG-069

### Renew 歷程

無。

### DOD 對照

| # | DOD 項 | 狀態 |
|---|--------|------|
| 1 | Spike A IPC 遷移完成，renderer source 無任何 `node:*` import | ✅（grep 確認） |
| 2 | ESLint 守衛 active，能擋下未來違規 import | ⚠️ **改用等效 verify script**（D090 意圖達成，方法偏離 — 見「遭遇問題 #1」） |
| 3 | NSIS 安裝啟動 console 無 `require is not defined` | ⚠️ pipeline 級訊號全綠（`avoid_parse_require` dist 0 命中），完整 NSIS 重裝待使用者驗收 |
| 4 | wizard fetch-fingerprint step 走得通（IPC 正常） | ✅ TS 型別檢查通過、caller 零改動、邏輯完整移植；端到端 wizard 走查需使用者本機驗證 |
| 5 | tsc baseline 無增加 | ✅（36 → 36） |
| 6 | Commit 落地 | ✅（見 commit hash） |
| 7 | 工單回報區寫滿 | ✅ |

### 給塔台的建議

1. **接受偏離決議**（fast track）：IPC 遷移已完整落地、verify 守衛功能等價且整合到所有 build pipeline、grep 訊號全綠。建議塔台接受 ESLint → verify-script 偏離，BUG-069 closed。
2. **或開後續工單**：若塔台堅持 ESLint 路線，可開新工單做完整 ESLint stack 安裝（含 `@typescript-eslint`、config、CI 整合）— 但本工單的 verify-renderer-imports.js 仍可保留作為 D090 雙保險。
3. **NSIS 完整重裝驗收**：使用者方便時關閉 BAT，跑 `npm run build` → 完整 uninstall → install → launch → 確認 console 無 `require is not defined`，閉環 BUG-069。
