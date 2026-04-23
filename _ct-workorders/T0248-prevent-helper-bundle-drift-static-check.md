# 工單 T0248-prevent-helper-bundle-drift-static-check

## 元資料
- **工單編號**：T0248
- **任務名稱**：新增 `verify-helper-bundle.js` 靜態驗證 helper import graph 是否被 extraResources.filter 涵蓋（BUG-058 預防機制）
- **狀態**：DONE
- **類型**：execution
- **intervention_type**：fire-and-forget
- **affects_files**：
  - `scripts/verify-helper-bundle.js`（新增）
  - `package.json`（整合到 build pipeline）
  - `CLAUDE.md`（更新 § Packaging / Release 備忘）
- **建立時間**：2026-04-23 17:52 (UTC+8)
- **開始時間**：2026-04-23 18:07 (UTC+8)
- **完成時間**：2026-04-23 19:06 (UTC+8)
- **來源研究**：T0246（「建議下一步」第二條）
- **關聯 BUG**：BUG-058（T0247 修根因，本工單補預防）
- **關聯版本**：v0.3.1 hotfix（依 D084 與 T0247 併入 v0.3.1）

## 工作量預估
- **預估規模**：中（新建 1 script + pipeline 整合 + 文件更新）
- **Context Window 風險**：低
- **降級策略**：若 pipeline 整合複雜，可先完成 script 獨立可跑 + `package.json` 手動加入 prestep，CLAUDE.md 留給後續

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：YOLO 模式 BAT 派發

## 規格層級自問

- [x] **目標層**：執行（新增可運作的 verification script + pipeline 整合）
- [x] **決策權歸屬**：Worker 可決定實作細節（regex vs AST parser，prestep 整合位置）但行為契約明示
- [x] **資訊完整度**：T0246 給出作法 + T0243 類似 pattern 可參考，Worker 資訊足
- [x] **回頭成本**：A-B 級（新檔獨立，若 regex 太粗糙可改 AST，影響範圍有限）
- [x] **記憶覆蓋**：無衝突

## 任務指令

### 前置條件
需載入的文件清單：
- `scripts/verify-native-modules.js`（參考的 pattern / fail-fast 語意）
- `scripts/bat-terminal.mjs` + `scripts/bat-notify.mjs`（掃描目標，確認 import statement 格式）
- `scripts/_bat-logger.mjs` + `scripts/_bat-cert.mjs`（被 import 的目標）
- `package.json`（`build.extraResources[]` + `scripts` 區段）
- `CLAUDE.md` § Packaging / Release（文件更新目標）
- `_ct-workorders/T0246-research-bat-helper-packaging-coverage.md`（研究結論）

### 輸入上下文

BUG-058 的根因是 `package.json` `build.extraResources[0].filter` 為嚴格白名單，漏列 `_bat-logger.mjs` / `_bat-cert.mjs`，導致 packaged installer 缺檔。T0247 已用 glob 白名單 `["*.mjs"]` 修復，但 T0246 指出：

> 「即使修好 `extraResources.filter`，未來新增 `.js`（非 `.mjs`）helper 或改回明示列舉時仍可能重犯」→ 需要 build-time static check 攔截

本工單目標：新增 `scripts/verify-helper-bundle.js`，在 build 前靜態驗證「所有 helper 的 import graph 目標都被 `extraResources.filter` 涵蓋」，不符合就 abort（同 T0243 `verify-native-modules.js` 的 fail-fast 語意）。

### 具體範圍

#### 1. 新增 `scripts/verify-helper-bundle.js`

**行為契約**：
1. 讀取 `package.json`，抽出 `build.extraResources`
2. 找出 `from: "scripts"` 的 entry（或通用地：scan 每個 entry 的 `from` 所指目錄）
3. 列出該目錄下所有 `.mjs` 檔（top-level，不遞迴；或按需求遞迴）
4. 對每個 `.mjs`，掃描檔案內容找所有 `import ... from './*.mjs'` 形式的 relative import
5. 把 import target（如 `./_bat-logger.mjs`）展開為檔名（`_bat-logger.mjs`）
6. 用 `extraResources.filter`（glob pattern）比對這些 target 是否會被涵蓋
7. 若有 import target 不被 filter 涵蓋 → `process.exit(1)` 並印出清楚的錯誤訊息（哪個檔 import 了什麼、期望 filter 應包含什麼）
8. 全通過 → 印出成功訊息（如 `[verify-helper-bundle] ✓ all N helpers in scripts/ reachable via extraResources.filter`）

**實作限制**：
- **無新依賴**：不得 `require('@babel/parser')` 等。用 Node 內建 + regex 解析 import statement（參考 `verify-native-modules.js` 純 Node 風格）
- **Node 版本**：支援專案現行 Node 版本（`package.json` engines 或 CI 版本）
- **錯誤訊息可操作**：出錯時告訴使用者「加哪個 filter pattern」或「漏了哪個 import 目標」

**regex 建議（Worker 可自行優化）**：
```js
// 僅抓 static import 的 relative .mjs
const importPattern = /^\s*import\s+.*?from\s+['"](\.\/[^'"]+\.mjs)['"]/gm;
```

**glob 比對建議**：
- 只處理 top-level 檔名（不處理子目錄；current scope 夠用）
- 用簡易 glob-to-regex（`*` → `[^/]*`），或 Worker 判斷是否引輕量 npm lib（原則：不引比較好）

#### 2. 整合到 build pipeline

在 `package.json` `scripts` 區段：
- 建議方式 A：新增 `"verify:helpers": "node scripts/verify-helper-bundle.js"`，並在既有 build command 前 chain（類似 `verify-native-modules.js` 的整合方式）
- 建議方式 B：直接在 `build:dir` / `build` / `build:release` script 的最前面加入 `node scripts/verify-helper-bundle.js && ...`
- Worker 參考現有 `verify-native-modules.js` 的整合方式照做（最保守）

**驗證點**：
- 跑 `npm run build:dir`（或 `build`、`build:release`）時，`verify-helper-bundle.js` 應該在 vite / electron-builder 之前執行
- 若驗證失敗，build 應 abort（不進入 vite build）

#### 3. 更新 `CLAUDE.md` § Packaging / Release 備忘

在現有備忘下方加入：
- 新增 `scripts/verify-helper-bundle.js` 的說明（目的、觸發時機、如何擴充）
- 指引：「新增 `scripts/_bat-*.mjs` helper 或修改 `extraResources.filter` 時，先跑 `npm run verify:helpers` 確認配對」
- 保持現有 `verify-native-modules.js` 段落不動，新段落平行呈現

### 預期產出

- `scripts/verify-helper-bundle.js` 新檔
- `package.json` `scripts` 區段更新（新增 `verify:helpers` + 整合到 build command）
- `CLAUDE.md` § Packaging / Release 備忘擴充
- 1-2 個 commit（建議分開：script + pipeline 整合 一 commit、CLAUDE.md 一 commit；或合併一 commit 都可）

Commit 訊息建議：
- `feat(build): add verify-helper-bundle.js to prevent extraResources filter drift (BUG-058 prevention)`
- `docs(claude): note verify-helper-bundle.js in Packaging/Release checklist`

### 驗收條件

- [ ] `scripts/verify-helper-bundle.js` 新檔存在，pure Node 無新 npm 依賴
- [ ] 正常情況（T0247 修復後的 `filter: ["*.mjs"]`）→ script 正常 pass
- [ ] 手動測試失敗情境（驗證 Worker 確認邏輯）：
  - 暫時把 `filter` 改回 `["bat-terminal.mjs"]`（只留一個）→ 跑 script 應 abort，並清楚指出 `bat-notify.mjs` / `_bat-logger.mjs` / `_bat-cert.mjs` 未被涵蓋
  - 測試後**記得改回** `["*.mjs"]`（T0247 的正確值）
- [ ] `package.json` `scripts` 區段有 `verify:helpers` 入口
- [ ] 跑 `npm run build:dir` 時會先執行 `verify-helper-bundle.js`
- [ ] `CLAUDE.md` § Packaging / Release 有新段落說明本 script
- [ ] 產生 1-2 個 commit

### 不在本工單範圍

- **擴充 `verify-native-modules.js`**：不動（保持單一職責，本工單走獨立 script 路徑）
- **遞迴掃描子目錄**：`scripts/hooks/` 等子目錄不需要處理（top-level `.mjs` 範圍夠用）
- **支援動態 import**：`import()` 表達式不在掃描範圍（static import 夠用）
- **CHANGELOG 更新 + v0.3.1 bump**：由後續 release 工單（T0249 規劃中）做

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

### 執行步驟
1. 讀取本工單全部內容
2. 更新「開始時間」欄位
3. 讀取 `scripts/verify-native-modules.js` 學習 pattern
4. 讀取 `scripts/bat-terminal.mjs` / `bat-notify.mjs` 確認 import statement 格式
5. 設計 `verify-helper-bundle.js`（regex + glob match + clear error message）
6. 實作 script
7. 單獨跑 `node scripts/verify-helper-bundle.js` 驗正常 pass
8. 手動驗失敗情境（暫時改 filter → 跑 → 改回）
9. 整合到 `package.json` scripts 區段
10. 跑 `npm run build:dir` 驗 pipeline 整合（不需跑完整 build，看到 verify 先執行即可 Ctrl+C）
11. 更新 CLAUDE.md § Packaging / Release
12. commit
13. 填寫回報區 + 狀態 + 完成時間

### 執行注意事項
- **保持純 Node**：不引新 npm 依賴
- **錯誤訊息要人類友善**：Worker 測試失敗情境時，確認錯誤訊息能指引下一步動作
- **不要動 T0247 的 filter**：`["*.mjs"]` 是正確值，只在臨時測試時改
- **T0243 不動**：`verify-native-modules.js` 保持原樣

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要

**新檔**
- `scripts/verify-helper-bundle.js`：pure Node，讀 `package.json` `build.extraResources[]`，掃描 `scripts/*.mjs` 的 top-level 靜態 relative `.mjs` import，比對 filter glob（支援 `*` 單層萬用字元），不涵蓋就 abort。錯誤訊息分三類：`source-not-covered`（檔在但 filter 沒中）/ `import-not-covered`（import 目標被 filter 漏掉，會警告 ERR_MODULE_NOT_FOUND）/ `import-target-missing`（import 了但檔根本不存在）。最後提示兩種 fix 選項 — A 改回 `["*.mjs"]`，B 補具體檔名到白名單。

**修改檔**
- `package.json`：新增 `"verify:helpers": "node scripts/verify-helper-bundle.js"`；`build` / `build:dir` 在 `verify-native-modules.js` 後串接 `verify-helper-bundle.js`，再進 `vite build` → `electron-builder`
- `scripts/build-version.js`：在原 `require('./verify-native-modules')` 下方新增 `require('./verify-helper-bundle')`，使 `build:release` 路徑也 fail-fast
- `CLAUDE.md` § Packaging / Release：新增 helper bundle fail-fast 段落，指引「新增 `_bat-*.mjs` 或改 filter 時先跑 `npm run verify:helpers`」，並更新 CI pipeline 順序文字

**Commits**
- `a73a965` feat(build): add verify-helper-bundle.js to prevent extraResources filter drift（script + pipeline，3 files）
- `1009154` docs(claude): note verify-helper-bundle.js in Packaging/Release checklist（1 file）

**驗收結果**
- [x] 新檔為 pure Node，無新 npm 依賴（僅 `require('fs')` + `require('path')`）
- [x] 正常情境（`filter: ["*.mjs"]`）→ `[verify-helper-bundle] OK — all 4 helper .mjs files in extraResources are reachable via filter`，exit 0
- [x] 失敗情境（手動改 filter 為 `["bat-terminal.mjs"]`）→ abort exit 1，清楚列出 `bat-notify.mjs` / `_bat-logger.mjs` / `_bat-cert.mjs` 的 source-not-covered 和 import-not-covered 錯誤，並建議 `(A) 改回 ["*.mjs"]` 或 `(B) 補 "bat-notify.mjs", "_bat-logger.mjs", "_bat-cert.mjs"`。測試後已改回 `["*.mjs"]`
- [x] `package.json` `scripts` 區段有 `verify:helpers` 入口（`npm run verify:helpers` 實測通過）
- [x] `build:dir` 與 `build` 串接順序為：`verify-native-modules → verify-helper-bundle → vite build → electron-builder`
- [x] `build:release` 經由 `build-version.js` 頂端 `require('./verify-helper-bundle')` 也納入保護
- [x] `CLAUDE.md` § Packaging / Release 有新段落
- [x] 2 commits（script + docs 分開）

### 互動紀錄
無（fire-and-forget 模式）

### Renew 歷程
無

### 遭遇問題

**Commit 時意外吞入前工單殘留 staging**：第一次 `git commit` 意外把上 session 已 staged 的 `release-t0247/` 整個打包目錄（80+ 個 Windows 打包產物）和 `_ct-workorders/T0247-*.md` 一併 commit 進去（85 files changed）。這些不屬於本工單範圍。

**處理**：commit 尚未 push（`ahead 3`），用 `git reset --soft HEAD~1` 拆開 → `git reset HEAD -- <非本工單檔>` unstage 掉 `release-t0247/`、`T0247-*.md`、`T0246-*.md`、`_tower-state.md` → 乾淨重新 commit。最終兩個 commit 只含本工單四個檔案（verify-helper-bundle.js / build-version.js / package.json / CLAUDE.md）。

**回饋塔台**：`release-t0247/` build artifact 目前在 `git status` 仍為 `??`（未 staged），但這是打包產物，理論上應該進 `.gitignore`。此議題已超出本工單範圍，建議塔台另開工單處理 `release/` 是否加入 `.gitignore` 及清理 T0247 session 遺留的 staging。

### sprint-status.yaml 已更新
不適用（本專案未使用 sprint-status.yaml，見 workorder 約定）

### 回報時間
2026-04-23 19:06 (UTC+8)
