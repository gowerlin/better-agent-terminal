# T0301 — Fix v0.4.1 SSH stderr i18n + translateInvokeArgs Schema-Driven（BUG-064 + BUG-065）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0301 |
| 類型 | fix（v0.4.1 patch） |
| Phase | v0.4.1 patch chain 第 3 張（最後一張 fix） |
| 狀態 | 📋 TODO |
| 建立時間 | 2026-04-26 18:38 (UTC+8) |
| 派發時間 | （待派） |
| 完成時間 | （待） |
| Wall time | （待） |
| Sizing | M（GP099 校準後預期 wall 10-20 min — env 注入 + schema table + test） |
| 依賴 | T0299 ✅、T0300 ✅、BUG-064、BUG-065 |
| 後續 | T0302（v0.4.1 verification + version bump 0.4.0→0.4.1） |
| 工作目錄 | **main repo**，branch **`release/v0.4.0`** |
| Renew 次數 | 0 |
| 互動旗標 | `--mode yolo --no-interactive`（fire-and-forget） |
| `affects_files` | `electron/remote/ssh-args.ts`（擴 helper 注入 LANG/LC env）、`electron/remote/path-aware-channels.ts`（schema-driven）、`electron/remote/ssh-tunnel.ts` 等 4 ssh 模組（套用 env）、`tests/ssh-args.test.ts`、`tests/path-aware-channels.test.ts`（如缺則新建）、`tests/remote-client-middleware.test.ts`（補多 path arg case） |

## 目標

修復兩個 v0.4.1 backlog BUG：

- **BUG-064**（F-008）：classifyStderr 只認英文，non-en locale 的 ssh stderr fallback 到 'unknown' errorCode
- **BUG-065**（EC-004）：translateInvokeArgs 預設只翻 args[0]，多 path arg channel（git:diff-files 等）的 args[1+] 跳過

## 範圍

### BUG-064 修法 — `ssh-args.ts` 加 env 注入

1. **修 `buildBaseSshArgs`**（T0296 既有 helper）回傳改為包含 args **+ env override**：
   - 兩個方案：
     - **方案 A**（**推薦**）：抽 `buildBaseSshSpawnEnv()` 回傳 `{ LANG: 'C', LC_MESSAGES: 'C', LC_ALL: 'C' }`，caller 把它 merge 到 spawn options.env
     - 方案 B：buildBaseSshArgs 簽名改為回傳 `{ args, env }` 物件（API 變更，影響 4 個 caller）
   - **採方案 A**（最小 API 變更）：
     ```ts
     /** 強制 ssh stderr 走英文，便於 classifyStderr 解析 */
     export function buildBaseSshSpawnEnv(): Record<string, string> {
       return {
         LANG: 'C',
         LC_MESSAGES: 'C',
         LC_ALL: 'C',
       }
     }
     ```
2. **4 個 ssh 模組 spawn 處套用**：
   ```ts
   // ssh-tunnel.ts / ssh-bundle-uploader.ts / ssh-auth-probe.ts / ssh-start-server.ts
   const proc = spawn('ssh', args, {
     stdio: ['ignore', 'pipe', 'pipe'],
     env: { ...process.env, ...buildBaseSshSpawnEnv() },
   })
   ```

### BUG-065 修法 — `path-aware-channels.ts` schema-driven

3. **新增 `PATH_ARG_SCHEMA` table** 取代 default 分支假設 args[0]：
   ```ts
   /** 每 channel 的 path arg position 明示 schema */
   const PATH_ARG_SCHEMA: Record<string, 'first-string' | 'all-strings' | 'array-of-strings' | 'none'> = {
     // first-string (既有預設行為)
     'fs:readdir': 'first-string',
     'fs:readFile': 'first-string',
     'fs:stat': 'first-string',
     'fs:writeFile': 'first-string',
     'fs:exists': 'first-string',
     'pty:create': 'first-string',  // cwd 是 first arg

     // all-strings (多 path 同 type)
     'git:diff-files': 'all-strings',

     // array-of-strings (path[] 是 first arg)
     'fs:reset-watch': 'array-of-strings',

     // none (無 path arg)
     'app:version': 'none',
     // ... 既有無 path 的 channel 列出
   }

   export function translateInvokeArgs(channel: string, args: unknown[], translator: PathTranslator): unknown[] {
     const schema = PATH_ARG_SCHEMA[channel] ?? 'first-string'  // 未列 channel 預設 first-string（向後相容）
     if (schema === 'none') return args
     if (schema === 'first-string') {
       if (typeof args[0] !== 'string') return args
       return [translator.toServer(args[0]), ...args.slice(1)]
     }
     if (schema === 'all-strings') {
       return args.map(a => typeof a === 'string' ? translator.toServer(a) : a)
     }
     if (schema === 'array-of-strings') {
       const arr = args[0]
       if (!Array.isArray(arr)) return args
       return [arr.map(p => typeof p === 'string' ? translator.toServer(p) : p), ...args.slice(1)]
     }
     return args
   }
   ```
4. **同樣 schema 套到 `translateInvokeResult`**（如果既有對偶函式存在）

### 補測試

5. **`tests/ssh-args.test.ts`** 補 case：
   - `buildBaseSshSpawnEnv()` 回傳 `LANG=C` + `LC_MESSAGES=C` + `LC_ALL=C`
6. **`tests/path-aware-channels.test.ts`**（如缺則新建）：
   - schema='first-string'：args[0] 翻譯，args[1+] 不動
   - schema='all-strings'（git:diff-files）：args[0] + args[1] 都翻譯
   - schema='array-of-strings'（fs:reset-watch）：args[0] 是陣列 → 內部每 element 翻譯
   - schema='none'：args 完全不動
   - 未列 channel → 預設 first-string（向後相容）
   - 至少 6 case
7. **`tests/remote-client-middleware.test.ts`** 補 case：
   - `git:diff-files` invoke：args 為 `['/client/path/a.txt', '/client/path/b.txt']` → server 收到 `['/server/path/a.txt', '/server/path/b.txt']`

### Out of scope（不做）

- ❌ 不修 baseline BUG-061
- ❌ 不擴展所有 channel 的 schema 分類（v1 列必要的，未列的走 first-string fallback）
- ❌ 不重構 path-aware-channels 整體架構
- ❌ 不寫 GPG 簽章 / 加密層 i18n
- ❌ 不擴展 PATH_RETURNING_CHANNELS（F-013 留 future，本工單不混入）
- ❌ 不寫 LANG/LC env 對非 ssh process 套用

## 前置條件 / 參考文件

| 文件 | 用途 |
|------|------|
| `_ct-workorders/BUG-064-*.md` | classifyStderr i18n 詳情 + 修法 |
| `_ct-workorders/BUG-065-*.md` | translateInvokeArgs 多 path arg 詳情 + table-driven 修法 |
| `electron/remote/ssh-args.ts`（T0296 產出） | 既有 helper 結構 |
| `electron/remote/path-aware-channels.ts` 現況 | translateInvokeArgs 既有實作 |
| 4 個 ssh 模組現況 | spawn 既有 env 處理 |

## AC（驗收條件）

| # | 條件 | 驗收方式 |
|---|------|---------|
| AC1 | `buildBaseSshSpawnEnv()` export 在 ssh-args.ts，回傳 `LANG=C` + `LC_MESSAGES=C` + `LC_ALL=C` | grep |
| AC2 | 4 個 ssh 模組 spawn 處套用 `env: { ...process.env, ...buildBaseSshSpawnEnv() }` | grep + diff |
| AC3 | BUG-065 修：`PATH_ARG_SCHEMA` table 在 path-aware-channels.ts，至少含 8 個 channel entry | grep + count |
| AC4 | translateInvokeArgs 對 'first-string' / 'all-strings' / 'array-of-strings' / 'none' 4 種 schema 各自處理正確 | 寫進 path-aware-channels.test.ts |
| AC5 | 未列 channel 預設 'first-string'（向後相容） | 寫進 test |
| AC6 | `tests/path-aware-channels.test.ts` ≥ 6 case 全綠 | 跑指令 |
| AC7 | `git:diff-files` end-to-end test：args 為兩 path → server 收到兩個翻譯後 path | 寫進 remote-client-middleware.test.ts |
| AC8 | 既有 ssh / remote-client / path-translator test 全部仍綠（zero regression） | 跑指令 |
| AC9 | TypeScript baseline drift = 0 | 跑 tsc |
| AC10 | git diff stat：受影響 ≤ 200 lines net add | 計算 |

## 守則（嚴格）

1. **工作分支**：main repo cwd，**`release/v0.4.0`** branch
2. **commit message**：`fix(remote): T0301 SSH stderr i18n + translateInvokeArgs schema-driven (BUG-064 + BUG-065)\n\n工單：T0301\n依賴：BUG-064 + BUG-065\n抽 buildBaseSshSpawnEnv 注入 LANG=C + PATH_ARG_SCHEMA table-driven 多 path arg`
3. **工單檔不寫**：Worker 嚴禁修改主線 `_ct-workorders/T0301-*.md`
4. **工具白名單**：Read / Edit / Write / Bash / Grep / Glob
5. **emoji**：除測試輸出外禁用
6. **API 最小變更**：BUG-064 用方案 A（單獨 helper），不改 buildBaseSshArgs 簽名
7. **schema 向後相容**：未列 channel 預設 'first-string'，不破既有行為
8. **零 regression**：既有 test 必須全綠
9. **不擴範圍**：僅修 BUG-064 + BUG-065
10. **completion 判定**：10 AC 全過或 ≥ 8 → `T0301 完成`

## 預期 wall

**10-20 min**（GP099 校準後；buildBaseSshSpawnEnv 是 5 行純函數 + 4 個模組 1 行 env 改 + PATH_ARG_SCHEMA 是 8-12 行 table + translateInvokeArgs switch 重構 + 6 case test）

## 工單回報區

（Worker 完成後在此補回報；塔台會在收到「T0301 完成」訊息後從本檔讀回報區）
