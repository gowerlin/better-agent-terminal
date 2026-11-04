---
schema_version: 1
schema_kind: workorder
id: T0839
title: "PLAN-043 W2：`detectWslFacts`（版本、發行版、systemd、預設使用者 uid、Running 清單、原則鍵、Windows build）＋ facts → plan 純函式＋ IPC"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-04T09:17:09+0800"
started_at: "2026-11-04T11:46:24+08:00"
updated_at: "2026-11-04T11:57:49+0800"
completed_at: "2026-11-04T11:57:49+0800"
session_ids:
  - "c900cc95-f802-4948-acef-1b5967e7669e"
depends_on: [T0838, T0833]
related:
  - "PLAN-043 Phase 2；D272；T0831 回報區（〈調查結論〉1–2 的偵測項目表 P-1–P-7、〈建議下一步〉W2）"
affects_files:
  - _ct-workorders/T0839-wsl-facts-and-plan.md
  - electron/wsl-detect.ts
  - electron/wsl-facts.ts
  - src/components/setup-wizard/wsl-env-plan.ts
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/components/setup-wizard/steps/wsl/install-server-bundle.ts
  - src/components/setup-wizard/wizard-runner.ts
  - electron/__tests__/
  - src/components/setup-wizard/__tests__/
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只偵測、只算計畫，不執行任何修正；不接進精靈畫面（W3 才接）。偵測全部唯讀：`execFile` ＋陣列參數＋ timeout（整體 15 s），不經 shell；child_process 測試沿用 `setExecFileImplForTests`。🔴 本機只可跑唯讀查詢，不得 `--shutdown` / `--terminate` / 改設定。"
  - "🔴 計畫依 T0831 P-1–P-7 與使用者裁決（D272）：P-6 `instanceIdleTimeout` 不做；P-5 只在 connect-test 失敗才出現（不放進第一份清單）；Phase 3 的安裝項目不在本單。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0839 — PLAN-043 W2：facts 與 plan

## 元資料
- **工單編號**：T0839｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-04 09:17 (UTC+8)
- **依賴**：T0838（同改 `wsl-detect.ts`）、T0833（同改 `main.ts` / `preload.ts`）｜**規模**：S–M

## 任務指令
1. 讀 T0831 回報區（全文）。
2. `electron/wsl-facts.ts` `detectWslFacts()`：WSL 版本、發行版清單與 VERSION、選定發行版 systemd / 預設使用者與 uid、Running 清單、`HKLM\SOFTWARE\Policies\WSL` 原則鍵、Windows build、`.wslconfig` 現況（經 W1 parser）。
3. `src/components/setup-wizard/wsl-env-plan.ts`：facts → items 純函式（item 形狀照 T0831〈調查結論〉2「一次同意」：`id`、`labelKey`、`scope`、`effects`、`required`、`defaultChecked`、`disabledReasonKey?`）。環境都正常 → 0 項。
4. IPC（本機）＋ preload ＋型別。
5. 單元測試：各 facts 組合 → 計畫（含 0 項、原則擋、WSL 太舊只提示）。
6. **T0838 留下的後續**（塔台 2026-11-04 09:30 併入本單，見 T0838 回報區〈遭遇問題〉）：
   - renderer 型別鏡像補 `consomme`：`electron/preload.ts`、`src/types/electron.d.ts`、`src/components/setup-wizard/steps/wsl/install-server-bundle.ts` 的 `NETWORK_MODES`、`src/components/setup-wizard/wizard-runner.ts` 的對應型別（runtime 行為不變，只補型別）。
   - `electron/wsl-detect.ts` 既有讀取與 WSL 規則對齊：`parseWslConfigNetworkingMode` 改用 `getIniValue`（重複 key 取**第一個**、只認 `#` 註解、引號內 `#` 不是註解）；`systemdEnabled` 的 `/etc/wsl.conf` 備援改用 `getIniValue('boot','systemd')`（看 section）。行為變化逐項寫進回報區，既有測試若因此改斷言要說明理由。

### 驗收條件
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npx vite build` 成功
- [ ] 本機唯讀實測一次 `detectWslFacts`（附輸出摘要，不含使用者名稱以外的個資）；commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

- **狀態**：DONE
- **session_id**：c900cc95-f802-4948-acef-1b5967e7669e
- **落點檢查**：PASS。C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1：工單在 `REPO_ROOT/_ct-workorders/`；C-3：`electron/`、`src/components/setup-wizard/` 等皆存在（`wsl-facts.ts`、`wsl-env-plan.ts` 為新檔，祖先存在）；C-2：沒有 `branch` 欄位（實際 `main`）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`；`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_REMOTE_TOKEN` 已設定；`CT_HOME` 未設（不是 worktree）。
- **產品 commit**：`aaf5201b6f45049558bd26f0e7b15fd5c5561a1d`（12 個檔，`git add` 明確路徑；沒有 push）。工單檔另有一個 commit。
- **相關通過案例**：工單沒有這一段，不適用。

### 產出摘要

**新檔 `electron/wsl-facts.ts`：`detectWslFacts({ distro? })`**（只讀）

| 事實 | 取法 | 欄位 |
|---|---|---|
| Windows build | `os.release()`（只在 win32） | `windowsBuild` |
| WSL 版本 | `wsl --version`，取第一行的版本號（標籤有在地化，不比對文字） | `version.{available, wsl}` |
| 發行版清單、VERSION、預設、Running 清單 | `wsl -l -v`（沿用 `parseWslListOutput`） | `distros` / `defaultDistro` / `running` |
| WSL 已安裝 | `--version` 或 `-l -v` exit 0，兩者都失敗（且不是 ENOENT）才跑 `--status`（三態規則同 `isWslInstalled`） | `wslInstalled` |
| 選定的發行版（預設 = WSL 預設發行版） | 在發行版內以預設使用者執行一次固定腳本 `DISTRO_PROBE_SCRIPT`（`wsl -d <d> --exec sh -c <常數> sh`）：`id -u` / `id -un`、`/proc/1/comm`、`/var/lib/systemd/linger/<user>`、`/etc/wsl.conf`（原始位元組 → T0838 `decodeIniBuffer` / `getIniValue`） | `selected.{version, state, probe, user, uid, pid1, systemdRunning, wslConf.{status, bootSystemd, userDefault}, linger}` |
| 原則鍵 | `<SystemRoot>\System32\reg.exe query HKLM\SOFTWARE\Policies\WSL`（絕對路徑；exit 1 = 沒有原則鍵） | `policy.{status, values, allowWsl, allowWsl1, allowInboxWsl, allowNetworkingModeUserSetting, defaultNetworkingMode}`（值名稱依 microsoft/WSL `intune/WSL.admx`，2026-11-04 讀） |
| `.wslconfig` | 讀檔 → T0838 `decodeIniBuffer` / `getIniValue` | `wslConfig.{status, encoding, networkingMode, instanceIdleTimeout}` |

- 安全：全部經 `wsl-detect.ts` 的 `execFileBuffered`（execFile、陣列參數，測試沿用 `setExecFileImplForTests`）；發行版名稱（呼叫端給的，以及 `-l -v` 回來的預設名稱）在 spawn 前過 `validateDistroName` 白名單；整體預算 `WSL_FACTS_BUDGET_MS` = 15 s，每個探測拿剩下的時間當 timeout，剩不到 250 ms 就跳過並設 `timedOut`。不做 `--shutdown` / `--terminate` / `--set-version` / 任何寫入（測試斷言 argv 沒有這些旗標）。
- 日誌：`summarizeWslFacts` 只記狀態與數量（不含使用者名稱、檔案內容），main 的 handler 以 `[wizard] wsl detect-facts …` 記一行。

**新檔 `src/components/setup-wizard/wsl-env-plan.ts`**（純函式，沒有任何 import；也放 facts 型別，electron 端以 `import type` 引用）

- `buildWslEnvPlan(facts) → { items, notices }`。item 形狀照 T0831：`id`、`labelKey`、`detailKey?`、`params?`、`scope`、`effects`、`required`、`defaultChecked`、`fixed?`、`disabledReasonKey?`。
- 規則：
  - 環境正常 → **0 項、0 提示**。linger 還沒開也一樣是 0 項（linger 照舊自動處理）。
  - P-1 WSL1 → `wsl2-convert`：必要，預設不勾。
  - P-2 → `enable-systemd`（必要、預設勾）：WSL2 看 systemd 是不是 PID 1；WSL1 只看 `[boot] systemd` 有沒有宣告。`/etc/wsl.conf` 解析不了或讀不到、或 WSL 太舊時改成停用＋原因。
  - P-4 → `enable-linger`（`fixed`）：只在清單本來就要顯示時才列出。
  - 只出提示、不出項目：P-3（root 使用者）、P-7（WSL 太舊，`--version` 不可用或版本 < 2.0.4）、`AllowWSL=0`（blocking，不出任何項目）、WSL 未安裝（blocking）、發行版探測失敗（warning，但 WSL1 轉換仍照列）。
  - P-5、P-6 永遠不在這份清單裡（D272）。
- i18n key 統一放在 `wizard.wsl.plan.*` 底下，**locales 還沒加字串**（locales 不在本單範圍，由 W3 接 UI 時補；`i18n-completeness.test.ts` 只檢查明確列出的 key，不受影響）。

**IPC（只在本機）**：`ipcMain.handle('wsl:detect-facts', (_e, distro?) => …)`（`electron/main.ts`）、preload `wsl.detectFacts(distro?)`、`src/types/electron.d.ts` 型別。不是 helper channel，沒有接進精靈畫面。

**T0838 留下的後續（已併入）**
- renderer 型別鏡像補上 `consomme`：`preload.ts` 的 `detectNetworkMode`、`electron.d.ts` 的 `WslNetworkModeValue`、`install-server-bundle.ts` 的 `NETWORK_MODES`、`wizard-runner.ts` 的 `networkMode`。
- `parseWslConfigNetworkingMode` 改用 `getIniValue`；`systemdEnabled` 的 `/etc/wsl.conf` 備援改用 `wslConfDeclaresSystemd`（= `getIniValue('boot','systemd')`，不分大小寫比對 `true`）。

**行為變化（逐項）**

| # | 地方 | 以前 | 現在 | 理由 |
|---|---|---|---|---|
| 1 | `.wslconfig` 重複的 `networkingMode` | 取最後一個 | 取**第一個**（重複的 `[wsl2]` 區塊也一樣） | WSL 取第一個（T0838 讀 configfile.cpp） |
| 2 | 引號內的 `#`（`"mirrored#x"`） | 被當成註解切掉 | 屬於值本身（→ `unknown`） | WSL 規則 |
| 3 | `.wslconfig` 有解析不了的行（壞掉的標頭、沒有 `=` 的行、`\` 續行） | 跳過那一行繼續讀 | `declared = 'unknown'` | 判斷不了宣告值；只影響警告文字：actual=nat 時改顯示 `networkNat`，不再顯示 Mirrored 的三種提示 |
| 4 | 單引號 `'mirrored'` | 去掉引號 | 保留 → `unknown` | WSL 只認雙引號 |
| 5 | `/etc/wsl.conf` 的 `systemd=true` 不在 `[boot]` 底下 | true | false | WSL 只看 `[boot]` |
| 6 | `systemd = true # x`、`systemd="true"` | false | true | WSL 規則 |
| 7 | `[boot]` 裡有兩個 `systemd`，第一個是 false | 只要有 true 就算 true | false | 第一個生效 |
| 8 | `install-server-bundle` 的 `ctx.state.networkMode = 'consomme'` 預設值 | 不認得 → 改呼叫 `detectNetworkMode` | 直接接受（當作 `consomme`） | 型別補齊；`consomme` 的警告跟 `virtioproxy` 一樣是 `networkUnverified` |

- 既有測試改了一個斷言：`wsl-detect.test.ts`「last entry wins」→「FIRST entry wins」（`nat\nmirrored` 由 `mirrored` 改成 `nat`），理由是上表第 1 項。其他既有斷言都沒動。
- 新增案例：`wsl-detect.test.ts` 加 2 個（INI 規則、systemd 有分 section 的備援）；`wsl-network-mode.test.ts` 加一行 `consomme`。

### 驗證證據分道

| 分道 | 結果 |
|---|---|
| source | PASS：`wsl-facts.ts` 沒有 electron import、沒有 `child_process` import、沒有 `execSync` / `spawnSync` / `app.getPath`（source guard 測試）；探測腳本是固定字串 |
| 單元測試 | PASS：新檔 `electron/__tests__/wsl-facts.test.ts`（24 個案例）、`src/components/setup-wizard/__tests__/wsl-env-plan.test.ts`（21 個案例：0 項、P-1 / P-2 / P-3 / P-4 / P-7、原則擋、WSL 未安裝、探測失敗、wsl.conf 解析不了、P-5 / P-6 不出現）；`npm run test:unit` 427 個檔通過 / 3 skipped，7499 個測試通過 / 40 skipped，0 失敗 |
| 型別 | PASS：`npm run typecheck` = 0、`npm run typecheck:electron` = 0 |
| build | PASS：`npx vite build` 成功 |
| 本機唯讀實測 | PASS（2026-11-04 11:54–11:55，`npx tsx` 呼叫 `detectWslFacts()`＋`buildWslEnvPlan`）：`installed=true version=2.7.14.0 build=28000 distros=1 running=0 policy=absent wslconfig=ok selected=v2/ok/uid=1000/pid1=systemd/wslconf=ok/linger=true timedOut=false ms=6938`。發行版 `Ubuntu-24.04`（WSL2，列表當下是 Stopped）、預設使用者 `gower` uid 1000、`/etc/wsl.conf` `[boot] systemd=true` / `[user] default=gower`、linger 已開；`.wslconfig` UTF-8、`networkingMode=mirrored`、沒有 `instanceIdleTimeout`；沒有 WSL 原則鍵。**計畫 = `{"items":[],"notices":[]}`**（環境正常 → 0 項）。只跑了 `wsl --version`、`wsl -l -v`、`reg.exe query`、發行版內的固定探測腳本 |
| runtime / 精靈 | 不適用（本單沒有接進精靈，W3 才接） |

### 互動紀錄

- 沒有向塔台提問。範圍內的取捨直接依 T0831 / D272 決定（見〈遭遇問題〉的設計取捨）。
- 沒有 compact / resume。

### 遭遇問題

- **探測會啟動 Stopped 的發行版**（已知、已寫在 `wsl-facts.ts` 開頭註解）：實測時發行版原本是 Stopped，發行版內的探測把它冷啟動了，整次 6.9 s。精靈既有的 `systemdEnabled` / `resolveHome` 探測本來就會這樣，不算新增的狀態變化；不過 W3 接進精靈時，這個耗時會落在 plan 步驟上。
- **設計取捨（給 W3 參考，不需要裁決）**：
  1. P-3（預設使用者是 root）只出提示、不出項目：建立使用者要等 Phase 3 P3-c（W7）的實作。
  2. P-4 linger 只在清單本來就要顯示時才當固定項目列出，否則「環境正常 → 0 項」不成立（第一次跑精靈的機器 linger 一定還沒開）。
  3. facts 的型別放在 `wsl-env-plan.ts`（純檔、src 端），electron 以 `import type` 引用，避免 src 的 tsconfig 去型別檢查 electron 檔。
  4. 判斷 systemd 有沒有在跑用 `/proc/1/comm` = `systemd`，跟精靈既有的 `systemdEnabled`（`systemctl --user is-system-running`）不同：facts 是給 plan 用，精靈的 `wsl-systemd-check` 照舊用原本的函式。W3 把 `wsl-systemd-check` 改成驗證時，再決定兩者要不要統一。
- **檢查節點**：三個塔台補充檢查節點都沒有新的 `## 塔台補充（…）`。驗證前那一次是在跑完驗證之後、產品 commit 之前才補跑（順序晚了，結果一樣是沒有新段落）。
- 工作目錄裡有其他 Worker（T0834）還沒 commit 的變更（`ClaudeAgentPanel.tsx`、`client-paths.ts`、locales、CLAUDE.md 等）。這些都沒有動，也沒有 stage；共用的 `main.ts` / `preload.ts` / `electron.d.ts` 在 commit 前已確認 diff 只有本單的內容。

### 回報時間

- 2026-11-04T11:56:53+0800
