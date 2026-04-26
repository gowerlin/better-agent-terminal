# Project Learnings — better-agent-terminal

> 塔台自動追加的觀察紀錄。帶 `candidate: global` 標記的項目,下次 /ct-evolve 時考慮晉升到 `~/.claude/control-tower-data/learnings/`

---

## L001 - 2026-04-10 — 不依賴訓練知識驗證產品技術底層

**觸發條件**：需求對齊階段出現「像某產品一樣」「類似 XX 的體驗」
**反面教訓**:T0001 執行前假設 VSCode Speech = 本地 Whisper。實測發現是 Azure Speech SDK。
**修正**:未來此類問題必須先派研究工單用 WebFetch 驗證
**候選晉升**：✅ candidate: global

---

## L002 - 2026-04-10 — 小社群 npm 套件必須先 PoC 再承諾

**觸發條件**：技術評估發現最佳匹配的 npm 套件 stars < 100 或標記 experimental
**規則**:
- stars < 50:**強制** PoC + 雙軌 plan(不可省略)
- stars 50-100:建議 PoC,雙軌 plan 列為 contingency
- stars > 100:依常規流程,但仍需驗證「核心宣稱功能」

**數據點**:whisper-node-addon 14 stars → T0002 PoC 發現 streaming 和 GPU 兩項核心宣稱都是假的
**候選晉升**:✅ candidate: global

---

## L003 - 2026-04-10 — 工單前置條件檔案路徑必須可驗證

**觸發條件**：塔台產生工單時在「前置條件」/「修改範圍」/「使用 util」列出具體檔案路徑
**問題**:
- T0001（2026-04-10）寫 `electron/electron.d.ts`,實際在 `src/types/electron.d.ts`
- T0149（2026-04-17）指示 Worker 用 `src/utils/execFileNoThrow.ts`，但該檔案**不存在於本專案**（塔台把 Claude Code 主 codebase 的 util 誤以為專案內建）
**修正**:
- 塔台寫工單引用具體檔案路徑 / util 名稱前，**先執行 Glob 或 Read 驗證存在**
- 若無法確認，改寫為「慣例位置可能位於 A/B/C」或「Worker 自行 grep 定位」
- T0149 案 Worker 採等價 pattern 合理化（專案既有 `execFile` + Promise wrapper），塔台事後認可 — 說明 Worker 判斷力可補塔台疏漏，但不應依賴
**候選晉升**：🌐 **candidate: global**（2026-04-17 T0149 證據升級 — 同一 pattern 跨 7 天再現，value proven）

---

## L004 - 2026-04-10 — 研究工單對 WebFetch 權限要有備援

**觸發條件**:RESEARCH 工單需要查 npm 套件資訊
**備援順序**:registry.npmjs.org → GitHub → jsdelivr → unpkg
**候選晉升**:Project 層

---

## L005 - 2026-04-10 — 【重要】研究工單的「功能宣稱」必須在 PoC 中實測

**觸發條件**:研究工單(如 T0001)在報告中引用第三方套件的「功能列表」或「支援情境」
**模式**:
- 研究工單可以做到:收集官方文件、比較 API 表面、評估許可證
- 研究工單**做不到**:驗證文件宣稱的功能是否真的可用
- **只有 PoC 工單能證明「宣稱 = 實際」**

**反面教訓**(T0002 實測發現):
T0001 §B 寫 whisper-node-addon「支援 PCM 串流 + GPU 自動偵測」— 兩條都是 sub-session 從 README 讀到後寫進報告,**未實測**。實測後:
- ❌ 串流 API 不存在
- ❌ prebuilt binary 沒有 GPU 編譯

**修正規則**:
1. 研究工單的「功能宣稱」區段必須加上 **「(未實測,需 PoC 驗證)」** 標記
2. 後續 PoC 工單必須把研究報告中的**每一個關鍵宣稱**列為驗證項目
3. 實測結果若與研究報告不符,必須更新原研究報告、記錄到學習紀錄、重新評估技術選型

**候選晉升**:✅ candidate: global

---

## L006 - 2026-04-10 — Whisper 多語模型的繁簡中問題

**觸發條件**:使用 Whisper 模型進行中文辨識
**問題**:
- whisper `language: 'zh'` 預設輸出**簡體中文**
- 沒有直接的 `zh-TW` 或 `zh-Hant` 參數
- 需要後處理 OpenCC(s2t)或 prompt engineering

**建議**:Phase 1 用 OpenCC(成熟、穩定、輕量),Phase 2 若品質不足再考慮 fine-tuned model
**候選晉升**:候選 global(繁中專案共通問題)

---

## L007 - 2026-04-11 — vite build 通過 ≠ 型別正確(tsc --noEmit 才是真實閘門)

**觸發條件**:專案用 vite / esbuild / swc / 其他不做型別檢查的建置工具時
**模式**:
- `vite build` / `esbuild` 跳過型別檢查以加速
- 導致 `.d.ts` 宣告與實際 runtime 物件嚴重落差時仍能 build 成功
- 直到有人跑 `tsc --noEmit` 才會暴露

**數據點**(T0003 揭露):
better-agent-terminal 跑 `npx tsc --noEmit` 會報 **256 個既有型別錯誤**,但 `vite build` 全部通過。

**規則**:
- 實作類工單的驗收條件應該**同時要求** `vite build` 和 `tsc --noEmit`
- 若既有技術債過多,至少要求「新增/修改的程式碼不產生新的 tsc 錯誤」(ratcheting)
- CI 應該跑兩個閘門

**候選晉升**:✅ candidate: global

---

## L008 - 2026-04-11 — 平行工單必須明確檔案所有權邊界

**觸發條件**:塔台派發可平行的工單(T0004 + T0005 同時執行)
**模式**:
- 平行工單若未明確檔案所有權,容易出現 merge conflict 或覆蓋
- 必須在工單**元資料後**立即加一個「平行工單警告 + 檔案所有權表」
- 表格分類:獨占 / 共享唯讀 / 禁止觸碰
- 明確指示「若需要跨越邊界,停下回報」

**驗證結果**:T0005 sub-session 完美遵守邊界,未觸碰任何 electron/、package.json、共享唯讀區
**套用時機**:所有平行派發的工單組合
**候選晉升**:Project 層(塔台工單產生規範)

---

## L011 - 2026-04-11 — `position: fixed` 在有 CSS `transform` 的祖先容器內會失效

**觸發條件**:
- UI 出現右鍵功能表 / tooltip / popover / modal 位置錯誤
- 特別是當位移量看起來像「某個 UI 元件的固定尺寸」時(sidebar 寬 / titlebar 高)

**CSS 規範**:
- `position: fixed` 的元素**預設**相對於 viewport 定位
- **例外**:當任一祖先元素有以下屬性時,會**創建新的 containing block**,`position: fixed` 改為相對於該祖先定位:
  - `transform: *`(不只 scale,任何 transform 都會觸發)
  - `filter: *`
  - `perspective: *`
  - `will-change: transform` / `will-change: filter` / `will-change: perspective`
  - `contain: layout` / `contain: paint` / `contain: strict`
- **結果**:使用者點擊位置計算出的 `clientX / clientY` 是相對於 viewport,但 `position: fixed` 卻相對於 transformed 祖先 → 偏移量剛好等於「viewport 到祖先原點的距離」

**數據點**(T0008 BUG-002):
- better-agent-terminal 的 `FileTree.tsx` / `GitHubPanel.tsx` / `Sidebar.tsx` 的 context menu 在 Windows 150% DPI 下偏移 x=+250, y=-50
- 250 ≈ sidebar 寬度,50 ≈ titlebar 高度
- 終端縮圖區(`TerminalThumbnail.tsx`)曾於 commit `dab2b82` 修過此問題,使用 React Portal 繞開
- 其他元件沒跟進同樣的 pattern,所以 bug 仍在

**正確解法**:**React Portal 到 document.body**
```typescript
import { createPortal } from 'react-dom';

// ❌ 錯誤:在父容器內 render
{contextMenu && (
  <div style={{ position: 'fixed', left: x, top: y }}>...</div>
)}

// ✅ 正確:portal 到 document.body
{contextMenu && createPortal(
  <div style={{ position: 'fixed', left: x, top: y }}>...</div>,
  document.body
)}
```

**注意事項**:
- Portal 改變 React tree 但**不**改變 DOM 事件冒泡(事件仍會冒泡到原 parent)
- `click-outside detection` 用 `document.addEventListener` + ref 仍然正常運作
- 可能需要注意 CSS inherit(portal 後的元素不繼承原 parent 的 CSS class / context)

**塔台除錯原則**:
- 遇到「位移量很工整」的 bug,先懷疑 CSS containing block 被 transform 改變
- 用 DevTools 的 Inspect → Computed → Layout 查看元素的 offsetParent 是不是 viewport

**套用時機**:
- Context menu / tooltip / popover / dropdown / modal 位置異常
- 任何使用 `position: fixed` 但結果不是相對於 viewport 的情境
- 發現元件在某些 UI 樹下正常、另一些樹下異常時

**候選晉升**:✅ candidate: global(CSS 行為是通用知識,所有前端專案都可能踩)

---

## L010 - 2026-04-11 — Native N-API addon 的 `undefined` 陷阱

**觸發條件**:使用 N-API binding 套件(whisper-node-addon、sharp、better-sqlite3 等)
**問題**:
- JavaScript 裡 `{ foo: undefined }` 和 `{}` 在純 JS 是等價的
- 但 N-API 會把 `undefined` 當成「傳入了一個無效值」,拋出 `"A string was expected"` 類型錯誤
- 必須用**條件建構物件**(`if (x) options.foo = x;`),**不能**用 `{ foo: x ?? undefined }`

**數據點**(T0004):
```javascript
// ❌ 錯誤 — whisper addon 會 throw
const options = { language: userLang ?? undefined };
whisper.transcribe(file, options);

// ✅ 正確 — 條件建構
const options = {};
if (userLang) options.language = userLang;
whisper.transcribe(file, options);  // auto-detect
```

**修正規則**:
- 呼叫 native addon 前,移除所有 `undefined` 值
- TypeScript 的 `Partial<T>` 和 `exactOptionalPropertyTypes` 可幫忙,但 runtime 還是要注意

**候選晉升**:✅ candidate: global(所有 Node.js native addon 開發通用)

---

## L009 - 2026-04-11 — GUI/硬體工單在 headless sub-session 無法 runtime 驗證

**觸發條件**:
- UI 工單(React/Vue/Svelte 元件、視窗佈局)
- 需要硬體(麥克風、相機、GPS、USB 裝置)的工單
- 需要使用者互動(點擊、拖曳、表單輸入)的工單

**模式**:
Sub-session 在 CLI 環境執行,無 GUI、無硬體存取。能做的驗證:
- ✅ `npx vite build` / `tsc --noEmit` / lint
- ✅ 程式碼審查(import、型別、路徑)
- ✅ 單元測試(若有)
- ✅ Mock 層級的邏輯驗證

**不能**做的驗證:
- ❌ 實際啟動 GUI
- ❌ 點擊按鈕、輸入文字
- ❌ 開麥克風、相機
- ❌ 真實使用者情境測試

**數據點**(T0005):
Sub-session 完成所有程式碼交付、build 通過、檔案所有權遵守,但 §3 7 個手動麥克風測試情境**全部**標記「待使用者驗證」。塔台接受 PARTIAL 狀態並聚合到 T0009 整合測試階段。

**塔台處理規則**:
1. 產生 GUI/硬體工單時,**預期會回報 PARTIAL**,不視為失敗
2. 工單驗收條件明確區分「程式碼層」和「runtime 層」,runtime 層標註「交由使用者或 T0009 驗證」
3. 所有延後的 runtime 驗證項目**必須記錄到 `_tower-state.md` 的待處理事項**,不可遺漏
4. T0009(或等效的整合測試工單)必須聚合所有延後的 runtime 驗證項目

**反面做法**(要避免):
- 把 PARTIAL 當失敗重派(sub-session 做不了就是做不了)
- 忘記把延後項目寫進 tower state(會導致整合測試階段漏測)
- 試圖讓 sub-session 「模擬」 runtime 測試(mock 太深失去意義)

**候選晉升**:✅ candidate: global(所有涉及 GUI/硬體的塔台工作流通用)

---

## L013 - 2026-04-11 — 「Evidence-first 原則」的過度套用:已知最佳方案時不需再分步診斷

**觸發條件**:BUG 調查中,塔台已擁有**行業知識等級**的根因線索(例如「這個 API 被 deprecated 且有已知 bug」),但仍選擇「分步驗證」路線做漸進式小改動。

**反模式**:BUG-004 處理中,塔台從 T0015 起就知道:
1. ScriptProcessorNode 2014 年被 W3C deprecated
2. Chromium 有已知 bug 報告
3. AudioWorklet 是官方推薦替代
但仍推薦方案 E(一行改 sink)+ 策略 Alpha(tick checkpoint 診斷),**把 AudioWorklet 當備援**。結果:
- T0016(方案 E)失敗,白花 35 分鐘
- T0017-α(tick 診斷)在已知最佳方案的情況下仍跑,白花 15-30 分鐘
- **本應 T0016 就直接上 AudioWorklet**

**為什麼會這樣**:塔台核心原則「evidence > assumption」被誤套用。**正確理解應該是**:
- evidence 不足時 → 先收集再行動
- evidence **已充分** → 直接行動
- 行業知識級別的證據 = 充分,不需再「在本專案 codebase 驗證」

**數據點**:
- BUG-004 從 T0015 DONE(根因假設 H1)到 T0017-α 派發,經過 T0016 失敗 + T0016-pre 的 V8/cppgc 反駁
- 浪費時間:~50-65 分鐘
- **關鍵誤判點**:在 T0016 選型時,若塔台直接問「ScriptProcessorNode 的業界現況是什麼?」就會走 AudioWorklet
- 使用者反饋(觸發此 learning):「那為什麼你沒推薦直接以新的技術改寫」

**套用時機**:
1. 每次面對 3 個以上修復方案候選時,**先問**:「有沒有方案是行業公認的最佳解?」
2. 若有,且成本 < 10 小時,**直接採用**
3. 不要用「分步驗證」當保險費,除非:
   - 根因真的不確定
   - 最佳方案成本極高(> 1 天工)
   - 修復方案會造成不可逆改動
4. **辨識信號**:當塔台自己在推薦時提到「但某某是 deprecated / has known bugs」這類**行業知識**,那就是應該直接採用新方案的訊號
5. Phase 1 進行中尤其適用 — 阻斷越久成本越高

**候選晉升**:✅ candidate: global(所有塔台決策都適用)

**實戰驗證**(2026-04-11 13:49):
- **首次實戰**:T0017-β AudioWorklet migration
- **原則套用**:使用者質疑後,塔台跳過 T0017-α runtime 測試,直接派 T0017-β 以行業最佳方案(AudioWorkletNode)治本
- **結果**:程式碼 **4 分鐘**完成(13:32 → 13:36),一次 runtime 驗證通過,BUG-004 崩潰徹底消失
- **成本對照**:若走原本的「漸進驗證」路線,T0017-α 測試 + 分析需 ~15-30 分鐘,再派 T0017-β → 總計 20-40 分鐘
- **實際節省**:~15-35 分鐘
- **品質驗證**:修復治本程度 100%(完全替換 deprecated API,無殘留)
- **關鍵學習**:L013 **不只是省時間**,更避免了「漸進驗證反而引入新技術債」的風險(tick counter 若保留會變成無用程式碼)
- **信心等級**:HIGH — 此學習已從「候選」升級為**經實戰驗證的可複用原則**

**第二次實戰驗證**(2026-04-11 14:00,連續命中):
- **實戰**:T0018 whisper native addon 動態 require 修復(BUG-005)
- **原則套用**:使用者回報「從未正常過 + 不記得 T0004 設定」,塔台未派診斷工單,直接依業界標準(Vite external `.node` + commonjs rollup plugin 知識)產出治本藍圖
- **結果**:Sub-session Phase A 探勘確認 Case 1 即命中,Phase B 4 分鐘完成(13:56 → 14:00),atomic commit `9003f29`,1 檔案 +8/-1 行
- **Runtime 驗證**:使用者實測,首次成功端到端語音轉寫(「語音 測試 測試 測試 測試」)
- **成本對照**:若走診斷 + 保守修復路線,預估 60-120 分鐘;實際 4 分鐘 + 使用者驗證時間
- **跨領域驗證**:第一次是 Audio API 底層(React/Web Audio),第二次是 build 系統設定(Vite/Rollup)。**完全不同的技術領域,同樣的 4 分鐘 + 一次命中**

**升級為 GOLDEN rule**(2026-04-11 14:0?):
- 條件滿足:連續兩次實戰命中 + 零失敗 + 跨兩個不同領域 + 節省時間數倍
- 新狀態:**GOLDEN** — 所有塔台決策必讀,優先級高於「evidence-first」原則
- 使用情境:當塔台在推薦方案時自己提到「這是業界標準」或「deprecated / has known bugs」這類**行業知識**,就是訊號,**直接採用**
- 反向約束:塔台若刻意迴避 L013(例如強推「讓我們先驗證」而忽略行業知識),使用者可直接以「L013」為關鍵字糾正

**第三次實戰驗證**(2026-04-11 15:47,連三命中):
- **實戰**:T0020 Vite packaged build worklet load 失敗(BUG-006)
- **原則套用**:Sub-session 在工單輸入上下文中即被提示「Vite 打包 `.ts` worklet 會被轉為 `data:video/mp2t` URL」(業界已知陷阱),直接採用 `public/` static asset 路徑解決,不繞遠路
- **結果**:Sub-session 一次到位,使用者**直接採用 sub-session 產出的 packaged build**(無後續修改、無重新打包)執行 runtime 驗證,一次通過
- **跨三個不同技術層領驗證**:
  1. T0017-β:Web Audio API / React 生命週期(Audio processing layer)
  2. T0018:Rollup build plugin / CommonJS externals(Bundler config layer)
  3. T0020:Vite asset pipeline / Electron resource loading(Build output layer)
- **效率升級**:T0017-β/T0018 是「塔台派 hotfix + 4 分鐘實作」,T0020 是「sub-session 直接掌握業界知識 + 一次到位 + 使用者零重打包」,意味著 L013 GOLDEN 已能在 sub-session 層級自主套用
- **品質**:0 rollback(三次)、0 重做(三次)、100% 治本(三次)
- **新論點**:當 L013 被文件化為 GOLDEN rule 並明確寫入工單上下文,sub-session 能「按圖索驥」使用業界最佳方案,不需塔台每次都親自壓陣。**L013 已成為跨 session 可傳承的塔台工程文化**。

---

## L012 - 2026-04-11 — VS Code tasks 能讓 Worker 做部分 runtime verification,但 GUI 互動仍需人

**觸發條件**:派發 runtime verification 工單時,誤以為「sub-session 跑不了 Electron → 全部延後給使用者」。

**模式**:專案 `.vscode/tasks.json` 有 `開發: 啟動 Dev Server (Runtime)` → `npm run dev-runtime` → `cross-env BAT_DEBUG=1 BAT_RUNTIME=1 vite`。Worker `run_in_background: true` 可以啟動 dev server,配合 `.vscode/scripts/kill-dev.ps1` 可精準清理。**能做檔案層驗證(log 產生、輪替、格式檢查),但無法點 UI 按鈕 / 執行 DevTools Console 指令**。

**數據點**:
- T0014 的 Part 1(基礎 log)+ Part 5(輪替)可自動化 → 約 30%
- T0014 的 Part 2-4 + Part 6-7 需 GUI 互動 → 70% 仍需人
- `dev-runtime` 多 `BAT_RUNTIME=1` 旗標,是為 runtime test 設計的
- `kill-dev.ps1` 精準殺 Vite+Electron,不誤殺

**套用時機**:
1. 派發含 runtime verification 的工單前,**先估算可自動化比例**:
   - >70% → 工單要求 Worker 用 `dev-runtime` task 全自動跑
   - 30-70% → 拆「Worker 自動 + 使用者 checklist」兩階段
   - <30% → 全部交使用者(T0014 就是這種)
2. Backlog:評估建立 CDP(Chrome DevTools Protocol)自動化層 → 可把比例提升到 ~90%,但需 1-2h 基礎設施投入
3. 對照 D013「Runtime Verification Deferral」之前的「全部延後」結論,這條是**部分翻案**:Worker 並非完全無能,只是 GUI 互動受限

**候選晉升**:✅ candidate: global(所有 Electron/GUI 專案通用)

---

## L014 - 2026-04-11 — 塔台 state 檔案構成原子 commit 群組

**觸發條件**：Session 結束前的 git 整理（如 T0019 類 consolidation 工單）。

**模式**：
`_tower-state.md` + `_learnings.md` + `_tower-config.yaml` 形成**一個語意連貫的原子 commit**，訊息格式：

```
chore(tower): update state after <milestone>

- Add <checkpoint description>
- Upgrade <learning number> to <status>
- <other tower-specific changes>
```

**為什麼**：這三個檔案都是塔台自己的記憶系統，commit 它們屬於「塔台營運」而非「功能開發」，用 `chore(tower)` scope 清楚分開，方便未來 git log 篩選「什麼時候 tower 做了什麼決策」。

**數據點**：T0019 Group 1 完全符合此模式，commit `d9345cf`：
```
chore(tower): update state after BUG-004/005 resolution
_ct-workorders/_learnings.md      (L013 升級為 GOLDEN)
_ct-workorders/_tower-state.md    (13:49 + 14:0? checkpoint)
_ct-workorders/_tower-config.yaml (新增 project-level config)
```

**套用時機**：
1. 每次 session 關閉前的 git 整理工單中，作為第一個 group 執行
2. 若 session 中途要做 checkpoint commit（避免遺失），也可單獨 commit 這三個檔案
3. 絕不和功能程式碼混進同一個 commit（會讓 `git log --grep="chore(tower)"` 查不乾淨）

**候選晉升**：🟡 candidate: global（1 次實戰，邏輯自洽，可套用任何啟用塔台的專案）

---

## L016 - 2026-04-11 — 塔台目錄 git 管理:「預設公開、明確保密」細化策略

**觸發條件**：新專案啟動塔台時，決定 `_ct-workorders/` 是否進 git repo。

**反模式 A**：`_ct-workorders/` 整個進 `.gitignore`
- 問題：L014 失效、跨機器同步失效、`chore(tower)` commit 要 `git add -f`

**反模式 B**：整個目錄直接進 repo，無任何過濾
- 問題：研究草稿 / 個人思考 / 敏感資料外洩風險

**推薦模式**：「預設公開、明確保密」細化規則
1. 塔台目錄整體進 repo（類別 1：工程日誌，對 open source 有價值）
2. 排除 `_ct-workorders/reports/`（類別 2：研究草稿）
3. 排除 `_ct-workorders/.private/`（類別 2：敏感內容專用）
4. 排除 `_ct-workorders/*.draft.md`（類別 2：草稿後綴）
5. 簡單 pre-commit hook WARN 檢查密碼 / API key / SSH key（不 block）

**為什麼**：
- 類別 1（`_tower-state`、`_learnings`、`T*.md`）是工程資產，對未來維護者和社群有價值
- 類別 2 有專門目錄/後綴/hook 保護
- L014 自然運作，不需 `-f` workaround
- 跨機器同步透過 git pull 自然接手

**套用時機**：
1. 每個新專案啟動塔台，第一個工單就建立細化的 `.gitignore`
2. 若發現專案已啟動塔台但 `.gitignore` 排除整個塔台目錄，立即開 prep 工單修正

**數據點**：
- 本專案 T0021 暴露 `.gitignore:21` 排除 `_ct-workorders/` 的陷阱
- T0022-prep 實作細化規則，解決 L014 衝突
- 跨機器 continuity 是 global 晉升機制的核心設計意圖

**候選晉升**：🔴 candidate: global（跨專案強烈推薦）

---

## L015 → 已晉升 Global (TG008) · 2026-04-11

**標題**:Electron 應用 dev 與 packaged build 的 runtime 行為分歧是頭號陷阱

**狀態**:🟢 已晉升 Global Layer 2
**Global 位置**:`~/.claude/control-tower-data/learnings/tech-gotchas.md` → **TG008**
**晉升時間**:2026-04-11 16:xx(*evolve 分流決策:使用者選 [A] Global)
**晉升依據**:本專案連續三個 bug(BUG-004 / BUG-005 / BUG-006)皆屬「dev 正常、packaged 壞掉」的結構性陷阱,且規則適用於所有 Electron + Vite/Rollup 專案,非個案

**本專案實戰案例**(保留供追溯):
| BUG | 現象 | 根因 | 修法 | 工單 |
|-----|------|------|------|------|
| BUG-004 | AudioContext 崩潰 | ScriptProcessorNode deprecated + Chromium bug | 改 AudioWorklet | T0017-β |
| BUG-005 | whisper addon `undefined` | `.node` 在 asar 內無法 require | Vite external + asar unpack | T0018 |
| BUG-006 | worklet `addModule` aborted | `.ts` → `data:video/mp2t` URL 無效 | 改 `public/*.js` static asset | T0020 |

**實戰效率紀錄**:
- 三次全部命中 L013 GOLDEN「業界最佳方案直接採用」模式
- 單次最快 4 分鐘、0 rollback、0 重打包
- 使用者對 T0020 甚至「直接拿 sub-session 產出的 packaged build」跑測試一次通過

**完整規則 / 對策 / 觸發條件**:見 TG008

---

## L017 - 2026-04-11 — pre-commit hook 關鍵字掃描的 false positive 策略

**觸發條件**：專案 pre-commit hook 對 commit 內容做關鍵字掃描（`password=`, `api_key`, `secret` 等），檔案中出現這類**歷史描述字串**或 **markdown 引述**時
**模式**：
- Hook 掃描到字串如 `password=test123`，無法區分「真實 credential」與「引述說明」
- 若 hook 設計為 **strict block**，會誤擋合法 commit，sub-session 陷入無法自行解決的困境
- 若 hook 設計為 **warn but not block**，sub-session 可繼續但需人工判讀
**數據點**：
- 2026-04-11 18:08 T0023 commit：pre-commit hook 對 `T0022-prep-closure-and-push.md:235` 的字串 `password=test123` 觸發 WARN
- 該字串出處：前次 session 記錄「曾用 password=test123 測試 hook 行為」的說明性引述
- Hook 實際設計：`[tower-hook][WARN] this hook does NOT block commit; please review manually`
- 結果：commit 成功產生（`dc76077`），push 通過
**套用時機**：
1. 設計 pre-commit hook 時，**預設採「警告但不阻擋」策略**，避免 false positive 形成 CI/CD 死鎖
2. Sub-session 遇到 hook WARN 時，在工單回報區的 **「Pre-commit hook 觸發結果」** 欄位固定記錄：
   - WARN 的完整輸出
   - 人工判讀結論（真 / 假陽性）
   - 判讀依據（為何判為假陽性）
3. 塔台審閱回報時，若連續 N 次同類 false positive，可評估升級 hook 邏輯（排除 markdown code fence、排除引述塊）
4. 本條目適用於所有會接觸 pre-commit hook 的專案 → 候選晉升 global
**候選晉升**：candidate: global（pre-commit hook false positive 是跨專案通用現象；本條目引用的具體字串 `password=test123` 是本專案歷史，但策略普適）
**相關條目**：L016（塔台目錄 git 治理細化策略，hook 屬於治理層）、GA006（self-containing workorder，Commit dc76077 同批驗證）
**狀態**：🟢（1 次實戰驗證：T0023 commit dc76077 成功通過 WARN）

---

## 記錄格式模板

```
## L<編號> - <日期> — <一句話標題>

**觸發條件**：何時會遇到這個模式
**模式**：觀察到的具體現象或反模式
**數據點**：具體的數字、檔案、案例
**套用時機**：未來什麼情況下應該想起這條學習
**候選晉升**：global / project / 無
```

---

## L018 — Playwright + Electron 測試與 single-instance lock

**首次記錄**：2026-04-11（T0022 Playwright E2E infra bootstrap）

**觸發條件**：使用 Playwright `electron.launch()` 啟動 Electron app 做 E2E 測試時

**現象**：`electron.launch: Target page, context or browser has been closed` 錯誤，測試一開始就 fail

**根因**：專案 main 程式有 `app.requestSingleInstanceLock()`，Playwright 啟動的測試實例被現有實例踢掉

**解法**：啟動參數加入 `--runtime=<unique-id>` 隔離 userData 與 lock：
```ts
const app = await electron.launch({
  args: ['.', `--runtime=e2e-smoke-${Date.now()}`],
});
```

**通用性評估**：**跨專案通用**。所有使用 `requestSingleInstanceLock()` 的 Electron 專案，在導入 Playwright E2E 測試時都會遇到同樣問題。

**候選晉升**：**candidate: global**（下次其他專案導入 Playwright + Electron 時驗證，第 2 次成功可升 GA007）

**相關工單**：T0022-playwright-e2e-infra-bootstrap（首次實戰）

**發現者**：sub-session（T0022 執行時自行依 L013 GOLDEN 原則選此解法）


## L019 — Investigation 假設集必須包含「第三方 lib 內部」選項

**首次記錄**：2026-04-11（T0027 BAT 右鍵互動 Part A investigation）

**觸發條件**：塔台對「某個行為差異」提出多個假設並派發 investigation 工單驗證時

**反模式**：塔台假設集建立在「本家程式碼有主動邏輯」的前提上，全部候選都在自家 `src/` 範圍內，忽略第三方 lib 可能才是真正決策點。

**具體案例**：
- 使用者觀察到 BAT 裡 Copilot CLI 右鍵直接 paste / Claude Code CLI 不會
- 塔台提出 4 個假設（H1 alt buffer / H2 mouse tracking / H3 bracketed paste / H4 React component state）
- **4 個假設全部指向 BAT 本家程式碼的主動邏輯**
- T0027 grep 結果：`src/` 全部 no match，實際決策點在 `node_modules/@xterm/xterm/src/common/*`

**根因偏見名稱**：**Self-code-centric bias**（自家 code 中心偏見）

**解法 / 原則**：
1. Investigation 工單的假設集**必須明確包含一條「第三方 lib 內部才是決策點」**
2. Grep 策略先 `src/`，若無匹配則主動擴展到 `node_modules/<核心 lib>/`
3. 假設驗證結論要能接受「全部不成立」並自動 pivot 到新的假設方向（如 T0027 sub-session 正確做的）

**通用性評估**：**跨專案通用**。所有依賴第三方核心 lib（xterm.js / monaco / React / Vue 等）的專案都會遇到。

**候選晉升**：**candidate: global**（下次類似 investigation 情境驗證後可升為 GA007 或 meta-learning）

**相關工單**：T0027-bat-rightclick-investigation-part-a

**發現者**：使用者（dogfood 觀察提出研究問題）+ Sub-session（執行時自然 pivot 到 xterm 內部）+ 塔台（事後檢討自己的假設集偏見）


## L020 — Sub-session 語氣邊界：執行者 vs 規劃者

**首次記錄**：2026-04-11（T0027 回報被使用者點出「越權」現象）

**觸發條件**：任何工單執行後，sub-session 產出回報或 commit message 時

**反模式**：Sub-session 使用**塔台視角的敘事語氣**，例如：
- 「接下來我會收尾更新工單回報區與 _tower-state.md」（未來式 + 主觀宣告 + 塔台私域檔案）
- 「我決定採用方案 A」（「決定」是塔台的動詞）
- 「下一步建議派發 Txxxx」（規劃是塔台職責）

**正解 / 語氣規範**：
- ✅ **過去式 + 客觀描述**：「Step 8 已執行：_tower-state.md checkpoint 已追加」
- ✅ **事實回報**：「Commit 1 建立於 HH:MM，hash: xxxxxxx」
- ✅ **遇阻 STOP**：「Step 5 驗證失敗，grep 無匹配結果，STOP 回報」
- ❌ 不用「接下來我會」、「我決定」、「我建議下一步」等塔台語氣
- ❌ 不在回報中宣告未來行動（未來行動是塔台決策）

**核心原則**：
```
Sub-session = 執行者（Executor），不是規劃者（Planner）
規劃 / 敘事 / 下一步的宣告是塔台的專屬語氣
Sub-session 只做：驗證 → 執行 → 回報事實
```

**工單模板改進**：未來工單的「Sub-session 執行指示」段應明確加入一句：
> 回報時使用過去式客觀描述（「已執行 / 已完成 / 遭遇問題」），避免塔台敘事語氣（「接下來我會 / 我決定 / 下一步建議」）。

**通用性評估**：**跨專案通用**。所有使用 control-tower 架構的專案都該有此邊界。

**候選晉升**：**candidate: global**

**相關工單**：T0027（首次觀察到的實例）

**發現者**：使用者觀察 sub-session 回報語氣問題


## L021 — Tower state 維護職責分界（**結構性 meta**）

**首次記錄**：2026-04-11（使用者觀察 Worker 為何會知道 `_tower-state.md` 存在）

**觸發條件**：工單需要更新塔台私域檔案（`_tower-state.md` / `_learnings.md` / `_tower-config.yaml` / 其他 `_ct-workorders/_*.md`）

**反模式（塔台 structural bug）**：
塔台為了 atomic commit 便利性，在工單「Sub-session 執行指示」中給 Worker 模板，讓 Worker 填寫塔台私域檔案的內容。

**具體案例**（本 session 連續 4 張工單都犯）：
- T0022：Worker 被要求更新 `_tower-state.md` 和 `_learnings.md`（T0024 尾巴連動）
- T0025：Worker 寫入 L018 到 `_learnings.md` + checkpoint 到 `_tower-state.md`
- T0026：Worker 寫入 UX-001 checkpoint 到 `_tower-state.md`
- T0027：Worker 依模板填寫 checkpoint（含 H1/H2/H3/H4 結論、NEXT SESSION TODO 等**塔台決策內容**）

**為什麼這是錯的**：
1. `_tower-state.md` = 塔台**私人記憶 + 決策日誌**，內容是塔台的視角和措辭
2. `_learnings.md` = 塔台**學習記錄**，何時升級、如何分類是塔台決定
3. Worker 在填寫這些內容時，實際上是**替塔台做決策**
4. 這違反「Worker 是執行者，塔台是規劃者」的角色分界
5. 也是 L020（sub-session 語氣）的**結構根源** — Worker 會寫塔台語氣，是因為被要求寫塔台內容

**正解架構**：

```
Tower Session 會寫：
  ├ _tower-state.md     ← 塔台決策 / checkpoint / 記憶
  ├ _learnings.md       ← 塔台學習記錄
  ├ _tower-config.yaml
  └ 工單 .md（新增 / 修訂，不含回報區）

Sub-session 會寫：
  ├ 產品程式碼
  ├ 產品 reports / docs
  └ 工單 .md 的回報區

Sub-session 絕對不碰：
  └ _ct-workorders/_*.md（所有塔台私域 meta 檔）
```

**Commit 策略（Option A — 推薦）**：
1. Worker 完成工單 → 只 commit 產品程式碼 + 工單回報區
2. Worker 呼叫 `/ct-done` 回報塔台
3. **塔台在 tower session 內直接 Edit 塔台私域檔案**
4. 此時 working tree 有塔台寫的 M 檔
5. 塔台派下一張工單，**前置條件明確列出**：
   > 恰好 N 個 M：`_ct-workorders/_tower-state.md`、`_ct-workorders/_learnings.md`（塔台記憶更新，**請勿修改內容**，只需原樣 stage 到 Commit N）
6. Worker 在 Commit N 中**原樣 stage** 這些 M，不改內容

**工單模板改進**：
1. 刪除所有「Step X 塔台 meta 更新」段落（含模板）
2. 在「前置條件」中明確列出「預期的塔台 meta M 檔案清單」
3. 在「執行步驟」中明確說明 Worker 的責任：「原樣 stage `_ct-workorders/_*.md` 的 M，不修改內容」
4. 在「不動範圍」中加上：「不新增內容到 `_ct-workorders/_*.md`；塔台 meta 檔由塔台負責」

**核心原則**：
```
Worker 的筆寫產品，塔台的筆寫塔台記憶
Worker 不該「知道」 _tower-state.md 的內容結構，
更不該「決定」要寫什麼進去
```

**通用性評估**：**跨專案通用 + 結構性**。所有使用 control-tower 架構的專案都該遵守此分界。

**候選晉升**：**candidate: global**（應該直接升為 GA007 或 core protocol；為保守起見先記為 Project 層 candidate，等其他專案驗證後升級）

**相關工單**：T0022 / T0025 / T0026 / T0027（全部 4 張都違反此分界，history 已 committed，作為歷史教訓保留）

**發現者**：使用者（觀察到「Worker 怎麼會知道 `_tower-state.md` 存在」這個結構性問題，直接點出塔台的 protocol 盲區）

**塔台檢討**：
- 塔台在本 session 連續 4 張工單違反此分界，根源是**追求 atomic commit 便利性**而犧牲角色分界
- 這是**塔台設計錯誤**，不是 Worker 執行錯誤
- 從 T0028 開始套用新架構，L021 作為結構性更正的起點

**L021 首次完整測試結果（2026-04-11 21:01 T0028）**：
- ✅ Worker 未寫入 `_tower-state.md`（Commit 2 不含此檔）
- ✅ `_learnings.md` 原樣 stage L019/L020/L021，無新增內容
- ✅ Worker 回報語氣過去式客觀（L020 遵守）
- ✅ Commit 2 恰好 2 檔（T0028.md + _learnings.md）
- **結論**：L021 新架構於 T0028 驗證成功，可繼續沿用

**L021 隱藏約束發現（2026-04-11 對話中）**：
塔台對 tower 私域檔案的 Edit **只能發生在「工單間隔窗口」**，不能在工單執行期間寫，否則會與 Worker 的 diff 驗證產生 race condition。此為 L021 架構特徵，非 bug；命名為 **Tower Edit Synchronization Window**。


## L022 — Computational Feedback Sensor 作為 CT/BAT 下一階段架構方向

**首次記錄**：2026-04-11（使用者分享 Harness Engineering Birgitta Böckeler 的 Feedback Sensor 概念 + Claude Code v2.1.100+ 新 feature）

**來源**：使用者 dogfood 期間分享的外部技術文章摘要

**核心概念**：
Feedback Sensor — 系統自動偵測狀態變化、收集相關 context、餵給 agent 完成後續動作的機制。分為兩種類型：
- **Computational**：程式化、確定性、**不消耗 LLM tokens**（grep / 檔案監聽 / git hook / regex pattern match）
- **Inferential**：LLM 推理、主觀判斷（每次都消耗 context 和 tokens，可能幻覺）

**對 CT 的架構啟發**：

CT 已經具備的 computational sensors（驗證現有方向正確）：
- `*sync` 指令（grep 工單比對狀態）
- 工單元資料解析（`狀態` / `開始時間` / `完成時間` 欄位）
- Git status 前置條件驗證
- Pre-commit hook 關鍵字掃描
- Tower config 三層載入（session / project / global）

CT 缺少的 computational sensors（演化方向）：
1. **Workorder 狀態主動監聽**（FS watch `_ct-workorders/T*.md`，自動通知塔台）
2. **Drift auto-detection**（Git post-commit hook 偵測元資料 vs 回報區不一致）
3. **Stale heartbeat 偵測**（工單執行期間 heartbeat 檔，塔台啟動時檢查 stale）
4. **跨 session 塔台協調**（檔案鎖 + 活動 timestamp，computational 解衝突）
5. **L021 同步窗口偵測**（避免 tower edit 與 worker 執行撞期，對應 Tower Edit Synchronization Window 約束）

**CT Inbox 架構草案**：

```
~/.claude/control-tower-data/
├── ct-inbox/                       ← Computational sensor 輸出
│   ├── {project-hash}/
│   │   ├── workorder-done.jsonl
│   │   ├── drift-alerts.jsonl
│   │   ├── heartbeat/
│   │   └── last-sync.timestamp
│   └── global-alerts.jsonl
└── learnings/
```

塔台啟動 Step 0 流程更新提案：
1. 環境偵測（既有）
2. 讀 `_tower-state.md`（既有）
3. 🆕 讀 `ct-inbox`（新增，computational input）
4. 合併呈現「使用者不在時發生了什麼」摘要

**這不違反塔台 protocol**：
- Inbox 是程式寫入，不是 LLM 推理
- 塔台讀取並呈現，不直接執行（人仍是決策者）
- 所有操作仍透過工單派發（保留現有執行層）

**對 BAT 的架構啟發**：

BAT 目前的 backlog 研究（`_ct-workorders/reports/bat-agent-orchestration-research.md`）本質上就是跨 agent 的 Computational Feedback Sensor 平台。新聞驗證了這個方向的正確性。

可新增的 BAT-level computational sensors：
1. Per-tab output 掃描器（regex error pattern，不用 LLM）
2. 跨 tab context 橋接（Tab A 的 error 自動餵給 Tab B 的 Claude Code）
3. Test failure auto-ingest（npm test 失敗 → 自動彈出「開新 session 修嗎？」）
4. Build watch relay（tsc --watch 錯誤自動寫 shared context）

**戰略意義**：

```
傳統 agent 互動: 使用者 → 貼 log → agent 推理 → 回答
                         ↑ 高 context,高成本,可能漏細節

Feedback Sensor: 系統 → 偵測 → 結構化 input → agent 聚焦推理 → 精準回答
                          ↑ 便宜,可靠,零幻覺
```

這對應塔台既有原則「不直接讀 log / 源碼」— computational sensor 是這個原則的**演化實作**：不是放棄讀取，而是把讀取從 inferential 移到 computational 層。

**具體的下一步候選**（等使用者 review 後決定）：
- [選項 1] 寫 ADR 文件深度評估，不立即實作
- [選項 2] 派 Research 工單做 spike PoC（CT inbox + 1-2 個 sensor）
- [選項 3] 跟 BAT agent orchestration research 整合，統一規劃
- [選項 4] 暫時留為 backlog seed，等 Phase 1 完全收官後再啟動

**通用性評估**：**跨專案通用 + 戰略級**。不只影響本專案，影響整個 control-tower plugin 的設計演化。

**候選晉升**：**candidate: global + strategic**（建議作為 control-tower v3.7 的設計方向討論點）

**相關文件**：
- `_ct-workorders/reports/bat-agent-orchestration-research.md`（既有 BAT 研究）
- 未來可能的 ADR：`reports/ADR-CT-computational-feedback-sensor.md`

**發現者**：使用者（分享外部新聞）+ 塔台（映射到 CT/BAT 既有架構 + 發現 L021 同步窗口約束）

---

## L023 — UI 工單驗收能力落差 + dogfood gate 協議

**類型**：Tower protocol meta-learning（候選 global）
**發現時間**：2026-04-11 23:00（T0029/T0030 連鎖 debugging 過程中使用者自省）

### 模式

UI 類工單（`feat(ui)` / `fix(ui)` / `chore(ui)`）的**驗收標準**（視覺正確性、layout 完整性、互動可用）**高於**目前 Worker 執行環境的**執行能力**（編譯成功、型別過、lint 過）。兩者之間存在結構性錯配。

### 反模式（實際發生的失誤鏈）

1. Worker 執行 UI 工單 → 編譯成功 → 自填 DONE
2. 塔台接受 DONE → 派下一張
3. 多張 UI 工單連續 zero-rollback 收尾
4. **某一張實際有 regression，但因為無視覺閘門而混入 main**
5. N 張 commit 後使用者才透過 dogfood 發現
6. **凶手定位變得困難**（T0029/T0030 故事：花了整晚排除 T0028、T0026 才真正找到）

### 根因

- 工具能力 vs 驗收標準的**結構性錯配**（Worker 看不到 GUI，但 UI 工單的驗收依賴 GUI）
- 塔台缺少**類型敏感**的收尾閘門（所有類型工單一視同仁）
- L013「zero-rollback GOLDEN」慣性放大了樂觀偏誤（連續成功後放鬆警覺）

### 修法：UI Dogfood Gate 協議

對於 type 為 `feat(ui)` / `fix(ui)` / `chore(ui)` / 任何會影響視覺的工單，強制：

```
1. Worker 完成 build + npm run dev 啟動
2. Worker **不可自填 PASS**，驗證區只能填 UNKNOWN - awaits user visual gate
3. Worker 停工，工單 status 改為 AWAITING_USER_GATE
4. 塔台收到 AWAITING_USER_GATE 後主動拋出 micro-task 給使用者：
   "請開 BAT 主視窗，檢查下列觀察點：[具體清單]
    回：視覺 OK / 視覺異常：___"
5. 使用者回「OK」→ 工單正式 DONE
6. 使用者回「異常」→ 立刻在同一 session 派修正工單，維持熱度
```

### 強化版（T0022 E2E infra 成熟後）

等 Playwright E2E 基礎建設完整後，加入自動化 baseline screenshot diff：
- 每張 UI 工單派發前，Worker 先跑 baseline screenshot capture
- 工單執行後再 capture
- 兩者 diff 超過閾值（e.g. >2% 像素差）即標 FAIL
- 和人工 dogfood gate **並行**，不替代

### 候選晉升

**candidate: global**——所有使用塔台、任何有 UI 元素的專案都適用。

### 關聯

- **L013** zero-rollback 慣性偏誤
- **L019** 假設集遺漏
- **L022** computational feedback sensor（E2E diff 是 sensor 的一種）
- **L024** baseline control
- **L025** differential observation

### 發現者

使用者（自省「沒在每張工單實測」）→ 塔台（分攤責任到系統性層級，不讓使用者扛）

---

## L024 — Hypothesis verification requires controlled baseline

**類型**：Debug methodology meta-learning（候選 global）
**發現時間**：2026-04-11 22:55（T0030 HMR 幻影事件）

### 模式

Revert / hypothesis test 前必須確保**環境乾淨**。汙染的 baseline 會讓 evidence 不可信，差點造成誤判。

### 反模式（差點發生的失誤）

T0030 的完整時間線：

1. Worker 啟動 T0030 → `git revert fd3e7af` → 建立 commit `92ba15f` → `npm run dev`
2. **但使用者的另一個 dev server 未終止**，兩個 dev server 同時跑
3. Worker 的 dev server 啟動但隨後因處理程序錯誤結束，狀況不明
4. 使用者手動查看 → 初次觀察**padding 仍在**（幾乎讓塔台誤判「假設推翻，T0026 不是凶手」）
5. 使用者發現舊 dev server 還在跑 → 終止 → 重啟乾淨 dev server → **padding 消失**
6. 實際的假設是對的，但**差點被 HMR 幻影誤導**

### 塔台的警覺（成功攔截）

當使用者回報「重啟 dev server 後 padding 回復正常」時，塔台立刻識別出這是**有混淆因子的結論**，建議做 disambiguation test（把 revert 撤回看 padding 是否再現）。使用者確認已實測 → 才安心進入 Phase A。

### 修法：假設測試前的 baseline checklist

實驗前必須確認：

1. ✅ 所有**舊 dev server / watch process** 已終止（`ps` / `Get-Process` / `netstat -ano`）
2. ✅ Browser / Electron 確實**重新載入新 bundle**（不是用 cached）
3. ✅ **Working tree 乾淨**（無 uncommitted 變更干擾）
4. ✅ **Module cache / HMR 狀態**清空（必要時 `rm -rf node_modules/.vite` / `.cache`）
5. ✅ 記錄 **baseline 狀態 snapshot**（screenshot 或 state dump），實驗後對照

### 候選晉升

**candidate: global**——適用於任何 JS/TS + HMR 工具鏈（Vite / Webpack / Turbopack / Next / etc）的 debug 工作。

### 關聯

- **L019** 假設集遺漏（這是假設**驗證**的配套學習）
- **L023** UI dogfood gate
- **L025** differential observation

### 發現者

塔台（警覺 confounding factor，提議 disambiguation test）+ 使用者（手動清理 baseline、實測確認）

---

## L025 — Differential observation as debug tool

**類型**：Debug methodology meta-learning（候選 global）
**發現時間**：2026-04-11 22:40 – 23:00（BUG-008 + BUG-010 debug 過程）

### 模式

面對**難以復現**或**無明顯入口**的 bug 時，尋找「行為正常」vs「行為異常」的同類實例，**關鍵差異點**就是根因候選。

### 真實案例

**案例 1：BUG-008 ghost**
- **行為異常**：Claude Code CLI 在 BAT 終端有 overlay ghost
- **行為正常**：Copilot CLI 在 BAT 終端無 ghost
- **差異**：Claude Code 用 Ink TUI 會啟用 alt screen buffer；Copilot 直接線性輸出用 normal buffer
- **結論**：指向 BAT event handler 對 alt buffer 事件的訂閱缺失（H1-refined）
- **剪枝效果**：從「所有 overlay / Portal / focus bug」縮小到「alt buffer event pipeline」

**案例 2：BUG-010 input freeze**
- **行為異常**：BAT 中 Claude Code CLI streaming 時 ESC / 鍵盤完全 freeze
- **行為正常**：Windows Terminal 中 Claude Code CLI streaming 時 ESC 可中斷
- **差異**：BAT 有自家的 xterm.js 包裝層 + event dispatcher；Windows Terminal 是原生實作
- **結論**：問題不在 Claude Code、不在 xterm.js、不在 Electron 本身，**定位在 BAT integration layer**
- **剪枝效果**：從「xterm.js 內部、JS 單執行緒、Electron IPC、Claude Code 輸出特性」四大方向，縮小到「BAT 的 event dispatcher 實作」

### 為什麼差分觀察有效

- **剪枝假設空間**：把「有可能是什麼」限制在「A 有 B 無」的差異點
- **可重現**：差異點本身是可控實驗，不依賴模糊的「有時候會發生」
- **低成本**：觀察即實驗，不需要搭建環境

### 最佳使用場景

- 神祕 bug（「it just broke」「有時候會」）
- 跨平台 / 跨版本不一致
- 觀察到但難以歸因的 regression
- 新工具整合後某個組合才壞

### 反模式（不要這樣用）

- **盲目比對所有差異**：差分要鎖定**和現象相關的層級**（例如 UI bug 比對 render pipeline，而不是 package.json）
- **假設差異即根因**：差分給的是**候選**，仍需要 positive evidence 確認（e.g., 實際讀 alt buffer event subscription 程式碼）

### 候選晉升

**candidate: global**——適用於任何 debug 場景。

### 關聯

- **L019** 假設集遺漏（差分觀察是「擴充假設集」的具體方法）
- **L022** computational sensor（差分觀察結果可變成 sensor data）
- **L023** UI dogfood gate（UI 差分是 dogfood 自然會觸發的觀察）

### 發現者

使用者（提供「Claude 有 / Copilot 無」+「BAT 有 / 標準終端無」兩組差分）+ 塔台（識別模式、升級為通用 debug 方法）

---

## L026 — BAT Alt Buffer Event Family Hypothesis (Project-Specific Tech Gotcha)

**類型**：Project-specific tech gotcha（**不晉升 global**，但背後的「自訂終端包裝層需處理 alt buffer」pattern 未來若累積更多證據可抽象化）
**發現時間**：2026-04-11 22:40 – 23:00

### 現象家族

BAT 在 **alt screen buffer**（`\e[?1049h`）情境下，**多個 event pipeline 同時失靈**：

| Bug | 症狀 | 推測 event pipeline |
|-----|------|---------------------|
| **BUG-008** | Overlay 定位不更新，scroll 後 ghost | Scroll / viewport change event 訂閱缺 alt buffer 路徑 |
| **BUG-010** | ESC / 鍵盤輸入在 streaming 期間無法送達 PTY | Keyboard event routing 或 PTY write 在 alt buffer 情境下有 race / block |

### 假設（H1-refined，待 T0032 驗證）

**BAT 的 xterm.js 包裝層 event subscription 只訂閱 normal buffer 的事件來源**，在 Claude Code CLI（Ink TUI → alt buffer）運作期間：

- xterm.js 的 canvas render 正常更新（使用者看得到文字在動）
- **但 BAT 的 React overlay / keyboard handler 從來沒被觸發**（因為 event source 錯了）
- 結果：overlay 停在最初座標（ghost）、鍵盤事件進不了 PTY（freeze）

### 支持證據（smoking gun 級）

1. Claude Code CLI 是 Ink-based TUI，**Ink 預設使用 alt screen buffer**
2. Copilot CLI **不使用 alt buffer**（線性輸出），無相關 bug
3. **Windows Terminal 中** Claude Code CLI streaming 時 ESC 可中斷，**BAT 中不能**
4. BAT 中 Claude Code CLI「**有滿滿內容但無 scrollbar，wheel 可捲**」——alt buffer 經典特徵（alt buffer scrollback=0，但 xterm.js 把 wheel 轉給 alt buffer 內部）

### 待驗證實驗（T0032 scope）

1. **實驗 1**：在 BAT 中開 `vim` / `less` / `htop`（都使用 alt buffer），測試：
   - 是否都有 overlay ghost（驗證 BUG-008 家族）
   - 是否都會 freeze 鍵盤（驗證 BUG-010 家族）
2. **實驗 2**：Chrome DevTools Performance 錄製 Claude Code streaming session，看 main thread long task
3. **實驗 3**：抓 Claude Code vs Copilot 的 raw ANSI stream，確認 `\e[?1049h` 的出現
4. **實驗 4**：讀 BAT 源碼：
   - scroll event subscription
   - keyboard event routing
   - PTY IPC read/write channel 設計
   - `terminal.buffer.active.type` 使用情況

### 治本方向候選（若假設確認）

| 方向 | 成本 | 覆蓋範圍 |
|------|------|---------|
| BAT event subscription 改為 buffer-agnostic（同時監聽 main + alt）| 中 | BUG-008 + BUG-010 |
| 訂閱 xterm.js 的 `onBuffer` / `onRender` 事件（buffer 切換即觸發）| 中 | 主要解 BUG-008 |
| PTY IPC 改為 read/write 獨立 channel（避免 backpressure）| 高 | 主要解 BUG-010 |
| 把 xterm.js parser 移到 WebWorker | 高 | 全部（結構性治本）|

**最佳路徑**：T0032 先驗證 H1，再根據 root cause 決定治法。**不要一次上最貴的修法**。

### 為什麼標 project-specific

- 假設和驗證實驗都**緊扣 BAT 的源碼結構**
- 其他使用 xterm.js 的 Electron 終端（VS Code、Hyper）都沒有這些 bug → 不是 xterm.js 本身問題
- 具體修法和 BAT 的 IPC 設計緊密耦合
- **但**「自訂終端包裝層必須處理 alt buffer 事件」的**pattern** 是通用的，未來若在其他專案看到類似家族，可抽象為 global tech gotcha

### 關聯

- **L019** 假設集遺漏（T0028 把 ghost 歸因於 scroll event 而非 alt buffer）
- **L025** differential observation（本假設的主要證據來源）
- **L022** computational sensor（T0032 的實驗產出可能變成 sensor data）
- **BUG-008 + BUG-010** 本身
- **T0028** 失敗的 Pattern C 修法

### 發現者

塔台（H1-refined 假設建構）+ 使用者（提供三組差分證據 + alt buffer smoking gun 觀察）

## L027 - 2026-04-12 — 先修 Debug 工具再做根因調查

### 模式
當 debug 輔助工具（如 Redraw 按鈕）本身有缺陷時，先修好工具再進行根因調查。

### 規則
- **觸發**：調查類工單的測試/驗證工具本身不可用
- **做法**：拆為兩張工單，先修工具（T0040），再做調查（T0041）
- **效益**：調查過程中可即時驗證假設（如用 Redraw 區分「渲染問題」vs「buffer 問題」）

### 數據點
- T0040（Redraw 修復，8 min）→ T0041（BUG-012 調查，73 min）
- T0041 調查中多次使用 Redraw 按鈕驗證：resize 清除殘影 = buffer 問題而非 renderer 問題
- 若沒有 T0040，T0041 需要更長時間才能排除 renderer 假設

### 適用範圍
- Terminal emulator 開發（Redraw / fit / resize 工具）
- 任何有「診斷工具」的 debug 場景

### 狀態
🟡（1 次驗證，terminal 特定）

## L028 - 2026-04-12 — 跨版本驗證強化 Upstream Issue 說服力

### 模式
提交 upstream issue 前，先在多個版本/配置下重現問題，排除「升級可解」的反駁。

### 規則
- **觸發**：準備向上游提交 bug report
- **做法**：在獨立分支升級相關依賴到最新版，重現問題，將對比結果納入 issue
- **效益**：issue 附帶「v5 + v6 + DOM + canvas 四組合皆重現」→ 直接排除版本/renderer 因素

### 數據點
- T0043：xterm v5.5.0 → v6.0.0 升級，BUG-012 殘影行為完全相同
- T0042 issue（anthropics/claude-code#46898）因此包含 Cross-version verification 段落
- 分支策略：`T0043-xterm-v6-test` 保留不 merge，升級本身也有獨立價值

### 適用範圍
- 向開源專案提交 issue
- 依賴版本敏感的 bug 調查

### 狀態
🟡（1 次驗證）

## L029 - 2026-04-12 — _local-rules.md 啟動時未被自動讀取

### 問題
Control Tower skill 的「三層載入合併邏輯」架構描述中提到 Layer 3 應載入 `_local-rules.md`，但「Step 0: 環境偵測」的 11 項檢查清單中**沒有明確的讀取步驟**。導致新 session 啟動時可能跳過 `_local-rules.md`，不遵循專案附加規則。

### 根因
架構描述 ≠ 執行清單。skill 定義中 Layer 3 載入是描述性文字，不是環境偵測的強制步驟。AI 啟動時按 Step 0 清單逐項執行，但清單上沒有「讀取 _local-rules.md」這一項。

### 本專案暫時解法
在專案 CLAUDE.md 加入強制提醒，確保每次對話都載入此規則。

### 建議回報 Control Tower skill 專案
- **議題**：Step 0 環境偵測應新增一項：偵測並讀取 `_local-rules.md`（若存在）
- **建議位置**：放在 #3（塔台狀態）之後、#4（ECC 學習）之前
- **偵測邏輯**：`test -f _ct-workorders/_local-rules.md` → 若存在則完整讀取並套用
- **面板顯示**：新增一行 `Local Rules  ✅ 已載入 / 📋 無`
- **嚴重度**：中高 — 不讀取會導致專案自訂規則（單據類型、索引同步、歸檔策略）全部失效

### 標記
🔴 **UPSTREAM-FEEDBACK**: 需回報 BMad-Control-Tower skill 專案
📋 **狀態**：待回報

### 適用範圍
- 所有使用 `_local-rules.md` 的 Control Tower 專案

### 狀態
🟢（已驗證：本 session 確實遺漏，加入 CLAUDE.md 後可防止）

---

## L030 - 2026-04-17 — 連環 bug 的 log 時間序毫秒級定位法

**觸發條件**：一次實作 / PR 後出現多個症狀，疑似 regression、edge case、race condition 交織
**模式**：
1. 優先讀 log，尋找 **毫秒級時間序**（不只秒級）
2. 把事件按時間排列，觀察因果先後
3. 若兩事件間隔 <100ms → 可能是 race / watchdog 誤觸發（不是正常 sequential flow）
4. 分辨：同一根因 vs 新 bug 的判據 = log 證據鏈是否連貫

**本 session 數據（2026-04-17）**：T0144 一次實作引爆 3 隻 bug，每層都靠 log 時間序秒殺根因：
- **BUG-033**（Tray bypass Dialog）：對比 Tray click log 與 before-quit trigger log，5 分鐘定位 `isAppQuitting=true` 被手動設
- **BUG-034**（reconnect early-return）：log `saved profile` → `terminal server stopped` 間隔 1ms（遠低於 SIGTERM → exit 的必要延遲），鐵證 early-return 成立
- **BUG-035**（watchdog re-fork race）：`.814 TCP closed` → `.814 died — attempting recovery` → `.815 re-forking` → `.833 re-forked pid 26412`，4 行 log 在 20ms 內跑完，race 現場可見

**反面**：若只看 console 秒級 timestamp，看不出 race condition；若只讀 code，猜根因可能耗時數小時

**候選晉升**：🌐 **candidate: global**（Electron、Node.js 後端、任何有結構化 log 的系統都適用）

---

## L031 - 2026-04-17 — BUG 追蹤紀律：已 FIXED 不退回，新症狀開新 BUG

**觸發條件**：FIXED 狀態的 BUG 驗收後發現「症狀還在」/「還是有問題」
**規則**：
1. **先看證據**：log / metric 是否證實原根因已修？
   - ✅ 原根因已修 → **BUG 保持 FIXED**，新症狀開**新 BUG** 追蹤（不同根因）
   - ❌ 原根因未修 → 退回 FIXING，附失敗說明
2. 判斷關鍵：原 BUG 的「根因」欄位描述的問題是否仍存在？還是產生了衍生問題？

**本 session 範例（2026-04-17）**：
- T0149 commit `cd460d2` 修 BUG-034 early-return
- 打包實測：`via TCP shutdown` log 出現 ✅（原根因已修）但 server 仍殘留 ❌（新症狀）
- 決策：**BUG-034 保持 FIXED**（證據為 log），開 **BUG-035**（pre-existing watchdog race）
- 結果：兩 BUG 根因完全不同，各自修法也不同；若強行退回 BUG-034 會汙染追蹤（無法分辨是 `cd460d2` 還是後續修補起作用）

**反面**：假退回 FIXING 會造成
- 追蹤數據錯亂（修過的 bug 看起來沒修）
- 原本的 commit 證據被稀釋
- 後續修補無法歸屬正確的根因

**候選晉升**：🌐 **candidate: global**（所有有 BUG 生命週期管理的專案都適用）

---

## L032 - 2026-04-17 — Skill 模板與 parser 必須雙向對齊

**觸發條件**：Skill 定義了檔案產出模板（如 section headers、表格 schema），同時有 parser 讀取產物
**問題**：兩端不同步 → 資料正確但顯示錯誤 / 統計對但單項 fallback Unknown

**本 session 範例（BUG-036，2026-04-17）**：
- Skill 模板 `_backlog.md` 定義 section：`## Completed`
- Parser `src/types/backlog.ts:55` 的 `sectionToStatus`：只認 `DONE` / `已完成`
- 結果：PLAN-012 在 Completed section 被 fallback 到 'IDEA' → UI 顯示 Unknown
- 雙因合力：Completed section schema 也沒「狀態」欄 → `rowStatusToStatus` 無法 override

**規則**：
1. Skill 模板變更時（如改 section heading 或 table schema）必須 grep 所有 parser 同步
2. Parser 測試 case 應涵蓋模板的**所有可能產物值**（DONE / Completed / 已完成 都要對應）
3. Parser 設計優先「寬鬆匹配」+ 明確 fallback log，勝於「嚴格匹配」+ 靜默 fallback
4. Schema 設計若有「row 狀態」欄位 override，section 仍需有正確 default（雙重保險）

**候選晉升**：🌐 **candidate: global**（修復對所有使用 CT Panel 的專案適用，類似 PLAN-011 upstream PR 模式 — 建議後續評估推回 CT 上游）

---

## L033 - 2026-04-17 — Worker 主動追加 follow-up 的處理紀律

**觸發條件**：Worker 在原工單範圍外發現相關問題並主動修復（scope creep 的正面形式）
**本 session 範例（T0151，2026-04-17）**：
- 原工單：修 BUG-036（status 顯示 Unknown）
- 使用者在 Worker 執行中追加：「priority 也顯示 Unknown」
- Worker 自行判斷：兩者屬同一 UI parser 缺陷 → 擴範圍補修
- 產出：主修 `cb0d535` + meta `feb84df` + follow-up `4d9fba4`
- 塔台事後認可（D046）

**規則**：
1. 若 Worker 的擴充修復在原工單語境內（相同 bug、相同 UI、相同 parser）→ **允許並認可**
2. 塔台事後在工單回報區明確記載「追加 follow-up」及其 commit，避免追蹤混亂
3. 若 Worker 擴充修復超出原工單語境（跨模組、跨功能）→ 要求 Worker 停下回報，由塔台開新工單
4. 原則：**塔台寬鬆認可同 scope 內的 follow-up，嚴格拒絕跨 scope 的 creep**

**反面**：若塔台每次都堅持「一單一修」，Worker 會為了合規停下手上的小修，UX 變差，對使用者額外提出的小問題反應遲鈍

**候選晉升**：🟡 Project 層（流程文化相關，通用性取決於團隊風格）

---

## L034 - 2026-04-17 — UI bug 的「雙因合力」診斷習慣

**觸發條件**：UI 顯示異常（Unknown / 空白 / 錯誤 label），已修某個 parser 或條件後仍異常
**模式**：UI 顯示 = parser 輸出 + schema mapping + enum fallback，**任一失效都會 Unknown**

**本 session 範例（BUG-036，2026-04-17）**：
- 主因：section parser `sectionToStatus` 不認 `COMPLETED`（返回 undefined → fallback IDEA）
- 從動因：Completed table schema 無「狀態」欄（`rowStatusToStatus` 無法 override）
- 單修主因不夠：因為若有 row override 就會蓋掉 section 判斷，這條路徑也是壞的
- 雙修才穩：section 層 + row 層各自獨立都要能正確回傳

**診斷 checklist**（UI Unknown 時）：
1. Parser 能否識別這筆資料？（regex / switch case）
2. 若識別到，enum / mapping 有對應的 UI label？
3. 有沒有 row-level override 路徑？是否同步覆蓋？
4. fallback 路徑顯示什麼？預設是否合理？

**候選晉升**：🟡 Project 層（UI 架構特定，但診斷思路可普及）

---

## L035 - 2026-04-18 — Dockable panel 新增時雙 render 路徑同步檢查

**觸發條件**：新增 `DockablePanel` 成員（本專案的 `'git-graph'` / `'git'` / `'github'` / `'files'` / 等），Panel 可能 docking 至 main zone 或 left/right sidebar。

**架構事實**（2026-04-18 確認）：
- `src/App.tsx::renderDockablePanel` 處理 **left/right sidebar** 的 panel render（可用 lazy + Suspense）
- `src/components/WorkspaceView.tsx::renderTabContent` 處理 **main zone** 的 tab render（其他 case 皆直接 import，非 lazy）
- 同一 `DockablePanel` 成員在不同 docking zone 走**不同 render path**

**反面教訓**（BUG-037, T0155~T0158）：
- T0155 建立 `'git-graph'` panel，只補了 `App.tsx::renderDockablePanel`
- T0156 實作 SVG graph，假設 panel 已能掛載
- 使用者 dev UAT → panel 全黑（main zone 預設 docking）
- T0157 靜態分析定位：WorkspaceView switch 漏 `case 'git-graph'` → `default: return null`
- T0158 方案 A 修復（補 case），方案 C（抽 shared helper）標記為後續 refactor

**Checklist**（新增 DockablePanel 成員時）：
1. `src/types/`（或 panel type 宣告處）新增成員字面量
2. `src/App.tsx::renderDockablePanel` 加分支（sidebar path）
3. `src/components/WorkspaceView.tsx::renderTabContent` 加 case（main zone path）
4. `WorkspaceTab` / `PinnedContentType` / `loadWorkspaceTab` 字串 union 同步擴展（localStorage 持久化需要）
5. `renderDockablePanel` 若用 `LazyXxx`，WorkspaceView 對應 case 可維持直接 import 以保持 case 一致性（目前 convention）
6. 驗收必跑 `npm run dev` 切到 main zone 的 tab 肉眼確認非空白

**結構性修復候選**（未來 refactor）：
- 抽 `renderPanelContent(panel, ctx)` shared helper，消除雙路徑
- 或改為 panel 成員自帶 render function 的註冊表模式

**候選晉升**：🟡 Project 層（架構特定，但「多 render path 漏 case」反模式通用，value-proven 後可考慮 global 抽象為「dispatch table 應單一真實來源」）

---

## L036 - 2026-04-18 — Electron IPC 雙層 bridge 的 PROXIED_CHANNELS scaffold checklist

**觸發條件**：新增 `electron/` 下的 IPC handler，**特別是**走自訂 `handler-registry`（`registerXxxHandlers()` 模式）而非直接 `ipcMain.handle()` 的情境。

**架構事實**（2026-04-18 確認）：
- 本專案 Electron IPC 走**雙層註冊**：
  1. 業務層：`registerGitScaffoldHandlers()` 等把 handler 塞進自訂 `handler-registry` Map
  2. Bridge 層：`electron/remote/protocol.ts::PROXIED_CHANNELS` Set 列出允許的 channel 名稱
  3. `bindProxiedHandlersToIpc()`（`electron/main.ts:2359`）讀 `PROXIED_CHANNELS` → 從 registry 取 handler → 註冊到 `ipcMain.handle`
- 若 `PROXIED_CHANNELS` 沒列，handler 註冊了但 **ipcMain 從未 bridge**，runtime renderer 會收到 `No handler registered for 'xxx:yyy'`

**反面教訓**（BUG-037 Layer 2, T0155 scaffold 缺口）：
- T0155 加了 `git-scaffold:healthCheck` / `getRepoInfo` / `listCommits` 到 `registerGitScaffoldHandlers()`
- **忘記更新** `PROXIED_CHANNELS`
- T0156/T0157 未捕獲（靜態 build + 研究階段都沒觸發 IPC call）
- T0158 UAT 才炸（renderer 打 `git-scaffold:healthCheck` → handler missing）
- Worker 依 F-11 問 [A/B/C]，使用者選 [B] 擴展修復 → `electron/remote/protocol.ts` 追加 3 channels

**Checklist**（新增 `registerXxxHandlers()` 風格 IPC 時）：
1. 在 `registerXxxHandlers()` 內 `registerHandler('namespace:action', ...)` 登記業務邏輯
2. **同步**在 `electron/remote/protocol.ts::PROXIED_CHANNELS` Set 加入相同 channel 字串
3. 若有 `preload.ts` / `electronAPI` 暴露：同步加 typed wrapper
4. Runtime 驗證：renderer 呼叫對應 API 一次（最穩的是 `healthCheck` 類冪等 call）確認不噴 `No handler registered`
5. Build-only 驗證**不足**，因為 bridge 是 runtime 行為

**結構性修復候選**（未來 refactor）：
- 讓 `registerHandler` 自動把 channel 名稱加入 `PROXIED_CHANNELS`（或合併為單一註冊函式）
- 或 lint rule：scan `register*Handlers` 的字串字面量，diff against `PROXIED_CHANNELS`

**候選晉升**：🟢 Project 層（Electron 特定 + 本專案 bridge 架構特定，global 價值低；但「scaffold 完成後的 runtime 最小 smoke test」概念可普及）

---

## L037 - 2026-04-18 — 一次性大批 deps 升級的失敗率極高

**觸發條件**：單次 PR / commit 一口氣升級超過 3 個 major / 10+ 個 minor 依賴。

**反面教訓**（T0159 考古發現）：
- `b5b3d1a`（2026-04-12）一次性大批 npm 升級，覆蓋 +7557 / -813 行
- 後續 `d8ee82a` 直接 revert 整批，損失 3 小時測試 + 混亂 git history
- 根因：多個升級同時進行時，regression 來源無法歸因，只能整批回滾

**規則**：
1. 單次 PR 最多升級 **1 個 major + 數個相關 plugin**（如 vite 7 + 3 plugin）
2. 跨 major 依賴之間不混用（不要同時升 vite 7 + electron 41 + electron-builder 26）
3. 升級鏈用「原子 commit + EXP worktree 隔離」策略驗證，成功才 merge

**正面驗證**（2026-04-18 本輪）：
- vite 5→7（T0163 獨立 commit `83ae7cf`）
- electron 28→41（EXP-ELECTRON41-001 worktree）
- electron-builder 24→26（EXP-BUILDER26-001 worktree）
- 三條獨立鏈全綠，無 regression，無 revert

**候選晉升**：✅ **promoted to global 2026-04-18**（→ `~/.claude/control-tower-data/learnings/patterns.md` GP023）

---

## L038 - 2026-04-18 — 大型升級的 Worker time 估算常過度悲觀

**觸發條件**：塔台派發 semVerMajor 升級 EXP / 實作工單，預估 Worker 耗時 > 2 小時。

**觀察數據**（本輪 3 條實證）：
| 工單 | 原估 Worker time | 實際 Worker time | 偏差 |
|------|------------------|------------------|------|
| EXP-ELECTRON41-001 | 4-8h | 27 分鐘 | **-90%** |
| T0163（vite 5→7） | 3-5h | 13 分鐘（續接 Worker） | **-95%** |
| EXP-BUILDER26-001 | 4-6h | 34 分鐘 | **-90%** |

**根因**：
- 估時基於「最壞情境」（config breaking + rebuild 失敗 + 依賴衝突）
- 實際路徑上述風險多半不觸發，Worker 跑直線路徑
- 研究階段若已收斂目標版本 / breaking changes，實作其實很快

**修正規則**：
1. 工單預估拆成兩層：**Worker time**（可控）+ **wall-clock time**（含使用者驗收間隔）
2. EXP 工單估時應基於 P50 情境而非 P95，避免低估急迫性
3. 使用者驗收間隔通常是 wall-clock 的主要變數（本輪 EXP-BUILDER26-001 wall-clock 60 分鐘 = Worker 34min + 驗收 26min）

**候選晉升**：✅ **promoted to global 2026-04-18**（→ `~/.claude/control-tower-data/learnings/patterns.md` GP024）

---

## L039 - 2026-04-18 — BAT 內跑 Electron dev 需清 ELECTRON_RUN_AS_NODE

**觸發條件**：在 BAT（better-agent-terminal）內部終端執行 `npm run dev` 或 Electron 相關子進程。

**反面教訓**（BUG-038 / T0161）：
- BAT 用 Electron-as-Node 模式 fork PTY helper，傳 `ELECTRON_RUN_AS_NODE=1` env var
- 此 env var **洩漏到子 shell**，導致子 shell 跑 `npm run dev` 時 Electron 以 Node 模式啟動 → renderer 無法載入
- 現象：主視窗黑屏，log 顯示 `ELECTRON_RUN_AS_NODE=1` 在 child env 中

**修復**（T0161 commit `9d734a8`）：
- `pty-manager.ts` + `terminal-server.ts` 在 spawn 子進程前 `delete process.env.ELECTRON_RUN_AS_NODE`
- 已寫入 CLAUDE.md Electron Runtime 段

**候選晉升**：🟡 Project（BAT 架構特定，但「Electron-as-Node env 洩漏」模式對任何 Electron IDE 類產品通用；value-proven 後可考慮 global）

---

## L040 - 2026-04-18 — Electron-based IDE self-lock 陷阱

**觸發條件**：在 Electron-based IDE（VSCode / Cursor / Claude Code / BAT 等）內跑 `npm install` 或 `npm rebuild` 時。

**反面教訓**（D050 / T0160 期間實戰）：
- VSCode 鎖定 `node_modules/` 內的 `.node` 檔案（sharp、better-sqlite3 等 native modules）
- 同一 VSCode 內的 integrated terminal 跑 `npm install` 會 EBUSY 失敗
- 現象隱蔽：錯誤訊息常是 `EPERM` / `EBUSY` / `ENOTEMPTY`，使用者以為 npm 壞掉
- **循環依賴**：若這個 Electron IDE 本身就是要升級的專案，更糟（self-lock）

**修復規則**：
1. 所有 `npm install` / `npm rebuild` / `electron-builder` 動作**強制在外部終端執行**（Windows Terminal / PowerShell / iTerm 等）
2. 工單「執行步驟」中明確警示：「⚠️ L040：關閉 VSCode 或用外部終端」
3. 寫入 CLAUDE.md 類慢記憶（讓 Worker 自己 onboarding 時讀到）

**正面驗證**（2026-04-18 本輪）：
- T0163 + EXP-BUILDER26-001 均在外部終端執行，零 EBUSY 問題

**候選晉升**：✅ **promoted to global 2026-04-18**（→ `~/.claude/control-tower-data/learnings/tech-gotchas.md` TG011，🟢 reliable）

---

## L041 - 2026-04-18 — Repo 層 + Runtime 層雙軌驗證

**觸發條件**：PLAN 實作完成，判定「驗收通過」前。

**原則**：
- **Repo 層**：`npm install` / `npm run compile` / `npm run build` 綠色、lockfile 變動合理、commit 乾淨
- **Runtime 層**：手動啟動 app、執行核心 flow、觀察 runtime log、確認無 regression
- **兩層都需過才算 DONE**

**反面教訓**（D050 Electron 41 事件鏈）：
- T0160 repo 層全綠 → commit merge main → 宣告 DONE
- 但使用者 runtime 啟動失敗（BUG-038：ELECTRON_RUN_AS_NODE 洩漏）
- 需要 T0161 二次修復才能 runtime 通過

**規則**：
1. 工單 DONE 定義：repo build 綠 + 使用者或 AI runtime smoke test 通過
2. 特別是 semVerMajor 升級，**runtime VERIFY 不可省略**
3. 若無法立即 runtime 驗收（如需外部機器），標記為 FIXED / CONCLUDED-PENDING-VERIFY，不直接 CLOSED / DONE

**正面驗證**（2026-04-18 本輪）：
- EXP-BUILDER26-001 採用 Step 5.4 使用者手動驗收的設計，CONCLUDED 前等使用者實機測試通過
- PLAN-016 Phase 2 最終 D051 閉環靠使用者手動 installer + app smoke test

**候選晉升**：✅ **promoted to global 2026-04-18**（→ `~/.claude/control-tower-data/learnings/patterns.md` GP025）

---

## L044 - 2026-04-18 — Phase 1 靜態查 devDependencies 判斷升級限制不精確

**觸發條件**：研究工單評估套件 A 升級會不會破壞套件 B，透過讀 `node_modules/B/package.json` 的 `devDependencies` 判斷。

**反面教訓**（T0162 Phase 1 vs Phase 2）：
- Phase 1 讀 `node_modules/vite-plugin-electron/package.json` 的 `devDependencies` 發現 vite 5.x，誤判「plugin 依賴 vite 5，不支援 vite 7/8」
- Phase 2 查 npm registry + 上游 README 發現：該 plugin 明確宣告「supports vite 5/6/7/8」，且本身用 dynamic import 載入 vite，**無任何 peerDependencies 硬限制**
- Phase 1 的「plugin 鎖 vite 5」判斷完全證偽

**根因**：
- `devDependencies` 反映的是上游**本地開發時**使用的版本，不是對外**相容性承諾**
- 對外相容性應看 `peerDependencies` + 上游 README / changelog
- 靜態 `node_modules` 只反映本地當時安裝決策

**修正規則**：
1. 評估套件升級相容性：先查 npm registry 的 `peerDependencies` 欄位
2. 若 `peerDependencies` 為空或寬鬆，查上游 README / release notes 的相容性宣告
3. `devDependencies` 只作為「上游開發者最近測試過的組合」參考，不作為相容性判定

**候選晉升**：🌐 **candidate: global**（套件評估原則通用）

---

## L045 - 2026-04-18 — 跨 major 升級研究需分階段（Phase 1 盤點 + Phase 2 解 OQ）

**觸發條件**：研究工單評估 semVerMajor 依賴升級（如 vite 5→8、electron-builder 24→26）。

**觀察**（T0162 雙階段運作）：
- **Phase 1**：靜態盤點（讀 package.json / node_modules / grep 用法），產出「保守擔憂清單」（Open Questions）
- **Phase 2**（Renew）：針對 OQ 查權威來源（npm registry / 上游 README / release notes），多半能證偽 Phase 1 的擔憂
- T0162 案例：Phase 1 列 3 個 OQ，Phase 2 證偽 2 個 + 實證 1 個

**規則**：
1. 研究工單預期至少會 Renew 一次（Phase 2 解 OQ），塔台不應期待一次研究就給確定方案
2. Phase 1 產出的「保守擔憂」列為 OQ 而非結論，留給 Phase 2 驗證
3. Worker 跑 Phase 2 時應主動查 registry / 上游 docs 而非沿用 Phase 1 的 node_modules 靜態資料（L044 的應用）

**正面驗證**（T0162）：Phase 1 預估「升 vite 8 需研究 plugin beta」，Phase 2 證偽「plugin stable 已支援 vite 7/8」，直接跳過 beta 風險。

**候選晉升**：✅ **promoted to global 2026-04-18**（→ `~/.claude/control-tower-data/learnings/patterns.md` GP026）

---

## L046 - 2026-04-18 — Worker 中斷續接的成本取決於工單結構完整性

**觸發條件**：Worker 在工單執行中途異常中止（crash / context 耗盡 / 使用者打斷），續接 Worker 從同一工單續跑。

**正面數據點**（T0163）：
- 前任 Worker 在 Step 5 驗收前中斷（自 kill）
- 續接 Worker 從 Step 1 盤點驗證接手到 Step 8 收尾，**13 分鐘完成**
- 續接成本遠低於重派工單（重派需重跑 Step 1-4，至少 30 分鐘）

**成本低的前提**（缺一則高）：
1. 工單「執行紀錄」區段結構完整（Step 1 / 2 / 3... 分界明確）
2. Step 之間有可驗證的 checkpoint（如 git commit hash、package.json diff）
3. 中斷前 Worker 已回填至少一個 Step 的結果（前任 Worker 至少 package.json 已 commit）

**反模式**：
- 工單無分 Step 的連續大段文字
- Worker 從未回填執行紀錄就中斷
- 中斷原因不明，續接 Worker 不敢判斷進度

**規則**：
1. 工單模板強制「執行紀錄」分 Step 結構（當前塔台模板已符合）
2. Worker 每完成一個 Step 就該回填一小段紀錄（不要憋到 Step 9 才一次填）
3. 續接 Worker 先掃描「執行紀錄」判斷中斷點，再從下一個 Step 接手

**候選晉升**：✅ **promoted to global 2026-04-18**（→ `~/.claude/control-tower-data/learnings/patterns.md` GP027）

---

## L047 - 2026-04-18 — npm audit 指向具體 fix 版本時可跳過研究工單

**觸發條件**：npm audit 報告某套件有 CVE，且 `fixAvailable.version` 明確指向一個可用版本。

**觀察**（EXP-BUILDER26-001）：
- npm audit 指向 `electron-builder@26.8.1` 為 fix 版本
- 無需研究「該升 26 / 27 / 哪個 patch」
- 直接進實作（EXP worktree 模式）即可，Step 1 邊實作邊查 breaking changes

**適用條件**：
1. audit 指向具體版本（非「unknown」或「no fix available」）
2. 目標版本同 major 或僅跨 1 個 major（風險可控）
3. 專案 config 結構不複雜（本專案無 electron-builder.yml，僅 package.json `build` 欄位）

**不適用情境**：
- audit 建議「降級」（如 whisper-node-addon 建議 1.0.2 → 0.0.1，是錯誤反向建議）
- 跨 2+ major（如 vite 5→8）
- 配置複雜（多 yml + 自訂 hooks）

**候選晉升**：🟡 Project（本專案實踐紀律，非跨專案通用原則）

---

## L048 - 2026-04-18 — EXP worktree 模式適合的三條件

**觸發條件**：塔台評估是否用 EXP worktree 隔離實作 vs 直接派 T#### 實作工單。

**EXP worktree 適合條件**（全部滿足才用）：
1. **semVerMajor 升級**（依賴或架構改動大）
2. **Config 格式不明**（是否有 breaking changes 不確定）
3. **主線 commit 乾淨**（主線有其他風險容忍度低的工作進行中）

**反條件**（不該用 EXP）：
- 已研究清楚目標版本 + 無 breaking changes → 直接 T#### 實作（如 T0163 vite 7 升級時，T0162 研究已確認零 breaking 命中）
- 小 patch 升級 → 過度工程
- 研究成本 < EXP 成本 → 先研究更划算

**正面驗證**（本輪）：
- EXP-ELECTRON41-001（Electron 28→41，三條件全中）：27 分鐘 CONCLUDED，主線零污染
- EXP-BUILDER26-001（electron-builder 24→26，三條件全中）：34 分鐘 CONCLUDED，失敗成本 = `git worktree remove`

**候選晉升**：✅ **promoted to global 2026-04-18**（→ `~/.claude/control-tower-data/learnings/patterns.md` GP028）

---

## L049 - 2026-04-18 — EXP worktree 的 Worker 完成率實證

**觸發條件**：評估 EXP worktree 成本 vs 研究工單成本。

**數據點**（本輪兩條 EXP）：
- EXP-ELECTRON41-001：27 分鐘 CONCLUDED
- EXP-BUILDER26-001：34 分鐘 CONCLUDED
- **平均 Worker time：30 分鐘，比典型研究工單（1-2h）更快**

**隱含規則**：
- 當升級目標明確但細節未知時，EXP 實作 = 邊做邊研究，資料密度高於純研究
- EXP 產出的「執行紀錄 + 互動紀錄 + 遭遇問題」三區結構可作為日後回溯參考
- 失敗成本僅 worktree 清理

**限制**：
- 本觀察只涵蓋 2 條 EXP，樣本小
- 專案 config 複雜度影響大（本專案簡單）
- 使用者需 available 執行 worktree 建立 + runtime 驗收

**候選晉升**：🟡 Project（樣本不足支持 global 普及，需更多實證）

---

## L050 - 2026-04-18 — auto-session + auto_commit 組合在升級鏈中的實戰

**觸發條件**：Config 設 `auto-session: on` + `auto_commit: ask`，連續執行多個升級工單。

**正面觀察**（本輪）：
- `auto-session: on`：BAT 環境內工單派發後塔台嘗試開新 session（未實測是否成功觸發，本輪主要靠使用者手動開 sub-session）
- `auto_commit: ask`：每次 commit 前塔台先給使用者過目訊息，使用者僅需回「A/OK」即可執行
- 兩者組合降低使用者打字負擔，但保留關鍵決策權

**適用情境**：
- 使用者深度參與 session（隨時可回答）
- 任務類型對 commit 精確性要求高（如依賴升級）
- 本輪 session 實測可用

**不適用情境**：
- 使用者長時間離開（auto_commit: ask 會卡住流程）
- 這時 `auto_commit: on` 更合適但風險高

**候選晉升**：🟡 Project（CT 功能特定，跨專案僅在用 Control Tower 系列的情境適用）

---

## L051 - 2026-04-18 — Worker time 和 wall-clock time 應分開估算

**觸發條件**：工單預估耗時。

**觀察**（EXP-BUILDER26-001）：
- Worker 可控 time：34 分鐘（Step 1-3 + 5.1-5.3 + 5.5 + 6-8）
- 使用者驗收間隔（Step 5.4）：26 分鐘（4:59 → 5:25）
- Wall-clock total：60 分鐘

**規則**：
1. 工單預估欄位分兩層：**Worker time**（AI 可控）+ **Acceptance interval**（人工可控）
2. Worker time 可基於 P50 情境估（多半樂觀）
3. Acceptance interval 取決於使用者 availability + 手動驗收複雜度
4. 催促使用者驗收 = 壓縮 acceptance interval，不影響 Worker time 估算準確性

**反模式**：
- 單一「預估 4-6h」欄位混淆兩者 → 使用者看到會誤以為 Worker 會花 4-6h
- 實際 Worker 30 分鐘就完成，剩 3-5h 是使用者驗收間隔的期望值

**候選晉升**：✅ **promoted to global 2026-04-18**（→ `~/.claude/control-tower-data/learnings/patterns.md` GP029）

---

## L052 - 2026-04-18 — Worker 遇 schema breaking 應查 release notes 定位精確 migration path

**觸發條件**：Worker 執行升級工單，`npm install` 後跑 build / test 遇到 schema / config 驗證錯誤。

**正面數據點**（EXP-BUILDER26-001 P1）：
- Worker 跑 `npm run build:dir` 遇 `configuration.mac.notarize should be a boolean`
- Worker 不 rollback、不 bypass，而是**讀 electron-builder v26.0.0 release notes**
- 定位到「`mac.notarize` 物件格式 → boolean，teamId 改走環境變數」
- 修改 1 行 `notarize: { teamId: X }` → `notarize: true`，並在 CLAUDE.md 寫下 migration notes

**規則**：
1. 遇 schema validation error：第一步查上游 release notes（不是 stack overflow）
2. 目標：找到**精確的 migration path**（官方推薦寫法）而非 workaround
3. 修復後必須在 CLAUDE.md / migration notes 文件化，避免日後復發

**反模式**：
- 遇 error → 改 config 讓 error 消失（可能偏離官方推薦）
- 遇 error → 降級到未報 error 的版本（技術債疊加）
- 遇 error → rollback 整個升級

**候選晉升**：✅ **promoted to global 2026-04-18**（→ `~/.claude/control-tower-data/learnings/patterns.md` GP030）

---

## L053 - 2026-04-18 — CONCLUDED-PENDING-X 中間狀態回報格式

**觸發條件**：EXP / 實作工單的 Worker 可控部分完成，但需使用者手動驗收（如 installer 安裝 smoke test）。

**觀察**：
- EXP-BUILDER26-001 Worker 完成 Step 1-8 + 5.5 後，Step 5.4 需使用者手動執行
- 使用者自創回報格式「CONCLUDED-PENDING-5.4」精準表達：
  - `CONCLUDED`：Worker 判定工單結論成立
  - `PENDING-5.4`：但有特定 Step 待使用者驗收
- 塔台識別此格式為中間態，不 merge 不 abandon，等使用者驗收結果

**規則**：
1. EXP / 實作工單模板應明確標示哪些 Step 需使用者手動驗收（類似本次 Step 5.4）
2. Worker 完成可控部分時的回報格式為 **CONCLUDED-PENDING-<Step#>**
3. 使用者驗收完後回報 **<Step#> 通過 / 失敗**
4. 塔台閉環時才正式升狀態為 CONCLUDED / ABANDONED

**候選晉升**：🟡 Project（Control Tower 工作流 pattern，需併入 EXP / 實作工單模板）

---

## L054 - 2026-04-18 — 「安全升級日」集中作業模式

**觸發條件**：專案累積多條依賴升級需求（本輪 Electron + electron-builder + vite 三條）。

**正面實證**（2026-04-18 本輪）：
- 單日連續 3 條 major 升級鏈（Electron 28→41 / electron-builder 24→26 / vite 5→7）
- 全綠，無 regression，無 revert
- 總耗時 ~3-4 小時（含研究 + EXP + 使用者驗收）

**優點**：
- 工具鏈記憶熱：同一 session 內 package.json、npm install、打包流程反覆操作
- 測試驗收可疊加：一次 runtime smoke test 驗證三條鏈的組合效果
- CLAUDE.md 同時段寫入：三段 Build Toolchain / Electron Runtime 筆記語氣一致

**風險 / 限制**：
- 單日 context load 高（本 session ~3h，大量工單穿插）
- 需嚴格用 EXP worktree 隔離，避免多條升級在主線混淆
- 使用者需 available 連續處理多個驗收 checkpoint

**適用條件**（建議同時滿足）：
1. 累積 2+ 條獨立升級需求
2. 有 4-6h 連續作業窗口
3. 使用者可隨時回應驗收請求
4. 每條升級都用獨立 EXP 或 commit 隔離

**不適用**：
- 單條升級（直接跑，不需「日」規模）
- 無連續作業窗口（分次做即可）

**候選晉升**：✅ **promoted to global 2026-04-18**（→ `~/.claude/control-tower-data/learnings/patterns.md` GP031）

---

## L055 - 2026-04-18 — Success Criteria 具體化加速 PLAN 結案判定

**觸發條件**：PLAN 建立時撰寫 Success Criteria（完結條件）。

**正面數據點**（PLAN-016）：
- 6 條具體可驗證的 Success Criteria（`npm install` 無錯 / native module rebuild / `npm run dev` 啟動 / `npm run build:dir` / smoke test / 無 regression）
- 使用者詢問「可以做了嗎」時，塔台 5 分鐘內完成 6/6 驗收對照 → 直接宣告 DONE
- 無需派新工單，無需 runtime 二驗

**反模式**：
- 模糊條件：「升級完成」「工作結束」「驗收通過」→ 判定時需要重新對齊
- 缺乏量化指標：「性能提升」「無 regression」→ 無法回溯驗證
- 條件綁特定 commit：「T0160 通過後」→ T0160 內容改了就脫鉤

**規則**：
1. 每條 Success Criteria 必須包含**具體可執行的驗證指令或觀察項**（`npm run X` / 使用者確認 Y / audit 減到 Z）
2. 驗證來源引用具體工單或 commit hash（如本次 PLAN-016 引用 D051 + EXP-BUILDER26-001 Step 5.4）
3. 6 條以內為佳，過多會稀釋每條的權重

**候選晉升**：✅ **promoted to global 2026-04-18**（→ `~/.claude/control-tower-data/learnings/patterns.md` GP032）

---

## L056 - 2026-04-18 — 跨 PLAN 依賴關係應在 PLAN 元資料明寫

**觸發條件**：一個 PLAN（如 PLAN-016）的某個 Phase 依賴另一個 PLAN（如 PLAN-005）完成。

**反面教訓**（PLAN-016 vs PLAN-005）：
- PLAN-016 Phase 3 原文：「順便帶 PLAN-005（electron-builder 26）— native module 重建已完成，builder 升級走同 EXP 尾聲」
- 實際執行：Phase 3 並未「順便」，PLAN-005 獨立走了自己的 EXP-BUILDER26-001
- 結案時塔台差點沒注意到 Phase 3 = PLAN-005 已完成 → 使用者主動問「PLAN-016 可以做了嗎」才觸發對齊

**規則**：
1. PLAN 元資料表新增「**依賴 PLAN**」欄位，列出所有綁定的其他 PLAN 編號
2. Phase 分解時，每個 Phase 若綁其他 PLAN，**在 Phase 名稱中明寫**（如「Phase 3 ≡ PLAN-005」）
3. 當綁定的 PLAN 完成時，**自動觸發** parent PLAN 的 Phase 狀態更新（人工或 `*sync`）
4. PLAN 閉環判定時，先確認所有 Phase / 依賴 PLAN 狀態，再宣告 DONE

**候選晉升**：🟡 Project（Control Tower 工作流專用，需在 PLAN 模板和 `*sync` 邏輯整合）

---

## L064 - 2026-04-18 — yolo 「斷點 C」概念在 SKILL.md vs yolo-mode.md 規格 drift

**觸發條件**：T0174 Phase 5 dogfood — 使用者輸入「停」嘗試觸發「斷點 C」，塔台執行時發現規格不一致。

**規格不一致**：

| 文件 | 「斷點 C」定義 |
|------|---------------|
| `references/yolo-mode.md:212-241` | Worker 回報區建議跨出當前 PLAN 範圍（regex 偵測 `(?:另開\|新開\|建議.*派\|建議.*開)`） |
| `SKILL.md` 啟動警語段落（YOLO MODE ACTIVE） | 「隨時輸入『停』可觸發斷點 C 暫停」（暗示使用者主動暫停） |

**實戰觀察（本 session）**：
- **Phase 4** 真正符合 `yolo-mode.md` 斷點 C 定義 — T0173 回報「建議實作工單列表 T-NEXT-1/2/3」跨出 PLAN-020，塔台正確 PAUSE。但塔台當下稱「無下一張」，未識別為斷點 C。
- **Phase 5** 使用者輸入「停」— 規格未定義此事件類型，塔台沿用 SKILL.md 警語語意稱「斷點 C」。
- 結果：同一 session 兩次「斷點 C」實際是兩個不同事件，記錄會混淆。

**根因**：
- yolo 規格演進中產生 drift — `yolo-mode.md` 是技術規格（Worker 觸發），`SKILL.md` 啟動警語是 UX 提示（使用者觸發），兩者用同一名詞但語意不同。
- 缺少「使用者手動暫停」的正式事件類型。

**修法建議**：
1. **保留 `yolo-mode.md` 斷點 C 定義**（Worker 跨 PLAN 建議，技術判準明確）
2. **SKILL.md 警語改稱「使用者中斷」或「斷點 U（User）」**，避免與斷點 C 衝突
3. **`_tower-state.md` YOLO 歷程新增事件類型**：`[使用者中斷]` / `[斷點 U]`，獨立於 A/B/C
4. 上游 skill 修正：CP-T#### 跨專案工單到 `claude-control-tower`（與 L057-L063 同批處理）

**候選晉升**：🟡 Project（先在本專案 dogfood 確認，後續評估是否上游）

**2026-04-18 16:25 更新**：CT-T003 已閉環 — SKILL.md + yolo-mode.md 改為「使用者中斷」獨立事件類型（v4.2.1 tag），drift 修正生效。本 learning 轉歷史價值（根因已解）。

---

## L062 - 2026-04-18 — 對方塔台實作比 Worker 草稿更嚴謹

**觸發條件**：CT-T002 yolo skill patch 由 Worker 在本塔台起草為「yolo 硬鉤子」初版，CP-T0094 對方塔台實作時識別出「鉤子失敗不應執行 Step 11」避免狀態重複。

**觀察**：對方塔台在「吸收 DELEGATE 工單」時，多了一層對自己 skill 架構的理解，能補 Worker 草稿未察的狀態邊界。

**意義**：跨專案草稿 + 對方塔台審核 = 自然的多重審視機制，比單一塔台/Worker pipeline 更嚴謹。

**修法建議**：跨專案 DELEGATE 在「規格修改」類任務時，優先走「本塔台草稿 → 對方塔台審核 + 吸收」而非「本塔台 Worker 直接改對方 skill」。

**候選晉升**：🟡 Project（需 2-3 次實證，考慮晉升 Global GP）

---

## L063 - 2026-04-18 — yolo 警語缺 session-only vs persisted 區別

**觸發條件**：T0174 Phase 1 dogfood — 塔台啟動警語面板未區分「本次 session 暫啟動 yolo」vs「yolo 已持久化至 `_tower-config.yaml`」。

**影響**：使用者無法從警語判斷 yolo 是一次性還是永久生效，造成 UX 困惑（特別是跨 session 恢復時）。

**修法建議**：
1. 塔台偵測 yolo 啟用來源（session / project config / global config）
2. 警語面板加區別標記：
   - 「⚠️ YOLO MODE ACTIVE（session-only，本次啟動生效）」
   - 「⚠️ YOLO MODE ACTIVE（已持久化於 `_tower-config.yaml`）」
   - 「⚠️ YOLO MODE ACTIVE（全域配置 `~/.claude/control-tower-data/config.yaml`）」
3. 持久化來源下，追加「輸入 `*config auto-session off --save project` 可關閉」提示

**候選晉升**：🟡 Project（yolo-mode.md 警語規格強化，成熟後可送上游 CT skill）

---

## L065 - 2026-04-18 — 跨專案 DELEGATE 工單 repo 結構假設缺口

**觸發條件**：CT-T003 派發時，工單模板預設「獨立 repo + `git checkout -b + push`」流程，實際目標 `BMad-Control-Tower-v4.2.0/` 是 `BMad-Guide` monorepo 子目錄，Worker 需臨時調整為「直接 commit 到 dev-main」。

**影響**：Worker 動手前才發現結構不符，臨時 inference 調整（符合互動規則第 1 條但回報需額外說明）；monorepo 其他未 commit 變更可能被無意干擾。

**修法建議**：
1. DELEGATE 工單派發前，塔台或 Worker 先 `git rev-parse --show-toplevel` 偵測
2. 工單 Step A 改為條件式（獨立 repo / monorepo 二擇一分支）
3. 模板中加「前置檢查」段落，Worker 不符時明示採用哪種
4. 已晉升 Global GP043（patterns.md），本條為 project-layer 補充記錄（含 CT-T003 完整時序）

**候選晉升**：🔵 已晉升 Global（GP043, 2026-04-18）

---

## L066 - 2026-04-18 — PLAN 🟢 IDEA 節點作為「歷史知識索引」會鎖住歸檔

**觸發條件**：`*archive --dry-run` with `archive_days: 1` 偵測到 3 張候選（T0149 / T0150 / BUG-034），執行後全數觸發「活躍引用豁免」還原。

**根因**：PLAN-013 🟢 IDEA（Installer 檔案鎖定詢問 kill）作為**未實作的設計參考節點**，在內文引用了整串 PLAN-012 已完成的閉環單據作為「日後實作時的設計依據」：
- `_bug-tracker.md` L40：`BUG-034：被 Active PLAN-013 🟢 IDEA 引用`
- `PLAN-013.md` L63：`T0149 commit / T0150 commit：PLAN-012 最終實作`

**影響**：10+ 張閉環單據（BUG-031/033/034/035/036 + T0144/T0145/T0147/T0149/T0150）因被 IDEA 節點引用，**無限期保留在熱區**，無法歸檔。

**現況**：SKILL.md `archive-system` 規格明示「被其他活躍單據引用的已完成單據（活躍引用豁免）」— 嚴格執行的話，只要 IDEA 節點不被實作或刪除，引用鏈上所有閉環永不能歸檔。

**提案修法**（待塔台規格演進決定，記錄為 learning）：
1. **引用快照策略**：歸檔工單時，把被引用的關鍵段落（commit hash、現象描述、根因摘要）inline 複製到 IDEA 節點，解除原檔依賴後再歸檔
2. **archive_days 調高 + 容忍**：保守設定（如 7-30 天），讓熱區能容納歷史知識節點，不過度激進
3. **IDEA 狀態歸檔例外規則**：若引用來源是「PLAN IDEA」且為「設計參考」而非「依賴關係」，允許歸檔（需塔台偵測引用語意，複雜度高）
4. **定期 IDEA 清理**：IDEA 超過 N 個 session 未進展 → 提醒使用者「評估實作 or DROPPED」，解鎖引用鏈

**本輪處置**：採方法 2 — 將 `archive_days` 從 `1` 改回 `7`（保守預設），等引用鏈自然隨 PLAN-013 演進解鎖，或塔台規格升級支援快照策略。

**候選晉升**：🔵 Global 候選（CT 通用 — 歸檔策略與 IDEA 節點語意，非本專案特定）

---

## L067 - 2026-04-18 — payload-pty-env 管線半成品為 BUG-040 技術債根源

**觸發條件**：BUG-040 根因追溯 — `bat-terminal.mjs` 透過 `invokePayload.customEnv` 傳環境變數到 `terminal-server.ts` 再到 `pty-manager.ts`，最終 spawn PTY 時用 `{ ...process.env, ...customEnv }` 注入。

**根因層級**：
1. BUG-031 修復時只解決 renderer → main 的 workspace 傳遞（第 1 層）
2. main → pty-manager 的 workspace 傳遞留在原本的 `activeWorkspaceId` fallback（第 2 層半成品）
3. pty-manager 建 PTY 時若 customEnv 沒帶 workspace id，fallback `activeWorkspaceId` 會黏著前一張 Worker 結尾的 cwd → BUG-040 顯現

**關鍵原則**：**跨層欄位應一次貫通全部 N 層，中間 fallback = 半成品 = 未來 BUG 溫床**。

**修法範例**（T0176 實證）：
- BAT 端 `bat-terminal.mjs` 接收 `--workspace` flag → `invokePayload.customEnv.BAT_WORKSPACE_ID = <uuid>` → PTY spawn 時穿透全程 → Worker 讀 `process.env.BAT_WORKSPACE_ID`
- 全鏈路 5 個定位，一次改到位，無中間 fallback

**專案內類似技術債風險位置**：
- `main.ts` terminal:create-with-command handler（行 1556-1590 附近）
- 其他 IPC 訊息類似「前 2 層傳，第 3 層 fallback」的設計
- 建議開 audit 工單用 grep 找出所有 `fallback\|activeXXX\|defaultXXX` 模式驗證

**候選晉升**：🏠 Project-specific（本專案 BAT + customEnv spread 架構特定）

**相關**：BUG-040（主觸發）、BUG-031（前債未盡）、T0176（修法實證）

---

## L068 - 2026-04-18 — 塔台自主 ops 執行邊界

**觸發條件**：使用者明確授權塔台執行跨 repo ops（rename / tag / push / sync）

**允許清單**（ops 領域，非程式碼修改）：
- `git mv`（目錄改名）
- `git commit`（ops chore，非 code change）
- `git tag` + `git push tag`
- `git push origin <branch>`
- `cp -r / rm -rf`（skill sync 等檔案操作）
- `*archive` 的 `git mv`（原本就在 SKILL 允許範圍）

**禁止清單**（Worker 領域，需派工單）：
- 任何 source code 修改
- debug、讀 log、讀原始碼分析
- 複雜 refactor 或新功能

**本 session 實證**：
- Session 1：`*archive --dry-run` + 批次 `git mv` 歸檔 ops（2026-04-15）
- Session 5：跨 repo directory rename + tag + push + 8 skill sync（2026-04-18）
- 2 次使用者明確授權「塔台自己執行」→ 0 失誤

**邊界判定原則**：
- 動到 source code / 需讀檔 → Worker
- 動到 repo 結構 / 發布 / 同步 → 塔台可執行（需授權）
- 邊界灰色時 → 問使用者

**候選晉升**：🟡 candidate: global（ops 邊界原則跨專案有效，但需跨 3+ 專案驗證再升 GP）

**相關**：D062（Worker 無狀態）、SKILL.md § 嚴格禁止

---

## L069 - 2026-04-18 — Upstream sync 遇設計分歧以權威規格為準

**觸發條件**：fork 從 upstream sync 新功能時，發現實作方向不一致

**T0183 實例**：
- Upstream `3a0af80` `path-guard.ts` 採 **deny-list**（拒敏感路徑如 `~/.ssh`）
- T0181 研究報告 §D 權威規格要求 **workspace allowlist**
- Worker 按 §D 實作 allowlist，於工單回報「遭遇問題」明確記錄差異

**規則**：
1. Upstream 提供實作參考，**非**強制採用
2. 若研究報告 §權威規格與 upstream 衝突 → 以權威規格為準
3. Worker 回報區必須明示「規格 vs upstream 分歧」+ 採用理由
4. 影響評估：allowlist 比 deny-list 嚴格（block 任何 workspace 外的讀取），若破壞 workflow 塔台可考慮後續放寬為混合模式

**反例預防**：
- ❌ 盲目套 upstream patch（繞過權威規格）
- ❌ 發現分歧不回報（使用者無法判斷合理性）

**候選晉升**：🟡 candidate: global（fork 管理通用）

**相關**：T0183（修正實作）、T0181 §D（權威規格）

---


## L070 - 2026-04-19 — 研究工單規模爆擊暫停門檻

**觸發條件**：研究型工單執行中,grep / 盤點結果遠超預期規模

**前 session 觸發**：T0185 PLAN-019 TS debt 預估 ~20 errors,實際 133 → 範圍 6.5x 爆擊

**本 session 對照**：T0194 BUG-044/045 預先框架 4 個子問題（Q1-Q4）+ 限定 5 張 PLAN 樣本 + 明確盤點目標 → 規模可控,Worker 10 min 完成（est 30-45 min）

**規則**：
1. 研究工單 framing 階段先**設定範圍 hard limit**:
   - 子問題列表（必須全部回答）
   - 樣本上限（如「Read 不超過 N 個檔案」）
   - 盤點動作上限（grep N 個關鍵字,read N 個目錄）
2. 執行中發現實際規模 > 預估 3x → **立即 `*pause` 回報**,不要硬吃
3. 回報時提供 (a) 實際規模 (b) 已處理的部分 (c) 剩餘範圍評估 (d) 建議拆單方案
4. 塔台收到 pause → 評估 Renew（補方向）vs 拆新工單

**反模式**：
- ❌ Worker 硬吃 200+ files 不回報,context 被打爆
- ❌ 沒框架的「找出所有 X」（用詞模糊 → 範圍無界）

**正模式**：
- ✅ T0194 預設 4 個 Q + 5 張 PLAN 樣本 + 步驟時間箱（<10/<10/<15/<10 min）
- ✅ Worker 在框架內自由發揮,但有 hard stop

**狀態**：🟢 reliable（前後 session 對照實證）

**相關**：GP044（研究報告品質）、L061/GP042（Worker time 估時）

---

## L071 - 2026-04-19 — 本 repo 多次 session 累積 commits 未 push 風險

**觸發條件**：dogfood / 高頻 session 期間,專注完成工單但忘記 push

**現象**：
- 本 session 結束時：T0194/T0195/T0196 + BUG 元資料更新 + tracker 更新 = ~6+ commits 未 push
- 前 session 結束時:PLAN-018 三張 + meta 改動未 push（snapshot 明確記錄）
- 連兩 session 累積 → 若機器壞 / repo 損毀 → 工作整批遺失

**規則**：
1. session 收尾流程必含 `git push origin <branch>`
2. 收尾 SOP:`*evolve` → 更新 `_tower-state.md` → **push** → 退出
3. 若中途長時間（>1h）穩定態,可考慮 mid-session push（保險）
4. push 失敗（衝突 / 權限）必須當場解決,不要丟給下 session

**反模式**：
- ❌ 「下次再 push」（忘掉的機率隨時間指數上升）
- ❌ commit 後不檢查 `git status`（漏掉 untracked 工單）

**正模式**：
- ✅ session 結束 checklist 含 push
- ✅ 退出前 `git log origin/main..HEAD` 確認本地領先狀態 = 0

**狀態**：🟡 reliable（連兩 session 觸發,需建立 checklist）

**相關**：L068（塔台 ops 邊界）

---

## L074 - 2026-04-19 — Diagnostic logging 自身要驗證寫入路徑

**觸發條件**：BUG-046 期間發現 `bat-scripts.log` 從 6486 bytes → 1570 bytes,先前 entries 全消失

**根因**：BAT app 啟動時某機制清空了診斷 log 檔（推測,未確認）

**影響**：
- 失去歷史對照樣本,需重新累積
- 翻案推論被「日誌看起來沒記錄」誤導（實際是被 truncate）
- T0192/T0193 的儀表設計目標（「BUG-043 再現分析」）被部分削弱

**規則**：
1. Append-only NDJSON log **必須測試 BAT app restart 後是否被 truncate**
2. 寫入失敗 / 檔案被清的情況**必須有 warn 留訊**（至少 stderr）
3. Diagnostic log 的「失敗政策」（never throw / never block）不應掩蓋「日誌本身遺失」的次要問題
4. 累積樣本期間,定期備份 log 檔（如 `bat-scripts.log.YYYY-MM-DD.bak`）

**反模式**：
- ❌ 假設 `appendFileSync` 永遠 append（檔案可能被外部清空）
- ❌ 沒驗證日誌 retention 行為就上儀表

**正模式**：
- ✅ 設計時驗證:啟動 → 寫入 → restart → 寫入 → 確認舊 entries 仍在
- ✅ 加 startup log entry (`{"event":"startup","logFileSize":<bytes>}`),可偵測截斷

**狀態**：🟢 reliable（BUG-046 翻案期間實證）

**相關**：BUG-046（dispatcher silent fail）、T0192/T0193（儀表設計）

---

## L075 - 2026-04-19 — SNI RFC 6066 不接受 IP literal(Node.js tls.connect edge case)

**候選 global**:candidate:global(Node.js 通用行為,但本次在本專案發生)

**情境**:T0202b 將 `MinimalWS.connect` 從 `net.createConnection` 改為 `tls.connect`,依 Electron remote-client.ts 寫法加上 `servername: host`,直接踩 `ERR_INVALID_ARG_VALUE: Setting the TLS ServerName to an IP address is not permitted`。

**根因**:RFC 6066(SNI 規範)明定 servername 必須是 hostname,**不可是 IP literal**(IPv4 / IPv6)。Node.js `tls.connect` 嚴格遵守,傳 IP 會 throw。

**為何 remote-client.ts 沒踩**:用 `new WebSocket(url, ...)` 高階 API,URL parser 會自動偵測 IP hostname 並省略 SNI。直接 `tls.connect` 無此保護。

**修法**:
```javascript
const isIpLiteral = /^[0-9.]+$/.test(host) || host.includes(':')  // IPv4 / IPv6
tls.connect({
  host,
  port,
  rejectUnauthorized: false,
  ...(isIpLiteral ? {} : { servername: host })
})
```

**適用情境**:
- 本專案 dispatcher(localhost `127.0.0.1`)永遠踩 IP literal case
- Tailscale IP `100.x.x.x` 也是 IP literal
- 任何 self-hosted / LAN 用 IP 直連的 client 都會遇到

**搜尋關鍵字**:`ERR_INVALID_ARG_VALUE`、`TLS ServerName`、`SNI IP literal`、`RFC 6066`

**相關**:T0202b(首次踩坑)、GP054(TLS mismatch family)、remote-client.ts 反例(高階 API 免疫)

**晉升條件**:若在另一專案也遇到同錯(Node.js `tls.connect` + IP),升 Global GP

---

## L076 - 2026-04-19 — bat-notify.mjs / bat-terminal.mjs MinimalWS duplication(PLAN-023 候選)

**情境**:BUG-049 修復時發現 `scripts/bat-notify.mjs` 和 `scripts/bat-terminal.mjs` 各自 duplicate 一套 `MinimalWS` class(L246-400,約 150 行),遵循「zero-deps CLI」原則以利單檔運行,但代價是修復時容易漏改姊妹 script(BUG-046 → BUG-049 的模式,耗時 ~7 小時才浮現)。

**現況**:
- 兩個 script 各自獨立維護 MinimalWS
- T0205 已 mirror `bat-terminal.mjs` 的 TLS 修復到 `bat-notify.mjs`
- 短期一致,長期再發生同類 drift 風險仍存在

**PLAN-023 候選**(重構建議,本 session 未開單):
- **方案**:抽出 `scripts/_bat-minimal-ws.mjs` shared module
- **優點**:修復一次全覆蓋,drift 風險歸零
- **缺點**:違反 zero-deps CLI 原則(每個 script 需多一個 import),構建 / bundle 工具需介入(如用 esbuild / rollup 合併成單檔 deliverable)
- **折衷**:在兩個 script 頂部加 marker comment 提醒「此 class 也 copy 在 X.mjs,修改時記得同步」(最低成本,不改架構)

**觸發 PLAN-023 的條件**:
- 第三次發生 sibling drift(未來某次 MinimalWS 改動再次漏改)
- 或:新增第三個 script 也 duplicate 同一 class(擴大 drift 面)

**搜尋關鍵字**:MinimalWS duplication, zero-deps CLI trade-off, sibling script drift

**相關**:GP056(sibling fix 漏修 pattern)、BUG-046 / BUG-049(實證案例)、T0202a / T0202b / T0205(修復鏈)

---

## L077 - 2026-04-19 — PTY input buffer 無法分辨人類 vs Worker(BAT YOLO 架構 trade-off)

**情境**:YOLO 模式下 Worker 透過 `bat-notify.mjs --submit` 寫入塔台 terminal 的 PTY input buffer + 附加 `\r` 觸發自動送出。此機制**本質上無法區分人類 input 與程式化 input**(皆為 byte stream),若使用者正在打字時 Worker 完成,會發生 race condition 強插中斷。

**使用者原始洞察**(第十 session):
> 「bat-notify.mjs 其實是送到 input buffer 然後 \n 應該無法辨別是人類 input 還是 Worker 用程式送出」

**設計 trade-off**:
- ✅ **優點**:Worker 自動化與人類操作對 CLI 端**不可區分**,不需特殊 protocol,bat-notify 實作 trivial
- ❌ **風險**:PTY 是單一 byte stream,無法在塔台端 audit 訊息來源(誰送的?何時送?),依賴 `bat-notify --source` 欄位在 BAT log 層追蹤
- ❌ **Race condition**:使用者打字中 Worker auto-submit → buffer 內容錯亂 + `\r` 觸發送出錯誤字串

**Claude Code CLI 機制限制**:
- 沒有背景 IPC 管道 / side channel
- Hooks 是單向 CLI → 外部,無法 inject 訊息進 conversation
- MCP 是 RPC 工具呼叫,不是 push 訊息
- SessionStart hook 只作用於新 session,對 running session 無效

**四方案評估**(完整內容見 `_report-yolo-pty-race-condition-analysis.md`):
- [A] BAT 前端 input activity detection(中等成本,80-90% race 消除)
- [B] Notification banner(高成本,100% race 消除,但失去 YOLO 精神)
- [C] 雙 PTY 模式(依賴 Anthropic,不可行)
- [D] Simple stdin guard(低成本,60-70% race 消除)

**塔台階段建議**:短期 [D] → 中期 [A] → 長期 [B] 作為 yolo 的友善降級選項。本輪**不開 PLAN**,僅以研究報告存檔。

**觸發開 PLAN 的條件**:
- 實際 race 受害案例發生 ≥1 次
- YOLO dogfood 使用率顯著提升,race 頻率上升
- 使用者主動要求收斂此風險

**相關**:BUG-049(修復後暴露此議題)、PLAN-020(YOLO dogfood)、`_report-yolo-pty-race-condition-analysis.md`(完整研究報告)、GP059(dogfood-driven bug discovery)

---

## L078 - 2026-04-19 — BUG-043 真根因追溯(「Worker YOLO 偶發失效」CLOSED 決策誤判)

**情境**:BUG-043 於第八 session 複測「正常」後 CLOSED,當時歸因為「疑為 BUG-046 副作用誤判」。第十 session 修復 BUG-049(bat-notify TLS 漏修)後追溯發現,BUG-043 的真根因**很可能就是 BUG-049 的早期徵兆**。

**當時決策(第八 session)**:
- 使用者回報「Worker YOLO 偶發失效」
- 複測一次正常 → 塔台標 CLOSED
- 備註:「複測正常,疑前期觀察為 BUG-046 副作用誤判(dispatcher 阻擋 + 手動派發不注入 CT_MODE → banner 缺失)」

**當時忽略的線索**:
- 「正常」複測可能只是 notify 偶然成功送達
- 使用者可能無意間手動觸發(輸入 `T#### 完成`)
- BUG-046 修復期間 dispatcher 層不穩,可能掩蓋了 bat-notify 層的 silent hang

**新事實(第十 session)**:
- T0205 修復前,bat-notify 100% silent hang(log 只有 invoke + parsed,無 send/exit)
- BUG-046 CLOSED 後(T0202b 解鎖 dispatcher),BUG-049 症狀應該 100% 重現,但仍標為「已 CLOSED」
- BUG-043 CLOSED 決策**錯誤**:真根因未確認,bug 從未被真正修復

**教訓**(呼應 GP058「偶發症狀不應快速 CLOSED」):
1. 「偶發」bug 複測「正常」只是**觸發到另一條成功路徑**,不等於根因消除
2. 類似 BUG 重複浮現時,**主動回頭追溯歷史 CLOSED** 是否為同根因
3. CLOSED 決策應附根因證據,不只是「這次沒事」

**本 L 不改 BUG-043 狀態**(已 CLOSED 保留歷史紀錄),但本 L 作為「決策追溯」存檔,提醒未來遇到類似症狀時避免重蹈覆轍。

**相關**:GP058(偶發症狀不等於根因消除)、BUG-043(已 CLOSED 誤判案例)、BUG-049(真根因)、第八 session 紀錄

---

## L079 - 2026-04-19 — FileTree useEffect deps race 模式(本專案易再出現)

**模式**(`src/components/FileTree.tsx:77-91` 修復前狀態):
```ts
useEffect(() => {
  if (!entry.isDirectory || !expanded || children !== null || loading) return  // ← guard 含 loading
  let cancelled = false
  setLoading(true)              // ← effect 內部 setState 自身 dep
  asyncWork().then(...).catch(...)
  return () => { cancelled = true }
}, [..., loading])               // ← loading 在 deps
```

**race window**:
1. `setLoading(true)` → state 變 → deps 變 → effect 重跑
2. 重跑時 cleanup 執行 → `cancelled = true`
3. guard `loading===true` early return,真正 work 不再執行
4. async resolve 時 cancelled 為 true → skip 所有 setState
5. 結果:loading 永遠卡 true,UI 顯示 `...` 永久 stuck

**修復**(T0213 Option A,commit `f839dc0`):
- 從 deps 移除 `loading`
- 從 guard 移除 `loading`
- `children !== null` 已負責「成功後不重抓」
- collapse → re-expand 由 cleanup `cancelled=true` 處理 stale promise
- duplicate dispatch 不會發生(因 expanded 才會進)

**本專案易再出現的場景**:
- 任何 controlled async load 元件(autocomplete / 樹狀結構 / 無限滾動 / 圖片預載)
- 任何 `setLoading(true)` + deps 含 `loading` 的組合

**檢查清單**(寫此類 hook 時必過):
- [ ] `loading`(或同類 self-set state)是否在 deps?
- [ ] guard 條件是否依賴 self-set state?
- [ ] 二者其一存在 → 改用 ref 或從 deps/guard 移除

**AI 驗收限制**:此類 race 純 code walk 看不出來,需 runtime smoke test 或 React Testing Library 跑 effect cycle。

**相關**:T0207(引入 race 的 commit)、T0208(AI 驗收漏抓,觸發 GP060)、T0213(修復 commit)、GP060(AI 驗收 runtime 限制)

---

## L080 - 2026-04-19 — 塔台 YOLO 模式派發確認債

**問題**:
塔台 `auto-session: yolo` 配置下,使用者明確選擇 A/B/C 後(例如「派研究工單」、「修 Option A」),塔台仍習慣性顯示派發 panel + 問「派發?[A/B/C]」,造成**重複確認債**。

**違反 YOLO 語意**:
- yolo = 「Worker 自動送出 + 塔台自主決策下一張」
- 使用者已給方向 = 決策已成立,塔台應直接執行
- 重複確認 = 塔台退回 ask 模式行為,變相變回非 yolo 工作流

**正確邏輯**:
| 節點 | YOLO 行為 |
|------|---------|
| 需求對齊 | 問(必要,YOLO 不跳過對齊) |
| Q1/Q2/Q3/Q4 設計選擇 | 問(待決策節點) |
| 風險決策(刪檔、force push) | 問(safety) |
| 已決策後的執行(派發、commit、sync) | **直接做,不問** |

**錯誤示例**(本 session 觸發):
```
使用者:「C(派研究工單)」
塔台:「派發?[A] 執行 / [B] 只顯示 / [C] 微調」  ← 多餘
```

**正確示例**:
```
使用者:「C」
塔台:[直接執行 dispatch,顯示結果]
```

**檢查時機**:
- 每次塔台準備出 [A/B/C] 選項時,自問:「使用者剛剛是否已給方向?」
- 是 → 跳過確認,直接執行
- 否 → 才出選項

**相關**:GP061(塔台主動性)、本 session 修正紀錄

---

## L081 - 2026-04-19 — BUG-047 三 session 連環解 → 萃取 GP065/GP066/GP042 UPDATE

**觸發**:第十六 session BUG-047 smoke pass + BUG-051/052 雙 CLOSED 後執行 `*evolve`,三連環全綠觸發學習萃取。

**萃取來源**:
- 第十四 session:T0219(PLAN-021 UX,非 BUG-047 直接相關但鋪路)
- 第十五 session:T0220 research(3 min)→ T0221 fix(5 min)
- 第十六 session:T0222 research(3 min,破紀錄)→ T0223 fix(4 min)

**萃取三條 pattern(均分流到 Layer 2 global)**:

1. **GP065** — Worker 從套件源碼挖跨環境 ground truth(擴展 GP054)
   - 實例:T0222 讀 `install.cjs:174-178` 證實 `claude.exe` 跨平台檔名,省 macOS/Linux 實機驗
   - 價值:research 壓縮下限破 ~7-13x

2. **GP066** — T 修復連擊(分層拆解 vs 單張大工單)
   - 實例:BUG-047 root → T0221 修 A 面 → T0222 挖 B 面(BUG-052) → T0223 合併修
   - 價值:分層比單張大工單快 6-8x,單張失敗可 Renew 不影響其他層

3. **GP042 UPDATE** — Worker time 連 42+ hit,升 Skill 條件全達
   - 覆蓋:13+ 工單類型 / 5+ session / research + code fix 雙面穩固
   - 下一步:`/ct-evolve --skill worker-time-estimation` 建議下 session 執行

**候選晉升**:✅ 三條均已晉升 Layer 2(`~/.claude/control-tower-data/learnings/patterns.md`),本條為紀錄 pointer。

**相關**:GP065 / GP066 / GP042 UPDATE(Layer 2)、BUG-047/051/052(本專案 tracker)、T0220-T0223(本專案工單)

---

## L082 - 2026-04-20 — 塔台狀態欄位必須嚴格遵守 state machine,不自創語意詞彙

**觸發情境**:
第十六 session *rescan 時,塔台標 T0197 狀態為「🗑️ SUPERSEDED」以表達「被後續工單鏈取代」。使用者立即回報:**CT panel UI 顯示為 Pending**,非預期。

**根因**:
CT panel(`src/types/workorder*`、parser)只認 state machine 中的 standard states:
- 工單:📋 TODO / 🔄 IN_PROGRESS / 👀 REVIEW / ✅ DONE / ⚠️ PARTIAL / ❌ FAILED / ❌ BLOCKED / ⏸ PAUSED / 🔥 URGENT
- BUG:📂 OPEN / 🔧 FIXING / ✅ FIXED / 🧪 VERIFY / 🚫 CLOSED / ⛔ WONTFIX
- PLAN:💡 IDEA / 📋 PLANNED / 🔄 IN_PROGRESS / ✅ DONE / 🚫 DROPPED
- EXP:🧪 EXPLORING / 📊 CONCLUDED / 🚫 ABANDONED

未知狀態(如 SUPERSEDED / DEPRECATED / OBSOLETE / MERGED)→ parser fallback → UI 顯示錯誤(Pending/Unknown),**tracker 同步也會出錯**。

**反模式**:
塔台為表達更精確的情境(「被取代」「合併到其他工單」「過期作廢」),自創新 state 值

**正確做法**:
- 用 standard state(工單→ DONE / FAILED;BUG → CLOSED / WONTFIX)
- 在狀態欄的**備註括號**內說明特殊情境
- 範例:`✅ DONE(純研究交付,無 commit;被 T0198-T0223 鏈取代)` ← T0197 修正後格式

**檢查清單**(修改任何 T / BUG / PLAN / EXP 狀態前):
1. ❓ 這個 state 值在 `_local-rules.md` 或 SKILL.md state machine 裡嗎?
2. ❓ 若不在 → 改用最接近的 standard state + 備註
3. ❓ 若真有需求新增 state → 先更新 state machine + CT panel parser(不只改工單)

**相關**:
- CT panel state machine 規格:`src/types/*-tracker.ts` 的 `sectionToStatus` / state mapping
- 本專案 local-rules.md「擴充單據類型」段落(state 流)
- Core skill SKILL.md「狀態符號與流轉」段落

**候選晉升**:✅ candidate: global(所有專案的 CT panel parser 都可能有同問題,pattern 通用)

**來源**:第十六 session T0197 rescan 升級操作,使用者即時回報 UI 不符預期(2026-04-20)

---

## L083 - 2026-04-20 — 工單建議 flag 與實際派發 flag 不一致(yolo dogfood 三連觀察)

**觸發情境**:
PLAN-025 yolo 三連擊(T0225/T0226/T0227)期間,Worker 在工單「建議派發指令」區塊給出一組 flag(例如 `--mode on`),但塔台實際派發時依據 session 的 `auto-session: yolo` 覆蓋成 `--mode yolo`。三次連續發生,使用者需跨 session context 才能察覺。

**根因**:
Worker skill 的建議組態來源為工單本身(靜態),塔台派發時讀 session/project config(動態)。兩者不同步,Worker 無從得知塔台會覆寫哪些 flag。

**反模式**:
- Worker 撰寫建議派發指令時硬編 `--mode X`,未加「實際以塔台 config 為準」提示
- 塔台派發時未在面板顯示「建議 vs 實際」差異

**正確做法**(本專案 dogfood 結論):
1. Worker 建議區塊前綴「若 session 無覆寫則:」
2. 塔台派發面板加一行「flag diff」(建議 vs 實際),不一致時高亮
3. 若差異屬預期(yolo 覆寫 on)→ 無行動;若意外(使用者手動 `--mode off` 但塔台仍送 yolo)→ 暫停並詢問

**觀察 hit 次數**:3(T0225/T0226/T0227 連續三張 yolo 工單)

**相關**:
- `~/.claude/skills/control-tower/references/auto-session.md` § Mode 與互動旗標協定
- GP063 IPC boundary 注入(概念類比:Worker 撰寫時不假設塔台決策邏輯)

**候選晉升**:🟡 candidate: global(若其他使用 worker skill 的專案也出現 flag drift,再晉升)

**來源**:better-agent-terminal PLAN-025 yolo 三連擊 dogfood(2026-04-20 本 session)

---

## L089 - 2026-04-22 — 跨專案 DELEGATE 連續派發,本端塔台角色降為追蹤中心

**觸發情境**:
第十八 session 中,CT-T009(v4.3.3)→ CT-T010(v4.4.x meta-PLAN)連續兩張跨專案 DELEGATE 工單派發到 BMad-Guide。本端(BAT)塔台的角色從「執行主體」降格為「追蹤中心 + 回填站」,後續實際工作(主 PLAN 拆解 / Phase 工單派發 / Worker 進度追蹤)由對端 repo 塔台接手。

**模式(本輪觀察)**:
- 本端只保留 `_cross-references.md` + 對端 commit hash 追蹤表
- 不複製對端 PLAN 或工單內容到本地(避免雙端 drift)
- 本地 PLAN(如 PLAN-028)定位為「dogfood 驗證追蹤」,不試圖主導
- 等對端回報主 PLAN 編號後,才回填本地追蹤 PLAN 與 `_cross-references.md`
- 本 session 在派完 CT-T010 後即告結束(BAT 任務完成分界線清晰)

**反模式**(未發生但須警惕):
- 本端塔台複製對端 PLAN 進度到本地 state(雙端同步成本爆)
- 本端 consumer 自己開 fork 實作 skill 改動(等同 consumer 變 skill 維護者,drift 災難)

**相關**:
- GP072(本 session 萃取的 Global pattern — 三層驗證分工)
- `_cross-references.md` 首建(2026-04-22)
- L088 ⭐ / GP070 ⭐ devcontainer drift 根因教訓(同系列:分工邊界模糊 → drift)

**候選晉升**:🟡 candidate: global(本模式還在驗證,等 CT-T010 → Phase 1-4 整個迴圈跑完再評估升 GP)

**來源**:better-agent-terminal 第十八 session CT-T009/T010 連續 DELEGATE(2026-04-22)

---

## L090 - 2026-04-22 — BAT 專案:preload + electron.d.ts 必須同步維護

**類型**:Project pattern(BAT 特有架構)
**觸發**:Electron 加新 IPC API 時

**問題**:
- T0230 Worker 加 `claude:detectRuntime` IPC + preload bridge,**漏補** `src/types/electron.d.ts`
- T0232 Worker 實作 UI 呼叫該 API 時 tsc 報 `TS2339: Property detectRuntime does not exist`
- 必須就地補 d.ts 宣告才能推進

**正確模式**(BAT 加新 `window.electronAPI.xxx.yyy` 時的三檔同步):
1. **`electron/main.ts`**:`registerHandler(channel, async (ctx, ...args) => ...)` 實作
2. **`electron/preload.ts`**:`xxx: { yyy: (args) => ipcRenderer.invoke(channel, args) }` bridge
3. **`src/types/electron.d.ts`**:對應 TypeScript interface 宣告

**反模式**:
- 只改 preload,沒補 d.ts(tsc 會爆,但 Worker 可能沒跑 tsc 就交)
- 先改 d.ts,沒實作 main handler(runtime call 會失敗但 compile 過)

**檢查 checklist**:
- [ ] main.ts handler 註冊
- [ ] preload.ts bridge(`window.electronAPI.xxx.yyy`)
- [ ] electron.d.ts type 宣告
- [ ] `npx tsc --noEmit` 綠

**來源**:
- T0230 Worker 漏補 → T0232 Worker 發現 → T0235/T0234 沒再犯
- 2026-04-22 PLAN-027 Phase 1

**候選晉升**:本規則限 BAT 專案(electron + preload 分離架構),不升 Global

---

## L091 - 2026-04-22 — BAT Worker 實作效率係數:research R5 估 ÷ 實際 ≈ 4-5x

**類型**:Project observation
**觸發**:Research 類工單交付 R5 拆單估時後,計算 Phase 實作工單效率

**觀察**(2026-04-22 PLAN-027 Phase 1):

| # | R5 估 | 實際 | 倍率 |
|---|------|------|------|
| T0230 | 60 min | 4 min | 15x |
| T0231 | 45 min | 10 min | 4.5x |
| T0232 | 60 min | 14 min | 4.3x |
| T0233 | 45 min | 15 min | 3x |
| T0235 hotfix | 45 min | 11 min | 4.1x |
| T0234 | 30 min | 9 min | 3.3x |
| **合計** | **285 min** | **63 min** | **~4.5x** |

**解釋**:
- Research(T0229)把 scope 拆得很細,Worker 不需再判斷架構問題
- Worker 可直接引用研究報告的具體 regex / API / decision tree
- yolo 模式省去來回確認時間
- 型別 + IPC 框架已在前一張工單 freeze,後續工單 plug-in 即可

**應用**:
- R5 估時**不修正**(保留保守估計給排程用)
- 心理上可知道 **Phase 1 實際 1-2 小時可收**,不用卡整天
- 若某張工單實際 > 估的 1x(不打折),可能需要 Renew 或檢查 scope

**反模式**:
- 用實際時間重估下個 Phase → 造成排程緊繃
- 誤認 Worker 能力無限 → scope 失控

**來源**:2026-04-22 PLAN-027 Phase 1 全程量測(本 session)

**候選晉升**:本規則限 BAT + PLAN-027 這類「Research 先行 + 明確 R5 拆單」模式,不升 Global(其他專案 workflow 可能不同)


---

## L092 - 2026-04-23 — Worker Step 合併/跳過決策的合理條件(對照 D062)

**觸發條件**:Worker 收到多 Step 工單,主動合併或跳過某 Step
**規則**:對照 D062「Worker 無狀態原則」,Worker 合併/跳過 Step 合理的條件:
- 有明確外部約束(如 VSCode 單例鎖、OS 層檔案鎖定)使獨立 Step 無法執行
- 合併後產出符合原 Step 驗收標準
- 回報區明確記錄「跳過/合併理由」讓塔台可審查

**案例**:T0242 Worker SKIP Step 2 + 合併 Path A→B,理由為 VSCode 單例鎖阻止獨立測試 dir/ mode;塔台事後認可
**反模式**:Worker 為省時間合併 Step 但未記錄理由,塔台無從審查
**候選晉升**:🏠 Project(本規則與 BAT 的 Worker 風格強相關,跨專案 Worker 行為可能不同)

---

## L093 - 2026-04-23 — BAT 打包版啟動失敗 zombie 進程殘留

**觸發條件**:BAT(或類似 Electron multi-window)打包版啟動崩潰後重試
**症狀**:Task Manager 殘留 3 個 `BetterAgentTerminal.exe` 進程(主程序 + 2 個 child windows),uninstall 前未清除會導致新版安裝時檔案鎖定
**對策**:
- Windows NSIS installer uninstall 前**強制 `Stop-Process`** 所有相關進程
- 或在 installer 加 `!define FILESMUSTMATCH` + kill logic
- 使用者 workaround:Task Manager 手動結束所有 `BetterAgentTerminal.exe` 再跑 installer
**候選晉升**:🏠 Project(BAT 專屬,其他 Electron app 進程名不同)

---

## L094 - 2026-04-23 — 研究工單 Worker 不總需要觸發使用者互動

**觸發條件**:研究型工單標 `intervention_type: context-dependent` + `互動模式: enabled`
**規則**:`context-dependent` 是**允許**互動而非**強制**互動。若 Worker 判斷純靜態分析(讀檔 + grep)已可收斂到單一根因,應直接完成不需提問。
**案例**:BUG-058 T0246(7 分鐘,0 互動)純靜態分析定根因 — 讀 `package.json` build.extraResources + grep `import` statement + 比對 filter glob,三步收斂到「filter 漏列 `_bat-*.mjs`」;推薦方案 A + 預防建議一次到位
**反模式**:Worker 機械地問「$BAT_HELPER_DIR 路徑?」之類可自行推斷的問題,增加使用者打擾
**塔台學到**:寫研究工單時指引要包含「若能靜態收斂則不需提問」,避免 Worker 過度保守
**候選晉升**:🏠 Project(本觀察對應本專案 Worker 風格與塔台寫工單習慣,其他專案 Worker 行為可能不同)

---

## L095 - 2026-04-23 — Packaging regression 的 4-workorder hotfix pattern 候選

**觸發條件**:packaged runtime 出現缺檔 / 漏打包 / 路徑錯誤類 regression,已有 release 版本出事
**pattern 草稿**(4 張工單鏈路):
1. **研究工單**(`research` + `context-dependent`):靜態分析 build config + import graph + 歷史先例比對 → 定根因 + 推薦修復方案 + 預防建議
2. **修復工單**(`execution` + `fire-and-forget`):按研究結論做最小補丁 + 本機 `build:dir` 快速驗證
3. **預防工單**(`execution` + `fire-and-forget`):新增 build-time static check 防同類 regression 復發
4. **Release 工單**(`execution` + `fire-and-forget`):本地 CHANGELOG + bump + commit,push/tag 留給使用者手動觸發 CI

**時間證據**(session 24 實測):
- T0246 研究 7 分鐘
- T0247 修 10 分鐘(含 build:dir)
- T0248 預防 60 分鐘(含 CLAUDE.md 文件)
- T0249 release 6 分鐘
- 總計 ~1.5 小時 從發現 BUG 到本地 commit ready

**當前狀態**:1 次觀察(BUG-058),候選 playbook 化
**晉升條件**:累積 2-3 次類似 packaging regression 驗證相同鏈路 → `*evolve --playbook` 升 `_playbooks/packaging-regression-hotfix.md`
**候選晉升**:🏠 Project(BAT 特有 release 流程與硬規則「塔台不 push」);若跨專案 3 次驗證 → Global

---

## L096 - 2026-04-23 — VSCode 同開鎖 electron-builder asar(本機 build 環境 gotcha)

**觸發條件**:Windows 本機跑 `npm run build:dir` / `build` / `build:release`,同時 VSCode workspace 開在專案根
**症狀**:electron-builder 清舊 `release/win-unpacked/` 失敗 — `app.asar` 報 `The process cannot access the file because it is being used by another process`(Access Denied)
**根因推測**:VSCode 的 file watcher / Indexer / 背景 linter 掃 167 MB asar 時持 file handle 不放
**解法**:
- **最簡單**:build 前關 VSCode(或 Git Bash 跑 `code --reload-window` 先關掉 watcher)
- **繞過**:`npx electron-builder --dir --config.directories.output=release-<tag>` 換新 output dir
- **根治**:加 `release/` 到 VSCode `files.watcherExclude` + `search.exclude`(可 project 設定)
**不適用場景**:GitHub Actions CI 無此問題 — 不開 VSCode,走乾淨 runner
**候選晉升**:🏠 Project(Windows + BAT + VSCode 三件組特有)
**相關**:PLAN-013(已 DROPPED,scope 不同但起源相同)、Session 24 T0247 Worker 遭遇實錄

---

## L100 - 2026-04-25 — Install hook + auto-update 同根因模式(BAT embedded claude SDK 專屬)

**觸發條件**:dev 環境出現 `<binary>.old.<ts>` 殘留 + packaged 環境出現 binary missing 兩類觀測同時或先後出現

**模式描述**:
BAT 內嵌 `@anthropic-ai/claude-code` SDK 作為 default agent runtime。該 SDK 行為:
- **dev 環境(npm install 階段)**:install hook 走 update flow,把 `node_modules/@anthropic-ai/claude-code/bin/claude.exe` rename 成 `claude.exe.old.<ts>`,然後 `npm install -g` 到使用者 npm prefix
- **packaged 環境(BAT runtime spawn)**:auto-update flow 走相同邏輯,把 `app.asar.unpacked/.../bin/claude.exe` rename 成 `.old.<ts>`,然後安裝到使用者 npm prefix(不在 BAT 路徑)
- **共同根因**:embedded claude CLI 在所有環境皆走 update flow,rename + 重新安裝到固定 npm prefix path

**反例(分頭調查的浪費)**:
- BUG-055(2026-04-23):dev `claude.exe.old.<ts>` 殘留,當時誤判為 install hook 小瑕疵 → WONTFIX
- BUG-059(2026-04-25):packaged `claude.exe` missing 導致 worker session 整條鏈路斷 → 起初當作獨立 packaged regression 調查
- T0250 反組譯後發現:**兩者同根因**,都是 update flow 觸發 binary rename + npm-global 安裝

**正確模式**:當 BAT 出現「dev 殘留 + packaged regression」雙報告時:
1. **第一反應**:cross-ref 檢查兩條 BUG 是否同根因,不要拆 2 個獨立 BUG 並行修
2. **研究方法**:T0250 反組譯模式,讀 SDK source code 找 update flow(對照 GP092)
3. **修復方法**:spawn env flag 注入(對照 GP094,T0251 `DISABLE_AUTOUPDATER=1`)
4. **驗證方法**:dev `npm install` 後檢查 `.old.*` 殘留 + packaged spawn 後檢查 binary 完整性,**兩端同步驗證**

**為什麼這是 Project 而非 Global**:
- BAT 同時管理 dev runtime + packaged runtime + embedded SDK 三件組,結構特殊
- 一般專案只面對單一 runtime 場景(dev OR packaged),不會碰到雙端同根因
- 套件名稱 `@anthropic-ai/claude-code` 是 BAT 專屬依賴

**通則的部分(已晉升 Global)**:
- GP092(反組譯研究):本 L100 的研究方法
- GP093(WONTFIX reopen trigger):BUG-055 的反例教訓
- GP094(spawn env flag):本 L100 的修復方法

**相關**:
- D086 / D087 / D088(session 25 三條決策)
- BUG-055 / BUG-059(同根因雙閉環)
- T0250 / T0251(研究 → 修復鏈)
- GP092 / GP093 / GP094(本輪同 session 萃取的通則)

**狀態**:🟢 reliable(本 session 同時跨 dev + packaged 兩端驗證,T0251 commit `426d6fc` AC1-5 全綠)

---

## L101 - 2026-04-25 — YOLO + interactive enabled 但零互動的邊界判斷力（BAT 客製合併場景）

**情境**：T0258 工單元資料 `互動模式: enabled`，本意是給 ClaudeAgentPanel.tsx 重客製的 cherry-pick 手併「保留詢問空間」（BAT_BUILTIN_MODELS / MODEL_PRICING / worker / supervisor 等客製）。

**結果**：Worker 全程零互動完成 4 個 cherry-pick（含 #6 empty / #7 conflict 解 / #8 auto-merge），所有決策點都自主處理。

**Worker 自主決策點清單**：
1. #6 empty commit 是否保留 → 看到 BAT 已抽 fn `chat-markdown.ts` 套同等修復 → 採 empty + trailer 路線
2. #7 `autoCompactWindow` 兩行如何處理 → grep BAT `setModel` 簽名確認不含此參數 → 丟棄
3. #5 ClaudeAgentPanel/CodexAgentPanel 採 ours / theirs → 看到 stage 1/2/3 + working tree 比對得到「使用者已採 ours」線索 → 沿用
4. #8 fork-session abort flow → git auto-merge 無 conflict → 直接 commit

**收穫**：
- `interactive enabled` ≠ 「Worker 必須問」，是「給 Worker 詢問權」
- Worker 邊界判斷力的觸發條件：**決策點是否有可從 repo 內挖出的明確線索**
  - 有線索（grep / git history / 既有抽 fn / 簽名變動）→ 自主處理
  - 無線索 / 多種合理解 → 觸發互動詢問
- ClaudeAgentPanel 重客製不等於「逢改必問」— 客製欄位 vs 行為修復可分流

**對 BAT 工單派發的啟示**：
- 重客製檔的 cherry-pick 不必預設互動 enabled，可先試 disabled fire-and-forget
- 若 Worker 回報 BLOCKED 或 Renew → 那次再升 enabled
- 此模式可省下 ~10-15 min/工單的「等使用者回應」wall time

**反例邊界**（何時 enabled 真的需要）：
- 客製欄位 vs upstream 行為修復**直接衝突**且雙方都有合理理由
- 客製功能的測試不存在 → 改了不知道有沒有破

**證據**：
- T0258（2026-04-25）：4 個 cherry-pick + version.json + 母工單收尾，wall ~20 min（vs 估 40-60 min），零互動，零 Renew

**狀態**：🟢 reliable（本專案場景重複觀察 2 次 — T0254 + T0258）

**相關**：
- L094（研究工單 Worker 不總需要觸發使用者互動）：本 L 是 implementation 工單版本
- GP084（研究型工單神速交付三要素）

---

## L102 - 2026-04-25 — Verification 工單必須明示 build 層級（compile / full / packaged）

**情境**：T0259 工單頭寫 `npm run build`，但 BAT 的 `npm run build` 完整鏈是 `verify-native-modules → verify-helper-bundle → vite build → electron-builder`，最後一步 NSIS installer 打包與「verification 工單不跑 packaged installer」精神衝突，且 wall time 估計 5-10 min 不足以跑完 electron-builder。

**Worker 折衷**：自行改跑 `npm run compile`（= vite build 4 entries）。AC1 字面未通過但精神上達成。

**根因**：BAT 的三層 build chain 有不同成本與目的：
| 層級 | 命令 | wall time | 目的 |
|------|------|----------|------|
| compile | `npm run compile` | ~1-2 min | TS / vite 編譯級驗證（無 native build 確認） |
| full | `npm run build` | ~5-8 min | + native modules / helper bundle 靜態驗證 |
| packaged | `npm run build` 全鏈 | ~10-15 min | + electron-builder NSIS 實機可裝 |

**對工單模板的修正**：
- Verification 工單 AC 必須明示「驗收哪一層」
  - 例：`AC1: vite compile exit 0`（layer = compile）
  - 例：`AC1: full build chain exit 0（含 verify-native）`（layer = full）
  - 例：`AC1: packaged installer 可裝（NSIS 重裝測試）`（layer = packaged）
- Wall time 預估必須對齊指定層級
- 嚴格禁止段必須對齊（compile 層不跑 dev server，full 層不跑 NSIS 等）

**對塔台派發的啟示**：
- cherry-pick / 純 source 改動 → compile 層驗收即可
- native module / packaging 配置變動 → full 層
- release 前最終驗收 → packaged 層（必須跑完 NSIS 實機重裝，BUG-058 教訓）

**Worker 折衷處理範例**（T0259）：
1. 觀察工單命令與精神衝突 → 不盲跑
2. 折衷選擇 + 明確標註「採用偏離」段落
3. 回報塔台「若堅持 full / packaged，請另派工單跑」

**證據**：
- T0259（2026-04-25）：採折衷跑 compile 層通過，明確列出偏離原因 + 替代命令選項

**狀態**：🟡 candidate（首次觀察，需在 release / hotfix 場景再次驗證模板對齊）

**相關**：
- GP097（Verification 工單必跑 baseline diff 校驗）：本 L 是 build 層級維度的補充
- L095（Packaging regression 的 4-workorder hotfix pattern）：對應 packaged 層 verification

---

### L-cand-098: Worker bundle/layout 策略授權邊界（candidate: global）

**情境**：派 PLAN-007 Phase 1 工單時，spec doc 在某些技術選擇上故意留 2-3 個選項供 Worker 自決：
- T0270：channel set 名稱以 codebase 實際為準（spec 列表是建議）
- T0271：native rebuild「複製 host / 在 worker 重 build / 環境變數降級」三選一
- T0272：bundle layout 「A: esbuild entry / B: bat-server.mjs CLI」二選一

**觀察**：3 樣本 Worker 全部能：
1. 拿到「[A]/[B]/理由」表格後自決
2. 在回報區明確勾選 + 解釋理由
3. 選擇結果都合理（後續工單可順利接力）

**塔台行動**：
- 工單模板加「Worker 自決區段」格式：選項清單 + 必填理由
- 派工 spec 凍結但留 2-3 個技術選項是「合理 scope」而非「規格不完整」
- 反例：超過 3 個選項或選項間 trade-off 巨大 → 應派研究工單先收斂

**儲存目標**：candidate global（觀察 5+ 樣本後晉升 GP）

**證據**：T0270/T0271/T0272（2026-04-26 session 28）

---

### L-cand-099: Worker 主動補強的容忍邊界（candidate: global，延伸自 session 28 前段觀察）

**情境**：Worker 在執行工單時做出「scope 邊緣補強」或「為 AC 達標的必要前置改動」，塔台應容忍。

**樣本**（session 28，5 樣本）：
- T0268：補 IPC type 同步、ProfileManager.update setter 擴 8、多寫 4 tests（**容忍**：邊緣補強）
- T0270：channel set 校正（fs:changed 字串非物件、workspace:* 排除）（**容忍**：codebase 對齊）
- T0271：移除 Windows claude.exe 改 wrapper（278→124 MB）（**容忍**：bundle 體積優化符合 spec 精神）
- T0272：secrets.ts/remote-server.ts/certificate.ts 三檔擴 plain-Node 相容（**容忍**：AC 達標的必要前置）

**邊界**：
- ✅ scope 邊緣補強（type 同步、setter 補齊、額外 test）
- ✅ codebase 校正（channel name、file path 對齊實際）
- ✅ AC 達標的必要前置（既有檔擴 compat 才能讓新檔跑起來）
- ✅ 符合 spec 精神的優化（bundle 體積、命名修正）
- ❌ scope 外新功能（spec 沒提的新 interface / 新檔案 / 新依賴）
- ❌ 重寫既有 class（即使 Worker 認為設計不好）

**塔台行動**：
- 收到「主動超出範圍項」回報時，先比對是否落在容忍邊界內
- 若符合 → 收下不問
- 若超出 → 在 _learnings 記錄並考慮補開後續工單評估
- 預期所有 PLAN-007 後續工單都會有「主動補強」項，視為常態

**儲存目標**：candidate global（5 樣本一致，觀察跨 PLAN 後晉升 GP）

**證據**：T0268-T0272（2026-04-26 session 28）

---

### L-cand-100: Phase 收尾觸發 *evolve 是天然檢查點（candidate: global）

**情境**：本 session 連續派 5 張 impl 工單後，Phase 1 自然完成。塔台在 Phase 1 → Phase 2 邊界自主暫停，提示「[A] 繼續 / [B] *evolve / [C] 收工」三選項。

**觀察**：
- Phase 邊界 = 5 張工單累積學習已達批次萃取門檻
- 比起每張 *evolve（成本高）或 session 結束才 *evolve（候選散）
- 比起時間切（如「每 90 min 跑一次 *evolve」）
- Phase 邊界是任務語意上的天然斷點，候選量適中、相關度高

**塔台行動**：
- 大型 PLAN 拆 Phase 時，Phase 完成 = 自動觸發 *evolve 提示
- Phase 內每張完成 = YOLO 自動派下一張，不打擾
- Phase 收尾 = 強制詢問 [A]/[B]/[C]

**儲存目標**：candidate global（首次驗證，觀察 3-5 個 PLAN 收尾後晉升）

**證據**：PLAN-007 Phase 1 收尾（2026-04-26 session 28）

**相關**：GP100（YOLO 鏈式派發）— 本 L 是 YOLO 模式的暫停時機補充

---

### L101: BAT remote 改 plain-Node 相容性的 3 個既有檔（project-only）

**情境**：T0272 為了讓 bat-server.mjs 在 plain Node（非 Electron）環境跑起來，對既有 PLAN-018 落地的 3 個檔做 lazy-detect / fallback 擴充。

**修改檔**：
- `electron/remote/secrets.ts`：lazy-detect secret strategy（避免 headless 直接 import `electron` 失敗）
- `electron/remote/remote-server.ts`：補 token rotation / cert renewal / custom certificate provider / plain Node version fallback
- `electron/remote/certificate.ts`：補 `FileCertificateProvider`

**對後續 PLAN-007 工單的影響**：
- 觸碰這三檔的工單預期已有 plain-Node path，不需重新處理
- 觸碰其他 `electron/remote/` 檔案時要注意是否仍有 `electron` hard import

**儲存目標**：project-only（本專案 fact，非 generalizable pattern）

**證據**：T0272 worktree commit `1fbb0bd`（2026-04-26）

---

### L102: PLAN-007 Phase 1 Bundle layout B（project-only）

**決策**：T0272 拍板採 layout B：
- `scripts/bat-server.mjs` 是 CLI entry（含 parseArgs / signal handler / factory call）
- `electron/remote/server-entry.ts` 是薄殼 re-export factory + helper
- `build-server-bundle.mjs` 把 `bat-server.mjs` 放 `staging/bin/` + `server-entry.js`/`headless-entry.js`/`lockfile.js`/`dataDir.js` 放 `staging/electron/remote/`

**對後續 Phase 2/3/4 工單的影響**：
- WSL/Docker/SSH 設定 wizard 透過遠端 spawn `node bin/bat-server.mjs` 啟動 server
- bat-server.mjs 的 flag 介面（`--data-dir` / `--port` / `--bind-interface` / `--token`）是 wizard 與 server 的契約
- 不要改 layout（B 已凍結）

**儲存目標**：project-only

**證據**：T0272 工單 Bundle layout 策略選擇 [x] B（2026-04-26）

---

## L103 - 2026-04-26 — BAT 內部終端 yolo 派發 shell preference 第二張起 fallback bug 模式

**情境**:BAT Settings 指定 shell=git bash + agent=codex cli。塔台用 `bat-terminal.mjs --notify-id ... --workspace ... --mode yolo --no-interactive --agent default --prompt "/ct-exec T####"` 鏈式派發。**第一張正確**(git bash + codex),**第二張起錯誤**(PowerShell + codex)。

**根因**(T0281 確認 H4):`terminal_create` IPC handler 從沒 resolve / pass persisted shell preference,PTY fallback 到 Windows process platform 預設(pwsh)。

**修復**:抽 `electron/shell-path-resolver.ts` 共用模組,`electron/main.ts` 改呼叫此 resolver 統一處理 shell 解析路徑。

**為什麼是 BAT 專屬模式**:
- BAT 的 yolo 派發走「外部 process spawn → 內部 IPC → PTY」鏈
- 第一次 cold start 時某條件成立讓 Settings 路徑被觸發(待後續調查)
- 後續派發走 PTY fallback,bypass Settings 路徑 → 命中 platform 預設

**塔台行動**:
1. **後續若遇「第一次正確、第二次起錯」類症狀**,優先檢查 shell preference / agent resolution / IPC payload 的 fallback path
2. **BAT 內部終端派發工單 AC 必須驗 shell preference**:第一次派發後立刻派第二張驗 shell 正確
3. **Phase 4 派發作為 live regression**:6 連發若全部 git bash → BUG-060 CLOSED

**反例**(不是此模式):
- 一致性錯誤(每次都錯):走「sample 1 vs platform default」路徑
- 偶發錯誤(時對時錯):race condition / timing

**儲存目標**:project-only(BAT 專屬,因為依賴 BAT terminal 架構)

**證據**:
- session 30 T0277(正確)→ T0278/T0279/T0280/T0281 連續 4 張錯誤
- T0281 commit body 標 H4 命中

**相關**:BUG-060 / T0281 / L090(preload + electron.d.ts 同步)

---

## L104 - 2026-04-26 — Bugfix 工單 commit body 必須明列「根因:H<#> + 一句話」

**情境**:T0281 commit body:
```
fix(yolo): BUG-060 apply persisted shell setting to remote worker terminals

工單:T0281
BUG:BUG-060
根因:H4 remote terminal creation never resolved/passed the persisted
shell preference, so PTY fallback defaulted to PowerShell on Windows.
```
後續看 git log 即可一眼追溯,**不需要回看工單檔**。

**塔台行動**:
1. **Bugfix 工單模板新增 AC**:「commit body 含『根因:<證據編號> + 一句話說明』」
2. **多假設工單**(像 T0281 列了 H1-H4):commit body 明列哪個假設命中,prevent 後續 regression 重新驗證所有假設
3. **塔台分析 bug 時假設應編號**(H1/H2/H3...),Worker 修復時 commit body 直接引用編號

**反例**(不適用):
- 純 typo / 格式修復:commit body 不需要 deep root cause 說明
- 自描述強的 commit(`fix: typo in README`):無需額外 root cause

**為何成立**:
- 後續 regression 的 root cause 比對是 git log scan,不是工單檔搜尋
- 工單檔可能被歸檔到冷區,git log 永久保留
- LLM Worker 寫 commit body 邊際成本接近零,Y;高 ROI

**儲存目標**:project-only(可考慮升 Global 但需更多樣本)

**證據**:
- session 30 T0281(2026-04-26 13:20)
- 對比:T0277-T0280 commit body 簡潔(僅工單編號 + 依賴),非 bug-fix 場景

**相關**:GP098(工單 metadata commit gap)/ L101(YOLO 邊界判斷力)

---

## L105 - 2026-04-26 — 塔台 spec 拍板項應寫進第一個落地工單的 commit body

**情境**:PLAN-007 spec L680「image push 到 ghcr.io 或 BAT release(待塔台拍板)」是 RFC open decision。塔台拍板選 [A] 純本機 build 後,T0278 commit body 含:
```
spec § C-1 拍板:v1 本機 only,registry push 標 v2
```
後續 Phase 3 工單(T0279/T0280)看 git log 即可知道此決策已凍結,不重新爭議。

**塔台行動**:
1. **塔台拍板 RFC 後**,在第一個落地工單的 commit body 標「spec § X-Y 拍板:<決定> + 標 vN」
2. **拍板項影響多個後續工單**:在 PLAN 主文件(`PLAN-###-*.md`)同步更新「拍板紀錄」章節
3. **避免 spec 內 open decision 多次重啟**:使用者下次問同樣問題時塔台能引 git log + commit body 證據

**反例**(不適用):
- 微觀技術選擇(命名 / 路徑):commit body 不需要 spec 拍板註記
- 已凍結的 spec(L 而非 RFC):commit body 引 spec 段落即可

**為何成立**:
- spec 內 RFC 通常 100-200 字記錄,塔台拍板後 spec 不一定即時更新(因為要等實作驗證)
- commit body 是「可信時序紀錄」(git log 不可竄改),拍板時間 + 決定 + 標籤 vN 一起寫
- 後續工單看 git log 即可重建決策時序,不需翻 spec history

**儲存目標**:project-only(BAT/PLAN-007 適用,可考慮升 Global)

**證據**:
- session 30 T0278 commit body(2026-04-26 12:25)
- spec § C-1 RFC(L452-457) → T0278 拍板執行
- T0279 / T0280 commit body 引 T0278 為拍板源頭

**相關**:GP002(跨專案功能完成後做一致性 Review)的反面 — prevent 後續再次爭議
