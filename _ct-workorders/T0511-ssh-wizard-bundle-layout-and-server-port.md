---
schema_version: 1
schema_kind: workorder
id: T0511
title: "修 SSH wizard 安裝 / 啟動：bundle 解壓去掉 staging/（BUG-120）、unit / plist 正確傳 port 與 bind 並修 verify fallback（BUG-121）、permission-denied 動作按鈕；以 T0510 的 e2e/pre5-ssh-alias.spec.ts 在不套 workaround 下全綠驗證"
type: implementation
status: TODO
repo: better-agent-terminal
project: D139
priority: P1
sizing: M
created_at: "2026-10-14T02:36:13+0800"
target_version: "0.6.0-pre.6"
depends_on:
  - T0510
related:
  - BUG-120
  - BUG-121
  - "T0510 回報區（A6、發現的產品缺陷 1 / 2、其他觀察 1）"
  - "e2e/pre5-ssh-alias.spec.ts、e2e/real-remote/t0510-ssh-alias-env.mjs、t0510-sshd.Dockerfile（T0510 產出，本單用來驗證）"
  - "T0505 / T0506（SSH alias，本單不得破壞）"
affects_files:
  - electron/remote/ssh-bundle-uploader.ts
  - electron/remote/ssh-start-server.ts
  - electron/remote/__tests__/
  - src/components/setup-wizard/__tests__/
  - src/components/setup-wizard/
  - src/locales/
  - e2e/pre5-ssh-alias.spec.ts
  - e2e/real-remote/
  - CLAUDE.md
  - _ct-workorders/T0511-ssh-wizard-bundle-layout-and-server-port.md
  - _ct-workorders/BUG-120-ssh-wizard-bundle-extracts-into-staging-subdir.md
  - _ct-workorders/BUG-121-ssh-service-unit-wrong-port-env-name.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **Docker / WSL**：沿用 T0510 規則——只操作 `bat-t0510-*` + label `bat.t0510=1` 的容器 / network（可重用 T0510 env 腳本與 image `bat-t0510-sshd:local`）；不得 `docker system prune`、不得動其他容器（含 `bat-t0467-*`）；不得 `wsl --shutdown` / `--terminate`；不得動 WSL `~/.local/bat-server`；收尾 `down`。"
  - "🔴 **`~/.ssh/config`**：只能經 T0510 env 腳本的 `apply-ssh-config` / `restore-ssh-config`（帶標記區塊、備份、還原後比對 SHA-256）；回報區附還原後雜湊，必須等於 T0510 記錄的原檔 `00aab1cd…c58a2`（若原檔在這期間被使用者改過，以本單開始時的備份為準並說明）。真實 known_hosts / 金鑰不動。"
  - "🔴 **不碰使用者正在用的 BAT**（port 9876、真實 userData 只讀）；不得以預設實例啟動；e2e 一律隔離實例。"
  - "🔴 **不得消耗 Claude token**（不開 Claude Agent session、不送 prompt）。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔維持 LF；不 push；不跑全套 `npm run test:e2e`（L141）。"
---

# T0511 — SSH wizard 安裝 / 啟動修正（BUG-120 / BUG-121）

## 背景

T0510 以自動化實機驗收發現：pre.5 的 SSH wizard 在乾淨 Linux 目標上 `start-server` 必定失敗，原因有兩個獨立缺陷（詳見 BUG-120 / BUG-121 與 T0510 回報區）。T0505 / T0506 的 alias 行為在測試側 workaround 下全部正確，本單只修安裝 / 啟動。

## 任務

### A. BUG-120 — bundle 解壓多一層 `staging/`

1. `electron/remote/ssh-bundle-uploader.ts:47` 的遠端解壓與 WSL（`electron/wsl-detect.ts:338`）對齊，讓 bundle 落在 `<installPath>/bin/…`。先確認 release tarball（`scripts/build-server-bundle.mjs:430`）頂層確實是 `staging/`；若要容許「頂層不是 `staging/`」的 tarball（例如手動 / 舊版 bundle），回報區說明你的判斷
2. **既有壞安裝**：pre.5 跑過 SSH wizard 的主機可能留下 `<installPath>/staging/`。確認重跑 wizard 或「重新安裝 bundle」能得到正確佈局（必要時清掉殘留的 `staging/`，**只清本工具建立的路徑**）
3. 盤點其他會解 server bundle tarball 的路徑（Docker、remote update / distributor、dev-deploy 等），列出是否有同類問題；**在本單範圍內的 SSH 路徑修掉**，其他路徑若有問題在回報區列出，不修

### B. BUG-121 — port / bind 設定名稱錯誤 + verify fallback

1. `electron/remote/ssh-start-server.ts` 的 systemd unit 與 launchd plist 改成 bat-server 真正讀得到的方式（`scripts/bat-server.mjs`：`--port` / `BAT_SERVER_PORT`、`--bind-interface`）。**必須相容已部署在遠端的舊版 bundle**（不能只改 `bat-server.mjs` 讓它多讀 `BAT_REMOTE_PORT`，因為遠端舊 bundle 不會更新）；選命令列參數或 `BAT_SERVER_PORT`，回報區說明理由
2. verify：`ss -tnlp | grep ':9876' || pgrep -x bat-server` 的 fallback 比對不到實際行程（node `MainThread`），改成可靠的判定（例如 `systemctl --user is-active` / `launchctl` 狀態 + 埠檢查），不得因 fallback 過寬而把「沒在 9876 監聽」判成成功
3. 查 git 歷史：這兩個缺陷從哪個 commit / 版本開始，SSH wizard 是否在任何已發佈版本上真的能在 Linux 目標完成（給 release notes 用）

### C. permission-denied 的動作按鈕（T0510 其他觀察 1，low）

`verify-ssh-auth` 回 `permission-denied` 時，失敗步驟顯示通用的「重試 / 跳過 / 編輯設定 / 取消」，沒有 `error-mapper.ts` `ssh-permission-denied` 條目宣告的「修改 SSH 設定」（`wizard.action.editSshSettings`）。查清楚 mapped action 為何沒有呈現，修到 mapped action 會顯示且行為等同跳回 `configure-ssh-host`；三語 i18n 齊全。若查證後判定現行行為是刻意設計，回報區說明理由，不改

### D. 驗證

1. 單元測試：A / B / C 各有測試（unit 內容、plist 內容、遠端解壓指令、verify 判定、mapped action），HEAD 上先寫的測試應失敗（red）
2. **e2e（關鍵）**：以 source build（`npx vite build`，不設 `BAT_E2E_EXECUTABLE`）跑 `node e2e/real-remote/t0510-ssh-alias-env.mjs up` → `BAT_E2E_PRE5_SSH=1 BAT_E2E_PRE5_SSH_WORKAROUND=0 npx playwright test e2e/pre5-ssh-alias.spec.ts` → **A6-0 stock install 轉綠，其餘子項全綠** → `down`。若 spec 在 source build 下需要 bundle 來源調整（例如 dev 模式從哪裡拿 tarball），只改 e2e 側並說明
3. 若 spec 的 workaround 已無必要，可移除或保留為 opt-in，回報區說明
4. `npx vite build`、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全綠
5. CLAUDE.md：在 SSH 相關段落補一行 bundle 佈局（strip `staging/`）與 port / bind 傳遞方式（簡短，事實性）

## 驗收條件

- [ ] BUG-120 / BUG-121 修正，有 red → green 單元測試
- [ ] `e2e/pre5-ssh-alias.spec.ts`（workaround 關閉）全綠，A6-0 PASS；回報區附各子項耗時與關鍵 log 行
- [ ] 舊版 bundle 相容性說明（B1）與既有壞安裝處理（A2）
- [ ] C 修好或有理由不改
- [ ] typecheck 雙 0、unit 全綠、vite build exit 0
- [ ] 收尾：`docker ps -a --filter label=bat.t0510=1` 空；`~/.ssh/config` 還原雜湊一致
- [ ] BUG-120 / BUG-121：`status: FIXED`、`fixed_at`、body 狀態列同步、修正摘要

## Sub-session 執行指示

1. 讀本工單、BUG-120 / BUG-121、T0510 回報區 A6 節與 `e2e/pre5-ssh-alias.spec.ts`、`e2e/real-remote/t0510-ssh-alias-env.mjs`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗證 → 填回報區；全部達成寫 `DONE`，否則 `PARTIAL` / `BLOCKED`
4. commit 本單改動檔（`git commit --only` 或精準 stage）；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫
