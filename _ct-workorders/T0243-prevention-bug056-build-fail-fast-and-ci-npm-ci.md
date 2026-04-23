# T0243 — 預防對策：BUG-056 類型重演防護（build fail-fast + CI `npm ci`）

## 元資料

- **編號**：T0243
- **類型**：implementation（預防型 + 文件）
- **狀態**：✅ DONE
- **開始時間**：2026-04-23 11:53 (UTC+8)
- **完成時間**：2026-04-23 11:58 (UTC+8)
- **Commit**：`005132f`
- **優先級**：🟡 Medium（非阻塞 release，但阻止類型重演的關鍵安全網）
- **建立時間**：2026-04-23 03:35 (UTC+8)
- **派發模式**：`--mode on`（非互動即可，Worker 自行判斷）
- **Sizing**：M（~60-90 min，涉及 script 新增 + CI workflow 調整 + CLAUDE.md 更新）
- **前置條件**：
  - T0242 ✅ DONE（BUG-056 CLOSED）
  - `.github/workflows/pre-release.yml`（CI 主 workflow，Worker 需讀取確認現有 npm 行為）
  - `scripts/build-version.js`（`npm run build:release` 入口，Worker 需確認是否適合插入 fail-fast）
- **關聯**：
  - T0241 ✅ DONE（研究結論，L102 提出 CI `npm ci` 建議）
  - T0242（修復本體，閉環 BUG-056）
  - BUG-056（已 CLOSED，T0243 是預防後續）
  - D079（拆單決策）
- **Renew 次數**：0

---

## 目標

建立「BUG-056 類型永不重演」的多層安全網：
1. **Build 階段 fail-fast**：打包前檢查關鍵 native modules 的 `node_modules/` 實體存在性，缺失即 abort
2. **CI pipeline 保護**：`.github/workflows/pre-release.yml` build job 前置 `npm ci` 或等價步驟
3. **文件更新**：CLAUDE.md 加入「squash merge 打包前必做 `npm install` / `npm ci`」的 convention

---

## 修復範圍（3 Step）

### Step 1：Build 階段 fail-fast script（必做）

**位置**：`scripts/build-version.js`（Worker 確認此為 `npm run build:release` 入口）
**或另建**：`scripts/verify-native-modules.js`（若 build-version.js 不適合插入）

**行為**：
```javascript
// 在 vite build / electron-builder 執行前
const REQUIRED_NATIVE_MODULES = [
  '@kutalia/whisper-node-addon',
  '@lydell/node-pty',
  'better-sqlite3',
];

for (const mod of REQUIRED_NATIVE_MODULES) {
  const pkgPath = path.join(__dirname, '..', 'node_modules', mod, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    console.error(`[build] ❌ Missing required native module: ${mod}`);
    console.error(`[build]   Expected at: ${pkgPath}`);
    console.error(`[build]   Fix: run \`npm install\` before rebuilding`);
    process.exit(1);
  }
}
console.log(`[build] ✅ All ${REQUIRED_NATIVE_MODULES.length} native modules present`);
```

**整合**：
- 若插入 `scripts/build-version.js`：放在現有邏輯最前段
- 若另建 `scripts/verify-native-modules.js`：`package.json` 的 `"build"` 或 `"dist"` script 加 `&&` 串接（`"build": "node scripts/verify-native-modules.js && vite build && electron-builder"`）
- **不影響 dev mode**（`npm run dev` 不跑此檢查）

**驗收**：
- [ ] 刪除 `node_modules/@kutalia/` → 跑 `npm run build` → 應 abort 並輸出明確錯誤
- [ ] `npm install` 後 → 跑 `npm run build` → 應正常通過檢查

### Step 2：CI pipeline 補 `npm ci`（必做）

**檔案**：`.github/workflows/pre-release.yml`（Windows mac Linux 三 job 都要檢查）

**目標**：確認 build job 在 `npm run build:release` / `npm run dist` 前**一定跑過** `npm ci`（或 `npm install`）。若已有則確認，若無則補上。

**建議結構**（Windows job 範例）：
```yaml
- name: Install dependencies
  run: npm ci
  
- name: Verify native modules
  run: node scripts/verify-native-modules.js  # 若採另建路徑

- name: Package for Windows
  run: npm run dist
```

**驗收**：
- [ ] `.github/workflows/pre-release.yml` 三平台 job 都有 `npm ci` step
- [ ] `npm ci` 在任何 `npm run build` / `npm run dist` / `electron-builder` 相關 step **之前**

### Step 3：CLAUDE.md 更新 + CHANGELOG（必做）

**CLAUDE.md 新增段落**（建議放「Build Toolchain」或「Release」章節下）：
```markdown
## Packaging / Release 前置檢查

- **Squash merge 後打包前必做**：在 main repo 根目錄跑 `npm install`（或 `npm ci`）確保 `node_modules/` 與 `package-lock.json` 一致。Squash merge 只更新 lock file，不同步實際 `node_modules/`，遺漏此步會導致 native module 缺失（見 BUG-056）。
- **Build fail-fast**：`npm run build:release` 會自動檢查 `@kutalia/whisper-node-addon`、`@lydell/node-pty`、`better-sqlite3` 等關鍵 native modules 存在性，缺失即 abort。
- **Release 驗收必跑 NSIS 完整重裝**：`dir/` mode 和 `zip` smoke 不是 production 等價，release 前必須完整「uninstall → 跑 installer → 啟動 UI」驗收（BUG-056 盲點記錄）。
```

**CHANGELOG.md**（下次 release note 加入）：
```
- 🛡️ Build fail-fast：缺少關鍵 native modules 時打包 abort（#BUG-056 後續防護）
```

**驗收**：
- [ ] CLAUDE.md 有「Packaging / Release 前置檢查」新段落
- [ ] CHANGELOG.md 有對應條目（如有 Unreleased section）

---

## 成功指標

- [ ] Step 1：Build fail-fast script 可偵測 `@kutalia` 缺失並 abort
- [ ] Step 2：CI pipeline `npm ci` 串接完整（三平台 job）
- [ ] Step 3：CLAUDE.md + CHANGELOG 文件同步
- [ ] 跨平台擴展評估：macOS / Linux 打包流程是否需額外調整（Worker 評估後回報，不阻塞 Windows）

---

## 回報區（Worker 填寫）

### 實作結果

**Step 1 — Build 階段 fail-fast（✅ 完成）**
- 新增 `scripts/verify-native-modules.js`：以 `fs.existsSync(node_modules/<mod>/package.json)` 檢查三個關鍵 native modules（`@kutalia/whisper-node-addon`、`@lydell/node-pty`、`better-sqlite3`），缺失即 `process.exit(1)` 並印出明確修復指引（「`npm install` / `npm ci` 後重試」、指向 BUG-056）。
- 整合點（三路徑全覆蓋）：
  1. `scripts/build-version.js` 最上方 `require('./verify-native-modules')` → 覆蓋 `npm run build:release`（含 CI 主路徑）
  2. `package.json` 的 `build` 改為 `node scripts/verify-native-modules.js && vite build && electron-builder`
  3. `package.json` 的 `build:dir` 同步加上前置 verify
- **不影響 dev mode**：`npm run dev` / `npm run compile` 不跑檢查（與工單要求一致）。

**Step 2 — CI pipeline（✅ 完成）**
- `.github/workflows/pre-release.yml` 已有 `npm ci`（line 90-91），順序正確（在 `@electron/rebuild` 和 build 之前）。
- 新增顯式 `Verify required native modules present` step（位於 `@electron/rebuild` 之後、`build-version.js` 之前），三平台 matrix job 共用同一 `run: node scripts/verify-native-modules.js`（無 `if: matrix.platform` 分化）。
- 等於雙層保險：`npm ci` 保證安裝完整 + verify script 保證 rebuild 後結構完整。

**Step 3 — 文件（✅ 完成）**
- `CLAUDE.md` 在 `## Release` 之前插入 `## Packaging / Release 前置檢查` 章節（共 4 條 bullet），涵蓋：squash merge 必做 `npm install`、build fail-fast 的覆蓋範圍與擴充規則、CI 順序宣告、release 驗收必跑 NSIS 完整重裝（BUG-056 盲點）。
- `CHANGELOG.md` 在 `[Unreleased]` 章節新增 `#### Build Safety Net (T0243 — BUG-056 prevention)`，列出兩條具體變更。

### Commit hashes

- `005132f` — chore(build): add native-module fail-fast guard + CI verify step

### 驗收結果

實機驗證（Windows 本機，2026-04-23 11:57-11:58）：

| 測試 | 指令 | 預期 | 實測 |
|------|------|------|------|
| 正向 | `node scripts/verify-native-modules.js` | exit 0, ✅ 訊息 | ✅ `All 3 required native modules present`, exit=0 |
| 負向 | `mv node_modules/@kutalia → .BAK` + verify | exit 1, 明確錯誤 + 修復提示 | ✅ `❌ Required native modules missing`, 列出 `@kutalia/whisper-node-addon` 缺失路徑, 指向 BUG-056, 提示 `npm install` / `npm ci`, exit=1 |
| 恢復後 | mv 回原位置 + verify | exit 0 | ✅ `All 3 required native modules present`, exit=0 |
| require chain | `node -e "require('./scripts/verify-native-modules')"` | 印出 verify 訊息 | ✅ `require chain OK`，確認 `build-version.js` 的 `require('./verify-native-modules')` 會正確觸發檢查 |

### 跨平台評估

**結論：三平台共用同一套檢查清單，無需分化。**

- 三個 required modules 在 macOS/Linux/Windows 都應存在：
  - `@kutalia/whisper-node-addon`：一般 `dependencies`，三平台皆裝
  - `better-sqlite3`：一般 `dependencies`，三平台皆裝
  - `@lydell/node-pty`：列在 `optionalDependencies`，但**非平台條件式**（和 `@img/sharp-darwin-*` 等 darwin-only 套件不同），三平台皆預期存在
- `scripts/verify-native-modules.js` 為純 Node `fs` + `path`，跨平台 OK
- `package.json` 的 `&&` 串接在 bash/zsh/PowerShell/cmd.exe 都支援
- CI workflow 三 matrix job 使用同一 `run: node scripts/verify-native-modules.js`，無 `if: matrix.platform` 分化需求

若未來某個 native module 變成 platform-conditional（例如 Windows-only 的 winpty 回歸），再於 `verify-native-modules.js` 以 `process.platform` 分支即可，目前不需預作。

### 意外發現

1. **`.github/` 在 repo `.gitignore` 內**：`.github/workflows/pre-release.yml` 雖然已被 git 追蹤（變更可被 detect），但 `git add .github/...` 會被 gitignore 攔下，需 `git add -f` 才能 stage 修改。原因推測：某次 `.github/` 被加入 `.gitignore` 但既有追蹤檔未 `git rm --cached`。**不在本工單範圍**，僅記錄供塔台決策是否開清理工單。
2. **CI 順序原本就正確**：T0241 研究結論 L102 建議「CI 補 `npm ci`」，實際檢視 workflow 發現 `npm ci` 已存在於 line 90-91（位於 build 之前）。T0243 的 CI 變更純為 belt-and-suspenders（新增顯式 verify step），不是補漏。
3. **`build-version.js` 的 `require('./verify-native-modules')` 副作用式呼叫**：verify script 無 `module.exports`，純以 top-level `process.exit(1)` 作為流程控制。這是合法的 Node pattern 但略不正統。若未來 `build-version.js` 被其他腳本 `require`，Node module cache 會確保 verify 只跑一次；目前沒有這個使用情境，無疑慮。

### 互動紀錄

無（`fire-and-forget` 全程自動執行，無中途提問）。

### Renew 歷程

無。

### 回報時間

2026-04-23 11:58 (UTC+8)

---

## 塔台補充（如需 Renew 時填寫）

（暫無）
