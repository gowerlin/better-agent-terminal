# T0162 — 研究：Electron 41 升級後 npm audit 殘餘漏洞清理可行性

## 元資料
- **工單編號**：T0162
- **類型**：research（研究工單）
- **互動模式**：✅ 允許（Q2=A — 遇決策點可問使用者，如漏洞嚴重度解讀、某套件是否可升）
- **狀態**：🔄 IN_PROGRESS（Phase 2 起動於 03:43）
- **完成時間（Phase 1）**：2026-04-18 03:35 (UTC+8)
- **Commit（Phase 1）**：edf913a
- **優先級**：🟢 Low（技術債，無阻塞）
- **派發時間**：2026-04-18 03:22 (UTC+8)
- **關聯 PLAN**：PLAN-003（npm audit 殘餘漏洞）
- **關聯決策**：D051（Electron 41 閉環，解鎖 PLAN-003 前置條件） / D052（混合策略）
- **Renew 次數**：1
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

---

## 塔台補充（Renew #1）

**時間**：2026-04-18 03:40 (UTC+8)

**補充內容**：
> Phase 1 研究品質優秀，D052 混合策略已成立（Q1-A 暫緩 / Q2-B 升 vite / Q3-B WONTFIX）。但 Phase 1 留下 3 個 Open Questions 是派**實作工單**的阻擋條件——若 vite-plugin-electron / vite-plugin-electron-renderer 在 npm registry 沒有支援 vite 8 的新版本，整個 Q2-B 路線可能要改走（vite 7 或 electron-vite 替代）。
>
> 不要重複 Phase 1 的漏洞盤點，**只解 Phase 1 最後列的 3 個 OQ**。

**新指示**（Phase 2 — 解 OQ）：

1. **OQ1 — npm registry 查證**：執行下列命令，回報所有版本以及 package.json 的 peer 宣告：
   ```
   npm view vite-plugin-electron versions
   npm view vite-plugin-electron version
   npm view vite-plugin-electron peerDependencies
   npm view vite-plugin-electron-renderer versions
   npm view vite-plugin-electron-renderer version
   npm view vite-plugin-electron-renderer peerDependencies
   ```
   判斷：有無支援 vite 6 / 7 / 8 的版本？若有，哪個版本？

2. **OQ2 — electron-vite 替代評估**（僅在 OQ1 結論為「無 plugin 支援 vite 7+」時進行）：
   - `npm view electron-vite version` 最新版
   - `npm view electron-vite peerDependencies` peer 宣告
   - 簡要評估：若改用 electron-vite，改動面積（vite.config.* 重寫 vs 逐步遷移）、生態活躍度、與 React + Electron Main/Preload/Renderer 三入口的支援
   - 不需深入實測，**紙上評估**即可

3. **OQ3 — vite 6/7/8 breaking changes 摘要**：
   - 為每個 major 列出影響本專案的 breaking changes（聚焦：Node 版本要求、config API 變更、plugin API 變更、build output 差異、HMR / dev server 行為、CJS 相容性）
   - 引用 vite 官方 migration guide URL
   - 特別標記「可能需要改 vite.config.ts 的項目」

**Phase 2 產出位置**：
在下方「執行回報」區段，**新增一個小節**標題為 `## Phase 2 回報（Renew #1）`，結構：
- `### OQ1 — plugin 版本盤點`（表格列出所有查到的版本 + peer）
- `### OQ2 — electron-vite 替代評估`（若觸發）
- `### OQ3 — vite 6/7/8 migration 摘要`（每個 major 一段）
- `### Phase 2 結論`（是否可走 Q2-B 升 vite 8？需要額外加哪些實作工單 task？）

**硬限制**（延續 Phase 1）：
- ❌ 不 `npm install` / 不改 package.json / 不 commit
- ✅ 可跑 `npm view` 等 read-only 查詢
- ✅ 可讀 vite 官方文件（可用 WebFetch 或 context7）
- ✅ 可互動（預計無需，但開放）

**預估 Worker time**：15-30 分鐘

**完成標準**：3 個 OQ 都有明確答案，Phase 2 結論告訴塔台「可以派實作工單」或「此路不通，走 vite 7 / electron-vite」。

---

## 執行回報

### 完成狀態
✅ Phase 1 DONE（研究完成，可決策） / 🔄 Phase 2 待接續（Renew #1）

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
- **Renew #1**（2026-04-18 03:40 塔台補充）：Phase 1 留下 3 個 OQ 為派實作工單的阻擋條件，要求 Worker 解完。Phase 2 執行於 03:43 ~ 03:50，產出在下方「Phase 2 回報」小節。

---

## Phase 2 回報（Renew #1）

### Phase 2 開始/完成時間
- 開始：2026-04-18 03:43
- 完成：2026-04-18 03:50
- 時間預算：15-30 分鐘 → 實耗 7 分鐘（✅ 在預算內）

### Phase 2 摘要（TL;DR）
- ✅ **OQ1 解決**：`vite-plugin-electron` v0.29.1 **明確支援 vite 7/8**（已對外公告），`vite-plugin-electron-renderer` v0.14.6 **無 peer vite 限制**（dynamic import）。Phase 1 的擔憂（「peer 僅宣告 vite 5」）**不成立**——Phase 1 觀察到的是舊版 0.28.8 的 devDependencies，不是 peerDependencies。兩個 plugin 實質上都可搭配 vite 5/6/7/8。
- ⏭ **OQ2 跳過**：觸發條件未成立（OQ1 證實上游已支援 vite 7+），但仍做紙上評估供備案，不建議採用。
- ✅ **OQ3 解決**：vite 5→8 跨三個 major，最大風險在 vite 8 的 **esbuild→Oxc / Rollup→Rolldown 核心替換**和 **CJS interop 變更**（Electron main 受影響）。vite 6、7 風險低。
- ✅ **最終結論**：**可以派實作工單**。建議分兩種路徑供塔台二選一：
  - **路徑 A（保守推薦）**：升 vite 7（stable chain），清除 esbuild/vite 漏洞，風險低；
  - **路徑 B（激進）**：升 vite 8，需接受 vite-plugin-electron 1.0.0-beta.3 或等正式版 GA。

---

### OQ1 — plugin 版本盤點

#### npm registry 查證結果

| Plugin | 最新 stable | 最新 beta | 最後修改 | peerDependencies |
|--------|------------|----------|---------|-----------------|
| `vite-plugin-electron` | **0.29.1** | **1.0.0-beta.3** | 2026-04-13 | `vite-plugin-electron-renderer: "*"` （optional） |
| `vite-plugin-electron-renderer` | **0.14.6** | 無 | 2026-03-15 | **無**（空物件）|
| `@vitejs/plugin-react` | **6.0.1** | 無 | （現役）| `vite: "^8.0.0"` + `@rolldown/plugin-babel` + `babel-plugin-react-compiler` |
| `electron-vite` | **5.0.0** | **6.0.0-beta.1** | （現役）| 5.0：`vite: "^5.0.0 \|\| ^6.0.0 \|\| ^7.0.0"`；6.0-beta：`vite: "^6.0.0 \|\| ^7.0.0 \|\| ^8.0.0"` |

#### 本地 node_modules 實況比對

| Plugin | 本地版本 | package.json `peerDependencies` | 本地 `devDependencies.vite` 測試版本 |
|--------|---------|--------------------------------|------------------------------------|
| `vite-plugin-electron@0.28.8`（本地）| 0.28.8 | `{vite-plugin-electron-renderer: "*"}` | `^5.1.6`（上游開發/測試環境）|
| `vite-plugin-electron-renderer@0.14.6`（本地）| 0.14.6 | **不存在**（package.json 無此欄位） | — |

**關鍵發現**：
1. Phase 1 描述「上游 0.28.x 僅宣告 vite 5 peer」**不精確**——那是上游 dev dependency（自家跑測試用 vite），不是對使用者的 peer 限制。兩個 plugin 都透過 dynamic import `import('vite')` 載入 vite，所以任何 vite major 都能運作。
2. vite-plugin-electron 官方 README 已明確說明：**v0.29.1 支援 vite 7 和 8**，且是「stable and production-ready」。未來 v1.0.0 將只支援 vite 8+。
3. vite-plugin-electron-renderer v0.14.6 自 2026-03-15 無新版本，但無 peer 限制，搭配 vite 8 使用沒有技術阻塞（仍需實測）。

#### 版本升級對應表（派實作工單時可直接參考）

| 目標 vite | 建議 plugin 組合 | channel | 風險 |
|----------|-----------------|--------|------|
| vite 6 | plugin-electron 0.29.1 + renderer 0.14.6 + plugin-react 5.0.0 | stable | 低 |
| **vite 7**（推薦路徑 A）| plugin-electron **0.29.1** + renderer **0.14.6** + plugin-react **5.0.0** | **all stable** | 低 |
| **vite 8**（推薦路徑 B）| plugin-electron **1.0.0-beta.3** + renderer 0.14.6 + plugin-react **6.0.1** | plugin-electron 為 beta | 中（Oxc/Rolldown migration + CJS interop）|

---

### OQ2 — electron-vite 替代評估（紙上評估，條件未觸發）

**觸發條件**：僅在 OQ1 結論為「無 plugin 支援 vite 7+」時進行。OQ1 已證實 plugin 支援 vite 7/8，**條件未觸發**。以下為補充評估，提供塔台備案參考。

| 項目 | 評估 |
|------|------|
| 最新穩定版本 | **electron-vite 5.0.0** |
| vite 支援範圍 | 5.0.0 → vite 5/6/7；6.0.0-beta.1 → vite 6/7/8 |
| peer deps | `vite: ^5 \|\| ^6 \|\| ^7` + `@swc/core: ^1.0.0` |
| Node 要求 | 5.0.0 需 Node 20.19+ 或 22.12+（與本專案 Electron 41 的 Node 24 相容）|
| 生態活躍度 | 高（最新版本對齊 vite 8 beta）|
| React + Electron Main/Preload/Renderer 三入口支援 | ✅ 原生支援（內建 main/preload/renderer 三 entry 預設）|

**改動面積（若改用）**：
- ❌ `vite.config.ts` **完全重寫**：electron-vite 使用 `defineConfig({ main, preload, renderer })` 結構，與 vite-plugin-electron 的 plugin-inside-vite-config 模式完全不同
- ❌ 需改 `package.json` scripts（使用 electron-vite CLI 而非 vite CLI）
- ❌ 開發/打包流程差異：electron-vite 主導開發流程，vite-plugin-electron 則讓 vite 主導
- ⚠️ 本專案已有 `vite.config.ts`（使用 vite-plugin-electron plugin 模式，見 T0127/T0131 等歷史工單相關調整），**改動幅度大**

**結論**：
- **不建議切換至 electron-vite**。vite-plugin-electron 既有 vite 8 路徑（0.29.1 → 1.0.0-beta），遷移成本 < electron-vite 重構
- 保留為「最壞情境」備案：若 vite-plugin-electron 1.0.0 GA 延遲 >6 個月且 vite 8 周邊出重大漏洞，再考慮切換

---

### OQ3 — vite 6/7/8 migration 摘要

引用來源：
- [Vite 6 Migration](https://v6.vite.dev/guide/migration)
- [Vite 7 Migration](https://v7.vite.dev/guide/migration)
- [Vite 8 Migration](https://vite.dev/guide/migration)

#### Vite 5 → Vite 6

| 類別 | 變更 | 影響本專案？ |
|------|------|-------------|
| Node 版本 | 無新要求 | ✅ 不影響 |
| Config API | **`resolve.conditions` 預設變更**：需顯式設定 `['module', 'browser', 'development\|production']`（client）或 `['module', 'node', 'development\|production']`（SSR）| ⚠️ 需檢查 `vite.config.ts` 是否有 custom `resolve.conditions` |
| Config API | `json.stringify` 預設改為 `'auto'`（僅大 JSON 才 stringify）| ✅ 低影響 |
| Config API | `json.namedExports` 在 stringify 啟用時不再停用 | ✅ 低影響 |
| Plugin API | **Environment API** 重構（實驗性）| ✅ 本專案無 SSR 場景，不影響 |
| Build output | CSS library 模式 filename 改用 package name（而非固定 `style.css`）| ✅ 本專案非 library 模式，不影響 |
| Dev server | SSR 開發模式 CSS default imports 移除 | ✅ 不影響（non-SSR）|
| Sass | modern API 為預設（legacy API 將於 vite 7 移除）| ⚠️ 若使用 Sass legacy API 需調整（本專案未使用 Sass）|
| HMR | 無重大行為變更 | ✅ 不影響 |
| CJS | 無變更 | ✅ 不影響 |
| 可能需改 `vite.config.ts` | ⚠️ `resolve.conditions`（若有 custom）| 待檢查 |

#### Vite 6 → Vite 7

| 類別 | 變更 | 影響本專案？ |
|------|------|-------------|
| **Node 版本** | **Node 18 EOL，必須 Node 20.19+ 或 22.12+** | ✅ Electron 41 內建 Node 24，不影響 runtime；CI 需確認 |
| Config API | Browser target 預設升級（Chrome 87→107、Firefox 78→104、Safari 14→16）| ✅ Electron 自帶 Chromium，不影響 |
| Config API | 新 target 預設 `'baseline-widely-available'`（取代 `'modules'`）| ✅ 低影響 |
| Plugin API | **`splitVendorChunkPlugin` 移除**（v5.2.7 deprecated）| ⚠️ 若 vite.config 有用需改 |
| Plugin API | **`transformIndexHtml` hook**：`enforce` → `order`，`transform` → `handler` | ⚠️ 若有自定 plugin 需改 |
| Plugin API | `ModuleRunnerOptions`, `ViteDevServer`, `ResolvePluginOptions` 移除未用屬性 | ✅ 低影響 |
| Plugin API | HMR-related types 移除 deprecated 成員 | ✅ 低影響 |
| Sass | **legacy API 完全移除**，僅剩 modern API | ✅ 本專案未用 Sass，不影響 |
| Build output | 無重大變更 | ✅ 不影響 |
| HMR / dev server | 無重大變更 | ✅ 不影響 |
| CJS | 無變更 | ✅ 不影響 |
| 可能需改 `vite.config.ts` | ⚠️ `splitVendorChunkPlugin`、`transformIndexHtml` hook（若有）| 待檢查 |

#### Vite 7 → Vite 8（**重大變動**）

| 類別 | 變更 | 影響本專案？ |
|------|------|-------------|
| Node 版本 | Node 20.19+ 或 22.12+（與 vite 7 一致）| ✅ 不影響 |
| **核心替換** | **esbuild → Oxc**（transformer/minifier）| ⚠️ 所有 `esbuild.*` config 改名為 `oxc.*`（如 `esbuild.jsx` → `oxc.jsx`）|
| **核心替換** | **Rollup → Rolldown**（bundler）| ⚠️ **`build.rollupOptions` → `build.rolldownOptions`**，自定 rollup plugin 需確認相容 |
| Config API | `optimizeDeps.esbuildOptions` → `optimizeDeps.rolldownOptions` | ⚠️ 需改 |
| Plugin API | **`transformWithEsbuild` deprecated，改用 `transformWithOxc`** | ⚠️ 若自定 plugin 需改（本專案未自訂）|
| Plugin API | 新增 `moduleType: 'js'` 要求（custom loaders 轉換非 JS 時）| ✅ 本專案未自訂 |
| Plugin API | **移除 hooks**：`resolveImportMeta`, `renderDynamicImport` | ✅ 本專案未使用 |
| Build output | **SystemJS 和 AMD format 移除**（Rolldown 不支援）| ✅ 本專案僅用 ESM，不影響 |
| Build output | `resolve.mainFields` 嚴格依序解析（不再 format sniffing）| ⚠️ 需檢查是否有依賴舊行為 |
| **CJS** | **CJS interop 變更**：default import from CJS 在 dev / build 行為一致。「可能破壞 existing code importing CJS modules」| ⚠️ **Electron main process 重度依賴 CJS**，需 smoke test |
| Browser target | Chrome 107→111、Firefox 104→114、Safari 16→16.4 | ✅ Electron 不影響 |

#### 可能需改 `vite.config.ts` 的項目彙整

| 升級路徑 | 需改的 config 項目（取決於現況）|
|---------|-----------------|
| 5 → 6 | `resolve.conditions`（若有 custom）|
| 6 → 7 | `splitVendorChunkPlugin` 移除、`transformIndexHtml` hook API 變更 |
| 7 → 8 | `build.rollupOptions` → `build.rolldownOptions`、`optimizeDeps.esbuildOptions` → `rolldownOptions`、`esbuild.*` → `oxc.*`、`transformWithEsbuild` → `transformWithOxc` |
| 5 → 7（**路徑 A**）| 以上 5→6 和 6→7 的合集（低）|
| 5 → 8（**路徑 B**）| 以上所有合集（**中-高**，尤其 Oxc/Rolldown + CJS interop）|

---

### Phase 2 結論

#### 可以派實作工單嗎？
**✅ 可以。** OQ1/OQ3 證實技術路徑通暢，且有兩條可行路徑供塔台二選一。

#### 建議路徑 A（保守推薦）：升 vite **7**

- `vite@^7` + `@vitejs/plugin-react@^5` + `vite-plugin-electron@^0.29.1` + `vite-plugin-electron-renderer@^0.14.6`
- ✅ 全部 stable channel，無 beta
- ✅ 清除 Phase 1 列出的 esbuild/vite 2 個 moderate 漏洞
- ✅ vite.config.ts 改動最小（`splitVendorChunkPlugin` 若有/`transformIndexHtml` hook 若有）
- ✅ Electron 41 的 Node 24 滿足 Node 20.19+ 要求
- ⏱ 預估 Worker time：**3-5 小時**（vite 跨 2 個 major + plugin 連動升 + 全回歸測試）

#### 建議路徑 B（激進）：升 vite **8**

- `vite@^8` + `@vitejs/plugin-react@^6` + `vite-plugin-electron@^1.0.0-beta.3` + `vite-plugin-electron-renderer@^0.14.6`
- ⚠️ vite-plugin-electron 為 **beta channel**（除非等 1.0.0 GA）
- ✅ 清除相同 esbuild/vite 漏洞
- ⚠️ 需改 `vite.config.ts` 多處（`rollupOptions` → `rolldownOptions`、`esbuild.*` → `oxc.*`）
- ⚠️ 需驗證 Electron main process CJS interop 無回歸
- ⏱ 預估 Worker time：**6-10 小時**（Oxc/Rolldown migration + CJS smoke test + 全回歸）

#### 額外實作工單 task 建議（派工單時納入）

不論選 A 或 B，實作工單必備 task：
1. 閱讀並備份當前 `vite.config.ts`
2. 升級 package.json 版本號（避開 D049 範圍，electron-builder 不動）
3. 執行 `npm install`（**警示 L040**：Windows 下關閉 VSCode 或使用外部終端避免 self-lock）
4. 修改 `vite.config.ts`（依路徑 A/B checklist）
5. `npm run dev` 驗證 dev server + HMR + React hot reload
6. `npm run compile`（vite build）驗證打包產出
7. Electron runtime 驗收：renderer 載入 / IPC 通道 / CT panel / 終端機 / Sidebar
8. `npm audit` 確認 esbuild/vite 漏洞消除
9. （若 B 路徑）額外針對 Electron main CJS import 做 smoke test
10. Commit + 更新 CLAUDE.md（若 build 流程有變化）

#### 推薦塔台決策

**優先推薦路徑 A（vite 7）**：理由——
- vite 8 雖有漏洞修復但核心引擎剛換（Oxc/Rolldown），社群磨合期尚短；本專案為 production app，保守為上
- 路徑 A 已能完整清除 Phase 1 列的兩個 moderate 漏洞（esbuild SSRF、vite path traversal）
- vite-plugin-electron 1.0.0 正式版發布後可作為下一次升級目標（6-12 個月後再排 PLAN）

**若塔台傾向 B（vite 8）**：建議等 `vite-plugin-electron@1.0.0` GA（脫離 beta）再動手，或接受 beta 風險。
