# BUG-054 — PLAN-027 runtime 切換未覆蓋 BAT 終端 claude-cli preset 與 auth handlers

## 元資料

- **編號**:BUG-054
- **狀態**:🚫 CLOSED(使用者 2026-04-22 19:50 實機驗收通過:切 system 開終端版本符合設定)
- **嚴重度**:🟡 Medium(使用者期望「切 system」應全域生效,實際只影響 Agent sessions;功能宣稱與實際不符)
- **建立時間**:2026-04-22 19:20 (UTC+8)
- **發現來源**:使用者 runtime 驗收 PLAN-027 Phase 1 後,在 BAT 終端打開 claude-cli preset 發現仍用內嵌 `.exe`
- **關聯**:
  - PLAN-027(Claude runtime selection)
  - T0229 研究報告 R4 陷阱盤點(遺漏 main.ts IPC handler)
  - T0231 改寫 agent-manager 三處 spawn(未涵蓋 main.ts)
  - `electron/main.ts:1881` `claude:get-cli-path`(BUG root)
  - `electron/main.ts:1984/2003` auth handlers(semi-bug,預先存在)
- **可重現**:100%
  - 切 Settings → Advanced → Claude Runtime → system
  - 開 git bash / 新終端 claude-cli preset
  - 實際 spawn 路徑仍為 `node_modules/@anthropic-ai/claude-code/bin/claude.exe`(內嵌),而非使用者選擇的 system path
- **workaround**:無(使用者無法繞開,除非手動改 preset command)

## 現象(使用者實測)

```
設定 Claude Runtime → system
開 git bash → claude-cli preset
$ "D:\ForgejoGit\BMad-Guide\better-agent-terminal\better-agent-terminal\node_modules\@anthropic-ai\claude-code\bin\claude.exe" --continue --dangerously-skip-permissions
```

預期:`~/.local/bin/claude.exe`(使用者系統版)
實際:BAT 內嵌版

## 根因分析

T0229 R4 陷阱盤點時**只看 `claude-agent-manager.ts` 三處 SDK spawn 點**,未涵蓋 `electron/main.ts` 的 IPC handlers。

| 位置 | 用途 | 是否走 router |
|------|------|--------------|
| `claude-agent-manager.ts` L720/L1401/L2283 | SDK Agent sessions | ✅ T0231 已接 `resolveRuntimeForSession` |
| `main.ts:1881` `claude:get-cli-path` | 終端 claude-cli preset 的 CLI path | ❌ 硬編 embedded |
| `main.ts:1984` `execFile('claude', ['auth', 'status'])` | 查 auth 狀態 | ❌ bare PATH claude |
| `main.ts:2003` `execFile('claude', ['auth', 'logout'])` | 登出 | ❌ bare PATH claude |

**影響面**:
- **Terminal claude-cli preset**(`WorkspaceView.tsx:657` `getCliPath()`)— 主要使用者路徑,命中 BUG
- **Auth UI**(Settings → Claude auth 相關)— 用 bare `'claude'` 走 PATH,與 runtime 選擇不一致(embedded 模式查到系統 auth、system 模式也可能查到錯的 claude)

## 修復方向

由 T0235 併同 BUG-053 一起修復。詳見 T0235 工單。

**主修**:
1. `claude:get-cli-path` → 呼叫 `resolveClaudeRuntime(settings)`,共用 router fallback + toast 邏輯
2. Auth handlers → 用 resolved path 取代 bare `'claude'`(保持語意一致)

## 驗收條件(從 T0235 AC 映射)

- [ ] 切 system mode → 開終端 claude-cli preset → 版本為使用者 system path
- [ ] Settings 切 runtime → Auth 區塊查詢反映對應 runtime 的 auth 狀態(不再 bare PATH)
- [ ] Fallback 行為:system 偵測失敗 + `fallbackToEmbedded: true` → 終端仍能用 embedded + 發 degraded toast

## 修復紀錄

### FIXED — 2026-04-22 19:43(T0235)

**修改檔案**:
- `electron/main.ts:1881` `claude:get-cli-path` handler 改呼叫 `resolveClaudeRuntime(getRuntimeSettingsSnapshot())`,使用 `'__terminal__'` 作為 degraded / warning event 的去重 key(R3 方案)。`SystemClaudeUnavailableError`(`fallbackToEmbedded=false` + system 不可用)時 emit degraded event 後回傳 `''`,renderer 會得到 "no CLI" 狀態但至少有 toast 解釋原因。
- `electron/main.ts:1984` `claude:auth-status` handler 改以 resolved path 取代 bare `'claude'`;runtime resolution 失敗視為「未登入」→ 回 `null`(保持既有 API 語意)。
- `electron/main.ts:2003` `claude:auth-logout` handler 同上,失敗回 `{ success: false, error }`。
- `electron/main.ts` 新增 `broadcastRuntimeEvent()` helper,把 runtime event fan-out 到所有 `BrowserWindow` + `broadcastHub`(讓 remote client 也收到),與 `ClaudeAgentManager.send()` 行為一致。

**驗證**:
- `npx tsc --noEmit` → exit 0
- `npx vite build` → 綠(3 個 target 都 build 成功)
- 現有 runtime-router / resolver 單元測試 28/28 綠(無需調整)

**互動記錄**(R5 三個決策點 Worker 自行判斷,未回塔台):
- (a) `claude:get-cli-path` 失敗回 `''`:保留既有 behaviour,同時 emit degraded event 讓 toast 系統處理 UX。
- (b) degraded / warning event 去重 key:固定字串 `'__terminal__'`(對齊工單 R3 建議)。
- (c) 其他 call site 盤點:`grep -rn "execFile.*['\"]claude['\"]|spawn.*['\"]claude['\"]" electron/ src/` 已掃過,只剩 runtime-router 內部的 health probe(`spawn(binaryPath, ['--version'])`)用 resolved path,非 bare。

**Commit**:(待 Step 8 填入)

## 關閉條件

- T0235 完成且手動驗收通過(切 runtime → 開終端確認版本)
- `_bug-tracker.md` 狀態流轉 OPEN → FIXING → VERIFY → CLOSED
