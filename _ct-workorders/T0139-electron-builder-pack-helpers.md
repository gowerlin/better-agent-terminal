# T0139 — electron-builder 打包 helper scripts（B 層）

## 元資料
- **工單編號**：T0139
- **類型**：implementation（實作工單）
- **狀態**：🔄 IN_PROGRESS
- **開始時間**：2026-04-17 12:41 (UTC+8)
- **優先級**：🔴 High（BUG-032 修復鏈第 1 棒）
- **派發時間**：2026-04-17 12:50 (UTC+8)
- **關聯 BUG**：BUG-032（OPEN）
- **前置工單**：T0138（研究 ✅ DONE，commit 340dc9d）
- **後續工單**：T0140（注入 `BAT_HELPER_DIR` env var）
- **預估難度**：⭐（最簡單，單檔約 5 行）
- **預估 context 用量**：低

---

## 目的

讓 electron-builder 把 `scripts/bat-terminal.mjs` + `scripts/bat-notify.mjs` 打包進安裝程式，安裝後位於 `<install-root>/resources/scripts/`。

這是 BUG-032 修復鏈第 1 棒。完成後 helper scripts 才存在於使用者環境，T0140 才有東西可以指向。

---

## 必要修改

### `package.json`

在 `build` 區塊新增 `extraResources`（依 T0138 提案）：

```json
"extraResources": [
  {
    "from": "scripts",
    "to": "scripts",
    "filter": ["bat-terminal.mjs", "bat-notify.mjs"]
  }
]
```

**位置**：與既有的 `build.files`、`build.asarUnpack` 同層。

**注意事項**：
- `filter` 限定只打包這兩支 helper（避免 scripts/ 目錄裡其他開發用腳本被打包）
- `from`/`to` 路徑相對於 project root → 安裝後實際路徑：`<install-root>/resources/scripts/<filename>.mjs`
- 不需要 `asarUnpack`（純 ESM，不在 `node_modules` 內，不會被 asar 包進去）

---

## 驗收條件（必跑）

### 自動驗證
1. `npm run build:dir` 執行成功（產出 unpacked dir，比 full installer 快）
2. 檢查產出：
   ```bash
   ls release/win-unpacked/resources/scripts/bat-terminal.mjs
   ls release/win-unpacked/resources/scripts/bat-notify.mjs
   ```
   兩檔皆存在 → PASS
3. 檔案內容比對：
   ```bash
   diff scripts/bat-terminal.mjs release/win-unpacked/resources/scripts/bat-terminal.mjs
   ```
   無差異 → PASS（確認沒有意外的轉碼/換行轉換）

### 反向驗證（可選）
- 確認 `scripts/` 內其他檔案（如有）**沒有**被打包到 `release/win-unpacked/resources/scripts/`
  → 證明 `filter` 生效

---

## 不在本工單範圍

- ❌ 修改 `pty-manager.ts` 注入 env var → 是 **T0140** 的工作
- ❌ 修改 `_local-rules.md` → 是 **T0141** 的工作
- ❌ 跑完整安裝包驗證（`npm run build` 全平台）→ 留給 T0142 整合驗收
- ❌ 動 helper scripts 內容本身

如果發現需要動上述任何項目，先在工單回報區提出，由塔台決定是否擴大範圍或追加工單。

---

## 工單回報區

### 進度
- 開始時間：2026-04-17 12:41 (UTC+8)
- 完成時間：2026-04-17 12:43 (UTC+8)
- commit：（填入於 commit 後）

### 修改內容
`package.json` 的 `build` 區塊新增 `extraResources`（位於 `asarUnpack` 之後，同層）：

```json
"extraResources": [
  {
    "from": "scripts",
    "to": "scripts",
    "filter": [
      "bat-terminal.mjs",
      "bat-notify.mjs"
    ]
  }
]
```

僅新增 9 行（含格式化），未動其他欄位。

### 驗收結果
- [x] `npm run build:dir` 成功（vite + electron-builder packaging 完成，產出 `release/win-unpacked/`）
- [x] `release/win-unpacked/resources/scripts/bat-terminal.mjs` 存在（9596 bytes）
- [x] `release/win-unpacked/resources/scripts/bat-notify.mjs` 存在（9051 bytes）
- [x] 檔案內容與原始 `scripts/` 一致（`diff` 無輸出，兩檔皆 IDENTICAL）
- [x] 反向驗證：filter 生效 — `build-version.js`、`generate-icons.js`、`hooks/` 未被打包到 `release/win-unpacked/resources/scripts/`

### 互動紀錄
無

### 異常 / 待塔台決策
無。按 T0138 研究結論直接落地，無意外。

提醒塔台：後續 T0140 需注入 `BAT_HELPER_DIR` env var，可解析為：
- 開發環境：`<project-root>/scripts`
- 打包環境：`process.resourcesPath + '/scripts'`（即 `<install-root>/resources/scripts/`）

### Renew 歷程
無

---
