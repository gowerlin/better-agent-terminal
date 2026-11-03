---
schema_version: 1
schema_kind: index
id: _bug-tracker
index_kind: bugs
generated_at: "2026-11-03T12:35:20+08:00"
generator: control-tower-sync
source_globs:
  - _ct-workorders/BUG-*.md
exclude_globs:
  - _ct-workorders/_archive/**
  - _ct-workorders/examples/**
total: 68
breakdown:
  OPEN: 0
  FIXING: 0
  FIXED: 1
  VERIFY: 0
  CLOSED: 66
  WONTFIX: 1
---

# Bug Tracker

> ⚠️ 此文件由 `*sync` 自動生成，請勿手動編輯。
> 最後同步：2026-11-03 12:35 — BUG-202 / 204 CLOSED（交付版 `v0.7.4-pre.2` linux-acceptance `41578537967`）；2026-11-03 12:12 — BUG-203 WONTFIX（列為已知限制，D246）；2026-11-03 12:07 — BUG-204 FIXED（T0800 `fb4c0f8c`，分支 `ct/T0800`，待合併與交付版驗收；linux-acceptance `41575592616` 24.04 W1 PASS）；BUG-203 補 T0800 22.04 實測紀錄（`GLIBC_2.38` not found，狀態不動）；2026-11-03 11:45 — BUG-204 → FIXING（T0800，D245）；2026-11-03 03:10 — 開 BUG-204（OPEN，medium，Linux 打包版 whisper 找不到 `libwhisper.so.1`，T0799 查證）；`ct/T0799` 合併回 main（`bf561a3d`）；2026-11-03 03:06 — BUG-202 FIXED（T0799 `d773cb67`，分支 `ct/T0799`，待合併與交付版驗收；linux-acceptance `41505876807` 22.04 PASS / 24.04 WARN 自動降級）；BUG-203 補 T0799 查證紀錄（狀態不動）；2026-11-03 02:21 — BUG-202 → FIXING（T0799，D244）；2026-11-03 02:17 — 開 BUG-202（OPEN，high，Ubuntu 24.04 AppImage sandbox）／BUG-203（OPEN，low，22.04 whisper glibc 2.38，待查），T0798 CI 驗收 run `41496512040`；2026-11-03 00:36 — BUG-199 / 200 / 201 CLOSED（`v0.7.4-pre.1` CI Test gate 綠，run `41480278090`，D241）；2026-11-03 00:16 — BUG-196 CLOSED（交付版 `v0.7.3-pre.9` 使用者實機 T0796＋安裝版 e2e T0792，D240）；2026-11-03 00:10 — BUG-201 FIXED（T0795 `6c2b6b93`，待 CI Test gate 驗收）；2026-11-03 00:03 — BUG-201 → FIXING（T0795，D238）；2026-11-03 00:01 — 開 BUG-201（OPEN，low，T0794 發現，D237）；2026-11-02 23:58 — BUG-200 FIXED（T0794 `2b3f0b1b`，待 CI Test gate 驗收）；2026-11-02 23:05 — BUG-200 → FIXING（T0794，D236）；2026-11-02 23:01 — BUG-197 / 198 CLOSED（交付版 `v0.7.3-pre.9` 安裝版自動化實測 T0792，D235）；開 BUG-200（OPEN，low，T0793 發現）；2026-11-02 22:58 — BUG-199 FIXED（T0793 `f03adbd6`，待 CI Test gate 驗收）；2026-11-02 22:40 — BUG-199 → FIXING（T0793，D234）；2026-11-02 22:12 — 開 BUG-199（OPEN，low，pre.9 聯合驗證測試逾時，不擋發版）；2026-11-02 22:06 — BUG-198 FIXED（T0791 `20bc7a88`，待驗收）；2026-11-02 21:45 — BUG-198 → FIXING（T0791，D232）；2026-11-02 19:51 — 開 BUG-198（OPEN，low，T0790 發現，不擋 pre.8）； BUG-197 FIXED（T0790 `77ad79ea`，待驗收）；2026-11-02 19:25 — BUG-197 → FIXING（T0790，D230）；2026-11-02 19:22 — BUG-196 FIXED（T0788 `94ad2b83` / `610f592b`，待驗收）；開 BUG-197（OPEN，medium，T0788 發現 hook 回報亂序）；2026-11-02 18:24 — BUG-196 → FIXING（T0788，D227）；2026-11-02 18:20 — 開 BUG-196（OPEN，high，T0787 實測 Worker 通知替塔台作答）；2026-11-02 17:37 — BUG-195 CLOSED（`v0.7.3-pre.7` CI Test gate 綠）；2026-11-02 17:16 — BUG-195 FIXED（T0786 `8de128de` / `121df3e2`，範圍擴及 4 個測試檔，Q-1）；2026-11-02 16:57 — BUG-195 → FIXING（T0786，D225）；2026-11-02 15:29 — BUG-195 補記（一天 4 次，`frequent`）；修正 14:39 誤把 BUG-195 也寫進 VERIFY / WONTFIX 區段的佔位列；2026-11-02 14:39 — 開 BUG-195（OPEN，low，測試偶發逾時，第二次出現）；2026-11-02 11:11 — BUG-128 / 130 CLOSED（交付版 `v0.7.3-pre.5` 在 GitHub Actions macOS runner 實測 T0778）；2026-11-02 10:50 — BUG-193 / 194 CLOSED（交付版 `v0.7.3-pre.5` 安裝版自動化實測 T0777）；2026-11-02 09:59 — BUG-193 / 194 已隨 `v0.7.3-pre.5` 發版（待驗收）；2026-11-02 05:56 — BUG-194 FIXED（T0776 `e717c786`）；2026-11-02 05:38 — BUG-193 FIXED（T0774 `bd59ab0f`）；2026-11-02 05:28 — BUG-193 → FIXING（T0774，05:27 派工）、BUG-194 → FIXING（T0776，D217）；2026-11-02 05:26 — 開 BUG-194（OPEN，low，T0773 F1）；2026-11-02 05:26 — BUG-189 / 191 CLOSED（交付版 `v0.7.3-pre.4` 安裝版自動化實測 T0772，D215）；2026-11-02 05:24 — 開 BUG-193（OPEN，low，D216 → T0774）；2026-11-02 05:23 — BUG-190 / 192 CLOSED（交付版 `v0.7.3-pre.4` 安裝版自動化實測 T0771，含真實模型 Haiku 5.5，D215）；2026-11-02 05:22 — BUG-188 CLOSED（交付版 `v0.7.3-pre.4` 安裝版自動化實測 T0770，D215）；2026-11-02 04:59 — 第一百零四 session 塔台重啟（三）`*sync`：區段與 56 張 BUG 檔一致，只修正 frontmatter 統計（51 / 7 / 44 → 56 / 8 / 48）；2026-11-02 04:28 — BUG-192 FIXED（T0769 `9ab26222`）；BUG-192 → FIXING（T0769，D214）；BUG-191 FIXED（T0760 `eb5c0589`）；開 BUG-192（OPEN，T0768 研究）；BUG-190 FIXED（T0759 `b8a3b7f7`）；BUG-188 FIXED（T0757 `de8a4fd4`）；BUG-189 FIXED（T0758 `ddfb4f38`）；開 BUG-188–191 → FIXING（T0757–T0760，D209 / D210）；BUG-183 / 184 CLOSED（使用者實機，`v0.7.3-pre.3`）；BUG-187 CLOSED（`v0.7.3-pre.3`，使用者裁示）；BUG-186 CLOSED（WSL 實機，server `0.7.3-pre.3`）；BUG-187 FIXED（T0756 `915f90ab`）；開 BUG-187 → FIXING（T0756）；BUG-185 CLOSED（`v0.7.3-pre.2`）；BUG-186 FIXED（T0753 `0f021e67`）；BUG-185 FIXED（T0751 `f9072e16`）；開 BUG-186 → FIXING（T0753）；BUG-183 / 184 FIXED（T0750）；BUG-182 / 175 CLOSED

## 統計
- 🔴 Open: 0 | ⏳ Fixing: 0 | ✅ Fixed: 1 | 🧪 Verify: 0 | 🚫 Closed: 66 | ⛔ Won't Fix: 1 | **Total: 68**

## 🔴 Open / 處理中

| ID | 標題 | 嚴重度 | 建立時間 | 連結 |
|----|------|--------|---------|------|
| _（無）_ | | | | |

## ⏳ 修復中 (FIXING)

| ID | 標題 | 嚴重度 | 修復時間 | 連結 |
|----|------|--------|---------|------|
| _（無）_ | | | | |

## ✅ 已修復

| ID | 標題 | 嚴重度 | 修復時間 | 連結 |
|----|------|--------|---------|------|
| BUG-159 | codex 分頁在 BAT MCP 未注入、非系統管理員時接上 codex 共用 daemon，helper 讀到其他分頁的 `BAT_*`（T0651 `5b1be0f5`） | 🟢 low | 2026-10-18 | [BUG-159](BUG-159-codex-shared-daemon-inherits-other-tab-env.md) |

## 🧪 驗收中 (VERIFY)

| ID | 標題 | 嚴重度 | 驗證時間 | 連結 |
|----|------|--------|---------|------|
| _（無）_ | | | | |

## 🚫 已關閉 (CLOSED)

| ID | 標題 | 嚴重度 | 關閉時間 | 連結 |
|----|------|--------|---------|------|
| BUG-204 | Linux 打包版語音輸入無法載入：`whisper.node` 找不到同目錄的 `libwhisper.so.1`（T0800；交付版 `v0.7.4-pre.2` linux-acceptance `41578537967` 24.04 W1 PASS） | 🟡 medium | 2026-11-03 | [BUG-204](BUG-204-linux-whisper-addon-libwhisper-not-found.md) |
| BUG-202 | Ubuntu 24.04 預設設定下直接執行 AppImage 崩潰：AppArmor 擋 userns，`chrome-sandbox` 非 root 4755 → FATAL（T0799；交付版 `v0.7.4-pre.2` linux-acceptance `41578537967` 22.04 PASS / 24.04 WARN 自動降級） | 🔴 high | 2026-11-03 | [BUG-202](BUG-202-ubuntu-2404-appimage-sandbox-abort.md) |
| BUG-201 | `dev-deploy-headless.test.mjs` 的 `main()` 測試共用 `dist-server/dev-deploy-headless` 輸出目錄，兩個 `test:unit` 同時跑時互相覆蓋（T0794 發現；T0795 `6c2b6b93`；`v0.7.4-pre.1` CI Test gate 綠） | 🟢 low | 2026-11-03 | [BUG-201](BUG-201-dev-deploy-headless-test-shared-output-dir.md) |
| BUG-200 | `terminal-blocked-state.test.ts` 的兩支真 hook 程序順序測試在重負載下順序不顛倒而失敗；另 5 檔真子程序測試在兩個 `test:unit` 同時跑時逾時（T0793 發現；T0794 `2b3f0b1b`；`v0.7.4-pre.1` CI Test gate 綠） | 🟢 low | 2026-11-03 | [BUG-200](BUG-200-real-hook-order-tests-flaky-under-heavy-load.md) |
| BUG-199 | `nvm-login-profile.test.ts` 的真 bash 測試在整套 `test:unit` 負載下逾時 5 s（BUG-195 同類，第五支；T0793 `f03adbd6`；`v0.7.4-pre.1` CI Test gate 綠） | 🟢 low | 2026-11-03 | [BUG-199](BUG-199-nvm-login-profile-test-timeout-under-load.md) |
| BUG-196 | Worker 通知（`bat-notify --submit`、`--ask --submit`）的 Enter 替使用者回答塔台的權限對話框 / AskUserQuestion（T0788 `94ad2b83` / `610f592b`；交付版 `v0.7.3-pre.9` 使用者實機 T0796 ＋安裝版 e2e T0792） | 🔴 high | 2026-11-03 | [BUG-196](BUG-196-worker-notify-answers-blocked-tower-dialog.md) |
| BUG-198 | 上一回合的 `stop` hook 晚於下一回合的 `user-prompt-submit` 到達時，新回合被提早結束（T0791 `20bc7a88`；交付版 `v0.7.3-pre.9` 安裝版實測 T0792） | 🟢 low | 2026-11-02 | [BUG-198](BUG-198-late-stop-hook-ends-new-turn.md) |
| BUG-197 | claude 的 `user-prompt-submit` hook 回報晚到，清掉同一回合較早記下的 `permission` / `question` blocked（T0790 `77ad79ea`；交付版 `v0.7.3-pre.9` 安裝版實測 T0792） | 🟡 medium | 2026-11-02 | [BUG-197](BUG-197-late-user-prompt-submit-hook-clears-blocked.md) |
| BUG-130 | 終端分頁貼圖（Windows 間歇失效已加固 + log；mac Ctrl+V 送 `\x16`）；T0524；mac：`v0.7.3-pre.5` 在 GitHub Actions macOS runner 實測 T0778 | 🟡 Medium | 2026-11-02 | [BUG-130](BUG-130-terminal-image-paste-regression.md) |
| BUG-128 | mac：Finder 拷貝後終端 Command+V 貼不上；T0522 讀剪貼簿檔案路徑；`v0.7.3-pre.5` 在 GitHub Actions macOS runner 實測 T0778（Finder 真複製＋作業系統層按鍵） | 🟡 Medium | 2026-11-02 | [BUG-128](BUG-128-mac-cmd-v-finder-copy-no-paste.md) |
| BUG-195 | 真 git / 真子程序的單元測試在整套 `test:unit` 負載下逾時 5 s（4 檔；T0786 `8de128de` / `121df3e2`；`v0.7.3-pre.7` CI Test gate 綠 run `41419978047`） | 🟢 low | 2026-11-02 | [BUG-195](BUG-195-worktree-status-after-close-test-timeout-under-load.md) |
| BUG-194 | 自動開啟的對話框第一次按 Esc 關不掉，Esc 送進背景分頁；T0776 `e717c786` 開啟時聚焦遮罩、關閉時還原焦點；`v0.7.3-pre.5` 安裝版 T0777 實測 | 🟢 Low | 2026-11-02 | [BUG-194](BUG-194-auto-opened-dialog-esc-goes-to-xterm.md) |
| BUG-193 | 視窗沒有焦點時留下的淡化 ⚠️，點另一個分頁取回焦點時被清掉；T0774 `bd59ab0f` `createFocusRegainGate`；`v0.7.3-pre.5` 安裝版 T0777 實測（含作業系統真實點擊） | 🟢 Low | 2026-11-02 | [BUG-193](BUG-193-focus-regain-click-clears-missed-badge.md) |
| BUG-191 | 設 `CLAUDE_CODE_PLUGIN_CACHE_DIR` 時 BAT 找 plugins 的位置與 CLI 不同；T0760 `eb5c0589` `resolveClaudePluginsDir`；`v0.7.3-pre.4` 安裝版 T0772 實測 | 🟢 Low | 2026-11-02 | [BUG-191](BUG-191-claude-plugin-cache-dir-plugins-lookup.md) |
| BUG-189 | npm 安裝的 codex（`codex.cmd` shim）探測不到版本，`--no-daemon` 與派工 OSC 失效；T0758 `ddfb4f38` 讀 shim 追到原生 `codex.exe`；`v0.7.3-pre.4` 安裝版 T0772 實測 | 🟢 Low | 2026-11-02 | [BUG-189](BUG-189-npm-codex-shim-no-version-probe.md) |
| BUG-192 | Claude 面板背景子代理執行中送新訊息會中止整個 query；T0769 `9ab26222` 注入同一個 query＋排隊退路（D214）；`v0.7.3-pre.4` 安裝版 T0771 實測（真實模型走注入） | 🟡 Medium | 2026-11-02 | [BUG-192](BUG-192-claude-panel-new-message-kills-background-agent.md) |
| BUG-190 | Claude 面板背景子代理執行中不在 active task bar、結束沒標示；T0759 `b8a3b7f7`；`v0.7.3-pre.4` 安裝版 T0771 實測（含真實模型） | 🟢 Low | 2026-11-02 | [BUG-190](BUG-190-background-agent-not-in-active-task-bar.md) |
| BUG-188 | 用滑鼠回答後 ⚠️ 不清除，與鍵盤回答不一致（D209）；T0757 `de8a4fd4` 滑鼠左鍵按下清 hook reason；`v0.7.3-pre.4` 安裝版 T0770 實測 | 🟡 Medium | 2026-11-02 | [BUG-188](BUG-188-mouse-answer-does-not-clear-waiting-badge.md) |
| BUG-183 | 關掉（最小化到匣）的 profile 視窗，在「配置」按「開啟」叫不回來，只跳「此配置已在另一個視窗中開啟」；T0750 `8a432d40` 隱藏的視窗 show + focus、叫回時不通知（本機 profile 同樣受影響）；`v0.7.3-pre.3` 使用者實機驗收通過 | 🟡 Medium | 2026-11-02 | [BUG-183](BUG-183-hidden-profile-window-not-shown-on-open.md) |
| BUG-184 | 系統匣圖示選單殘留已刪除 profile 的視窗，同名項目出現兩個（成因是「配置」✕ 刪 profile 不關視窗）；T0750 `8a432d40` 刪 profile 時關掉它的視窗；`v0.7.3-pre.3` 使用者實機驗收通過 | 🟢 Low | 2026-11-02 | [BUG-184](BUG-184-tray-menu-lists-window-removed-from-profile.md) |
| BUG-187 | 遠端工具「安裝 / 更新 Node.js」以 nvm 裝 LTS（v26）時沒有先確保 `libatomic1`，最小安裝的 Linux 裝完 node 無法執行；T0756 `915f90ab` 缺程式庫時先補裝（不可提權則提示）、裝完驗證 `node --version`；隨 `v0.7.3-pre.3` 交付（Docker 三情境實測） | 🟡 Medium | 2026-11-02 | [BUG-187](BUG-187-node-install-recipe-missing-libatomic.md) |
| BUG-186 | 遠端工具偵測：nvm 的 Node.js「無回應」（實為缺 `libatomic.so.1` 無法執行）、`~/.local/bin` 工具「伺服器：不可見」；T0753 `0f021e67` 說明無法執行的原因、改標「伺服器程序：不可見（終端分頁找得到）」、git / gh 判斷比照 resolver；WSL 實機驗收通過（server `0.7.3-pre.3`） | 🟡 Medium | 2026-11-02 | [BUG-186](BUG-186-remote-tools-nvm-node-no-version-uv-hidden.md) |
| BUG-185 | e2e `t0512-profile-panel-layout` 第 2 項失敗：`WIZARD_STUBS` 缺 `wsl-systemd:snapshot-unit`；T0751 `f9072e16` 補 stub（另補 4 個 T0554 升級 / rollback channel），只影響測試；隨 `v0.7.3-pre.2` 交付 | 🟢 Low | 2026-11-01 | [BUG-185](BUG-185-t0512-wizard-e2e-missing-snapshot-unit-stub.md) |
| BUG-182 | 遠端 bat-server 重啟後，重連視窗裡分頁的等待 ⚠️ 不清除、總數多算；T0749 `01796a9e` 重連時依 server 現況對帳；`v0.7.3-pre.1` 使用者 WSL 實機驗收情境 A / B 通過 | 🟢 Low | 2026-11-01 | [BUG-182](BUG-182-remote-server-restart-stale-waiting-badge.md) |
| BUG-175 | 縮圖預覽在輸出沒有換行時不更新、露出 `>0q>4m` 殘骸；T0714 `afe57761` 依游標換列分行 + 完整 CSI（`v0.7.2-pre.3`）；外部測試者A macOS 實機確認正常（GitHub #22 已關閉） | 🟡 Medium | 2026-11-01 | [BUG-175](BUG-175-thumbnail-preview-stuck-without-newline.md) |
| BUG-180 | 剛開的終端分頁被切走時 PTY 被 resize 成 9x5；T0741 `canFitTerminalContainer`（`4500984d`）；使用者 `v0.7.2-pre.9` 安裝版實機驗收通過 | 🟢 Low | 2026-11-01 | [BUG-180](BUG-180-new-tab-switched-away-pty-resized-9x5.md) |
| BUG-181 | Claude 面板 Cache History 把 CLI 的 session 累計 `modelUsage` / `total_cost_usd` 當單一回合；T0744 `0d42ebdc` 依 model 相減、resume 首列 `R*`；T0746 真實模型複驗 PASS（`9e37c226`） | 🟡 Medium | 2026-11-01 | [BUG-181](BUG-181-cache-history-sums-cumulative-model-usage.md) |
| BUG-156 | Docker 設定精靈容器埠固定 `127.0.0.1:9876`，與 BAT RemoteServer 預設埠衝突（T0649 `99abe9a1`） | 🟡 medium | 2026-11-01 | [BUG-156](BUG-156-docker-wizard-port-9876-conflicts-bat-server.md) |
| BUG-111 | 設定精靈 rollback 會刪 / 停使用者自己的 Docker 容器與資料（T0444） | 🔴 high | 2026-11-01 | [BUG-111](BUG-111-wizard-rollback-touches-user-owned-resources.md) |
| BUG-108 | Claude 面板圖片附件走 proxied 讀檔：本機工作區外圖片被 path guard 擋、遠端讀錯檔案系統（T0436） | 🟡 medium | 2026-11-01 | [BUG-108](BUG-108-image-attachment-read-path-denied.md) |
| BUG-107 | Electron 41 拖放檔案取不到路徑（`File.path` 已移除）（T0435；須與 T0437 同版） | 🟡 medium | 2026-11-01 | [BUG-107](BUG-107-drag-drop-file-path-missing-electron41.md) |
| BUG-097 | Docker 遠端埠全介面暴露、container 內 bind 不可達、HEALTHCHECK 無路由（T0418 / T0427 / T0428） | 🔴 high | 2026-11-01 | [BUG-097](BUG-097-docker-server-port-exposed-and-unreachable.md) |
| BUG-105 | 遠端路徑轉換只涵蓋 fs / git(7) / pty / image：claude:*（cwd）、github:*、git-scaffold:*、worktree:create 不轉 | 🔴 high | 2026-11-01 | [BUG-105](BUG-105-proxied-channels-missing-path-translation.md) |
| BUG-135 | focus fallback 跨工作區（adopt / 刪除 / 封存工作區、外部終端、reload；T0532 `8b5251a8`，含新工作區空狀態不閃） | 🟢 low | 2026-11-01 | [BUG-135](BUG-135-adopt-detached-focus-crosses-workspace.md) |
| BUG-171 | 「終端重置」後多個分頁 `[Process exited with code 1]`：NTP 時鐘跳變讓 heartbeat 誤判、recovery 沒關舊 server；T0704 `68ab2a42` + T0705 `d7ffa080`，待下一個預覽版實機驗收 | 🔴 high | 2026-11-01 | [BUG-171](BUG-171-idle-terminals-exit-1-after-terminal-reset.md) |
| BUG-147 | Recovery「重新開始」時舊 Terminal Server 刪掉新 server 的 pid / port 檔 | 🟢 low | 2026-11-01 | [BUG-147](BUG-147-recovery-fresh-start-pid-file-race.md) |
| BUG-146 | BAT 重開且 Terminal Server 存活時，Recovery 提示回答前還原分頁另起 direct shell | 🟡 medium | 2026-11-01 | [BUG-146](BUG-146-recovery-prompt-pending-spawns-direct-shell.md) |
| BUG-137 | 程序已結束的分頁按 ⏻ 重啟沒有任何反應（T0539 `2ff55bdd`：restart 失敗改以同 id 重建；T0534 衍生） | 🟢 low | 2026-11-01 | [BUG-137](BUG-137-restart-button-no-op-on-exited-terminal.md) |
| BUG-134 | 空工作區透出隱藏工作區的終端畫面，無法操作（外部測試者B；T0531 `d41280ae`：隱藏工作區 active 分頁真正隱藏 + 空狀態 + focus 不跨工作區） | 🟡 medium | 2026-11-01 | [BUG-134](BUG-134-empty-workspace-shows-other-terminal.md) |
| BUG-133 | detached 視窗「開啟設定」無反應（T0530 `5bacb583`：改由父主視窗開 Settings） | 🟢 low | 2026-11-01 | [BUG-133](BUG-133-detached-window-open-settings-noop.md) |
| BUG-132 | agent CLI 沿用別的分頁的 `BAT_*` → 派工落點 / 完成通知送錯塔台（T0527 `a371ce5`：cwd 一致性檢查、yolo 拒派、`--agent` 簡寫；遠端與 PID 鏈根治未做） | 🟡 medium | 2026-11-01 | [BUG-132](BUG-132-agent-cli-stale-bat-env-misroutes-dispatch.md) |
| BUG-131 | 本機 PTY 重建路徑掉 env（heartbeat 復原 / restart customEnv） | 🟡 medium | 2026-11-01 | [BUG-131](BUG-131-pty-rebuild-drops-env.md) |
| BUG-129 | 塔台派工落到錯的工作區 / `--agent default` 解析錯（外部測試者A） | 🟡 medium | 2026-11-01 | [BUG-129](BUG-129-tower-dispatch-lands-in-wrong-workspace.md) |
| BUG-127 | 指揮塔面板切換工作區時 toast 洪水（「殘影」） | 🟢 low | 2026-11-01 | [BUG-127](BUG-127-ct-panel-toast-flood-on-workspace-switch.md) |
| BUG-118 | 非 Windows 打包版（mac 兩 arch、Linux AppImage）缺 `claude-code/bin/claude.exe`（electron-builder 非 Windows 排除 `.exe`）→ 內嵌 claude 不可用 | 🔴 high | 2026-11-01 | [BUG-118](BUG-118-non-windows-package-missing-embedded-claude.md) |
| BUG-116 | macOS 0.6.0-pre.2 啟動即崩潰：main 載入 whisper addon 找不到 `darwin-arm64/whisper.node` → uncaught exception | 🔴 high | 2026-11-01 | [BUG-116](BUG-116-mac-arm64-whisper-addon-load-failure-crashes-main.md) |
| BUG-179 | `bat-scripts.log` 無上限成長；T0732 啟動時 > 10 MiB 輪替、保留 3 份（本機主行程與 headless，`ce648034`），待實機驗收 | 🟢 Low | 2026-11-01 | [BUG-179](BUG-179-bat-scripts-log-unbounded-growth.md) |
| BUG-178 | Claude 面板讀 session 歷史 / session 清單 / plugins 不理 `CLAUDE_CONFIG_DIR`；T0730 抽成 `electron/claude-config-dir.ts` 統一解析（`6f7b3d53`） | 🟢 Low | 2026-11-01 | [BUG-178](BUG-178-claude-history-ignores-claude-config-dir.md) |
| BUG-177 | Claude 面板查模型清單會送一次真的模型請求並留下 session 檔；T0729 改用不 yield 的 AsyncIterable prompt，0 請求 / 0 session 檔（`ceb24910`） | 🟡 Medium | 2026-11-01 | [BUG-177](BUG-177-supported-models-probe-sends-model-request.md) |
| BUG-170 | yolo 提問備援重派後舊 Worker 分頁讓回收 AMBIGUOUS；CT v5.12.0 / v5.12.1 重派前先 `--close-worker`（CT-T022），T0695 / T0696 實機驗收通過 | 🟢 low | 2026-11-01 | [BUG-170](BUG-170-yolo-fallback-redispatch-leaves-old-worker-tab.md) |
| BUG-168 | `tests/` 底下沒被跑到的測試失敗與逾時（全部測試過時）；T0680–T0685 修正並收進 vitest／`test:legacy`，ubuntu 試跑 5760 / 0 + 472 / 0；擋版 T0686 | 🟢 low | 2026-11-01 | [BUG-168](BUG-168-tests-dir-tsx-suites-failing-and-timing-out.md) |
| BUG-167 | `tests/profile-manager-migration.test.ts` 2 項斷言過時（T0277 / T0282 加的 `dockerMounts`、`serverHome` 沒跟上；T0678 `d90b3b50`，13 / 0） | 🟢 low | 2026-11-01 | [BUG-167](BUG-167-profile-manager-migration-test-stale-assertions.md) |
| BUG-176 | Agent SDK 0.3 升版後 ajv / ajv-formats 掉出 production 相依樹（T0719 `59ef7f37`；pre.5 / pre.6 CI 三平台打包驗證通過） | 🔴 High | 2026-11-01 | [BUG-176](BUG-176-sdk03-ajv-dropped-from-packaged-app.md) |
| BUG-174 | 終端 `file:///` 連結：全形字範圍、跨行、OSC 8（GitHub #20；T0713 `ff772d40`；T0728 e2e 驗收） | 🟡 Medium | 2026-11-01 | [BUG-174](BUG-174-terminal-file-link-cjk-range-wrap-osc8.md) |
| BUG-169 | 安裝版的 helper 回報版號 v0.0.0（T0691 `b0ff5673`；`v0.7.2-pre.6` Windows 安裝版三個 helper `--version` 實測正確） | 🟢 Low | 2026-11-01 | [BUG-169](BUG-169-installed-helpers-report-version-0.0.0.md) |
| BUG-165 | macOS：Codex CLI 分頁內捲動不夠順（T0698 `ec4b3c13` 依累積行數送多個滾輪回報；外部測試者A 以 macOS 實機確認） | 🟢 low | 2026-10-30 | [BUG-165](BUG-165-macos-codex-cli-scroll-not-smooth.md) |
| BUG-166 | Agent 被訊號結束後的分頁，滑鼠回報被當成文字輸入 shell（T0672 `64209d44` 自動 / 手動重設滑鼠追蹤；外部測試者A 以 macOS 實機確認） | 🟡 medium | 2026-10-30 | [BUG-166](BUG-166-mouse-reports-leak-as-text-after-agent-exit.md) |
| BUG-172 | 指揮塔面板：檔案超過 512 KiB 時臭蟲／待辦／決策三頁靜默變空、工單從清單消失（只有總覽報 File too large）（T0708 `50fe08d3`；使用者以 v0.7.1-pre.9 實機驗收通過） | 🟡 medium | 2026-10-30 | [BUG-172](BUG-172-ct-panel-file-too-large-silent-empty.md) |
| BUG-173 | 指揮塔面板：索引文字與 PLAN 檔補優先級時 `critical` 判成 Unknown（frontmatter 路徑算 High）（T0709 `809eab0d`；使用者以 v0.7.1-pre.9 實機驗收通過） | 🟢 low | 2026-10-30 | [BUG-173](BUG-173-ct-priority-critical-text-path-unknown.md) |
| BUG-164 | macOS GPU 程序在建立 / 切換終端分頁時以同一個 CHECK 崩潰（T0668 符號化；T0669 `32d62a45` macOS 停用 Graphite + 崩潰後重建；外部測試者A 以 v0.7.1-pre.3 確認約 4h40m 0 次崩潰） | 🟢 low | 2026-10-19 | [BUG-164](BUG-164-macos-gpu-process-check-crash-on-tab-create-switch.md) |
| BUG-136 | macOS 舊 Codex 分頁打字嚴重延遲、Renderer 約 100% CPU：縮圖預覽字串無上限累積（T0666 根因、T0667 `a9f0ad5a` 加上限；外部測試者A 以 v0.7.1-pre.3 確認） | 🟡 medium | 2026-10-19 | [BUG-136](BUG-136-macos-old-terminal-typing-lag-renderer-cpu.md) |
| BUG-158 | 遠端設定畫面殘留英文字樣、缺 zh-TW key；SSH 認證失敗訊息提到「帳號密碼」（T0652 `15a792d4`；0.7.1-pre.2 T0663 實機） | 🟢 low | 2026-10-18 | [BUG-158](BUG-158-remote-ui-english-strings-and-password-wording.md) |
| BUG-142 | claude CLI 分頁右鍵已貼上又跳 BAT 選單（T0568 `9988a117`：程式開滑鼠追蹤時不開選單，Shift + 右鍵照開；pre.7 實機 PASS，Shift 選單缺「複製」另開 BUG-144） | 🟢 low | 2026-10-16 | [BUG-142](BUG-142-right-click-pastes-and-shows-menu-in-claude-tab.md) |
| BUG-099 | 設定精靈取消時不 rollback 失敗中的步驟（T0426） | 🟢 low | 2026-10-14 | [BUG-099](BUG-099-wizard-cancel-skips-failed-step-rollback.md) |
| BUG-117 | mac x64 dmg 內嵌 arm64 原生 binary（已證實：claude / codex / node-pty / whisper 等）→ Intel Mac 內嵌 claude、codex、語音不可用、PTY 降級 | 🔴 high | 2026-10-14 | [BUG-117](BUG-117-mac-x64-dmg-ships-arm64-native-binaries.md) |
| BUG-061 | `CodexAgentPanel.tsx` baseline tsc errors（dev-only；T0486 清零 36 → 0） | 🟢 low | 2026-10-14 | [BUG-061](BUG-061-codex-agent-panel-tsc-baseline-errors.md) |

> 💡 BUG-079/080 已於 2026-05-19 歸檔；BUG-081 於 2026-09-02 歸檔；2026-10-17 第七十一 session 歸檔 40 張（BUG-071–126 中已 CLOSED、未被引用者）；2026-10-26 第九十五 session 歸檔 21 張（BUG-082、138–163 中已 CLOSED、未被引用者）→ [_archive/bugs/](_archive/bugs/)
>
> ⚠️ BUG-072/073/074 以 **field evidence** 就地結案（上線 101 天零回饋），**非人工 smoke**；
> BUG-078 則有 CI 正面證據。結案依據差異見各 BUG 文末結案紀錄。

## ⛔ 不修復 (WONTFIX)

| ID | 標題 | 嚴重度 | 標記時間 | 連結 |
|----|------|--------|---------|------|
| BUG-203 | Ubuntu 22.04 上語音輸入無法載入：whisper `libggml-*.so` 需要 `GLIBC_2.38`（T0800 實測成立；列為已知限制，D246） | 🟢 low | 2026-11-03 | [BUG-203](BUG-203-ubuntu-2204-whisper-glibc-238.md) |
