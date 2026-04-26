# T0273 — Impl PLAN-007 WslPathTranslator + wsl-path 純函數整合

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0273 |
| 類型 | impl |
| Phase | PLAN-007 Phase 2(WSL deployment)第一張 |
| 狀態 | 📋 TODO |
| 建立時間 | 2026-04-26 10:21 (UTC+8) |
| 派發時間 | (待派發) |
| 完成時間 | - |
| Sizing | M (spec 估 4-8h;GP099 校準後預期 wall 10-30 min) |
| 依賴 | T0269(PathTranslator framework)、T0270(RemoteClient middleware,channel set 已凍結) |
| 後續 | T0274(WSL setup wizard)可並行;T0275 連線 fingerprint TOFU |
| 工作目錄 | `../bat-plan-007`(worktree on `feature/plan-007-remote-dev`,HEAD `1fbb0bd`) |
| Renew 次數 | 0 |
| 互動旗標 | `--no-interactive`(yolo + fire-and-forget) |
| `affects_files` | `electron/remote/path-translator.ts`、`src/utils/wsl-path.ts` (新建)、`tests/path-translator.contract.test.ts`、`tests/wsl-path.test.ts` (新建) |

## 目標

實作 `WslPathTranslator(distro)`,wrap T0263 §3 的 `winToWsl/wslToWin` 純函數,接 PathTranslator interface(T0269 凍結);擴 contract test 覆蓋 WSL 翻譯 fixtures;`createTranslator` switch 中 `wsl-linux` case 從 throw 改為實裝。

## 範圍

### 新增

1. **`src/utils/wsl-path.ts`** — 純函數模組(T0263 §3 規格逐字落地)
   - `export function winToWsl(winPath: string, distro: string): string`
   - `export function wslToWin(wslPath: string, distro: string): string`
   - 規則:
     - `C:\foo\bar` → `/mnt/c/foo/bar`(drive letter `[A-Za-z]:[\\/]` → lowercase `/mnt/<drive>` + 反斜線轉正斜線)
     - `\\wsl$\<distro>\path` → `/path`(strip UNC + distro,case-insensitive 比對)
     - `\\wsl.localhost\<distro>\path` → `/path`(同上)
     - 反向 `/mnt/<drive>/path` → `<DRIVE>:\path`(uppercase drive)
     - 反向 `/path` → `\\wsl.localhost\<distro>\path`(永遠輸出新標準 `wsl.localhost`,不輸 legacy `wsl$`)
     - Long path `\\?\C:\...` → strip `\\?\` prefix 後翻譯
     - 不認識的 path(已是 POSIX 反向、其他 UNC、Drive 沒 mount)→ pass through(不做 validation)
   - 純字串、零 IO、零 shell-out

2. **`tests/wsl-path.test.ts`** — 純函數單元測試(node:test runner,獨立於 contract test)
   - winToWsl 至少 8 個 case:基本 drive、含空格、中文路徑、UNC `\\wsl$`、UNC `\\wsl.localhost`、distro case-insensitive 比對、long path `\\?\`、unknown path pass-through
   - wslToWin 至少 6 個 case:`/mnt/c` 基本、根目錄 `/mnt/c/`、reverse `/home/user/x` → `\\wsl.localhost\<distro>\...`、含空格、中文、unknown(已是 Win path)pass-through
   - 雙向往返(round-trip):任何能翻過去的 path,翻回來必須等於原始(Win path 大小寫例外:drive letter normalize 為大寫)

3. **`tests/path-translator.contract.test.ts`** — 擴 WSL fixtures
   - `wslFixtures: ContractFixture[]` 至少 6 個:
     - Windows drive letter → `/mnt/c/...`
     - Windows UNC `\\wsl.localhost\Ubuntu\home\user\...` ↔ `/home/user/...`
     - 中文路徑 `C:\使用者\...`
     - Long path `\\?\C:\...`
     - 含空格 `C:\Program Files\...`
     - distro mismatch(profile distro `Ubuntu` 但 path 是 `\\wsl.localhost\Debian\...`)→ owns=false
   - `runContract('WslPathTranslator', () => new WslPathTranslator('Ubuntu'), wslFixtures, harness)`

### 修改

4. **`electron/remote/path-translator.ts`** —
   - 新增 `export class WslPathTranslator implements PathTranslator { constructor(private distro: string) {} ... }`
     - `toServer` → 呼叫 `winToWsl(p, this.distro)`
     - `toClient` → 呼叫 `wslToWin(p, this.distro)`
     - `owns(p)` → true 條件:
       - drive letter (`/^[A-Za-z]:[\\/]/`)
       - `\\wsl(\$|\.localhost)\\<this.distro>\\` (case-insensitive distro)
       - `\\?\C:\...` long path
       - `/mnt/<drive>/...`
       - `/<rest>`(POSIX absolute,假設是 WSL distro 內路徑)
     - 不 own:其他 UNC、相對路徑、空字串
   - `createTranslator` switch:`case 'wsl-linux':` 改為:
     ```ts
     if (!profile.wslDistro) {
       throw new Error(`[PathTranslator] wsl-linux profile ${profile.id} missing wslDistro`)
     }
     return new WslPathTranslator(profile.wslDistro)
     ```

### Out of scope(不做)

- ❌ 不動 `RemoteClient` middleware(T0270 已凍結 channel set)
- ❌ 不寫 WSL setup wizard(留 T0274)
- ❌ 不寫 systemd unit(留 T0275)
- ❌ 不動 `path-aware-channels.ts`
- ❌ 不引入新 dependency(純字串 regex,無 path lib)
- ❌ 不做 runtime path validation(`/mnt/z/` 不存在等)— 留給 server fs operation 自然報 ENOENT

## 前置條件 / 參考文件

| 文件 | 用途 |
|------|------|
| `_ct-workorders/_spec-remote-dev-support-2026-04.md` §2.2 | PathTranslator interface 凍結 + 5 種 implementation 對照表 |
| `_ct-workorders/T0263-research-plan007-wsl-deployment.md` §3(L355-402) | `winToWsl/wslToWin` 純函數規格逐字 + 11 條 edge cases |
| `electron/remote/path-translator.ts`(現況) | T0269 框架,L84-114 createTranslator switch,L90-94 為 wsl-linux throw stub |
| `electron/profile-manager.ts` L33-67 | `ProfileEntry.targetOS` / `wslDistro`,discriminated union view 已備 |
| `tests/path-translator.contract.test.ts` | 既有 contract framework + identityFixtures 範本 |

## AC(驗收條件)

| # | 條件 | 驗收方式 |
|---|------|---------|
| AC1 | `src/utils/wsl-path.ts` 存在,export `winToWsl` / `wslToWin` 兩個純函數 | 檔案存在 + grep export |
| AC2 | `npx tsx tests/wsl-path.test.ts`(或 `node --test`)全綠,至少 14 個 case | 跑指令看輸出 |
| AC3 | `WslPathTranslator` class 在 `path-translator.ts`,實作 PathTranslator interface 三方法 | grep `class WslPathTranslator` |
| AC4 | `createTranslator(profile)` 對 `targetOS: 'wsl-linux'` 不再 throw "not implemented",改為 return `WslPathTranslator(profile.wslDistro)`;profile 缺 `wslDistro` 才 throw | 單元測試或手動 spawn 測 |
| AC5 | `npx tsx tests/path-translator.contract.test.ts` 全綠,WslPathTranslator contract 至少 6 fixtures × 3 axes(toServer/toClient/owns)= 18 cases 全過 | 跑指令看輸出 |
| AC6 | drive letter 大小寫:`c:\foo` 與 `C:\foo` 翻譯結果均為 `/mnt/c/foo`(case-insensitive 入,lowercase 出) | 寫進 wsl-path.test.ts |
| AC7 | `\\wsl$` 與 `\\wsl.localhost` 雙向:input 兩種都接受,output 永遠用 `\\wsl.localhost`(新標準) | 寫進 wsl-path.test.ts |
| AC8 | TypeScript strict 編譯通過(`npx tsc --noEmit -p tsconfig.json` 或現有 build script) | 跑 build/typecheck 看輸出 |

## 守則(嚴格)

1. **工作分支**:在 worktree `../bat-plan-007` 內 `feature/plan-007-remote-dev` branch 上推進。**嚴禁切回 main**。
2. **commit message**:`feat(remote): T0273 WslPathTranslator + wsl-path pure functions\n\n工單:T0273\n依賴:T0269 / T0270`
3. **工單檔不寫**:Worker 嚴禁修改 `_ct-workorders/T0273-*.md`(主線檔,塔台 sync)。回報透過完成訊息 + worktree commit body。
4. **不動 main metadata**:Worker 不要 `git checkout main`、不要動主線任何檔案。
5. **工具白名單**:Read / Edit / Write / Bash(npm/npx/tsc/node)/ Grep / Glob。**不需要** WebFetch / WebSearch / Task。
6. **emoji**:除測試輸出 `✅/❌` 外,程式碼與註解禁用。
7. **Pure function 原則**:`wsl-path.ts` 零 IO、零 process.platform 檢查、零 path lib import(`path` module 不引入)。
8. **regex 防禦**:T0263 §3 給的 regex 已驗,直接套用,不要自創新版(避免漏 case)。
9. **owns() 寬鬆優先**:寬比窄好,因為 createTranslator 是 switch on targetOS,owns() 主要給未來 fallback 邏輯用,寧可多 own 也不要漏。
10. **完成判定**:8 個 AC 全部通過後,worktree commit,完成訊息 `T0273 完成`。失敗或 blocker 訊息 `T0273 失敗:<原因>`。

## 預期 wall

**10-30 min**(GP099 校準後;T0269 contract framework 已備,wsl-path 純函數有 spec 直譯,WslPathTranslator wrapper 結構直接,主要工作在 fixtures 設計 + tests)。

## 工單回報區

> Worker 收尾後,在此貼:
> 1. 結果摘要(AC 逐項勾選)
> 2. worktree commit hash
> 3. 主動超出範圍項(若有)
> 4. 教訓 / 觀察(可空)

(Worker 填)

---

## 塔台補充(Renew #N)

(尚無)

---
