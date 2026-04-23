# 工單 T0246-research-bat-helper-packaging-coverage

## 元資料
- **工單編號**：T0246
- **任務名稱**：研究：BAT v0.3.0 封裝佈署為何缺 `_bat-*.mjs` helper scripts（BUG-058 根因調查）
- **狀態**：IN_PROGRESS
- **類型**：research
- **互動模式**：enabled
- **intervention_type**：context-dependent
- **affects_files**：
  - `無寫入`（純靜態調查 + 現場驗證，結論寫回本工單回報區）
- **Renew 次數**：0
- **建立時間**：2026-04-23 17:20 (UTC+8)
- **開始時間**：2026-04-23 17:26 (UTC+8)
- **完成時間**：（完成時填入）
- **來源 BUG**：BUG-058

## 研究目標

1. **確認漏檔清單** — 比對 repo `scripts/` 目錄與安裝後 `$BAT_HELPER_DIR` 內容，列出所有遺失的 `.mjs` / `.js` helper 檔
2. **定位根因** — 是 `package.json` 的 electron-builder 設定漏收？還是 runtime 路徑解析錯誤？還是 T0243 `verify-native-modules.js` 的預防機制缺口？
3. **評估修復方向** — 提出 2-3 個可行方案並比較優缺點，推薦一個給塔台派發修復工單

## 已知資訊

### 使用者現場觀察
- v0.3.0 打包安裝後 `$BAT_HELPER_DIR` 缺 `_bat-logger.mjs`（使用者明確指出）
- 可能同時缺 `_bat-cert.mjs`（建議在此工單確認）
- 使用者當下被阻擋 → 🔴 High

### 歷史先例
| 先例 | 根因 | 修復方式 |
|------|------|----------|
| BUG-032（T0138-T0141） | helper packaging + path resolution 雙重問題 | `build.extraResources` + runtime `BAT_HELPER_DIR` resolver |
| BUG-056（T0242/T0243） | `@kutalia/whisper-node-addon` native module 漏出 `node_modules/` | Squash merge 後 `npm install` + `verify-native-modules.js` 雙閘 |

### CLAUDE.md 相關備忘（專案根目錄）
- `## Packaging / Release` 段：說明 Squash merge 後必做 `npm install`，CI 走 `npm ci`，`scripts/verify-native-modules.js` 在 build 前驗證 native modules（`@kutalia/whisper-node-addon`、`@lydell/node-pty`、`better-sqlite3`）
- `build.asarUnpack` 提及含 `@kutalia/whisper-node-addon`、`@lydell/node-pty-*`、`@img/**` 等
- 未提及 `scripts/_bat-*.mjs` 如何被打包

### 預期根因候選
1. **`package.json build.files` 未涵蓋 `scripts/` 或遺漏 `_bat-*.mjs` pattern**（最可能）
2. **`build.extraResources` 未配置** — helper 應放 resource 而非 asar 內
3. **`build.asarUnpack` 漏 pattern** — 被打進 asar 導致 runtime `import` 失敗
4. **runtime `BAT_HELPER_DIR` resolver 誤判路徑** — 檔案在但指錯
5. **T0243 預防機制只管 native modules** — 需擴充 `.mjs` helper 清單（這是獨立問題，即使修好 1-4 仍需補）

## 調查範圍

### 靜態分析
1. **`package.json` 的 `build` 區段**：
   - `files` 陣列是否涵蓋 `scripts/**/*.mjs`
   - `extraResources` 陣列是否列出 helper 檔
   - `asarUnpack` pattern 是否涵蓋 helper
   - 與 BUG-032 修復時引入的設定對照
2. **`scripts/` 目錄實際內容**：
   - 列出所有 `_bat-*.mjs`、`bat-*.mjs` 檔
   - 對應 repo 歷史 commit，確認這些檔何時加入
3. **runtime 路徑解析邏輯**：
   - 搜尋專案內 `BAT_HELPER_DIR` 使用點（grep）
   - 找出路徑解析函式（通常在 `electron/` 某處）
4. **T0243 `scripts/verify-native-modules.js` 內容**：
   - 檢視 `REQUIRED_NATIVE_MODULES` 清單
   - 評估是否可擴充為涵蓋 helper `.mjs`（或另開新 script）

### 現場驗證（使用者端）
Worker 可請使用者協助：
1. 確認 `$BAT_HELPER_DIR` 確切路徑（不同 install mode 路徑可能不同）
2. 列出該目錄實際存在的檔案（對照 repo `scripts/` 找差異）
3. 若 Worker 推論特定 root cause 需要驗證，可請使用者在本機打包後檢查 installer 內部（`7z` / `nsis` 解壓）

## 研究指引

### 建議調查順序
1. **先靜態分析**：讀 `package.json` → `scripts/` 目錄結構 → 找 `BAT_HELPER_DIR` resolver → 得出 3-4 個假設
2. **互動驗證**：提出 1-2 個最可能的假設，請使用者協助 `ls $BAT_HELPER_DIR` + 選答選項確認
3. **收斂結論**：根因定位後，評估 2-3 個修復方案並推薦
4. **不要自己改 code**：此為研究工單，修復動作留給下一張實作工單

### 可參考的文件 / 路徑
- `package.json`（專案根，關鍵：`build` 區段）
- `scripts/` 目錄（helper 原始位置）
- `CLAUDE.md` § Packaging / Release
- `_ct-workorders/_archive/` 底下的 BUG-032 / T0138-T0141 歷史工單（可 grep 路徑關鍵字）
- `_ct-workorders/BUG-056-*.md`（熱區，剛完成）
- `_ct-workorders/T0243-prevention-bug056-*.md`（熱區，剛完成）

### 評估維度
- **影響範圍**：修復動幾個檔 / 需不需要重新發 release
- **風險**：改 `build.*` 設定可能連帶影響其他打包產物
- **預防性**：修復是否順手補 T0243 的 `.mjs` helper 檢查缺口
- **向下相容**：既有 dev 模式是否會被影響

## 互動規則

- Worker 可主動向使用者提問以縮小範圍（例：「$BAT_HELPER_DIR 確切路徑？」「還有其他檔案缺嗎？」）
- 每次提問不超過 `research_max_questions: 3`（本專案設定）
- 每個問題提供選項 `[A] [B] [C]` + 「其他：________」兜底
- 互動紀錄寫入回報區

## 驗收條件（塔台視角）

- [ ] 明確列出漏檔清單（檔名 + 期望位置 + 實際狀況）
- [ ] 指出根因（或在不確定時列出前 2 個最可能假設 + 驗證計畫）
- [ ] 提出 2-3 個修復方案並比較
- [ ] 推薦一個方案 + 理由
- [ ] 評估是否需要順手擴充 T0243 的預防機制

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 互動紀錄
無（靜態分析即可定出決定性結論，未向使用者提問）

### 調查結論

**根因：`package.json` → `build.extraResources[0].filter` 是嚴格白名單，漏收 `_bat-*.mjs` 依賴檔。**

現行設定（`package.json:116-124`）：
```json
"extraResources": [
  { "from": "scripts", "to": "scripts",
    "filter": ["bat-terminal.mjs", "bat-notify.mjs"] }
]
```

但 `scripts/bat-terminal.mjs:26-27` 與 `scripts/bat-notify.mjs:37-38` 都有：
```js
import { logEvent, snapshotBatEnv } from './_bat-logger.mjs'
import { loadTrustedFingerprint } from './_bat-cert.mjs'
```

electron-builder `filter` 語意是白名單 — 不在清單中的檔不會被收。因此 `_bat-logger.mjs` 與 `_bat-cert.mjs` 在 packaged installer 內**必然都缺**（不需實機驗證；使用者回報只觀察到 `_bat-logger.mjs` 缺，是因為那是 import 鏈的第一個 failure point，ES module 載入到 `_bat-cert.mjs` 之前就已經爆了）。

**漏檔清單**：
| 檔案 | 期望位置（packaged） | 實際狀況 |
|------|---------------------|---------|
| `_bat-logger.mjs` | `$BAT_HELPER_DIR/_bat-logger.mjs` | ❌ 缺（filter 未列）|
| `_bat-cert.mjs` | `$BAT_HELPER_DIR/_bat-cert.mjs` | ❌ 缺（filter 未列）|
| `bat-terminal.mjs` | `$BAT_HELPER_DIR/bat-terminal.mjs` | ✅ 有（但 import 鏈斷）|
| `bat-notify.mjs` | `$BAT_HELPER_DIR/bat-notify.mjs` | ✅ 有（但 import 鏈斷）|

**非根因（已排除）**：
- runtime resolver 正確：`electron/pty-manager.ts:39-43` `resolveHelperDir()` packaged 走 `process.resourcesPath/scripts`，與 `extraResources.to` 對得起來（驗證 BUG-032 修復邏輯仍成立）
- `build.files` / `asarUnpack` 皆非漏收點：`scripts/` 從不放 asar，統一走 extraResources

**T0243 預防機制缺口確認**：
`scripts/verify-native-modules.js` 的 `REQUIRED_NATIVE_MODULES` 只檢查 `node_modules/` 內 3 個 native packages，**不**驗 `extraResources` 白名單是否涵蓋 `scripts/*.mjs` 的 import graph。這是獨立缺口 — 即使修好 `extraResources.filter`，未來新增 `_bat-*.mjs` helper 沒同步更新 filter 時仍會重犯。

**歷史一致性檢查**：BUG-032（T0138-T0141）建立 `extraResources` + `BAT_HELPER_DIR` 機制當時只存在 `bat-terminal.mjs` / `bat-notify.mjs` 兩個頂層 helper。PLAN-018（T0182，Remote TLS）引入 `_bat-cert.mjs`，之後某張工單新增 `_bat-logger.mjs`，這兩次都**未**同步更新 `extraResources.filter` → 相同類型的 regression 潛伏到 v0.3.0 正式版被使用者踩到。

### 建議方向

- **[A] glob pattern 白名單（推薦）** — `filter: ["*.mjs"]`
  - 優：一行修好；未來新增任何 `.mjs` helper 自動涵蓋；`scripts/` 內 build-time script（`build-version.js`、`generate-icons.js`、`verify-native-modules.js`）是 `.js` 會被排除，切分乾淨
  - 缺：需確認 `scripts/hooks/pre-commit` 不被誤收（它無副檔名，`*.mjs` 自然排除，安全）
  - 風險：🟢 低（filter 語意清晰、歷史 regression 樣本都指向「漏列」而非「誤收」）

- **[B] 明示列舉所有 helper** — `filter: ["bat-terminal.mjs", "bat-notify.mjs", "_bat-cert.mjs", "_bat-logger.mjs"]`
  - 優：最明確；不會誤收未來加進來的其他 `.mjs`
  - 缺：維護負擔高；新增 helper 時必須同步更新，本 BUG 就是這條路徑失敗的證據
  - 風險：🟡 中（治標不治本，同樣 regression 會重犯）

- **[C] 用 `build.files` 把 `scripts/` 收進 asar + 改 runtime resolver 讀 asar** — 大改
  - 優：統一打包路徑
  - 缺：動到 runtime resolver（BUG-032 已穩定運作的機制）；asar 內 dynamic import ESM 歷來有坑；risk/reward 不成比例
  - 風險：🔴 高

**推薦：方案 A + 順手擴充 T0243 預防機制（雙閘）**

推薦理由：
1. 方案 A 是「改一行、行為可預測、自動涵蓋未來」的最佳平衡點
2. 只做 A 不做預防補強，未來若再新增 `.js`（非 `.mjs`）helper 仍可能重犯 → 擴充 T0243 做 import graph 靜態驗證
3. 預防補強建議作法：新增 `scripts/verify-helper-bundle.js`（或擴充現有 `verify-native-modules.js`），在 build 前做：
   - 解析 `scripts/bat-*.mjs` 的 `import` statements
   - 抽出所有 relative import（`./_bat-*`）
   - 對照 `package.json` → `build.extraResources[].filter`（套用 glob）
   - 如果有 import 檔不符合 filter → abort build（同 T0243 fail-fast 語意）

### 建議下一步

- [x] **開實作工單修復 `package.json` `extraResources.filter`** → 建議方案 A（`filter: ["*.mjs"]`）
  - 修改點：`package.json:116-124`
  - 驗收：`npm run build:dir`（或完整 NSIS 打包）後檢查 `release/win-unpacked/resources/scripts/` 含 4 個 `.mjs`
  - 提醒：遵循 CLAUDE.md `## Packaging / Release 前置檢查`，release 前必跑 NSIS 完整重裝驗收（BUG-056 盲點記錄）
- [x] **順手擴充 T0243 預防機制** — 新增 helper import graph 靜態驗證，對照 `extraResources.filter` 涵蓋性
  - 作法：擴充 `scripts/verify-native-modules.js` 或新增 `scripts/verify-helper-bundle.js`（建議後者，單一職責）
  - 同步更新 `CLAUDE.md` § Packaging / Release 備忘
- [ ] 繼續研究（Renew）：不需要

### Renew 歷程
無

### 遭遇問題
無。靜態分析即可得出決定性結論（filter 白名單語意 + import 鏈確認），不需要請使用者 `ls $BAT_HELPER_DIR` 驗證。

### sprint-status.yaml 已更新
不適用（本工單不改 code，無 sprint 進度需同步；純研究結論寫回工單回報區）

### 回報時間
2026-04-23 17:30 (UTC+8)
