---
schema_version: 1
schema_kind: workorder
id: T0719
title: "BUG-176：Agent SDK 0.3 後 ajv / ajv-formats 不在安裝檔（mac 打包驗證失敗）—— 修正並補本機守門，讓 0.7.2-pre.5 可重發"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: S
created_at: "2026-11-01T09:12:39+0800"
updated_at: "2026-11-01T09:12:39+0800"
target_version: "0.7.2-pre.5"
depends_on: []
related:
  - "BUG-176（塔台初判寫在單內：SDK 0.3.316 沒有 `dependencies`，`@modelcontextprotocol/sdk` 等改為 peer，ajv 掉出 production 相依樹）"
  - "CI：pre-release.yml run 41259467662（0.7.2-pre.5，target a3a74762）`build (macos-latest, mac)` → `Verify packaged native binaries (macOS arm64)`：`ajv`、`ajv-formats (required by dist-electron/sdk-CzVYtfWT.js)` missing from app.asar / app.asar.unpacked；linux / win build 被取消，release skipped，未建 tag"
  - "T0718（SDK 0.3 升版；回報區「打包與 server bundle」認為 chunk 裡的 ajv require 是 codegen 字串、`asar-runtime-deps.test.mjs` 通過）"
  - "CLAUDE.md「Packaging / Release 前置檢查」：安裝檔瘦身白名單（T0546）、`asar-runtime-deps.test.mjs`、`DYNAMIC_REQUIRE_SITES`、`verify-packaged-native.js` 的 `runtime-require`；🔴 不得使用 `build.<platform>.files`"
affects_files:
  - package.json
  - package-lock.json
  - scripts/verify-packaged-native.js
  - scripts/__tests__/
  - CLAUDE.md
  - docs/agent-guide/packaging-release-checks.md
  - _ct-workorders/T0719-fix-sdk03-ajv-packaging.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 先查清楚再改（附證據）：① electron-builder 實際收進安裝檔的 node_modules 範圍是怎麼決定的（production 相依樹 + `build.files` 白名單），為什麼 v0.7.2-pre.4 有 ajv、T0718 後沒有；② `dist-electron` 的 SDK chunk 對 `ajv` / `ajv-formats` 的 require 在執行期會不會真的被呼叫（只是 codegen 字串，還是真的 require）；③ SDK 0.3 改成 peer 後，除了 ajv / ajv-formats，還有沒有其他原本靠 SDK 0.2 `dependencies` 進入 production 樹、而 main / headless 執行期會用到的套件（`@anthropic-ai/sdk`、`@modelcontextprotocol/sdk`、`zod` 與其閉包都要看）。"
  - "✅ 授權的修法（塔台推薦，D193）：把執行期需要、或打包檢查要求的套件**明確加進 `package.json` `dependencies`**（版本沿用 lock 現有的，例如 `ajv` 8.18.0、`ajv-formats` 3.0.1，寫 `^`），讓它們回到 production 相依樹；lock diff 只能是 root `dependencies` 增列與相關旗標，不得升任何套件版本。若 ② 證明完全不會 require，仍以加進 dependencies 為主（保守、與 pre.4 的安裝檔內容一致），不要改成在檢查腳本裡豁免；若你認為豁免才對，先用 BAT 通道問塔台。"
  - "🔴 補本機守門：T0718 的 `asar-runtime-deps.test.mjs` 只驗白名單 matcher，沒驗 production 相依樹，所以本機過、CI 打包才失敗。補一個本機就能跑的檢查（測試或擴充既有測試）：`dist-electron` 需要的每個外部套件都要在 production 相依樹內（以 lock 的 root `dependencies` 閉包計算，排除 dev / peer-only），並在本單修正前先確認它會失敗、修正後通過（反向測試）。新測試放 vitest 收得到的位置（`scripts/__tests__/`）。"
  - "🔴 實際打包驗證（必做）：`npx vite build` 後 `npx electron-builder --win --dir`（或專案既有的 `build:dir` 腳本），再跑 `node scripts/verify-packaged-native.js --platform win --out release --arch x64`，修正前失敗、修正後 exit 0（附輸出）。打包不簽章、不上傳；不得改動 `release/` 以外的產物位置；不碰使用者正在用的 BAT。VS Code Insiders 可能鎖 `release\\win-unpacked\\resources\\app.asar`（L136），遇到就換輸出目錄或回報。"
  - "🔴 驗證：`npm run test:unit` 全綠；`npm run test:legacy` 全綠；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`node scripts/verify-native-modules.js` exit 0；`npm run verify:helpers` exit 0；`asar-runtime-deps.test.mjs` 在 vite build 後實際執行。`TMP` 用系統預設（T0716）。"
  - "🔴 工作區有塔台未 commit 的發版文件（`CHANGELOG.md`、`README.md`、`release-note.md`、`_ct-workorders/_bug-tracker.md`、`_ct-workorders/BUG-176-*.md`），**不得修改或 commit 它們**；只用 `git commit --only <本單檔案>`。`package.json` 的 `version` 欄位不動（塔台發版時處理）。"
  - "🔴 文件：CLAUDE.md「Packaging / Release 前置檢查」安裝檔瘦身那一條補一句：新增執行期依賴時除了白名單，還要確認它在 production 相依樹內（peer-only 不會被打包），並指向新守門；`docs/agent-guide/packaging-release-checks.md` 同步細節。CLAUDE.md 不得超過 100k 字元目標。"
  - "🔴 Git：`git commit --only <檔案>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122），可唯讀查 run 41259467662 的 log。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」：回報裡的路徑用 repo 相對路徑或 `<使用者資料夾>`。yolo：不得問使用者，判讀問題問塔台。"
---

# T0719 — BUG-176：SDK 0.3 後 ajv 不在安裝檔

## 背景

- 使用者 2026-11-01 指示發 `0.7.2-pre.5`；塔台聯合驗證（unit 6203 / legacy 472 / build）全綠後觸發 `pre-release.yml`（run 41259467662）。
- `build (macos-latest, mac)` 的 `verify-packaged-native` 失敗：`ajv`、`ajv-formats`（required by `dist-electron/sdk-CzVYtfWT.js`）不在 app.asar / app.asar.unpacked；其他平台 build 被取消，release skipped，**沒有建 tag**，修好後以同一版號重發。
- 塔台初判（見 BUG-176）：SDK 0.3.316 沒有 `dependencies`，原本經 `@modelcontextprotocol/sdk` 帶進 production 樹的 ajv 只剩 peer 路徑；本機 `node_modules/ajv` 還在、白名單也有，所以 T0718 的本機測試沒抓到。

## 實作

1. 查清楚 `memory_overrides` 第 1 條三點並附證據。
2. 先寫守門（第 3 條），確認修正前失敗。
3. 修正：缺的執行期套件加進 `dependencies`（第 2 條）。
4. 本機 Windows 打包 + `verify-packaged-native`（第 4 條），修正前後各一次。
5. 文件（第 7 條）；全套驗證（第 5 條）。

## 驗收

- [ ] 原因與三點查證有證據；列出所有補進 `dependencies` 的套件與理由
- [ ] 新守門：修正前失敗、修正後通過
- [ ] 本機 `electron-builder --win --dir` 後 `verify-packaged-native.js --platform win` exit 0（附修正前失敗輸出）
- [ ] lock diff 只有 root `dependencies` 增列與旗標，沒有任何版本變動
- [ ] `npm run test:unit`、`npm run test:legacy` 全綠；`npx vite build` exit 0；兩個 typecheck = 0；`verify-native-modules` / `verify:helpers` ✅
- [ ] CLAUDE.md / docs 已補；回報區列出 mac / Linux 需由重發的 CI 確認

---

## 回報區

### 待塔台決策（僅 yolo Worker 有問題時）

### 完成狀態

### 原因查證

### 修正

### 守門

### 打包驗證

### 驗證證據

### 遭遇問題

### 互動紀錄

### Commit

### 回報時間
