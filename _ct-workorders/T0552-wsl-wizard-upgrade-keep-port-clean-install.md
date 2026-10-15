---
schema_version: 1
schema_kind: workorder
id: T0552
title: "BUG-138 + BUG-139：WSL 精靈升級既有 server 時沿用原 port 與既有 profile；覆蓋安裝前清掉 bundle 管理的舊檔（並確認 SSH 精靈是否同病）"
type: bugfix
status: FIXED
repo: better-agent-terminal
project: "BUG-138 / BUG-139"
priority: P1
sizing: M
created_at: "2026-10-16T02:50:44+0800"
updated_at: "2026-10-16T03:30:17+0800"
started_at: "2026-10-16T03:11:47+0800"
completed_at: "2026-10-16T03:30:17+0800"
commit: "f599f915"
target_version: "0.6.1-pre.5（與 T0551 同批）"
depends_on: []
related:
  - "BUG-138 / BUG-139（現象、證據、修正方向）；T0550 回報區「發現的產品缺陷」與 `e2e/t0550-wsl-acceptance.spec.ts`"
  - "T0511（SSH 上傳先刪舊 `staging/`、enable 階段 restart / reload）；T0546 / T0492 / T0503（bundle 移除的套件）"
affects_files:
  - electron/wsl-systemd.ts
  - electron/wsl-detect.ts
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/components/setup-wizard/steps/wsl/write-systemd-unit.ts
  - src/components/setup-wizard/steps/wsl/install-server-bundle.ts
  - "src/components/setup-wizard/**（WSL 精靈建立 / 更新 profile 的步驟；列出實際檔案）"
  - "electron/remote/ssh-bundle-uploader.ts、electron/remote/ssh-setup-handlers.ts、electron/remote/ssh-start-server.ts（僅在 SSH 確認同病時）"
  - "src/locales/*.json（若新增使用者可見文字，三語）"
  - "electron/__tests__/**、src/components/setup-wizard/__tests__/**（新增 / 更新測試）"
  - "e2e/t0550-wsl-acceptance.spec.ts（僅加 env 開關或新增升級情境，預設行為不變）"
  - "CLAUDE.md / docs/wsl-deployment.md（若升級行為描述需更新）"
  - _ct-workorders/T0552-wsl-wizard-upgrade-keep-port-clean-install.md
  - _ct-workorders/BUG-138-wsl-wizard-upgrade-changes-port.md
  - _ct-workorders/BUG-139-wsl-bundle-overlay-install-leaves-stale-files.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`（`src/styles/settings.css` 的 M 不是你的變更）。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）；e2e 只用隔離實例（需先 `npx vite build`）。"
  - "🔴 WSL 實機：可以用 `Ubuntu-24.04` 驗證升級（它目前是 T0550 裝的 0.6.1-pre.4，service 在 9877，使用者 profile `wsl-ubuntu-24-04` 依賴這個 port 與憑證）。實機驗證後 server 必須仍在 **9877**、憑證指紋不變、service active；動之前先備份（同 T0550 做法，備份路徑寫進回報區）。不要刪 T0550 的備份 `~/.local/bat-server.bak-0.5.9-pre.4-t0550`。不動其他發行版、Docker、`~/.ssh`、`.wslconfig`。"
  - "🔴 不要碰 T0551 的檔案（`electron/handlers/pty.ts`、`electron/pty-manager.ts`、`electron/close-worker.ts`、`electron/remote/headless-entry.ts`）。"
  - "🔴 清舊檔時絕不能刪使用者資料（`~/.local/share/bat-server`：憑證、token、settings 等）與 installRoot 以外的任何路徑；清除範圍必須是明確白名單，路徑需驗證（拒絕空字串、`/`、`~` 等）。"
---

# T0552 — BUG-138 + BUG-139：WSL 精靈升級沿用 port、乾淨覆蓋安裝

## 背景

T0550 用安裝版 pre.4 的 WSL 精靈把使用者的 `Ubuntu-24.04` server 從 0.5.9-pre.4 升到 0.6.1-pre.4，發現兩個缺陷：

- **BUG-138**：舊 server 執行中時，`write-systemd-unit` 的 `wsl:pick-server-port` 探測到原 port（9877）被佔用（就是舊 server 自己），改挑 9878；unit 改寫並重啟後，既有 profile 連不上，精靈另建新 profile。T0550 靠先停 service 避開。
- **BUG-139**：`installBundle` 只 `mkdir -p` + `tar -xzf --strip-components=1`，不清目錄；升級後 0.5.9 的 `claude-agent-sdk-linux-x64`（226M）、`@img`、`better-sqlite3`、`sharp` 殘留（約 256 MiB）。

重跑精靈是目前唯一的升級路徑，這兩點會直接影響每個升級的使用者。

## 任務

### BUG-138：升級沿用 port 與 profile

1. 偵測同 distro 已有精靈安裝的 bat-server（既有 unit 與 `BAT_SERVER_PORT`）時，沿用該 port（或先停舊 service 再探測，取捨由你決定並說明）；探測邏輯不得把「同 distro 舊 bat-server 自己佔的 port」當成衝突。真正被其他程式佔用時，維持現行挑新 port 的行為。
2. 精靈結束時更新既有的對應 profile（同 distro、同 port / 同 installRoot），而不是另建一個；憑證 / token 沿用（現況已沿用，確認不退步）。
3. 確認 SSH 精靈是否有同樣問題（遠端 port 挑選與 profile 建立）。有就一併修，沒有就在回報區寫明依據。

### BUG-139：乾淨覆蓋安裝

4. WSL 安裝前清掉 bundle 管理的內容，或解到暫存目錄後整批換名（原子性較好，取捨由你決定）。使用者資料（`~/.local/share/bat-server`）與 installRoot 以外的路徑不得受影響；路徑防呆見 memory_overrides。
5. 確認 SSH 上傳路徑（`ssh-bundle-uploader.ts`）是否也會殘留舊檔，有就一併修。

### 驗證

6. 單元測試：port 沿用、真衝突仍換 port、profile 更新而非新建、清除範圍白名單與路徑防呆、SSH 對應情境。
7. 實機（WSL `Ubuntu-24.04`，條件見 memory_overrides）：以本機 build（`npx vite build` 後的隔離實例，或擴充 `e2e/t0550-wsl-acceptance.spec.ts` 加升級情境開關）在 **server 執行中**跑精靈升級（同版重裝即可）。判準：port 仍是 9877、沒有新建 profile、`du -sh ~/.local/bat-server` 明顯下降（不再含 `claude-agent-sdk-linux-x64` / `@img` / `better-sqlite3` / `sharp`）、smoke `npm run smoke:remote:headless` 13/13。
8. BUG-138 / BUG-139 狀態改 FIXED、填修正 commit；需要時更新 `CLAUDE.md` / `docs/wsl-deployment.md` 的升級說明。

## 驗收條件

- [ ] 舊 server 執行中跑精靈：port 不變、更新既有 profile、不新建
- [ ] 覆蓋安裝後 installRoot 內容等於新 bundle；使用者資料不受影響
- [ ] SSH 兩項有判定（修正或「不同病」的依據）
- [ ] `npm run test:unit` 全綠（基線 4073 passed / 243 files，加上新測試）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功
- [ ] WSL 實機驗證通過，結束時 server 在 9877、指紋不變、active
- [ ] BUG-138 / BUG-139 → FIXED

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

✅ FIXED — 修正 commit `f599f915`（未 push）。驗收條件 6 項全部達成（見下方驗證）。

**落地檢查**：PASS。C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 PASS；C-3 PASS（`electron/wsl-systemd.ts` 等皆存在）；C-2 無 `branch` 欄位。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。開工時 frontmatter `status` 為 `TODO`（非 `PENDING`），直接改為 `IN_PROGRESS`。

### 產出摘要

**BUG-138（升級沿用 port 與 profile）** — 取捨：**沿用既有 unit 的 port，被佔用時才停舊 service 再探測**（不採「一律先停再探測」：port 本來就空、或第一次安裝時不必動 systemd）。
- `electron/wsl-systemd.ts`：`parseExistingServerUnit` / `readExistingServerUnit`（讀 `BAT_SERVER_PORT`，舊版 `BAT_PORT` fallback）、`stopServiceIfActive`、`startStoppedService`；`pickServerPort` 新增 `existingPort` / `releaseExistingPort` / `releaseWaitMs`（空著直接用；被佔用 → release → 最多 5 s 輪詢；仍被佔用 = 別的程式 → 原本的掃描，且不會發出該 port）；`pickServerPortForUnit` 串起整段，挑選失敗時把停掉的 service 再啟動。使用者指定 port（`ctx.state.serverPort`）時完全不讀 unit。
- `electron/main.ts` `wsl:pick-server-port` 第二參數 `existing`（`{ distro, unitPath, serviceName }`，main 端驗證 distro / 路徑 / service 名）；preload / `src/types/electron.d.ts` 同步，結果多 `reusedExistingPort`。
- `write-systemd-unit.ts`：systemd 可用時先解析 unit 路徑再挑 port，帶 `existing`；沿用時 log `Keeping port …`。
- `write-profile.ts`：WSL 同 distro + 同 port + loopback host、SSH 同 host / user / ssh port（未設 = 22）+ 同 server port 的既有 profile → 更新（名稱不變）、不新建；本次執行先前嘗試建的 profile 一律刪除；rollback 寫回被覆寫的舊值、不刪既有 profile。`wizard-runner.ts` 新增 `updatedProfileId` / `updatedProfiles`；`SetupWizardShell.tsx` 完成時開 `createdProfileId ?? updatedProfileId`。憑證 / token 沿用：未退步（實機 sha256 不變，見下）。
- **SSH 判定**：port — **不同病**。SSH server port 固定（`ssh-flow.ts` `DEFAULT_SERVER_PORT = 9876`，configure-host 沒有 port 欄位、遠端不探測），enable 階段 systemd `restart` / launchd `unload`→`load -w` 直接換掉舊 server（T0511），port 不會變。profile — **同病**（每次重跑都 `profile.create`），已由上面的共用 `write-profile` 修正一併修好。

**BUG-139（乾淨覆蓋安裝）** — 取捨：**解到暫存目錄後換名**（原子性較好，下載 / 解壓失敗時舊安裝不動，也不用維護 bundle 頂層清單；舊 bundle 頂層曾有 `handlers/`、新版有 `scripts/`）。
- 新檔 `electron/server-bundle-install-script.ts`（WSL / SSH 共用）：`<root>.bat-new` 解壓 → 驗 `bin/bat-server` → 舊 root 換名 `<root>.bat-old` → 新樹換入 → 刪 `.bat-old`。**刪除白名單**：只有 `<root>.bat-new`、`<root>.bat-old` 與舊 root，且舊 root 必須是 bundle 安裝（`bin/bat-server`，或 T0511 前的 `staging/bin/bat-server`）或空目錄；symlink、檔案、其他內容的目錄 → 照舊疊上去、不刪任何東西。**路徑防呆**：`assertBundleInstallRoot`（絕對路徑、至少兩段、拒絕 `''` / `/` / `~` / 相對 / `.` / `..` / 空段 / 引號 / 反斜線 / `$` / 反引號 / 控制字元，去尾端 `/`），shell 內再擋非 `/x/y` 形式與 `= $HOME`。`~/.local/share/bat-server` 不在 root 內。
- `electron/wsl-detect.ts` `installBundle`：改用 `wsl -d <distro> --exec sh -c <script> sh <root> <tarball>`（實測 `wsl --` 會把參數交給 login shell 重新解析、丟掉位置參數；`--exec` argv 完整），timeout 300 s，失敗回傳附 stderr。`uninstallBundle` 也套用同一個 root 規則（rollback 若拿到預設的 `~/...` 會被拒、只 warn，不再 `rm -rf`；成功安裝後 rollback 拿到的是絕對路徑，照舊）。
- **SSH 判定**：**同病**（T0511 只清 `staging/`，其餘舊檔殘留），`ssh-bundle-uploader.ts` 改用同一腳本（tarball 走 stdin），root 同樣驗證並正規化。多行指令經 Windows argv 傳遞實測逐字相同；腳本在 dash / bash 下 `-n` 語法檢查通過。

**文件**：`docs/wsl-deployment.md` 步驟 4 / 5 / 8 補升級行為；`CLAUDE.md` SSH wizard（T0511）段落的舊 `staging/` 描述改寫，補 T0552 規則。

**e2e**：`e2e/t0550-wsl-acceptance.spec.ts` 加 `BAT_E2E_T0550_UPGRADE_RUNNING=1` 開關（預設行為不變）：不停舊 service、先在隔離實例建一個同 distro + 舊 port 的 profile，新增 `A2.upgrade-running` / `A3.clean-install` 判定；開關下可用本機 build（不需 `BAT_E2E_EXECUTABLE`），A1 的下載來源改為 INFO。

**變更檔案**（commit `f599f915`，21 檔）：`electron/server-bundle-install-script.ts`（新）、`electron/wsl-detect.ts`、`electron/wsl-systemd.ts`、`electron/main.ts`、`electron/preload.ts`、`electron/remote/ssh-bundle-uploader.ts`、`src/types/electron.d.ts`、`src/components/setup-wizard/{SetupWizardShell.tsx,wizard-runner.ts,steps/wsl/write-profile.ts,steps/wsl/write-systemd-unit.ts}`、測試 `electron/__tests__/{server-bundle-install-script,wsl-install-bundle,wsl-server-port-reuse}.test.ts`（新）、`src/components/setup-wizard/__tests__/write-profile-existing.test.ts`（新）、更新 `electron/remote/__tests__/ssh-bundle-layout-and-port.test.ts`、`src/components/setup-wizard/__tests__/{write-systemd-unit.test.ts,wizard-remote-tools.test.tsx}`、`e2e/t0550-wsl-acceptance.spec.ts`、`docs/wsl-deployment.md`、`CLAUDE.md`。另 closeout commit：本工單、BUG-138、BUG-139。

**偏離 affects_files**：新增 `electron/server-bundle-install-script.ts`（WSL / SSH 共用的安裝腳本與路徑驗證，避免兩份 shell 腳本各自漂移）與 `src/components/setup-wizard/wizard-runner.ts`、`SetupWizardShell.tsx`（屬 `src/components/setup-wizard/**`）。未用到 `ssh-setup-handlers.ts` / `ssh-start-server.ts` / locales（沒有新的使用者可見文字）。

### 驗證

| 項目 | 結果 | 證據 |
|---|---|---|
| `npm run test:unit` | ✅ PASS | 247 files / 4211 passed / 1 skipped（skip 為既有；本工單新增 4 檔）。基線 4073 / 243 之後 T0551 已有增加 |
| `npm run typecheck` | ✅ 0 | |
| `npm run typecheck:electron` | ✅ 0 | |
| `npx vite build` | ✅ 成功 | |
| 單元：port 沿用 / 真衝突換 port / 挑選失敗再啟動 / 無 unit / 使用者指定 port / 無效輸入不執行 | ✅ | `wsl-server-port-reuse.test.ts`（execFile 與探測注入） |
| 單元：profile 更新而非新建、rollback 寫回不刪、其他 distro / port / host 仍新建、SSH 對應情境 | ✅ | `write-profile-existing.test.ts`、`wizard-remote-tools.test.tsx` |
| 單元：清除白名單與路徑防呆、真 `sh` + `tar` 執行（升級、首次、T0511 前版面、壞 tarball、缺 launcher、非 bundle 目錄、`$HOME`、SSH stdin） | ✅ | `server-bundle-install-script.test.ts`（Windows 用 Git Bash 實跑，非 skip）、`wsl-install-bundle.test.ts`、`ssh-bundle-layout-and-port.test.ts` |
| WSL 實機（Ubuntu-24.04，舊 server **執行中**，本機 build 隔離實例） | ✅ PASS | `BAT_E2E_T0550=1 BAT_E2E_T0550_UPGRADE_RUNNING=1 npx playwright test e2e/t0550-wsl-acceptance.spec.ts -g "A1-A3\|B4"` → 2 passed（03:27:28–03:27:49）。A0 對照：不帶 `existing` 的 picker 仍回 9878（bug 原樣重現）；精靈 log：`existing bat-server.service … uses port 9877` → `stopped the running bat-server.service … to reuse port 9877` → `pick-server-port -> 9877 (reused the existing unit port)`。`A2.upgrade-running` PASS：該 distro 只有預建的 profile（token / 指紋已更新），未新建。`A3.clean-install` PASS：`~/.local/bat-server` 708 → 390 MiB，`claude-agent-sdk-linux-x64` / `@img` / `better-sqlite3` / `sharp` 皆不在，無 `.bat-new` / `.bat-old` 殘留。`A2.profile-opens` PASS（遠端 shell 回應）。`B4` smoke **13/13 PASS** |
| 結束狀態 | ✅ | service `active`、unit `BAT_SERVER_PORT=9877`、`127.0.0.1:9877` 由 MainPID 6070 LISTEN、憑證指紋 `22:3A:E4:C7:…:79:97` 不變；`server-cert.json` sha256 `dd0bc13f…`、`server-token.json` sha256 `bfc48f5c…` 前後相同；unit 與備份 `diff` 相同 |

證據目錄：`C:\Users\Gower\AppData\Local\Temp\bat-t0552\evidence\`（`results.json`、`server-state-before.txt` / `-after.txt`、`debug-log-a.txt`、`smoke-after.txt`、截圖）。

**備份**（實機動之前建立，未刪除）：`~/.local/bat-server.bak-0.6.1-pre.4-t0552`（708M，升級前內容）、`~/.config/systemd/user/bat-server.service.bak-0.6.1-pre.4-t0552`、`~/.local/share/bat-server.bak-t0552`（資料目錄複本，含 token / 憑證，權限沿用 `cp -a`；確認無誤後可刪）。T0550 的 `~/.local/bat-server.bak-0.5.9-pre.4-t0550` 未動。未碰其他發行版、Docker、`~/.ssh`、`.wslconfig`、使用者的 BAT（9876）與 T0551 的檔案。

### 互動紀錄

無（`CT_INTERACTIVE=0`，fire-and-forget）。

### Renew 歷程

無。

### 遭遇問題

- `wsl -d X -- sh -c '<script>' sh a b` 實測位置參數消失（`--` 把參數串回 login shell 重新解析）；改 `--exec`，與 T0550 spec 的 `wsl()` 做法一致。
- 殘餘風險 / 後續建議（不在本單範圍）：
  1. WSL install 步驟的 rollback（T0489）在**升級成功後**後續步驟失敗並取消時，仍會 `rm -rf` 新裝好的 root（等於移除安裝）；BUG-139 修正後失敗的安裝已不會動到舊檔，但「升級成功→後段失敗→取消」仍會讓使用者沒有 server。可考慮升級時改為保留 `.bat-old` 供 rollback 換回。
  2. 安裝時舊 server 仍在執行：換名後舊行程繼續跑，直到 write-systemd-unit 停掉 / restart（實測正常）；若舊行程在這幾秒內 lazy require 失敗，systemd `Restart=on-failure` 會以新 bundle 重啟，同 port。
  3. SSH 端只有單元與 shell 實跑驗證，沒有真 SSH 主機的升級實測（`e2e/pre5-ssh-alias.spec.ts` 需另起環境）。

### 回報時間

2026-10-16T03:29:23+0800
