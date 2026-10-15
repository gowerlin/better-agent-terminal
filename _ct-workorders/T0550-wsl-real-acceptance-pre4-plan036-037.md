---
schema_version: 1
schema_kind: workorder
id: T0550
title: "WSL 實機驗收（pre.4）：以已安裝 0.6.1-pre.4 的精靈把 WSL bat-server 從 0.5.9-pre.4 升到 pre.4（順驗線上下載），再驗 PLAN-036 遠端功能 / 遠端 Tower 派單與 PLAN-037 工具偵測"
type: verification
status: DONE
repo: better-agent-terminal
project: "PLAN-036 / PLAN-037（順帶 PLAN-031 / D146 下載路徑）"
priority: P2
sizing: M
created_at: "2026-10-16T02:28:10+0800"
updated_at: "2026-10-16T02:44:24+0800"
started_at: "2026-10-16T02:30:12+0800"
completed_at: "2026-10-16T02:44:24+0800"
commit: "97d54f5a"
target_version: "0.6.1-pre.4（已安裝，不改產品程式碼）"
depends_on: []
related:
  - "PLAN-036（headless handler；P0–P3 程式完成，待實機）、PLAN-037（遠端工具偵測 / 安裝，程式完成，待實機）"
  - "PLAN-031 / D146 / T0547 / T0548（安裝檔不內建 baseline → 精靈線上下載 `server-bundle-v0.6.1-pre.4`）"
  - "T0510（以安裝版 exe 起隔離實例做實機驗收的範本：`BAT_E2E_EXECUTABLE`、`--runtime=e2e-…`、Playwright 路徑用正斜線）"
  - "T0434 回報區（遠端 Tower 實機派單步驟）、`npm run smoke:remote:headless`（S1–S13）"
affects_files:
  - _ct-workorders/T0550-wsl-real-acceptance-pre4-plan036-037.md
  - "e2e/**（僅限新增本單專用的 spec / env 腳本；既有 spec 若需參數化，只能加 env 開關、預設行為不變）"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不改產品程式碼（`electron/**` / `src/**` / `scripts/**` / `package.json`）。發現產品缺陷 → 只記證據，回報區列出，由塔台開 BUG。"
  - "🔴 不碰使用者正在用的 BAT：不連 / 不關 / 不重啟 port 9876 的實例與它的 Terminal Server，不以預設實例啟動安裝版；隔離實例用 `--runtime=e2e-t0550-…`，結束時只殺隔離 userData pid 檔裡的 pid（T0510 做法）。"
  - "🔴 WSL：只動 `Ubuntu-24.04` 的 `~/.local/bat-server` 與其 systemd user service（升級即本單目的）。動之前先備份：`cp -a ~/.local/bat-server ~/.local/bat-server.bak-0.5.9-pre.4-t0550` 與 unit 檔；升級失敗且無法在本單內完成時，還原備份並 `systemctl --user restart` 回 0.5.9-pre.4，回報 PARTIAL。不動其他發行版、Docker、`~/.ssh`、`.wslconfig`。"
  - "🔴 不開真 Claude / Codex 對話、不耗 token：Agent 面板、遠端 Tower 派真 agent 這類需要模型的項目列入「需真人」清單。派單驗證用 smoke S13 / 自訂 CLI 跑 node 腳本的方式（T0529 / T0537 e2e 做法）。"
  - "🔴 不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <本單檔與新增檔>`（`src/styles/settings.css` 的 M 不是你的變更）。"
  - "🔴 需要 sudo 密碼或其他人工輸入才能繼續 → 停在該步，回報 BLOCKED / PARTIAL 並寫明卡點，不要嘗試繞過。"
---

# T0550 — WSL 實機驗收（pre.4）：PLAN-036 / PLAN-037（順帶 PLAN-031 下載）

## 背景

- PLAN-036（headless bat-server 的終端 / Agent / git / fs handler、遠端 Tower 通知）與 PLAN-037（遠端 AI 工具偵測與一鍵安裝）的程式部分都已完成，剩實機驗收。使用者 2026-10-16 決定開這張單做驗收，通過就結案兩個 PLAN。
- 本機 WSL `Ubuntu-24.04` 的 `~/.local/bat-server` 仍是 **0.5.9-pre.4**（T0406 期部署，systemd user service `bat-server.service` active）。它沒有 helper env，smoke S13（遠端 Tower 派單）在這個版本上只會 SKIP。
- 0.6.1-pre.4 起安裝檔不內建 server bundle（D146），WSL / SSH 精靈改為線上下載 `server-bundle-v0.6.1-pre.4`，下載失敗時可改匯入本機 tarball。用**安裝版 pre.4 的隔離實例**（userData 空的，沒有 cache）跑 WSL 精靈，就能同時驗證這條下載路徑。
- 本機已安裝 `C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe` 0.6.1-pre.4。使用者的 BAT 正在執行，不得干擾。

## 任務

### A. 升級 WSL server（順驗 PLAN-031 / D146 下載路徑）

1. 記錄升級前狀態：bundle 版號、service 狀態、`~/.local/bat-server` 目錄結構；完成備份（見 memory_overrides）。
2. 以安裝版 exe 起隔離實例（`BAT_E2E_EXECUTABLE` + `--runtime=e2e-t0550-…`，參考 T0510 與 `e2e/pre6-wizard-acceptance.spec.ts` / `e2e/pre7-acceptance.spec.ts`），對 `Ubuntu-24.04` 跑 WSL 精靈到完成。若既有 spec 無法直接套用，可新增 `e2e/t0550-*.spec.ts`。
3. 判定：
   - A1 `install-server-bundle` 走線上下載：來源 URL 為 `…/releases/download/server-bundle-v0.6.1-pre.4/…`、SHA 驗證通過；隔離 userData 的 `bat-server-bundles/` 出現 tarball 與 `.sha256` sidecar
   - A2 精靈全程完成、profile 可開啟；WSL 上 bundle 版號 = 0.6.1-pre.4、service active、在設定的 port LISTEN
   - A3 `<installRoot>/scripts/bat-terminal.mjs` / `bat-notify.mjs` 與 `<installRoot>/bin/node` 存在（PLAN-036 K 前提）
   - A4（選做，有餘力再做）在**另一個**隔離實例、離線條件下（例如 `BAT_SERVER_BUNDLE_BASE_URL` 指向不可達位址）確認錯誤顯示「匯入本機 tarball」動作，並以 A1 下載的檔案匯入成功。不必重裝 WSL 端
   - 精靈完成後若使用者的 WSL profile 視窗正連著，因 service restart 斷線屬預期，記錄即可

### B. PLAN-036 遠端功能

4. 對升級後的 server 跑 `npm run smoke:remote:headless`（S1–S13），記錄每項結果。**S13（遠端 Tower 派單 → Worker 回報）不得 SKIP**；SKIP 代表 helper env 未注入，屬缺陷。
5. 以隔離實例開 WSL 遠端視窗，自動化可行的 UI 流程（參考 `e2e/pre6-ui-remote-acceptance.spec.ts`）：遠端終端建立 / 輸入輸出、斷線重連後輸出回放（T0403）、git / fs 面板讀取（T0405 / T0406）、遠端分頁派單後出現在正確工作區。逐項判定，做不到的移到「需真人」。

### C. PLAN-037 遠端工具偵測

6. smoke S10 + 隔離實例 UI：工具偵測結果（claude / codex / git / gh 的安裝狀態、版本、登入狀態）與 WSL 實際一致（以 `wsl -d Ubuntu-24.04 -- bash -lc '<tool> --version'` 對照）。**不要按安裝按鈕**（會改動 WSL 的工具版本）；安裝流程列入「需真人」。

### D. 收尾

7. 關閉隔離實例、清理 temp；WSL 保留升級後的 pre.4 server 與備份目錄（備份路徑寫進回報區，由使用者決定何時刪）。
8. 回報區：A / B / C 每項 PASS / FAIL / SKIP + 證據（指令輸出、日誌行、截圖路徑）；發現的產品缺陷（重現步驟、證據）；**需真人清單**（逐項寫清楚怎麼操作、看什麼）。
9. `git commit --only` 本單檔與新增的 e2e 檔；照 ct-exec 收尾通知塔台（yolo：`bat-notify.mjs --submit`，`--source "T0550"`）。

## 驗收條件

- [ ] WSL server 升到 0.6.1-pre.4 且 active（或已還原到 0.5.9-pre.4，並寫明原因）
- [ ] A1–A3、B4（S1–S13 逐項）、B5、C6 皆有判定與證據
- [ ] 需真人清單：每項寫明步驟與判準
- [ ] 未改產品程式碼；使用者的 BAT（9876）、其他發行版、Docker、`~/.ssh` 未被動到
- [ ] commit 只含本單檔與新增的 e2e 檔

## 完成狀態判定

- 全部可自動化項目 PASS → `DONE`（需真人項目不影響 DONE，由塔台轉給使用者）
- 有 FAIL（產品缺陷）或因環境卡住 → `PARTIAL`，寫明 gate 與證據

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

**DONE** — 全部可自動化項目 PASS（run 2：`5 passed`，A1–A4 / B4 S1–S13 / B5.1–B5.5 / C6 皆 PASS）。WSL `Ubuntu-24.04` bat-server 已升到 **0.6.1-pre.4**、service active、仍在 **9877**、憑證指紋不變（`22:3A:E4:C7…79:97`）。另發現 2 個產品缺陷候選（見下），不影響本單判定。

### 落點檢查

- C-0 PASS：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1 PASS；C-3 PASS（`e2e/` 存在）；C-2 無 `branch` 欄位
- 觀察到的 `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 執行環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 產出摘要

**新增檔案**：`e2e/t0550-wsl-acceptance.spec.ts`（opt-in：`BAT_E2E_T0550=1` + `BAT_E2E_EXECUTABLE`；未設定時 5 項全 skip，已驗證）。以安裝版 exe 起隔離實例（`--runtime=e2e-t0550-…`），跑 stock WSL 精靈、smoke、遠端視窗流程、工具偵測、離線匯入。未改任何產品程式碼。

**執行**：
- 升級前狀態：bundle `0.5.9-pre.4`、service active（MainPID 381）、unit `BAT_SERVER_PORT=9877`、WSL Mirrored 網路模式。升級前 smoke 基準 13/13 PASS（含 S13，見遭遇問題 1）。
- 備份：`~/.local/bat-server.bak-0.5.9-pre.4-t0550`（687M）、`~/.config/systemd/user/bat-server.service.bak-0.5.9-pre.4-t0550`。**保留未刪，由使用者決定何時刪除**。
- 精靈前先 `systemctl --user stop bat-server` 讓 9877 空出（理由見缺陷 1），精靈因此挑回 9877，使用者既有 profile（`wsl-ubuntu-24-04`，port 9877、同指紋、同 token 檔）不需變更即可沿用。
- run 1（02:37）：精靈升級成功；spec 本身 2 個錯誤（README 無結尾換行導致區段解析錯、`pty.getBuffer` 回傳物件被轉字串、B5.5 塔台 PTY 不在 renderer store）→ 修正 spec。
- run 2（02:40–02:42）：精靈再跑一次（同版號重裝，11 s 完成），`5 passed (1.3m)`。

| 項目 | 判定 | 證據 |
|---|---|---|
| A0 精靈在舊 server 執行中挑 port | INFO→缺陷 1 | `wsl.pickServerPort()` → `{"ok":true,"port":9878}`（舊 server 佔 9877） |
| A1 線上下載 | PASS | 日誌 `[server-bundle] fetching manifest from https://github.com/gowerlin/better-agent-terminal/releases/download/server-bundle-v0.6.1-pre.4/manifest.json`、`downloading tarball from …/server-bundle-v0.6.1-pre.4/bat-server-linux-x64-v0.6.1-pre.4.tar.gz`（166,355,145 bytes）；distributor `no verified cache, baseline missing-manifest → downloading`；精靈 `Downloaded server bundle from release`；隔離 userData `bat-server-bundles/` 有 tarball + `.sha256`；sha256 `86adb2f71fd9aee41ddf3e2442bde0f3e867ee728ba3b3b74724b38772fb27fe` = sidecar = release `.sha256` |
| A2 精靈完成 / server | PASS | 9/9 步驟 completed、無 prompt；version `0.6.1-pre.4`、is-active `active`、`127.0.0.1:9877` LISTEN 由 MainPID 3126 持有；profile port 9877、釘選指紋 = server 憑證 |
| A2 身分沿用 | PASS | port 9877→9877、憑證指紋不變 |
| A2 profile 可開啟 | PASS | `openNewInstance` → 遠端視窗 connected，遠端 shell 回 `T0550-gower@GXDEVPC02-25` |
| A3 helper 前提 | PASS | `scripts/bat-terminal.mjs`、`bat-notify.mjs`、`_bat-cert.mjs`、`_bat-logger.mjs`、`bin/node`（v24.22.0）、`bin/bat-server` 皆存在 |
| A4 離線：錯誤顯示匯入動作 | PASS | `BAT_SERVER_BUNDLE_BASE_URL=http://127.0.0.1:9/` → `install-server-bundle` failed；動作 `import-server-bundle:匯入本機 tarball…` / `retry` / `edit-config` / `cancel`；三語說明 + `[download-failed] … fetch failed (bad port)` + 匯入提示 |
| A4 匯入 | PASS | `remote.serverBundle.importLocal`（對話框 stub 指向 A1 下載檔，sidecar 同目錄自動帶入）→ `ok:true`、sha 相同；cache 有 tarball + `.sha256`；之後 `distribute`（base URL 不可達）→ `source: cache` |
| A4 不動 WSL | PASS | MainPID 3126 前後相同、版號不變（匯入以 IPC 直呼，未按精靈的匯入鈕以免自動重試重裝） |
| B4 smoke S1–S13 | PASS 13/13 | `bundle=0.6.1-pre.4 node=24.22.0`；S9 內嵌 claude `v2.1.300`；S13 BAT_* helper env 齊全、無 server token、raw command → `Forbidden: channel-not-allowed`、未知 agent → `Forbidden: agent-not-allowed`；cleanup 無殘留 smoke PTY |
| B5.1 遠端終端 I/O | PASS | create / write / resize → `B51-30x100-0.6.1-pre.4-OK` |
| B5.2 斷線重連回放（T0403） | PASS | `remote.disconnect()` 後 10 s 全程 disconnected；斷線期間印出的 `B52-REPLAY-42` 未即時收到；`remote.connect` 重連後 `pty:get-buffer` 含 marker（328 chars）；重連前後同一 shell（`$$` 3841） |
| B5.3 git 通道（T0405） | PASS | 暫存 repo：`git.getRoot` → `\\wsl.localhost\Ubuntu-24.04\tmp\bat-t0550-git.…`、branch `t0550`、log `t0550 commit`、status `?? g.txt`（Linux 路徑與 UNC 皆可） |
| B5.4 fs 沙箱（T0406） | PASS | 同步前 `Path access denied`；工作區 folderPath 存檔後 readFile `hi\n`、readdir 列出 `f.txt` / `g.txt`；`/etc/hostname` 仍 denied |
| B5.5 遠端 Tower 派單 → Worker 回報 | PASS | 塔台分頁由遠端視窗 UI 建立（env `BAT_WORKSPACE_ID`=`t0550-ws-…`）；`bat-terminal.mjs --agent gemini-cli --prompt …` exit 0、`✓ Terminal created` / `workspace: t0550-ws-… — from --workspace`；`created-externally` 帶 `workspaceId` + `towerTerminalId`、`remote:true`；分頁存進 registry 的同一工作區；Worker 內 `bat-notify.mjs --source T0550` exit 0 → `terminal:notified {targetId: tower, source: "T0550"}`。gemini 未安裝，Worker 只印 `Command 'gemini' not found`，未啟動任何模型 |
| C6 工具偵測版本 | PASS | claude ok@2.1.287、codex ok@0.160.0、git ok@2.43.0、gh ok@2.102.0、node missing，與 `wsl … --version` 一致 |
| C6 登入狀態 | PASS | claude / codex / gh 皆 `loggedOut`、credentialFilePresent=false，與 `gh auth status`（未登入）、`~/.claude/.credentials.json` / `~/.codex/auth.json`（不存在）一致 |
| C6 兩條偵測路徑 | PASS | `remoteTools.detect(profileId)`（本機短連線）與 `remoteTools.detectHere()`（遠端視窗）皆 ok；UI：精靈完成頁「遠端 AI 工具」區顯示相同版本 / 未登入 / 伺服器可見性（截圖 `C6-profile-card.png`） |

**證據位置**（本機 temp，未進 repo）：`C:\Users\Gower\AppData\Local\Temp\bat-t0550\evidence\`（`results.json`、`server-state-before.txt` / `server-state-after.txt`、`smoke-after.txt`、`debug-log-a.txt`、`wizard-console.txt`、`c6-detect.json`、`c6-wsl-actual.txt`、截圖 `A-wizard-complete.png` / `A2-remote-window.png` / `B5-dispatch.png` / `C6-profile-card.png` / `A4-download-failed.png`）；run 1 證據在同層 `evidence-run1\`；完整輸出 `run1.log` / `run2.log`；升級前 smoke `evidence-run1\smoke-before-0.5.9-pre.4.txt`。

**收尾**：兩個隔離實例皆已關閉（Terminal Server pid alive=false、runtime userData removed=true）；匯入用的 tarball 副本已刪；WSL `/tmp/bat-t0550-git.*` 已清（run 1 中斷留下的一個已手動刪除）。使用者 BAT（9876，PID 33948）未連、未關、未重啟；未動其他發行版 / Docker / `~/.ssh` / `.wslconfig`；未改產品程式碼。

**Commit**：見 frontmatter `commit`（`git commit --only` 本單檔 + `e2e/t0550-wsl-acceptance.spec.ts`；`src/styles/settings.css` 未納入）。未 push。

### 需真人清單

1. **使用者自己的 WSL profile 重連**：在使用中的 BAT 開啟（或若已開著，觀察）`WSL Ubuntu-24.04` 視窗。判準：自動重連成功、Profiles 對話框該卡片為 🟢、遠端終端可輸入；無指紋不符 / 認證失敗提示（port、憑證、token 檔皆未變，預期免設定）。若升級時該視窗正連著，曾因 service 停止 / 重啟斷線一次，屬預期。
2. **遠端 Tower 派真 agent**：在 WSL 遠端視窗開塔台分頁，依 CLAUDE.md「遠端 Tower 通知」以 `"${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-terminal.mjs" --skill ct-exec --workorder T#### --notify-id "$BAT_TERMINAL_ID" --workspace "$BAT_WORKSPACE_ID"` 派一張小單（需先登入 WSL 內的 claude，並在遠端 `~/.claude/skills` 裝 control-tower skill）。判準：Worker 分頁出現在塔台的工作區、ct-exec 跑完以 `bat-notify --submit` 回報時塔台出現 toast / badge / 預填並送出。
3. **遠端 Agent 面板**：WSL 視窗開 Claude Agent 面板送一則訊息（耗 token）。判準：可對話、cwd 為 WSL 路徑。
4. **PLAN-037 一鍵安裝 / 更新**：精靈完成頁或 profile 卡片的「遠端 AI 工具」→ 對 Claude Code 按「更新」（目前系統 claude 2.1.287），或對未安裝工具按「安裝」。判準：遠端視窗開啟並執行對應指令、完成後「重新檢查」顯示新版本；sudo 需求依「sudo（免密碼）」標示運作。（會改動 WSL 工具版本，故未自動化）
5. **精靈的「匯入本機 tarball…」按鈕**：在無法連 GitHub 的環境（或設 `BAT_SERVER_BUNDLE_BASE_URL` 為不可達位址）跑 WSL 精靈 → 失敗畫面按「匯入本機 tarball…」→ 選 `bat-server-linux-x64-v0.6.1-pre.4.tar.gz`。判準：自動帶入同目錄 `.sha256`、步驟自動重試並完成安裝。（本單只以 IPC 驗證匯入 + cache 命中，未按鈕，以免重裝；注意缺陷 1：若舊 server 仍在跑，重試會換 port）
6. **profile 卡片的工具區**：spec 中 profile 卡片的 `remote-tools-entry-profile` 未能定位（精靈完成頁蓋在上層），UI 判定改以精靈完成頁截圖為準。真人在 Profiles 對話框展開 WSL 卡片確認同樣顯示即可。

### 發現的產品缺陷

1. **（建議開 BUG，中）以 WSL 精靈升級執行中的 server 會換 port，既有 profile 失效**
   - 重現：WSL 已有精靈裝的 bat-server 在跑（unit port P，例 9877）→ 再跑一次「新增 WSL 連線設定」精靈（升級的唯一 UI 路徑）。
   - 現象（以隔離實例實測 picker、其餘為程式碼路徑）：`write-systemd-unit` 的 `wsl:pick-server-port` 在 Windows 端探測 P，舊 server 仍佔用（Mirrored 共用 localhost）→ 回 `{"ok":true,"port":9878}`；unit 改寫為新 port 並重啟，原 profile（port P）變成連不上，精靈另建一個新 profile。
   - 證據：`results.json` 的 `A0.port-while-running`；`electron/main.ts` `wsl:pick-server-port` → `electron/wsl-systemd.ts` `pickServerPort`（只排除本機 RemoteServer port，不認得「同一 distro 舊 bat-server 自己佔的 port」）。本單以先停 service 避開。
   - 建議方向（塔台決定）：偵測到同 distro 既有 unit 時沿用其 `BAT_SERVER_PORT`（或先停舊 service 再挑 port），並更新既有 profile 而非新建。
2. **（建議開 BUG，低）覆蓋安裝不清舊檔，舊 bundle 殘留約 256 MB**
   - 重現：既有 `~/.local/bat-server` 上再跑精靈。`wsl:install-bundle`（`electron/wsl-detect.ts` `installBundle`）只 `mkdir -p` + `tar -xzf … --strip-components=1`，不清目錄。
   - 證據：升級後仍有 0.5.9-pre.4 的 `node_modules/@anthropic-ai/claude-agent-sdk-linux-x64`（226M，T0546 起 bundle 已不含）、`@img`（17M）、`better-sqlite3`（13M，T0492 移除）、`sharp`（912K，T0503 移除）；`du -sh ~/.local/bat-server` = 708M。功能未受影響（S1–S13 PASS）。
   - 建議方向：解到暫存目錄後換名，或解壓前清掉 bundle 管理的子目錄（`bin/`、`electron/`、`node_modules/`、`scripts/`…），保留使用者資料（資料在 `~/.local/share/bat-server`，不受影響）。

### 互動紀錄

無（`CT_INTERACTIVE=0`，yolo）。

### Renew 歷程

無。

### 遭遇問題

1. **工單前提與實況不符（非缺陷）**：工單寫「0.5.9-pre.4 沒有 helper env，S13 只會 SKIP」，實測升級前 smoke 已 13/13 PASS（含 S13）——該部署的 `scripts/` 有 T0456 期手動補上的 helper（`*.bak-t0456.absent` 為佐證），headless 因此已注入 helper env。升級後 S13 同樣 PASS，判定不受影響。
2. **spec 首輪錯誤（已修，非產品問題）**：`README.md` 無結尾換行使 `## is-active` 標記黏到上一行（A2.server 誤判 FAIL）；`pty.getBuffer` 回傳 `{ data, total }` 被轉成 `[object Object]`（B5.2 誤判 FAIL）；塔台 PTY 以 IPC 直建、不在 renderer store，外部分頁被 `[T0431]` 分支忽略（B5.5 逾時）→ 改為 t0523 做法（工作區 + 塔台分頁存 registry 後 reload，由 UI 建塔台 PTY）。run 1 因 serial 模式中斷，C6 / A4 未執行；run 2 全部 PASS。run 1 中斷留下的 `/tmp/bat-t0550-git.P2RlTX` 已手動刪除。
3. `wsl.exe -- bash -lc` 會把參數交給預設 shell 再解析一次（`$t` 被吃掉），spec 改用 `--exec`。

### 回報時間

2026-10-16T02:43:10+0800（證據蒐集完成）；收尾時間見 frontmatter `completed_at`。

---

## 塔台收單（第六十六 session，2026-10-16T02:46:24+0800）

- ✅ **T0550 已確認完成**：commit `97d54f5a`（本單 + `e2e/t0550-wsl-acceptance.spec.ts`）、`36d4a2bb`（記錄 hash）。塔台複驗：WSL `~/.local/bat-server` README `version: 0.6.1-pre.4`、`systemctl --user is-active` = active、unit `BAT_SERVER_PORT=9877`、`du` 708M（備份 687M）；`npx playwright test e2e/t0550-wsl-acceptance.spec.ts` 未設 env → `5 skipped`。
- → PLAN-036 / PLAN-037 **DONE**；缺陷 1 / 2 → **BUG-138** / **BUG-139**（OPEN）。
- 遭遇問題 1（舊 server 已有 T0456 期手動補的 helper，升級前 S13 已 PASS）：採納，工單前提有誤。
- **Worker 分頁回收（PLAN-041 觀察）**：收單即 `--close-worker`（02:44:46）→ exit 0，`scheduled … (output 846 ms ago; will wait for quiet)`；到期 02:44:56 `→ cancelled (user input during the delay)`，分頁保留。02:45:14 再請求 → 02:45:24 `close requested`、分頁關閉、registry 無殘留。延遲期間的「使用者輸入」來源未確認（使用者操作，或 xterm 自動回應如 focus report 被算成輸入），待使用者確認。
