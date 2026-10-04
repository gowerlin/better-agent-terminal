---
schema_version: 1
schema_kind: workorder
id: T0380
title: "研究：WSL 環境全自動化（PLAN-035）—— 各環節指令 / 提權 / 重開機接續 / 常駐 / 網路模式判定"
type: research
status: DONE
priority: P1
sizing: M
created_at: "2026-10-04T22:04:14+08:00"
updated_at: "2026-10-04T22:17:41+08:00"
started_at: "2026-10-04T22:06:12+08:00"
completed_at: "2026-10-04T22:17:41+08:00"
target_version: next
depends_on: []
related:
  - "PLAN-035（本研究服務的計劃）"
  - "BUG-089（網路模式誤判，研究目標 4）"
  - "BUG-087 / T0378 / D126（linger、絕對路徑、不回滾、WSL exit code 偵測）"
  - "BUG-071 / PLAN-031（server bundle 下載與安裝）"
  - "PLAN-032（精靈 Stepper / awaiting-input / error mapping 框架）"
affects_files: []
interaction:
  mode_hint: on
  interactive: true
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **研究工單，不改產品程式碼、不 commit 本工單檔以外任何檔案**。實驗腳本放 scratchpad，結束前清乾淨。"
  - "🔴 **不得變更使用者 WSL 環境**：不改 `%USERPROFILE%\\.wslconfig`、不 `wsl --shutdown`、不 `wsl --install` / `--update` / `--unregister`、不改發行版內 `/etc/wsl.conf`、不停用 / 移除 Windows 功能。唯讀查詢（`wsl -l -v`、`wsl --status`、`wsl --version`、`wslinfo`、發行版內唯讀指令）可以。"
  - "⚠️ 對 `Ubuntu-24.04` 執行任何指令會**啟動**該發行版。研究目標 3（常駐）需要觀察閒置關閉行為，啟動 / 觀察前先問使用者（使用者可能正在跑精靈驗收）。"
  - "⚠️ 需要破壞性實驗（例如驗證 `wsl --install` 流程、重開機接續）時，**只做文件 / 官方說明查證**，或提出實驗方案問使用者，不得自行執行。"
---

# T0380 — 研究：WSL 環境全自動化

## 元資料

- **類型**：research
- **互動模式**：enabled（每次 ≤ 3 題）
- **工作量預估**：M
- **Context Window 風險**：中（官方文件 + 精靈程式碼多檔）

## 背景

使用者裁決（D127 / PLAN-035）：WSL 精靈要能從「Windows 未安裝 WSL」一路自動到可用的 BAT 伺服器；環境不符時自動修正。同意模型為**先偵測 → 列清單 → 一次同意**；WSL 未安裝時**全自動含重開機後接續**。本研究為 PLAN-035 Phase 0，產出要能直接拆成實作工單。

## 已知資訊（塔台 2026-10-04 21:58-22:04 檢查，請自行複核）

- WSL 2.7.13.0；唯一發行版 `Ubuntu-24.04`（VERSION 2，預設）
- 使用者 BUG-087 驗收：精靈第 1-5 步 ✓（含「寫入 systemd 使用者服務」），第 6 步「取得 TLS 指紋」進行中顯示 NAT 警告
- 塔台 21:58 查：`Ubuntu-24.04` 為 **`Stopped`**（精靈第 6 步期間）⇒ bat-server 不可能在跑
- `.wslconfig`：`[wsl2] networkingMode=Mirrored`、`[experimental] hostAddressLoopback=true`、`bestEffortDnsParsing=true`
- 本機 `EnableLUA=0`（UAC 停用，BAT 與子 shell 皆提權，見 BUG-085）—— 提權行為與一般使用者環境不同，研究結論須涵蓋 UAC 開啟的情況
- 程式碼入口：
  - `electron/wsl-detect.ts`（`detectNetworkMode` :220-239 為 BUG-089）
  - `electron/wsl-systemd.ts`、`electron/wsl-validate.ts`
  - `src/components/setup-wizard/steps/wsl/`：`detect-env` / `pick-wsl-distro` / `wsl-systemd-check` / `install-server-bundle`（:107 呼叫 detectNetworkMode）/ `write-systemd-unit` / `fetch-fingerprint` / `connect-test` / `write-profile` / `done`
  - 精靈框架（PLAN-032）：runner、awaiting-input、preflight cache、error mapping

## 研究目標

1. **各環節指令與前提**（PLAN-035 範圍表環節 1-8）：每個環節的偵測指令、修正指令、是否需提權、是否需重開機 / `wsl --shutdown` / `--terminate`、冪等性、失敗型態與 exit code。特別是：
   - `wsl --install --no-distribution` 在 Windows 10 / 11 各版本的行為差異、何時需要重開機、如何偵測「已裝但待重開機」
   - 發行版安裝後**非互動建立預設使用者**的可靠做法（`--no-launch` 後以 root 建使用者 + `/etc/wsl.conf [user] default=`，或其他）
   - 改 `.wslconfig` 時保留既有內容的做法（INI 格式、大小寫、註解）
2. **重開機接續機制**：精靈進度持久化位置與格式；開機後如何回到精靈（BAT 開機自啟？`RunOnce`？使用者下次開 BAT 時偵測未完成精靈？）。比較方案並推薦，評估對既有精靈框架的改動量
3. **常駐（keep-alive）**：
   - **證實或排除**：bat-server 以 systemd user service + linger 執行時，沒有 `wsl.exe` 連線，WSL 會在閒置後關閉發行版（觀察前先問使用者）
   - 若證實：比較方案——`.wslconfig` 的 idle timeout 類設定（查 2.7.x 支援哪些鍵、作用於 VM 還是 instance）、BAT 持有長駐 `wsl.exe -d <distro>` 子行程、Windows 登入排程啟動、其他；考慮 BAT 未執行時遠端是否仍需可用
4. **網路模式判定（BUG-089）**：Mirrored 下 `ip route show default` 實際輸出；`wslinfo --networking-mode` 可用性（哪個版本起）；「`.wslconfig` 已設但未生效」如何偵測；Mirrored / NAT 下 `localhost` 連入 bat-server 的實際差異（決定 NAT 是否真需要修正，還是只要 connect-test 正確處理）
5. **同意清單 UI 與精靈框架整合**：在 PLAN-032 框架上，「偵測 → 清單 → 一次同意 → 執行」應放在哪一步、如何呈現影響範圍（全機 / 單一發行版）、未勾選項目如何影響後續步驟
6. **實作拆單建議**：依 PLAN-035 Phase 1-3 給出工單切分、各單 `affects_files`、依賴順序、測試策略（unit 可測的部分 vs 必須實機的部分）、風險

## 調查範圍

- ✅ 上列程式碼只讀；Microsoft 官方 WSL 文件與 release notes；唯讀 `wsl` 查詢
- ✅ BAT debug log：`%APPDATA%\better-agent-terminal\Logs\debug-<stamp>.log`（L128），可查精靈第 6 步實際發生了什麼
- ❌ 不改 `src/` `electron/` `package*.json`；不改 WSL / Windows 設定；不發 release

## 互動規則

- 每次 ≤ 3 題；能用唯讀查詢或文件回答的不要問
- 啟動 / 觀察 `Ubuntu-24.04` 前先問使用者

## 回報要求

- 研究目標 1-4 每項結論標註 **證實 / 排除 / 無法判定** 並附證據（指令輸出、文件連結、行號）
- 目標 3 若證實，明確建議是否新開 BUG（嚴重度建議）
- 目標 6 的拆單可直接作為塔台開單依據
- 列出需要使用者實機驗證、Worker 無法驗證的項目

## Sub-session 執行指示

1. 讀取本工單全部內容 + `PLAN-035` + `BUG-089`
2. 填入 `started_at`、`status: IN_PROGRESS`（**用 `date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，R-G001）
3. 依研究目標 1 → 6 調查
4. 填寫回報區、更新 `status` / `completed_at` / `updated_at`；完成請寫 **`DONE`**（不是 `FIXED`）
5. commit **僅本工單檔**（`git commit --only _ct-workorders/T0380-research-wsl-environment-automation.md`）
6. 依派發 mode 通知塔台（`bat-notify.mjs`）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 落點檢查（Landing Zone）

| 檢查 | 結果 | 說明 |
|------|------|------|
| C-0 repo identity | ⚠️ WARN | frontmatter 無 `repo` 欄位（`absent`）；`basename(REPO_ROOT)` = `better-agent-terminal` |
| C-1 work order path | ✅ PASS | 工單位於 `REPO_ROOT/_ct-workorders/` |
| C-3 affects_files | ℹ️ N/A | `affects_files: []`（研究單） |
| C-2 branch | ℹ️ N/A | 工單無 `branch` 欄位；實際分支 `main` |
| 證據 | — | `BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`；`CT_MODE=on`、`CT_INTERACTIVE=1` |

整體：**WARN**（只有 C-0 欄位缺失），繼續執行。另外，工單原始 `status: TODO`（不是 `PENDING`），視為未開始，直接轉 `IN_PROGRESS`。

### 結論摘要（給塔台先看）

1. 🔴 **WSL 精靈在預設設定下不可能完成**。原因有三個，彼此獨立，而且都跟 NAT 警告無關：
   - **埠衝突**：主機 BAT 自己的 RemoteServer 預設 auto-start 在 `127.0.0.1:9876`，WSL 精靈也把 bat-server 設在 `9876`。Mirrored 模式下 Linux 綁同一個埠會 `EADDRINUSE`，服務無限重啟（journal 實測）。
   - **`startService` 誤判成功**：`Type=simple` 一 fork 就是 `active`，`is-active` 輪詢第一次看到 `active` 就回成功，但程序約 100ms 後就以 status=1 退出。
   - **指紋步驟永久卡住**：`wsl:fetch-fingerprint` 對 `https://localhost:<port>/fingerprint` 發 GET，但**整個 server 沒有任何 HTTP request handler**（`https.createServer({ cert, key })` 沒掛 listener，只處理 WebSocket upgrade），請求永遠等不到回應；IPC handler 又沒設 timeout ⇒ 第 6 步永遠「進行中」，取消也解不開（runner 卡在 `await step.run()`）。實測連到的是**主機 BAT 自己**（PID 16928，指紋 `61:E3:BA:4E:55:F3:12:F0` 跟主機 log 一致）：TLS 握手 14ms 完成，之後 8 秒沒有任何 HTTP 回應。
2. ✅ **常駐問題證實**：bat-server 以 systemd user service + linger 執行時，最後一個 `wsl.exe` 結束約 15 秒後發行版就被關掉（等於 `[general] instanceIdleTimeout` 預設 15000ms）；持有一個長駐 `wsl.exe` 就能保活。**建議新開 BUG（High）**。
3. ✅ **BUG-089 證實**：`wslinfo --networking-mode` 回 `mirrored`，但 `ip route show default` 是 `default via 192.168.88.254 dev eth1 proto kernel metric 271`（含 ` via `），所以被判成 NAT。
4. NAT 模式**不需要強制改成 Mirrored**：NAT 預設 `localhostForwarding=true`，Windows 端用 `localhost` 就能連到 Linux 綁在 `127.0.0.1` 的服務。真正要處理的是「這個埠在 Windows 端必須空著」，這點兩種模式都一樣。⇒ 環節 6（網路模式）應改成**選用、預設不勾**（影響全機，而且需要 `wsl --shutdown`）。
5. 建議 Phase 1 先開 **4 張單**（指紋、埠 + startService、BUG-089、常駐），再做 Phase 2/3；拆單見目標 6。

### 研究目標 1：各環節指令與前提

本機環境（唯讀查詢，2026-10-04 22:06–22:13）：Windows 11 專業工作站版 10.0.28000；WSL 2.7.13.0、核心 6.18.33.2-2、WSLg 1.0.73.2；`VirtualMachinePlatform` / `Microsoft-Windows-Subsystem-Linux` 的 `InstallState=1`；CBS `RebootPending` 不存在；`EnableLUA=0`、`IsAdmin=True`；Lxss 登錄為 `Ubuntu-24.04 ver=2 DefaultUid=1000 RunOOBE=0 Flags=15`。`wsl --help` 列出 `--install [--from-file|--location|--name|--no-distribution|--no-launch|--version|--web-download]` 與 `--manage <Distro> --set-default-user <Username>`（`wsl --help` 本身 exit 255，不能拿來偵測）。

| # | 環節 | 偵測 | 修正 | 提權 | 重開機 / 重啟 | 冪等 | 失敗型態 | 判定 |
|---|------|------|------|------|---------------|------|----------|------|
| 1 | WSL 本體 | `wsl --status` / `wsl --version` exit 0（T0378 已實作，`electron/wsl-detect.ts:164-167`）；輔助：`Win32_OptionalFeature` 讀 `VirtualMachinePlatform` InstallState（不需提權）、`HKLM\...\Component Based Servicing\RebootPending` 是否存在 | `wsl --install --no-distribution` | 需要。wsl.exe 會自行提權（印出 "The requested operation requires elevation" 後透過 UAC 重新啟動自己，[WSL#41785](https://github.com/microsoft/WSL/issues/41785)） | 第一次啟用 VirtualMachinePlatform 時要重開機（官方 install 頁：「enter the wsl --install command, then restart your machine」） | 是（已安裝時只印說明） | 在非互動 stdin 下會失敗，解法是用 `Start-Process` 啟動（[WSL Discussion #12426](https://github.com/microsoft/WSL/discussions/12426)）；exit code 沒有官方文件 | 指令：**證實**（文件 + 本機 help）；exit code 與「待重開機」狀態：**無法判定**（需乾淨機器實測） |
| 2 | WSL 版本 | `wsl --version`（輸出為 UTF-16LE 且有在地化，要用 `WSL_UTF8=1` 或只取數字） | `wsl --update`（`--web-download` 走 GitHub） | 需要（MSI 安裝） | 更新時會停掉 VM（推論，未實測） | 是 | 網路 / Store 失敗 | 指令：**證實**（文件）；門檻建議 `>= 2.0.4`（`wslinfo --networking-mode` 從 2.0.4 才有，[2.0.4 release](https://github.com/microsoft/WSL/discussions/10590)） |
| 3 | 發行版 | `wsl -l -v`（T0378 三態） | `wsl --install -d Ubuntu-24.04 --no-launch` → `wsl -d Ubuntu-24.04 -u root -- useradd -m -s /bin/bash -G sudo <user>` → 密碼經 stdin 餵給 `chpasswd`（不可放 argv）→ `wsl --manage Ubuntu-24.04 --set-default-user <user>`（2.7.13 的 help 有此選項），或 `/etc/wsl.conf [user] default=<user>` → `wsl --terminate Ubuntu-24.04` | WSL 已安裝時不需要 | 不需重開機；需 `--terminate` 讓 default user 生效 | useradd 前先用 `id -u <user>` 判斷 | `--no-launch` 不跑 OOBE，此時只有 root（[gist](https://gist.github.com/Jaykul/2c9464a7e3a57b18f40762067bcb1078)）；下載卡在 0% 時改用 `--web-download` | 做法：**證實**（文件 + help）；端到端：**無法判定**（不得在本機安裝發行版） |
| 4 | WSL2 版本 | `wsl -l -v` 的 VERSION 欄（`wsl-detect.ts:91`） | `wsl --set-version <distro> 2` | 不需要（VMP 已啟用時） | 轉換期間發行版停止，可能耗時很久 | 是 | 官方警告轉換可能失敗，建議先備份 | **證實**（文件） |
| 5 | systemd | `systemctl is-system-running` 回 `running`（本機實測，系統層與 `--user` 都是 `running`） | `/etc/wsl.conf [boot] systemd=true`（root 寫入，保留其他段落）→ `wsl --terminate <distro>` | 發行版內 root（`wsl -u root`），不需要 Windows 提權 | 官方寫 `wsl --shutdown`，但 `[boot]` 是發行版設定，依「8 秒規則」應該 `--terminate` 單一發行版就夠（推論，需實測） | 是 | `initTimeout` 預設 10000ms | 鍵值：**證實**；`--terminate` 是否足夠：**無法判定**（需實測） |
| 6 | 網路模式 | `wslinfo --networking-mode`（在發行版內執行，2.0.4+） | `.wslconfig [wsl2] networkingMode=mirrored` → `wsl --shutdown` | 不需要（寫使用者目錄） | **全機**：關閉所有發行版 | 是 | Mirrored 需要 Windows 11 22H2+；未知值會回到 NAT | **證實**（文件 + 本機實測），見目標 4 |
| 7 | 常駐 | `wsl -l -v` 的 STATE | BAT 持有長駐 `wsl.exe -d <distro> -- sleep infinity` | 不需要 | — | 是 | — | **證實**，見目標 3 |
| 8 | linger | `loginctl show-user <u> -p Linger`（實測 `Linger=yes`） | T0378 已實作 | — | — | 是 | — | **證實** |
| ＋ | **伺服器埠（新增環節）** | Windows 端用 `net.createServer().listen(port, '127.0.0.1')` 試綁，或查 `Get-NetTCPConnection` | 選一個 Windows 端空著、且不等於主機 RemoteServer 埠的埠，寫進 unit 與 profile | 不需要 | 改埠要 `systemctl --user restart` | 是 | 見目標 6 的 P1-b | **證實**（實測 EADDRINUSE） |

**`.wslconfig` 保留既有內容的做法**：
- 格式是 INI：`[section]` + `key=value`，用 `#` 寫註解（官方範例）。**鍵名與值都不分大小寫**。證據：官方範例混用 `localhostForwarding` / `localhostforwarding`、`swapFile` / `swapfile`；本機寫的是 `networkingMode=Mirrored`（大寫 M），實際生效，`wslinfo` 回 `mirrored`。檔案缺失或格式錯誤時 WSL 會直接忽略（官方：「If the file is missing or malformed… WSL will continue to launch as normal」）⇒ 寫壞不會讓 WSL 起不來，但設定會無聲失效。
- 建議做成**純函式的逐行編輯器**（可 unit test）：找 `[wsl2]` 區段（不分大小寫）→ 已有 `networkingMode` 行就只改那一行的值，沒有就插在區段標頭下一行；沒有 `[wsl2]` 區段就加在檔尾。其他每一行（註解、空行、CRLF/LF、編碼）原樣保留。寫入前備份成 `.wslconfig.bat-backup-<系統時間戳>`，寫完重新解析一次驗證。
- 官方建議用 WSL Settings 應用程式改設定，但它沒有 CLI ⇒ 只能直接改檔。

**提權（UAC 開啟 vs 本機 `EnableLUA=0`）**：
- UAC 開啟（一般使用者環境）：用 `powershell -NoProfile -Command Start-Process -FilePath wsl.exe -ArgumentList '--install','--no-distribution' -Verb RunAs -Wait -PassThru` 取得 `ExitCode`（參數全是固定字串，符合 CLAUDE.md 的 child_process 規範）。使用者按「否」會得到 Win32 1223（ERROR_CANCELLED），應對應成「使用者拒絕提權」的錯誤碼。
- `EnableLUA=0` 且屬於 Administrators：直接執行即可（本機就是這種情況）。
- `EnableLUA=0` 但是**標準使用者**：沒有 UAC 可以提權，一定失敗，只能請系統管理員處理。清單上要事先偵測並說明（`IsInRole(Administrator)` + `EnableLUA`）。
- 只有環節 1、2 需要 Windows 提權；環節 3-8 與埠都不需要。

### 研究目標 2：重開機接續機制

| 方案 | 做法 | 優點 | 缺點 |
|------|------|------|------|
| A. 啟動時偵測未完成的精靈 | `userData/wizard-resume.json`（由 main 程序寫；D090：renderer 不碰 fs） | 不碰登錄、跨平台 | 使用者不開 BAT 就不會接續 |
| B. `HKCU\Software\Microsoft\Windows\CurrentVersion\RunOnce` | 用 `reg.exe add` 寫一次性值 `"<exe>" --resume-wizard=wsl` | 不需提權；下次登入自動開 BAT，執行一次後自動刪除 | 只有 Windows；值內容要用 execFile array args |
| C. `app.setLoginItemSettings` | Electron 開機自啟 | API 現成 | 是常駐的 Run 而不是一次性，還得記得清除；目前程式碼沒有用到（grep 0 筆） |
| D. 工作排程器 | `schtasks` 登入觸發 | 可設延遲 | 太重，要清理的東西多 |

**建議 A + B**：B 負責「重開機後自動回到 BAT」，A 負責「使用者自己打開 BAT」以及 B 失效時的保底。`--resume-wizard` 參數可以走既有的 single-instance 路徑（`electron/main.ts:185` 的 `requestSingleInstanceLock`、`:1523` 的 `second-instance` handler）。

**接續檔格式**（建議）：
```json
{ "v": 1, "flow": "wsl", "profileName": "...", "createdAt": "<系統時間>",
  "approvedPlan": ["install-wsl", "install-distro"],
  "phase": "awaiting-reboot", "bootMarker": "<上次開機時間>" }
```
- **不要序列化 WizardRunner 的中間狀態**。所有步驟本來就設計成冪等（D126），開機後重跑一次偵測就好，只需要保存「使用者已同意的項目」和「目前在等重開機」。重開機後的偵測結果跟計畫一致，就不再問一次，只顯示「接續中」。
- `bootMarker` 用 `Win32_OperatingSystem.LastBootUpTime` 判斷是否真的重開過，避免使用者還沒重開就打開 BAT 時誤以為可以繼續。
- 改動量：runner 不用改；新增 main 程序的 `wizard-resume` 模組（讀 / 寫 / 清除 + RunOnce）約 150 行，加 3 支 IPC；`ProfilePanel` 啟動時檢查並開啟精靈。估 **S-M**。

### 研究目標 3：常駐（keep-alive）——**證實**

實測（使用者 22:09 同意後執行；只建立了一個 transient unit，沒有改任何設定）：

```
22:10:43 wsl -d Ubuntu-24.04 -- systemd-run --user --unit=t0380-keepalive-probe sleep 180   # 立即返回
22:10:43 Running / 22:10:48 Running / 22:10:53 Running / 22:10:59 Stopped                  # 約 15 秒後關閉；sleep 180 還在跑也一樣
22:11:06 背景持有 wsl -d Ubuntu-24.04 -- sleep 40
22:11:11 ~ 22:11:47 每 5 秒都是 Running；22:11:49 holder 結束
22:11:52 Running / 22:11:57 Running / 22:12:02 Running / 22:12:07 Stopped                  # holder 結束後約 15-18 秒關閉
```

- 時間跟 `.wslconfig [general] instanceIdleTimeout` 吻合（預設 `15000`，設 `-1` 可停用自動關閉；[官方 wsl-config](https://learn.microsoft.com/en-us/windows/wsl/wsl-config)）。它作用在**單一發行版（instance）**；`[wsl2] vmIdleTimeout`（預設 `60000`，只有 Windows 11）作用在 **VM**。
- 有人回報 WSL 2.6.1.0 起「systemd 服務 active 時仍會被關閉」（2.5.10 不會）。該 issue 仍開著，沒有維護者回應（[WSL#13416](https://github.com/microsoft/wsl/issues/13416)）⇒ 不能指望上游修。
- journal 也顯示 22:06:16 那次開機結束時 systemd 正在 `Stopping bat-server.service`，跟塔台 21:58 看到的 `Stopped` 一致。

方案比較（使用者裁決：**只需 BAT 執行時可用**）：

| 方案 | 範圍 | 評價 |
|------|------|------|
| **BAT 持有長駐 `wsl.exe -d <distro> -- sleep infinity`** | 只影響該發行版，跟 BAT 同生命週期 | ✅ **推薦**。不用改全機設定；拉起發行版時，systemd 會依 linger + `WantedBy=default.target` 自動啟動 bat-server；BAT 結束後自然恢復 WSL 原本的閒置行為 |
| `.wslconfig [general] instanceIdleTimeout=-1` | 全機所有發行版、所有時間 | 只有使用者要求「BAT 沒開也要能連」時才列進清單（選用、預設不勾），改完要 `wsl --shutdown` |
| Windows 登入排程啟動 | 全機 | 超出使用者裁決範圍，不建議 |

保活實作要點：每個 WSL profile 一個 holder，`spawn('wsl.exe', ['-d', distro, '--', 'sleep', 'infinity'], { windowsHide: true, stdio: 'ignore' })`（distro 先過白名單）；app ready 時有 WSL profile 就啟動（或延到第一次連線前），意外結束就 backoff 重啟，`before-quit` 時 kill。精靈在 write-systemd-unit 之後也要先拉起 holder，否則跑到第 6、7 步時發行版可能已經被關掉。

**建議新開 BUG（嚴重度 High）**：WSL remote profile 沒有任何 `wsl.exe` 連線時，發行版約 15 秒後被關閉，bat-server 跟著停止 ⇒ 精靈完成後的 profile 基本上連不上（BAT 的 TCP 連線不算 WSL 活動）。

### 研究目標 4：網路模式判定（BUG-089）——**證實**

發行版內實測（22:10:25）：

```
$ wslinfo --version            → 2.7.13.0
$ wslinfo --networking-mode    → mirrored
$ ip route show default        → default via 192.168.88.254 dev eth1 proto kernel metric 271
$ ip -brief -4 addr            → lo 127.0.0.1/8 10.255.255.254/32 ; eth1 192.168.88.177/24
```

- 根因：`electron/wsl-detect.ts:232` 只要輸出含 ` via ` 就回 `'nat'`。Mirrored 模式會把主機路由表鏡像進來，default route 一定帶閘道 ⇒ 每次都誤判。
- **可靠的判定方式**：`wsl -d <distro> -- wslinfo --networking-mode`（WSL 2.0.4+，回 `nat` / `mirrored` 或其他值，例如 `none`、`virtioproxy`），argv 固定、不帶任何外部輸入。指令不存在（WSL < 2.0.4）或執行失敗時回 `'unknown'`，並**移除 route 啟發式**（它在 Mirrored 下必錯）。
- **「已設定但未生效」**：主機端讀 `.wslconfig [wsl2] networkingMode`（不分大小寫）當作 `declared`，跟 `wslinfo` 回的 `actual` 比對：
  - `declared=mirrored, actual=nat`，且 VM 啟動時間晚於 `.wslconfig` 修改時間 → 可能是 Windows 版本不支援（需要 Windows 11 22H2+）
  - `declared=mirrored, actual=nat`，且 VM 啟動時間早於修改時間 → 提示需要 `wsl --shutdown` 才會生效，**不要**叫使用者再去改設定
  - 使用者機器：`declared=Mirrored`、`actual=mirrored` ⇒ **已經生效**，BUG-089 純粹是判定錯誤，不是「設了沒生效」。
- **Mirrored 與 NAT 下 localhost 的差異**（決定 NAT 要不要修）：
  - Mirrored：Windows 與 Linux 共用 localhost，雙向都能用 `127.0.0.1`。**Windows 已經在用的埠，Linux 綁不上**（只能用 `[experimental] ignoredPorts` 讓 Linux 綁，但那樣 Windows 端就連不進去）⇒ 本機實測 `EADDRINUSE 127.0.0.1:9876`。
  - NAT：`localhostForwarding=true`（預設）會把 Linux 綁在 wildcard / localhost 的埠轉到 Windows 的 `localhost:port`（官方 wsl-config）。如果 Windows 已經占用該埠，`localhost` 會連到 Windows 自己的程式（推論，未實測）。
  - ⇒ **NAT 不需要強制修正**。connect-test 用 `localhost` 在兩種模式下都可行，前提是埠在 Windows 端空著。環節 6 改成「建議項、預設不勾」，警告文字改為說明實際差異，並走 i18n。
- 附帶 UX：警告文字目前寫死英文（`install-server-bundle.ts:302`、`connect-test.ts:369`），修 BUG-089 時一起改 i18n；「目前步驟...」佔位字沒有查（是 UI 問題，需要到 SetupWizardShell 確認）。

### 研究目標 5：同意清單 UI 與精靈框架整合

目前框架（`wizard-runner.ts`）：`requestChoice` 只支援單選（`WizardChoiceRequest`，:41-47）；`kind: 'input'` 的步驟會切到 `awaiting-input`（:564-590）；preflight 失敗走 ErrorMapper（:405-441）。WSL 未安裝時 detect-env 直接在 preflight 失敗（`detect-env.ts:134-146`，`wsl-not-installed`）。

建議流程（WSL）：

```
detect-env             → WSL 未安裝時不再直接失敗，改為收集事實存進 ctx.wslFacts（安裝 / 版本 / 待重開機 / 發行版 / 提權能力）
pick-wsl-distro        → 沒有發行版時提供「安裝新的 Ubuntu-24.04」選項
plan-wsl-environment   （新，kind:'input'）事實 → 變更清單（純函式）→ requestConsent（新 API，多選）
apply-wsl-environment  （新，task）依序執行已勾選的項目；需要重開機時寫 resume + RunOnce，並丟 errorCode 'wsl-reboot-required'
wsl-systemd-check → install-server-bundle → write-systemd-unit → fetch-fingerprint → connect-test → write-profile → done（既有步驟，改成驗證角色）
```

- **新 API**：`ctx.requestConsent({ stepId, items: [{ id, label, detail, scope: 'machine'|'distro'|'user', effects: ['reboot'|'shutdown-all-distros'|'terminate-distro'|'elevation'], required, defaultChecked }] }) → Promise<string[] | null>`。runner 用跟 `requestChoice` 一樣的方式包裝（把 `maybeWrapRequestChoice` 擴充成兩者都包）。
- **影響範圍呈現**：每一項顯示 scope 標籤（全機 / 此發行版 / 此使用者）和副作用（「將關閉所有執行中的 WSL 發行版」「需要重開機」「會跳出 UAC」）。只要有勾選全機項目，確認按鈕旁就加一行總結。
- **沒勾選的項目**：分成 `required`（WSL 本體、發行版、WSL2、systemd、埠）和 `optional`（網路模式、BAT 沒開也要常駐）。required 沒勾 → 精靈停在 plan 步驟並說明為什麼不能繼續（可取消）；optional 沒勾 → 寫進 ctx.warnings，後續步驟照跑。
- **ErrorMapper**：新增 `wsl-reboot-required`（動作：「立即重開機」「稍後」）、`wsl-elevation-denied`、`wsl-elevation-unavailable`（標準使用者 + UAC 關閉）、`wsl-port-in-use`。
- 改動量：runner 約 +60 行（requestConsent 包裝）、Shell 新增 checklist 元件、兩個新步驟、error-mapper 4 筆。估 **M**。

### 研究目標 6：實作拆單建議

**Phase 1（已裝好環境的使用者也直接受影響，建議優先，可以平行）**

| 單 | 內容 | affects_files | 測試 |
|----|------|---------------|------|
| **P1-a（新 BUG：指紋步驟永久卡住，High）** | 改用 TLS 握手取對端憑證指紋：`tls.connect({ host: '127.0.0.1', port, rejectUnauthorized: false })` → `getPeerCertificate().fingerprint256`（實測格式跟 RemoteServer 一致：`61:E3:BA:…`），timeout 5s；可再跟 `wsl cat <dataDir>/server-cert.json` 交叉比對。IPC 一定要有 timeout。另外要確認 SSH（port 51820）/ Docker 流程是否也走同一個壞掉的 `/fingerprint`（它們共用 `fetchFingerprintStep`，見 `ssh-flow.ts:31`、`docker-flow.ts:22`） | `electron/main.ts`（`wsl:fetch-fingerprint` :3527-3547）、`src/components/setup-wizard/steps/wsl/fetch-fingerprint.ts`、相關 tests | unit：timeout、格式；實機：WSL + SSH 各跑一次 |
| **P1-b（新 BUG：WSL 伺服器埠與主機 RemoteServer 衝突 + startService 誤判，High）** | 精靈在 Windows 端探測可用埠（排除主機 RemoteServer 的埠，見 `main.ts:472-476`），寫進 unit 和 profile；`startService` 改成「`active` 持續 N 秒且 `NRestarts` 沒變」或確認埠已經在 listen 才算成功；journal 出現 `EADDRINUSE` 時回 `wsl-port-in-use` 錯誤碼 | `src/components/setup-wizard/wsl-flow.ts`、`steps/wsl/write-systemd-unit.ts`、`electron/wsl-systemd.ts`、`electron/main.ts` + `electron/preload.ts`（埠探測 IPC）、`error-mapper.ts`、tests | unit：埠選擇、穩定性判定（mock execFile）；實機：Mirrored + 主機 9876 已占用 |
| **P1-c（BUG-089）** | `detectNetworkMode` 改用 `wslinfo --networking-mode`，並跟 `.wslconfig` 的 declared 值比對，回傳 `{ actual, declared }`；移除 route 啟發式；警告文字 i18n、措辭依目標 4 | `electron/wsl-detect.ts`、`electron/main.ts`、`electron/preload.ts`、`steps/wsl/install-server-bundle.ts`、`steps/wsl/connect-test.ts`、locales、tests | unit：輸出解析、declared/actual 組合；實機：Mirrored 一次 |
| **P1-d（新 BUG：發行版閒置被關，High）** | 新增 `electron/wsl-keepalive.ts`（holder 生命週期）；精靈在 write-systemd-unit 之後啟動 holder；掛 app ready / quit | `electron/wsl-keepalive.ts`（新）、`electron/main.ts`、`steps/wsl/write-systemd-unit.ts`、tests | unit：spawn mock、backoff、quit 清理；實機：閒置 2 分鐘後仍可連 |

建議順序：先做 P1-a、P1-b（不修的話精靈走不到底，其他修正也沒辦法實機驗收），再做 P1-c、P1-d。四張都要過 NSIS 安裝版實機驗收。

**Phase 2（已安裝環境：偵測 → 清單 → 一次同意 → 修正；環節 4/5/6/8 + 埠）**

| 單 | 內容 | affects_files | 依賴 |
|----|------|---------------|------|
| P2-a | `.wslconfig` INI 純函式編輯器 + 備份 | `electron/wslconfig-ini.ts`（新）+ tests | 無 |
| P2-b | 事實收集（`detectWslFacts`）+ 計畫建構（facts → items，純函式） | `electron/wsl-detect.ts`、`src/components/setup-wizard/wsl-env-plan.ts`（新）+ tests | P1-c |
| P2-c | `requestConsent` + checklist UI + `plan-wsl-environment` / `apply-wsl-environment` 步驟 + ErrorMapper 新錯誤碼 | `wizard-runner.ts`、`SetupWizardShell.tsx`、`wsl-flow.ts`、`steps/wsl/plan-environment.ts`（新）、`steps/wsl/apply-environment.ts`（新）、`error-mapper.ts`、locales、tests | P2-a、P2-b |

**Phase 3（從零安裝 + 重開機接續；環節 1-3）**

| 單 | 內容 | affects_files | 依賴 |
|----|------|---------------|------|
| P3-a | WSL 安裝與提權（`Start-Process -Verb RunAs`）、待重開機偵測、提權能力偵測 | `electron/wsl-install.ts`（新）、`electron/main.ts`、`electron/preload.ts`、tests | P2-c |
| P3-b | 接續機制：`wizard-resume.json` + HKCU RunOnce + `--resume-wizard` + 啟動時提示 | `electron/wizard-resume.ts`（新）、`electron/main.ts`、`src/components/ProfilePanel.tsx`、tests | P3-a |
| P3-c | 發行版安裝 + 非互動建立使用者（帳號 / 密碼輸入步驟、`chpasswd` 走 stdin、`--manage --set-default-user`） | `electron/wsl-install.ts`、`steps/wsl/pick-wsl-distro.ts`、新的輸入步驟、tests | P3-a |
| P3-d | 實機驗收單（乾淨的 Win10 22H2 / Win11 VM，UAC 開啟、標準使用者各一） | — | P3-a~c |

**測試策略**：解析器、計畫建構、INI 編輯、埠選擇、接續檔讀寫都做成純函式，用 vitest 測。child_process 呼叫沿用既有的 `setExecFileImplForTests` 模式。必須實機驗證的部分：UAC、重開機、RunOnce、真正的 `wsl --install`、Mirrored 與 NAT 的實際連線、閒置關閉。

**風險**：
- `wsl --install` 的 exit code 與「待重開機」狀態沒有官方文件 ⇒ 一律以「重新偵測」為準，不信 exit code。
- [WSL#41785](https://github.com/microsoft/WSL/issues/41785)：WSL 2 已經能用時，`wsl --install <distro>` 仍可能誤觸 DISM 並要求重開機 ⇒ 安裝發行版前先確認 VMP 狀態，避免平白多一次重開機。
- `instanceIdleTimeout` 的行為在 2.6.1 前後不同（[WSL#13416](https://github.com/microsoft/wsl/issues/13416)）⇒ holder 方案不受影響，不依賴 systemd 算不算活動。
- holder 會讓發行版在 BAT 執行期間一直開著（占用記憶體），應該在設定裡可以關閉。

### 需要使用者實機驗證（Worker 無法驗證）

1. 乾淨機器上 `wsl --install --no-distribution` 的提權提示、exit code、重開機需求（Win10 22H2 與 Win11 各一）。
2. UAC 開啟 + 拒絕提權、UAC 關閉 + 標準使用者這兩種情境。
3. 重開機後 RunOnce 是否帶起 BAT 並接續。
4. `--no-launch` + root `useradd` + `--manage --set-default-user` 的端到端結果，以及 Ubuntu-24.04 映像是否預設 `systemd=true`。
5. `[boot] systemd=true` 是否只要 `--terminate` 單一發行版就會生效。
6. NAT 模式下 Windows `localhost` → Linux bat-server 的實際連線（本機是 Mirrored，不能切換）。
7. SSH / Docker 精靈的 fetch-fingerprint 是否也會卡住。

### 互動紀錄

| 時間 | 問題 | 回答 |
|------|------|------|
| 22:09 | 可否啟動 Ubuntu-24.04 做唯讀觀察 + 約 90 秒閒置觀察 | 可以，現在執行 |
| 22:09 | 精靈第 6 步現在是否還開著 | 已關閉 / 取消 |
| 22:09 | BAT 沒開時 bat-server 是否需要可連 | 只需 BAT 執行時可用 |

### 偏差與附註

- 閒置觀察用了一個 transient unit（`systemd-run --user --unit=t0380-keepalive-probe sleep 180`）。它只存在於那次 instance、沒有寫入任何檔案，發行版關閉後就消失；在使用者同意的觀察範圍內，特此記錄。沒有改 `.wslconfig` / `wsl.conf`，也沒有執行 `--shutdown` / `--install`。
- 精靈已經取消，但 BAT 主程序（PID 16928）仍有一條 `127.0.0.1:61786 ↔ 127.0.0.1:9876` 的 ESTABLISHED 連線（22:08、22:13 兩次 netstat 都還在）⇒ 推定是沒有 timeout 的指紋請求殘留，取消精靈也不會清掉，由 P1-a 一併處理。
- journal 顯示約 22:05:59 有一次不是本 Worker 觸發的發行版開機（本 Worker 第一個 `wsl` 指令在 22:07 之後），觸發來源**無法判定**，不影響結論。
- BAT debug log（`debug-20261004-215726.log`）在 `Using cached server bundle`（21:57:56）之後就沒有精靈 log：後續步驟成功時不寫 log，warnings 也不會進 log ⇒ 建議 P1 各單補上紀錄（目前 `wsl-flow.ts:66-69` 用的是 `console.*`，沒有走 CLAUDE.md 規定的 `window.electronAPI.debug.log`）。
- 沒有改任何產品程式碼；scratchpad 的實驗腳本已刪除。

### 驗證證據分道

| 分道 | 結果 |
|------|------|
| 原始碼 / 文件查證 | PASS（行號見上；MS Learn wsl-config / networking / basic-commands / install；GitHub WSL#13416、#41785、Discussion #10590、#12426） |
| 本機唯讀查詢 | PASS（`wsl -l -v`、`--status`、`--version`、`--help`、登錄、CIM、netstat） |
| 發行版內實測 | PASS（經使用者同意） |
| build / tests | N/A（研究單，沒有改程式碼） |
| 乾淨機器 / UAC / 重開機 | BLOCKED（超出 Worker 權限，已列入實機驗證清單） |

### Commit

- 只 commit 本工單檔（`git commit --only`），沒有 push。
