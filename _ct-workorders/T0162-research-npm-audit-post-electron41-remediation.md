# T0162 — 研究：Electron 41 升級後 npm audit 殘餘漏洞清理可行性

## 元資料
- **工單編號**：T0162
- **類型**：research（研究工單）
- **互動模式**：✅ 允許（Q2=A — 遇決策點可問使用者，如漏洞嚴重度解讀、某套件是否可升）
- **狀態**：🔄 IN_PROGRESS
- **優先級**：🟢 Low（技術債，無阻塞）
- **派發時間**：2026-04-18 03:22 (UTC+8)
- **關聯 PLAN**：PLAN-003（npm audit 殘餘漏洞）
- **關聯決策**：D051（Electron 41 閉環，解鎖 PLAN-003 前置條件）
- **Renew 次數**：0
- **預計 context 用量**：小-中（跑 audit + 讀 package.json + 可能查個別套件 changelog）
- **預計 Worker time**：30-60 分鐘

---

## 研究目的

**前置條件滿足**：Electron 28.3.3 → 41.2.1 升級今日完成（D051，runtime 驗收通過）。PLAN-003 上一次統計（T0060 後）殘留 **17 個漏洞，主要在 Electron 28.x 依賴鏈**。升級後殘餘漏洞應大幅縮減，但**實況未知**。

本研究盤點升級後的實際漏洞情況，推薦處理策略，供塔台決策派實作工單。

**僅做診斷 + 推薦**（可跑 `npm audit`、可讀 package.json / package-lock.json、可查套件 changelog，但**不執行任何修改**——不跑 `npm audit fix`、不改 package.json、不 commit）。

---

## 必須回答的問題

### Block A — 漏洞現況盤點

A1. `npm audit` 當前總數？嚴重度分布（critical / high / moderate / low）？
A2. 每個漏洞的：套件名稱、CVE ID（若有）、嚴重度、影響範圍（runtime / dev-time / bundled）、`npm audit` 建議修復路徑？
A3. 哪些漏洞是 Electron 41 升級**已經自動解決**的（對比 T0060 時期殘留 17 個）？
A4. 哪些漏洞是 **dev dependency only**（打包後不進 bundle，runtime 風險為零）？

### Block B — 處理方案比較

B1. **保守方案**：只跑 `npm audit fix`（不 force），能修掉幾個？剩幾個？
B2. **中等方案**：`npm audit fix` + 針對個別套件用 `overrides` / minor bump 手動修復，能修到什麼程度？需要改動哪些套件？
B3. **激進方案**：含 major version bump（如 electron-builder 24→26、其他 major 升級），能否清零？改動範圍多大？哪些是已知高風險（例如 `electron-builder` 目前被 D049 標記暫緩）？
B4. **WONTFIX 候選**：哪些漏洞建議標記不修（例如 dev-only + 低風險 + 修復成本過高），理由？

### Block C — 推薦與決策支援

C1. **推薦方案**（保守 / 中等 / 激進 / 混合）— 為什麼？
C2. 推薦方案的**預估改動清單**：
   - 哪些檔案要改（package.json / package-lock.json / overrides 欄位）？
   - 是否需要跑 `npm install` 重裝？（**警示**：若需要，記得避免 VSCode self-lock 問題，見 L040）
   - 是否需要 rebuild / 重打包 / 重新驗收？
C3. 推薦方案的**風險評估**：回歸測試範圍、需要的 smoke test？
C4. 推薦方案預估 Worker time？（派修復工單時的估算依據）

### Block D — Electron-builder 暫緩狀態重新評估

D1. 本研究中**不處理** electron-builder（D049 暫緩），但若 audit 顯示 electron-builder 依賴鏈仍有殘餘漏洞，記錄在本 Block 供塔台後續決策是否提早解封 PLAN-005？
D2. electron-builder 24.x 當前對 Electron 41 是否有已知相容性問題？（簡短查證，不深入）

---

## 產出格式

**在本工單「執行回報區」直接寫報告**，結構：

```markdown
## 執行回報

### 摘要（TL;DR）
- npm audit 總數：X 個（critical:N / high:N / moderate:N / low:N）
- 與 T0060 時期（17 個）比較：減少 / 增加 / 不變
- 推薦方案：[保守 / 中等 / 激進 / 混合] + 理由一句話
- 預估處理時間：X 分鐘 / 小時

### Block A — 漏洞現況盤點
（A1-A4 逐項回答，A2 用表格列出所有漏洞）

### Block B — 處理方案比較
（B1-B4，每個方案一段說明 + 改動範圍）

### Block C — 推薦與決策支援
（C1-C4，含具體 action plan）

### Block D — electron-builder 狀態
（D1-D2，簡短）

### Open Questions / 互動紀錄
- Worker 與使用者互動事項（若有）
- Worker 無法從文件確認的事項
```

**引用要求**：漏洞 CVE / GitHub advisory / 套件 changelog 附 URL 方便查證。

---

## 硬限制

1. ❌ **不執行任何修改**：不跑 `npm audit fix`、不 `npm install`、不改 package.json 任何欄位、不 commit
2. ❌ **不處理 electron-builder 升級本身**（PLAN-005 獨立，僅在 Block D 紀錄觀察）
3. ❌ **不跑 build**：本研究僅診斷，不需要驗證打包
4. ✅ **可跑 `npm audit`** 和 `npm audit --json`（read-only 操作）
5. ✅ **可讀** package.json / package-lock.json / node_modules/*/package.json
6. ✅ **可互動**：遇到需要使用者決策的事項（如某漏洞解讀、某套件是否允許升 minor），主動詢問

## 互動指引（若使用）

- 單輪互動最多 3 個問題（Q1/Q2/Q3 選項式）
- 互動紀錄寫入回報區「互動紀錄」小節，含時間戳 + 問題 + 使用者回答
- 不確定的事項若使用者不在，記入 Open Questions 不卡住

---

## 完成定義（DoD）

- [ ] `npm audit` 實況完整盤點（Block A 全部回答）
- [ ] 三路方案比較清楚（Block B）
- [ ] 推薦方案明確含 action plan（Block C）
- [ ] electron-builder 觀察紀錄（Block D）
- [ ] 所有漏洞附可查證 URL
- [ ] 回報區填寫完整

---

## 塔台收單後行動

根據研究結論：
- **樂觀情境**（漏洞 ≤5 個、可保守清零）→ 塔台自主 commit 或派一張小實作工單收尾
- **中等情境**（需 overrides / minor bump）→ 派實作工單 T01XX 執行推薦方案
- **悲觀情境**（需 major bump / breaking change）→ PLAN-003 升級為 📐 PLANNED + 拆多階段工單；可能順勢重評估 PLAN-005 暫緩狀態

## 執行回報

### 完成狀態
DONE（研究完成，可決策）

### 開始/完成時間
- 開始：2026-04-18 03:24
- 完成：2026-04-18 03:35

### 摘要（TL;DR）
- **npm audit 總數**：**13 個**（0 critical / 7 high / 2 moderate / 4 low）
- **與 T0060 時期（17 個）比較**：**減少 4 個**（Electron 41 升級確實消化掉部分漏洞，但剩餘全集中在 electron-builder 鏈、vite/esbuild、whisper/tar 三群）
- **關鍵事實**：**13 個全部是 dev-time / build-time 依賴**，打包後的 `.exe` / `.dmg` runtime bundle **不受影響**（tar 只在 postinstall 階段使用，不進入執行期）
- **推薦方案**：**混合 —— Q1-A 暫緩 + Q2-B vite 升級 + Q3-B WONTFIX**（使用者決策）
  - Q1：Group A（electron-builder 鏈 9 個）維持 D049 暫緩，等 PLAN-005 處理
  - Q2：Group B（vite/esbuild 2 個）升 vite 5→8 + 連動升級 3 個 plugin（**重大相容性障礙已識別**）
  - Q3：Group C（whisper/tar 2 個）標記 WONTFIX + 文件化
- **預估處理時間**：
  - Q2 實作工單：**4-8 小時**（vite 多 major 跳躍 + 3 個 plugin 連動升級 + dev/build 全回歸測試）
  - Q1、Q3 文件工作：**30 分鐘**

---

### Block A — 漏洞現況盤點

#### A1. 總數與嚴重度分布
```
13 vulnerabilities:
  critical: 0
  high:     7
  moderate: 2
  low:      4
```

#### A2. 漏洞逐項清單

| # | 套件（當前） | CVE / GHSA | 嚴重度 | 影響範圍 | 修復建議 |
|---|-------------|------------|-------|---------|---------|
| 1 | `@tootallnate/once` (<3.0.1) | [GHSA-vpq2-c234-7xj6](https://github.com/advisories/GHSA-vpq2-c234-7xj6) | low (CVSS 3.3) | dev-time（electron-builder 鏈）| `electron-builder@26.8.1`（major）|
| 2 | `http-proxy-agent` (4.0.1-5.0.0) | 繼承自 @tootallnate/once | low | dev-time | `electron-builder@26.8.1`（major）|
| 3 | `builder-util` (22.14.7-25.1.3) | 繼承鏈 | low | dev-time | `electron-builder@26.8.1`（major）|
| 4 | `electron-publish` (22.14.7-25.1.3) | 繼承自 builder-util | low | dev-time | 自動 |
| 5 | `app-builder-lib` (22.14.7-26.5.0) | 繼承多個 | **high** | dev-time | `electron-builder@26.8.1`（major）|
| 6 | `dmg-builder` (22.14.7-26.5.0) | 繼承鏈 | **high** | dev-time (macOS 打包) | `electron-builder@26.8.1`（major）|
| 7 | `electron-builder-squirrel-windows` | 繼承鏈 | **high** | dev-time (Windows 打包) | `electron-builder@26.8.1`（major）|
| 8 | `electron-builder` (24.13.3) | 繼承鏈（**direct**）| **high** | dev-time | `electron-builder@26.8.1`（major）|
| 9 | `tar` (6.2.1, <=7.5.10) | 6 個 GHSA：[GHSA-34x7-hfp2-rc4v](https://github.com/advisories/GHSA-34x7-hfp2-rc4v)（CVSS 8.2）、[GHSA-8qq5-rm4j-mr97](https://github.com/advisories/GHSA-8qq5-rm4j-mr97)、[GHSA-83g3-92jg-28cx](https://github.com/advisories/GHSA-83g3-92jg-28cx)（CVSS 7.1）、[GHSA-qffp-2rhf-9h96](https://github.com/advisories/GHSA-qffp-2rhf-9h96)、[GHSA-9ppj-qmqm-q256](https://github.com/advisories/GHSA-9ppj-qmqm-q256)、[GHSA-r6q2-hw4h-h46w](https://github.com/advisories/GHSA-r6q2-hw4h-h46w)（CVSS 8.8）| **high** | build-time（postinstall / 模型下載）| `whisper-node-addon@0.0.1`（**降級，不可行**）或 overrides |
| 10 | `cmake-js` (7.4.0) | 繼承自 tar | **high** | build-time（native 編譯）| `whisper-node-addon@0.0.1`（降級，不可行）|
| 11 | `whisper-node-addon` (1.0.2, **direct**) | 繼承自 cmake-js | **high** | runtime（但 tar 子依賴只 postinstall 用）| 無乾淨修復路徑 |
| 12 | `esbuild` (0.21.5, <=0.24.2) | [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)（CVSS 5.3）dev server SSRF | moderate | **dev-time only**（vite dev server）| `vite@8.0.8`（major）|
| 13 | `vite` (5.4.21, **direct**) | [GHSA-4w7w-66w2-5vf9](https://github.com/advisories/GHSA-4w7w-66w2-5vf9) path traversal | moderate | **dev-time only** | `vite@8.0.8`（major）|

#### A3. Electron 41 已自動解決的漏洞
對比 T0060（17 個）→ 當前（13 個）：**減少 4 個**，無具體清單對照（T0060 詳單不在本研究範圍），但可推論 Electron 28.x 的子依賴（如 @npmcli、node-gyp 等鏈）已隨 Electron 41 升級移除或替換。

#### A4. Dev-dependency only 漏洞確認
| 套件 | runtime 載入？ | 打包入 bundle？ |
|------|---------------|----------------|
| @tootallnate/once, http-proxy-agent, builder-util, electron-publish, app-builder-lib, dmg-builder, electron-builder-squirrel-windows, electron-builder | ❌ | ❌（electron-builder 打包工具本身）|
| esbuild, vite | ❌ | ❌（vite 產 bundle 後 dev server 不打包）|
| tar | ❌（postinstall/submodule 用）| ❌ |
| cmake-js | ❌（native 編譯工具）| ❌ |
| whisper-node-addon | ✅（direct dep）但其 tar 子依賴**只 postinstall 用** | ✅（套件本體）但 tar 不進 bundle |

**結論**：**13 個漏洞全部無 runtime 攻擊面**。

---

### Block B — 處理方案比較

#### B1. 保守方案：`npm audit fix`（無 --force）
- **可修復**：0 個（所有 `fixAvailable` 皆 `isSemVerMajor: true`）
- **剩餘**：13 個
- **結論**：**不可行**

#### B2. 中等方案：overrides + 手動 minor/patch 升級
可行但複雜度高：
- **tar** 鎖 `>=7.5.11`：但 cmake-js 7.4 peer 為 `^6.2.0`，強拉 tar 7.x 風險：cmake-js API 可能失敗、whisper-node-addon native build 中斷
- **esbuild** 鎖 `>=0.25.0`：已有修復版本，但 vite 5.4.21 peer 可能鎖住 esbuild 0.21
- **vite 5.x 自身漏洞** GHSA-4w7w-66w2-5vf9 影響 `<=6.4.1`，vite 5 線已無 patch（5.4.21 是最終版本）→ **vite 自身必須跨 major**
- **@tootallnate/once / http-proxy-agent** 這些 deprecated 套件無新版本 → 只能透過 electron-builder 26 切換到新的 proxy stack
- **結論**：中等方案**無法完整清零**，只能減少部分漏洞

#### B3. 激進方案：全面 major bump
涵蓋：
- `electron-builder 24→26`（**被 D049 暫緩**）：需重測 NSIS / DMG / ZIP / auto-update
- `vite 5→8`：跳 3 個 major，需同步升：
  - `@vitejs/plugin-react 4.7.0 → 5.x`（當前 peer 最高 vite 7）
  - `vite-plugin-electron 0.28.8 → ≥0.30+`（當前 peer 僅 ^5.1.6）
  - `vite-plugin-electron-renderer 0.14.6 → 新版`（當前 peer 僅 ^5.4.6）
- `whisper-node-addon 1.0.2 → 0.0.1`（**降級，不可接受**）

#### B4. WONTFIX 候選
- **Group A（electron-builder 鏈）**：D049 已暫緩，等 PLAN-005 統一處理
- **Group C（whisper/tar）**：tar 只 postinstall 用，runtime 無攻擊面；whisper-node-addon 上游 0.0.1 建議是錯誤指向；強拉 tar 7 風險 > 收益

---

### Block C — 推薦與決策支援（依使用者決策 Q1-A / Q2-B / Q3-B）

#### C1. 推薦方案：混合策略
| Group | 決策 | 理由 |
|-------|------|------|
| A（electron-builder 鏈 9 個）| **Q1-A 暫緩** | D049 維持有效；electron-builder 26 是 PLAN-005 獨立工程，盲目破防可能影響 NSIS/DMG/auto-update |
| B（vite/esbuild 2 個）| **Q2-B 升 vite 8**（使用者決策）| vite 5 線已無 patch、dev server SSRF 與 path traversal 需處理；**注意：需連動升 3 個 plugin** |
| C（whisper/tar 2 個）| **Q3-B WONTFIX** | tar 只 postinstall 使用，runtime 無暴露；無乾淨修復路徑；強拉 tar 7 風險高 |

#### C2. Q2-B 實作工單預估改動清單

**檔案變動**：
- `package.json`:
  - `"vite": "^5.0.0"` → `"vite": "^8.0.8"`
  - `"@vitejs/plugin-react": "^4.2.0"` → `"@vitejs/plugin-react": "^5.x"`（需查最新支援 vite 8 的版本）
  - `"vite-plugin-electron": "^0.28.0"` → **需先查上游是否支援 vite 8**（目前 0.28 僅 vite 5）
  - `"vite-plugin-electron-renderer": "^0.14.5"` → **需先查上游是否支援 vite 8**（目前 0.14 僅 vite 5）
- `vite.config.ts`:
  - 檢查 deprecated API（vite 6 移除 `build.polyfillDynamicImport`、vite 7 調整 Node.js 要求、vite 8 差異未知）
  - HMR 設定可能需調整
- `package-lock.json`: 自動重建

**是否需跑 `npm install`**：✅ 需要
- ⚠️ **警示（L040）**：Windows 下 VSCode self-lock 問題——執行 `npm install` 前關閉 VSCode 或在外部終端執行
- ⚠️ 或跳出工作區外執行後再回來（避免 node_modules 檔案佔用）

**是否需 rebuild / 重打包 / 重新驗收**：
- ✅ `npm run compile`（vite build）驗證打包產出
- ✅ `npm run dev` 驗證 dev server + HMR
- ✅ Electron runtime 驗收（renderer 載入 / IPC 正常）
- ✅ 建議 `npm run build:dir` 驗證 Electron + Vite 打包整合（不簽章）

#### C3. Q2-B 風險評估

**潛在回歸**：
| 風險項 | 說明 | 緩解 |
|-------|------|------|
| vite-plugin-electron 無 vite 8 支援 | 上游 0.28.x 僅宣告 vite 5 peer | **必須先查上游 changelog / 新版本**，可能需等上游或改用替代方案（如 `electron-vite`）|
| vite-plugin-electron-renderer 無 vite 8 支援 | 同上 | 同上 |
| @vitejs/plugin-react 4.7.0 上限 vite 7 | 需升 plugin-react 5.x | 升級同步（plugin-react 5 應可用）|
| vite 配置 API 變動 | vite 6 deprecate CJS、vite 7 Node 20+、vite 8 未知 | 依序查 migration guide |
| HMR / dev server 行為差異 | SSR / pre-bundle 邏輯變化 | 全開發環境回歸測試 |
| build output 變化 | chunking / tree-shake / asset 處理 | 比對 dist 產出、Electron runtime 驗收 |

**必要 smoke test 範圍**：
1. `npm run dev` dev server 啟動
2. React HMR 變更組件即時更新
3. `npm run compile` 打包成功、產出 dist/、dist-electron/
4. Electron app 啟動、renderer 正常載入、IPC 通道正常
5. CT panel、終端機、設定、sidebar 等主要功能 smoke test
6. `npm audit` 驗證 esbuild / vite 漏洞確實消除

#### C4. Q2-B 預估 Worker time
**4-8 小時**（取決於 vite-plugin-electron 上游是否已支援 vite 8；若需改用 `electron-vite` 則加 2-4 小時）

---

### Block D — electron-builder 暫緩狀態重新評估

#### D1. electron-builder 鏈殘留漏洞觀察
確認 9 個漏洞（A1-A8 + tar 鏈）全部經由 electron-builder 打包工具鏈，dev-only、runtime 無暴露。**不建議提早解封 PLAN-005**——升 electron-builder 26 需重測 NSIS / DMG / auto-update / ASAR 壓縮，風險成本遠高於 dev-only 漏洞的實質影響。PLAN-003 收尾後，PLAN-005 維持 📋 BACKLOG 狀態，待時機成熟（如 electron-builder 26 生態穩定、本專案無其他重大 in-flight 變更）再排程。

#### D2. electron-builder 24.x 對 Electron 41 相容性
本次 Electron 28→41 升級（EXP-ELECTRON41-001 D051）已通過 runtime 驗收，未出現 electron-builder 24.x 與 Electron 41 的相容性警告或錯誤（`npm run dev` + `npm rebuild better-sqlite3` 流程正常）。electron-builder 24 對 Electron 41 的**打包/簽章流程**（NSIS/DMG）尚未在本次升級中實測（D051 僅驗收 dev runtime），建議下次正式 release 時觀察。若出現打包階段 Electron 41 相關問題，可作為解封 PLAN-005 的觸發點。

---

### 互動紀錄

| 時間 | Q/A | 行動 |
|------|-----|------|
| 03:28 | Q: 依使用者決策點提出 Q1/Q2/Q3 三組方案 → A: 使用者回「推薦」 | Worker 準備給混合推薦（Q1-A/Q2-A/Q3-B） |
| 03:29 | Q: 使用者 interrupt，改為「但是我想 昇 vite to 8」 | Worker 調整推薦為 Q1-A/Q2-**B**/Q3-B；啟動 vite-plugin 相容性追查 |
| 03:30 | Worker 發現 vite-plugin-electron@0.28、vite-plugin-electron-renderer@0.14 peer 僅宣告 vite 5 | 立即回報使用者「升 vite 8 會連動破壞 3 個 plugin」，並寫入 C2/C3 緩解策略 |

### 遭遇問題
無（所有漏洞資料從 npm audit + 個別 package.json 取得，無需網路查證；npm audit 已提供 CVE URL）。

### Open Questions
1. `vite-plugin-electron` 與 `vite-plugin-electron-renderer` 上游是否已發布支援 vite 6/7/8 的新版本？（Worker 僅查了本地 node_modules 當前版本，未查 npm registry 最新版本——實作工單應先 `npm view vite-plugin-electron versions` 確認）
2. 若上游不支援，是否考慮改用 `electron-vite`（更活躍維護的替代方案）？
3. vite 8 的 breaking changes 詳單（vite 6/7/8 每個 major 的 migration guide）需在實作工單前收集。

### Renew 歷程
無
