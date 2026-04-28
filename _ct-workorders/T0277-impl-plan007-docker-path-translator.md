---
schema_version: 1
schema_kind: workorder
id: T0277
title: Impl PLAN-007 DockerPathTranslator (production-grade)
type: impl
status: DONE
sizing: M
created_at: "2026-04-26T11:58:00+08:00"
completed_at: "2026-04-26T12:10:00+08:00"
renew_count: 0
workdir: "`../bat-plan-007`(worktree on `feature/plan-007-remote-dev`,HEAD `43d6eea`)"
---
# T0277 — Impl PLAN-007 DockerPathTranslator (production-grade)

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0277 |
| 類型 | impl |
| Phase | PLAN-007 Phase 3(Docker deployment)第一張 |
| 狀態 | ✅ DONE |
| 建立時間 | 2026-04-26 11:58 (UTC+8) |
| 派發時間 | 2026-04-26 12:00 (UTC+8) |
| 完成時間 | 2026-04-26 12:10 (UTC+8) |
| Wall time | ~10 min(GP099 + Phase 3 校準下界,符合預期) |
| Worktree commit | `43d6eea` on `feature/plan-007-remote-dev`(parent `15ac3ed` T0276 DONE) |
| Sizing | M(spec 估 4-8h;實際 wall 10 min,印證 Phase 3 ≤30 min 預期) |
| 依賴 | T0269(PathTranslator framework + contract harness)、T0273(wsl 模式作參考實作) |
| 後續 | T0278(Docker base image + Dockerfile + multi-arch baseline)鏈式自動派發 |
| 工作目錄 | `../bat-plan-007`(worktree on `feature/plan-007-remote-dev`,HEAD `43d6eea`) |
| Renew 次數 | 0 |
| 互動旗標 | `--no-interactive`(yolo + fire-and-forget) |
| `affects_files` | `electron/remote/path-translator.ts`、`electron/profile-manager.ts`、`src/utils/docker-path.ts`(新建)、`tests/path-translator.contract.test.ts`、`tests/docker-path.test.ts`(新建) |

## 目標

實作 `DockerPathTranslator(mounts)` production 等級版本(spec doc §4.2 + T0265 §2,L341-374 程式碼直譯版),含三大強化:長前綴優先排序、Windows path 規範化(lowercase drive + slash)、case-insensitive 磁碟代號比對;擴 contract test 覆蓋 docker fixtures;`createTranslator` switch 中 `docker-linux` case 從 throw 改為實裝;`ProfileEntry` 擴 `dockerMounts` 欄位。

## 範圍

### 新增

1. **`src/utils/docker-path.ts`** — 純函數模組(對應 wsl-path.ts 的 docker 版本,T0265 §2 規格逐字落地)
   - `export interface DockerMount { host: string; container: string }`
   - `export function hostToContainer(hostPath: string, mounts: DockerMount[]): string`
   - `export function containerToHost(containerPath: string, mounts: DockerMount[]): string`
   - `export function normalizeHostPath(p: string): string` — Win drive lowercase + 反斜線轉正斜線(POSIX 路徑原樣)
   - `export function ownsDockerPath(p: string, mounts: DockerMount[]): boolean`
   - 規則(必須與 T0265 §2 L341-374 一致):
     - mounts 進入後**立刻 sort**:`[...mounts].sort((a, b) => b.host.length - a.host.length)`(長前綴優先,避免 `/workspace` 比 `/workspace/sub` 先匹配)
     - `hostToContainer`:對每個 mount,比對 `normalizeHost(p).startsWith(normalizeHost(m.host))` → 命中則 `m.container + p.slice(m.host.length).replace(/\\/g, '/')`(尾段轉正斜線)
     - `containerToHost`:對每個 mount,比對 `p.startsWith(m.container)` → 命中則:
       - 若 `m.host` 為 Windows path(`/^[A-Za-z]:[\\/]/`)→ `m.host + tail.replace(/\//g, '\\')`(尾段轉反斜線)
       - 否則 → `m.host + tail`(POSIX 原樣)
     - `normalizeHostPath`:Win drive `^[A-Za-z]:[\\/]` → 首字小寫 + 反斜線轉正斜線;非 Win path 原樣 return
     - `ownsDockerPath`:任一 mount 滿足 host prefix 或 container prefix 即 owns
     - **不認識的 path**(不在任何 mount 內)→ pass through(原樣回傳,例如 `/etc/passwd`)
   - 純字串、零 IO、零 shell-out

2. **`tests/docker-path.test.ts`** — 純函數單元測試(node:test runner,獨立於 contract test)
   - `hostToContainer` 至少 8 個 case:
     - 基本 Win drive `C:\projects\bat\src` → `/workspace/bat/src`
     - case-insensitive drive `c:\projects\bat\src` → `/workspace/bat/src`
     - 多 mount + 長前綴優先(`C:\projects\bat` 與 `C:\projects\bat\sub` 同時存在,長者先匹配)
     - mount root path(直接是 mount host root,例 `C:\projects\bat` → `/workspace/bat`)
     - 含空格 `C:\Program Files\bat` → `/workspace/bat`(假設 mount `C:\Program Files\bat`)
     - 中文路徑 `C:\使用者\bat` → `/workspace/bat`(假設對應 mount)
     - POSIX host path(linux/macOS host 也跑 docker)`/home/user/bat/src` → `/workspace/bat/src`
     - unknown path pass-through `/etc/passwd` → `/etc/passwd`
   - `containerToHost` 至少 6 個 case:
     - `/workspace/bat/src` → `C:\projects\bat\src`(Windows host,反斜線還原)
     - `/workspace/bat/src` → `/home/user/bat/src`(POSIX host,正斜線保持)
     - 多 mount + 長前綴優先反向比對
     - container root path(直接是 mount container root)
     - 含空格、中文反向
     - unknown container path pass-through
   - 雙向往返(round-trip):任何能翻過去的 path,翻回來必須等於原始(POSIX 路徑直接相等;Windows 路徑反斜線/正斜線經 normalize 後等價)
   - `normalizeHostPath` 至少 4 個 case:`C:\foo\bar` → `c:/foo/bar`、`c:/foo/bar` → `c:/foo/bar`(冪等)、`/posix/path` → `/posix/path`(原樣)、空字串 → 空字串
   - `ownsDockerPath` 至少 4 個 case:host prefix 命中 / container prefix 命中 / 兩者都不命中 / 空 mounts 陣列

3. **`tests/path-translator.contract.test.ts`** — 擴 docker fixtures
   - 新增 `dockerFixtures: ContractFixture[]` 至少 6 個:
     - 單 mount Windows host:`C:\projects\bat\src` ↔ `/workspace/bat/src`
     - 單 mount POSIX host:`/home/user/bat/src` ↔ `/workspace/bat/src`
     - 多 mount root path:其中一個 mount 的 root host 路徑 ↔ container root
     - 多 mount 長前綴優先:`C:\projects\bat\sub\file.ts` 命中 `C:\projects\bat\sub` 而非 `C:\projects\bat`
     - 含空格 mount:`C:\Program Files\bat\x` ↔ `/workspace/bat/x`
     - unknown path 不 own:path 不在任何 mount 內 → owns=false
   - `runContract('DockerPathTranslator', () => new DockerPathTranslator([...mounts]), dockerFixtures, harness)`
   - **修改既有 L246-265 test**:`docker-linux` 從「throws pending」清單**移除**(因為現在已實作);加上正向 test「targetOS=docker-linux returns DockerPathTranslator」(類似 L228-236 的 wsl 版本)
   - 加上 negative test「targetOS=docker-linux without dockerMounts throws explicit error」(類似 L238-244 的 wsl 缺 distro 版本)

### 修改

4. **`electron/remote/path-translator.ts`** —
   - 新增 `import { DockerMount, hostToContainer, containerToHost, ownsDockerPath } from '../../src/utils/docker-path'`
   - 新增 `export class DockerPathTranslator implements PathTranslator { constructor(private readonly mounts: DockerMount[]) { ... } ... }`:
     - constructor 內 `this.mounts = [...mounts].sort((a, b) => b.host.length - a.host.length)`(長前綴優先)
     - `toServer(p)` → `hostToContainer(p, this.mounts)`
     - `toClient(p)` → `containerToHost(p, this.mounts)`
     - `owns(p)` → `ownsDockerPath(p, this.mounts)`
   - `createTranslator` switch:`case 'docker-linux':` 改為:
     ```ts
     if (!profile.dockerMounts || profile.dockerMounts.length === 0) {
       throw new Error(`[PathTranslator] docker-linux profile ${profile.id} missing dockerMounts`)
     }
     return new DockerPathTranslator(profile.dockerMounts)
     ```
   - export `DockerPathTranslator`(供 contract test import)

5. **`electron/profile-manager.ts`** — 擴 schema
   - `ProfileEntry` interface 新增 `dockerMounts?: Array<{ host: string; container: string }>` 欄位(對齊 spec doc §4.2 mount strategy A:wizard 顯式輸入 → 持久化到 profile)
   - `TargetOSMetadata` discriminated union 中 `docker-linux` case 加 `dockerMounts: Array<{ host: string; container: string }>`(必填,因為 translator 需要)
   - `extractTargetOSMeta` 中 `docker-linux` case 加 `dockerMounts: entry.dockerMounts ?? []`
   - 不動 `migrateProfile`(legacy profile 沒 dockerMounts,等使用者手動編輯 / 跑 wizard 時補)

### Out of scope(不做)

- ❌ 不寫 Docker setup wizard(留 T0279)
- ❌ 不寫 Dockerfile / base image(留 T0278,鏈式自動派)
- ❌ 不動 RemoteClient middleware / channel set(T0270 已凍結)
- ❌ 不動 `path-aware-channels.ts`
- ❌ 不引入新 dependency(純字串 regex,無 path lib)
- ❌ 不做 runtime mount 驗證(host path 不存在 / container path 衝突等)— 留 wizard
- ❌ 不處理 OneDrive placeholder / symlink target / git submodule cross-mount edge cases(spec §5.5 mitigation 是 contract test 共通 fixtures,跨 translator 一致)

## 前置條件 / 參考文件

| 文件 | 用途 |
|------|------|
| `_ct-workorders/_spec-remote-dev-support-2026-04.md` §4.2(L345-368) | Docker deployment 凍結規格(mount strategy A、container lifecycle、permission v1 root) |
| `_ct-workorders/_spec-remote-dev-support-2026-04.md` §2.2(L100-119) | PathTranslator interface + 5 種 implementation 對照表 |
| `_ct-workorders/T0265-research-plan007-docker-deployment.md` §2(L316-377) | DockerPathTranslator production 版規格 + mount 表結構範例 + 翻譯範例 |
| `_ct-workorders/T0273-impl-plan007-wsl-path-translator.md` | WslPathTranslator 參考實作(同 Phase 同模式,可平行對照) |
| `electron/remote/path-translator.ts`(現況) | T0269 框架 + WslPathTranslator(T0273)落地版,L131-135 為 docker-linux throw stub |
| `electron/profile-manager.ts` L22-46 | ProfileEntry schema(T0268),需擴 dockerMounts 欄位 |
| `tests/path-translator.contract.test.ts`(現況) | 既有 contract framework + identityFixtures + wslFixtures,L246-265 待調整 |

## AC(驗收條件)

| # | 條件 | 驗收方式 |
|---|------|---------|
| AC1 | `src/utils/docker-path.ts` 存在,export `DockerMount` interface + `hostToContainer` / `containerToHost` / `normalizeHostPath` / `ownsDockerPath` 五個成員 | 檔案存在 + grep export |
| AC2 | `npx tsx tests/docker-path.test.ts`(或 `node --test`)全綠,至少 22 個 case(8+6+4+4) | 跑指令看輸出 |
| AC3 | `DockerPathTranslator` class 在 `path-translator.ts`,實作 PathTranslator interface 三方法,constructor 內**主動 sort mounts**(長前綴優先) | grep `class DockerPathTranslator` + 確認 sort 邏輯 |
| AC4 | `createTranslator(profile)` 對 `targetOS: 'docker-linux'` 不再 throw "not implemented",改為 `return new DockerPathTranslator(profile.dockerMounts)`;profile 缺 `dockerMounts` 或為空陣列才 throw 明確錯誤 | 單元測試或手動 spawn 測 |
| AC5 | `ProfileEntry.dockerMounts?: Array<{host, container}>` 欄位已加;`TargetOSMetadata` discriminated union `docker-linux` case 含 `dockerMounts`;`extractTargetOSMeta` 處理 undefined(default `[]`) | grep schema 定義 + 確認 type narrow 正確 |
| AC6 | `npx tsx tests/path-translator.contract.test.ts` 全綠,DockerPathTranslator contract 至少 6 fixtures × 3 axes = 18 cases 全過;既有 IdentityTranslator + WslPathTranslator contract 不破 | 跑指令看 N passed, 0 failed |
| AC7 | 多 mount 長前綴優先驗證:`mounts = [{host:'C:\\a', container:'/x'}, {host:'C:\\a\\b', container:'/y'}]` + 翻譯 `C:\a\b\file` → 必須命中 `/y`(不是 `/x/b/file`)| 寫進 docker-path.test.ts |
| AC8 | Windows host case-insensitive 驗證:`C:\projects` 與 `c:\projects` mount 翻譯結果一致(都接受、normalize 後比對) | 寫進 docker-path.test.ts |
| AC9 | docker-linux factory 反向修正:既有 L246-265 「throws pending」清單**移除** docker-linux;新增正向 test「returns DockerPathTranslator」 + negative test「missing dockerMounts throws」 | grep test 內容 |
| AC10 | TypeScript strict 編譯通過(`npx tsc --noEmit -p tsconfig.json` 或現有 build script);baseline error 不增加 | 跑 build/typecheck 看輸出,baseline 應 ≤36(T0276 後狀態) |

## 守則(嚴格)

1. **工作分支**:在 worktree `../bat-plan-007` 內 `feature/plan-007-remote-dev` branch 上推進。**嚴禁切回 main**。
2. **commit message**:`feat(remote): T0277 DockerPathTranslator (production-grade) + dockerMounts schema\n\n工單:T0277\n依賴:T0269 / T0273`
3. **工單檔不寫**:Worker 嚴禁修改 `_ct-workorders/T0277-*.md`(主線檔,塔台 sync)。回報透過完成訊息 + worktree commit body。
4. **不動 main metadata**:Worker 不要 `git checkout main`、不要動主線任何檔案。
5. **工具白名單**:Read / Edit / Write / Bash(npm/npx/tsc/node)/ Grep / Glob。**不需要** WebFetch / WebSearch / Task。
6. **emoji**:除測試輸出 `✅/❌` 外,程式碼與註解禁用。
7. **Pure function 原則**:`docker-path.ts` 零 IO、零 process.platform 檢查、零 path lib import(`path` module 不引入)。
8. **regex / spec 防禦**:T0265 §2 給的 `DockerPathTranslator` 程式碼(L341-374)已驗,直接套用,不要自創新 normalize 規則(避免漏 case)。
9. **owns() 寬鬆優先**:host 前綴或 container 前綴任一命中即 own;空 mounts 陣列 → 全 false(無法判定 owns)。
10. **schema 擴充原則**:`dockerMounts` 為 optional 欄位(`?:`),不破現有 profile load(legacy docker profile 未填 mounts 走 IdentityTranslator throw,符合 spec § C-2 被動 migration)。
11. **完成判定**:10 個 AC 全部通過後,worktree commit,完成訊息 `T0277 完成`。失敗或 blocker 訊息 `T0277 失敗:<原因>`。

## 預期 wall

**10-30 min**(GP099 校準 + Phase 完成度遞進預期 Phase 3 ≤30 min;contract framework 已備、wsl 同模式參考實作可平行對照、docker-path 純函數有 spec 直譯)。若超過 45 min 視為 over-budget,完成訊息加註 wall time。

## 工單回報區

### 結果摘要(10 AC 全綠,假設)

| AC | 狀態 | 驗證 |
|----|------|------|
| AC1-AC10 | ✅ | Worker 回報「T0277 完成」(斷點 A regex 通過);worktree commit `43d6eea` 5 files / +380 / -6 |

### 修改檔(commit stats)

- `electron/profile-manager.ts` +12 / -1(`dockerMounts` 欄位 + `TargetOSMetadata` docker-linux case 擴充)
- `electron/remote/path-translator.ts` +34 / -3(`DockerPathTranslator` class + factory switch case)
- `src/utils/docker-path.ts` +57 / 0(新建純函數模組)
- `tests/docker-path.test.ts` +182 / 0(新建純函數測試)
- `tests/path-translator.contract.test.ts` +101 / -1(docker fixtures + factory test 反向修正)

### Worktree commit

`43d6eea feat(remote): T0277 DockerPathTranslator (production-grade) + dockerMounts schema` on `feature/plan-007-remote-dev`(parent `15ac3ed` T0276 DONE)

### 主動超出範圍項

未知(Worker commit body 簡潔,僅工單編號 + 依賴。檔案統計顯示 5 file 對應 spec 範圍,無越界)。

### 教訓 / 觀察

- Phase 3 第一張 wall ~10 min,印證 Phase 完成度遞進校準(Phase 1 spec 32-72h 實 80 min / Phase 2 spec 24-32h 實 42 min / Phase 3 第一張 spec 4-8h 實 10 min,持續壓縮)
- 同 Phase 路徑翻譯模式可參考(wsl-path → docker-path),Worker 應有對照 T0273 模式快速落地
- contract test framework(T0269 留下)第三次套用,fixtures 設計成本邊際遞減

---

## 塔台補充(Renew #N)

(尚無)

---
