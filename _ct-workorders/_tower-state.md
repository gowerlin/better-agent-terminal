---
schema_kind: tower-state
summary_version: 1
updated_at: "2026-11-04T01:09:22+08:00"
session: "2026-11-04 00:39 第一百一十四 session 開工（CT v6.0.0-beta.11）"
next_ids:
  workorder: "T0820"
  decision: "D264"
  bug: "BUG-210"
  plan: "PLAN-063"
todo:
  - "MSRC 回報 microsoft/node-pty（使用者自行處理，D255）"
  - "PLAN-058：T0814（W1）`fc22e04a`＋T0815（W0）`0b67db03` DONE，T0819 安裝版 pre.5 假 API e2e PASS，待使用者手動確認（清單在 T0819 回報區）；可選後續：卡片等待時讓輸入框可送出（T0815〈遭遇問題〉1，未開單）"
  - "觀察：語音可用性檢查 macOS 未實機；`unknown(timeout)` 若實機出現可把逾時提到 30 s（T0802 後續建議）"
  - "PLAN-059：A 完成（BUG-196 CLOSED）；B = PLAN-061 DONE（T0818 交付版驗收 PASS）；C 不做（Q5，CT D568）；Q4 未解"
  - "PLAN-060（IDEA）：macOS Developer ID 簽章（目前 macOS 不顯示系統通知）"
  - "觀察：t0757 偶發失敗再發生才開 BUG（D218）"
  - "版號線：`0.7.4-pre.N`，已發 pre.1 / pre.2 / pre.3 / pre.4 / pre.5（D236 / D241 / D248 / D256 / D262）"
---
# Tower State — better-agent-terminal

> 🟢 **第一百一十四 session 開工**（2026-11-04 00:39 (UTC+8)，CT v6.0.0-beta.11，Fast Path；塔台 session `37094caf-4e4a-4ad0-9945-f58f7c199ead`；`--set-role tower --mode on` exit 0；`bat_whoami` 名稱 `better-agent-terminal · Tower`；安裝版 FileVersion `0.7.4-pre.5`；HEAD `b025e97f`、`main` 領先 `origin/main` 1（`b025e97f` 記帳 commit 未推）、工作區乾淨；熱區 213 張工單無非終態；BUG Fixed 1（209）/ Closed 71 / WONTFIX 1；PLAN IN_PROGRESS 3（058 / 061 / 062）；`bat_list_questions` pending 0；熱檔皆 ≤ 400 KB）。**`v0.7.4-pre.5` NSIS 完整重裝驗收 PASS-WITH-WARN**（real 模式 00:36:40–00:37:18；AllUsers / HKLM；唯一 WARN = ⓪ 目前安裝版 pre.4，② 實為升級，屬預期；① SHA-256 `0e97d362…` ② ③ ④ 全 PASS，三支 helper `--version` = v0.7.4-pre.5、內嵌 claude / codex 存在、userData 130 檔 SHA-256 未變；⑤ SKIPPED）；報告 `%TEMP%\bat-nsis-acceptance-20261104-003640\report.md`；含權杖的 `userdata-backup` 已刪除。使用者「依建議順序推進」→ linux-acceptance `41676550640`（`-f version=0.7.4-pre.5`，`main` @ `5b6265cf`，含 t0816 spec）進行中；去識別化 9 組 0、金鑰 1 筆為 T0811 測試假值（已公開的測試檔內）→ push `5b6265cf..f453fb2c`；`docs/agent-guide/README.md` 索引補 Terminal Server 的 fork（T0816）→ `09d36fec`（未推）。使用者問 PLAN-061 / 058 → 兩題選推薦 → **D263** → 開 **T0818**（PLAN-061 交付版驗收：WSL＋pre.5 AppImage＋真 claude＋假 API，權限對話框 `blocked`）、**T0819**（PLAN-058 交付版驗收：`BAT_E2E_EXECUTABLE` 對安裝版跑假 API 面板 e2e，之後交使用者手動確認）（`29944e22`）。00:50 並行派 **T0818**（yolo `--no-interactive`，exit 0，`started: 16:50:20Z`；分頁 `5f20e366…`）、**T0819**（同上，`started: 16:50:21Z`；分頁 `d76d2ecf…`）。**T0819 DONE**（00:53；`b3471939` 只改工單：安裝版 `0.7.4-pre.5`（fixture 日誌每次啟動皆 `executable=C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe`）跑假 API e2e：pre6 2 passed（①–⑫、⑥b、⑦b–⑦f 全 PASS：⑦d 回合中送第 2 則同一段對話依序回答、只送一次；⑦e 取消；⑦f Esc 取消待送）、pre7 2 passed（A1–A3 / B1–B5）；主實例 PID 前後相同、隔離 runtime 清乾淨；附使用者手動確認清單 5 步）；session id 已在；session 快照已寫；`--close-worker T0819` exit 0。PLAN-058 待使用者依清單手動確認後結案。linux-acceptance `41676550640` 22.04 / 24.04 success：t0816 K1–K5、t0806 F1–F6、t0807 G1–G3 全 PASS（24.04 L1 WARN = BUG-202 降級；22.04 W1 INFO = BUG-203）→ **BUG-209 CLOSED**、**PLAN-062 DONE**（00:56）；tracker Fixed 0 / Closed 72、backlog IN_PROGRESS 2 / DONE 16；以 BAT parser 解析實檔與統計一致（PLAN 的 Dropped 列本來就不列，HEAD 同樣）、parser 單元 27 / 27。**T0818 DONE**（01:07；`300461a6` 只改工單：WSL Ubuntu 24.04、pre.5 AppImage SHA-256 `c3d51f45…` 一致、內嵌 claude 2.1.316、本機假 API＋blocking proxy（0 外連、花費 0）；hooks 關閉的分頁 `none` → `osc`／`agentStarted`；真 claude 權限對話框 → `blocked` / `input` / `osc`（附畫面與主行程日誌）；選 Yes 後由 claude 的 OSC `working` 清除、回到 `idle`；對照組 hook 分頁維持 `hook` / `permission`；第 1 輪驅動程式比對式錯誤未送回答、第 2 輪完成；AppImage 版 Playwright `app.close()` 不返回＝PLAN-062 已記錄限制；WSL 使用者目錄前後快照相同）；session id 已在；session 快照已寫；`--close-worker T0818` exit 0 → **PLAN-061 DONE**；backlog IN_PROGRESS 1（058）/ DONE 17。

> 🟢 **第一百一十三 session 開工**（2026-11-03 20:39 (UTC+8)，CT v6.0.0-beta.11，Fast Path；塔台 session `b9922a8c-896d-4271-9043-2f56e3788c8f`；`--set-role tower --mode on` exit 0；`bat_whoami` 名稱 `better-agent-terminal · Tower`；安裝版 FileVersion `0.7.4-pre.4`；HEAD `464879aa`、`main` = `origin/main`（fetch 後 0 / 0）、工作區乾淨；`bat_list_questions` pending 0）。**`v0.7.4-pre.4` NSIS 完整重裝驗收 PASS-WITH-WARN**（real 模式 20:35:30–20:36:31；AllUsers / HKLM；唯一 WARN = ⓪ 目前安裝版 pre.3，② 實為升級，屬預期；① SHA-256 `c85e6820…` ② ③ ④ 全 PASS，三支 helper `--version` = v0.7.4-pre.4、內嵌 claude / codex 存在、userData 130 檔 SHA-256 未變；⑤ SKIPPED）；報告 `%TEMP%\bat-nsis-acceptance-20261103-203530\report.md`；含權杖的 `userdata-backup` 已刪除。linux-acceptance `41636533467`（`-f version=0.7.4-pre.4`）：**24.04 failure** —— t0797 L1 WARN（BUG-202 自動降級，預期）/ W1 / V1 / L2 PASS；**t0806 F1–F6 全 PASS（交付版 AppImage，BUG-205）**；t0807 G1 PASS（`[child-fd-guard] installed (/bin/bash)`），G2 在「reference exec'd」逾時 `e2e/linux/t0807-child-process-fds.spec.ts:168`，G2 / G3 未判定（初判測試缺陷：對照組直接 exec AppImage，cmdline[0] 不會等於 AppImage 路徑；T0807 當時以 `--linux dir` 驗證）。**22.04 failure**（verdict PASS：L1 PASS、W1 INFO = BUG-203、V1 / L2 PASS；t0806 F1–F6 全 PASS；t0807 同一行逾時）→ **BUG-205 CLOSED**（20:41，交付版兩個 OS F1–F6 PASS）；tracker 只動該列與統計（Fixed 2 / Closed 69），parser 12 / 12。BUG-206 / 207 仍 FIXED，待 t0807 spec 修正後重跑。使用者選「開工單修 spec」→ **D257** → 開 **T0810**（只改 t0807 spec 使 G2 對照組相容 AppImage、判準不放寬；授權 push `ct/T0810` 以 `--ref ct/T0810 -f version=0.7.4-pre.4` 在 CI 驗證）（`b185b606`）。20:44 派 **T0810**（yolo `--no-interactive`，exit 0，`started: 12:44:23Z`；分頁 `0c5125da…`）。**T0810 DONE**（20:53；`77fde527`：G2 對照組改 exec 主行程 `process.execPath`（AppImage 時 = `/tmp/.mount_*/BetterAgentTerminal.bin`，`--linux dir` 時 = 執行檔本身），等待條件同步改、逾時附 argv；G2 / G3 判準未改；docs 一句；塔台初判成立；linux-acceptance `41638443940`（`--ref ct/T0810 -f version=0.7.4-pre.4`）兩個 OS success：t0797 / t0806 F1–F6 / t0807 G1–G3 全 PASS（24.04 L1 WARN = BUG-202 降級）；G2：spawn / execFile 子程序 fd ≥ 3 可繼承 0、execPathNode 只有自己的 3 個＋`CRASHDUMP_SIGNAL_FD`、無 `/dev/ptmx`；G3：主行程 53 個可繼承 fd（反向對照）；遠端 `ct/T0810` 已刪；未本機試跑）；session id 已在 `session_ids`；session 快照已寫；`--close-worker T0810` exit 0 → `git merge --no-ff ct/T0810` → `19ac59c3`（main 自 base 只多 `_ct-workorders/**`），本機 `ct/T0810` `-d` 刪除 → **BUG-206 / 207 CLOSED**（20:55；BUG-206 依據註明：CI 為 Terminal Server 模式的 Electron 主行程、direct 共用同一 guard，headless bat-server 只有 T0807 WSL 冒煙，交付版 server bundle 未另跑）；tracker Fixed 0 / Closed 71，parser 12 / 12。熱區 BUG：Open 0 / Fixed 0 / Closed 71 / WONTFIX 1。使用者「push」→ 去識別化 9 組 0（追蹤檔＋推送範圍的 commit 訊息與新增行）、金鑰 0 → push `464879aa..730df48f`（無觸發的 workflow run）。使用者「開始 PLAN-061, 062, 058」→ 三題選推薦 → **D258** → 開 **T0811**（PLAN-061 實作：照 D229 / T0789 草案）、**T0812**（PLAN-062 研究）、**T0813**（PLAN-058 研究：設計＋原型）；三個 PLAN → IN_PROGRESS，`_backlog.md` 只動三列與統計，parser 15 / 15（`22360c65`）。21:14 並行派 **T0811**（yolo `--no-interactive`，exit 0，`started: 13:14:30Z`；分頁 `f98429ac…`）、**T0812**（同上，`started: 13:14:32Z`；分頁 `cea8966b…`）、**T0813**（同上，`started: 13:14:34Z`；分頁 `5f224a18…`）。**T0813 DONE**（21:30；`72fc325c`，只改工單：方案 B（常駐 query＋inbox）可行——主回合中送出由 CLI 排隊、`interrupt()` 只停回合、`setModel` / `applyFlagSettings({ effortLevel })` / `setPermissionMode` 下一回合生效、kill 後 22 ms 偵測＋resume 0.4 s 接回，但每面板閒置約 215 MB＋conhost；新發現方案 D：現行字串 prompt query 在主回合中 `streamInput` 也排隊（6/6），以 `command_lifecycle` 回執判斷送達、6 次無無聲遺失；`cancelAsyncMessage` 可取消排隊（不在 d.ts）；`resetQueryUsage` 須改在 `started`；建議 W0（D）＋W1，B 延後附觸發條件；真實模型 Haiku 5.5 共 6 輪 US$0.0084；假 API 0 外連）；session id 已在；session 快照已寫；`--close-worker T0813` exit 0。使用者四題選推薦 → **D259**（主回合中送出改排隊、改變 D214 P-2；Esc 一併取消待送；提問卡等待時排隊＋提示；先 W1 再 W0，B 延後）→ 開 **T0814**（W1）、**T0815**（W0，depends_on T0814＋T0811）（`db451023`）。21:33 派 **T0814**（yolo `--no-interactive`，exit 0，`started: 13:33:22Z`；分頁 `127731ca…`）。**T0811 DONE**（21:35；`f274847c` 9 檔：解析器白名單 `codex` / `claude-code`、上限 4096、`id=` 子紀錄不影響分頁、`scan` 回傳探詢數；`PtyManager.enqueuePtyOutput` → `replyToProgramStatusProbes` 以 `PtyManager.write` 回覆固定 `ESC]7501;?BEL`（不經 `pty:write` handler：不算使用者輸入、不進 notify-hold、不受派工保留），`hostPlatform` dep 判 win32 不寫，replay / child_process 後援不回；tracker 沿用 `observeCodexState`；突變 5 種皆有測試失敗；typecheck 0 / 0、unit 398 檔 / 6975、legacy 472 / 33、vite build；codex `t0621` e2e PASS；WSL 實機以 tsx 載入 repo `pty-manager.ts`：假程式 19 項全過、真 claude 2.1.316（隔離 HOME、`disableAllHooks`、假 API、不送按鍵）回覆後 `none` → `osc` / `agentStarted`，win32 對照 0 狀態；真 claude 權限對話框 `blocked` 未實測；副作用：非 Windows 的 hook 分頁 claude 也收到回覆、不再用 OSC 0 忙碌動畫（BAT 不讀）；docs blocked-state / worker-launch-confirmation、CLAUDE.md 一條（99,383 bytes））；塔台複跑三個測試檔 90 / 90；session id 已在；session 快照已寫；`--close-worker T0811` exit 0；PLAN-061 維持 IN_PROGRESS 待交付版驗收。**T0814 DONE**（21:45；`fc22e04a` 10 檔：① `sdkSpawnEnv(runtime, { electronRunAsNode })` 只進 spawn env、不寫全域（`forkSession` 一併帶，使用者原有全域值不再被刪）② `disposeSession`＋`claude:dispose-session`（PROXIED / PATH_FREE；codex 分頁仍 `stopSession`），`closeTerminalNow` 改呼叫、舊 host reject → `stopSession`，⏻ 不變 ③ `runQuery` finally 以 generator 守衛清 `queryInstance`；偏差（接受）：`accountInfo` / `supportedCommands` / `supportedAgents` 是 SDK init 快取讀取，為免 AgentsPanel 回歸改存 `lastQueryInit` ④ `command_lifecycle` → `[claude:lifecycle]` debug 摘要；突變 11 種皆被抓；typecheck 0 / 0、unit 399 檔 / 6999、legacy 472 / 33、vite build、e2e pre6＋pre7 4 passed；docs 一節；CLAUDE.md 條目建議交塔台）；session id 已在；session 快照已寫；`--close-worker T0814` exit 0。T0814 建議的 CLAUDE.md 條目併入 T0815 範圍（同一工單改 CLAUDE.md，避免兩邊同檔）（`1be17d15`）。21:49 派 **T0815**（yolo `--no-interactive`，exit 0，`started: 13:49:03Z`；分頁 `e8801231…`）。**T0812 DONE**（22:15；`6c38522b`，只改工單：pre.4 三情境重現、與 pre.3 相同；成因 = Electron `lib/node/init.ts` 對 `ELECTRON_RUN_AS_NODE` fork 自動加 crashpad env＋fd，server 繼承無 CLOEXEC 的 fd 成為 client，crashpad handler 持有主行程 fd 1 / 2；A0（只去 env）無效、A1（關 crashpad fd）解 `out=$(…)` / `| tee` 但 Playwright 仍卡、**A3** 只留 IPC＋keepalive fd 4：`out=$(…)` 908 ms、解開版 Playwright 27 ms、mount 留著；dump 實測 server / node 模式子程序本來就不產生（renderer / 主行程有）；T0704 recovery 8 輪、T0578 Recovery 還原正常；B（crashpad 不持有 stdio）需原生模組不可行；Windows 實測同現象但持有者是 server 本身（std handle 繼承，需原生碼，建議不修）；macOS 推論只擷取 stderr 時卡；既有問題 5(b)：一般啟動 keepalive fd 3 被 IPC 蓋掉 → mount 卸載、server exe `ENOTCONN`；WSL / Windows 環境還原 PASS）；session id 已在；session 快照已寫；`--close-worker T0812` exit 0。使用者三題選推薦 → **D260** → 開 **BUG-209**（medium，FIXING）、**T0816**（A3＋BUG-209，`isolation: worktree`、授權 push `ct/T0816` 跑 desktop-build＋linux-acceptance）；tracker 只加 FIXING 一列與統計，parser 12 / 12（`685bb3d7`）。22:20 派 **T0816**（yolo `--no-interactive --isolation worktree`，exit 0，`started: 14:20:48Z`；分頁 `ac0a4e1b…`；worktree `../.bat-worktrees/better-agent-terminal/T0816`、分支 `ct/T0816`、base `685bb3d7`）。**T0815 DONE**（22:24；`0b67db03` 13 檔：`sendMessage` query 進行中 → `sendIntoRunningQuery`（`streamInput`＋uuid），`pendingSends` 依 `command_lifecycle` 追蹤，`msg_lifecycle_v1` 時 2 s 無 `queued` 回執 / reject → fallback（query 開著進 `messageQueue`、結束後 resume；晚到回執去重，只送一次）；沒有該 capability 的舊 CLI 維持 T0769 / D214 P-2；`resetQueryUsage` 在 `started`（折入不重設）；`claude:result` 加 `pendingTurns`、renderer 據此維持執行中；`cancelSdkQueuedMessage` 唯一呼叫 `cancelAsyncMessage`＋SDK 升版守門；Esc 先取消再 interrupt、`still_queued` 再取消；卡片等待提示；單元 28＋改寫 2 檔、突變 13 / 13；假 API e2e ⑦d / ⑦e / ⑦f / ⑥b 與 ①–⑫ PASS；真實模型 Haiku 5.5 兩次共 8 輪 US$0.0218（R 列與 `total_cost_usd` 相符）；typecheck 0 / 0、unit 400 檔 / 7031、legacy 472 / 33、vite build、pre7 / t0744 / t0742 e2e PASS；CLAUDE.md 含 T0814 條目；已知：卡片等待時輸入框本來就隱藏，D259 ④ 實際為「先排隊、後出卡片」，可選後續另開單；Esc 後 `ede_diagnostic` 錯誤為 T0768 既有行為）；session id 已在；session 快照已寫；`--close-worker T0815` exit 0；PLAN-058 維持 IN_PROGRESS 待交付版驗收。**T0816 DONE**（2026-11-04 00:01；`ct/T0816`：`24eb000c` 產品（`forkTerminalServer` 收兩個 fork 點、`runWithoutCrashpadClient` 範圍旗標去掉兩個 crashpad env、`findAppImageKeepaliveFd` / `planTerminalServerFork`：Linux 有 keepalive → stdio 5 格 fd 4、沒有 → 4 格，非 Linux 不變不查）＋4 個 e2e spec commit（`a62b1c50` / `b62e822d` / `f53c420e` / `69093e41`，含 t0806 / t0807 既有取樣競態穩定化），head `69093e41`、`validated_sha` `24eb000c`；突變 10 / 10；typecheck 0 / 0、unit 400 檔 / 7013、legacy、vite build；desktop-build `41655736852`；linux-acceptance 四輪，最後 `41667030155` 22.04 / 24.04 success：K1（保留 server 離開後主行程 stdout 無其他持有者、`out=$(…)` 返回）、K2（server fd 0–3＋4、無 crashpad env / socket）、K3（一般啟動 mount 仍在、exe 後段可讀 → BUG-209）、K4（Recovery 還原）、K5（renderer dump）、F1–F6、G1–G3 全 PASS；遠端 `ct/T0816` 已刪；CLAUDE.md 只改 Linux child_process 節）；session id 已在；session 快照已寫（`--project` worktree）；`--close-worker T0816 --worktree keep` exit 0。直接合併判準第 1 條（main 多了 T0815 產品 `0b67db03`）與第 2 條（`validated_sha` ≠ head，只差 e2e）不成立；`merge-tree` 無衝突（`CLAUDE.md` 兩邊不同小節）→ 開 **T0817**（模式 ②，`base_main_sha` `04058080`，整合 worktree 乾淨）（`6bdf76f9`）。00:06 派 **T0817**（yolo `--no-interactive`，exit 0，`started: 16:06:00Z`；分頁 `46dc6b3b…`）。**T0817 DONE**（00:09；整合 worktree `ct-merge/T0816` 自 `04058080` `--no-ff` → `84ebb7af`（parent2 `69093e41`），無衝突、`CLAUDE.md` 兩邊都在（72,079 字元）、範圍外 0；merge commit 上 typecheck 0 / 0、vite build、unit 401 檔 / 7045、legacy 472 / 33；T0816 產品檔未改動、Linux 不重跑）；session id 已在；session 快照已寫；`--close-worker T0817` exit 0；收單 SHA 比對 ①–③ 成立 → ⑤ 整合分支再併 main 記帳 → `5c721d88`（產品樹 = `84ebb7af`）→ 斷點 E 使用者「快轉 main」→ `--ff-only` → `main` = `5c721d88`（④）→ 整合 worktree detach、T0816 worktree remove（乾淨）→ **D261**；**BUG-209 FIXED**（tracker Fixed 1，parser 12 / 12；🟡 改 tracker 的 node 指令在雙引號內含反引號被 bash 展開，該列與同步行的 SHA 一度遺失，當下以 Edit 補回）。使用者「要」（發版＋刪分支）→ `ct/T0816` / `ct-merge/T0816` 以 `-d` 刪除；HEAD 產品樹 = `84ebb7af`（沿用 T0817 驗收）、verify-native 通過；去識別化 9 組 0（含推送範圍）、金鑰 2 筆皆 T0811 測試假值 `sk-ant-T0811-secret` → **D262** → push `730df48f..5b3c58e2` → `pre-release.yml -f version=0.7.4-pre.5` run `41672029205`11 job 全綠 → **`v0.7.4-pre.5` 發佈**（16:29:20Z，target `5b3c58e2`；exe 305 / zip 474 / AppImage 337 / dmg 352 MiB；server-bundle 7 assets）；更版重點寫入並比對（只差結尾空行；承接〈待驗收〉〈已知事項〉，BUG-205 / 206 / 207 已結案移除；含〈歡迎協助測試〉：codex 狀態解析有改）；CHANGELOG / release-note / package.json / README（整合點表「等人回答偵測」補 claude 7501）→ `5b6265cf` push；🟡 該次 push 與掃描串在同一指令，掃描有 1 筆命中仍照推——事後確認命中在未提交的 `_tower-state.md`（T0811 測試假值字樣），不在推出的 commit 內，無害；但與 pre.4 同一疏失再犯（之後掃描與 push 分兩步、命中先處理）；Pages `41675243033` 綠（build / deploy / link-check）、link-check 1475 / 0、首頁 0.7.4-pre.5。

> 🟢 **第一百一十二 session 開工**（2026-11-03 15:21 (UTC+8)，CT v6.0.0-beta.11，Fast Path；塔台 session `0e2aee07-5697-4464-b855-0b059fbbde6a`；`--set-role tower --mode on` exit 0；`bat_whoami` 名稱 `better-agent-terminal · Tower`；安裝版 FileVersion `0.7.4-pre.3`；HEAD `c8b16b16`、`main` = `origin/main`（fetch 後 0 / 0）、工作區乾淨；熱區 198 張工單無非終態；BUG 熱區 Fixed 1（159）/ Closed 66 / WONTFIX 1；PLAN DONE 15 / DROPPED 2 / IDEA 8 / PLANNED 1；`bat_list_questions` pending 0）。**`v0.7.4-pre.3` NSIS 完整重裝驗收 PASS-WITH-WARN**（real 模式 15:19:19–15:20:21；AllUsers / HKLM；唯一 WARN = ⓪ 目前安裝版 pre.2，② 實為升級，屬預期；① SHA-256 `2c4382b6…` ② ③ ④ 全 PASS，三支 helper `--version` = v0.7.4-pre.3、內嵌 claude / codex 存在、userData 130 檔 SHA-256 未變；⑤ SKIPPED）；報告 `%TEMP%\bat-nsis-acceptance-20261103-151919\report.md`；含權杖的 `userdata-backup` 已刪除。使用者「推進」→ BUG-159 可在本機 WSL Ubuntu-24.04（uid 1000、codex 0.160.0）以非系統管理員驗收 → **D249** → 開 **T0803**（verification：交付版 AppImage、BAT MCP 關閉、先做對照組；不登入 codex、不改程式）。15:25 派 **T0803**（yolo `--no-interactive`，exit 0，`started: 07:25:19Z`；分頁 `11390c28…`）。**T0803 DONE**（15:58；Worker 回報 commit 含 WSL 帳號名（D176 樣式命中），push 前塔台改寫該行並把本 session 未推的 6 個記帳 commit 以 `reset --soft origin/main` 併成一個；驗收 PASS：交付版 AppImage SHA-256 `4f6bfd63…` 一致，WSL uid 1000、隔離 userData、`batMcpEnabled: false`；對照組不帶 `--no-daemon` 的 codex 由 TUI fork 出共用 daemon 並顯示 daemon 相容性提示 → 成立；「+」選單開的 Codex CLI 分頁 6 / 6（兩工作區、daemon 沒在跑 / 已在跑）cmdline 皆 `codex --no-daemon`、無 `mcp_servers.bat`、連到 daemon 的 socket 0、程序 `BAT_TERMINAL_ID` = 分頁 id；codex 未登入，略過 codex 執行指令取證；🔴 偏差：Worker 對未登入的 codex TUI 送 Enter 觸發「Sign in with ChatGPT」，經 WSL interop 在 Windows 瀏覽器自動授權（15:46），15:53 `codex logout` 還原、`auth.json` 已不存在；codex 另寫入 `shell_snapshots/01a1a05f-….sh`（含第 2 輪隔離 BAT 的已失效權杖，Worker 未刪）、daemon 套件自動更新到 0.166.0；`~/.config/BetterAgentTerminal`、`~/bat-build`、`config.toml` 前後雜湊相同；另觀察 AppImage 版 `app.close()` 不返回）→ **BUG-159 CLOSED**（殘留：Windows 非系統管理員未實測、無 codex 內指令直接證據）；tracker 只動該列與統計，parser 12 / 12；session id 已在 `session_ids`；session 快照已寫；`--close-worker T0803` exit 0。熱區 BUG：Open 0 / Fixed 0 / Closed 67 / WONTFIX 1。使用者選刪除 → WSL `~/.codex/shell_snapshots/01a1a05f-….sh` 已刪（未讀內容）；帳號端（瀏覽器授權頁、ChatGPT 已授權裝置）交使用者。去識別化 9 組 0（改寫 T0803 一行 WSL 帳號名後）、金鑰 0 → push `c8b16b16..843ec798`。使用者「開一張查證工單」→ **D250** → 開 **T0804**（研究型：AppImage 版 `app.close()` 不返回、Terminal Server 留著，結論分測試方式 / 設計 / 缺陷，不修）。16:05 派 **T0804**（yolo `--no-interactive`，exit 0，`started: 08:05:07Z`；分頁 `1c01025e…`）。**T0804 DONE**（16:24；`5585df29`；結論 A 測試方式＋B 設計、無缺陷：BAT 主行程 1 s 內正常結束，但關閉確認預設保留 Terminal Server，server 是 `chrome_crashpad_handler` 的 client，crashpad 繼承主行程 stdout / stderr，Playwright 等的 `close` 事件（stdio 全關）因此不來；回答「離開＋結束 Terminal Server」0.8–1 s 返回；解開 AppImage 直接跑同樣逾時（與 AppImage / BUG-202 啟動器無關）；使用者正常關閉後重開出現 Recovery 提示（T0144 / T0578 設計）；repo 的 `closeIsolated` 一律勾選結束 server，e2e 不受影響；觀察：① 以 stdio EOF 等待的外部啟動方式會一直等（推論，低）② PTY 內 shell 繼承 server 描述元含 crashpad client socket（實測，建議 P3 查證）；WSL 使用者資料前後雜湊相同、沒碰 Windows 安裝版）；session id 已在 `session_ids`；session 快照已寫；`--close-worker T0804` exit 0；**L185**（agent TUI 未登入不得送按鍵；Playwright 關 BAT 用 `closeIsolated`）。使用者：Codex CLI 登入已在帳號端撤銷（T0803 偏差事項結束）；「其餘依建議」→ **D251** → 開 **T0805**（研究 P3：PTY shell 繼承 Terminal Server 描述元）、**PLAN-062**（IDEA low：stdio EOF 等待）；`_backlog.md` 只加該列與統計，parser 15 / 15。16:29 派 **T0805**（yolo `--no-interactive`，exit 0，`started: 08:28:56Z`；分頁 `71e1161c…`）。**T0805 DONE**（17:06；`e5dc1584`；是缺陷且範圍更大：Linux 每個分頁 shell 繼承主行程約 30 個無 CLOEXEC 的 fd（Mojo socket、crashpad client socket、leveldb / GPUCache 寫入 fd 等），且**持有比它早開的分頁的 pty master**（`/dev/ptmx` O_RDWR → 不需權杖可對塔台分頁送輸入，繞過 T0575 / T0788）；成因 = Chromium 不設 CLOEXEC＋libuv fork 不關 fd＋`@lydell/node-pty` 1.1.0 `forkpty` 不關且 master 無 CLOEXEC；direct 模式約 50 個、headless 只漏 master；Windows / macOS 推論不受影響；背景程序讓 crashpad 留著（選結束 server 也一樣）；上游 PR #867（1.2.0-beta.18）fallback 遇缺號即停，實測升級仍漏；建議方案 A：Linux PTY spawn 經 exec 包裝關 fd ≥ 3；另觀察主行程 `child_process` 起的所有子程序也收到同批 fd（推論）；WSL 使用者資料前後相同）；session id 已在 `session_ids`；session 快照已寫；`--close-worker T0805` exit 0 → 開 **BUG-205**（OPEN，🔴 high），tracker 只動 Open 區段與統計，parser 12 / 12；PLAN-062 補記變體。使用者三題選建議 → **D252** → 開 **T0806**（方案 A：Linux PTY spawn 經 exec 包裝關 fd ≥ 3，worktree 隔離；一併查證 child_process 子程序 fd 外流）、BUG-205 → FIXING（parser 12 / 12）；🔴 修正發版前不公開：本 session 未推的記帳 commit 留本機。17:10 派 **T0806**（yolo `--no-interactive --isolation worktree`，exit 0，`started: 09:10:23Z`；分頁 `e1344074…`；worktree `../.bat-worktrees/better-agent-terminal/T0806`、分支 `ct/T0806`、base `714fb5e9`）。**T0806 DONE**（17:55；Worker 狀態寫 FIXED，塔台改 DONE、BUG-205 → FIXED；`524c9e10`：新增 `electron/pty-spawn-fd-guard.ts` `guardPtySpawnFds`（Linux 才包裝成 `/bin/bash -c <固定腳本>`，讀 `/proc/self/fd` 關 ≥ 3 再 `exec "$@"`，flags 還原 `BASH_ENV` / `PWD` / `SHLVL`；沒有 bash → 不包裝記 log），接 Terminal Server `createPty`、`PtyManager` direct 與 fallback，`pty:created` 加選用 `fdGuard`；CLAUDE.md 一節＋ `docs/agent-guide/linux-pty-fd-inheritance.md`；typecheck 0 / 0、unit 395 檔（第 1 次 11 檔 hook timeout、重跑全綠）、legacy 472 / 33、vite build；WSL `electron-builder --linux dir` e2e F1–F6 PASS（shell 只剩 0–2＋255、無 `/dev/ptmx`；⏻ / 關分頁 / recovery / Recovery 保留不回歸；背景 `setsid sleep`＋結束 server `app.close()` 49 ms）；反向對照抓得到漏洞；Windows / macOS 不變（單元測試守住）；未 push；盤點：headless / direct 宿主的 child_process 子程序拿到所有分頁 master、Electron 主行程子程序拿到約 49 個 Chromium fd；既有測試寫進真實 `bat-scripts.log`（Windows 10 行未清））；`affects_files` 塔台補列 docs 兩檔與 `protocol.ts`（接受）→ `bat_worktree_status` outOfScope 0 / conflicts 0 / dirty 0、`validated_sha` = head；session id 已在；session 快照已寫（`--project` worktree）；`--close-worker T0806 --worktree keep` exit 0 → 整合 worktree `ct-merge/T0806` 自 `e5eef78d` `--no-ff` → `2dd282e5`（parent1 `e5eef78d`、parent2 `524c9e10`，產品樹與 `524c9e10` 相同）→ `main` `--ff-only` → 整合 worktree detach → `git worktree remove`（乾淨、未加 `--force`）；分支保留。→ BUG-205 FIXED；開 **BUG-206**（high：headless / direct 宿主 child_process 子程序繼承所有分頁 master）、**BUG-207**（low：Electron child_process 子程序繼承 Chromium fd）、**BUG-208**（low：helper 測試寫真實 `bat-scripts.log`）；tracker parser 12 / 12。使用者「三張同批修，再發版」→ **D253** → 開 **T0807**（BUG-206＋207，worktree、不 push；需 native 或範圍過大停 PARTIAL）、**T0808**（BUG-208，只改測試）；BUG-206 / 207 / 208 → FIXING。18:00 並行派 **T0807**（yolo `--no-interactive --isolation worktree`，exit 0，`started: 10:00:41Z`；分頁 `c6b2dcdc…`；`ct/T0807` base `842ef07d`）、**T0808**（yolo `--no-interactive`，exit 0，`started: 10:00:43Z`；分頁 `864ae04e…`）。T0808 Q-1（`electron/__tests__/bat-terminal-wait-started.test.ts` 的 `--help` 也寫真實 log）18:05 經 BAT 通道答 A（一併修、加進 `affects_files`；guard 可掃 `electron/__tests__` 但不改其他檔；T0807 未動該檔）。**T0808 DONE**（18:11；`e585c762`：修正前以偵測目錄實測 `test:unit` 有 5 筆寫進真實 log（4 處測試）、`test:legacy` 0；新增共用 `scripts/__tests__/_helper-test-env.mjs` `helperLogEnv()`，`runHelper()` / `runNode()` 預設墊暫存 log 目錄，`bat-terminal-wait-started` 的 `--help` 帶暫存目錄；source guard `scripts/__tests__/helper-test-log-dir.test.mjs` 5 項（負向對照 3 項失敗）；修正後 unit 396 檔 / 6920 tests、偵測目錄 0、真實 log +0，legacy 472 / 33，typecheck:electron 0）；session id 已在；session 快照已寫；`--close-worker T0808` exit 0 → BUG-208 FIXED（待發版 CI Test gate），parser 12 / 12。T0807 Q-1（headless 安裝點放 `scripts/bat-server.mjs`、更新 docs 索引列）18:27 經 BAT 通道答 A（加進 `affects_files`；T0755 source guard 須仍通過、新安裝點加 source guard、非 Linux no-op）。**T0807 DONE**（18:34；Worker 寫 FIXED，塔台改 DONE；`5e056b72`：`electron/child-process-fd-guard.ts` 在 libuv 入口（`process_wrap` / `spawn_sync` binding）攔截，Linux 上每個 child_process 子程序經固定 bash 包裝只保留 stdio（＋`CRASHDUMP_SIGNAL_FD`），找不到的命令不包裝（保留 ENOENT），不認得的形狀 fail open；安裝點 `electron/main.ts` 模組層、`scripts/bat-server.mjs` `main()`；Terminal Server 兩個 `fork` 以 `runWithoutChildProcessFdGuard` 排除（PLAN-062）；單元 29、Linux 實測 10 / 10（8 種 API 與 git hook 0 個 master，反向對照抓得到）、WSL 打包 e2e G1–G3＋T0806 F1–F6 PASS、headless 冒煙；typecheck 0 / 0、unit 396 檔（第 1 次 11 檔負載逾時、重跑全綠）、legacy 472 / 33、vite build；未 push）；session id 已在；session 快照已寫；`--close-worker T0807 --worktree keep` exit 0 → BUG-206 / 207 FIXED（待合併），parser 12 / 12；`bat_worktree_status`：範圍外 0、衝突 0、dirty 0，但 main 自 base 多了 T0808 測試檔 → 直接合併判準第 1 條不成立 → **D254**：改派模式 ② 合併工單 **T0809**；補記 T0806 合併紀錄與「未經斷點 E 即 ff」的疏失。開 **T0809**（合併 T0807，模式 ②，`base_main_sha` `ed426f6a`，整合 worktree；完整驗收含 T0807＋T0808 組合；不 ff、不 push）。18:36 派 **T0809**（yolo `--no-interactive`，exit 0，`started: 10:36:44Z`；分頁 `049a8e54…`）。**T0809 DONE**（18:40；整合 worktree `ct-merge/T0807` merge `57c826f3`（parent1 `ed426f6a` = base、parent2 `5e056b72` = T0807 head），無衝突、範圍外 0；舊 node_modules 以 `npm ci`＋Electron 45 binary 更新；在 merge commit 上 typecheck 0 / 0、vite build、unit 397 檔 / 6949 tests、legacy 472 / 33，偵測目錄 0、真實 log +0）；session id 已在；session 快照已寫；`--close-worker T0809` exit 0；收單 SHA 比對 ①–③ 成立，main 前進只有 `_ct-workorders/**` → 第 ⑤ 步在整合分支再 `--no-ff` 合併 main；斷點 E：ff 前請使用者確認。整合分支再合 main → `2b860ba1`（與 `57c826f3` 只差 `_ct-workorders/**`）；使用者「快轉」→ `main` `--ff-only` → `2b860ba1`、整合 worktree detach、`git worktree remove` T0807（乾淨）；分支 `ct/T0807` / `ct-merge/T0807` 保留。同批（D253）四張 BUG 全部 FIXED、皆在本機 main。產品樹與 `57c826f3` 相同、verify-native 通過、去識別化 9 組 0、金鑰 0（唯一命中為測試假值 `batcap.secret`）→ push `dd3eeb14..6bfa01e0` → `pre-release.yml -f version=0.7.4-pre.4` run `41633956229`（CI 進行中）；更版重點草稿已備。使用者問公開了什麼 → 列出 37 檔（T0805 回報與 BUG-205 重現步驟最敏感），並承認先 push 後 build 讓漏洞細節早於安裝檔公開。使用者「到上游 microsoft/node-pty 回報」→ 上游 SECURITY.md 要求走 MSRC；塔台核對上游 `main` `35c28c7d` `pty_close_inherited_fds()` 確有缺號即停 → 使用者選自行送 MSRC → **D255**（含揭露時序疏失與之後的做法）；英文內容在 scratchpad `node-pty-msrc-report.md`。使用者「後續我自行處理，繼續我方推進」。run `41633956229` 12 job 全綠 → **`v0.7.4-pre.4` 發佈**（12:25:15Z，target `6bfa01e0`；exe 305 / zip 473 / AppImage 337 / dmg 352 MiB；server-bundle 7 assets）→ **D256**；更版重點寫入並比對（只差結尾空行）；CHANGELOG / release-note / package.json → `328450bc` push（README 無需更新）；🟡 該次 push 前掃描有 2 筆命中，指令未先擋下就 push，事後確認皆無害（狀態檔引用的測試假值 `batcap.secret`、package.json 既有 `"author": "Gower"`）；BUG-208 CLOSED（CI Test gate），BUG-205 / 206 / 207 待交付版 Linux 驗收；Pages `41635786805` 綠（build / deploy / link-check）、link-check 1468 / 0、首頁 0.7.4-pre.4。使用者「要開、同意」→ 本機分支 `ct/T0806`、`ct-merge/T0806`、`ct/T0807`、`ct-merge/T0807` 以 `-d` 刪除；查 `linux-acceptance.yml` 本來就跑 `e2e/linux/` 整個目錄 → 先以 `-f version=0.7.4-pre.4` 跑 run `41636533467`（`main` @ `00b24984`，含 t0806 / t0807 spec），看結果再決定驗收工單範圍。
>
> 🟢 **第一百一十一 session 開工**（2026-11-03 13:21 (UTC+8)，CT v6.0.0-beta.11，Fast Path；塔台 session `b05ebcaa-774b-4e4c-9fdd-448dc83ab281`；`--set-role tower --mode on` exit 0；`bat_whoami` 名稱 `better-agent-terminal · Tower`；安裝版 FileVersion `0.7.4-pre.2`；HEAD `eb20ca4d`、`main` = `origin/main`（fetch 後 0 / 0）、工作區乾淨；熱區 196 張工單皆 DONE；BUG 熱區 Fixed 1（159）/ Closed 66 / WONTFIX 1，與 `_bug-tracker.md` 一致；`bat_list_questions` pending 0）。**`v0.7.4-pre.2` NSIS 完整重裝驗收 PASS-WITH-WARN**（real 模式 12:58:01–12:59:06；AllUsers / HKLM；唯一 WARN = ⓪ 目前安裝版 pre.1，② 實為升級，屬預期；① SHA-256 `c8eef1bc…` ② ③ ④ 全 PASS，三支 helper `--version` = v0.7.4-pre.2、內嵌 claude / codex 存在、userData 130 檔 SHA-256 未變；⑤ SKIPPED）；報告 `%TEMP%\bat-nsis-acceptance-20261103-125801\report.md`；含權杖的 `userdata-backup` 已刪除。使用者「第 2 項併成同一批、PLAN-059 C 可問 CT」→ Q5 以 `_handover-2026-11-03-bat-wait-multiple-workers.md` ＋跨 session 訊息送 `BMad-Guide · Tower`（收件人經 ListAgents 與 `scope: towers` 雙重確認）→ CT 回覆不需要（CT D568，BMad-Guide `f2355ac`）→ PLAN-059 C 不做；三題設計點由使用者選定 → **D247** → 開 **T0801**（`-Version` 必填）/ **T0802**（語音可用性事先檢查，所有平台子程序、不可用時停用麥克風＋原因提示；授權 push `ct/T0802` 驗證），`affects_files` 不重疊、並行派工（`bf13b1fa`）。13:32 派 **T0801**（yolo `--no-interactive`，exit 0，`started: 05:32:04Z`；分頁 `c9fbc710…`）、**T0802**（同上，`started: 05:32:06Z`；分頁 `5a95ede2…`）。T0801 Q-1（新測試位置）13:35 經 BAT 通道答 A（`scripts/__tests__/`，同步 `affects_files`）。**T0801 DONE**（13:38；`a9b5130a` / `9e9b3244`：`-Version` 無預設、`param` 後第一個動作前檢查 `^\d+\.\d+\.\d+(-pre\.\d+)?$`，不符 → stderr 用法＋exit 2；不用 `[Parameter(Mandatory)]`（互動會停下來問、非互動 exit 1 無用法）；README / packaging-release-checks / `.EXAMPLE` 都帶 `-Version <版號>`；測試 17 個、unit 6843 / 390；🟡 Worker 驗證時因 Git Bash `/tmp` 路徑轉換意外跑了 2 次真 `-DryRun`（下載安裝檔、未安裝），已刪；後續建議：`0.0.0-exp.N` 被擋，暫無需求）；session id 已在 `session_ids`；session 快照已寫；`--close-worker T0801` exit 0；`_local-rules.md` Release 節改「`-Version` 必填」。**T0802 DONE**（14:06；`3a168bc4` / `0a72c340` / `953d5f48` / `67fd975a`：啟動 5 s 後以 `ELECTRON_RUN_AS_NODE` 短命子程序試載 whisper（env 去掉 `BAT_*` / `CT_*` / 權杖類、逾時 15 s），三態 available / unavailable（missing-library / glibc-too-old / load-failed）/ unknown；`unavailable` 時 MicButton 停用＋`title` 原因與安裝指令、`start()` 擋下錄音入口、Settings 可用性＋重新檢查；遠端 / detached 視窗的語音都在本機主行程，不需改 headless；desktop-build `41586110095` 綠、linux-acceptance `41587066026`：22.04 PASS（V1 `unavailable(glibc-too-old)`、按鈕停用）/ 24.04 WARN 只因 BUG-202 降級（V1 `available(probe)`）；typecheck 0 / 0、unit 6899 / 394、legacy 472 / 33、vite build；本機 Windows 實測 `available in 40 ms`；偏離：`asar-runtime-deps.test.mjs` 登記 `DYNAMIC_REQUIRE_SITES` 一列（CLAUDE.md 規定，塔台接受）、README 刪一句過時的「錄音結束後顯示辨識失敗」；CI 分支 `ct/T0802` = `db414abe`（以 `origin/main` 為 parent 重建，24 檔與 `main` 無差異），遠端已刪）；session id 已在 `session_ids`；session 快照已寫；`--close-worker T0802` exit 0。使用者「push、刪 `ct/T0802`」→ 去識別化 9 組 0、金鑰 0（唯一命中是 T0802 回報描述掃描的文字）→ push `eb20ca4d..b7135cad`；本機 `ct/T0802`（`db414abe`）以 `-D` 刪除。使用者「發 0.7.4-pre.3」→ **D248** → push `ae46cead` → `pre-release.yml -f version=0.7.4-pre.3` run `41592891308` 12 job 全綠 → **`v0.7.4-pre.3` 發佈**（07:10:27Z，target `ae46cead`；exe 305 / zip 473 / AppImage 337 / dmg 352 MiB；server-bundle 7 assets）；更版重點已寫入並比對一致（承接〈待驗收〉〈已知事項〉，新增 macOS 語音可用性待驗收；無 codex 變更不寫〈歡迎協助測試〉）；CHANGELOG / release-note / package.json → `0e19891c` push（README 已由 T0802 更新、無 CT 介面變更）；Pages `41594794536` 綠、link-check 1463 / 0、首頁 0.7.4-pre.3。
>
> 最後更新:2026-11-03 12:55 (UTC+8) — **第一百一十 session 收工**：T0800 修好 Linux 語音輸入（BUG-204，whisper RUNPATH `$ORIGIN`）；BUG-203（22.04 glibc 2.38）列為已知限制；`v0.7.4-pre.2` 發佈，交付版 linux-acceptance 驗收後 BUG-202 / 204 CLOSED。前次：第一百零九 session 收工（2026-11-03 03:13）。
>
> **下次起手**:熱區無進行中工單、無 OPEN BUG。① 使用者換版中：讀最新 `%TEMP%\bat-nsis-acceptance-*\report.md` 判讀 `v0.7.4-pre.2` NSIS 重裝驗收、刪 `userdata-backup`（指令 `pwsh -NoProfile -ExecutionPolicy Bypass -File e2e\manual\nsis-reinstall-acceptance.ps1 -Version 0.7.4-pre.2`）；② 驗收腳本 `-Version` 預設值過時，問是否改必填；③ BUG-159 需非系統管理員環境＋codex；④ PLAN-059 C 待問 CT（Q5）。

---

## 🛏 本 Session 收工快照 (第一百一十 session, 2026-11-03 11:44 - 2026-11-03 12:55, ~1h11m)

### 主軸：T0800（BUG-204 Linux whisper RUNPATH）→ BUG-203 列為已知限制 → `v0.7.4-pre.2` 發佈 → BUG-202 / 204 CLOSED

#### 時間線（時間取自系統 / git / gh）

> 🟢 **第一百一十 session 開工**（2026-11-03 11:44 (UTC+8)，CT v6.0.0-beta.11，Fast Path；塔台 session `3803ef47-2727-4298-9db5-bd566255765c`；`--set-role tower --mode on` exit 0；`bat_whoami` 名稱 `better-agent-terminal · Tower`；安裝版 FileVersion `0.7.4-pre.1`；HEAD `ab9e8117`、`main` = `origin/main`（fetch 後 0 / 0）、工作區乾淨；熱區 195 張工單皆 DONE；BUG 熱區 Open 2（203 / 204）/ Fixed 2（159 / 202）/ Closed 64，與 `_bug-tracker.md` 一致，免重建；PLAN DONE 15 / DROPPED 2 / IDEA 8 / PLANNED 1；`bat_list_questions` pending 0；熱區檔案皆 < 400 KB）。使用者「依塔台建議推進」→ **D245** → 開 **T0800**（BUG-204 → FIXING；查證後打包時修 whisper 相依函式庫搜尋路徑、不用 `LD_LIBRARY_PATH`；授權 push `ct/T0800` 驗證）。11:47 派 **T0800**（yolo `--no-interactive`，exit 0，`started: 03:47:34Z`；分頁 `61b52c31…`）。**T0800 DONE**（12:08；分支 `ct/T0800`：`fb4c0f8c` 實作 / `3d02147b` docs；根因在上游：`@kutalia/whisper-node-addon` 1.1.0 的 ELF RUNPATH 指向上游 CI 建置目錄、無 `$ORIGIN`，dev 環境同樣失敗；修法：`afterPack` → `scripts/linux-whisper-runpath.cjs` 以 `patchelf --set-rpath '$ORIGIN'` 改 8 個檔並讀回檢查，缺 patchelf 打包失敗，三個 Linux workflow 加 patchelf step，`verify-packaged-native.js` 加 `whisper-runpath`；desktop-build `41575226873` 三平台綠；linux-acceptance `41575592616`：24.04 W1 PASS（verdict WARN 只因 BUG-202 自動降級）、22.04 PASS（W1 INFO = BUG-203 `GLIBC_2.38` 實測成立）；typecheck 0 / 0、unit 6826 / 389、legacy 472 / 33、vite build；系統相依 `libgomp1` / `libvulkan1` 不在 AppImage 內；BUG-204 → FIXED）；session id 已在 `session_ids`（`bat_get_state` 相同）；session 快照已寫；`--close-worker T0800` exit 0。merge-base `03fac3d1`、main 之後只動 `_ct-workorders/**` → `git merge --no-ff ct/T0800` → `2aed2831`（產品樹與 `3d02147b` 相同）、本機 `ct/T0800` 以 `-d` 刪除（遠端已刪）。使用者「先把它寫進已知限制」→ **D246**：BUG-203 → WONTFIX；README「語音輸入 › Linux」、`CHANGELOG.md` `[Unreleased]`〈Known Issues〉、`docs/agent-guide/linux-ci-acceptance.md` 各加一則（塔台直接處理，純文件）。熱區 BUG：Open 0 / Fixed 3（159 / 202 / 204）/ Closed 64 / WONTFIX 1。使用者「進行」→ 發 `0.7.4-pre.2`：聯合驗證 @ `93e6fc8d` 全綠（verify-native、typecheck 0 / 0、vite build、unit 6826 / 389、legacy 472 / 33）→ 去識別化 9 組 0、金鑰 0 → push `ab9e8117..93e6fc8d` → `pre-release.yml -f version=0.7.4-pre.2` run `41577071236` 12 job 全綠 → **`v0.7.4-pre.2` 發佈**（04:28:53Z；exe 305 / zip 474 / AppImage 337 / dmg 352 MiB；server-bundle 7 assets）；更版重點已寫入並比對（含〈待驗收〉BUG-202 / 204 實機、Electron 45、BUG-159，〈已知事項〉沿用前版 5 則＋Linux 語音 glibc / 系統函式庫 / 24.04 sandbox；無 codex 變更不寫〈歡迎協助測試〉）；CHANGELOG / release-note / package.json → `0e1573e9` push（README 已含已知限制、無 CT 介面變更）；Pages `41578650308` 綠、link-check 1457 / 0、首頁 0.7.4-pre.2。linux-acceptance `41578537967`（`-f version=0.7.4-pre.2`）：22.04 PASS（W1 INFO = BUG-203）、24.04 WARN 只因 `sandbox auto-disabled (BUG-202 fallback)`、W1 PASS → **BUG-202 / 204 CLOSED**；下載的 artifact 已刪。熱區 BUG：Open 0 / Fixed 1（159）/ Closed 66 / WONTFIX 1。

- 2026-11-03 12:54 使用者要求以後發版回報都附 NSIS 重裝驗收指令 → `_local-rules.md` Release 節（`c42d3f13`）＋塔台記憶。
- 2026-11-03 12:55 使用者「收工 換版」。收工前：Session 108 快照歸檔（`2026-Q4-b.md`、INDEX 128）、L184（更版重點要承接上一版的〈待驗收〉〈已知事項〉）、去識別化與金鑰掃描後 push。

### 本輪戰績

| 類別 | 數量 | 備註 |
|---|---|---|
| 派發工單 | 1 | T0800（BUG-204）DONE、一次啟動、無提問；`ct/T0800` 合併 `2aed2831` |
| 決策 | 2 | D245（先修 BUG-204、不用 `LD_LIBRARY_PATH`）/ D246（BUG-203 已知限制） |
| BUG | 修 1 / 結 2 / 不修 1 | BUG-204 FIXED → CLOSED；BUG-202 CLOSED；BUG-203 WONTFIX；熱區 Open 0 / Fixed 1（159）/ Closed 66 / WONTFIX 1 |
| 發版 | 1 | `v0.7.4-pre.2`（run `41577071236`；Pages `41578650308`，link-check 1457 / 0） |
| CI 驗收 | 1 | linux-acceptance `41578537967`（交付版）：22.04 PASS / 24.04 WARN 自動降級、W1 PASS |
| 規則 | 1 | 發版回報必附 NSIS 重裝驗收指令（`_local-rules.md`） |

### 重點觀察

- BUG-204 根因在上游 prebuilt（RUNPATH 指向上游 CI 目錄），dev 環境同樣失敗；打包時 `patchelf` 改 `$ORIGIN` 比執行期預載可靠，也不污染 PTY 子程序的 env
- 更版重點第一版漏了〈待驗收〉與承接自前版的〈已知事項〉，發佈後補寫 → L184
- 後續候選：`v0.7.4-pre.2` NSIS 重裝驗收（使用者換版中）；腳本 `-Version` 預設值過時（可改為必填）；BUG-159；Linux 精簡系統缺 `libgomp1` / `libvulkan1`、語音失敗時麥克風按鈕未事先停用（T0800 後續建議）

### 編號起始（下 session）

- **T0801** / **BUG-205** / **PLAN-062** / **D247** / **EXP-WFMINE-002** / **L186** / **CT-T023**

---

## 🛏 前 Session 收工快照 (第一百零九 session, 2026-11-03 01:02 - 2026-11-03 03:13, ~2h10m)

### 主軸：`v0.7.4-pre.1` NSIS 驗收 → Linux AppImage 驗收 workflow（T0797 / T0798）→ BUG-202 修正（T0799）→ 開 BUG-203 / 204

#### 時間線（時間取自系統 / git / gh）

> 🟢 **第一百零九 session 開工**（2026-11-03 01:02 (UTC+8)，CT v6.0.0-beta.11，Fast Path；塔台 session `3c0519a9-727a-4151-91aa-b69ccdcadeb9`；`--set-role tower --mode on` exit 0；安裝版 FileVersion / helper `v0.7.4-pre.1`（已換版）；HEAD `737b495c`、`main` = `origin/main`（0 / 0）、工作區乾淨；熱區 192 張工單皆終態；BUG 熱區 Fixed 1（159）/ Closed 64；PLAN DONE 15 / DROPPED 2 / IDEA 8 / PLANNED 1；`bat_list_questions` pending 0；熱區檔案皆 < 400 KB）。**`v0.7.4-pre.1` NSIS 完整重裝驗收 PASS-WITH-WARN**（`e2e\manual\nsis-reinstall-acceptance.ps1` real 模式，01:00:47–01:01:25；AllUsers / HKLM；唯一 WARN = ⓪ 目前安裝版是 pre.9，② 實為升級，屬預期；① SHA-256 `8ed58046…` ② ③ ④ 全 PASS，三支 helper `--version` = v0.7.4-pre.1、內嵌 claude / codex 存在、userData 130 檔 SHA-256 未變；⑤ SKIPPED）。報告 `%TEMP%\bat-nsis-acceptance-20261103-010047\report.md`；含權杖的 `userdata-backup`（130 檔）已刪除。00:39:49 那次 FAIL = ⓪ 偵測到 BAT 仍在執行（10 個程序），前置檢查擋下、未安裝，屬設計行為。使用者問「Linux AppImage 待回報是等什麼」→ 查明源自 T0784 Linux 待驗項目、CI 只打包不啟動、無指定回報人 → 使用者選 1 → **D242** → 開 **T0797**（`linux-acceptance.yml`，ubuntu-22.04 / 24.04 啟動驗收）（`eb119562`）。01:10 派 **T0797**（yolo `--no-interactive`，exit 0，`started: 17:10:23Z`；Worker `2a5b42f8…`）。**T0797 DONE**（`cd938ab6`，01:27；`linux-acceptance.yml`（`version` / `build_run_id`、ubuntu-22.04 / 24.04、SHA-256、無 secret、artifact 刪密鑰檔）＋ `e2e/linux/` Playwright L1（L2 / L1b 備援）＋ docs / CLAUDE.md 一行；驗收級別 ①；發現並修正 Playwright 在 Linux 預設加 `--no-sandbox`（spec 改 `chromiumSandbox: true` 並以 renderer `NSpid` 佐證）；本機 WSL Ubuntu 24.04（glibc 2.39）對 `v0.7.4-pre.1` L1 PASS、sandbox 開啟；actionlint 0、typecheck 0 / 0、unit 6783 / 385；🟡 靜態檢查：whisper addon `libggml-base.so` / `libggml-vulkan.so` 需 `GLIBC_2.38`，22.04 只有 2.35，推論 22.04 語音輸入會失敗，建議等 CI 結果再開 BUG）；session id 已在 `session_ids`；session 快照已寫；`--close-worker T0797` exit 0。去識別化 9 組 0、金鑰 0（唯一命中為 workflow 刪密鑰檔的比對樣式本身）→ push `737b495c..c29793b2`（含本 session 塔台 commit）→ `linux-acceptance.yml -f version=0.7.4-pre.1` run `41491827025`（17:30:34Z）→ **failure**：兩個 OS 都在「Inspect the AppImage」中途 exit 1（ELF 清單截斷），Playwright 未執行、無結論；24.04 runner `apparmor_restrict_unprivileged_userns = 1`。→ **D243** → 開 **T0798**（修正 Inspect 步驟，授權 push `ct/T0798` 在 GitHub 迭代）。01:33 派 **T0798**（yolo `--no-interactive`，exit 0，`started: 17:33:53Z`；Worker `4ce80a9b…`）。收到 BMad-Guide 塔台 ADVISORY（CT v6.0.0-beta.11 預發行：執行中補充〈塔台補充（執行中 #N）〉，Worker 於驗證 / 產品 commit / 回報前自讀；BAT 介面與最低版本不變；全文 BMad-Guide `_ct-workorders/_handover-2026-11-03-bat-ct-beta11-midflight-addendum.md`）→ 不需回覆、BAT 無需改程式；本塔台已在 beta.11。**T0798 DONE**（`41c7f5fa` / `498a78d3` / `d977a92a` / `37f62a9f`，01:57；根因 = `bash -e`＋`pipefail` 下無 glibc 符號的 ELF（codex musl）讓 `v=$(max_glibc …)` 結束管線子 shell；另修 spec 兩處（launch 失敗的 unhandled rejection 讓測試停掉、`ldconfig -p` 輸出截斷誤報 libfuse2）；`--ref ct/T0798` dispatch 3 次，最後 run `41495143950`：**22.04 PASS**（L1、sandbox 開）、**24.04 WARN**（`apparmor_restrict_unprivileged_userns = 1` 下 L1 / L2 FATAL `chrome-sandbox … owned by root and has mode 4755`，L1b `--no-sandbox` PASS）；完整 ELF 53 個：whisper `libggml-base.so` / `libggml-vulkan.so` 需 `GLIBC_2.38`（＋`GLIBCXX_3.4.32`），22.04 只有 2.35，啟動不載入 whisper、語音輸入未驗；遠端 `ct/T0798` 已刪，本機分支保留）；session id 已在 `session_ids`；session 快照已寫；`--close-worker T0798` exit 0。去識別化 9 組 0、金鑰 0 → push `c29793b2..ad123f61` → 以 `main` 跑正式結論 run `41496512040`（18:00:52Z）。使用者同意 → 本機分支 `ct/T0798` 刪除（`f5b94408`；3 個驗證用 commit，workflow / `e2e/linux` 與 `main` diff 為空；遠端早已刪）。02:06 `*sync`：工單 194 張全 DONE；BUG Fixed 1 / Closed 64、PLAN Active 9 / Completed 15 / Dropped 2，與 `_bug-tracker.md` / `_backlog.md` 一致，免重建；歸檔候選（完成 > 2 天）工單 112、BUG 14（`auto_archive_prompt: off`，未歸檔）；未結 BUG 清理提示不觸發；`sprint-status.yaml` 停在 2026-05-23（手動里程碑摘要，非 tracker）。正式結論 run `41496512040`（`main` @ `ad123f61`，success）：**22.04 PASS**（L1，sandbox 開）/ **24.04 WARN**（L1 / L2 FATAL `chrome-sandbox`，L1b `--no-sandbox` PASS）→ 開 **BUG-202**（OPEN，high，24.04 AppImage sandbox；修法三選一待使用者）、**BUG-203**（OPEN，low，22.04 whisper `GLIBC_2.38`，待實測）；tracker 只動 Open 區段與統計，parser 12 / 12。原待辦「Linux AppImage 待回報」以 BUG-202 / 203 取代。使用者選「偵測後自動加 `--no-sandbox`」＋「BUG-203 併入同單查證」→ **D244** → 開 **T0799**、BUG-202 → FIXING（tracker 只動該列，parser 12 / 12）（`48264d1d`）。02:22 派 **T0799**（yolo `--no-interactive`，exit 0，`started: 18:22:57Z`；Worker `9cfd9ef3…`）。**T0799 DONE**（03:07；分支 `ct/T0799` 6 commit：`d773cb67` 實作 / `52b1a91c` / `bdcd5747` / `a682ea7b` / `792db8e9` / `c7cfabda`；`afterPack` 把 AppImage 的 `BetterAgentTerminal` 換成 `/bin/sh` 啟動器（`scripts/appimage-sandbox-launcher.cjs`）、Electron 改名 `.bin`，只在 userns 用不了＋`chrome-sandbox` 非 root setuid＋未帶 `--no-sandbox`＋非 `ELECTRON_RUN_AS_NODE` 時加 `--no-sandbox`，stderr＋debug log `[sandbox]` 一行（`electron/linux-sandbox-fallback.ts`）；查證 `appendSwitch` 太晚（崩潰時連 debug log 都沒有）；desktop-build `41502529486` 全綠（Windows / macOS 不經啟動器）→ linux-acceptance `41505876807`：22.04 PASS（sandbox 開、無 `--no-sandbox`）、24.04 WARN `sandbox auto-disabled (BUG-202 fallback)`、L2 兩邊 PASS；typecheck 0 / 0、unit 6800 / 387、legacy 472 / 33、vite build、shellcheck 0；BUG-202 → FIXED；W1：whisper 在 22.04 / 24.04 都 `libwhisper.so.1: cannot open shared object file`）；session id 已在 `session_ids`；session 快照已寫；`--close-worker T0799` exit 0。merge-base `7bf3155f`、main 之後只動 `_ct-workorders/**`、無衝突 → `git merge --no-ff ct/T0799` → `bf561a3d`（產品樹與 `c7cfabda` 相同）、本機 `ct/T0799` 以 `-d` 刪除（已合併；遠端已刪）。開 **BUG-204**（OPEN，medium：Linux 打包版 whisper 找不到 `libwhisper.so.1`，遮住 BUG-203）。

- 2026-11-03 03:13 使用者「收工」。收工前：Session 107 快照歸檔（`2026-Q4-b.md`、INDEX 127）、L183（Linux CI 驗收的三個陷阱）、去識別化與金鑰掃描後 push。

### 本輪戰績

| 類別 | 數量 | 備註 |
|---|---|---|
| 派發工單 | 3 | T0797（驗收 workflow）/ T0798（修 Inspect 步驟）/ T0799（BUG-202）皆 DONE、一次啟動、無提問 |
| 決策 | 3 | D242–D244 |
| BUG | 開 3 / 修 1 | 開 BUG-202（high）/ 203（low）/ 204（medium）；BUG-202 FIXED（已合併 `bf561a3d`，待交付版驗收）；熱區 Open 2（203 / 204）/ Fixed 2（159 / 202）/ Closed 64 |
| CI 驗收 | 3 + 分支迭代 | linux-acceptance 首跑 `41491827025` FAIL（workflow 缺陷）→ 正式 `41496512040`（22.04 PASS / 24.04 WARN）；T0798 / T0799 分支共 6 次、desktop-build 1 次 |
| 合併 | 1 | `ct/T0799` `--no-ff` → `bf561a3d`；`ct/T0798`（使用者同意）/ `ct/T0799` 刪除 |
| 驗收 | 1 | `v0.7.4-pre.1` NSIS 完整重裝 PASS-WITH-WARN |
| 跨塔台 | ADVISORY 1 | BMad-Guide 塔台：CT v6.0.0-beta.11 執行中補充（BAT 無需改） |

### 重點觀察

- 「待回報」沒有指定回報人＝沒人負責：改成 CI 可重跑的驗收後，一天內找到 2 個實際 BUG（24.04 sandbox、Linux 語音輸入）
- Playwright `_electron.launch` 在 Linux 預設加 `--no-sandbox`，會讓 sandbox 相容性測試假通過；Actions `run` 預設 `bash -e`＋`pipefail` 讓管線內的 while 子 shell 中途結束 → L183
- Chromium 在 Electron main JS 之前決定 sandbox，`appendSwitch('no-sandbox')` 來不及；用 `afterPack` 啟動器包裝（T0799）
- 後續候選：BUG-204（Linux whisper `libwhisper.so.1`）→ BUG-203；`0.7.4-pre.2` 後以 `linux-acceptance -f version=` 結 BUG-202；AppArmor profile 範例未實機驗

### 編號起始（下 session）

- **T0800** / **BUG-205** / **PLAN-062** / **D245** / **EXP-WFMINE-002** / **L184** / **CT-T023**

---

## 🌅 起手式（Quick Recovery）

> 最後更新：2026-11-03 12:55 UTC+8（第一百一十 session 收工）

### 近期完成
- **`v0.7.4-pre.2` 發佈**（第一百一十 session，run `41577071236`）：BUG-202 / 204 交付版 linux-acceptance `41578537967` 驗收 → CLOSED
- **BUG-204**（T0800，合併 `2aed2831`）：Linux 打包時 `patchelf` 把 whisper RUNPATH 改成 `$ORIGIN`
- **BUG-203 WONTFIX**（D246）：22.04 語音輸入需 glibc 2.38，寫進 README / CHANGELOG / docs 已知限制
- **BUG-202**（T0799）：AppImage 在 userns 受限時自動加 `--no-sandbox`

### 待辦（依優先序）
1. ✅ ~~`v0.7.4-pre.2` NSIS 重裝驗收~~ → PASS-WITH-WARN（第一百一十一 session 開工判讀）
2. ✅ ~~BUG-159 驗收~~ → T0803 PASS，CLOSED（第一百一十二 session）；🔴 待使用者確認 T0803 意外 codex 登入的帳號端殘留、裁示 WSL shell 快照刪除
3. ✅ ~~`v0.7.4-pre.3` NSIS 重裝驗收~~ → PASS-WITH-WARN（第一百一十二 session 開工判讀）
4. 🟢 PLAN-059 C 不做（CT D568）；PLAN-060 / 061 IDEA；t0757 偶發失敗再發生才開 BUG（D218）

### ⚠️ 鐵則
- **所有 `gh` 指令必須帶 `-R gowerlin/better-agent-terminal`**（L122）
- 版本驗證用 diff / 雜湊，不用 grep（L127）；每次發版：`gh release edit --notes-file` 更版重點 → 更新 `CHANGELOG.md` / `release-note.md` / `README.md` 並 push → Pages 綠燈、首頁版號、`link-check`，才回報已發佈（L150）
- 公開 repo（D176）：工單 / commit / BUG 不寫真名、客戶名、家目錄路徑；push 前跑 `.private/` 的檢查樣式
- 改 `_bug-tracker.md` / `_backlog.md` 不用全檔 `sed`，改完跑 parser 測試（L179）

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（熱區：Open 0 / Fixing 0 / Fixed 1 / Closed 66 / WONTFIX 1，2026-11-03 12:35）｜ Backlog → [_backlog.md](_backlog.md)
- Decision Log → [_decision-log.md](_decision-log.md)（最大 D246）｜ Learnings → [_learnings.md](_learnings.md)（最大 L184）
- 研究報告 Artifact「Herdr 對照 BAT」→ https://claude.ai/artifact/Ybj66gYLkMHZE8xUyyDiEy（私人）
- 網站 → https://gowerlin.github.io/better-agent-terminal/｜ 素材 spec → `e2e/site-media.spec.ts`（`BAT_SITE_MEDIA=1`，輸出 `e2e-media/`）
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)（128 entries）

### 編號起始
- **T0801** / **BUG-205** / **PLAN-062** / **D247** / **EXP-WFMINE-002**（其他 TOPIC 從 001） / **L186** / **CT-T023**

---

## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（另有 `scandnavik` remote；⚠️ gh 預設解析到 upstream，見 L122） |
| **目前版號** | **0.7.4-pre.2**（package.json + lock；D236 `0.7.4-pre.N` 線） |
| **最新 release** | `v0.7.4-pre.2`（2026-11-03T04:28:53Z，run `41577071236`，target `93e6fc8d`：BUG-202 AppImage sandbox 自動降級、BUG-204 Linux whisper RUNPATH）；前一 tag `v0.7.4-pre.1`（2026-11-02T16:34:36Z，run `41480278090`，target `f5d9d4f4`）；更早見 `release-note.md` / `CHANGELOG.md` |
| **目前主軸** | 熱區無進行中工單、無未結 BUG（BUG-159 CLOSED，T0803） |
| **工單最大編號** | **T0800** DONE（BUG-204 Linux whisper RUNPATH，第一百一十 session） |
| **BUG 最大編號** | **BUG-204** CLOSED；熱區 Open 0 / Fixing 0 / Fixed 1（159）/ Closed 66 / WONTFIX 1（203）（2026-11-03 12:35） |
| **PLAN 最大編號** | **PLAN-061** IDEA（非 Windows 的 claude 7501，D229）；PLAN-060 IDEA（macOS 簽章）；PLAN-059 PLANNED；PLAN-029 / 053 / 054 / 055 / 057 DONE |
| **決策最大編號** | **D246**（BUG-203 列為已知限制，第一百一十 session） |
| **EXP 最大編號** | **EXP-WFMINE-001**（📊 CONCLUDED 2026-10-20）；EXP-GPUWHIS-001（CONCLUDED，已歸檔） |
| **塔台版本** | Control Tower **v6.0.0-beta.11**（第一百零九 session 起） |
| **unit test 基線** | **6826 passed / 389 files**（塔台聯合驗證 @ `93e6fc8d`）；typecheck 0 / 0、vite build、legacy 472 / 33、verify-native；pre-release `41577071236` tests job 綠 |
| **舊值** | 瘦身前的長版本見 [`_archive/state-snapshots/2026-Q4-b.md`](_archive/state-snapshots/2026-Q4-b.md)〈基本資訊舊值〉 |

---

## 📊 進度快照

**Phase 1 語音功能**：✅ 實作完成
- 工單 T0001~T0062 執行完畢
- BUG-001~015 全部處理（1 個上游追蹤，1 個關閉，13 個已修復）
- 語音辨識：Whisper CPU + macOS Metal GPU 已啟用
- npm 安全：漏洞從 27 個降至 17 個（減少 48%）

**近期完成**：
- T0060：Metal GPU 加速（macOS）+ npm 安全修復
- T0061：文件結構設計
- T0062：_tower-state.md 瘦身 + 文件系統遷移

**塔台語氣校準**：
- 使用繁體中文
- 偏好決策速度快（選項式回答）
- 務實路線（先求有再求好，接受分階段交付）
- 重視細節，會主動回報 bug

---

## 📝 管理筆記

**2026-04-13 16:20 T0094 批次結案**：
- 所有 FIXED 狀態 BUG 人工驗收通過，批次更新為 CLOSED
- 共 20 筆：BUG-003~006, 008~011, 013~022, 023, 024
- BUG-023（右鍵選單智慧定位，T0092）驗收通過
- BUG-024（CT 面板不監聽索引文件，T0095）驗收通過
- T0091（BUG Detail 工作流 UI）驗收通過
- T0092（右鍵選單智慧定位實作）驗收通過
- Bug Tracker 統計：Open 0 / Fixed 0 / Closed 24

**2026-04-13 13:43 T0086 結案**：
- BUG-002 CLOSED（人工驗收通過）
- BUG-012 CLOSED（人工驗收通過，v0.0.9-pre.1 確認修復）
- Worktree 檢查：無 bug012 worktree 存在（已自行清理或未建立）
- Bug Tracker 統計：Open 0 / Verify 1 / Fixed 18 / Closed 3

**2026-04-13 13:14 Session 結束筆記**：
- 本輪 21 張工單（T0065~T0085），生產力高
- **BUG-012 重大突破**：EXP-BUG012-001 實驗確認根因為 `convertEol: true`，5 輪排除法，2 行修復
- 新功能：VS Code 開啟工作區（T0078~T0082）、BMad Workflow/Epics 頁籤（T0072~T0073）
- 新規範：`_local-rules.md` 加入 EXP-/跨專案工單前綴規範
- v0.0.9-pre.1 pre-release 已推出，BUG-012 待 runtime 驗收後 CLOSED
- worktree `../better-agent-terminal-bug012` 待清理

**2026-04-12 21:43 Session 結束筆記**：
- 本輪 20 張工單，生產力極高
- 新單據系統（BUG/PLAN/Decision 獨立檔 + 歸檔原則）是本專案實驗，成功後推回 BMad-Control-Tower
- `_local-rules.md` 教塔台認識新單據，下輪 session 驗證是否有效
- 4 commits 待使用者 push

---

## 🗂️ 歸檔索引

歷史 Checkpoint（2026-04-11 至 2026-04-12）：
→ [_archive/checkpoint-2026-04.md](_archive/checkpoint-2026-04.md)（2016 行，完整保留）

---

## 🔍 環境快照
> 最後掃描:2026-11-01 01:24 (UTC+8) 第九十九 session **Full Scan**（啟動時快照已 9 天，依 Startup Protocol 第 7 點；前次 Full Scan 2026-10-23 06:50）

| 偵測項 | 狀態 | 備註 |
|--------|------|------|
| 終端環境 | BAT | `BAT_SESSION=1`, port `9876`, workspace `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`, terminal `508fced6…`；無 `BAT_TOWER_TERMINAL_ID` |
| BAT 派發 | ✅ | 五項 dispatch env 齊備（PowerShell 確認）；另有 `BAT_USER_DATA` |
| BAT 安裝版 | ✅ `0.7.2-pre.3` | exe FileVersion `0.7.2-pre.3`；安裝版 `bat-terminal.mjs --version` → `v0.7.2-pre.3` exit 0；Tower `--set-role tower --mode on` exit 0；`bat_whoami` session 名稱 `better-agent-terminal · Tower` |
| BAT_HELPER_DIR | ✅ | `C:\Program Files\BetterAgentTerminal\resources\scripts` |
| BAT debug log | ✅ | `%APPDATA%\BetterAgentTerminal\Logs\debug-20261031-133734.log`（最新） |
| 平台 | Windows 11 | PowerShell 主，Bash tool 並存；node `v26.13.0` / npm `12.2.1` |
| gh CLI | ✅ | **必須帶 `-R gowerlin/better-agent-terminal`**（L122） |
| git remote | 3 個 | `origin`=gowerlin / `upstream`=tony1223 / `scandnavik` |
| git 同步 | ✅ | `main` = `origin/main` @ `21ca9eba`（fetch 後 0 / 0）；工作區乾淨；另有 worktree `../.ct-integration/better-agent-terminal`（detached `4e5f5e7f`）；無 stash |
| 最新 CI / release | ✅ | Pre-Release 2026-10-30 09:02Z success → `v0.7.2-pre.3`；Pages 09:15Z success |
| GitHub open issues | 2 | #20（file link，BUG-174 FIXED，等回報者）；**#22**（2026-10-30 09:54Z 新開，Worker 縮圖停在啟動畫面，回報者用 `0.7.1-pre.9` macOS = BUG-175，`v0.7.2-pre.3` 已修，尚未留言） |
| Control Tower skills | ✅ v5.14.4 | control-tower 5.14.4（第九十九 session 啟動時） |
| 熱區單據 | **T:110 / BUG:39 / PLAN:21 / EXP:1** | BUG：FIXED 28 / CLOSED 11（與 `_bug-tracker.md` 一致）；PLAN：DONE 10 / DROPPED 2 / IDEA 8 / PLANNED 1 |
| 非終態工單 | 無 | |
| 最大編號 | **T0714 / BUG-175 / PLAN-056 / D189 / L177 / CT-T022** | 下張：T0715 / BUG-176 / PLAN-057 / D190 / L178 / CT-T023 |
| unit test / typecheck | 未重跑 | 最近：6130 passed / 343 files、typecheck 0 / 0（@ `ae4602ed`，第九十七 session） |
| state 檔 | ⚠️ 33.1 KB | 超 30 KB 軟警告；`_decision-log.md` 234,033 bytes（< 400 KB 預算）；季檔 `2026-Q4.md` 190,427 bytes（接近 200 KB 切割點）、INDEX 115 列 |
| 設定來源 | project | `_tower-config.yaml`（auto-session **on**，`yolo_max_retries: 1`，`auto_commit: on`，`worker_auto_close: done`，`worker_close_delay: 10`） |
| 塔台版本 | v5.14.4 | control-tower skill（第九十九 session） |

> **Drift / 注意事項**:
> 1. ✅ ~~D094 mac installer 280 MB cap 長期超標（L130）~~ → D146 取代（每平台 ≤ 320 MiB、zip ≤ 450；pre.4 全數符合）
> 2. ⚠️ `_ct-workorders/_archive/workorders/T0293-review-report.md` 含 2 個 NUL 位元組（既有；2026-10-16 隨 L132 處置搬入歸檔）
> 3. ✅ ~~**L132**：`T0292/T0293/T0298/T0302-*-report.md` 命名越界~~ → 2026-10-16 使用者決定搬入 `_archive/workorders/`
> 4. ⚠️ **L129**：含反斜線的內容一律走 Write 工具
> 5. ⚠️ **L136**：VS Code Insiders 可能鎖 `release\win-unpacked\resources\app.asar`
> 6. ⚠️ **發版綁定**：T0435 ↔ T0437、T0453 ↔ T0458（皆已同在 pre.2 之後的版本內）

---

## YOLO 歷程

> 本區段依 `references/yolo-mode.md` § 「`_tower-state.md` 新增 `## YOLO 歷程` 區段」規格產生。逐筆紀錄已歸檔至 `_archive/state-snapshots/2026-Q4.md`（INDEX 69 / 70 / 72）。

### 計數器（第五十六 session，已收工）

- 連續 FAILED: 0 / 1
- 本 session yolo 派發：5（T0462-T0466 全 DONE，皆一次啟動成功）
- 斷點觸發：A×0, B×0, C×8（scope 內，塔台直接裁決）、使用者中斷×0

### 計數器（第五十五 session，已收工）

- 連續 FAILED: 0 / 1
- 本 session yolo 派發：45 張完成（另重派 2、ct-done 補救 1）
- 斷點觸發：A×0, B×0, **C×17**（scope 內，05:55 起依使用者授權由塔台直接裁決）、使用者中斷×0
- 使用者修正：1（Worker 啟動檢查 30 秒 → ≥ 3 分鐘）

### 歷史 Session（摘要）

- 2026-11-03 第一百一十 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0800 `started:`、DONE、無提問；授權 push `ct/T0800` 在 GitHub 驗證；`worker_auto_close` 回收 1 次；`v0.7.4-pre.2` 發佈
- 2026-11-03 第一百零九 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0797–T0799 共 3 張全部 `started:`、DONE、無提問；T0798 / T0799 授權 push `ct/*` 分支在 GitHub 迭代；`worker_auto_close` 回收 3 次；無發版
- 2026-11-02 第一百零八 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0792–T0796 共 5 張全部 `started:`、DONE、無提問；T0792 / T0793 並行；`worker_auto_close` 回收 5 次；`v0.7.4-pre.1` 發佈
- 2026-11-02 第一百零六 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0787–T0790 共 4 張全部 `started:`、DONE；T0788 / T0789 並行；結構化提問 1 次（T0790 Q-1 `--answer`）；T0788 Renew #1（CT 回覆）；`worker_auto_close` 回收 4 次；`v0.7.3-pre.8` 發佈
- 2026-11-02 第一百零四 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0750–T0778 共 29 張全部 `started:`、DONE；T0770–T0773 四張並行；`worker_auto_close` 回收；`v0.7.3-pre.2`–`pre.5` 發佈
- 2026-11-01 第一百零一 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0720–T0726 全部 `started:`、無提問，T0720 / T0721 / T0722 並行；`worker_auto_close` 回收 7 次；`v0.7.2-pre.6` 發佈
- 2026-11-01 第一百 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0717–T0719 全部 `started:`、依序執行；結構化提問 2 次（T0717 Q-1 / Q-2，`--answer` exit 0 ×2，D192）；`worker_auto_close` 回收 3 次；`v0.7.2-pre.5` 發佈（首發 CI 打包失敗 → BUG-176 / T0719 → 重發）
- 2026-11-01 第九十九 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0715 / T0716 `started:`、無提問；`worker_auto_close` 回收 2 次；`v0.7.2-pre.4` 發佈
- 2026-10-30 第九十八 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0714 `started:`、無提問；`worker_auto_close` 回收 1 次；`v0.7.2-pre.3` 發佈
- 2026-10-30 第九十七 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0710–T0713 全部 `started:`、無提問，T0711 / T0712 並行；`worker_auto_close` 回收 4 次；`v0.7.2-pre.1` / `pre.2` 發佈
- 2026-10-26 第九十五 session：auto-session on；無派工；`*sync` / `*archive` 138 張；無發版
- 2026-10-25 第九十四 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0703–T0707 全部 `started:`、無提問，T0704 / T0705 並行；`worker_auto_close` 回收 5 次（T0704 / T0705 先改 FIXED → DONE，L177）；`v0.7.1-pre.8` 發佈
- 2026-10-23 第九十一 session：無派工；跨 session 回覆 BMad-Guide 塔台 2 件；無發版
- 2026-10-23 第九十 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0699 `started:`、無提問；`worker_auto_close` 回收 1 次；無發版
- 2026-10-22 第八十九 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0695–T0698 全部 `started:`（T0695 / T0696 各重派 1 次，CT-T022 驗收）；結構化提問：T0695 / T0696 走備援（`worker_question_timeout: 0`）、T0698 Q-1 `--answer`；`--close-worker` 重派前 2 次（exit 0 / 3）、收單 4 次；`v0.7.1-pre.6` 發佈
- 2026-10-20 第八十七 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0673 `started:`（Worker 內跑 Workflow，39 agents）；結構化提問 1 次（Q-1，塔台漏接、使用者在 Worker 分頁直接答）；`worker_auto_close` 回收 1 次；無發版
- 2026-10-19 第八十六 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0670–T0672 全部 `started:`，T0670 / T0671 並行；結構化提問 1 次（T0672 Q-1 `--answer`，D174）；`worker_auto_close` 回收 3 次；`v0.7.1-pre.4` 發佈
- 2026-10-19 第八十五 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0666–T0669 全部 `started:`，無並行、無提問；`worker_auto_close` 回收 4 次；`v0.7.1-pre.3` 發佈
- 2026-10-18 第八十四 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0663–T0665 全部 `started:`，T0663 / T0664 並行；無提問；`worker_auto_close` 回收 3 次；無發版
- 2026-10-18 第八十三 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0646–T0662 共 17 張全部 `started:`，最多 3 張並行；結構化提問 1 次（T0657 Q-1 `--answer`）；`worker_auto_close` 回收 17 次；`v0.7.1-pre.2` 發佈
- 2026-10-18 第八十一 session：auto-session on，per-dispatch `--mode yolo --no-interactive`（T0637 `--agent codex`）；T0637–T0644 全部 `started:`（codex 首次 `started: <時間>`）；T0642 / T0644 並行、T0644 結構化提問 1 次；`worker_auto_close` 回收 8 次；`v0.7.1-pre.1` 發佈
- 2026-10-18 第八十 session：auto-session on，per-dispatch `--mode yolo --no-interactive`（T0629 `--agent codex`）；T0624–T0636 全 DONE、claude 皆一次啟動（`started:`），codex T0629 `unknown`（pre.8 預期）；T0630 首派被使用者停掉後依 D162 重派；`worker_auto_close` 回收 12 次（T0627 / T0630 首派分頁使用者手動關）；`v0.7.0-pre.9` 發佈
- 2026-10-18 第七十九 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0614–T0623 皆一次啟動（T0617 / T0618 探針設計 Renew 各 1 次、T0618 以 ct-done 補結）；最多 2 張並行；`worker_auto_close` 回收 12 次；無發版
- 2026-10-18 第七十八 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0612（探針，使用者目視）/ T0613 皆一次完成；`worker_auto_close` 回收 2 次；`v0.7.0-pre.8` 發佈
- 2026-10-18 第七十七 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0601–T0611 皆一次啟動；`v0.7.0-pre.7` 發佈
- 2026-10-18 第七十六 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0596–T0600 皆一次完成（T0597 首派 `create-rate-limited` 重派 1 次），最多 2 張並行；`worker_auto_close` 回收 5 次；`v0.7.0-pre.5` / `pre.6` 發佈
- （更早的摘要已移入 `_archive/state-snapshots/`，見 INDEX）
