# T0283 — Impl PLAN-007 Server bundle pipeline (linux-arm64 + darwin-arm64) + 獨立 GitHub Actions workflow

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0283 |
| 類型 | impl（build infra + CI workflow，無 production runtime code） |
| Phase | PLAN-007 Phase 4（SSH deployment）第二張 |
| 狀態 | ✅ DONE（PARTIAL → 接受；AC1/5/6/7/8/9/10 全綠 + AC2/3 環境限制（Windows worktree 缺 arm64/darwin native sub-package，Worker 守則 7 已預告 fail-fast 行為） + AC4 CI-only（全 3 platform 必走 matrix）；worktree commit `36800f1`） |
| 建立時間 | 2026-04-26 14:14 (UTC+8) |
| 派發時間 | 2026-04-26 14:14 (UTC+8) |
| 完成時間 | 2026-04-26 14:25 (UTC+8) |
| Wall time | ~11 min（GP099 校準 30-90 min 預期，再次落於下界以下；T0271 baseline + spec §6 C-1 凍結 + Worker 守則 8 預先給 runner labels guidance 是神速主因） |
| Worktree commit | `36800f1` on `feature/plan-007-remote-dev` |
| CI matrix 待驗 | push `feature/plan-007-remote-dev` 後觸發 `build-server-bundle.yml` 新 workflow，AC2/3/4 在 GitHub Actions matrix 自然驗（runner: `ubuntu-22.04` / `ubuntu-22.04-arm` / `macos-14`） |
| Sizing | L（spec 估 8-16h；GP099 校準後預期 wall 30-90 min — esbuild 已備、CI workflow 為主要工作量） |
| 依賴 | T0271 ✅（linux-x64 baseline pipeline）、T0282 ✅（無直接依賴；可平行但併入鏈式派發） |
| 後續 | T0284（SshTunnel class）+ T0285（SSH setup wizard）皆需 server bundle 才能在 e2e 跑通；T0286 SSH e2e 直接消費本工單 artifact |
| 工作目錄 | `../bat-plan-007`（worktree on `feature/plan-007-remote-dev`） |
| Renew 次數 | 0 |
| 互動旗標 | `--mode yolo --no-interactive`（fire-and-forget） |
| `affects_files` | `scripts/build-server-bundle.mjs`（擴 target arg）、`scripts/verify-server-bundle.js`（擴 platform fixtures）、`.github/workflows/build-server-bundle.yml`（新建）、`package.json` build scripts |

## 目標

擴 T0271 `build-server-bundle.mjs` 支援 `--target=linux-arm64` / `--target=darwin-arm64`（共 3 platform：linux-x64 / linux-arm64 / darwin-arm64）；新增**獨立** `.github/workflows/build-server-bundle.yml`（落地 spec §6 C-1：server bundle pipeline 與 desktop release 解耦，避免 release path 阻塞）；verify script 跑 3 platform 同樣 hard-exclude 驗證 + tarball 結構檢查。

## 範圍

### 修改

1. **`scripts/build-server-bundle.mjs`**（worktree T0271 已建）
   - 新增 CLI arg：`--target=linux-x64|linux-arm64|darwin-arm64`（預設 `linux-x64` 維持向後相容）
   - **Step 3 取得 node 24**：依 target 切換 URL
     - `linux-x64`：`node-v24.X.Y-linux-x64.tar.xz`
     - `linux-arm64`：`node-v24.X.Y-linux-arm64.tar.xz`
     - `darwin-arm64`：`node-v24.X.Y-darwin-arm64.tar.gz`（注意 darwin 用 .tar.gz 不是 .tar.xz）
   - **Step 4 複製 native modules**：依 target 切換 platform-specific package
     - `linux-arm64`：`@lydell/node-pty/node-pty-linux-arm64/`、`@img/sharp-linux-arm64/`
     - `darwin-arm64`：`@lydell/node-pty/node-pty-darwin-arm64/`、`@img/sharp-darwin-arm64/`
   - **better-sqlite3**：3 platform 通用 prebuilt 路徑（檢查 worktree node_modules 已備什麼）
   - tarball 命名規則：`bat-server-${target}-v${version}.tar.gz`（取代原 `bat-server-linux-x64.tar.gz` hardcode）
   - **錯誤處理**：target 不在白名單 → exit 1 with clear message
2. **`scripts/verify-server-bundle.js`**（worktree T0271 已建）
   - 擴 fixtures：tarball pattern 改為 glob `bat-server-{linux-x64,linux-arm64,darwin-arm64}-v*.tar.gz`
   - 對每個 tarball 跑同樣檢查：
     - `whisper` substring 不存在（hard exclude，spec §2.5 / §6 C-6）
     - `bin/node` 存在 + 可執行
     - `bin/bat-server.js` 存在
     - `node_modules/@lydell/node-pty` 存在（不再驗 sub-package，target 差異交給 build script）
     - `node_modules/better-sqlite3` 存在
   - 任一 tarball fail → 整體 abort，stderr 印明確訊息

### 新增

3. **`.github/workflows/build-server-bundle.yml`**（新建，**獨立**於 desktop release workflow）
   - **trigger**：
     - `push` 到 `feature/plan-007-remote-dev` branch（worktree 期間 dogfood）
     - `push` tag matches `server-bundle-v*`（release tag）
     - `workflow_dispatch`（手動）
     - **不**接 `release.yml` 既有 `release` event（避免阻塞 desktop release）
   - **Job matrix**（3 個 job 並行）：
     | Job ID | runs-on | target | 備註 |
     |--------|---------|--------|------|
     | `build-linux-x64` | `ubuntu-22.04` | `linux-x64` | 原生 build |
     | `build-linux-arm64` | `ubuntu-22.04-arm` 或 `ubuntu-22.04` + qemu | `linux-arm64` | runner 不支援 → 記 TODO 用 docker buildx + qemu |
     | `build-darwin-arm64` | `macos-14` | `darwin-arm64` | macOS 14 = arm64 runner |
   - **每個 job 步驟**：
     1. checkout
     2. setup node 24
     3. `npm ci`
     4. `node scripts/verify-native-modules.js`（沿用 desktop release fail-fast）
     5. `node scripts/build-server-bundle.mjs --target=<target>`
     6. `node scripts/verify-server-bundle.js`（單 platform 模式：傳 `--target=<target>` 跳過其他兩個 tarball 缺席）
     7. upload artifact `bat-server-<target>-v<version>.tar.gz` 到 GitHub Actions artifact store
   - **release job**（依賴上述 3 個 job）：
     - 只在 tag push 觸發
     - 下載 3 個 artifact
     - 跑全 3 platform `verify-server-bundle.js`（完整模式）
     - 用 `softprops/action-gh-release@v1` 建 GitHub Release（標 prerelease，不影響 desktop release）

### 修改

4. **`package.json`**
   - 新增 npm scripts：
     - `build:server-bundle:linux-x64`：`node scripts/build-server-bundle.mjs --target=linux-x64`
     - `build:server-bundle:linux-arm64`：同上
     - `build:server-bundle:darwin-arm64`：同上
     - `build:server-bundle:all`：依序跑三個（local 全 build；CI 走 matrix）

### Out of scope（不做）

- ❌ 不寫 SshTunnel（留 T0284）
- ❌ 不寫 SSH wizard（留 T0285）
- ❌ 不動 desktop release workflow `.github/workflows/pre-release.yml`（解耦，spec §6 C-1）
- ❌ 不加 darwin-x64 / win 平台（D-SSH-2 拍板排除）
- ❌ 不寫 cross-compile native binary（依賴 prebuilt 套件 + matrix runner）
- ❌ 不引入 docker buildx 環境（linux-arm64 runner 不支援時，記 TODO + 跳過該 job 不阻 PR；待後續工單補）

## 前置條件 / 參考文件

| 文件 | 用途 |
|------|------|
| `_ct-workorders/_spec-remote-dev-support-2026-04.md` §2.3 §6 C-1 | Server bundle pipeline 凍結 + 獨立 CI workflow 拍板 |
| `_ct-workorders/T0271-*.md`（worktree DONE） | linux-x64 baseline pipeline + verify script 既有結構 |
| `_ct-workorders/T0266-research-plan007-ssh-deployment.md` §3 | platform matrix（linux-x64/arm64 + darwin-arm64）+ tarball 命名 |
| `worktree node_modules/` | 各 native module sub-package 路徑（grep `linux-arm64` / `darwin-arm64` 子目錄存在性） |
| `.github/workflows/pre-release.yml`（main） | desktop CI 範本（job matrix + artifact upload + softprops release）— 但本工單**不修這檔** |

## AC（驗收條件）

| # | 條件 | 驗收方式 |
|---|------|---------|
| AC1 | `scripts/build-server-bundle.mjs` 接受 `--target=linux-x64\|linux-arm64\|darwin-arm64`，未指定預設 `linux-x64`（向後相容） | 跑 `--help` 或讀 source |
| AC2 | 本機 `node scripts/build-server-bundle.mjs --target=linux-arm64` 跑通（worktree node_modules 有 linux-arm64 sub-package 時）→ output `dist-server/bat-server-linux-arm64-v*.tar.gz` | 跑指令 + ls output |
| AC3 | 本機 `node scripts/build-server-bundle.mjs --target=darwin-arm64` 跑通（worktree 在非 darwin host 時可能 native module 缺失，記 TODO 跳過） | 跑指令；缺則寫進回報區 |
| AC4 | `scripts/verify-server-bundle.js` 對全 3 platform tarball 跑通（whisper hard-exclude + 結構檢查） | 跑指令 |
| AC5 | `.github/workflows/build-server-bundle.yml` 存在，job matrix 3 platform 並行，trigger 含 `workflow_dispatch` + `push` to `feature/plan-007-remote-dev` + tag `server-bundle-v*` | grep YAML + actionlint（如可用） |
| AC6 | YAML 通過 GitHub Actions schema validation（`actionlint` 本機跑或人眼比對 `pre-release.yml` 範本） | actionlint or visual diff |
| AC7 | `package.json` 新增 4 個 npm scripts（`linux-x64` / `linux-arm64` / `darwin-arm64` / `all`） | grep package.json |
| AC8 | 不破壞 T0271 既有 linux-x64 build：`npm run build:server-bundle:linux-x64`（或舊 `build:server-bundle`）仍正常產出 tarball | 跑指令 |
| AC9 | 獨立 workflow：`pre-release.yml` 未被本工單修改（`git diff main -- .github/workflows/pre-release.yml` 為空） | git diff |
| AC10 | TypeScript / mjs 語法無 syntax error（`node --check scripts/build-server-bundle.mjs`） | 跑指令 |

## 守則（嚴格）

1. **工作分支**：在 worktree `../bat-plan-007` 內 `feature/plan-007-remote-dev`。**嚴禁切回 main**。
2. **commit message**：`feat(remote): T0283 server bundle pipeline arm64 + 獨立 CI workflow\n\n工單：T0283\n依賴：T0271（linux-x64 baseline）\n落地 spec §6 C-1（解耦 server bundle 與 desktop release）`
3. **工單檔不寫**：Worker 嚴禁修改主線 `_ct-workorders/T0283-*.md`。
4. **不動 desktop release**：`.github/workflows/pre-release.yml` 嚴禁碰（解耦原則）。
5. **工具白名單**：Read / Edit / Write / Bash（npm/npx/node/git/curl/tar）/ Grep / Glob。
6. **emoji**：除 CI status badge 與 workflow name 外，程式碼/註解禁用。
7. **Build 失敗處理**：linux-arm64 / darwin-arm64 在 worktree host 缺 native sub-package 時，**不要硬寫 mock**；改記 TODO 在 build script 註解 + 回報區，AC3 標 partial 由塔台判斷。
8. **CI runner 探測**：`ubuntu-22.04-arm` runner 是 GitHub 2024 推出的 arm64 runner，**確認 GitHub Free tier 是否支援**（grep docs 或留待 dispatch 試）；若不支援則 fallback `ubuntu-22.04` + `docker/setup-qemu-action` + `docker/setup-buildx-action`，但範圍變大 → 記 TODO 留 T0285 補。
9. **completion 判定**：10 個 AC 過 ≥ 8 個（AC2/AC3/AC6 容許 PARTIAL），worktree commit 後完成訊息 `T0283 完成` 或 `T0283 部分完成：<AC# + 原因>`。
10. **YOLO 鏈式觀察**：本工單為 BUG-060 觀察點 #2 — Worker 不需做任何事，由塔台觀察使用者派發此工單時 BAT 開的是否仍為 git bash + codex。

## 預期 wall

**30-90 min**（GP099 校準後；CI workflow 寫作 + 跑通本機 build 為主要工作量；linux-arm64 在非 arm64 host 上的 native module 限制可能讓 AC3 自然 PARTIAL）。

## 工單回報區

（Worker 完成後在此補回報；塔台會在收到「T0283 完成」訊息後從本檔讀回報區）
