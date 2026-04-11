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

## 記錄格式模板

```
## L<編號> - <日期> — <一句話標題>

**觸發條件**：何時會遇到這個模式
**模式**：觀察到的具體現象或反模式
**數據點**：具體的數字、檔案、案例
**套用時機**：未來什麼情況下應該想起這條學習
**候選晉升**：global / project / 無
```
