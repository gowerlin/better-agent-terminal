# T0304 — Fix BUG-069：fetch-fingerprint `node:https` IPC 遷移（Spike A）+ ESLint 守衛（R2）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0304 |
| 類型 | fix |
| 優先級 | 🔴 High（v0.4.2 patch blocker） |
| 狀態 | 📋 TODO |
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

> （Worker 完成後填寫）
