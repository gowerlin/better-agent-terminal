---
schema_version: 1
schema_kind: bug
id: BUG-078
title: ct-drift-telemetry.ts 引用 node:fs/path/os 觸發 D090 guard，CI verify-renderer-imports fail 阻塞 v0.5.0-pre.1 release
status: FIXED
severity: high
created_at: "2026-04-28T23:21:00+08:00"
fixed_at: "2026-04-28T23:36:00+08:00"
fixed_by: T0348
---
# BUG-078 — ct-drift-telemetry.ts 引用 node:fs/path/os 觸發 D090 guard，CI verify-renderer-imports fail 阻塞 v0.5.0-pre.1 release

## Metadata

| 欄位 | 內容 |
|------|------|
| BUG 編號 | BUG-078 |
| 標題 | T0346 (PLAN-034 Sprint 5) 新增 `src/utils/ct-drift-telemetry.ts`，import `node:fs` / `node:path` / `node:os`，落在 vite renderer 編譯範圍內，觸發 D090 guard，pre-release CI build job 三平台同步 fail |
| 嚴重度 | 🔴 High（阻塞 v0.5.0-pre.1 release；CI fail 三平台 mac/win/linux 同樣症狀） |
| 可重現 | 100%（`npm run build` 即可重現本機；CI run 25060731646 已實證） |
| Workaround | 無（必修） |
| 狀態 | ✅ FIXED（T0348 完成於 2026-04-28 23:36，方案 A 落地） |
| 建立時間 | 2026-04-28 23:21 (UTC+8) |
| 報告者 | GitHub Actions pre-release workflow run 25060731646 |
| 影響範圍 | `src/utils/ct-drift-telemetry.ts` (line 20-22)；連帶 `src/utils/__tests__/ct-drift-telemetry.test.ts` |
| Root cause | T0346 把純 Node-context 的 logger 放在 `src/utils/`，但 `src/` 整個被 vite renderer build 編譯。vite-plugin-electron-renderer 會把 Node builtin 改寫成 `const avoid_parse_require = require;`，packaged build (NSIS, `nodeIntegration:false`) 啟動即 `Uncaught ReferenceError: require is not defined`（= BUG-069 重演）。D090 guard 在 build 前正確攔截，CI 因此 fail。本機 vitest 不觸發 build，T0346 收尾驗收漏跑 `npm run build` |
| 相關 PLAN | PLAN-034（Sprint 5 / T0346 引入） |
| 相關工單 | T0346（引入點）/ T0348（本 BUG 修復工單） |
| 相關 BUG | BUG-069（D090 原始觸發案例，本 BUG 同根因重演） |
| Release target | v0.5.0-pre.1 release 之前修完（T0348 完成後重跑 CI） |

## 現象

### 觸發步驟

1. push 觸發 `.github/workflows/pre-release.yml`
2. 任一平台（mac/win/linux）build job 執行 `Update version and build` step
3. `node scripts/build-version.js` 內部跑 `verify-renderer-imports` guard
4. Guard 偵測 `src/utils/ct-drift-telemetry.ts` 引用 `node:fs/path/os`
5. exit code 1 → CI fail → release artifact 無法產出

### 預期行為

`verify-renderer-imports` 通過 → 進入 vite build → electron-builder 打包 → release artifact 上傳

### 證據

GitHub Actions run: <https://github.com/gowerlin/better-agent-terminal/actions/runs/25060731646/job/73414251412>

關鍵 log：
```
[verify-renderer-imports] Renderer cannot import Node.js builtins (D090).
  - src/utils/ct-drift-telemetry.ts:20  ->  import "node:fs"  (node-prefix)
  - src/utils/ct-drift-telemetry.ts:21  ->  import "node:path"  (node-prefix)
  - src/utils/ct-drift-telemetry.ts:22  ->  import "node:os"  (node-prefix)

[verify-renderer-imports] Why this fails the build:
  vite-plugin-electron-renderer rewrites Node builtin imports into virtual
  chunks containing `const avoid_parse_require = require;`. In a packaged
  NSIS build with nodeIntegration:false, that crashes at startup with:
      Uncaught ReferenceError: require is not defined
  See BUG-069 / D090.
```

## Root Cause

### 表層原因

`src/utils/ct-drift-telemetry.ts` 在 src/ 樹下，被 vite renderer build pipeline 掃到。檔案 import：
```ts
import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
```

D090 guard（`scripts/verify-renderer-imports.js`，BUG-069 後新增的防線）正確攔截。

### 深層原因（架構面）

T0346 工單寫了一個**邏輯上應該在 main process** 的 logger（寫 `~/.bat-cache/ct-drift.log`），但放在 renderer 樹下。實際使用鏈：

- `ct-frontmatter.ts`（renderer parser）發出 `ParseWarning`
- `src/types/{control-tower,bug-tracker,backlog,decision-log}.ts`（renderer-side type 模組）使用 ct-frontmatter
- 這些模組在 CT 工單 UI 顯示時被呼叫
- → drift 偵測點在 renderer
- → 但 logger 在「同樣的 renderer 樹下卻用 Node builtin」= 自相矛盾

正確架構：drift logger 必須在 main process（透過 IPC bridge 給 renderer 呼叫），符合 BUG-069 / D090 鐵律。

### 為什麼 T0346 漏網

1. T0346 收尾只跑 vitest，不跑 `npm run build`
2. vitest 環境是 jsdom + Node，不會觸發 vite renderer build pipeline
3. D090 guard 只在 `npm run build` 時跑
4. 本機驗收 → 全綠；CI 跑完整 release pipeline → 才暴發

## 修復策略

採方案 A（搬到 electron/ + IPC），詳見 T0348 工單。

理由：
1. ct-frontmatter 已是 renderer-side parser
2. drift detection 發生在 parse 時 = renderer time
3. 要從 renderer 寫 log → 必須走 IPC（D090 鐵律）
4. 方案 B（搬到 scripts/）後 renderer 仍無法呼叫，drift 偵測點在 renderer，logger 在 Node-only 的 scripts/ 等於永遠不會被呼叫
5. Sprint 6 dashboard 一定要這條 IPC，與其先方案 B 然後 Sprint 6 再方案 A 重做，不如一次到位

## 收尾條件（CLOSED）

- T0348 落地，`src/utils/ct-drift-telemetry.ts` 移除
- `npm run build` 三平台等價檢查通過（本機跑 + CI 重跑 run 25060731646 對應 workflow）
- 跑完 vitest 全綠 0 regression
- v0.5.0-pre.1 release artifact 三平台產出成功

## 後續追蹤

- 評估開 PLAN-035（強化工單模板：凡修改 `src/*` 必跑 `npm run build` 入收尾驗收清單）
- 或 *evolve 萃取 GP127（test-only 驗收漏網 D090 guard 的處理 pattern）
- 由塔台在 T0348 完成後決定路徑

## 回報區

待 T0348 完成後 backfill。
