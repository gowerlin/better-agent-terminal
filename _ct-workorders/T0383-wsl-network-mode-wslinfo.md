---
schema_version: 1
schema_kind: workorder
id: T0383
title: "BUG-089 修復：WSL 網路模式改用 `wslinfo --networking-mode` 判定 + declared/actual 比對 + 警告 i18n"
type: implementation
status: IN_PROGRESS
priority: P1
sizing: S
created_at: "2026-10-04T22:18:57+08:00"
updated_at: "2026-10-04T22:44:48+08:00"
started_at: "2026-10-04T22:44:48+08:00"
completed_at: null
target_version: next
depends_on: [T0382]
related:
  - "BUG-089（修復對象）"
  - "T0380 回報區 目標 4"
  - "D128"
  - "PLAN-035 Phase 1"
affects_files:
  - electron/wsl-detect.ts
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/components/setup-wizard/steps/wsl/install-server-bundle.ts
  - src/components/setup-wizard/steps/wsl/connect-test.ts
  - src/components/setup-wizard/steps/wsl/fetch-fingerprint.ts
  - src/locales/
  - electron/__tests__/
  - src/components/setup-wizard/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: none
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 child_process 一律 `execFile` / `spawn` + array args，timeout 必設；distro / port 等外部輸入先過既有白名單驗證（CLAUDE.md Child Process Spawning）。禁用 shell-spawning exec API。"
  - "🔴 不得改使用者 `%USERPROFILE%/.wslconfig`、不得 `wsl --shutdown` / `--install` / `--unregister`、不得刪除或重建 `Ubuntu-24.04`。本機 runtime 驗證只做唯讀查詢或暫存檔，驗完清乾淨。"
  - "🔴 Renderer 不得 import Node builtin（D090）；renderer 端 log 用 `window.electronAPI.debug.log`，main 端用 `logger`（CLAUDE.md Logging）。"
  - "⚠️ PLAN-035 Phase 1 四張單（T0381→T0382→T0383→T0384）**串行**，都會改 `electron/main.ts`；只改本單範圍，不預先做後面單的內容。不 push。"
---

# T0383 — WSL 網路模式判定修正

## 背景

`detectNetworkMode()`（`electron/wsl-detect.ts:220-239`）以 `ip route show default` 含 ` via ` 判 NAT；Mirrored 鏡像主機路由表，default route 一定帶閘道 ⇒ 永遠誤判。T0380 實測 `wslinfo --networking-mode` → `mirrored`。

## 決策（D128）

1. 改用 `wsl -d <distro> -- wslinfo --networking-mode`（argv 固定，distro 過白名單），解析 `nat` / `mirrored` / 其他值（`none`、`virtioproxy` 等）；指令不存在（WSL < 2.0.4）或失敗回 `'unknown'`。**移除 route 啟發式**
2. 主機端讀 `%USERPROFILE%/.wslconfig` `[wsl2] networkingMode`（鍵與值不分大小寫，**只讀**）作為 `declared`，回傳 `{ actual, declared }`（型別變更須同步 preload / `electron.d.ts` / 所有呼叫端）
3. 警告文案（走 i18n；`install-server-bundle.ts:302`、`connect-test.ts:369` 目前寫死英文）：
   - `actual=nat`：說明 NAT 下 `localhost` 經 localhostForwarding 仍可連，**不要**要求使用者必須改 Mirrored；connect-test 失敗時才提示可改 Mirrored 或用 distro IP
   - `declared=mirrored, actual=nat`：提示「已設定 Mirrored 但尚未生效，需執行 `wsl --shutdown`（會關閉所有發行版）」或 Windows 版本不支援（Win11 22H2+）；能區分就區分，不能就兩者都說
   - `actual=mirrored`：不顯示警告
   - `unknown`：不顯示或顯示中性說明（Worker 決定，寫回報區）
4. 順手查 BUG-089 附帶 UX：右側面板「目前步驟...」佔位字。若是單純 i18n key / 佔位字問題且改動 ≤ 10 行，一併修（`affects_files` 外的檔案須在回報區列出）；否則寫回報區留給 Phase 2
5. 不在本單：自動改 `.wslconfig`（Phase 2）
6. **附帶（T0382 殘留）**：`steps/wsl/fetch-fingerprint.ts:57` 的 `ctx.serverPort ?? 9876` 改成跟 connect-test / write-profile 一樣不 fallback（未解析時明確報錯）；9876 正是主機 RemoteServer 埠，fallback 會連到主機 BAT 自己。補一個對應 unit test

## 驗收

- unit：`wslinfo` 輸出解析（UTF-16 / 換行 / 未知值 / 指令不存在）；`.wslconfig` 解析（大小寫、缺檔、無 `[wsl2]`、註解）；警告選擇的 declared/actual 組合
- `npm run test:unit` 全綠（基線 **853**；回報新數字）
- `npx vite build` exit 0
- `npx tsc --noEmit` error 數不得高於 baseline **40**
- **本機 runtime**：對 `Ubuntu-24.04` 呼叫新 `detectNetworkMode` → `{ actual: 'mirrored', declared: 'mirrored' }`（會啟動發行版，唯讀即可）

## Sub-session 執行指示

1. 讀取本工單 + 對應 BUG + **T0380 回報區**（研究目標 4）
2. 填 `started_at`、`status: IN_PROGRESS`（**`date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**（不是 `FIXED`）；BUG 狀態由塔台更新，不要改 BUG 檔
5. commit 僅實際改動檔 + 新測試檔 + 本工單檔（`git commit --only ...`）；`AGENTS.md` 若 dirty 不要碰
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 結果摘要（2026-10-04T22:53:57+08:00）

**DONE** — `detectNetworkMode()` 改用 `wsl -d <distro> -- wslinfo --networking-mode`，移除 route 啟發式；主機端唯讀解析 `.wslconfig` `[wsl2] networkingMode` 作為 `declared`；回傳 `{ actual, declared, mirroredSupported }`；警告全面走 i18n、NAT 不再要求改 Mirrored；附帶修了「目前步驟...」佔位字與 fetch-fingerprint 的 9876 fallback。

### 落點檢查（Landing Zone）

- 結果：**WARN**（僅 C-0）
- C-0：frontmatter `repo` = **absent** → WARN「repo identity unavailable」；observed `basename(REPO_ROOT)` = `better-agent-terminal`
- C-1：PASS（工單位於 `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal/_ct-workorders/`）
- C-3：PASS（前 5 個非萬用字元 `affects_files` 全部存在）
- C-2：工單無 `branch` 欄位，不適用（實際在 `main`）
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 派發參數：`CT_MODE=on`、`CT_INTERACTIVE=0`

### 實作內容

1. **`electron/wsl-detect.ts`**
   - `WslNetworkMode` = `'mirrored' | 'nat' | 'virtioproxy' | 'none' | 'unknown'`；新增 `WslNetworkModeInfo { actual, declared, mirroredSupported }`
   - `parseWslinfoNetworkingMode(buffer)`：沿用既有 `normalizeTextOutput`（UTF-8 / UTF-16LE 有無 BOM 皆可）、CRLF/LF、不分大小寫；取**最後一行**屬於已知 mode 的值（容忍前後雜訊行）；空 / 未知值（如 `bridged`、`command not found`）→ `'unknown'`
   - `parseWslConfigNetworkingMode(text)`：section / key / value 不分大小寫；`#`、`;` 整行與行尾註解；去引號；同區段多筆取最後一筆；無 `[wsl2]` 或無鍵 → `null`；未知值 → `'unknown'`（WSL 會退回 NAT）；容忍 UTF-8 BOM
   - `readDeclaredNetworkMode(path = %USERPROFILE%\.wslconfig)`：`fs.promises.readFile` **唯讀**，缺檔 / 讀取錯誤 → `null`
   - `windowsSupportsMirrored(release, platform)`：`os.release()` build `>= 22621`（Win11 22H2）→ true / 低於 → false / 非 win32 或解析失敗 → null
   - `detectNetworkMode(distro)`：distro 過既有白名單（`validateDistroName`）、argv 固定 `['-d', distro, '--', 'wslinfo', '--networking-mode']`、timeout `PROBE_TIMEOUT_MS`（15s）；`execFile` 失敗（WSL < 2.0.4 無 `wslinfo`、逾時）→ `actual: 'unknown'`。**route 啟發式已移除**
2. **型別同步**：`electron/preload.ts`、`src/types/electron.d.ts`（新增 `WslNetworkModeValue` / `WslNetworkModeInfo`）、`src/components/setup-wizard/wizard-runner.ts`（`ctx.networkMode` 擴充 union）。`electron/main.ts` 的 `wsl:detect-network-mode` handler 直接回傳 `detectNetworkMode()` 結果，**無需修改**（未動 main.ts）
3. **`install-server-bundle.ts`**：新增純函式 `selectNetworkModeWarning(info)`，以 `i18next.t()` 產生警告（與 `error-mapper.ts` 同模式，renderer 不 import Node builtin）；`ctx.networkMode = info.actual`；`ctx.logger.info` 記錄 actual / declared / mirroredSupported。`ctx.state.networkMode` 預設值路徑保留（擴充為新 union）
4. **`connect-test.ts`**：移除「NAT 就先警告」；改為 **localhost 3 次皆失敗且 `networkMode === 'nat'`** 才推 `wizard.wsl.warning.connectFailedNat`（提示檢查 localhostForwarding / 改 Mirrored 並 `wsl --shutdown` / 改用 distro IP）
5. **`fetch-fingerprint.ts`（T0382 殘留）**：移除 `ctx.serverPort ?? 9876`，未解析時拋 `Server port was not resolved before fetching the TLS fingerprint; re-run the service step.`，不呼叫 IPC。已確認 Docker / SSH flow 建立 context 時就設 `serverPort`（`docker-flow.ts:38-40`、`ssh-flow.ts:44-49`），不受影響
6. **i18n**（en / zh-TW / zh-CN）：新增 `wizard.wsl.warning.{networkNat, networkMirroredPendingRestart, networkMirroredUnsupported, networkMirroredNotApplied, networkUnverified, connectFailedNat}` 與 `wizard.running`

### 警告選擇規則（決策 3 落地）

| actual | declared | mirroredSupported | 警告 |
|--------|----------|-------------------|------|
| `mirrored` | 任意 | 任意 | 無 |
| `unknown` | 任意 | 任意 | **無**（Worker 決定，見下） |
| `nat` | 非 `mirrored`（含 null / nat / unknown） | 任意 | `networkNat`：說明 localhostForwarding 下 localhost 可連、不需修改；連線測試失敗才需改 Mirrored 或用 distro IP |
| `nat` | `mirrored` | `true`（build ≥ 22621） | `networkMirroredPendingRestart`：設定未生效，需 `wsl --shutdown`（明示會關閉所有發行版） |
| `nat` | `mirrored` | `false` | `networkMirroredUnsupported`：Windows 不支援（需 Win11 22H2+），已退回 NAT |
| `nat` | `mirrored` | `null` | `networkMirroredNotApplied`：兩種原因都說 |
| `virtioproxy` / `none` | 任意 | 任意 | `networkUnverified`（帶 `{{mode}}`）：BAT 僅驗證過 NAT / Mirrored |

- **`unknown` 不顯示的理由**：`unknown` 涵蓋 WSL < 2.0.4、IPC / probe 逾時等，資訊不足以給出正確建議；connect-test 才是實際仲裁者。只寫 `ctx.logger.info` 留痕
- **區分「未生效」與「不支援」的方式**：以主機 Windows build（`os.release()`）判斷，而非 T0380 建議的「VM 啟動時間 vs `.wslconfig` mtime」——後者需另查 VM uptime，且 instance / VM 生命週期不同步，不可靠。build ≥ 22621 時已排除「不支援」，因此只提示 `wsl --shutdown`

### 附帶 UX（決策 4）：「目前步驟...」佔位字 — **已修**

- 根因：`SetupWizardShell.tsx:285` 在步驟 Running 時渲染 `{t('wizard.currentStep')}...`（字面拼接 `...`）。不是漏 key，而是把標題 key 拿來當進行中文字
- 修正：改為 `{t('wizard.running')}`，新增 key（en `Running…` / zh-TW `執行中…` / zh-CN `执行中…`）。1 行 TSX + 3 行 locale，≤ 10 行
- **`affects_files` 外檔案**：`src/components/setup-wizard/SetupWizardShell.tsx`

### 異動檔案

| 檔案 | 說明 |
|------|------|
| `electron/wsl-detect.ts` | wslinfo 判定 + `.wslconfig` 解析 + Windows build 判定，移除 route 啟發式 |
| `electron/preload.ts` | `detectNetworkMode` 回傳型別 |
| `src/types/electron.d.ts` | `WslNetworkModeValue` / `WslNetworkModeInfo` |
| `src/components/setup-wizard/steps/wsl/install-server-bundle.ts` | `selectNetworkModeWarning` + i18n 警告 |
| `src/components/setup-wizard/steps/wsl/connect-test.ts` | NAT 提示改為失敗後才顯示、走 i18n |
| `src/components/setup-wizard/steps/wsl/fetch-fingerprint.ts` | 移除 9876 fallback |
| `src/locales/{en,zh-TW,zh-CN}.json` | `wizard.wsl.warning.*`、`wizard.running` |
| `electron/__tests__/wsl-detect.test.ts` | +20 tests（wslinfo / `.wslconfig` / build / detectNetworkMode） |
| `src/components/setup-wizard/__tests__/wsl-network-mode.test.ts`（新） | 14 tests（警告組合矩陣、i18n key 齊全、install / connect-test 整合） |
| `src/components/setup-wizard/__tests__/fetch-fingerprint.test.ts` | +1 test（無 serverPort 不 fallback、不呼叫 IPC） |
| `src/components/setup-wizard/__tests__/wsl-service-paths.test.ts` | mock 改新回傳形狀 |
| ⚠️ `src/components/setup-wizard/wizard-runner.ts` | **affects_files 外**：`ctx.networkMode` 型別擴充（1 行 + 註解） |
| ⚠️ `src/components/setup-wizard/SetupWizardShell.tsx` | **affects_files 外**：佔位字修正（決策 4 授權） |
| ⚠️ `tests/__mocks__/electron-api.ts`、`tests/wizard-runner.test.ts`、`tests/wsl-detect.test.ts` | **affects_files 外**：舊 node:test 套件（不在 vitest include，也沒有 npm script / CI 執行）中 `detectNetworkMode` 的消費端同步新形狀；`tests/wsl-detect.test.ts` 3 個 route 啟發式測試改為 wslinfo 版。`npx tsx --test tests/wsl-detect.test.ts` 手動驗證 10/10 pass |

### 驗收證據

| 閘門 | 結果 | 證據 |
|------|------|------|
| unit：wslinfo 解析（UTF-16 / 換行 / 未知值 / 指令不存在） | ✅ PASS | `electron/__tests__/wsl-detect.test.ts` `parseWslinfoNetworkingMode()` 5 tests + `detectNetworkMode()`「wslinfo missing → unknown」 |
| unit：`.wslconfig` 解析（大小寫、缺檔、無 `[wsl2]`、註解） | ✅ PASS | `parseWslConfigNetworkingMode()` 6 tests + `readDeclaredNetworkMode()` 2 tests（含 UTF-16LE 檔、缺檔；`mkdtemp` 暫存目錄於 afterEach 清除） |
| unit：declared/actual 警告組合 | ✅ PASS | `wsl-network-mode.test.ts` `selectNetworkModeWarning()` 6 tests |
| unit：fetch-fingerprint 不 fallback | ✅ PASS | `fetch-fingerprint.test.ts` T0383 test |
| `npm run test:unit` | ✅ PASS | **61 files / 888 tests passed**（基線 853 → 888，+35） |
| `npx vite build` | ✅ PASS | exit 0 |
| `npx tsc --noEmit` | ✅ PASS | **40** errors（= baseline 40；本單檔案無新增錯誤） |
| 舊 node:test `tests/wsl-detect.test.ts` | ✅ PASS | `npx tsx --test` 10/10 |
| **本機 runtime**（`Ubuntu-24.04`） | ✅ PASS | 2026-10-04T22:53:45+0800 以 `tsx` 直接呼叫 `detectNetworkMode('Ubuntu-24.04')` → `{"actual":"mirrored","declared":"mirrored","mirroredSupported":true}`；`os.release()` = `10.0.28000` |

runtime 驗證只執行 `wslinfo --networking-mode`（唯讀）並讀取 `.wslconfig`；未改 `.wslconfig`，未執行 `wsl --shutdown` / `--install` / `--unregister`。暫存腳本放在 scratchpad，驗完已刪除；repo 內無殘留暫存檔。

### 未做 / 留給後續

- 自動改 `.wslconfig`（決策 5，Phase 2）
- `docs/wsl-deployment.md:216`、`docs/plan-007-release-checklist.md:59` 仍寫「需要 Mirrored 時確認 `.wslconfig`」，措辭未與「NAT 不需強制改」對齊；屬文件，本單未動，建議 Phase 2 一併檢視
- 精靈 UI 實機目視（警告框文字、`執行中…`）未做，需真人在打包版確認

### Commit

- `git commit --only`：僅本單異動檔 + 新測試檔 + 本工單檔；未 push（hash 見塔台通知 / `git log`）

### 互動紀錄

- 無（`CT_INTERACTIVE=0`）
