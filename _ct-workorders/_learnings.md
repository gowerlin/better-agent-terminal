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

## 記錄格式模板

```
## L<編號> - <日期> — <一句話標題>

**觸發條件**：何時會遇到這個模式
**模式**：觀察到的具體現象或反模式
**數據點**：具體的數字、檔案、案例
**套用時機**：未來什麼情況下應該想起這條學習
**候選晉升**：global / project / 無
```
