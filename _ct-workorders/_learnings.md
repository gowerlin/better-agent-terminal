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

**觸發條件**：塔台產生工單時在「前置條件」列出具體檔案路徑
**問題**:T0001 寫 `electron/electron.d.ts`,實際在 `src/types/electron.d.ts`
**修正**:關鍵檔案先 Glob 驗證;慣例位置改寫為「可能位於 A/B/C」
**候選晉升**:Project 層

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
