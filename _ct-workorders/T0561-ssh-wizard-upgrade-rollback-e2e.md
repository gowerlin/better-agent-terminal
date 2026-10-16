---
schema_version: 1
schema_kind: workorder
id: T0561
title: "SSH 精靈升級 / 取消還原實機 e2e（安裝版 pre.5，t0515 Docker sshd）：升級後段失敗取消 → 舊安裝樹、unit `.bat-prev`、執行中 service 還原（BUG-141 SSH 路徑）；正常升級 → 乾淨覆蓋、完成時清 `.bat-old` / `.bat-prev`（BUG-139 SSH 路徑）"
type: verification
status: TODO
repo: better-agent-terminal
project: BUG-141
priority: P2
sizing: S
created_at: "2026-10-16T14:28:10+0800"
updated_at: "2026-10-16T14:28:10+0800"
started_at: ""
completed_at: ""
commit: ""
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

### 產出摘要

### 互動紀錄

### Renew 歷程

### 遭遇問題

### 回報時間
