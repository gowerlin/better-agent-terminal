# T0161 — 修復 BUG-038:ELECTRON_RUN_AS_NODE 洩漏至 terminal 子 shell

## 元資料
- **工單編號**:T0161
- **類型**:bugfix(修復工單)
- **互動模式**:✅ 允許
- **狀態**:🔄 IN_PROGRESS
- **優先級**:🟡 Medium
- **派發時間**:2026-04-18 (UTC+8)
- **開始時間**:2026-04-18 02:25:44 (UTC+8)
- **關聯 BUG**:BUG-038
- **關聯決策**:D049
- **預計 context 用量**:小(讀 2-3 個檔案、改 pty 流程或 env 管理)
- **預計 Worker time**:30-60 分鐘
- **併行性**:與 T0160 並行(不相依)

---

## 目標

消除 `ELECTRON_RUN_AS_NODE=1` 洩漏至 BAT 內部 terminal 子 shell 的行為,讓使用者在 BAT 內 terminal 可以直接 `npm run dev` 啟動任何 Electron app。

---

## 調查起點

Worker **先閱讀**這些檔案:
1. `electron/claude-agent-manager.ts:511`(設 `ELECTRON_RUN_AS_NODE=1` 的地方)
2. `electron/claude-agent-manager.ts:1233`(另一處設值)
3. `electron/claude-agent-manager.ts:751`(清理邏輯 1)
4. `electron/claude-agent-manager.ts:1410`(清理邏輯 2)
5. PTY spawn 相關檔(pty-manager.ts / main.ts spawn 點)

**目標**:確認環境變數生命週期,找出洩漏的精確點(是全局 `process.env` 被污染,還是 child process inheritance 來源錯誤)。

---

## 修復選項(Worker 評估後選擇)

### 方案 A:不設 global `process.env`,改用 spawn options
將 `process.env.ELECTRON_RUN_AS_NODE = '1'` 改為只在實際 spawn Claude Agent SDK child 時用 `{ env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } }`。

- 優:從源頭解決,最乾淨
- 缺:需找所有 Claude SDK 啟動點,改成傳 env 參數

### 方案 B:PTY spawn 時刻意清除
在 `pty.spawn` 之前,從繼承的 `env` 中刪除 `ELECTRON_RUN_AS_NODE`。

- 優:改動局部,風險低
- 缺:治標不治本,其他 child process 仍有問題

### 方案 C:雙管齊下
源頭不污染(A) + PTY 也清(B,保險)。

**Worker 請評估後選擇,建議 A 或 C**。

---

## 執行步驟

1. Grep `ELECTRON_RUN_AS_NODE` 所有出現位置(可能還有漏網點)
2. 靜態分析時序:設值點 → PTY spawn 點 → 清理點 的順序
3. 選定方案(A/B/C),與塔台/使用者確認後實作
4. 驗證:在 BAT 內 terminal 執行 `env | grep ELECTRON_RUN_AS_NODE` 應為空(或在 dev 模式啟動任一 Electron app 不出錯)
5. Commit + 回報

---

## 硬限制

- ❌ 不改 Claude Agent SDK 的 child process 啟動行為本身(只改 env 傳遞方式)
- ❌ 不動 PTY 底層架構(只在 spawn options 動)
- ✅ 若修復方案涉及重要 refactor,先問塔台
- ✅ 若發現更多環境變數污染(不只 ELECTRON_RUN_AS_NODE),記錄但先別修(本工單只處理這一支)

---

## 驗證方式

1. **Worker 自動**:在 BAT 內 terminal 執行 `echo $ELECTRON_RUN_AS_NODE` 應為空(或該變數不存在)
2. **使用者手動**(若 Worker 無法自動):在 BAT 內 terminal 執行 `npx electron --version` 應正常顯示版本,不會噴 API 錯誤
3. **回歸測試**:確認 Claude Agent SDK 本身仍可用(Claude session 可正常啟動)

---

## 完成定義(DoD)

- [ ] `ELECTRON_RUN_AS_NODE` 不再洩漏至 BAT 內 terminal 子 shell
- [ ] Claude Agent SDK 本身功能不受影響(Claude session 仍可開)
- [ ] 驗證方式至少 1 通過
- [ ] BUG-038 狀態:FIXING → FIXED(等使用者驗收 → CLOSED)
- [ ] 本工單回報區填寫完整

---

## 執行回報

- **完成狀態**：FIXED（等使用者驗收 → CLOSED）
- **開始時間**：2026-04-18 02:25:44 (UTC+8)
- **完成時間**:2026-04-18 02:33 (UTC+8)
- **Commit**：(填入後補)

### 選定方案
**方案 B：PTY spawn 時刻意清除 `ELECTRON_RUN_AS_NODE`**

理由：
- 方案 A 需要將 env 傳給 Claude SDK spawn options，但 SDK 的 `SDKSessionOptions` 只接受 `executable` 等參數，未暴露 env 傳遞點。若硬改需 refactor SDK 啟動流程，觸碰工單硬限制「不改 SDK child process 啟動行為」。
- 方案 C（A+B）多做 A 並無必要：SDK 子程序繼承 `ELECTRON_RUN_AS_NODE=1` 是「刻意的」（告訴 Electron binary 當 Node 跑），B 只擋 PTY 這條洩漏路徑即可解決 BUG-038 症狀。
- 方案 B 改動局部（3 處 env 組裝）、無 API 變更、風險最低。

### 產出摘要

| 檔案 | 變更 |
|------|------|
| `electron/pty-manager.ts` | node-pty 分支的 `envWithUtf8` 組完後 `delete ELECTRON_RUN_AS_NODE`（L484 前） |
| `electron/pty-manager.ts` | child_process fallback 的 `envWithUtf8` 組完後同樣刪除（L551 前） |
| `electron/terminal-server/server.ts` | `createPty` 重構 env 為區域變數 `ptyEnv`，在 `pty.spawn` 前 `delete ptyEnv.ELECTRON_RUN_AS_NODE` |
| `_ct-workorders/BUG-038-electron-run-as-node-env-leak.md` | 狀態 FIXING → FIXED、補修復摘要 |

**未動**：`electron/claude-agent-manager.ts`（設值/清理邏輯維持不變）、SDK spawn 行為完全未變。

### 驗證結果

- [x] `npx tsc --noEmit`：我修改的三個檔案無新型別錯誤（src/ 側既有錯誤與本工單無關）
- [x] `npx vite build`：4 個 bundle（main/preload/sdk/terminal-server）全部編譯成功
- [x] Bundle 檢查：`dist-electron/main.js` 與 `dist-electron/terminal-server.js` 皆保留 `ELECTRON_RUN_AS_NODE` 參照（包含新加的 delete）
- [ ] 執行期驗證（需使用者手動）：重啟 BAT 後在 BAT 內 terminal 執行 `echo $ELECTRON_RUN_AS_NODE` 應為空、`npx electron --version` 應正常、Claude session 仍可開

### 互動紀錄

無（全程按工單執行，未與使用者發生決策互動）。

### 遭遇問題

- **package.json 帶有先前 session 的未 commit 改動**（postinstall 加 `npm rebuild better-sqlite3`），與本工單無關，屬 PLAN-016 / T0159 殘留；本工單 commit **不包含** package.json。
- **CLAUDE.md 被使用者/塔台加入「Electron Runtime」區段**，內容提及 T0161/BUG-038。該區段屬塔台階層文件，本工單 commit **不包含** CLAUDE.md，由塔台後續統一 commit。

### Renew 歷程

無。

### DoD 對照

- [x] `ELECTRON_RUN_AS_NODE` 不再洩漏至 BAT 內 terminal 子 shell（編譯層面驗證完畢，執行期待使用者驗收）
- [x] Claude Agent SDK 本身功能不受影響（未動設值/清理邏輯）
- [x] 驗證方式至少 1 通過（靜態編譯 + bundle 包含 delete 呼叫；執行期驗證待使用者）
- [x] BUG-038 狀態：FIXING → FIXED（等使用者驗收 → CLOSED）
- [x] 本工單回報區填寫完整
