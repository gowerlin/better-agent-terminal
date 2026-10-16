---
schema_version: 1
schema_kind: workorder
id: T0561
title: "SSH 精靈升級 / 取消還原實機 e2e（安裝版 pre.5，t0515 Docker sshd）：升級後段失敗取消 → 舊安裝樹、unit `.bat-prev`、執行中 service 還原（BUG-141 SSH 路徑）；正常升級 → 乾淨覆蓋、完成時清 `.bat-old` / `.bat-prev`（BUG-139 SSH 路徑）"
type: verification
status: DONE
repo: better-agent-terminal
project: BUG-141
priority: P2
sizing: S
created_at: "2026-10-16T14:28:10+0800"
updated_at: "2026-10-16T14:35:07+08:00"
started_at: "2026-10-16T14:29:15+08:00"
completed_at: "2026-10-16T14:35:07+08:00"
commit: "bb480dbf"
target_version: "0.6.1-pre.5（已安裝；不改產品程式碼）"
depends_on: []
related:
  - "T0554（SSH：`start-server` 備份 unit 為 `.bat-prev`、`ssh:uninstall-bundle` `mode: 'restore-previous'`、`ssh:stop-server` `action: 'restore-previous'` / `'discard-backup'`、`WizardStep.finalize`；當時 SSH 只有單元測試）"
  - "T0552（`electron/server-bundle-install-script.ts` 乾淨覆蓋，SSH 與 WSL 共用）"
  - "T0515（`e2e/real-remote/t0515-wizard-env.mjs`、`e2e/pre6-wizard-acceptance.spec.ts`：stock SSH 精靈驅動、Docker sshd + systemd 容器）"
  - "T0559 / T0560（WSL 版同型驗收：`T0554 cancel` 注入失敗、marker / inode、canary 判定）"
affects_files:
  - e2e/t0561-ssh-upgrade-rollback.spec.ts
  - e2e/real-remote/t0515-wizard-env.mjs
  - _ct-workorders/T0561-ssh-wizard-upgrade-rollback-e2e.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不改產品程式碼（`src/**`、`electron/**`、`scripts/**`、`package.json`）。新增 opt-in spec `e2e/t0561-ssh-upgrade-rollback.spec.ts`（未設 opt-in 變數時全 skip，實測）；`t0515-wizard-env.mjs` 只在必要時小幅擴充，既有指令行為不變。發現產品缺陷 → 不修，記錄證據回報 PARTIAL，由塔台開 BUG。"
  - "🔴 只用 `bat-t0515-*` 容器 / 網路 / 狀態（WSL Docker）；不碰 WSL `Ubuntu-24.04` 的 `~/.local/bat-server` 與其 service，不碰使用者自己的 BAT（9876）與其 profile；只用隔離實例（`--runtime=e2e-…`，安裝版 `C:\\Program Files\\BetterAgentTerminal\\BetterAgentTerminal.exe`）。不啟動模型、不按工具安裝按鈕。"
  - "🔴 `~/.ssh/config`：只能經 `t0515-wizard-env.mjs apply-ssh-config` / `restore-ssh-config`（備份 + SHA-256 檢查）；結束時（含失敗）一定執行 `restore-ssh-config`，並在回報區寫出還原後 hash 與原始 hash 是否相同。真實 known_hosts / 金鑰不讀不寫。"
  - "🔴 結束時 `t0515-wizard-env.mjs down`（容器、網路、volume、狀態；image 可保留），隔離實例 userData 移除；回報區列出殘留檢查結果。"
  - "🔴 commit 用 `git add` 後 `git commit --only <本單 affects_files 內實際改動的檔>`（`src/styles/settings.css` 的 M 不是你的變更）。不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。"
  - "🔴 不要呼叫 `bat-terminal.mjs --close-worker`；通知塔台之後不要再執行任何指令。"
---

# T0561 — SSH 精靈升級 / 取消還原實機 e2e

## 背景

T0554 把「精靈升級時保留舊版、取消時換回」做在 WSL 與 SSH 兩條路徑上。WSL 已用安裝版 pre.5 實機驗過（T0559 / T0560），SSH 只有單元測試。SSH 的 server port 固定為 9876、不探測，BUG-138（換 port）不適用；需要驗的是：

- **取消還原（BUG-141，SSH）**：install 換入新樹後舊樹留在 `<root>.bat-old`；`start-server` 第一次執行時把 unit 備份成 `<unit>.bat-prev`；後段失敗取消 → 換回舊樹（`ssh:uninstall-bundle` `mode: 'restore-previous'`）、unit 寫回（`ssh:stop-server` `action: 'restore-previous'`），舊 server 原本在跑則以舊 bundle 重新啟動。
- **正常升級（BUG-139，SSH）**：乾淨覆蓋（舊樹檔案不殘留）；精靈完成時 `finalize` 刪掉 `.bat-old` 與 `.bat-prev`。

## 任務

1. 照 ct-exec 開工。以 `node e2e/real-remote/t0515-wizard-env.mjs up` + `apply-ssh-config` 起環境（記錄原始 `~/.ssh/config` hash）；目標用 `bat-t0515-direct`（jump 容器、帳號 `bat`、systemd user service）。
2. 寫 `e2e/t0561-ssh-upgrade-rollback.spec.ts`（opt-in，例：`BAT_E2E_T0561=1` + `BAT_E2E_EXECUTABLE`；Windows only），沿用 `pre6-wizard-acceptance.spec.ts` 的精靈驅動與 `t0550-wsl-acceptance.spec.ts` 的判定 / `results.json` 寫法。測試內容（serial）：
   - **S0 首次安裝**：stock SSH 精靈在乾淨目標安裝 pre.5 → server active、9876 由服務自己的行程 LISTEN。記錄安裝樹 inode、在樹內植入 marker（例 `.t0561-previous-install`）、unit 內容 sha256、MainPID、`server-cert.json` / `server-token.json` sha256。
   - **S1 升級後段失敗 → 取消**：在隔離實例主行程注入 install **之後**某一步的失敗（參考 T0554 對 `wsl:fetch-fingerprint` 的 `ipcMain` 替換；SSH 請選精靈實際會在 install / start-server 之後呼叫的 channel，並在回報區寫明選了哪個、為什麼），再跑精靈 → 失敗 → 按取消。判定：失敗當下新樹已換入、`.bat-old` 存在、`.bat-prev` 存在；取消後 marker 回來、inode 與 S0 相同、unit sha256 與 S0 相同、`.bat-new` / `.bat-old` / `.bat-prev` 無殘留、service active 且 MainPID 為舊 bundle 重新啟動的新行程、cert / token 不變、profile 未新增或改動（比對時排除 `updatedAt`，T0560 教訓）。
   - **S2 正常升級**：精靈前在舊樹植入 canary（檔案 + `node_modules/<假套件>/`），跑精靈到完成。判定：canary 不存在、`.bat-new` / `.bat-old` / `.bat-prev` 無殘留（finalize）、server active、9876 LISTEN、cert / token 不變、既有 profile 被更新而非新建（若精靈對同 host / user / port 會更新 profile，T0552）。
   - 版本：三次都是 pre.5（安裝版只會下載自己版號的 bundle）；同版重裝不影響上述判定（marker / inode / canary 都不依賴版本差）。若能以合理方式讓 S0 裝 pre.4（例如經 `server-bundle:import-local` 匯入 `server-bundle-v0.6.1-pre.4` 的 tarball 到 cache 後再裝），可加做跨版，非必要。
3. 執行：未設 opt-in → 全 skip；設 opt-in → 全部跑。失敗時先判斷是 spec 問題還是產品問題，spec 問題修好重跑；產品問題照 memory_overrides 第 1 條處理。
4. `restore-ssh-config`、`down`、殘留檢查（容器 / 網路 / volume / 隔離 userData / `~/.ssh/config` hash）。
5. 回報區列出 `results.json` 每一項 verdict 與一行證據；填 `DONE` / `PARTIAL` / `FAILED`；commit；通知塔台（yolo：`bat-notify.mjs --submit`，`--source "T0561"`）。通知後保持閒置。

## 驗收條件

- [ ] 新 spec 未設 opt-in 時全 skip（實測），`npx playwright test --list` 可解析
- [ ] S0 / S1 / S2 各判定逐項列出；S1 注入點與理由寫明
- [ ] `~/.ssh/config` 還原後 hash = 原始 hash（或說明只剪除標記區塊的原因）
- [ ] 環境已 `down`，無殘留
- [ ] commit 只含 affects_files 內實際改動的檔

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

**DONE** — S0 / S1 / S2 全部 PASS（`3 passed (48.7s)`），14 項 verdict 皆 PASS；未改產品程式碼；環境已 `down`、`~/.ssh/config` hash 還原一致。

Landing check：**PASS**。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 PASS；C-3 present（`e2e/`、`e2e/real-remote/t0515-wizard-env.mjs` 皆存在）；C-2 無 `branch` 欄位。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。Mode：`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 產出摘要

**檔案**
- 新增 `e2e/t0561-ssh-upgrade-rollback.spec.ts`（opt-in：`BAT_E2E_T0561=1` + `BAT_E2E_EXECUTABLE`，Windows only，`test.describe.serial`）。三個 test 共用同一個隔離 runtime（`--runtime=e2e-t0561-<ts>`，中間 `closeIsolated(..., { keepUserData: true })` 再以同 runtimeId 重開），所以 S2 看得到 S0 寫的 profile 與 bundle cache；`afterAll` 還原 `~/.ssh/config` 並移除任何殘留的隔離 userData。
- `e2e/real-remote/t0515-wizard-env.mjs`：**未修改**（既有 `up` / `apply-ssh-config` / `restore-ssh-config` / `down` 足夠）。

**S1 注入點**：`ssh:verify-tunnel-open`（在隔離實例主行程 `ipcMain.removeHandler` + `ipcMain.handle` 回 `{ ok:false, errorCode:'ssh-tunnel-failed', error:'T0561 injected failure after start-server (ssh:verify-tunnel-open)' }`）。理由：SSH 流程順序為 `install-server-bundle → start-server → fetch-fingerprint`，`sshFetchFingerprintStep.run` 的第一個主行程呼叫就是 `ensureSshVerifyEndpoint` → `ssh.openVerifyTunnel`；`result.ok === false` 直接 throw，`ctx.verifyEndpoint` 未設，`explainForwardingDenied` 不改寫錯誤。`ssh:read-server-identity` 失敗只 warn、不會讓步驟失敗，所以不選它；也不像 pre6 W7a 那樣改 sshd（`AllowTcpForwarding no`），不動容器設定。

**執行**：`node e2e/real-remote/t0515-wizard-env.mjs up`（containers `bat-t0515-jump` 172.18.0.3 / `bat-t0515-target`，probe `bat@bat-t0515-jump`）→ `BAT_E2E_T0561=1 BAT_E2E_EXECUTABLE='C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe' npx playwright test e2e/t0561-ssh-upgrade-rollback.spec.ts`（FileVersion `0.6.1-pre.5`）→ `down`。證據目錄 `%TEMP%\bat-t0561\evidence`（`results.json`、各階段 identity、wizard console、截圖）。

**`results.json` verdict**

| key | verdict | 證據 |
|---|---|---|
| S0.installed | PASS | wizard complete 15 s；active、MainPID 177 LISTEN `127.0.0.1:9876`（pid=177）、exe `/home/bat/.local/bat-server/bin/node`；`ExecStart=/home/bat/.local/bat-server/bin/bat-server --port 9876 --bind-interface localhost`；無 sibling；新 profile 1 個 `ssh-bat-t0515-direct` |
| S0.identity | PASS | marker `.t0561-previous-install` planted；inode 11917；unit `8d891e54…`；cert `3a737942…`；token `38e8955d…`；version 0.6.1-pre.5 |
| S1.failed-after-install | PASS | steps install / start-server `completed`、fetch-fingerprint `failed`，detail 含注入訊息；失敗當下 marker absent、inode 14831（新樹）、siblings `bat-server.service.bat-prev` + `bat-server.bat-old`（無 `.bat-new`）、active、MainPID 437（新 bundle） |
| S1.tree-restored | PASS | marker present；inode 11917 → 14831 → 11917；`.bat-new` / `.bat-old` / `.bat-prev` 無殘留；steps install / start-server / fetch-fingerprint `rolled-back` |
| S1.unit-restored | PASS | unit sha256 `8d891e5457e3…b043` S0 = 失敗當下 = 取消後（見遭遇問題 1） |
| S1.service-running | PASS | MainPID 177 → 437 → 551；exe `/home/bat/.local/bat-server/bin/node`（帶 S0 marker、inode 11917 的樹）；pid=551 LISTEN `127.0.0.1:9876` |
| S1.identity-kept | PASS | server-cert.json / server-token.json sha256 不變 |
| S1.profiles-untouched | PASS | before 2 / after 2，排除 `updatedAt` 比對相同；updatedAt 變動：none |
| S1.rollback-log | PASS | 無 warning；`Restored the previous bat-server service (ssh-linux)`、`Restored the previous BAT server bundle at /home/bat/.local/bat-server and started it again` |
| S2.clean-install | PASS | canary `.t0561-canary`、`node_modules/t0561-stale-canary` 植入成功 → 升級後皆不存在；S0 marker absent；inode 11917 → 14834 |
| S2.finalize | PASS | `.bat-new` / `.bat-old` / `.bat-prev` 無殘留；log `The previous server bundle is kept until setup finishes (…bat-server.bat-old)` → `Removed the previous BAT server bundle (…bat-server.bat-old)` |
| S2.server | PASS | wizard complete 11 s、8 步全 completed；active、MainPID 747 LISTEN 9876、ExecStart 同上 |
| S2.identity-kept | PASS | cert / token sha256 與 S0 相同 |
| S2.profile-updated | PASS | profile 數 2 → 2、added 0，`ssh-bat-t0515-direct` 名稱不變；log `Updated the existing remote profile "SSH bat-t0515-direct" instead of creating a new one` |

**驗收條件**
- [x] 未設 opt-in：`npx playwright test e2e/t0561-ssh-upgrade-rollback.spec.ts` → `3 skipped`；`--list` 解析出 3 個 test
- [x] S0 / S1 / S2 判定逐項列出；S1 注入點與理由如上
- [x] `~/.ssh/config`：原始 sha256 `00aab1cda8667c85db60b35f406a785bd9a909b87df7cf49aa78450ca03c58a2`，套用後 `ba9d0e30…`，`restore-ssh-config`（spec afterAll）「backup copied back」→ `00aab1cd…c58a2`，`match=true`；`down` 後再算仍為 `00aab1cd…c58a2`
- [x] `down`：containers / networks / volumes with `bat.t0515=1` = none；state dir 移除；隔離 userData `BetterAgentTerminal-runtime-e2e-t0561-1792132380312` 已移除（`ls` 無匹配）；三次 Terminal Server pid teardown 後皆 `alive: false`。image `bat-t0515-sshd:local` / `bat-t0515-docker-server:local` 依預設保留（工單允許）
- [x] commit 只含 affects_files 內實際改動的檔（spec + 本工單）

### 互動紀錄

無（`CT_INTERACTIVE=0`，fire-and-forget）。

### Renew 歷程

無。

### 遭遇問題

1. **S1.unit-restored 的辨識力有限**：S0 / S1 / S2 都是 pre.5、port 9876，start-server 寫出的 unit 內容與舊的逐位元相同，所以「unit sha256 = S0」在換寫前後本來就成立。unit 還原路徑確實有執行的證據改看：失敗當下 `bat-server.service.bat-prev` 存在、取消後消失、log `Restored the previous bat-server service (ssh-linux)`。要讓 sha 比對本身有鑑別力，需要跨版（不同 unit 內容）或在 S1 前手動改 unit（會改變「舊 unit」本身，未採用）。
2. **跨版（pre.4 → pre.5）未做**（工單標非必要）。marker / inode / canary 判定不依賴版本差。
3. S2 的 `.bat-prev` 刪除（start-server `finalize` / `discard-backup`）沒有 log 行，只以「完成後 `.bat-prev` 不存在」判定。
4. 未發現產品缺陷。

### 回報時間

2026-10-16T14:35:07+08:00
