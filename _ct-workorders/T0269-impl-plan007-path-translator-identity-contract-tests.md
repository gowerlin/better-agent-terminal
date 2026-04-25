# T0269-impl-plan007-path-translator-identity-contract-tests

## 元資料
- **工單編號**：T0269
- **任務名稱**：PLAN-007 Phase 1 第二張 — `PathTranslator` interface + `IdentityTranslator` + `createTranslator` factory + contract test scaffold
- **狀態**：DONE
- **建立時間**：2026-04-26 00:53 (UTC+8)
- **完成時間**：2026-04-26 01:07 (UTC+08:00)
- **類型**：impl（production code，含 contract test）
- **互動模式**：disabled（fire-and-forget；scope 已被 spec doc §2.2 / §6 D-SSH-6 凍結）
- **Renew 次數**：0
- **預估 wall time**：4-8h（M sizing；依 T0268 經驗 spec-frozen + codebase-fit 條件下實際可能 10-30 min）
- **預估 context cost**：中（讀 T0268 schema、profile-manager、寫新檔 + contract test fixtures）
- **關聯**：
  - 母 PLAN：PLAN-007（📋 PLANNED）
  - Spec 依據：`_ct-workorders/_spec-remote-dev-support-2026-04.md` §2.2 PathTranslator 框架（凍結）
  - 前序：T0268（✅ DONE，targetOS schema 已落地，worktree commit `81f58d3`）
  - 後續：T0270（RemoteClient middleware + auth-result metadata）依本工單；T0273 WslPathTranslator、T0277 DockerPathTranslator、T0282 SshPathTranslator 全部依本工單 interface
  - **D089 worktree 策略**：本工單在 `../bat-plan-007` worktree 內執行，**禁止寫主線**
- **affects_files**（**worktree** `../bat-plan-007` 內，**不是主線**）：
  - 新增 `electron/remote/path-translator.ts`（interface + IdentityTranslator + createTranslator factory）
  - 新增 `electron/__tests__/path-translator.contract.test.ts`（contract test fixtures，10+ edge cases）
  - 可能新增 `electron/remote/path-translator.types.ts`（如 codebase 慣例分離 type）
  - 主線（**禁止寫入**）：僅本工單檔回報區可在主線更新

---

## D089 worktree 工作守則

**本工單為 PLAN-007 Phase B 第二張，沿用 T0268 worktree 模式**：

1. **cd 到 worktree**：`cd /d/ForgejoGit/BMad-Guide/better-agent-terminal/bat-plan-007`
2. **依賴**：T0268 已 `npm install`，無新增依賴；若需 vitest 測試 runner 已在 devDependencies
3. **base commit**：`81f58d3`（T0268 DONE）on `feature/plan-007-remote-dev`
4. **commit 全部到 `feature/plan-007-remote-dev` 分支**
5. **絕對禁止**：
   - 切回主線改檔
   - push 到 origin
   - 在主線目錄下做 source code 修改
6. **本工單檔元資料更新**：Worker 完成後更新 worktree 內本工單檔狀態 → DONE 記 commit hash；**主線本工單檔由塔台同步**

---

## 任務目標

### 1. `PathTranslator` interface（spec §2.2 凍結）

新增 `electron/remote/path-translator.ts`：

```typescript
export interface PathTranslator {
  /** Client 端絕對路徑 → Server 端絕對路徑（送 IPC 前翻譯） */
  toServer(clientPath: string): string

  /** Server 端絕對路徑 → Client 端絕對路徑（IPC 回來時翻譯） */
  toClient(serverPath: string): string

  /** 判斷某路徑是否屬於本 translator 管轄（決定要不要翻） */
  owns(path: string): boolean
}
```

> 三個方法是 PathTranslator 的契約。後續 5 個 implementation（Identity / Wsl / Docker / Ssh）都必須滿足同一份 contract test。

### 2. `IdentityTranslator` 實作

```typescript
export class IdentityTranslator implements PathTranslator {
  toServer(clientPath: string): string {
    return clientPath
  }
  toClient(serverPath: string): string {
    return serverPath
  }
  owns(_path: string): boolean {
    return true   // identity 對所有路徑 round-trip 不失真
  }
}
```

**用途**：
- `targetOS === 'local'` profile（不需翻譯）
- `targetOS === undefined` 的 legacy remote profile（spec §6 C-2 規定的 fallback 路徑）

### 3. `createTranslator(profile)` factory

```typescript
import type { ProfileEntry } from '../profile-manager'

export function createTranslator(profile: ProfileEntry): PathTranslator {
  switch (profile.targetOS) {
    case 'local':
    case undefined:
      return new IdentityTranslator()

    case 'wsl-linux':
    case 'docker-linux':
    case 'ssh-linux':
    case 'ssh-darwin':
      // T0273 / T0277 / T0282 接入；本工單先 throw 明確訊息
      throw new Error(
        `[PathTranslator] ${profile.targetOS} translator not implemented yet ` +
        `(pending T0273/T0277/T0282). Profile: ${profile.id}`
      )

    default:
      // exhaustive check
      const _exhaustive: never = profile.targetOS
      throw new Error(`[PathTranslator] unknown targetOS: ${_exhaustive}`)
  }
}
```

> Phase 1 只 register `local` + `legacy`。其他 4 種 stub 為明確 throw，避免 silent fail。
> 後續工單（T0273/T0277/T0282）會逐步接入並更新 factory switch。

### 4. Contract test scaffold（10+ edge cases）

新增 `electron/__tests__/path-translator.contract.test.ts`，建立**可重用的 contract test suite**。後續 4 個 translator 都會復用這份 contract。

**fixtures 結構**（建議）：

```typescript
interface ContractFixture {
  name: string
  clientPath: string
  serverPath: string
  shouldOwn: boolean
}

// 提供一個 helper，讓後續 translator 可餵不同 fixtures
export function runContract(
  translatorName: string,
  factory: () => PathTranslator,
  fixtures: ContractFixture[]
) {
  describe(`${translatorName} contract`, () => {
    for (const fx of fixtures) {
      it(`${fx.name}: round-trip`, () => { /* ... */ })
      it(`${fx.name}: owns`, () => { /* ... */ })
    }
  })
}
```

**Identity contract 必含 fixtures**（**至少 10 個**，覆蓋 edge cases）：

| # | name | clientPath | 期望行為 |
|---|------|-----------|---------|
| 1 | Windows drive letter | `C:\Users\Gower\repo` | round-trip identical |
| 2 | Windows UNC | `\\server\share\file.txt` | round-trip identical |
| 3 | POSIX absolute | `/home/gower/repo` | round-trip identical |
| 4 | POSIX with spaces | `/home/gower/my project/file.txt` | round-trip identical |
| 5 | Trailing slash | `/home/gower/` | round-trip identical（保留尾斜線） |
| 6 | Mixed slashes（Win） | `C:/Users/Gower\repo` | round-trip identical（不規範化） |
| 7 | 中文路徑 | `D:\專案\資料夾\檔案.txt` | round-trip identical |
| 8 | Long path（>260） | `C:\` + `a/`.repeat(150) | round-trip identical |
| 9 | Empty string | `''` | round-trip identical（防呆） |
| 10 | Root | `/` 或 `C:\` | round-trip identical |
| 11 | Relative path（非預期但需 graceful） | `./relative` | round-trip identical（不報錯） |
| 12 | Node-style POSIX on Windows | `/c/Users/Gower` | round-trip identical（不轉 drive letter） |

**Identity-specific 額外斷言**：
- `owns(anyPath) === true`（IdentityTranslator 對所有路徑都 own）
- `toServer === toClient`（identity 雙向相同）

**Test runner**：跟 T0268 一樣用 vitest（既有 `tests/profile-manager-migration.test.ts` 範本）。

### 5. 出口（exports）

`electron/remote/path-translator.ts` 對外 export：
- `PathTranslator` interface（type）
- `IdentityTranslator` class
- `createTranslator` factory
- `ContractFixture` type 與 `runContract` helper（後續 translator test 復用）

---

## 守則 / 邊界

1. **不接 RemoteClient**：本工單只建 interface + Identity + factory + contract test。RemoteClient middleware 接入是 T0270 的事，本工單**不要**動 `electron/remote/client.ts` 之類 IPC 層檔案。
2. **不要寫 Wsl/Docker/Ssh 實作**：保留為 throw stub。即使 codebase 已經有 T0263/T0265/T0266 純函數，**本工單不要 wrap**，留給 T0273/T0277/T0282。
3. **不要動 profile schema**：T0268 已凍結，本工單只 import `ProfileEntry` 型別使用。
4. **既有 BAT remote 連線必須透明**：legacy remote profile（`targetOS=undefined`）走 IdentityTranslator 路徑，**不能破壞** PLAN-018 既有的 `wss + token + cert pinning` 連線。
5. **錯誤訊息可被人讀懂**：throw 訊息要含 profile id 與 pending 工單編號（方便未來除錯）。
6. **不寫 source code 以外的東西**（除 T0269 自己這份工單檔）。

---

## 驗收標準（AC）

- [ ] **AC1**：`electron/remote/path-translator.ts` 落地，含 `PathTranslator` interface、`IdentityTranslator` class、`createTranslator` factory、`runContract` helper
- [ ] **AC2**：Contract test 至少 12 個 fixtures，全綠
- [ ] **AC3**：`createTranslator` 對 `targetOS='local'` 與 `targetOS=undefined` 都回 `IdentityTranslator`
- [ ] **AC4**：`createTranslator` 對 `wsl-linux`/`docker-linux`/`ssh-linux`/`ssh-darwin` throw 明確錯誤（含 profile id 與 pending 工單編號），且 TypeScript exhaustive check 對 unknown targetOS 編譯期可抓到
- [ ] **AC5**：`IdentityTranslator.owns()` 對任何路徑回 `true`
- [ ] **AC6**：`toServer` 與 `toClient` round-trip 對所有 fixtures 不失真
- [ ] **AC7**：既有 BAT remote 連線（legacy remote profile）行為不變 — 至少跑一次 `npm run build` 編譯通過，**不需** runtime 驗收（T0270 接入 RemoteClient 後再驗）
- [ ] **AC8**：Worker 在 worktree commit `feature/plan-007-remote-dev` 分支，**不**動主線（除本工單檔回報區）

---

## 完成步驟（建議）

1. cd 到 worktree（`../bat-plan-007`）
2. 確認 base commit `81f58d3`（`git log -1 --oneline`）
3. 讀 spec doc §2.2（已凍結，不需改）
4. 讀 T0268 留下的 `ProfileEntry` 型別位置（`electron/profile-manager.ts` 或對應 type 檔）
5. 寫 `electron/remote/path-translator.ts`（interface + IdentityTranslator + createTranslator + runContract helper）
6. 寫 contract test（`electron/__tests__/path-translator.contract.test.ts`，12 個 fixtures + runContract 應用）
7. 跑 `npm test` 或對應 vitest 命令確認全綠
8. 跑 `npx vite build` 或 `npm run build` 確認編譯通過
9. commit 到 `feature/plan-007-remote-dev`（建議 message：`feat(remote): T0269 PathTranslator interface + IdentityTranslator + contract test scaffold`）
10. 更新本工單檔（worktree 內）狀態 → DONE，回報 commit hash + 測試數
11. 結束 session（塔台會在主線同步元資料）

---

## 回報區（Worker 填寫）

**狀態變更**：TODO → IN_PROGRESS → DONE / FAILED / 需要協助

**開始時間**：2026-04-26 00:56 (UTC+08:00)

**worktree commit**：`dec6184` on `feature/plan-007-remote-dev`

**修改檔**：
- `electron/remote/path-translator.ts` (+101/-0)
- `tests/path-translator.contract.test.ts` (+217/-0)

**測試結果**：
- contract test：48 passed（`npx tsx tests/path-translator.contract.test.ts`）
- compile：✅（`npm run compile`）
- build：✅（`npm run build`）

**主動超出範圍項**（如有）：
- 無

**遇到的問題 / 決策**：
- `runContract` 採 test-runner-agnostic harness 介面，避免把 production module 綁死在 Vitest；目前以 repo 既有 `npx tsx` 測試樣式落地，後續 WSL/Docker/SSH translator 可直接復用同一份 contract fixtures / runner
- `sprint-status.yaml` 存在但內容停留在早期里程碑、且檔頭明示「重要節點由 Tower 更新」；本工單未直接改寫，視為由 Tower 統一維護

**Renew 觸發**（如有）：
- 無

---
