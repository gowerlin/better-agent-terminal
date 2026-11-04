---
schema_version: 1
schema_kind: workorder
id: T0831
title: "研究：PLAN-043 Phase 2（已安裝 WSL 環境自動修正）與 Phase 3（從零安裝＋重開機接續）的現況核對、設計與拆單"
type: research
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-04T08:52:59+0800"
started_at: "2026-11-04T08:56:32+0800"
updated_at: "2026-11-04T09:03:37+0800"
completed_at: "2026-11-04T09:03:37+0800"
session_ids:
  - "9aa69b56-d093-4290-8688-d4be9111d1ff"
depends_on: []
related:
  - "PLAN-043；D271；PLAN-035 / T0380（2026-10-04 研究，`_ct-workorders/_archive/`）；D127 / D128；T0381–T0384（Phase 1）；T0653（NAT 不需強制改）"
affects_files:
  - _ct-workorders/T0831-research-wsl-phase2-3.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 唯讀研究：只寫本工單檔。🔴 不得在本機執行任何會改變 WSL 狀態的指令（`wsl --install`、`--update`、`--shutdown`、`--set-version`、改 `.wslconfig` / `/etc/wsl.conf`、啟用 Windows 功能、提權、重開機）。只可跑唯讀查詢（`wsl --status`、`wsl -l -v`、`wslinfo`、讀檔）。"
  - "🔴 yolo：不得問使用者；問題問塔台（上限依 `research_max_questions`）。不 push。Git：只 commit 本工單檔（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0831 — 研究：WSL 自動化 Phase 2 / 3（PLAN-043）

## 元資料

- **工單編號**：T0831
- **任務名稱**：研究：PLAN-043 Phase 2 / 3 現況核對、設計與拆單
- **狀態**：DONE
- **類型**：research
- **互動模式**：enabled（yolo：問塔台）
- **intervention_type**：context-dependent
- **Renew 次數**：0
- **建立時間**：2026-11-04 08:52 (UTC+8)

## 研究目標

使用者決定 PLAN-043 的 Phase 2（已安裝環境：偵測 → 列清單 → 一次同意 → 自動修正）與 Phase 3（從零安裝 WSL＋重開機後接續精靈）都要做（D271）。這兩段牽涉提權、Windows 功能、重開機，回頭成本高；先核對 2026-10-04 的研究（T0380 / PLAN-035）在目前程式上還成立多少，產出可直接拆成實作工單的設計。

## 已知資訊

- PLAN-035 範圍環節 1–8（1–3 = 從零安裝、4–8 = 已安裝環境修正）、D127「偵測 → 列清單 → 一次同意」、D128 Phase 1 修訂；Phase 1（T0381–T0384）已交付。
- 精靈：`src/components/setup-wizard/`（`wsl-flow.ts`、`wizard-runner.ts`、`steps/`、`preflight.ts`）；主行程：`electron/wsl-detect.ts`、`wsl-validate.ts`、`wsl-systemd.ts`、`wsl-keepalive.ts`。
- T0829（孤兒 wsl.exe）與 T0830（keep-alive 開關、精靈 step abort）同批另做，會改 `wsl-keepalive.ts` 與精靈 runner；設計請以「step abort 已存在」為前提並標註依賴。

## 調查範圍與要回答的問題

1. **現況核對**：T0380 列的每個偵測 / 修正項目，目前程式已做到哪（已做 / 部分 / 沒做），附 `檔案:行`。
2. **Phase 2 設計**：偵測項目清單（WSL 版本、distro 版本 1/2、systemd、預設使用者、網路模式只在連線測試失敗時…）、每項的自動修正動作、需不需要提權 / `wsl --shutdown`、會不會影響使用者其他正在跑的 WSL 工作；「一次同意」的清單 UI 與可逆性；失敗處理。
3. **Phase 3 設計**：`wsl --install`（含 `--no-distribution` / 指定 distro）的流程與版本差異、UAC 提權方式（不得 shell 字串拼接）、Windows 功能啟用、需要重開機的判斷；重開機接續（精靈進度持久化位置、開機後的恢復入口：BAT 啟動時偵測未完成的精靈、是否需要開機自動啟動）、取消與失敗回復。
4. **風險與不做的事**：哪些情況只提示不自動做（例如企業管控、已有使用者自訂 `.wslconfig`）。
5. **測試策略**：本機無法從零測時怎麼驗（VM、GitHub Windows runner 是否有 WSL、mock 層），每張實作單的驗收方式。

## 研究指引

- 先讀 `_ct-workorders/_archive/plans/PLAN-035-wsl-environment-full-automation.md`、`_ct-workorders/_archive/workorders/T0380-research-wsl-environment-automation.md`、`T0381`–`T0384` 回報區、`docs/wsl-deployment.md`。
- 外部資料（Microsoft WSL 文件、`wsl --install` 參數）可查，引用要附來源與查詢日期。

## 預期產出（寫在回報區）

- 〈調查結論〉逐題回答（含現況核對表）
- 〈建議方向〉方案比較與推薦
- 〈建議下一步〉拆成實作工單（每張：範圍、`affects_files` 預估、規模、依賴、能否並行、驗收方式），以及需要使用者裁決的問題清單

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

- **狀態**：DONE（研究單；五題都有結論，拆單與待裁決問題見下）
- **session_id**：9aa69b56-d093-4290-8688-d4be9111d1ff
- **落點檢查**：PASS。C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1：工單在 `REPO_ROOT/_ct-workorders/`；C-3：`affects_files` 只有本工單檔（`_ct-workorders/` 排除）→ 不適用；C-2：無 `branch` 欄位（實際 `main`）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`；`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_REMOTE_TOKEN` 已設定；`CT_HOME` 未設（非 worktree）。
- **改動**：只改本工單檔。沒有改產品程式碼、沒有改任何 WSL / Windows 設定；本機只跑唯讀查詢（見〈驗證證據分道〉）。
- **commit**：本工單檔一個 commit（hash 見 git log；`git add` 明確路徑、不 push）。

### 互動紀錄

- 沒有向塔台提問（沒有阻擋性的範圍內選擇；需要使用者裁決的事項整理在〈建議下一步〉的問題清單，不影響本研究的結論）。
- 沒有 compact / resume，沒有塔台補充段落（三個檢查節點都沒有新的 `## 塔台補充（…）`）。

### 調查結論

#### 0. 本機環境（唯讀查詢，2026-11-04 08:57–09:00）

- WSL **2.7.14.0**（T0380 時 2.7.13.0）、核心 6.18.33.2-2；Windows 10.0.28000.3365；唯一發行版 `Ubuntu-24.04`（VERSION 2，Running，預設）；發行版 `/etc/wsl.conf` = `[boot] systemd=true` + `[user] default=<使用者>`；`systemctl is-system-running` = `running`。
- `VirtualMachinePlatform` / `Microsoft-Windows-Subsystem-Linux` InstallState=1（啟用）；`HypervisorPlatform`、`Microsoft-Hyper-V-All`、`Containers-DisposableClientVM`（Windows Sandbox）= 2（未啟用）；CBS `RebootPending` 不存在；`HKLM\SOFTWARE\Policies\WSL` 不存在（沒有 WSL 原則）。
- `wsl --help`（exit **255**，T0380 已記，仍不能拿來偵測）列出的 `--install` 選項：`[Distro]`、`--enable-wsl1`、`--from-file`、`--location`、`--name`、`--no-distribution`、`--no-launch`/`-n`、`--version`、`--web-download`；另有 `--manage <Distro> --set-default-user <Username>`、`--update`。**官方文件列的 `--inbox` 不在 2.7.14 的 help 內**（⇒ 不採用）。
- `wslinfo` 只有 `--networking-mode`、`--msal-proxy-path`、`--vm-id`、`--version`、`-n`。

#### 1. 現況核對（T0380 各環節 × 目前程式）

| # | 項目 | 偵測 | 自動修正 | 證據（`檔案:行`） |
|---|------|------|----------|------------------|
| 1 | WSL 本體 | ✅ 已做（`--status` / `--version` exit code 三態） | ❌ 沒做：preflight 直接失敗 `wsl-not-installed`，錯誤畫面只給微軟安裝文件連結 | `electron/wsl-detect.ts:191-213`、`src/components/setup-wizard/steps/wsl/detect-env.ts:48-75,98-106`、`src/components/setup-wizard/error-mapper.ts:455-467` |
| 1+ | 待重開機 / 提權能力 / Windows build / WSL 原則 | ❌ 沒做（`windows-elevation.ts` 只判斷 BAT 自己是不是 High integrity，給 codex 用；不判斷是否屬於 Administrators、`EnableLUA`） | ❌ | `electron/windows-elevation.ts:53-86` |
| 2 | WSL 版本 | ❌ 沒做（沒有解析 `wsl --version`） | ❌ 沒做（沒有 `wsl --update`） | grep `--update` 於 `electron/` `src/` 0 筆 |
| 3 | 發行版 | ✅ 已做（0 個 → `wsl-no-distro`，訊息叫使用者自己 `wsl --install -d Ubuntu-24.04`） | ❌ 沒做 | `steps/wsl/pick-wsl-distro.ts:21-31`、`error-mapper.ts:469-477` |
| 3+ | 預設使用者 | ⚠️ 部分：只取 `$HOME` 與使用者名稱，**不判斷是不是 root** | ❌ 沒做 | `electron/wsl-detect.ts:219-228`、`electron/wsl-systemd.ts:215` |
| 4 | WSL2 版本 | ✅ 已做（只有 WSL1 → `wsl-requires-wsl2`） | ❌ 沒做（錯誤畫面只有「已修好重試」） | `pick-wsl-distro.ts:21,32-36`、`error-mapper.ts:680-687` |
| 5 | systemd | ✅ 已做（`systemctl --user is-system-running` 含 `running`，否則看 `/etc/wsl.conf`） | ❌ 沒做；而且**只警告不擋**：沒有 systemd 時 write-systemd-unit 走 fallback（沒有 token），到第 8 步 write-profile 一定失敗並整個 rollback | `electron/wsl-detect.ts:230-245`、`steps/wsl/wsl-systemd-check.ts:19-27`、`steps/wsl/write-systemd-unit.ts:160-172`、`docs/wsl-deployment.md:228-235` |
| 6 | 網路模式 | ✅ 已做（T0383：`wslinfo` actual + `.wslconfig` declared + Windows build；NAT 只在 connect-test 失敗時才警告） | ❌ 沒做（文件教手動改）；`.wslconfig` 只有**唯讀** parser，沒有寫入器 | `electron/wsl-detect.ts:247-330`、`steps/wsl/install-server-bundle.ts:23-43,190-209`、`steps/wsl/connect-test.ts:49-52`、`docs/wsl-deployment.md:104-122` |
| 6+ | `consomme` 模式 | ⚠️ 官方文件已把 `virtioproxy` 改名 `consomme`（`networkingMode` 可用值 `none`/`nat`/`bridged`/`mirrored`/`consomme`），程式只認 `virtioproxy` ⇒ `consomme` 會被回報成 `unknown`（不出警告，影響小） | — | `electron/wsl-detect.ts:247` |
| 7 | 常駐 keep-alive | ✅ 已做（T0384 holder：`wsl.exe -d <d> -- sleep infinity`，啟動時與 profile 增刪改時 sync，精靈寫完 unit 就先拉 holder） | ✅（holder 不需同意）；`instanceIdleTimeout=-1` 選用項 ❌ 沒做；per-profile 開關 → **T0830**；孤兒 `wsl.exe` → **T0829** | `electron/wsl-keepalive.ts:170`、`electron/main.ts:1535-1547,2187,3603-3623,3773-3781`、`steps/wsl/write-systemd-unit.ts:65-80,193` |
| 8 | linger | ✅ 已做 | ✅ 已做（自動、不經同意；發行版內、不需 Windows 提權） | `electron/wsl-systemd.ts:225-263`、`steps/wsl/write-systemd-unit.ts:195-208` |
| ＋ | 伺服器埠 | ✅ 已做（T0382） | ✅ 已做（自動選 Windows 端空著的埠；EADDRINUSE → `wsl-port-in-use`） | `electron/wsl-systemd.ts:698-889`、`steps/wsl/write-systemd-unit.ts:55`、`error-mapper.ts:403-406` |
| F1 | 同意清單 `requestConsent` | — | ❌ 沒做：runner 只有單選 `requestChoice` 與文字 `requestText` | `src/components/setup-wizard/wizard-runner.ts:37-71,128-130,763-` |
| F2 | 步驟中止（step abort） | — | ❌ 沒做：`cancel()` 只解開「失敗畫面」的等待，執行中的 `await step.run()` 不會被中斷 → **T0830** | `wizard-runner.ts:448-456,531-535` |
| F3 | 重開機接續 | — | ❌ 沒做：沒有 `wizard-resume`、RunOnce、`--resume-wizard`；`second-instance` 只認 `--profile=`，其他一律開新視窗 | `electron/main.ts:2129-2182`；grep `RunOnce` / `resume-wizard` 0 筆 |
| F4 | 精靈 log | ⚠️ T0380 指出的問題仍在：WSL 精靈 logger 用 `console.*`，不進磁碟日誌（違反 CLAUDE.md Logging） | — | `src/components/setup-wizard/wsl-flow.ts:41-45` |
| F5 | 精靈的掛載位置 | 精靈 controller 在 `ProfilePanel` 裡，`ProfilePanel` 只在 Profiles 開著時掛載 ⇒ 接續入口要先開 Profiles 再開精靈 | — | `src/components/ProfilePanel.tsx:202-204`、`src/App.tsx:1455-1456` |

結論：PLAN-043 的 2026-11-02 grep 核對成立。偵測幾乎都在，**所有「修正」都還沒有**；Phase 2 / 3 需要的三個框架能力（多選同意、步驟中止、跨重開機接續）也都沒有，其中步驟中止由 T0830 補。T0380 的設計前提（holder 方案、NAT 不強制改、提權只限環節 1–2）在現行程式上仍成立。

#### 2. Phase 2 設計（已安裝環境：偵測 → 清單 → 一次同意 → 修正）

**流程位置**（沿用 T0380 目標 5，修正如下）：

```
detect-env → pick-wsl-distro → plan-wsl-environment（新，kind:'input'）→ apply-wsl-environment（新，task）
→ wsl-systemd-check（改成驗證：沒有 systemd 直接失敗 'wsl-systemd-disabled'，不再走到第 8 步才失敗）
→ install-server-bundle → write-systemd-unit → fetch-fingerprint → connect-test（失敗時另提網路模式修正）→ write-profile → done
```

- 🔴 不回歸：環境都正常時（現在這台機器就是），`plan-wsl-environment` 算出 0 個項目 → **不顯示清單、直接成功**，精靈畫面與步驟行為除了多兩個瞬間完成的步驟外不變。兩個新步驟 `appliesTo: ['wsl-linux']`，SSH / Docker 不受影響。
- 事實收集一次做完（`detectWslFacts`，main 端、execFile 陣列參數、timeout 15 s），計畫建構是純函式（facts → items）。

**偵測項目與修正動作**

| 項目 | 偵測（觸發條件） | 修正動作 | 提權 | 重啟影響 | 對其他 WSL 工作的影響 | 必要 / 預設 | 可逆性 |
|------|------------------|----------|------|----------|----------------------|------------|--------|
| P-1 WSL2 轉換 | 選中的發行版 VERSION=1（現在直接失敗 `wsl-requires-wsl2`） | `wsl --set-version <d> 2` | 不需要（VMP 已啟用時） | 轉換期間該發行版停止，可能很久 | 該發行版內所有程式結束；官方警告大型發行版可能失敗、建議先備份 | 必要，**預設不勾**（風險高；不勾時提示改選 / 新裝發行版，見 Phase 3 P3-c） | `--set-version <d> 1` 可轉回（同樣耗時）；不自動回轉 |
| P-2 systemd | `systemdEnabled` = false（`wsl-detect.ts:230`） | 以 `wsl -d <d> -u root` 讀 `/etc/wsl.conf` → main 端 INI 逐行編輯器只改 `[boot] systemd=true`（其他行原樣）→ 寫回前在發行版內備份 `/etc/wsl.conf.bat-backup-<系統時間>` → 寫入（內容走 stdin，不放 argv）→ `wsl --terminate <d>` → 再驗 `systemctl is-system-running`（`running` / `degraded` 都算有） | 發行版內 root（`wsl -u root` 不需密碼）；不需 Windows 提權 | `--terminate` 該發行版 | 該發行版內所有程式（含 BAT 其他分頁裡的 WSL shell）結束；keep-alive holder 會被結束，依 backoff 重啟（`wsl-keepalive.ts` 既有行為），apply 完成後再呼叫一次 `keepAlive` | 必要、預設勾 | 有備份；不自動還原（見 Q-1）。官方寫 `wsl --shutdown`，但 `[boot]` 是發行版設定、8 秒規則說 `--terminate` 即可 ⇒ **需實測**；`--terminate` 後仍沒有 systemd 時，另列一項「`wsl --shutdown`（會關閉所有發行版）」**單獨再問一次**，不併在原同意裡 |
| P-3 預設使用者是 root | `resolveDistroUser` = `root`（目前不檢查） | 只提示（root 的 systemd user instance 理論上可用，未實測）；選用項「建立一般使用者並設為預設」與 Phase 3 P3-c 共用實作 | 發行版內 root | `--terminate` | 同 P-2 | 選用、預設不勾 | 使用者不刪（帳號留著無害） |
| P-4 linger | 既有 | 既有自動行為不變；清單上以「將啟用（不需勾選）」列出，讓使用者知道 | 發行版內 | — | 無 | 固定項 | — |
| P-5 網路模式 | **只在 connect-test 失敗且 `actual = nat`** 時（事前不知道是否需要，不放進第一份清單） | connect-test 的錯誤畫面多一個動作「改用 Mirrored 並重試」→ 小型同意框：`.wslconfig` `[wsl2] networkingMode=mirrored`（INI 編輯器，備份 `.wslconfig.bat-backup-<系統時間>`）→ `wsl --shutdown` → 等 holder 拉起 → 重跑 connect-test | 不需要（寫使用者目錄） | `wsl --shutdown` | **全機所有發行版關閉**；同意框列出目前 Running 的發行版 | 選用、預設不勾 | 有備份 |
| P-6 `instanceIdleTimeout=-1` | 使用者要「BAT 沒開也要能連」 | `.wslconfig` `[general] instanceIdleTimeout=-1` → `wsl --shutdown` | 不需要 | 全機 | 全機所有發行版不再閒置關閉（耗記憶體） | 選用、預設不勾 | 有備份。**建議不做**（D128 已選 holder；T0830 再給每個 profile 開關），見 Q-5 |
| P-7 WSL 太舊 | `wsl --version` 失敗（inbox 舊版）或 < 2.0.4（沒有 `wslinfo`） | `wsl --update`（有 `--web-download` 備援） | **需要**（與 Phase 3 共用提權） | 推論：更新會停掉 VM | 全機 | 必要（< 2.0.4 時 systemd / wslinfo 不可靠） | 不可逆（只能往前）。實作放 Phase 3 P3-a；P3-a 之前只提示 |
| ＋ 埠 | 既有（T0382） | 既有自動行為不變 | — | — | — | 不列入 | — |

**「一次同意」清單 UI**

- runner 新增 `ctx.requestConsent({ stepId, items }) → Promise<string[] | null>`，包裝方式比照 `requestChoice`（`maybeWrapInputRequests`，`wizard-runner.ts:763-`，step 為 `kind:'input'` 時切 `awaiting-input`）。item：`{ id, labelKey, detailKey, scope: 'machine'|'distro'|'user', effects: ('elevation'|'reboot'|'shutdown-all-distros'|'terminate-distro'|'long-running')[], required, defaultChecked, disabledReasonKey? }`。
- Shell 新增 checklist 元件（在精靈畫面內，不是另一個 Dialog；若做成 Dialog 必須照 CLAUDE.md 用 `ModalOverlay`、給 `onEscape`）：每項顯示範圍標籤（全機 / 此發行版 / 此使用者）與副作用；有任何 `shutdown-all-distros` / `terminate-distro` 時，確認鈕上方一行總結並列出目前 Running 的發行版名稱。
- `required` 沒勾 → 停在 plan 步驟並說明（可取消）；`optional` 沒勾 → 寫 `ctx.warnings`、繼續。勾選結果存 `ctx.state.wslApprovedItems`（Phase 3 接續要用）。

**失敗處理與可逆性**

- 每項修正冪等、執行前重新偵測（已符合就跳過）、執行後重新驗證；不信 exit code。
- 必要項失敗 → `apply-wsl-environment` 失敗，新錯誤碼 `wsl-set-version-failed` / `wsl-systemd-enable-failed` / `wsl-terminate-failed`，動作「重試 / 略過（可能影響連線）/ 取消」；選用項失敗 → 只寫 warning。
- 精靈取消時**不還原**環境修正（沿用 PLAN-035「失敗不回滾前步」；還原 systemd 又要再 terminate 一次），done / 取消畫面列出「已變更的項目＋備份位置」→ 需使用者確認（Q-1）。`apply-wsl-environment` 的 `rollback()` 只清 ctx，並在註解寫明理由。
- 中止（依賴 **T0830** 的 AbortSignal）：`wsl --terminate` / 寫檔很快，可中止；`--set-version` 由 LxssManager 服務執行，結束 `wsl.exe` client **推論**不會停下轉換 ⇒ 該項標「無法中止」，UI 顯示「轉換中，完成後才會停止」。
- 日誌：新程式一律走 `window.electronAPI.debug.log` / main `logger`，順便把 `wsl-flow.ts:41-45` 的 `console.*` 改掉（F4）。

#### 3. Phase 3 設計（從零安裝＋重開機接續）

**偵測（擴充 `detectWslFacts`，全部唯讀、不需提權）**

| 事實 | 取法 | 用途 |
|------|------|------|
| Windows build | `os.release()` | < 19041 → 只能手動（官方：`wsl --install` 需 Windows 10 2004 / build 19041+），錯誤 `wsl-windows-too-old` + 手動安裝連結 |
| WSL 已裝 | 既有 `isWslInstalled` | — |
| VMP / WSL 功能狀態 | CIM `Win32_OptionalFeature`（`powershell -NoProfile -NonInteractive -Command` 固定字串，或 `dism /online /get-featureinfo` 需提權 ⇒ 用 CIM） | 安裝後判斷是否要重開機 |
| 待重開機 | `HKLM\…\Component Based Servicing\RebootPending` 是否存在（`reg.exe query` execFile 陣列） | 同上 |
| 提權能力 | `whoami /groups`：High Mandatory Level（既有）＋ Administrators `S-1-5-32-544` 是否在群組內（含 deny-only = 已拆分權杖、UAC 開啟）；`EnableLUA`（`reg.exe query HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System /v EnableLUA`） | 三態：已提權（直接執行）/ 可經 UAC 提權 / 無法提權（標準使用者＋UAC 關閉 → 項目停用、提示找系統管理員） |
| WSL 原則 | `HKLM\SOFTWARE\Policies\WSL`：`AllowWSL=0`、`AllowInboxWSL`、`AllowNetworkingModeUserSetting=0`、`DefaultNetworkingMode`（WSL ADMX） | 被原則擋 → 只提示、不自動做（`wsl-policy-blocked`）；網路模式原則存在時 P-5 不提供 |
| 韌體虛擬化 | CIM `Win32_Processor.VirtualizationFirmwareEnabled`（Hyper-V 已執行時此值不可靠，**推論**） | VMP 已啟用但 WSL2 起不來（0x80370102 類）時的提示，不自動做 |

**安裝流程**

1. `detect-env` 在 WSL 未安裝時**不再 preflight 失敗**，改記 facts（Windows 非 win32 仍失敗）；`plan-wsl-environment` 列「安裝 WSL（全機、需提權、可能需要重開機）」與「安裝 Ubuntu-24.04」。
2. 安裝 WSL：`wsl --install --no-distribution`（不帶 distro，避免第一次就觸發發行版下載與 OOBE；T0380 引的 WSL#41785：WSL 已可用時 `--install <distro>` 仍可能誤觸 DISM 要求重開機 ⇒ 先裝本體、重新偵測、再裝發行版）。Store / 網路被擋時重試一次 `--web-download`。不用 `--inbox`（2.7.14 help 沒有）。
3. 提權方式（🔴 不得 shell 字串拼接）：
   - BAT 已提權（`EnableLUA=0` 的管理員、或以系統管理員執行）→ `execFile('<SystemRoot>\System32\wsl.exe', ['--install', '--no-distribution'])`。
   - 需要 UAC → `execFile('<SystemRoot>\System32\WindowsPowerShell\v1.0\powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ELEVATE_WSL_INSTALL])`，`ELEVATE_WSL_INSTALL` 是程式內常數字串（`Start-Process -FilePath "$env:SystemRoot\System32\wsl.exe" -ArgumentList '--install','--no-distribution' -Verb RunAs -Wait -PassThru`，取 `ExitCode`；使用者按「否」時 `Start-Process` 丟例外 → 腳本 `exit 1223`）。**沒有任何外部輸入進入腳本文字**；需要的參數（例如 `--web-download`）用另一個常數腳本，不做組字串。絕對路徑理由同 `windows-elevation.ts:15-16`（PATH 上可能有別的同名程式）。
   - 1223 → `wsl-elevation-denied`（重試 / 取消）；無法提權 → `wsl-elevation-unavailable`。
   - `wsl --update`（P-7）走同一個機制。
4. 安裝後**一律重新偵測**：`wsl --status` exit 0 且無 RebootPending → 同一次精靈繼續裝發行版；否則進入「需要重開機」。exit code 與「待重開機」的實際樣貌仍**無法判定**（T0380 已列，需乾淨機器實測），所以判斷以重新偵測為準。
5. 發行版（P3-c）：`wsl --install -d Ubuntu-24.04 --no-launch`（WSL 已裝時不需提權；卡 0% 時 `--web-download` 重試）。WSL 2.4.4+ 的 tar 格式發行版有 `/etc/wsl-distribution.conf` `[oobe] command` / `defaultUid`，官方：OOBE「runs the first time the user opens an interactive shell」⇒ 以 `wsl -d <d> -u root --exec useradd -m -u 1000 -s /bin/bash -G sudo <user>` **非互動**建立 uid 1000 的使用者，Ubuntu 的 OOBE 看到 uid 1000 已存在應會跳過（官方範例腳本是這樣寫；Ubuntu 實際腳本**需實測**）。密碼經 stdin 給 `chpasswd`（不放 argv、不寫 log）；`wsl --manage <d> --set-default-user <user>`（2.7.14 有），失敗時退回 `/etc/wsl.conf [user] default=`（INI 編輯器）；`wsl --terminate <d>`；systemd 若沒開由 P-2 處理（Ubuntu 24.04 映像預設 `systemd=true` 為**推論**）。使用者名稱白名單 `^[a-z_][a-z0-9_-]{0,31}$`。
   - 選項：`--name <名稱>`（2.4.4+）可另裝 **BAT 專用發行版**，完全不碰使用者既有的 Ubuntu → Q-3。

**重開機判斷與接續**

- 「需要重開機」= 安裝後重新偵測 WSL 仍不可用，且（RebootPending 存在 或 VMP 狀態不是 Enabled）。兩者都不成立但 WSL 仍不可用 → 失敗，不叫使用者重開（避免無限重開）。
- 進度持久化：`<userData>/wizard-resume.json`，**只由 main 讀寫**（renderer 不碰 fs），模組 `electron/wizard-resume.ts`（不 import electron、不在 import 期取 userData，照 CLAUDE.md Logging 節規則 ②）：

  ```json
  { "v": 1, "flow": "wsl", "profileName": "...", "createdAt": "<系統時間>",
    "approvedItems": ["install-wsl", "install-distro", "systemd"],
    "phase": "awaiting-reboot", "bootTimeMs": 1730680000000, "appVersion": "x.y.z" }
  ```

  不序列化 runner 狀態（步驟冪等，接續 = 從頭跑精靈、偵測很快）。`bootTimeMs` 用 `Date.now() - os.uptime()*1000`（不必 spawn；比較時容許 ±120 s）；超過 7 天的接續檔丟棄並提示。
- 恢復入口（T0380 方案 A＋B，維持推薦）：
  - A（保底，所有情況）：main 啟動時讀接續檔；renderer 經本機 `ipcMain.handle('wizard-resume:take')` 查詢，**第一個問的主視窗拿到、之後回 null**（比照 `terminal-server:query-upgrade-interruption` 的「只顯示一次」做法）→ App 開 Profiles → 開 WSL 精靈並帶入 `approvedItems`：重新算出的計畫 ⊆ 已同意項目時不再問，只顯示「接續中」；多出新項目才再問。開機時間沒變（還沒重開）→ 顯示「仍需重開機」與「稍後 / 放棄」。detached 視窗、遠端 profile 視窗不接（精靈只在本機主視窗）。
  - B（重開機後自動回來）：`reg.exe add HKCU\Software\Microsoft\Windows\CurrentVersion\RunOnce /v BetterAgentTerminalWslWizard /t REG_SZ /d "\"<process.execPath>\" --resume-wizard=wsl" /f`（execFile 陣列；值只含 `process.execPath`，非外部輸入）；**只在 `app.isPackaged`**；接續完成 / 放棄時 `reg.exe delete`。RunOnce 是一次性，**不需要**開機自動啟動（不用 `setLoginItemSettings`）。
  - `--resume-wizard` 的 argv：BAT 已在執行時經 `second-instance` 進來 → 🔴 必須在 `main.ts:2129` handler 的 `--profile` / 開新視窗分支**之前**攔下，改成把現有主視窗帶到前面並送接續事件（否則會多開一個視窗）；第二個實例仍照 T0825 在 whenReady 開頭 return（不動）。BAT 沒在執行時，本程序自己啟動、照 A 處理。
- 「立即重開機」按鈕：`shutdown.exe /r /t 30 /c <固定訊息>`（execFile），按下前再確認一次，且只在使用者點擊時執行，BAT 絕不自動重開 → Q-2。
- 取消與失敗回復：等待重開機時取消 → 刪接續檔與 RunOnce；已安裝的 WSL / 發行版**不解除安裝**（解除安裝是破壞性動作且可能刪資料，只在畫面說明如何手動移除）。重開後偵測仍失敗 → 正常錯誤畫面（重試 / 取消），不再寫 RunOnce（避免每次登入都跳出來）。

#### 4. 風險與不做的事（只提示、不自動做）

- WSL 原則：`AllowWSL=0`、`AllowNetworkingModeUserSetting=0`、`DefaultNetworkingMode`（企業管控；原則會蓋過 `.wslconfig`，改了也無效）。
- 使用者已自訂的 `.wslconfig`：`networkingMode` 已宣告為非 mirrored 的值、或已有 `[general] instanceIdleTimeout` → 不覆寫，只提示；`.wslconfig` 解析失敗（格式錯）→ 不寫入（避免把壞檔再改壞），只提示。
- Windows build < 19041、ARM 或韌體虛擬化關閉、標準使用者＋UAC 關閉 → 只提示。
- 永不自動：`wsl --unregister`、`wsl --shutdown`（一律單獨同意）、重開機（只有使用者按鈕）、開機自動啟動 BAT、非 Ubuntu 發行版安裝（PLAN-035 不在範圍）、改 Windows Store / 代理設定。
- 大型 WSL1 發行版轉 WSL2：預設不勾、提示先 `wsl --export` 備份。
- 未證實的假設（實作單要實測）：`[boot] systemd` 只 `--terminate` 是否生效；`wsl --install` exit code 與待重開機狀態；tar 格式 Ubuntu 的 OOBE 在 uid 1000 已存在時是否跳過；`--set-version` 中止行為；`wsl --update` 是否停 VM；root 預設使用者下 bat-server user service 是否可用。本機（已安裝 WSL）可以用**拋棄式發行版**驗證前兩題以外的大部分 Phase 2 項目（見第 5 題）。

#### 5. 測試策略

- **unit（vitest，每張單都要）**：INI 逐行編輯器（`.wslconfig` 與 `/etc/wsl.conf` 共用：CRLF/LF、BOM、UTF-16、註解、大小寫、重複 key、缺 section）、facts → plan 純函式（各組合與 required / optional / disabled）、提權結果對應（0 / 1223 / 其他）、接續檔 schema / 過期 / 開機時間比較、使用者名稱白名單、RunOnce argv 組裝、`second-instance` 分支（source guard）。child_process 沿用 `setExecFileImplForTests`（`wsl-detect.ts:46`、`wsl-systemd.ts:40`）。runner `requestConsent` 比照 `__tests__/wizard-runner.transitions.test.ts`；Shell checklist 用 RTL；新 Dialog 進 `dialog-escape.test.tsx` 規則。
- **GitHub hosted Windows runner**：查到的資料都說 hosted runner 沒有 WSL2（缺 nested virtualization，只有 WSL1；`wsl --install` 在 workflow 失敗），有第三方 action 宣稱可升 WSL2 但不可靠 ⇒ **CI 只跑 unit，不做真安裝**。
- **本機實測（Phase 2，不碰使用者的 Ubuntu-24.04）**：用 `wsl --import BAT-T-<單號> <dir> <rootfs.tar> --version 1` 匯入拋棄式發行版（`systemd=false`、WSL1、預設 root），跑 P-1 / P-2 / P-3 / linger / 中止；結束 `--unregister` 該拋棄式發行版。🔴 這會在使用者機器上新增 / 刪除發行版，實作單要先取得使用者同意；P-5 / P-6（`--shutdown` 全機）只在使用者同意的時段做。
- **Phase 3 實機**：需要乾淨 Windows VM（Win11 24H2+ 與 Win10 22H2 各一，UAC 開＋管理員、UAC 開＋標準使用者、UAC 關＋標準使用者），VM 要開 nested virtualization 才能跑 WSL2（Hyper-V：`Set-VMProcessor -ExposeVirtualizationExtensions $true`），用檢查點重複跑。本機 `Microsoft-Hyper-V-All` 未啟用、Windows Sandbox 未啟用（且 Sandbox 不適合測重開機）⇒ 驗收環境要使用者決定（Q-6）。
- **每張實作單的驗收**：`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npx vite build`；既有精靈測試（`src/components/setup-wizard/__tests__/` 全部、`tests/` 的 WSL 精靈測試經 `npm run test:legacy`）不回歸；Phase 2 單加本機拋棄式發行版實測紀錄；Phase 3 單交 VM 實測（P3-d）。發版後依慣例跑 NSIS 完整重裝驗收。

### 建議方向

| 方案 | 內容 | 評價 |
|------|------|------|
| A. 一張大單做完 Phase 2＋3 | — | ❌ 提權 / 重開機無法在本機驗，單會卡在 PARTIAL；框架改動與 T0830 衝突 |
| **B. 先 Phase 2、共用基礎先行，再疊 Phase 3（推薦）** | 先做不需提權、本機可測的部分（INI 編輯器、facts / plan、requestConsent、systemd / WSL2 / 預設使用者修正），再做安裝、提權、接續 | ✅ 最常見的實際問題（systemd 沒開會在第 8 步才失敗）最先解決；Phase 3 直接重用清單與事實收集 |
| C. Phase 3 半自動 | 只做「提權執行 `wsl --install` → 請使用者自己重開 → 下次開 BAT 時偵測接續（方案 A）」，不寫 RunOnce | 可作為 B 的 Phase 3 降級版：若使用者不想讓 BAT 寫 RunOnce（Q-7），P3-b 去掉 RunOnce 即是此方案 |

推薦 **B**。Phase 2 的使用者價值最高的是 P-2（systemd），其次 P-1；網路模式維持「連線失敗才提議」（T0383 / T0653 的結論不變）。

### 建議下一步

**拆單**（依賴 T0830 的部分已標註；W1、W2 與 T0829 / T0830 無檔案重疊，可並行）

| 單 | 範圍 | `affects_files` 預估 | 規模 | 依賴 | 並行 | 驗收 |
|----|------|---------------------|------|------|------|------|
| W1（P2-a） | INI 逐行編輯器（純函式，`.wslconfig` / `/etc/wsl.conf` 共用）＋備份檔名規則；`KNOWN_NETWORK_MODES` 補 `consomme`（`wsl-detect.ts:247`，`virtioproxy` 保留相容） | `electron/ini-line-editor.ts`（新）、`electron/wsl-detect.ts`、`electron/__tests__/` | S | 無 | 可（與 T0829 / T0830 並行） | unit |
| W2（P2-b） | `detectWslFacts`（版本、發行版、systemd、預設使用者 uid、Running 清單、原則鍵、Windows build）＋ facts → plan 純函式 | `electron/wsl-detect.ts`、`electron/wsl-facts.ts`（新）、`src/components/setup-wizard/wsl-env-plan.ts`（新）、`electron/main.ts` + `electron/preload.ts` + `src/types/electron.d.ts`（IPC）、tests | S-M | 無（W1 的 parser 可共用但不阻擋） | 可與 W1 並行；與 T0830 只在 `main.ts` / `preload.ts` 不同段落 | unit |
| W3（P2-c） | runner `requestConsent` + Shell checklist + `plan-wsl-environment` / `apply-wsl-environment` + P-1 / P-2 / P-3 / P-4 + `wsl-systemd-check` 改成驗證 + 錯誤碼 + i18n（en / zh-TW / zh-CN）+ `wsl-flow.ts` logger 改 debug.log + `docs/wsl-deployment.md` | `src/components/setup-wizard/`（`wizard-runner.ts`、`SetupWizardShell.tsx`、`wsl-flow.ts`、`steps/wsl/`、`error-mapper.ts`）、`electron/wsl-systemd.ts` 或新 `electron/wsl-env-apply.ts`、`electron/main.ts` / `preload.ts` / `src/types/electron.d.ts`、`src/locales/*.json`、tests、`docs/wsl-deployment.md`、`CHANGELOG.md` | M-L | W1、W2、**T0830**（runner 的 AbortSignal 與 Shell 的中止 UI 同檔） | ❌ 不可與 T0830 並行 | unit + RTL + 既有精靈測試 + 本機拋棄式發行版實測（需使用者同意） |
| W4（P2-d） | connect-test 失敗時的「改用 Mirrored 並重試」（P-5，含原則檢查與 Running 發行版列表）；P-6 依 Q-5 決定做或不做 | `steps/wsl/connect-test.ts`、`error-mapper.ts`、`electron/wsl-env-apply.ts`、locales、tests、docs | S-M | W1、W3 | 否（同改精靈） | unit + 使用者同意時段的 `--shutdown` 實測 |
| W5（P3-a） | 提權能力 / 待重開機 / 原則 / build / 韌體虛擬化偵測；提權執行 `wsl --install --no-distribution`、`wsl --update`（P-7）；`detect-env` 不再 preflight 失敗；計畫加入安裝項目；錯誤碼 `wsl-elevation-denied` / `-unavailable` / `wsl-policy-blocked` / `wsl-windows-too-old` / `wsl-reboot-required` | `electron/wsl-install.ts`（新）、`electron/windows-elevation.ts`、`steps/wsl/detect-env.ts`、`wsl-env-plan.ts`、`error-mapper.ts`、main / preload / types、locales、tests、docs | M | W3 | 否 | unit（提權結果對應、argv 常數 source guard）；真安裝留給 W8 |
| W6（P3-b） | `wizard-resume.ts` + `wizard-resume:take` IPC + RunOnce（依 Q-7）+ `--resume-wizard` 在 `second-instance` 的分支 + App 啟動時開 Profiles / 精靈 + 「立即重開機」（依 Q-2） | `electron/wizard-resume.ts`（新）、`electron/main.ts`、`preload.ts`、`src/types/electron.d.ts`、`src/App.tsx`、`src/components/ProfilePanel.tsx`、`SetupWizardShell.tsx`、locales、tests、docs | M | W5（重開機判斷）；介面先約定的話可與 W7 並行 | 可與 W7 並行 | unit（檔案 schema、過期、開機時間、只給第一個視窗、second-instance source guard） |
| W7（P3-c） | 發行版安裝 + 非互動建立 uid 1000 使用者（`chpasswd` 走 stdin）+ `--set-default-user` + `requestText` 遮罩輸入（若 Q-4 選輸入密碼）+ P-3 的建立使用者共用 | `electron/wsl-install.ts`、`steps/wsl/pick-wsl-distro.ts`、新輸入步驟、`wizard-runner.ts`（`WizardTextRequest.secret`）、`SetupWizardShell.tsx`、locales、tests | M | W5 | 可與 W6 並行（`wizard-runner.ts` / Shell 有小重疊，要排序合併） | unit + 本機拋棄式匯入發行版測使用者建立（需同意） |
| W8（P3-d） | 實機驗收：乾淨 VM 矩陣（Win11 / Win10 22H2 × UAC 開＋管理員 / UAC 開＋標準使用者 / UAC 關＋標準使用者），從零安裝、拒絕 UAC、重開機接續、RunOnce、OOBE、取消 | 只寫驗收單 | M | W1–W7 + 安裝版 | — | 使用者 / 塔台實機 |

**需要使用者裁決的問題**

1. **Q-1 精靈取消時，已套用的環境修正（systemd、WSL2 轉換、`.wslconfig`）要不要還原？** 建議：不還原（還原又要 terminate / shutdown），保留備份並在畫面列出已變更項目。
2. **Q-2 BAT 要不要提供「立即重開機」按鈕？** 建議：提供，按下前再確認一次、30 秒倒數；BAT 絕不自動重開。
3. **Q-3 Phase 3 的發行版：** 沒有任何發行版時裝 `Ubuntu-24.04`；已有發行版但都不適合（WSL1 / 不想動）時，是否另裝 **BAT 專用發行版**（`--name`，例如 `BAT-Ubuntu-24.04`）？建議：提供這個選項，預設仍是讓使用者選既有發行版。
4. **Q-4 新建 Linux 使用者的密碼：** 在精靈輸入（要新增遮罩輸入欄）或不設密碼（`sudo` 不能用，之後使用者自己 `passwd`）？建議：精靈輸入。
5. **Q-5 「BAT 沒開也要能連」（`instanceIdleTimeout=-1`，全機）要不要做？** 建議：不做（D128 已選 holder，T0830 又加每個 profile 的開關）。
6. **Q-6 Phase 3 實機驗收環境：** 本機沒有啟用 Hyper-V；是否另備 VM（需 nested virtualization）或其他實體機？沒有環境時 W5–W7 只能交 unit 測試、W8 延後。
7. **Q-7 要不要寫 HKCU RunOnce 讓重開機後自動開 BAT？** 建議：要（只在安裝版、一次性、完成或放棄時刪除）；不要的話 P3-b 只做「下次開 BAT 時接續」（方案 C）。

### 驗證證據分道

| 分道 | 結果 |
|------|------|
| 原始碼核對 | PASS（`檔案:行` 見〈調查結論〉第 1 題） |
| 本機唯讀查詢 | PASS（`wsl --version` / `--status` / `-l -v` / `--help`、發行版內 `wslinfo --help` / `cat /etc/wsl.conf` / `systemctl is-system-running` / `id -un`、CIM `Win32_OptionalFeature`、登錄 `RebootPending` / `Policies\WSL` 是否存在）；發行版原本就是 Running，沒有啟動或停止任何發行版 |
| 外部文件（查詢日期 2026-11-04） | PASS：[Basic commands for WSL](https://learn.microsoft.com/en-us/windows/wsl/basic-commands)（`--install` 選項、`--inbox` / `--no-distribution` / `--web-download`、`--set-version` 警告）；[Install WSL](https://learn.microsoft.com/en-us/windows/wsl/install)（build 19041+、系統管理員、重開機、`--web-download` 解 0%）；[Advanced settings configuration](https://learn.microsoft.com/en-us/windows/wsl/wsl-config)（8 秒規則、`[boot] systemd`、`instanceIdleTimeout` 15000、`networkingMode` 含 `consomme`、`.wslconfig` 缺失 / 格式錯會被忽略）；[Intune settings](https://learn.microsoft.com/en-us/windows/wsl/intune) 與 [WSL.admx](https://github.com/microsoft/WSL/blob/master/intune/WSL.admx)（原則鍵 `Software\Policies\WSL`）；[Build a Custom Linux Distro](https://learn.microsoft.com/en-us/windows/wsl/build-custom-distro)（2.4.4+ tar 格式、OOBE 在第一次互動 shell 執行、`defaultUid`、`--name`）；hosted runner 無 WSL2：[Ubuntu blog](https://ubuntu.com/blog/improved-testing-ubuntu-wsl)、[Vampire/setup-wsl](https://github.com/vampire/setup-wsl)、[vedantmgoyal9/setup-wsl2](https://awesome.ecosyste.ms/projects/github.com%2Fvedantmgoyal9%2Fsetup-wsl2)（資料偏舊、彼此不完全一致，結論標為「CI 不做真安裝」） |
| build / tests | N/A（研究單，沒有改程式碼） |
| 乾淨機器 / UAC / 重開機 / OOBE | BLOCKED（超出本單權限；列入 W8 與〈風險〉的未證實假設） |

### Renew 歷程

（無）

### 遭遇問題

- 無阻擋。`wsl --help` 仍以 exit 255 結束（T0380 已知，不影響）。
- 官方文件列的 `wsl --install --inbox` 在本機 2.7.14 的 help 沒有出現；設計不使用它。

### 回報時間

2026-11-04T09:00:41+0800（填寫開始時取的系統時間；完成時間見 frontmatter `completed_at`）
