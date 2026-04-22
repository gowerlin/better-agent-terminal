# PLAN-027 — Claude Runtime 選擇機制（內嵌 SDK vs 系統 CLI）

| 欄位 | 內容 |
|------|------|
| **狀態** | 📐 PLANNED(T0229 research ✅ DONE,可啟 Phase 1)|
| **優先級** | 🟡 Medium |
| **類型** | 技術改善（可用性 / 維運彈性） |
| **建立時間** | 2026-04-22 |
| **建立者** | Gower |
| **驅動契機** | Claude CLI 更新頻繁（新功能 / bug fix），但 `@anthropic-ai/claude-agent-sdk` interface 相對穩定。內嵌版作為「保底能用」的安全網，使用者若想立即取得新版 CLI 能力應能 opt-in 切換到系統安裝版，不必等 BAT 重新打包。 |
| **關聯** | T0229 research ✅ DONE(commit `b622b6e`)、研究報告 `_report-plan027-claude-runtime-selection.md`(498 行)、CLAUDE.md「Claude Agent SDK / CLI」段、`electron/claude-agent-manager.ts`、`electron/node-resolver.ts`(複用模式) |

---

## 動機 / 背景

目前 BAT 內嵌 `@anthropic-ai/claude-code ^2.1.111`（實際安裝 2.1.113）作為 Agent 執行環境。但：

1. **CLI 迭代快**：Anthropic 幾乎每週 ship 新功能 / bug fix / model 支援（例如 Opus 4.7 + xhigh effort 在 2.1.111 才加入）
2. **SDK interface 穩定**：Agent SDK 的對外介面變動慢，同一介面可對應多個 CLI 版本
3. **重新打包成本高**：升級內嵌版需走 BAT release 流程（build + notarize + 使用者更新 app）
4. **Power user 痛點**：想用 CLI 最新能力的使用者無法「自行更新 claude」即享受

**策略**：內嵌 = 保底能用；opt-in 切系統版 = 立即享受新版能力。

---

## 對齊決議（2026-04-22 需求對齊 Q1-Q7）

| # | 決議 |
|---|------|
| Q1 | 「系統 claude」指 Claude Code CLI（非純 Anthropic API） |
| Q2 | **預設**：內嵌 SDK（保底）；系統版為 opt-in |
| Q3 | **路徑來源**：PATH 自動偵測為主；可在 Settings 覆寫為自訂路徑 |
| Q4 | **Fallback**：系統版不可用時自動 fallback 到內嵌 SDK 並通知使用者 |
| Q5 | **生效時機**：每個新 session 啟動時讀取設定；舊 session 保留原路由 |
| Q6 | **UI 位置**：Advanced 分頁新增「Claude Runtime」區塊 |
| Q7 | **版號顯示**：內嵌版號 + 偵測到的系統版號並列 |

---

## 概念方案

### 架構分流

```
新 Agent session 建立請求
  └─ 讀取 settings.claudeRuntime = 'embedded' | 'system'
       ├─ 'embedded' → 直接走 @anthropic-ai/claude-agent-sdk（現狀）
       └─ 'system'
            ├─ 1. 偵測系統 binary（PATH 搜尋 `claude`，或使用者指定路徑）
            ├─ 2. 驗證可執行（`claude --version` + 版號 parse）
            ├─ 3. 成功 → 以 child_process 模式接上 SDK transport
            └─ 4. 失敗 → fallback 內嵌 + toast 通知使用者
```

### Settings UI（Advanced 分頁 → Claude Runtime 區塊）

```
┌─ Claude Runtime ─────────────────────────────────┐
│ ○ Embedded (bundled)    v2.1.113  [currently used]│
│ ○ System installed                                │
│     Path: [<auto>/auto-detect]  [Browse...]       │
│     Detected version: v2.1.115   ✓ healthy        │
│                                                   │
│ ⓘ System CLI fails? Falls back to embedded + notify│
│ 💡 Install latest: irm https://claude.ai/install.ps1 | iex │
└───────────────────────────────────────────────────┘
```

### 設定 schema

```typescript
interface ClaudeRuntimeSettings {
  mode: 'embedded' | 'system';
  customPath?: string;  // 空表示走 PATH 自動偵測
  lastDetectedVersion?: string;  // 快取偵測結果（啟動時刷新）
}
```

---

## 非目標 / 範圍外

- ❌ 不改變 Agent SDK 本體的介面
- ❌ 不做自動安裝 claude CLI（使用者自行 `irm ... | iex` / `brew install` / `npm i -g`）
- ❌ 不實作「自動升級內嵌版」機制（維持 release 流程）
- ❌ 不做 API 相容性握手（驗證只到版號 parse 為止）
- ❌ 不做多 binary 版本管理（使用者自理 PATH）

---

## 正式拆單（T0229 研究後收斂,2026-04-22）

> 原 7 張 → 收斂為 5 張,總估時 3h 40min(原 4-5h)。依據見 T0229 報告 R5 章節。

| # | 工單主題 | scope 摘要 | 預估工時 | 依賴 |
|---|---------|-----------|---------|------|
| **#1** | 系統 claude 偵測 + 健康檢查 + Settings schema | 新增 `electron/claude-resolver.ts`(R2 PATH 搜尋 + R3 Level B health check)、`ClaudeRuntimeSettings` interface 寫入 SettingsStore、IPC `claude:detectRuntime` channel(main → renderer 回 `{ embeddedVersion, systemVersion, systemPath, healthStatus }`) | 60 min | — |
| **#2** | Runtime routing + fallback + toast | `claude-agent-manager.ts` 三處 spawn 點(`runQuery` / `createSessionV2` / `forkSession`)讀 `settings.claudeRuntime.mode`,若 system 則呼叫 #1 的 resolver 取得路徑;失敗時 fallback `resolveClaudeCodePath()` 並透過 IPC 通知 renderer 顯示 toast | 45 min | #1 |
| **#3** | Settings UI(Advanced 分頁 → Claude Runtime 區塊) | radio button(embedded / system)+ path input + Browse... 按鈕 + version badges + healthy/unhealthy 指示 + hint「Changes apply to new sessions only」 | 60 min | #1, #2 |
| **#4** | 整合測試 + session state spike + 跨平台手動驗證 | (a)單元測試:resolver / health check / version parse;(b)spike:切換 runtime 後 resume 同一 sdkSessionId 是否 OK(R4 陷阱 #4);(c)手動跑 Windows + macOS + Linux 驗證 PATH 偵測、`.cmd` shim 處理、Gatekeeper toast | 45 min | #1-#3 |
| **#5** | 文件更新(CLAUDE.md「Claude Agent SDK / CLI」段補 runtime 切換說明)+ Release note | 寫成使用者導向文件:「為什麼有兩個選項」「什麼時候用 system」「fallback 行為」「常見故障」 | 30 min | #1-#4 |

**總估時:3h 40min wall time。**

### 平行化建議

- **#1 / #2 不可平行**(routing 需要 resolver 介面)
- **#3 可在 #2 進入收尾時平行起跑**(只要 #1 完成、IPC contract 定下來,UI 可獨立寫 mock)
- **#4 / #5 序列執行**

### 關鍵技術決策(來自 T0229)

- **SDK transport**:用官方 `pathToClaudeCodeExecutable` option(已是 BAT 現有模式,改 path 字串即可)
- **版號策略**:Level B(`--version` parse)。regex `/^(\d+\.\d+\.\d+(?:-\w+)?)\s+\(Claude Code\)/`。接受 `>= 2.0.0`、`< 2.1.111` warning、`< 2.0.0` 拒絕
- **Windows shim**:`.cmd`/`.bat` 偵測時優先選 `.exe`(避 Node `.cmd` CVE 行為)
- **Auth/env**:完全繼承 `process.env`,BAT 不介入系統 claude 的 auth chain
- **Session state**:R4 陷阱 #4 未完全敲定,#4 工單實機 spike

---

## 風險 / 未知數

| # | 風險 | 對策 |
|---|------|------|
| R1 | 系統 CLI 版本與 SDK interface 不相容（使用者裝到太舊或太新） | 版號範圍白名單 + 不相容時強制 fallback |
| R2 | Windows PATH 空格 / 中文路徑解析 | research 工單納入驗證 |
| R3 | child_process 模式的 stdio streaming 效能 vs 內嵌 | #1 benchmark |
| R4 | 使用者裝的 claude 有額外環境變數依賴（ANTHROPIC_API_KEY 等） | settings 提供「環境變數透傳」開關（或明示需要手動設） |
| R5 | macOS Gatekeeper 對未簽章 binary 的行為 | 使用者自理，BAT 只做偵測 |

---

## 排程提示

- **當前阻塞**:無(T0230 #1 已 DONE)
- **下一步**:派發 #2 實作工單(Runtime routing + fallback + toast,45 min,依賴 T0230)
- **可平行化**:#3 UI 可在 #2 收尾時起跑(IPC contract 已 freeze 在 T0230)

---

## 回報 / 決議紀錄

### 2026-04-22 第十九 session — T0229 研究完成 + PLAN-027 進入實作

**T0229 ✅ DONE**(12:20,commit `b622b6e`):
- R1-R5 全部可行,核心 routing 僅 1-3 行差別
- 拆單收斂 7 → 5 張,總估時 3h 40min(原 4-5h)
- 報告 `_report-plan027-claude-runtime-selection.md`(498 行)
- 互動 1/3 輪(效率高)

**本輪決議**:依 T0229 R5 建議正式收斂拆單,**準備派發 #1 實作工單**。

### 2026-04-22 12:42 — T0230 (#1) DONE

**T0230 ✅ DONE**(12:38-12:42,4 min,commit `4894b18` + `63a65e6`):
- **9/9 AC 全綠** + bonus AC-9(17 unit tests 全通過)
- 新增 `electron/claude-resolver.ts`(~210 行)+ `tests/claude-resolver.test.ts`
- IPC `claude:detectRuntime` + preload bridge + remote proxy 已加好
- `tsc --noEmit` exit 0

**Worker 自決修正(教訓)**:
- 工單原寫「擴充 `electron/settings-store.ts`」,**實際 settings-store 在 `src/stores/`**(renderer 端,透過 IPC 持久化到 main 的 `settings.json`)
- Worker 自決寫到正確位置:`src/types/index.ts`(interface)+ `src/stores/settings-store.ts`(setter)
- **教訓傳遞給 T0231+**:直接引用 `src/types/index.ts` 的 `ClaudeRuntimeSettings` / `ClaudeRuntimeMode`,別複製到 `electron/`。ClaudeRuntimeSettings 已在 renderer store,electron 側從 IPC 取。

**AC-7 備註**:本專案 `package.json` 無 `lint` script / 無 eslint dep,AC-7 的 lint 部分不適用,僅 `tsc --noEmit` 驗收。T0231+ AC 寫法可直接去掉 lint。

**下一步**:派 T0231(#2 Runtime routing + fallback + toast,45 min)。

---

## 結案紀錄

（DONE 或 DROPPED 時填寫）
