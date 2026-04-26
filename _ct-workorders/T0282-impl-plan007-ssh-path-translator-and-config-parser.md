# T0282 — Impl PLAN-007 SshPathTranslator + ssh-config alias parser

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0282 |
| 類型 | impl |
| Phase | PLAN-007 Phase 4（SSH deployment）第一張 |
| 狀態 | 📋 TODO |
| 建立時間 | 2026-04-26 14:05 (UTC+8) |
| 派發時間 | （待派） |
| 完成時間 | （待） |
| Wall time | （待） |
| Sizing | M（spec 估 4-8h；GP099 校準後預期 wall 10-30 min — 純函數 + parser，與 T0273 同類型） |
| 依賴 | T0269（PathTranslator framework + IdentityTranslator）✅、T0268（ProfileEntry SSH 欄位 schema）✅ |
| 後續 | T0283（server bundle linux-arm64 + darwin-arm64）可平行；T0284 SshTunnel 依本工單 translator |
| 工作目錄 | `../bat-plan-007`（worktree on `feature/plan-007-remote-dev`） |
| Renew 次數 | 0 |
| 互動旗標 | `--no-interactive`（yolo + fire-and-forget） |
| `affects_files` | `electron/remote/path-translator.ts`、`electron/remote/ssh-config-parser.ts`（新建）、`tests/path-translator.contract.test.ts`、`tests/ssh-config-parser.test.ts`（新建） |

## 目標

實作 D-SSH-6 拍板版 `SshPathTranslator`（單一 class 同時服務 `ssh-linux` 與 `ssh-darwin`，差異透過 `serverHome` constructor 參數涵蓋）；新增輕量 `ssh-config-parser.ts`（list `~/.ssh/config` 內 Host alias 給 wizard dropdown 用）；接 PathTranslator interface 框架 + 擴 contract test 覆蓋 SSH 跨 OS fixtures。

## 範圍

### 新增

1. **`electron/remote/ssh-config-parser.ts`** — 純函數 + 一個 IO entry（讀 `~/.ssh/config`）
   - `export async function listSshHosts(): Promise<string[]>`
   - 規則：
     - 路徑：`path.join(os.homedir(), '.ssh', 'config')`
     - 不存在 → 返回 `[]`（不 throw）
     - 讀 utf8，split CRLF/LF
     - 對每行 `^Host\s+(.+)$`（case-insensitive）match
     - 可能多 alias（`Host devbox prod-jp`）→ split whitespace
     - 排除含 `*` / `?` 的 wildcard pattern
     - dedupe（`new Set`）
   - 不 parse `HostName` / `User` / `Port`（OpenSSH 自己解析，BAT 只列 alias）
2. **`tests/ssh-config-parser.test.ts`** — node:test runner（與 wsl-path.test.ts 風格一致）
   - 不存在 config → `[]`
   - 單一 Host
   - 多 alias（同行 `Host a b c`）→ 三個都收
   - Wildcard `Host *.example.com` → 排除
   - 混合 wildcard 與 literal（`Host foo *.bar`）→ 只收 `foo`
   - 註解行（`# ...`）→ 不影響
   - 大小寫（`host devbox` 小寫關鍵字）→ 仍識別
   - dedupe（兩個 `Host devbox` 區塊）→ 一個
   - 至少 8 個 case
3. **`tests/path-translator.contract.test.ts`** — 擴 SSH fixtures
   - `sshLinuxFixtures: ContractFixture[]` 至少 6 個（client=Win → server=ssh-linux）：
     - `C:\Users\Alice\src\foo.ts` ↔ `/home/alice/src/foo.ts`（home 翻譯）
     - `C:\Users\Alice` ↔ `/home/alice`（home 自身）
     - `D:\external` → owns=false（不在 home 下）
     - `/etc/hosts` → owns=false（server raw path）
     - 中文路徑 `C:\Users\Alice\使用者文件\x.txt` ↔ `/home/alice/使用者文件/x.txt`
     - drive letter case-insensitive：`c:\Users\Alice\x` 與 `C:\Users\Alice\x` 翻譯結果一致
   - `sshDarwinFixtures: ContractFixture[]` 至少 4 個（client=macOS → server=ssh-darwin，serverHome=`/Users/bob`）：
     - `/Users/alice/x` ↔ `/Users/bob/x`（不同 user 跨 OS prefix swap）
     - `/Users/alice` ↔ `/Users/bob`
     - `/tmp/log` → owns=false
     - 中文 `/Users/alice/文件/y.txt` ↔ `/Users/bob/文件/y.txt`
   - `runContract('SshPathTranslator (Win→linux)', () => new SshPathTranslator(...), sshLinuxFixtures, harness)`
   - `runContract('SshPathTranslator (mac→darwin)', () => new SshPathTranslator(...), sshDarwinFixtures, harness)`

### 修改

4. **`electron/remote/path-translator.ts`**
   - 新增 `export class SshPathTranslator implements PathTranslator`，逐字落地 T0266 §6 production 版本（已驗 spec）：
     ```ts
     constructor(
       private clientHome: string,
       private serverHome: string,
       private clientIsWindows: boolean
     ) {}
     ```
     - `toServer` / `toClient` / `owns` / `private normalizeClient` 四方法依 T0266 §6 落地
   - `createTranslator(profile)` switch（T0269 已備）：`case 'ssh-linux': case 'ssh-darwin':` fall-through，內部從 profile 讀 `serverHome` + `os.homedir()` + `process.platform === 'win32'` 組 SshPathTranslator：
     ```ts
     case 'ssh-linux':
     case 'ssh-darwin': {
       if (!profile.serverHome) {
         throw new Error(
           `[PathTranslator] ${profile.targetOS} profile ${profile.id} missing serverHome ` +
           `(populated by first connect's auth-result frame)`
         )
       }
       return new SshPathTranslator(
         os.homedir(),
         profile.serverHome,
         process.platform === 'win32'
       )
     }
     ```

### Out of scope（不做）

- ❌ 不寫 SshTunnel（留 T0284）
- ❌ 不寫 verify-ssh-auth（留 T0285 wizard）
- ❌ 不動 `RemoteClient` middleware（T0270 已凍結）
- ❌ 不解析 ssh-config 內 `HostName` / `User` / `Port` / `IdentityFile`（OpenSSH 自己處理；本工單只 list alias 給 dropdown）
- ❌ 不做 runtime path validation（server fs 自然報 ENOENT）
- ❌ 不引入新 dependency（純 fs.readFile + regex）
- ❌ 不動 `ssh-linux` / `ssh-darwin` discriminator（T0268 已凍結）

## 前置條件 / 參考文件

| 文件 | 用途 |
|------|------|
| `_ct-workorders/_spec-remote-dev-support-2026-04.md` §2.2 §4.3 | PathTranslator interface 凍結 + SSH spec 摘要 + D-SSH-6 落地說明 |
| `_ct-workorders/T0266-research-plan007-ssh-deployment.md` §6（L645-731） | SshPathTranslator production 版本逐字 + 跨 OS 對應表 + symlink 處理 |
| `_ct-workorders/T0266-research-plan007-ssh-deployment.md` §7（L776-793） | `listSshHosts()` 規格（直接抄即可） |
| `electron/remote/path-translator.ts`（現況） | T0269 框架 + IdentityTranslator + WslPathTranslator(T0273) + DockerPathTranslator(T0277)；找 `createTranslator` switch |
| `electron/profile-manager.ts` | T0268 已加 SSH 欄位（`sshHost` / `sshUser` / `sshPort` / `sshKeyPath` / `useSshTunnel` / `serverHome`），grep 確認 schema |
| `tests/path-translator.contract.test.ts` | 既有 contract framework + identityFixtures / wslFixtures / dockerFixtures 範本 |
| `tests/wsl-path.test.ts`（T0273 產出） | node:test runner 風格範本 |

## AC（驗收條件）

| # | 條件 | 驗收方式 |
|---|------|---------|
| AC1 | `electron/remote/ssh-config-parser.ts` 存在，export `listSshHosts(): Promise<string[]>` | 檔案存在 + grep export |
| AC2 | `npx tsx tests/ssh-config-parser.test.ts`（或 `node --test`）全綠，至少 8 個 case | 跑指令看輸出 |
| AC3 | `SshPathTranslator` class 在 `path-translator.ts`，實作 PathTranslator interface 三方法 + private `normalizeClient` | grep `class SshPathTranslator` |
| AC4 | `createTranslator(profile)` 對 `targetOS: 'ssh-linux'` 與 `'ssh-darwin'` 雙 case fall-through 到 SshPathTranslator；缺 `serverHome` 才 throw（含明確錯誤訊息） | 單元測試或手動 spawn 測 |
| AC5 | `npx tsx tests/path-translator.contract.test.ts` 全綠，新增 `sshLinuxFixtures` ≥ 6 + `sshDarwinFixtures` ≥ 4，每個 fixture × 3 axes (toServer/toClient/owns) 全過 | 跑指令看輸出 |
| AC6 | drive letter case-insensitive 入 + 翻譯後 server-side 為 lowercase 開頭：`c:\Users\Alice\x` 與 `C:\Users\Alice\x` 經 toServer 後皆為 `/home/<user>/x` | 寫進 contract test 或 sshLinuxFixtures |
| AC7 | 不在 clientHome 下的路徑（如 `D:\external`、`/etc/hosts`）→ owns=false，translator 原樣傳（pass-through） | 寫進 sshLinuxFixtures + sshDarwinFixtures |
| AC8 | TypeScript strict 編譯通過（`npx tsc --noEmit -p tsconfig.json` 或現有 build script） | 跑 build/typecheck 看輸出 |

## 守則（嚴格）

1. **工作分支**：在 worktree `../bat-plan-007` 內 `feature/plan-007-remote-dev` branch 上推進。**嚴禁切回 main**。
2. **commit message**：`feat(remote): T0282 SshPathTranslator + ssh-config alias parser\n\n工單：T0282\n依賴：T0269 / T0268（ProfileEntry SSH 欄位）\n落地 D-SSH-6（單一 SshPathTranslator class 服務 ssh-linux + ssh-darwin）`
3. **工單檔不寫**：Worker 嚴禁修改 `_ct-workorders/T0282-*.md`（主線檔，塔台 sync）。回報透過完成訊息 + worktree commit body。
4. **不動 main metadata**：Worker 不要 `git checkout main`、不要動主線任何檔案。
5. **工具白名單**：Read / Edit / Write / Bash（npm/npx/tsc/node）/ Grep / Glob。**不需要** WebFetch / WebSearch / Task。
6. **emoji**：除測試輸出 `✅/❌` 外，程式碼與註解禁用。
7. **D-SSH-6 落地**：**嚴格單一 class** `SshPathTranslator`，不要建 `SshLinuxPathTranslator` 或 `SshDarwinPathTranslator`。switch 兩 case fall-through 到同一 constructor。
8. **Pure normalization**：`normalizeClient` 只處理 Win drive letter 轉小寫 + 反斜線轉正斜線；不引入 `path` module（避免平台差異）。
9. **ssh-config-parser 不深入解析**：只 list Host alias，**不要** parse HostName / User / Port / IdentityFile / ProxyJump（OpenSSH 自己解析）。
10. **完成判定**：8 個 AC 全部通過後，worktree commit，完成訊息 `T0282 完成`。失敗或 blocker 訊息 `T0282 失敗：<原因>`。

## 預期 wall

**10-30 min**（GP099 校準後；T0266 §6 已給 production 版本逐字 spec、ssh-config-parser 是 12 行直譯、PathTranslator 框架已備、contract test fixtures 主要為設計工作）。

## 工單回報區

（Worker 完成後在此補回報；**塔台**會在收到「T0282 完成」訊息後從本檔讀回報區）
