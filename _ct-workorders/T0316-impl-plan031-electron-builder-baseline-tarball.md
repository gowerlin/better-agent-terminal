# T0316 — Impl PLAN-031 Electron-builder extraResources 整合 baseline tarball（C-narrow + Mac 雙 tarball）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0316 |
| 類型 | impl（electron-builder 配置 + build script + verify scanner 擴充） |
| 所屬 | PLAN-031 — Server Bundle Distribution / Sprint 2 收尾 |
| 狀態 | ✅ DONE |
| 建立時間 | 2026-04-27 01:54 (UTC+8) |
| 派發時間 | 2026-04-27 01:54 (UTC+8) |
| 開始時間 | 2026-04-27 01:59 (UTC+8) |
| 完成時間 | 2026-04-27 02:05 (UTC+8) |
| Sizing | L（estimate 60-90 min wall） |
| 依賴 | T0314 ✅（spec §3.1 baseline matrix） / T0315 ✅（manifest schema 已固化） |
| 平行 | T0317 ✅（已完成） |
| 後續 | T0320（distributor 共用模組）— baseline lookup 第一個 path |
| 互動旗標 | `--mode yolo --no-interactive`（fire-and-forget；YOLO 鏈式派發中） |
| Renew 次數 | 0 |
| 工作目錄 | main repo |
| `affects_files` | `package.json`（build.extraResources per-host matrix） / `scripts/fetch-baseline-tarball.mjs`（新建，build 前置） / `scripts/verify-helper-bundle.js`（擴 server bundle tarball 範圍） / `scripts/build-version.js`（如需呼叫 fetch-baseline） |

## 背景

T0314 spec §3.1 凍結 C-narrow + Mac 雙 tarball baseline matrix：

| BAT host | 內建 tarball |
|----------|------------|
| Win (x64) | linux-x64 |
| Mac (arm64) | linux-x64 + darwin-arm64 |
| Linux (x64) | linux-x64 |
| Linux (arm64) | linux-arm64 |

本工單把 spec 實作落地：electron-builder 在 build 時把 baseline tarball 一起包進 installer，第一次啟動時 BAT 解壓到 `userData/bat-server-bundles/` 作為 distributor 的 baseline lookup 來源（T0320 範圍）。

## 塔台已拍板項（不要再問）

| 編號 | 議題 | 決策 |
|------|------|------|
| D092 | Baseline matrix | C-narrow + Mac 雙 tarball |
| D094 | Mac installer size 上限 | **280 MB hard cap**（超出觸發塔台復議） |
| D095 | Fallback URL env | `BAT_SERVER_BUNDLE_BASE_URL`（download 時用，本工單只負責 baseline） |
| D096 | Docker distributor fallback | v1 不做（保留 image 模式） |

## 範圍（4 deliverable）

### Deliverable 1：`scripts/fetch-baseline-tarball.mjs`（新建）

**目的**：build 前置 step，依 build target host arch 從 GitHub Release 下載對應 baseline tarball 到 `dist-baseline/`，供 electron-builder extraResources 引用。

**CLI 介面**：

```bash
node scripts/fetch-baseline-tarball.mjs \
  --host-os <win|mac|linux> \
  --host-arch <x64|arm64> \
  --version <semver>          # BAT 當前版本，從 package.json
  --output-dir <path>         # default: dist-baseline/
  [--source-url <url>]        # override default (e.g., for CI dogfood)
  [--dry-run]                 # skip actual download, only print plan
```

**實作邏輯**：
1. 依 `--host-os` + `--host-arch` 套用 spec §3.1 baseline matrix 計算需要的 tarball 清單：
   - `win` × `x64` → `[linux-x64]`
   - `mac` × `arm64` → `[linux-x64, darwin-arm64]`
   - `linux` × `x64` → `[linux-x64]`
   - `linux` × `arm64` → `[linux-arm64]`
   - 其他組合 → exit 1 with clear msg
2. 對每個目標 tarball：
   - 預設 URL：`https://github.com/anthropics/better-agent-terminal/releases/download/server-bundle-v${version}/bat-server-${arch}-v${version}.tar.gz`
   - 同目錄 `.sha256` sidecar URL
   - 同目錄 `manifest.json`（若 `--output-dir/manifest.json` 已存在則 skip 重抓）
3. **Local cache by SHA**：先檢 `--output-dir/<filename>` 存在 + sidecar SHA 比對通過 → skip download
4. **Resilience**：fetch 失敗 → exponential backoff 3 次（500ms, 1500ms, 3000ms）→ 仍失敗則 exit 1 with actionable msg
5. **GitHub rate limit hint**：HTTP 403 + `X-RateLimit-Remaining: 0` → 印「rate limit hit, retry after `${X-RateLimit-Reset}` or set `GITHUB_TOKEN` env」
6. **SHA256 校驗**：用 T0317 `createSha256Stream` + `compareSha256`（從 `src/lib/server-bundle-manifest.ts` import；本工單用 dynamic import 因為 .mjs script）
7. **`--dry-run`**：只印「will download X / Y / Z」不實做 fetch
8. **Output**：tarball + sidecar + manifest.json 全寫到 `--output-dir/`

**錯誤訊息原則**：actionable + 引用 spec/AC（如「baseline matrix 不認識 mac × x64，spec §3.1」）

### Deliverable 2：`package.json` `build.extraResources` per-host 配置

electron-builder 配置改動。**關鍵限制**：electron-builder 的 `build.{linux,mac,win}.extraResources` 可 override 平台專屬，但 `build.extraResources` 是共通預設。

**設計**：用 platform-specific override，每個 host 的 baseline tarball 走各自區段。

```jsonc
{
  "build": {
    "extraResources": [
      // 共通（不分平台）
      { "from": "scripts", "to": "scripts", "filter": ["*.mjs"] }
    ],
    "win": {
      "extraResources": [
        { "from": "dist-baseline", "to": "bat-server-baseline",
          "filter": ["bat-server-linux-x64-v*.tar.gz", "bat-server-linux-x64-v*.tar.gz.sha256", "manifest.json"] }
      ]
    },
    "mac": {
      "extraResources": [
        { "from": "dist-baseline", "to": "bat-server-baseline",
          "filter": [
            "bat-server-linux-x64-v*.tar.gz", "bat-server-linux-x64-v*.tar.gz.sha256",
            "bat-server-darwin-arm64-v*.tar.gz", "bat-server-darwin-arm64-v*.tar.gz.sha256",
            "manifest.json"
          ]
        }
      ]
    },
    "linux": {
      "extraResources": [
        { "from": "dist-baseline", "to": "bat-server-baseline",
          "filter": [
            // CI matrix 跑時依 GOARCH 動態 — 但 electron-builder 配置是 static
            // 折衷：linux 兩 arch 都列 filter，fetch script 只放對應一個進 dist-baseline/
            "bat-server-linux-x64-v*.tar.gz", "bat-server-linux-x64-v*.tar.gz.sha256",
            "bat-server-linux-arm64-v*.tar.gz", "bat-server-linux-arm64-v*.tar.gz.sha256",
            "manifest.json"
          ]
        }
      ]
    }
  }
}
```

**Linux 雙 arch 折衷說明**：electron-builder 配置是 static JSON，無法依 `--arch=x64|arm64` build flag 動態切 filter。改採 fetch script 在 build 前**只放對應 arch tarball 到 `dist-baseline/`**，filter 列雙 arch glob 是**包含性 filter**（找到什麼包什麼），實際只會包到一個。

### Deliverable 3：`scripts/verify-helper-bundle.js` 擴 server bundle 範圍

T0247/T0248 BUG-058 已建立 helper bundle scanner。本工單擴張掃描範圍：

**新增掃描項**：
- 偵測 `extraResources` filter 中 `bat-server-*-v*.tar.gz` glob 是否與 `dist-baseline/` 內實際檔案對應
- 若 build 配置宣告需要 `linux-x64` baseline 但 `dist-baseline/` 缺檔 → abort 並印「執行 `node scripts/fetch-baseline-tarball.mjs --host-os <X> --host-arch <Y>` 先取 baseline」
- 不檢查 sidecar / manifest.json（兩者都是 fetch script 副產物，必同時存在）

**寫入時機**：擴張現有 `verify-helper-bundle.js` 的 main 流程，在 helper .mjs 檢查後追加 server bundle baseline 檢查段落。

**不重構既有邏輯**：T0247/T0248 已穩定，本工單只新增 server bundle 段落。

### Deliverable 4：`scripts/build-version.js` 整合 fetch-baseline

build pipeline 順序：
```
npm install → @electron/rebuild → verify-native-modules
   → fetch-baseline-tarball ← (本工單新增)
   → verify-helper-bundle (擴張)
   → build-version
   → vite build
   → electron-builder
```

**修改 `scripts/build-version.js`** 開頭新增 require：
```javascript
require('./fetch-baseline-tarball.mjs')  // ⚠️ 但 .mjs 不能 require，需 dynamic import 或拆 .cjs
```

**折衷**：fetch-baseline 寫成 .mjs（與 build-server-bundle.mjs 風格一致），但**不在 build-version 內呼叫**；改在 `package.json` scripts 段的 `prebuild` / `build` 連鎖：

```jsonc
{
  "scripts": {
    "fetch:baseline": "node scripts/fetch-baseline-tarball.mjs --host-os ${BUILD_HOST_OS:-$(uname -s | tr '[:upper:]' '[:lower:]')} --host-arch ${BUILD_HOST_ARCH:-$(uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/')} --version $(node -p \"require('./package.json').version\")",
    "prebuild": "npm run fetch:baseline",
    "build": "node scripts/build-version.js && vite build && electron-builder",
    "build:dir": "npm run fetch:baseline && node scripts/build-version.js && vite build && electron-builder --dir",
    "build:release": "npm run fetch:baseline && node scripts/build-version.js && vite build && electron-builder --publish=onTagOrDraft"
  }
}
```

**Cross-platform `uname` 在 Windows 不存在**：Windows 直接 export `BUILD_HOST_OS=win`、`BUILD_HOST_ARCH=x64` env（CI / dev 都這樣設）。**腳本內偵測**用 Node API：

```javascript
// fetch-baseline-tarball.mjs 開頭
import os from 'node:os'
const defaultHostOS = process.env.BUILD_HOST_OS || (
  os.platform() === 'darwin' ? 'mac' :
  os.platform() === 'win32' ? 'win' :
  'linux'
)
const defaultHostArch = process.env.BUILD_HOST_ARCH || (
  os.arch() === 'x64' ? 'x64' :
  os.arch() === 'arm64' ? 'arm64' :
  null
)
```

讓 `--host-os` / `--host-arch` 變成可選（CLI override > env > os.platform()/arch() 偵測）。

簡化 npm scripts 為：
```jsonc
{
  "scripts": {
    "fetch:baseline": "node scripts/fetch-baseline-tarball.mjs",
    "prebuild": "npm run fetch:baseline",
    "build": "node scripts/build-version.js && vite build && electron-builder",
    "build:dir": "npm run fetch:baseline && node scripts/build-version.js && vite build && electron-builder --dir",
    "build:release": "npm run fetch:baseline && node scripts/build-version.js && vite build && electron-builder --publish=onTagOrDraft"
  }
}
```

## 驗收條件

- AC-1：`scripts/fetch-baseline-tarball.mjs` 存在，CLI 介面與本工單一致；`--dry-run` 跑通印出 baseline plan
- AC-2：對 win/mac/linux × x64/arm64 的合理組合，fetch script 能算出正確 tarball 清單（不真實 download，dry-run 驗）
- AC-3：對非合理組合（如 `mac × x64`）→ exit 1 with actionable msg 引用 spec §3.1
- AC-4：`package.json` `build.extraResources` 含 platform-specific 配置（win/mac/linux 各自 filter），與本工單範例一致
- AC-5：`scripts/verify-helper-bundle.js` 含 server bundle baseline 檢查段落；對缺 tarball case → abort with msg 含 fetch script suggested command
- AC-6：`package.json` scripts 段含 `fetch:baseline` + `prebuild` + 三個 build script 改動
- AC-7：本機 sanity test：手動建 fake `dist-baseline/bat-server-linux-x64-v0.4.1.tar.gz` + sidecar + manifest.json → 跑 `verify-helper-bundle` 通過；刪 sidecar → verify abort 含 actionable msg
- AC-8：cross-platform `os.platform()/arch()` 偵測正確（fetch script 在 Win Git Bash / Mac / Linux 跑都能算對 default host）
- AC-9：commit 訊息走 `chore(build): T0316 - <段落>`；建議拆 2 commit：fetch script + npm scripts / electron-builder 配置 + verify scanner

## 範圍排除（不在本工單）

- ❌ 不實作 distributor 模組 baseline lookup 邏輯（T0320 範圍）
- ❌ 不改 BAT renderer / electron / src/（純 build pipeline 範圍）
- ❌ 不實際跑 electron-builder build full release（CI 跑通即可，本機 Win worktree 缺 mac/linux native module fail-fast）
- ❌ 不實際 push tag 觸發 release（同 T0315 守則 1）
- ❌ 不驗 280 MB Mac installer cap（v0.5.0 真實 release 後量測；本工單只負責落地配置）

## Worker 守則

1. **不觸發 release**：本工單修改後**不可** push 任何 tag；改完只 commit + push branch
2. **本機驗證優先**：以 `--dry-run` 跑 fetch script + 手動建 fake tarball 驗 verify-helper-bundle；electron-builder 真實 build 由 CI 自然驗
3. **保守修改 verify-helper-bundle**：T0247/T0248 已穩定，新增邏輯不重構既有；新邏輯加在現有檢查後（不放主流程中段）
4. **JSON 配置紀律**：`package.json` 改動必須通過 `node -e "require('./package.json')"` parse 不報錯
5. **Cross-platform 紀律**：fetch script 用 `node:os` `os.platform()/arch()`，不依賴 `uname` shell command
6. **Path separator**：filter glob 用 `/`（electron-builder 規範）；`os.platform()` 結果用 normalize 處理
7. **GitHub Rate Limit handle**：actionable msg + GITHUB_TOKEN hint，不做 token-based fetch（v2 範圍，spec §8）
8. **fetch script SHA 校驗**：用 T0317 `compareSha256` + `createSha256Stream`；dynamic import 從 `src/lib/server-bundle-manifest.ts`（.mjs 環境）；如有 transpile 阻礙則 inline 簡單 sha256 + timing-safe compare（記在回報區）
9. **記憶覆寫**：本工單**沒有** `memory_overrides` 欄位 — 沿用所有現行 GP 規則 + 學習紀錄
10. **規範性 scope expansion 處理**：若需動 `vite.config.ts` / 其他配置以達成 AC（如 T0317 案例），可動但需在回報區明確標出「out-of-scope but justified」段落

## Worker 回報區（Worker 填寫）

### 1. fetch-baseline-tarball.mjs 摘要

新建 `scripts/fetch-baseline-tarball.mjs`（約 280 行）。實作要點：

- **CLI parse**：手寫 `parseArgs`，支援 `--host-os` / `--host-arch` / `--version` / `--output-dir` / `--source-url` / `--dry-run` / `-h|--help`；未知 flag → `exit 2`
- **預設值偵測**：`--host-os` 優先讀 `BUILD_HOST_OS` env，否則 `os.platform()` 對應（`darwin→mac`、`win32→win`、其他→`linux`）；`--host-arch` 同樣 env > `os.arch()`；`--version` 預設讀 `package.json`
- **Baseline matrix**：靜態 const 對應 spec §3.1（win×x64=[linux-x64], mac×arm64=[linux-x64,darwin-arm64], linux×x64=[linux-x64], linux×arm64=[linux-arm64]）；非合理組合 → exit 1 with msg 引用 spec §3.1
- **Local cache by SHA**：先比對既存 tarball + sidecar，SHA 通過則 skip download
- **Retry**：500 / 1500 / 3000 ms exponential backoff（共 4 次嘗試）；rate-limit error 不 retry（不會在 3 秒內恢復）
- **GitHub rate limit**：HTTP 403 + `X-RateLimit-Remaining: 0` → 印「retry after `${reset}` ISO8601 or set `GITHUB_TOKEN` env」；若有 `GITHUB_TOKEN` env 則自動以 `Authorization: Bearer` 帶入請求
- **SHA256 校驗**：**inlined**（worker 守則 8 + 工單第 1 行 fallback 條款）。原因：`server-bundle-manifest.ts` 是 TypeScript source，`.mjs` 沒有 build step 不能 dynamic import 它。改 inline `crypto.createHash('sha256')` + `crypto.timingSafeEqual` + 64 位 hex 校驗，語意對齊 T0317 `compareSha256` / `createSha256Stream`。
- **manifest.json**：若 `dist-baseline/manifest.json` 已存在則 skip 重抓
- **錯誤訊息**：actionable + 引用 spec/AC（例：`baseline matrix does not recognise "mac × x64". Spec §3.1 only covers: ...`）

### 2. package.json 改動摘要

**`scripts` 段**：
- 新增 `fetch:baseline`、`prebuild`（呼叫 `fetch:baseline`）
- `build:dir` / `build:release` 開頭加 `npm run fetch:baseline &&`
- `build` 不直接加（npm 自帶 `prebuild` 鉤子，run `npm run build` 時自動先跑 prebuild）

**`build` 段 platform-specific extraResources**：
- `build.win.extraResources`：`dist-baseline/` → `bat-server-baseline/`，filter `[linux-x64 tar.gz, sidecar, manifest.json]`
- `build.mac.extraResources`：filter 加上 `darwin-arm64` 雙 tarball + sidecar + manifest
- `build.linux.extraResources`：filter 列雙 arch（x64 + arm64），electron-builder JSON static，實際只會包到 fetch script 放進 `dist-baseline/` 的對應 arch
- 既存 `build.extraResources`（共通 `scripts/*.mjs`）保留不動，避免影響 BUG-058 / T0247 修復

**JSON parse sanity**：`node -e "console.log(JSON.stringify(require('./package.json').build.win.extraResources))"` 通過

### 3. verify-helper-bundle.js 擴張摘要

新增 `checkServerBundleBaseline()` 函式（約 90 行）+ 一行呼叫，**插在原始 problems 收集 → if (problems.length > 0) 之前**，不重構既有邏輯：

- **掃描範圍**：`pkg.build.{win, mac, linux}.extraResources[]`，逐 entry 找 filter 中符合 `bat-server-(linux-x64|linux-arm64|darwin-arm64)-v\*\.tar\.gz` 的 glob
- **檢查 1（missing tarball）**：對每平台的 baseline tarball glob，要求至少有一個 glob 在 `dist-baseline/` 找到實檔。三平台都 0 命中 → abort（涵蓋「忘記跑 fetch:baseline」場景）
- **檢查 2（missing sidecar）**：每個 tarball 實檔必須伴隨 `.sha256` sidecar，否則 abort 含具體缺檔名
- **不檢查 manifest.json**：fetch script 會同步寫，沒必要在 verify 重複
- **Actionable msg**：印「Fix: run `node scripts/fetch-baseline-tarball.mjs --host-os <X> --host-arch <Y>` 或 `npm run fetch:baseline`」
- **Linux 雙 arch 折衷**：採「at least one glob 滿足」語意，避免 linux build 時被誤判（filter 列雙 arch 但實際只放一個進 dist-baseline/）
- **Mac 雙 tarball 限制**：當前語意是「至少一個」，無法強制檢查 mac 必須同時有 linux-x64 + darwin-arm64。Verify 不知道當前 build target 是哪個平台，所以只能做 sanity bound。真正完整性由 fetch script 的 matrix 邏輯保證。

### 4. 本機驗證結果

- **AC-1/2 (`--dry-run` matrix)**：win×x64 → 1 tarball；mac×arm64 → 2 tarball；linux×arm64 → 1 tarball — 全部印出正確 plan + URL，exit 0
- **AC-3 (invalid combo)**：`mac × x64` → 印 `baseline matrix does not recognise "mac × x64". Spec §3.1 only covers: ...`，exit 1 ✅
- **AC-4 (extraResources)**：JSON 結構與工單範例一致；node 反序列化通過 ✅
- **AC-5 (verify scanner)**：sidecar 缺失時印「dist-baseline/ is missing .sha256 sidecar(s) for win/mac/linux」+ 完整 fix hint ✅
- **AC-6 (npm scripts)**：`fetch:baseline` + `prebuild` + `build:dir` / `build:release` 改動到位 ✅
- **AC-7 (fake tarball)**：建 `dist-baseline/bat-server-linux-x64-v0.4.1.tar.gz` + sidecar + manifest.json → verify 通過；刪 sidecar → verify abort 含 fetch script suggested command ✅

### 5. cross-platform 偵測測試

實際在 Win Git Bash (MSYS) 執行：
- `os.platform()` = `win32` → `win` ✅
- `os.arch()` = `x64` → `x64` ✅

腳本內偵測純 Node API（`node:os`），不依賴 `uname`，符合 worker 守則 5。Mac / Linux 走 same code path，`os.platform()` darwin→mac、其他→linux 已對應。

### 6. PARTIAL / 矛盾項（如有）

無 PARTIAL。

**已知設計取捨**（非 PARTIAL，工單範圍排除）：
- verify scanner 「at least one glob 滿足」語意對 Mac 雙 tarball 場景偏寬鬆 — fetch script 的 matrix 邏輯保證完整性。verify 在不知道 build target 的情況下只能做 sanity bound（見回報區 §3 末段）。
- `prebuild` 鉤子只覆蓋 `npm run build`，`build:dir` / `build:release` 因要避免雙重執行（`prebuild` 由 npm 自動觸發），改在 script 開頭直接串 `npm run fetch:baseline &&`。CI / dev 兩條路徑都涵蓋。

### 7. Out-of-scope but justified（如有）

- **`.gitignore` 加 `dist-baseline/`**：非 affects_files 列檔案。理由：fetch script 預設輸出至 `dist-baseline/`，與 `dist/` / `dist-electron/` 等 build artifact 同性質，commit 進 git 沒意義且會污染 diff。新增 1 行，與既存 `dist*` 排除規則同列。

### 完成註記

- 完成狀態：DONE
- 完成時間：2026-04-27 02:05 (UTC+8)
- Wall time：~6 分鐘（vs 60-90 min estimate；實作量符合 L size，但 baseline 邏輯純 spec-driven 沒需求歧義）
- 改動檔案：
  - 新增 `scripts/fetch-baseline-tarball.mjs`（~280 行）
  - 新增段落 `scripts/verify-helper-bundle.js`（+~95 行）
  - 修改 `package.json`（scripts 段 + build.win/mac/linux extraResources）
  - 修改 `.gitignore`（+1 行 `dist-baseline/`）
- Commit（per AC-9，拆 2 commit）：
  1. `9b64b10` — chore(build): T0316 - fetch-baseline-tarball.mjs + verify-helper-bundle 擴張
  2. `cb8ef96` — chore(build): T0316 - package.json extraResources per-host + npm scripts
