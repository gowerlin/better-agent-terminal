# PLAN-027 — Claude Runtime 選擇機制（內嵌 SDK vs 系統 CLI）

| 欄位 | 內容 |
|------|------|
| **狀態** | ✅ DONE(2026-04-22 Phase 1 全部完成 — T0230/T0231/T0232/T0233 + T0235 hotfix + T0234 docs,BUG-054/053 CLOSED,使用者驗收通過)|
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

### 2026-04-22 13:04 — T0231 (#2) DONE

**T0231 ✅ DONE**(commit `a767de8`,10 min):
- 新 `electron/claude-runtime-router.ts`(216 行)
- 三處 spawn 改寫(agent-manager L547/L1268/L2222)
- Settings 注入 **方案 A 變體**(讀 `settings.json` 檔,沿用 `sendCompletionNotification` pattern)— 零新 IPC + 零共享狀態
- IPC events `runtime-degraded` / `runtime-warning` + preload bridge + `electron.d.ts` 型別
- 事件去重 `Map<sessionId, Set<type>>`
- 9/9 AC + tsc + vite + test 全綠

### 2026-04-22 13:27 — T0232 (#3) DONE

**T0232 ✅ DONE**(commit `a8b3448`,14 min):
- 新 `ClaudeRuntimeSection.tsx` + `useRuntimeToasts.ts`
- SettingsPanel Advanced tab + App.tsx CtToast 掛載
- i18n 三語完整(en + zh-TW + zh-CN,16 個新 key)
- Browse 沿用既有 `dialog.selectFiles()` IPC
- 修正 T0230 漏掉的 `electron.d.ts` `claude.detectRuntime` 宣告
- 9/9 AC + tsc + vite 9.29s + test 全綠

### 2026-04-22 19:03 — T0233 (#4) DONE + BUG-053 發現

**T0233 ✅ DONE**(commit `307647d9`,15 min active):
- 新 `tests/claude-runtime-router.test.ts` 11 條 T-R1..T-R11,**28 unit tests 全綠**
- Router refactor 加 optional `deps: ResolveClaudeRuntimeDeps`(DI 無需 mock-loader)
- Session state spike **positive (theoretical)** — code-path 論證,未實機驗證(交 Selene 跨平台實測)
- Windows 驗證 4/4 通過(有 caveat)
- **新開 BUG-053**:Windows Node 20+ `.cmd`/`.bat` shim EINVAL(CVE-2024-27980),Low,併 T0235 修
- 產 `docs/plan-027-cross-platform-verification.md`(mac/Linux playbook)

### 2026-04-22 19:50 — T0235 hotfix + BUG-054 發現與修復

**使用者 runtime 驗收發現 BUG-054**:切 system 後開終端 claude-cli preset,版本仍為內嵌版。Root cause — T0229 R4 scope 缺口(只盤 agent-manager,遺漏 main.ts IPC handlers)。

**T0235 ✅ DONE**(commit `058412a`,11 min):
- 修 `main.ts` 三處 handler(`claude:get-cli-path` + 兩個 auth)接 router
- 附修 BUG-053:`WINDOWS_BIN_NAMES = ['claude.exe']`(採 Option A,對齊 native SDK 方向)
- 新增 `broadcastRuntimeEvent` helper(fan-out 所有 BrowserWindow)
- 跨平台 playbook Windows 段重寫(加 anthropic installer 指引)
- 10/10 AC + tsc + vite + test 全綠
- **BUG-054 / BUG-053 使用者驗收通過 → CLOSED**

### 2026-04-22 20:06 — T0234 (#5) DONE,Phase 1 完全閉環

**T0234 ✅ DONE**(commit `58de14c`,9 min):
- CLAUDE.md 新 `Claude Runtime Selection (v2.1.49+)` 子段 40 行
- CHANGELOG.md `[Unreleased] → Added` 寫入條目
- i18n 三語 hint 合併(apply scope + 2.1.111 caveat 一段化)
- 8/8 AC + tsc + vite 2.45s + 28 test 全綠

---

## 結案紀錄

### 2026-04-22 ✅ DONE — PLAN-027 Phase 1 完全閉環

**執行效率**:wall-time 實際 **63 min**,原 R5 估 **255 min**(含 T0229 研究 R5 估 +hotfix T0235 實際估),倍率 **~4x**。

| # | 工單 | 預估 | 實際 | Commit |
|---|------|------|------|--------|
| research T0229 | 45-90 min | ~15 min(12:05-12:20) | `b622b6e` + `df2b685` |
| #1 T0230 | 60 min | 4 min | `4894b18` + `63a65e6` |
| #2 T0231 | 45 min | 10 min | `a767de8` |
| #3 T0232 | 60 min | 14 min | `a8b3448` |
| #4 T0233 | 45 min | 15 min | `307647d9` |
| **hotfix T0235** | 45 min | 11 min | `058412a` |
| **docs T0234** | 30 min | 9 min | `58de14c` |

**最終產出**:
- **程式碼**:`claude-resolver.ts`(~210 行)+ `claude-runtime-router.ts`(216 行)+ `ClaudeRuntimeSection.tsx` + `useRuntimeToasts.ts` + 4 處 spawn 點改寫(agent-manager 三處 + main.ts `get-cli-path`)+ 兩個 auth handler 改寫
- **測試**:28 unit tests(17 resolver + 11 router)+ `tests/_windows-probe.ts` 手動 probe
- **文件**:CLAUDE.md 新段 40 行 + CHANGELOG 條目 + `docs/plan-027-cross-platform-verification.md`(mac/Linux playbook)
- **BUG 閉環**:BUG-053 🚫 CLOSED(Windows `.cmd` 偵測簡化)+ BUG-054 🚫 CLOSED(runtime 覆蓋缺口修補)

**核心教訓**(入 `_learnings.md` 候選):
1. **Research scope 缺口**:T0229 R4 盤 spawn 點時只看 `claude-agent-manager.ts`,遺漏 `main.ts` 的 IPC handlers。下次研究類工單做 spawn-site 盤點必須**全庫 grep**(`execFile.*claude\|spawn.*claude\|claude-code/bin` 等)
2. **設定注入模式創新**:T0231 Worker 發明「方案 A 變體」— main 直讀 settings.json 檔,零新 IPC + 零共享狀態,優於嚴格 A/B/C 三方案
3. **Native binary 方向對齊**:BUG-053 修復採 Option A(砍 `.cmd`/`.bat`)而非 Option B(`shell: true` workaround),對齊新版 claude v2.x 演進方向,一步到位
4. **工單路徑筆誤 / 型別位置**:T0230 寫「擴充 `electron/settings-store.ts`」實際 store 在 `src/stores/`(renderer);T0232 發現 T0230 漏補 `electron.d.ts`。加新 API 時 preload + d.ts 要同步

**Phase 2 候選**(延後,非本 PLAN 結案條件):
- Session state 實機驗證(T0233 flag,交 Selene 跨平台 playbook 順手做)
- npm global shim 支援(若真有使用者反應)
- 支援設定 `ANTHROPIC_API_KEY` 等環境變數透傳到 system claude(R4 陷阱 #3)

**結案條件達成**:✅ 程式碼 + ✅ 文件 + ✅ BUG 全 CLOSED + ✅ 使用者驗收通過
