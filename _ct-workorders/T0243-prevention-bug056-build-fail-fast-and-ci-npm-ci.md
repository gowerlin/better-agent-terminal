# T0243 — 預防對策：BUG-056 類型重演防護（build fail-fast + CI `npm ci`）

## 元資料

- **編號**：T0243
- **類型**：implementation（預防型 + 文件）
- **狀態**：📋 TODO（排隊，BUG-056 CLOSED 後派發）
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
（Worker 填）

### Commit hashes
（Worker 填）

### 驗收結果
（Worker 填 — 含「刪 node_modules 測試 fail-fast」實機驗證）

### 跨平台評估
（Worker 填 — macOS / Linux 是否同步調整）

### 意外發現
（Worker 填）

### 回報時間
（Worker 填）

---

## 塔台補充（如需 Renew 時填寫）

（暫無）
