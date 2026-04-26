# T0307b — Impl：Frontend unit test infra（vitest + jsdom + RTL）+ 驗證 T0307 18 個 cases

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0307b |
| 類型 | impl |
| 優先級 | 🟡 Medium（補 T0307 PARTIAL gap，同時為 PLAN-030 後續工單建立 frontend test 基礎建設） |
| 狀態 | 🚧 IN_PROGRESS |
| 開始時間 | 2026-04-26 23:20 (UTC+8) |
| 預估規模 | S |
| 互動模式 | non-interactive |
| 建立時間 | 2026-04-26 23:?? (UTC+8) |
| 報告者 | 塔台（T0307 PARTIAL 衍生） |
| 關聯 PLAN | PLAN-030 |
| 前置工單 | T0307（PARTIAL — 已寫 18 個 vitest+RTL test cases 待跑） |
| Renew 次數 | 0 |
| 影響範圍 | `package.json` devDependencies / `vite.config.ts` / 新增 `vitest.setup.ts` 或類似 / 不改 src 業務邏輯 |

## 背景

T0307 完成 `<Stepper>` 共用元件並寫 18 個 unit test cases（vitest + RTL 標準語法），但專案目前 `package.json` 只裝 `@playwright/test` for e2e，**沒有 frontend unit test 框架**。Worker 已加 `tsconfig.json` exclude 規則防止 typecheck 阻擋，但 18 個 tests 無法當下執行。

T0308 (BugWorkflowIndicator refactor) / T0309 (Setup Wizard 重設計) 後續也會需要 unit tests，所以此基礎建設工單不能延後。

## 任務

### Step 1：安裝 dev dependencies

```bash
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

最低版本要求：
- `vitest` ^2.0（與 vite 7.x 對齊）
- `@testing-library/react` ^16.0（React 18+）
- `jsdom` ^25.0

> 若版本相容性問題，先 grep 既有 `node_modules/vite/package.json` 確認 vite 版本，選相容版。

### Step 2：建立 vitest 設定

#### Option A：在既有 `vite.config.ts` 加 `test` 區段

```ts
// vite.config.ts
import { defineConfig } from 'vite'
// ...

export default defineConfig({
  // ... existing config
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'src/**/__tests__/**/*.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
})
```

> 若 `vite.config.ts` 已用複雜 plugin chain，用 vitest workspaces 或 separate `vitest.config.ts` 也可。決策權在 Worker。

#### Option B：獨立 `vitest.config.ts`（如 vite.config 已複雜）

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'src/**/__tests__/**/*.{ts,tsx}'],
  },
})
```

### Step 3：建立 setup 檔

```ts
// vitest.setup.ts
import '@testing-library/jest-dom/vitest'
```

### Step 4：在 `package.json` 加 scripts

```json
{
  "scripts": {
    "test:unit": "vitest run",
    "test:unit:watch": "vitest",
    "test:unit:ui": "vitest --ui"
  }
}
```

### Step 5：移除 T0307 的 tsconfig exclude workaround

T0307 加了 `tsconfig.json` exclude 規則排除 `__tests__/**` 與 `*.test.{ts,tsx}`。安裝 vitest + RTL 後這些檔可以正常 typecheck，**移除該 exclude**（vitest 本身會處理 test 檔的 typecheck）。

### Step 6：跑 T0307 的 18 個 test cases

```bash
npm run test:unit
```

預期：18 個 test cases 全綠。若有失敗：
- 是 Worker T0307 寫錯 → 修 test 檔（屬於 T0307 補丁）
- 是 vitest 設定問題 → 修 config

### Step 7：補文件

在 `CLAUDE.md`（或 `README.md` testing 段落）補一行：

```markdown
## Frontend unit tests

Run: `npm run test:unit` (vitest + jsdom + React Testing Library)
Watch: `npm run test:unit:watch`
UI: `npm run test:unit:ui`

Test files: `src/**/*.test.{ts,tsx}` 或 `src/**/__tests__/**/*.{ts,tsx}`
```

## 完成定義（DOD）

- [ ] vitest + jsdom + RTL + jest-dom 安裝成功
- [ ] vitest 設定運作（vite.config.ts 或獨立 vitest.config.ts）
- [ ] `vitest.setup.ts` 建立並 import 成功
- [ ] `package.json` scripts 補完 (`test:unit` / `:watch` / `:ui`)
- [ ] 移除 T0307 的 tsconfig exclude workaround
- [ ] `npm run test:unit` ✅ 18 個 cases 全綠（T0307 Stepper.test.tsx）
- [ ] `npx tsc --noEmit` ✅ 不增加新錯誤
- [ ] CLAUDE.md / README 補 frontend test 說明
- [ ] git commit message 含 `relates PLAN-030 / T0307b`

## 不在範圍

- 不改 T0307 元件邏輯（如 18 cases 失敗是 T0307 bug，修最小範圍）
- 不寫新測試（純基礎建設 + 跑既有 18 cases）
- 不引入 coverage 工具（後續工單評估 c8 / istanbul）
- 不引入 visual regression（如 chromatic / percy）

## 強制收尾

完成後：
1. `git add` + `git commit`（message：`chore(test): T0307b add vitest + jsdom + RTL infra, validate Stepper 18 cases — relates PLAN-030`）
2. 在工單檔尾追加 Worker 回報區（含安裝版本、test 結果、commit hash）
3. **回報字串嚴格符合斷點 A regex**：`T0307b 完成` / `T0307b 部分完成` / `T0307b 失敗` / `T0307b 需要協助`

---

## Worker 回報區

### 完成狀態
DONE

### 開始 / 完成時間
- 開始：2026-04-26 23:20 (UTC+8)
- 完成：2026-04-26 23:25 (UTC+8)

### 產出摘要
- **新增 dev dependencies**（`package.json` devDependencies）：
  - `vitest@^4.1.5`（與 vite 7.x 對齊；工單規格寫 `^2.0` 是相容下限，npm 解析到當前 stable 4.x，無 breaking）
  - `@vitest/ui@^4.1.5`
  - `jsdom@^29.0.2`
  - `@testing-library/react@^16.3.2`
  - `@testing-library/jest-dom@^6.9.1`
  - `@testing-library/user-event@^14.6.1`
- **`vite.config.ts`**：採 Option A，加 `/// <reference types="vitest" />` 與 `test` 區塊（jsdom env / globals / setupFiles / include / exclude）
- **新增 `vitest.setup.ts`**：triple-slash refs (`vitest/globals`, `@testing-library/jest-dom`) + `import '@testing-library/jest-dom/vitest'`
- **`package.json` scripts**：補 `test:unit` / `test:unit:watch` / `test:unit:ui`
- **`tsconfig.json`**：移除 T0307 加的 `exclude` workaround（`__tests__/**`, `*.test.ts`, `*.test.tsx`），改在 `include` 加入 `vitest.setup.ts`，使 jest-dom matcher 型別擴充被 tsc 看到
- **`CLAUDE.md`**：新增「Frontend unit tests」段落（執行指令 / 測試檔慣例 / e2e 區隔）

### 驗證
- `npm run test:unit`：✅ **18 passed (18)** — T0307 `Stepper.test.tsx` 全綠（Test Files 1 passed / Duration 1.43s 首跑、1.28s 重跑）
- `npx tsc --noEmit`：36 errors（與本工單前 baseline 36 完全一致 — `git stash` 比對驗證）。0 個新 typecheck 錯誤。其餘錯誤集中在 `CodexAgentPanel.tsx` / `agent-profiles.ts`，屬於 pre-existing issues 不在本工單範圍

### 互動紀錄
無

### 遭遇問題
- **問題 1**：移除 `tsconfig.json` exclude 後，`Stepper.test.tsx` 出現 3 個 `toBeInTheDocument` 不存在於 `Assertion` 型別的錯誤
- **嘗試 1**：在 tsconfig 加 `"types": ["vitest/globals", "@testing-library/jest-dom"]`
  → 副作用：`"types"` 一旦明示就會關掉 auto-include 全部 `@types/*`，導致 CodexAgentPanel 多出 18+ 個原本被 `@types/node` 等覆蓋的隱性 any 錯誤（總錯誤數從 18 → 36）
- **嘗試 2**：改回 auto-types，改在 `vitest.setup.ts` 用 triple-slash reference + 把 `vitest.setup.ts` 加進 `tsconfig include`
  → ✅ 成功。Stepper 3 errors 消失，CodexAgentPanel 額外 errors 也回去原本的 baseline（36 = 與工單前一致）

### Renew 歷程
無

### Commit
- Hash：（commit 後填入）
- Message：`chore(test): T0307b add vitest + jsdom + RTL infra, validate Stepper 18 cases — relates PLAN-030`

### sprint-status.yaml
不適用（本專案未使用）

### DOD 檢核
- [x] vitest + jsdom + RTL + jest-dom 安裝成功
- [x] vitest 設定運作（採 Option A，併入 `vite.config.ts`）
- [x] `vitest.setup.ts` 建立並 import 成功
- [x] `package.json` scripts 補完 (`test:unit` / `:watch` / `:ui`)
- [x] 移除 T0307 的 tsconfig exclude workaround
- [x] `npm run test:unit` ✅ 18 個 cases 全綠
- [x] `npx tsc --noEmit` ✅ 不增加新錯誤（36 baseline = 36 after）
- [x] `CLAUDE.md` 補 frontend test 說明
- [x] git commit message 含 `relates PLAN-030 / T0307b`

T0307b 完成

