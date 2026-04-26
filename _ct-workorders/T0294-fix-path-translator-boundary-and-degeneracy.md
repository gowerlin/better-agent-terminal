# T0294 — Fix PLAN-007 Path Translator Boundary + Degeneracy（F-001 + EC-001 合併修）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0294 |
| 類型 | fix（v0.4.0 release blocker） |
| Phase | PLAN-007 release prep — fix chain 第 1 張 |
| 狀態 | 📋 TODO |
| 建立時間 | 2026-04-26 17:20 (UTC+8) |
| 派發時間 | （待派） |
| 完成時間 | （待） |
| Wall time | （待） |
| Sizing | M（GP099 校準後預期 wall 10-20 min — boundary helper + degenerate input rejection + fixtures） |
| 依賴 | T0292 review F-001、T0293 review EC-001 |
| 後續 | T0295 (build-server-bundle 安全強化) → T0296 (SSH argv) → T0297 (launchd plist) |
| 工作目錄 | **main repo**（`D:/ForgejoGit/BMad-Guide/better-agent-terminal/better-agent-terminal/`），branch **`release/v0.4.0`** |
| Renew 次數 | 0 |
| 互動旗標 | `--mode yolo --no-interactive`（fire-and-forget） |
| `affects_files` | `electron/remote/path-translator.ts`、`src/utils/docker-path.ts`、`tests/path-translator.contract.test.ts`、`tests/docker-path.test.ts` |

## 目標

修復 T0292 F-001（path translator 前綴碰撞）+ T0293 EC-001（空字串 / root prefix 退化）兩個 Critical findings，採**共用 boundary helper** 一次解兩種根因：

- F-001：`'/Users/al'` 對 `'/Users/alice/x.txt'` 誤 startsWith → 翻成 `'/Users/bobice/x.txt'`
- EC-001：`clientHome=''` / `mount.host='/'` / `mount.container=''` 退化值 → 全量誤翻譯

## 範圍

### 新增 / 修改

1. **`electron/remote/path-translator.ts`** — 新增 `startsWithPath` boundary helper + 修 SshPathTranslator
   ```ts
   /** 判斷 path 是否以 prefix 開頭，且 prefix 後必為 path separator 或字串結尾（避免前綴碰撞）*/
   function startsWithPath(p: string, prefix: string): boolean {
     if (!prefix) return false  // 空 prefix 退化：拒絕（avoid all-match）
     if (!p.startsWith(prefix)) return false
     return p.length === prefix.length
         || p[prefix.length] === '/'
         || p[prefix.length] === '\\'
   }
   ```
   套用到 `SshPathTranslator.toServer / toClient / owns`：
   - 構造時若 `clientHome === ''` 或 `serverHome === ''` → throw `Error('SshPathTranslator: clientHome / serverHome must be non-empty')`（早 fail）
   - 三方法內部 `path.startsWith(home)` 全改為 `startsWithPath(normalizeClient(path), normalizeClient(home))`
2. **`src/utils/docker-path.ts`** — 套用同樣的 `startsWithPath` helper（可 import 自 path-translator.ts 或 inline 一份）+ 拒絕 degenerate mount
   ```ts
   function isValidMount(m: { host: string; container: string }): boolean {
     return !!m.host && !!m.container
         && m.host !== '/' && m.container !== '/'
         && m.host !== '\\' && m.container !== '\\'
   }
   ```
   `hostToContainer` / `containerToHost` / `ownsDockerPath` 都用 `sortMounts(mounts).filter(isValidMount)` 過濾後再走 startsWithPath 比對
   - alternative：在 DockerPathTranslator 構造時即 throw on degenerate mount（**推薦**，早 fail）
3. **`tests/path-translator.contract.test.ts`** — 補 fixtures
   - `sshLinuxFixtures` 加：
     - `'/Users/al'` vs `'/Users/alice/x.txt'`（前綴碰撞，期望 owns=false）
     - clientHome=`''` 構造時 throw（不是 fixture，是另一個 test case）
     - serverHome=`''` 同上
   - `sshDarwinFixtures` 同樣補 1 個前綴碰撞 fixture
   - 至少新增 4 個 fixture / case
4. **`tests/docker-path.test.ts`** — 補 fixtures
   - mount=`{host:'/home/u', container:'/c/u'}` + path=`/home/user/x` → owns=false（前綴碰撞）
   - mount=`{host:'/', container:'/c'}` 構造或 filter 時被拒絕
   - mount=`{host:'/h', container:''}` 同上
   - 至少新增 4 case

### Out of scope（不做）

- ❌ 不重構 PathTranslator interface
- ❌ 不動其他 translator（IdentityTranslator / WslPathTranslator 沒這 bug，T0273 / T0269 已驗）
- ❌ 不修 baseline BUG-061
- ❌ 不寫 runtime path validation（boundary 即可，runtime 仍 trust）
- ❌ 不擴展 v0.4.1 backlog（BUG-062~068）內容

## 前置條件 / 參考文件

| 文件 | 用途 |
|------|------|
| `_ct-workorders/T0292-review-report.md` F-001 | 前綴碰撞 critical 詳情 + 建議修法 + 複現步驟 |
| `_ct-workorders/T0293-review-report.md` EC-001 | 空字串/root degeneracy critical 詳情 + 三種退化情境 + 修法 |
| `electron/remote/path-translator.ts`（release/v0.4.0 現況） | SshPathTranslator 三方法現有實作 |
| `src/utils/docker-path.ts`（release/v0.4.0 現況） | hostToContainer/containerToHost/ownsDockerPath 現有實作 |
| `tests/path-translator.contract.test.ts`、`tests/docker-path.test.ts` | 既有 fixtures 結構 |

## AC（驗收條件）

| # | 條件 | 驗收方式 |
|---|------|---------|
| AC1 | `startsWithPath` helper 存在於 `electron/remote/path-translator.ts`（或 `src/utils/path-boundary.ts` 共用），handle 空 prefix / 字串結尾 / `/` 或 `\\` boundary | grep |
| AC2 | SshPathTranslator 構造時 `clientHome === ''` 或 `serverHome === ''` → throw 明確錯誤 | 寫進 contract test |
| AC3 | DockerPathTranslator 構造時 degenerate mount（`host=''` / `container=''` / `host='/'` / `container='/'`）→ filter 或 throw | grep + test |
| AC4 | `tests/path-translator.contract.test.ts` 新增 ≥ 4 case（含前綴碰撞 + degeneracy throw test）全綠 | 跑指令 |
| AC5 | `tests/docker-path.test.ts` 新增 ≥ 4 case（含前綴碰撞 + degeneracy filter）全綠 | 跑指令 |
| AC6 | F-001 複現 case：`SshPathTranslator('/Users/al', '/Users/bob', false).toServer('/Users/alice/x.txt') === '/Users/alice/x.txt'`（passthrough，不誤翻） | 寫進 contract test |
| AC7 | EC-001 複現 case：`hostToContainer('/etc/passwd', [{host:'/', container:'/c'}]) === '/etc/passwd'`（degenerate mount filtered out，passthrough） | 寫進 docker-path test |
| AC8 | 既有 contract test + docker-path test 全部仍綠（zero regression） | 跑指令 |
| AC9 | TypeScript baseline error count drift = 0（沿用 36） | 跑 tsc 計數 |
| AC10 | git diff stat：受影響檔 ≤ 200 lines net add（範圍精確控制） | 計算 |

## 守則（嚴格）

1. **工作分支**：main repo cwd，**`release/v0.4.0`** branch（**不**進 worktree feature branch）。Worker 第一步 `git checkout release/v0.4.0` 確認。
2. **commit message**：`fix(remote): T0294 path translator boundary + degeneracy (F-001 + EC-001)\n\n工單：T0294\n依賴：T0292 F-001 + T0293 EC-001\n修：startsWithPath boundary helper + 拒絕 degenerate clientHome / mount`
3. **工單檔不寫**：Worker 嚴禁修改主線 `_ct-workorders/T0294-*.md`
4. **工具白名單**：Read / Edit / Write / Bash（npm/npx/tsc/node/git）/ Grep / Glob
5. **emoji**：除測試 ✓✗ 外禁用
6. **早 fail 優於 late silent**：degenerate input 應 throw，不應 silent passthrough（避免使用者 debug 時困惑「為何 path 沒翻」）
7. **共用 helper**：F-001 + EC-001 修法用同一個 `startsWithPath`，**不**寫兩個 helper
8. **零 regression**：既有 contract test + docker-path test 必須全綠
9. **不擴展範圍**：本工單只修 F-001 + EC-001；其他 finding 留後續工單
10. **completion 判定**：10 AC 全過或 ≥ 8 → `T0294 完成`

## 預期 wall

**10-20 min**（GP099 校準後；boundary helper 是 5-10 行純函數 + 兩個 translator 各 3 個 method 套用 + degenerate throw + 8 個新 fixtures）

## 工單回報區

（Worker 完成後在此補回報；塔台會在收到「T0294 完成」訊息後從本檔讀回報區）
