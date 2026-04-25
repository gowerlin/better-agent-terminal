# T0271-impl-plan007-server-bundle-pipeline-linux-x64

## 元資料
- **工單編號**：T0271
- **任務名稱**：PLAN-007 Phase 1 第四張 — Server bundle pipeline (linux-x64 baseline) — esbuild bundle + 內嵌 node 24 + native rebuild + verify-server-bundle.js
- **狀態**：TODO
- **建立時間**：2026-04-26 02:26 (UTC+8)
- **類型**：impl（build infra + verify script，無 production runtime code）
- **互動模式**：disabled（fire-and-forget；scope 已被 spec doc §2.3 / §6 C-6 凍結）
- **Renew 次數**：0
- **預估 wall time**：8-16h（L sizing；參考 T0269/T0270 實際 10-14 min，本工單涉及 build script + 重 build native + 解壓驗證可能 30-90 min）
- **預估 context cost**：高（讀 package.json / electron-builder config / scripts/verify-*.js + 寫新 build script + tarball pipeline + verify script）
- **關聯**：
  - 母 PLAN：PLAN-007（📋 PLANNED）
  - Spec 依據：
    - `_ct-workorders/_spec-remote-dev-support-2026-04.md` §2.3 Server bundle pipeline（凍結）
    - 同 spec §2.5 Native module 相容性 baseline
    - 同 spec §6 C-6 Whisper exclude 驗證（雙保險）
  - 前序：無（與 T0268-T0270 並行 Phase 1）— 本工單**無 source code 依賴**
  - 後續：T0272 createHeadlessServer factory 依本工單；T0285 Server bundle CI matrix 擴 darwin-arm64 + linux-arm64
  - **D089 worktree 策略**：本工單在 `../bat-plan-007` worktree 內執行，**禁止寫主線**
- **affects_files**（**worktree** `../bat-plan-007` 內，**不是主線**）：
  - 新增 `scripts/build-server-bundle.mjs`（esbuild bundle + 內嵌 node 24 download + native rebuild + tar pack）
  - 新增 `scripts/verify-server-bundle.js`（解壓 tarball → grep `whisper` substring → exist=abort，仿 `verify-native-modules.js` 風格）
  - 改 `package.json`：加 `build:server-bundle` script + `verify:server-bundle` script + 必要 devDependencies
  - 可能新增 `electron/remote/server-entry.ts`（esbuild entry，純 server 啟動程式，**不含**任何 renderer / electron import；Phase 1 可以是最小 stub，T0272 會擴）
  - 可能新增 `scripts/_bat-server-helpers.mjs`（download node prebuilt + native rebuild helpers，符合 BUG-058 helper bundle 規範）
  - 可能新增 `dist-server/`（build output 目錄；加 `.gitignore`）
  - 主線（**禁止寫入**）：僅本工單檔回報區可在主線更新

---

## D089 worktree 工作守則

**本工單為 PLAN-007 Phase B 第四張，沿用 T0268-T0270 worktree 模式**：

1. **cd 到 worktree**：`cd /d/ForgejoGit/BMad-Guide/better-agent-terminal/bat-plan-007`
2. **base commit**：`26eb10d`（T0270 DONE）on `feature/plan-007-remote-dev`
3. **commit 全部到 `feature/plan-007-remote-dev` 分支**
4. **絕對禁止**：
   - 切回主線改檔
   - push 到 origin
   - 在主線目錄下做 source code 修改
   - **不要動 CI workflow**（`.github/workflows/`）— 本工單只建 local script，CI matrix 是 T0285
5. **本工單檔元資料更新**：Worker 完成後更新 worktree 內本工單檔狀態 → DONE 記 commit hash；**主線本工單檔由塔台同步**

---

## 任務目標

### 1. `scripts/build-server-bundle.mjs`（spec §2.3 凍結結構）

新增 ESM script，依序執行 7 步驟 pipeline：

#### Step 1：清理 + 準備 output 目錄
建立 `dist-server/staging/{bin,node_modules,electron/remote,handlers}` 結構。

#### Step 2：esbuild bundle server entry
- entry：`electron/remote/server-entry.ts`（本工單可建最小 stub）
- output：`dist-server/staging/bin/bat-server.js`
- bundle 設定：platform=node / target=node24 / format=cjs（或 esm，看 codebase 慣例） / sourcemap=inline
- **external**（不 bundle，靠 node_modules/）：
  - native modules：`@lydell/node-pty`、`better-sqlite3`、`@img/sharp`、`sharp`、`@anthropic-ai/claude-code`、`@anthropic-ai/claude-agent-sdk`
  - **HARD EXCLUDE**：`@kutalia/whisper-node-addon`
  - electron 整體：`electron`

> 預期 output：`bat-server.js` 約 3-5 MB（spec §2.3）。
> Phase 1 entry 可以是最小 stub（印一行訊息即可），目的是驗證 pipeline 跑得通。

#### Step 3：取得 node 24 prebuilt（linux-x64）
從 `https://nodejs.org/dist/v24.X.Y/node-v24.X.Y-linux-x64.tar.xz` 取得，解壓後 `bin/node` 放到 `dist-server/staging/bin/node`。

實作彈性（Worker 自決，記在回報區）：
- 用 `undici` / `node-fetch` 下載 + `tar` npm 套件解壓（純 Node，跨平台）
- 用 `execFileSync('curl', [...])` + `execFileSync('tar', [...])`（依賴 system tool，不要用 shell exec/拼字串）
- 降級：環境變數 `BAT_SERVER_NODE_BINARY` 指定本機 node binary 絕對路徑，build script 從該路徑複製；找不到則 abort + 印指引
  - 此降級對 Phase 1 baseline 完全 OK，Phase 2 CI 才需要自動下載

> Node 版本對齊 Electron 41 的 ABI（spec §2.5 寫 24.x prebuilt）。

#### Step 4：複製 native modules（linux-x64）
從 worktree `node_modules/` 抓以下到 `dist-server/staging/node_modules/`：
- `@lydell/node-pty/` + `node-pty-linux-x64/`（**只抓 linux-x64，不抓 win/darwin**）
- `better-sqlite3/`（含 `build/Release/better_sqlite3.node`）
- `@img/sharp/` + `sharp-linux-x64/`（只抓 linux-x64）
- `@anthropic-ai/claude-code/`
- `@anthropic-ai/claude-agent-sdk/`

**HARD EXCLUDE**：
- `@kutalia/whisper-node-addon/` 全部
- `sharp-darwin*` / `sharp-win32*` / `node-pty-darwin*` / `node-pty-win32*`
- `electron/`、`xterm/`、`@xterm/*`、`src/**`

> Worker 在 Windows 上跑時 host 可能沒有 `node-pty-linux-x64`（npm install 不會抓非當前平台 binary）。**若偵測到缺失，build script abort 並印指引**：「請在 linux 環境跑 `npm install --target_platform=linux --target_arch=x64` 後重試」或「設 `BAT_SERVER_ALLOW_MISSING_NATIVE=1` 跳過此 platform check（僅供 schema 驗證用）」。Worker 自決哪個策略，記在回報區。

#### Step 5：複製 server source
- `electron/remote/` → `dist-server/staging/electron/remote/`
- `electron/handlers/` → `dist-server/staging/handlers/`（若 codebase 有此目錄；無則跳過記在回報區）

#### Step 6：寫 bat-server launcher script + README
launcher（POSIX shell `dist-server/staging/bin/bat-server`）：
```sh
#!/bin/sh
exec "$(dirname "$0")/node" "$(dirname "$0")/bat-server.js" "$@"
```
（記得 `chmod +x`）

`README.md` 含：
- bundle version（讀 root package.json `version`）
- target = linux-x64
- node version
- glibc lower bound = 2.35（spec §2.5）
- SHA-256（pack 完後計算，sha256sum 或 Node `crypto.createHash`）

#### Step 7：tar pack
產出 `dist-server/bat-server-linux-x64-v${VERSION}.tar.gz`，預期 70-100 MB（spec §2.3 AC；baseline 容許 50-150 MB）。

實作彈性：用 `tar` npm 套件（純 Node）或 `execFileSync('tar', ['-czf', ...])`。

### 2. `scripts/verify-server-bundle.js`（spec §6 C-6）

仿 `scripts/verify-native-modules.js` 與 `scripts/verify-helper-bundle.js` 風格。基本邏輯：

1. 讀 argv[2] 或預設 `dist-server/bat-server-linux-x64-v<version>.tar.gz`
2. 用 `execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' })` 取 file list（**不要用 exec/拼字串**）
3. 對 file list grep forbidden patterns：`['whisper', '@kutalia/whisper-node-addon']`
4. 任一 match → 印違規檔列表 → `process.exit(1)`
5. 全清 → 印 `✅ No forbidden patterns. Bundle is clean.`

**Worker 必須使用 `execFileSync` 或 `spawnSync`，禁止用 `exec()` 拼字串**（codebase 安全規範，亦見 hook 警告）。

### 3. `package.json` script

加：
```json
{
  "scripts": {
    "build:server-bundle": "node scripts/build-server-bundle.mjs",
    "verify:server-bundle": "node scripts/verify-server-bundle.js"
  }
}
```

devDependencies 視 Worker 選擇而定（如 `tar`、`undici` 看實作策略；esbuild 應已在）。

### 4. 最小 server-entry stub（可選）

若 codebase 還沒有 `electron/remote/server-entry.ts`，建一個最小 stub：

```typescript
// electron/remote/server-entry.ts
console.log('[bat-server] T0271 stub — T0272 will implement createHeadlessServer')
process.exit(0)
```

> Phase 1 目的是讓 build pipeline 跑得通，不是讓 server 跑得起來。T0272 才會接 RemoteServer。

### 5. `.gitignore` 加 `dist-server/`

避免 build artifact 進 git。

---

## 守則 / 邊界

1. **不接 createHeadlessServer**：本工單只建 build pipeline，server runtime 是 T0272。bat-server 啟動行為是 stub。
2. **不動 CI workflow**：`.github/workflows/` 完全不碰。CI matrix 是 T0285。
3. **不動 electron-builder**：本工單與 desktop release 解耦，不改 `package.json` 的 `build` 區塊。
4. **Hard exclude whisper 必須雙層**：esbuild externals + native modules 複製清單，缺一不可。
5. **Tarball 命名嚴格**：`bat-server-linux-x64-v<package.json version>.tar.gz`，不要自訂 suffix。
6. **Native rebuild 策略可彈性**：spec 寫「重 build」是 Phase 2+ 的 CI matrix 行為。Phase 1 baseline 可以「複製 host 既有 native」（worker 自決，記在回報區）。
7. **不用 `child_process.exec()` 拼字串**：codebase 安全規範。改用 `execFileSync` / `spawnSync` / `execFileNoThrow`。
8. **不要動 source code**（除 `electron/remote/server-entry.ts` 這支可選 stub）。
9. **不要刪除既有 build artifact 或 native modules**。

---

## 驗收標準（AC）

- [ ] **AC1**：`scripts/build-server-bundle.mjs` 落地，能在 worktree 執行 `npm run build:server-bundle` 不報錯（或 abort 並印明確指引，視 Native rebuild 策略而定）
- [ ] **AC2**：產出 `dist-server/bat-server-linux-x64-v<version>.tar.gz`（檔案存在，size 在 50-150 MB 範圍——baseline 容許寬鬆，spec 70-100 是 prod 目標）
- [ ] **AC3**：`scripts/verify-server-bundle.js` 落地，對自家產出 tarball 跑 `npm run verify:server-bundle` 通過（無 whisper substring）
- [ ] **AC4**：刻意改 build script 把 whisper 不排除（**測試後還原**），跑 verify-server-bundle 應 abort 並印 forbidden file（驗證 fail-fast 機制）
- [ ] **AC5**：tarball 解壓後，目錄結構含 `bin/{node,bat-server,bat-server.js}` + `node_modules/{@lydell/node-pty,...}` + `electron/remote/` + `README.md`
- [ ] **AC6**：tarball 解壓後 `node_modules/` 內 grep `whisper`、grep `sharp-darwin`、grep `sharp-win32`、grep `node-pty-darwin`、grep `node-pty-win32` 全部空
- [ ] **AC7**：`README.md` 含 version / target / node version / glibc lower bound / SHA-256
- [ ] **AC8**：bat-server launcher script 執行（在 linux 上）會跑 stub 並印「T0271 stub」訊息（**Worker 在 Windows 上可豁免 runtime 驗收**，留 Phase 2 在 WSL/Linux 環境補）
- [ ] **AC9**：`package.json` 加 `build:server-bundle` + `verify:server-bundle` script
- [ ] **AC10**：`.gitignore` 含 `dist-server/`
- [ ] **AC11**：`npm run build`（既有 desktop build）不受影響，仍然通過
- [ ] **AC12**：Worker 在 worktree commit `feature/plan-007-remote-dev` 分支，**不**動主線（除本工單檔回報區）

---

## 完成步驟（建議）

1. cd 到 worktree（`../bat-plan-007`）
2. 確認 base commit `26eb10d`
3. 讀 spec doc §2.3 / §2.5 / §6 C-6
4. 讀 `scripts/verify-native-modules.js` + `scripts/verify-helper-bundle.js` 抓風格
5. 寫最小 `electron/remote/server-entry.ts` stub（或檢查 codebase 已有）
6. 寫 `scripts/build-server-bundle.mjs`（7 步驟 pipeline；遇 native 缺失就 fail-fast）
7. 跑 `npm run build:server-bundle`
8. 寫 `scripts/verify-server-bundle.js`（用 execFileSync）
9. 跑 `npm run verify:server-bundle` 驗證
10. **AC4 反向測試**：暫時把 whisper 拿掉 exclude，確認 verify abort（測完還原）
11. 改 `package.json` + `.gitignore`
12. 跑既有 `npm run build` 確認不破
13. commit 到 `feature/plan-007-remote-dev`（建議 message：`feat(server-bundle): T0271 linux-x64 build pipeline + verify-server-bundle`）
14. 更新本工單檔（worktree 內）狀態 → DONE，回報 commit hash + tarball size + verify 結果 + native rebuild 策略選擇
15. 結束 session

---

## 回報區（Worker 填寫）

**狀態變更**：TODO → IN_PROGRESS → DONE / FAILED / 需要協助

**worktree commit**：`<hash>` on `feature/plan-007-remote-dev`

**修改檔**：
- ...

**Build pipeline 結果**：
- tarball: `dist-server/bat-server-linux-x64-v<version>.tar.gz` size: <N> MB
- 解壓檔數: <N>
- `bin/bat-server.js` size: <N> MB
- whisper grep: ✅ 0 matches / ❌ <N> matches

**Verify script 結果**：
- 正向：✅/❌
- 反向（AC4）：✅/❌

**Native rebuild 策略選擇**：
- [ ] 複製 host 既有（Phase 1 baseline）
- [ ] 在 worker 重 build（Phase 2+ 真正方案）
- [ ] 設環境變數降級（BAT_SERVER_ALLOW_MISSING_NATIVE）
- 理由：

**Node 取得策略選擇**：
- [ ] 自動下載（undici / curl）
- [ ] 環境變數指定（BAT_SERVER_NODE_BINARY）
- 理由：

**主動超出範圍項**（如有）：
- ...

**遇到的問題 / 決策**：
- ...

**Renew 觸發**（如有）：
- ...

---
