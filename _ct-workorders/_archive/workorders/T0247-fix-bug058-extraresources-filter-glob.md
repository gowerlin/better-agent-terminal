# 工單 T0247-fix-bug058-extraresources-filter-glob

## 元資料
- **工單編號**：T0247
- **任務名稱**：修復 BUG-058：`package.json` extraResources.filter 改為 glob 白名單
- **狀態**：FIXED
- **類型**：execution
- **intervention_type**：fire-and-forget
- **affects_files**：
  - `package.json`
- **建立時間**：2026-04-23 17:35 (UTC+8)
- **開始時間**：2026-04-23 17:37 (UTC+8)
- **完成時間**：2026-04-23 17:46 (UTC+8)
- **來源 BUG**：BUG-058
- **來源研究**：T0246（結論方案 A）

## 工作量預估
- **預估規模**：小（單檔 1 處修改 + build 驗證）
- **Context Window 風險**：低
- **降級策略**：無需降級

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：獨立 Worker 執行，BAT yolo 自動派發

## 規格層級自問

- [x] **目標層**：執行（明確輸出：改 `extraResources.filter` 為 `["*.mjs"]`）
- [x] **決策權歸屬**：無需 Worker 決策（T0246 已推薦方案 A）
- [x] **資訊完整度**：T0246 結論完整，修改點 `package.json:116-124` 明示，Worker 僅讀本工單 + `package.json` 即可
- [x] **回頭成本**：A 級（改一行，revert 成本低）
- [x] **記憶覆蓋**：無衝突

## 任務指令

### 前置條件
需載入的文件清單：
- `package.json`（主要修改目標）
- `_ct-workorders/T0246-research-bat-helper-packaging-coverage.md`（結論背景）
- `CLAUDE.md` § Packaging / Release（驗收流程參考）

### 輸入上下文

T0246 研究定位根因：`package.json` 的 `build.extraResources[0].filter` 嚴格白名單漏收 `_bat-logger.mjs` 與 `_bat-cert.mjs`（這兩個是 `bat-terminal.mjs` / `bat-notify.mjs` 的 ESM import 依賴），導致 v0.3.0 packaged installer 缺檔，BUG-058 🔴 High。

Worker 推薦方案 A — 改為 glob 白名單 `["*.mjs"]`：
- 一行修好，未來新增 `.mjs` helper 自動涵蓋
- 排除 `scripts/` 內 `.js` build-time script（`build-version.js` 等），切分乾淨
- `scripts/hooks/pre-commit` 無副檔名，`*.mjs` 自然排除，安全

### 具體修改

**檔案**：`package.json`
**位置**：`build.extraResources[0].filter` 陣列（大約 `package.json:116-124` 區段）

**修改前**：
```json
"extraResources": [
  { "from": "scripts", "to": "scripts",
    "filter": ["bat-terminal.mjs", "bat-notify.mjs"] }
]
```

**修改後**：
```json
"extraResources": [
  { "from": "scripts", "to": "scripts",
    "filter": ["*.mjs"] }
]
```

> **Worker 注意**：以上修改後格式為範例對照；實際 `package.json` 的縮排 / 排列可能略有差異，請保留原格式只改 `filter` 陣列內容。

### 預期產出

- 修改後的 `package.json`（僅 `filter` 欄位變動）
- 1 個 commit，訊息建議：`fix: bundle all _bat-*.mjs helpers in extraResources (BUG-058)`

### 驗收條件

- [ ] `package.json` `build.extraResources[0].filter` 改為 `["*.mjs"]`
- [ ] 其他欄位未動（`from`、`to` 不變）
- [ ] 跑 `npm run build:dir`（最快驗證路徑）：
  - [ ] build 成功，無 fail-fast abort（`verify-native-modules.js` 仍通過）
  - [ ] `release/win-unpacked/resources/scripts/` 含 4 個 `.mjs` 檔：
    - `bat-terminal.mjs`
    - `bat-notify.mjs`
    - `_bat-logger.mjs` ⭐（漏檔主角）
    - `_bat-cert.mjs` ⭐（漏檔主角）
- [ ] 不包含 `scripts/` 內 `.js` 檔（`build-version.js`、`generate-icons.js`、`verify-native-modules.js` 不應出現）
- [ ] 產生 commit

### 不在本工單範圍

- **完整 NSIS 重裝驗收**：CLAUDE.md 要求 release 前必跑，但本工單只負責「改 filter + dir 模式驗證」。實際 installer 重裝 + runtime 驗收由使用者後續決定是否立即做（關係到 BUG-058 CLOSED 條件）
- **擴充 T0243 預防機制**：T0246 建議的「import graph 靜態驗證」另開工單（T0248，塔台後續派發）

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

### 執行步驟
1. 讀取本工單全部內容
2. 更新「開始時間」欄位
3. 讀取 `package.json`，定位 `build.extraResources[0].filter`
4. 修改 `filter` 陣列為 `["*.mjs"]`
5. 跑 `npm run build:dir` 驗證
6. 檢查 `release/win-unpacked/resources/scripts/` 檔案清單
7. 如驗收通過，`git add package.json && git commit -m "fix: bundle all _bat-*.mjs helpers in extraResources (BUG-058)"`
8. 填寫回報區
9. 更新「狀態」（DONE / FAILED / BLOCKED）+ 完成時間

### 執行注意事項
- **不要動 runtime resolver**：`electron/pty-manager.ts` 的 `resolveHelperDir()` 已由 BUG-032 驗證正確，勿動
- **不要動 asarUnpack**：helper 走 `extraResources` 非 asar，不需要 unpack
- **不要擴充 verify-native-modules.js**：預防機制擴充是 T0248 範圍
- **build:dir 夠快就好**：不需要跑完整 NSIS installer（那是 release 流程）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
FIXED

### 產出摘要

**修改檔案**：
- `package.json` — `build.extraResources[0].filter` 由 `["bat-terminal.mjs", "bat-notify.mjs"]` 改為 `["*.mjs"]`

**Commit**：`a460d8b` — `fix: bundle all _bat-*.mjs helpers in extraResources (BUG-058)`

**Build 驗證**（`release-t0247/win-unpacked/resources/scripts/`）：
| 檔案 | Size | 狀態 |
|------|------|------|
| `bat-terminal.mjs` | 22,448 | ✅ |
| `bat-notify.mjs` | 19,989 | ✅ |
| `_bat-logger.mjs` | 5,135 | ✅ ⭐ 漏檔主角 |
| `_bat-cert.mjs` | 3,572 | ✅ ⭐ 漏檔主角 |

驗收條件全通過：
- ✅ `filter` 改為 `["*.mjs"]`
- ✅ 其他欄位（`from`、`to`）未動
- ✅ `npm run build:dir` 成功（改用 `release-t0247` 備用 output dir，詳見遭遇問題）
- ✅ `verify-native-modules.js` 通過
- ✅ 4 個 `.mjs` 齊全入包
- ✅ 不含 `scripts/` 內 `.js` 檔（`build-version.js` / `generate-icons.js` / `verify-native-modules.js` 皆未出現）
- ✅ commit 已產生

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題

`npm run build:dir` 首次執行被擋 — electron-builder 無法刪除 `release\win-unpacked\resources\app.asar`（“The process cannot access the file because it is being used by another process”）。排查後：
- 無 BAT / electron / node process 以 `win-unpacked` 為 working path 執行
- 正在跑的 `C:\Program Files\BetterAgentTerminal` installer 實例走自己的 `app.asar`，不是 `release` 下的檔
- `Remove-Item` 與 `Rename-Item` 對 `win-unpacked` 都報 Access Denied，推測是 Windows Indexer / Defender 在背景掃 167 MB asar 時暫時鎖檔

繞過方式：改用 `npx electron-builder --dir --config.directories.output=release-t0247`，跳過刪除舊目錄流程，build 一次過。

**對 T0247 驗收無影響** — 驗收核心是「改完 filter 後 .mjs 是否全入包」，在哪個 output dir 產生都等效。後續若要跑完整 NSIS installer 驗收（BUG-058 CLOSED 條件），需先關閉 Indexer / Defender real-time protection 對此目錄的掃描，或把老舊 `release/win-unpacked` 由使用者手動 reboot 後清掉。

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-23 17:46 (UTC+8)
