---
schema_version: 1
schema_kind: workorder
id: T0271
title: impl-plan007-server-bundle-pipeline-linux-x64
type: impl
status: DONE
created_at: "2026-04-26T02:26:00+08:00"
started_at: "2026-04-26T21:00:00+08:00"
completed_at: "2026-04-26T02:47:00+08:00"
renew_count: 0
---
# T0271-impl-plan007-server-bundle-pipeline-linux-x64

## 元資料
- **工單編號**：T0271
- **任務名稱**：PLAN-007 Phase 1 第四張 — Server bundle pipeline (linux-x64 baseline) — esbuild bundle + 內嵌 node 24 + native rebuild + verify-server-bundle.js
- **狀態**：DONE
- **建立時間**：2026-04-26 02:26 (UTC+8)
- **開始時間**：2026-04-26 21:00 (UTC+8)
- **完成時間**：2026-04-26 02:47
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

#### Step 4：複製 native modules（linux-x64）
從 worktree `node_modules/` 抓以下到 `dist-server/staging/node_modules/`：
- `@lydell/node-pty/` + `node-pty-linux-x64/`（**只抓 linux-x64，不抓 win/darwin**）
- `better-sqlite3/`（含 `build/Release/better_sqlite3.node`）
- `@img/sharp/` + `sharp-linux-x64/`（只抓 linux-x64）
- `@anthropic-ai/claude-code/`
- `@anthropic-ai/claude-agent-sdk/`

#### Step 5：複製 server source
- `electron/remote/` → `dist-server/staging/electron/remote/`
- `electron/handlers/` → `dist-server/staging/handlers/`（若 codebase 有此目錄；無則跳過記在回報區）

#### Step 6：寫 bat-server launcher script + README

#### Step 7：tar pack
產出 `dist-server/bat-server-linux-x64-v${VERSION}.tar.gz`，預期 70-100 MB（spec §2.3 AC；baseline 容許 50-150 MB）。

### 2. `scripts/verify-server-bundle.js`（spec §6 C-6）

仿 `scripts/verify-native-modules.js` 與 `scripts/verify-helper-bundle.js` 風格。基本邏輯：

1. 讀 argv[2] 或預設 `dist-server/bat-server-linux-x64-v<version>.tar.gz`
2. 用 `execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' })` 取 file list
3. 對 file list grep forbidden patterns：`['whisper', '@kutalia/whisper-node-addon']`
4. 任一 match → 印違規檔列表 → `process.exit(1)`
5. 全清 → 印 `✅ No forbidden patterns. Bundle is clean.`

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

### 4. 最小 server-entry stub（可選）

若 codebase 還沒有 `electron/remote/server-entry.ts`，建一個最小 stub。

### 5. `.gitignore` 加 `dist-server/`

---

## 驗收標準（AC）

- [ ] **AC1**：`scripts/build-server-bundle.mjs` 落地，能在 worktree 執行 `npm run build:server-bundle`
- [ ] **AC2**：產出 `dist-server/bat-server-linux-x64-v<version>.tar.gz`
- [ ] **AC3**：`scripts/verify-server-bundle.js` 落地，對自家產出 tarball 跑 `npm run verify:server-bundle` 通過
- [ ] **AC4**：刻意改 build script 把 whisper 不排除（**測試後還原**），跑 verify-server-bundle 應 abort
- [ ] **AC5**：tarball 解壓後，目錄結構含 `bin/{node,bat-server,bat-server.js}` + `node_modules/{@lydell/node-pty,...}` + `electron/remote/` + `README.md`
- [ ] **AC6**：tarball 解壓後 `node_modules/` 內 grep `whisper`、grep `sharp-darwin`、grep `sharp-win32`、grep `node-pty-darwin`、grep `node-pty-win32` 全部空
- [ ] **AC7**：`README.md` 含 version / target / node version / glibc lower bound / SHA-256
- [ ] **AC8**：bat-server launcher script 執行（在 linux 上）會跑 stub 並印「T0271 stub」訊息（**Worker 在 Windows 上可豁免 runtime 驗收**）
- [ ] **AC9**：`package.json` 加 `build:server-bundle` + `verify:server-bundle` script
- [ ] **AC10**：`.gitignore` 含 `dist-server/`
- [ ] **AC11**：`npm run build`（既有 desktop build）不受影響，仍然通過
- [ ] **AC12**：Worker 在 worktree commit `feature/plan-007-remote-dev` 分支

---

## 回報區（Worker 填寫）

**狀態變更**：TODO → IN_PROGRESS → DONE

**worktree commit**：`42eab95` on `feature/plan-007-remote-dev`

**修改檔**：
- `.gitignore`
- `package.json`
- `_ct-workorders/T0271-impl-plan007-server-bundle-pipeline-linux-x64.md`
- `electron/remote/server-entry.ts`
- `scripts/_bat-server-helpers.mjs`
- `scripts/build-server-bundle.mjs`
- `scripts/verify-server-bundle.js`

**Build pipeline 結果**：
- tarball: `dist-server/bat-server-linux-x64-v0.3.1.tar.gz` size: `123.76 MB`
- 解壓檔數: `257`
- `bin/bat-server.js` size: `0.51 KB`（stub）
- whisper grep: ✅ `0` matches
- forbidden grep: ✅ `sharp-darwin` / `sharp-win32` / `node-pty-darwin` / `node-pty-win32` 全部 `0` matches
- handlers dir: 不存在於此 branch，build script 依 spec 走 skip path

**Verify script 結果**：
- 正向：✅ `npm run verify:server-bundle`
- 反向（AC4）：✅ 注入 `staging/node_modules/whisper-marker.txt` 後 verify fail-fast abort

**Native rebuild 策略選擇**：
- [x] 複製 host 既有（Phase 1 baseline）
- [ ] 在 worker 重 build（Phase 2+ 真正方案）
- [x] 設環境變數降級（BAT_SERVER_ALLOW_MISSING_NATIVE）
- 理由：baseline 以 host 已存在 package + linux-x64 prebuilt package staging 為主；若未預裝 linux-x64 package 則 script fail-fast，亦保留 env 降級供 schema-only 驗證

**Node 取得策略選擇**：
- [x] 自動下載（Fetch + nodejs.org `index.json` 選最新 v24 + system `tar` 解壓）
- [ ] 環境變數指定（BAT_SERVER_NODE_BINARY）
- 理由：避免把 Node 24 patch version 寫死在 repo；本次實測抓到 `24.15.0`

**主動超出範圍項**（如有）：
- staged `@anthropic-ai/claude-code` 會移除 Windows `claude.exe` 並改成 wrapper 指向 `claude-code-linux-x64/claude`，避免 bundle 體積暴增且更符合 linux-x64 artifact 語意

**遇到的問題 / 決策**：
- `npm install --no-save` 無法在 Windows 裝 linux-only package（`EBADPLATFORM`），改為從 `package-lock.json` pin 的 tarball URL 直接解壓到 worktree `node_modules/`
- spec 文案寫 `@img/sharp`，但實際 repo package layout 為 `sharp` + `@img/sharp-linux-x64` / `@img/sharp-libvips-linux-x64`，pipeline 以實際 layout 為準
- 初版 tarball 約 `278.83 MB` 超出 baseline；後續移除 staged Windows Claude binary、取消重複 linux SDK binary，降到 `123.76 MB`
- `npm run build` 維持通過；未修改 CI workflow / electron-builder config / runtime server logic

**Renew 觸發**（如有）：
- 無

**互動紀錄**：
- 無

**遭遇問題**：
- 無阻斷；`sprint-status.yaml` 存在但屬全專案舊摘要，與此 worktree phase 無直接同步欄位，標記為不適用未修改
