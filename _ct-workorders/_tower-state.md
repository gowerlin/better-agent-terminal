# Tower State — better-agent-terminal

> 最後更新：2026-04-18 下半場第六 session（PLAN-018 全綠 + v4.3.x skill 治理 + 目錄 rename + *evolve 5 條 learning）

---

## 🛏 本 Session 退出快照（2026-04-18 下半場第六 session，PLAN-018 + v4.3.x 收尾）

**退出原因**：主線任務全部完成（PLAN-018 資安加固三張 + CT-T005/T007 skill 治理 + 跨 repo rename + skill sync）。本 session 壓縮執行 16x（估 ~13h、實際 ~80min）。

**本 session 成果**（~80min，5 工單 + 2 ops）：

**PLAN-018（資安加固，DONE）**：
- `6b9de1f` T0182 — TLS + fingerprint pinning + safeStorage（12min/估 5.5h，27x）
- `b12690f` T0183 — path sandbox + image cap（12min/估 1-2h，5-10x，12 unit tests）
- `c7c7fb3` T0184 — brute-force + reconnect backoff + mutex（8min/估 1-1.5h，7-11x，15 unit tests）
- version.json → `5d9f486`（upstream 追平）

**Skill 治理（v4.3.x，DONE）**：
- `3d851a2` CT-T005 — 塔台 skill `--mode` flag + Worker YOLO banner（11min/估 35min）
- `0c2b938` CT-T005 fix — Step 0 YOLO banner 只在 BAT 環境顯示
- `23719c0` CT-T005 docs — CHANGELOG 補 Step 0 BAT gating 說明
- `3de0840` CT-T007 — 版號治理（frontmatter + 面板 + *sync 一致性檢查）
- `cc7e689` chore — 目錄 rename BMad-Control-Tower-v4.2.0 → v4.3.0
- Tag **v4.3.1** 打在 cc7e689（additive，保留既有 v4.3.0）
- Push dev-main + tag 完成
- 8 skill sync 到 `~/.claude/skills/` 完成，所有 frontmatter `version: "4.3.0"`

**閉環事件**：
- ✅ BUG-041 CLOSED（Phase 2.4 實作完成，v4.3.0 dogfood 通過）
- ✅ PLAN-018 DONE（資安三張全綠）
- ✅ v4.3.0/v4.3.1 正式發布（monorepo `BMad-Control-Tower-v4.3.0/`）

**L061/GP042 Worker time 連 14 hit（升 ⭐ proven）**：
- 本 session 新增 5 次全部 3-27x 壓縮
- 累計 14 次（全部 3-27x）
- Playbook 候選：研究報告先行 → 實作壓縮率 0.1-0.2x 常態

**`*evolve` 批次寫入**（5 條）：
- 🌐 Global `~/.claude/control-tower-data/learnings/patterns.md`：
  - **GP042 UPDATE**（Worker time 連 14 次實證，升 ⭐ proven）
  - **GP048** 版號治理 SSOT（frontmatter + 面板 + *sync 一致性檢查）
  - **GP049** 跨 repo rename 安全模式（pre-flight + additive tag + lock retry）
- 🏠 Project `_ct-workorders/_learnings.md`：
  - **L068** 塔台自主 ops 執行邊界
  - **L069** Upstream sync 設計分歧以權威規格為準

**`*sync` 結果**：
- T/CT-T：40 張（28 DONE）
- BUG：6 張（全 CLOSED）
- PLAN：15 張（1 DONE 新增：PLAN-018）
- EXP：2 張（1 CONCLUDED）
- ⚠️ 部分工單元資料格式不一致（狀態欄位解析失敗）→ L070 候選：metadata 格式自動化正規化（延後，不阻擋）

**恢復指引**（下次 `/control-tower` 啟動時）：

1. Fast Path 載入本快照（面板預期顯示 **v4.3.0**，不再 v4.1）
2. 塔台派發預期帶 `--mode yolo` flag
3. Worker `/ct-exec` 啟動顯示 🚨 YOLO MODE ACTIVE banner（不再降級提示）
4. 下一輪可選：
   - 實機驗收 PLAN-018（TOFU / QR / brute-force wscat / path sandbox 跨機）
   - 處理既有 tsc --noEmit 技術債（PLAN-019 IDEA）
   - 實機驗收 v4.3.0/v4.3.1 新 skill（檢查 `*sync` 版號一致性輸出）

**待處理事項**：
- 🟡 本 repo（better-agent-terminal）本 session 多 commits 未 push（PLAN-018 三張 + 可能的 meta 改動）
- 🟡 Monorepo 已 push（包含 CT-T005/T007 + rename + v4.3.1 tag）
- 🟡 L070 候選：工單 metadata 格式正規化（不同工單狀態欄位格式不一，*sync 解析失敗）

**YOLO 歷程追加**（本 session）：
- `[~20:05] 啟動` 塔台 Fast Path 恢復，*rescan 更新快照
- `[20:12-20:24] 派發+完成` T0182 — TLS 大張，yolo 閉環首次 5.5h 估時完成
- `[20:36-20:48] 派發+完成` T0183 — path sandbox 並行
- `[20:52-21:00] 派發+完成` T0184 — PLAN-018 收官
- `[21:05] Renew #1` CT-T005 加 YOLO banner 需求
- `[21:16] 建立` CT-T007 版號治理工單（Q&A 觸發）
- `[21:19-21:30] 派發+完成` CT-T005（跨 repo DELEGATE）
- `[21:34-21:40] 派發+完成` CT-T007（跨 repo DELEGATE）
- `[~21:45] ops 執行` 使用者授權塔台自主 rename + tag + push + sync
- `[~21:50] *evolve+*sync` 5 條 learning 寫入 + 索引摘要更新

---

## 🛏 前次 Session 退出快照（2026-04-18 下半場第五 session，雙 BUG 閉環 + PLAN-018 拆分）

**退出原因**：*resume 實例驗證目標達成（v4.3.0 Worker skill dogfood PASS），T0182-T0184 工單已備妥但不派發（避免 context 溢出），下 session 接著派 T0182。

**本 session 成果**（~1.5h，8 個 commits）：
- `23d75f3` T0175 DONE（研究報告）
- `6282ea0` T0176 DONE（BAT env 注入）
- `7e1af84` BUG-041 OPEN
- `149153c` CT-T004 DONE
- `51a4a71` BUG-040 FIXED 狀態更新
- （`fb1b095` T0179 DONE — Phase 2.1 研究）
- （`8558b73` T0180 DONE — Phase 2.2 BAT CT_MODE/CT_INTERACTIVE 注入）
- （`83e5986` T0180 回報補 commit hash）
- （`4dbed7d` CT-T006 DONE — Phase 2.3 v4.3.0 Worker skill，monorepo）
- （`4822dbd` T0181 DONE — PLAN-018 拆分研究報告）
- **待 commit**：BUG-040/041 CLOSED 狀態、T0182/T0183/T0184 工單、本快照、L067 project learning、GP044-047 global patterns

**閉環事件**（本 session 主線）：
- ✅ **BUG-040 CLOSED**（Phase 1 完結，workspace 錯派修復，CT-T004 v4.2.2）
- ✅ **BUG-041 CLOSED**（Phase 2.1-2.3 完結，Worker 無狀態化 v4.3.0；Phase 2.4 CT-T005 DISPATCHED 但不阻塞 CLOSED）
- ✅ **PLAN-018 拆分研究** — T0181 產出 T0182/T0183/T0184 完整規格（GP044 標竿）
- ✅ **v4.3.0 Worker skill dogfood PASS** — T0181 派發時升級提示正確顯示，fallback ask 模式運作

**L061/GP042 Worker 估時係數連六 hit**：
- T0175: 6 min / 30 est (5x)
- T0176: 6 min / 30-45 est (6-7.5x)
- T0179: 15 min / 60-90 est (4-6x)
- T0180: 5 min / 30 est (6x)
- CT-T006: 6 min / 30 est (5x)
- T0181: 9 min / 60-120 est (7-13x)
- **累計 9 次實證**（加 T0168/T0169/T0170/T0172），GP042 強化升 🟢
- Playbook 候選：工單預估工時 × 0.2 係數（文檔/規格類）

**塔台決策（PLAN-018 Q1/Q2/Q3，使用者採 Worker 推薦）**：
- **Q1.A**：`safeStorage` Linux fallback plaintext + warn
- **Q2.A**：bind-interface tailscale 無介面 fail-closed error
- **Q3.是**：ProfilePanel fingerprint 首次連線允許空白 + TOFU

**`*evolve` 批次寫入**（6 條）：
- 🌐 Global `~/.claude/control-tower-data/learnings/patterns.md`：
  - **GP042 UPDATE**（Worker time 連 9 次實證，升 🟢）
  - **GP044** 研究型工單品質標竿（精確行號 + 三欄 AC + diff 片段）
  - **GP045** 研究報告 grep 覆蓋率缺口與 Worker 自補現象
  - **GP046** 技術債 Phase 分階段插隊 pipeline
  - **GP047** 「禁止 X」設計約束的 grep 命中空驗證
- 🏠 Project `_ct-workorders/_learnings.md`：
  - **L067** payload-pty-env 管線半成品為 BUG-040 技術債根源

**恢復指引**（下次 `/control-tower` 啟動時）：

1. Fast Path 載入本快照
2. 確認 `auto-session: yolo` + `yolo_max_retries: 1` + `auto_commit: on` 仍生效
3. 下一輪優先級：
   - 🔴 **T0182** TLS + fingerprint pinning + safeStorage（5.5h，PLAN-018 第一張，派發即開工）
   - 🟡 **CT-T005** DISPATCHED 待執行（跨 repo，補完 yolo 閉環最後一片拼圖，完工後 v4.3.0 Worker 不再顯示升級提示）
   - 🟢 T0183 + T0184（PLAN-018 剩餘 2 張，依賴 T0182 完成）
4. PLAN-018 完成路徑：
   - Day 1：T0182（5.5h，序列）
   - Day 2：T0183（1-2h 並行）+ T0184（1-1.5h，等 T0182）+ version.json sync 到 `5d9f486`
   - T0184 DONE → PLAN-018 IN_PROGRESS → DONE
5. CT-T005 若使用者決定派發：切到 `BMad-Control-Tower/BMad-Control-Tower-v4.2.0/` repo，開新 session `/ct-exec CT-T005`

**待處理事項**：
- 🟡 本地多 commits 未 push（塔台這端 4 個 + monorepo `4dbed7d`/`4822dbd` 已 push 到 Forgejo dev-main）
- 🟡 下 session 派 T0182 前，建議先 review 研究報告 §C（5.5h 工時大 + 雙端測試）
- 🟡 `_tower-state.md` YOLO 歷程區段本 session 未即時追加事件（整批於本快照總結）

**YOLO 歷程追加**（本 session 摘要，詳見各事件）：
- `[19:43-19:52] 派發+完成` T0181 research — v4.3.0 dogfood 首例，升級提示正確顯示（斷點 A regex 通過）
- `[19:43] dogfood 觀察 #1` Worker 啟動訊息：「⚠️ 塔台未傳 `--mode` flag，降級為 ask」
- `[19:35] BUG-041 CLOSED` 使用者決定核心完工即結案（CT-T005 DISPATCHED 不阻塞）
- `[19:22] 完成` CT-T006 DONE `4dbed7d` — v4.3.0 Worker skill 無狀態化，10/10 AC，D062 grep 命中空驗證
- `[19:01] 完成` T0180 DONE `8558b73` — BAT `--mode` / `--interactive` env 注入
- `[18:52] 完成` T0179 DONE `fb1b095` — yolo flag 傳遞協定研究（620 行報告）
- `[18:22] BUG-040 CLOSED` 使用者確認跨 workspace 實測通過
- `[*evolve+*resume 後]` 6 條 learning 寫入、T0182-T0184 工單建立、本快照更新

---

## 🛏 前次 Session 退出快照（2026-04-18 下半場第四 session，Phase 1.1 完成）

**退出原因**：使用者重新 build + 部署新版，驗收 T0176 的 AC-1~AC-6（需 app 重啟才能驗）。

**本 session 成果**（~30 min，2 commits 未 push）：
- `23d75f3` T0175 DONE（BAT_WORKSPACE_ID 注入研究報告，6 min 完成／預估 30）
- `6282ea0` T0176 DONE（BAT 端 env 注入實作，6 min 完成／預估 30-45）
- D062 寫入決策日誌（**Worker 無狀態原則** — BUG-040/041 修復的共同設計依據）
- BUG-041 建立（yolo gap 現狀記錄，Phase 2 前保持 OPEN）

**Phase 1（BUG-040 修復）進度**：
- ✅ **Phase 1.1** — T0176（BAT 端 env 注入）Worker 自測 AC-7 編譯通過，12 處改動、5 files
- ⏸ **AC-1~AC-6 使用者驗收**（本輪暫停點）：需重新 build + 重啟 BAT + 開新塔台 session 跑 `echo $BAT_WORKSPACE_ID`
- 📋 **Phase 1.2** — CT-T004 DELEGATE（塔台 skill 加 `--workspace`）：等 AC 通過才派

**dogfood 實證結果**：
- ✅ BUG-041（yolo gap）**已確證** — T0176 完成後 Worker 走 Step 11 剪貼簿，使用者手動打「T0176 完成」通知塔台
- 🔍 BUG-040（workspace 錯派）— Worker commits 落在正確 repo，未觀察到顯性錯派（待 AC-3 跨 workspace 測試驗證）
- 📊 L061 連續再實證 — T0175/T0176 都是 6 min 完成（研究報告細緻度 × Worker 熟悉度）

**Learning 候選累積**（Phase 1 CLOSED 後 `*evolve` 批次）：
- **L067**：研究型工單品質標竿（T0175 模板化：精確行號 + diff + AC 對照）— Global 候選
- **L068**：研究報告 grep 覆蓋率缺口（應 full grep 而非選擇性摘要，T0175 漏列 WorkspaceView.tsx 2 處）— Global 候選
- **L069**：payload-pty-env 管線半成品為 BUG-040 技術債根源（跨層欄位應一次貫通）— Project 候選

**恢復指引**（下次 `/control-tower` 啟動時）：

1. Fast Path 載入本快照
2. 塔台啟動時自動檢查 `echo $BAT_WORKSPACE_ID`：
   - **非空**（uuidv4 格式）→ 部署成功，提醒使用者完成 AC-2~AC-6 驗收
   - **空字串** → 部署失敗或未生效（檢查：使用者是否 build 完重啟？是否開新 session？）
3. 依使用者 AC 驗收結果決策：
   - **AC-1~AC-6 通過** → 派 **CT-T004** DELEGATE（塔台 skill 加 `--workspace "$BAT_WORKSPACE_ID"`）→ Phase 1.2 啟動
   - **AC 失敗** → T0176 退回 FIXING，重派修復工單
4. CT-T004 閉環 → BUG-040 FIXED → VERIFY（使用者實測跨 workspace）→ CLOSED
5. BUG-040 CLOSED 後啟動 Phase 2：派 T0179 研究 BUG-041 yolo gap

**待處理事項**：
- 🟡 本地 2 commits 未 push（`23d75f3` T0175 + `6282ea0` T0176）— 使用者決定 push 時機
- 🟡 `*sync` 重建 `_bug-tracker.md` 納入 BUG-041（本 session 未做，下 session 可一起處理）
- 🟡 上 session 遺留 2 commits（`c73a23b` + `49444ed`）仍未 push

**下一輪優先級**：
- 🔴 **AC-1~AC-6 驗收**（使用者操作 → 回報結果）
- 🔴 **CT-T004 DELEGATE**（AC 通過後立即派）
- 🟡 Phase 2 BUG-041 啟動（Phase 1 CLOSED 後）
- 🟢 BUG-040 與 BUG-041 均遵循 D062 原則

**YOLO 歷程追加**（本 session）：
- `[17:08] 派發` T0175 research（BAT env 注入設計）— yolo 自動派發成功
- `[17:14] 完成` T0175 DONE — Worker 自填回報區，system-reminder 偵測檔案修改
- `[17:20] Phase 0` D062 決策記錄 + BUG-041 開單 + Plan C 精細化
- `[17:31] 派發` T0176 implementation（BAT env 注入實作）
- `[17:37] 完成` T0176 DONE — **BUG-041 確證**（Worker 走 Step 11 剪貼簿，使用者手動通知）
- `[17:40] 暫停` 等 AC-1~AC-6 使用者驗收（本 session 自然同步點，非斷點觸發）

---

## 🛏 前次 Session 退出快照（2026-04-18 下半場第三 session，收工）

**退出原因**：使用者主動收工（本 session 成果豐厚，到達自然結束點）。

**本 session 成果**（~1h，2 個 commit）：
- `c73a23b` CT-T003 PARTIAL（Worker 完成規格修改 + CHANGELOG）
- `49444ed` 塔台自主 commit（session 收尾批次：CT-T003 DONE + *evolve + *archive + config）
- **2 commits 未 push**（使用者自行決定）

**完整閉環事件**：
- ✅ CT-T003 DONE（yolo spec drift 閉環，v4.2.1 tag 發布在 `1d02727`，生產塔台 sync 驗證通過）
- ✅ `*evolve` 批次萃取 L057-L066（9 條 → Global GP038-043 六條 + Project L062/L063/L065/L066 + L064 閉環註記）
- ✅ `*archive --dry-run` 測試（L066 發現 IDEA 節點活躍引用鎖現象）
- ✅ Config 收尾（`archive_days: 1→7`, `auto_commit: ask→on`）
- ✅ YOLO 歷程追加 5 條事件（[派發]/[部分完成]/[完成]/[evolve]/[archive-test]）

**Learning 管線升級**：
- Global: +6 GP（GP038-043）— GP039/GP042 直接升 🟢（2+ 次實證）
- Project: +3 L（L062/L063/L066）+ L064/L065 補充
- 新發現：L066 歸檔引用鎖現象（CT 通用 learning 候選）

**恢復指引**（下次 `/control-tower` 啟動時）：

1. Fast Path 載入本快照
2. 塔台讀 `_tower-config.yaml` → `auto-session: yolo` + `auto_commit: on` 皆啟用，警語面板應自動顯示
3. 熱區仍有 50 張單據（`archive_days: 7` 預設下，下次歸檔需 2026-04-25 後才有新候選）
4. BUG-040 OPEN 仍待處理（workspace 錯派，T0173 研究結論已在）
5. PLAN-018 PAUSED（Remote 資安加固，可 `*resume` 接回）

**下一輪候選**（優先級待定）：
- 🔴 **BUG-040** — bat-terminal workspace 錯派（T0173 研究已完成，可直接派實作工單）
- 🟡 **PLAN-018** — Remote 資安加固（PAUSED 中，yolo mode 實戰驗證完畢可接回）
- 🟢 **PLAN-004** — GPU Whisper 加速（Win/Linux）
- 🟢 **PLAN-009** — Sprint 儀表板 UI
- 🟢 **PLAN-019** — TypeScript 債務清理

**待處理事項**：
- 🟡 本地 2 commits 未 push（`c73a23b`, `49444ed`）— 使用者決定何時 push
- 🟡 global `~/.claude/control-tower-data/patterns.md` 已追加 GP038-043（非 git repo，無需 commit，但跨機器同步機制未知）
- 🟡 CT v4.2.1 tag 已 push 到 Forgejo `sxnas:gower/BMad-Guide.git`

---

## 🛏 前前次 Session 退出快照（2026-04-18 下半場第二 session，Phase 0-1 完結）

**退出原因**：T0174 Phase 0-1 跑完，Phase 2-6 context 空間不足，下 session 繼續。

**本 session 成果**（4 個 commit）：
- `f7672f6` PLAN-020 yolo mode 閉環 meta (5/6)
- `37e421c` BUG-040 OPEN
- `746b4a6` T0173 新建 + T0174 改寫為三步方案 Step 1-2
- `4ec9056` yolo config 持久化（auto-session: on → yolo, yolo_max_retries: 1）

**T0174 進度**：
- ✅ Phase 0 前置自檢（6/6 全綠，含「`BAT_TOWER_TERMINAL_ID` 空是正常」判定修正）
- ✅ Phase 1 啟用觀察（警語面板完整 + 持久化）
- 📋 Phase 2-6 待下 session

**Learning 候選新增**：
- **L063**：`yolo-mode.md` 啟動警語規格未涵蓋 session-only vs persisted 差異提示（UX 缺口）

**恢復指引**（下次 `/control-tower` 啟動時）：

1. Fast Path 載入本快照
2. 塔台讀 `_tower-config.yaml` 發現 `auto-session: yolo` → **自動顯示 YOLO MODE ACTIVE 警語面板**（這是 Phase 1 的 session-to-session 延續驗證）
3. 若 user 說「繼續 T0174」或「跑 Phase 2」→ 直接派 T0173（BUG-040 研究）為首張 dogfood 場景
4. 派發命令（yolo 模式，BAT 內部終端）：
   ```
   node scripts/bat-terminal.mjs --notify-id $BAT_TERMINAL_ID claude "/ct-exec T0173"
   ```
5. 觀察點：派發面板完整、1-2s 緩衝、BAT 新分頁開啟、`bat-notify.mjs --submit` 送 Enter（Worker 不用手按）

**下 session 執行計畫**：
1. 觀察塔台啟動時 yolo 警語是否自動顯示（Phase 1 延續驗證）
2. 派 T0173 → Phase 2-3（派發面板 / BAT 整合 / Worker 自動回報）
3. T0173 DONE → Phase 4 下一張判定觀察（預期：無明確下一張，塔台應報「yolo 工作隊列清空」）
4. Phase 5 斷點 C 實測（使用者打字「停」）
5. Phase 6 驗證 `_tower-state.md` 新增 YOLO 歷程區段

**T0174 剩餘 Phase 規格**：見 `T0174-dogfood-yolo-mode-plan018.md`（Phase 0-1 回報已填）。

**dogfood 結束後收尾**：
- 評估是否回滾 `auto-session: yolo → on` + 移除 `yolo_max_retries`（視實測結果）
- T0174 DONE → PLAN-020 整體 DONE
- `*evolve` 萃取 L057-L063

**Learning 候選累積**（下次 `*evolve` 處理）：
- **L057**：跨專案 DELEGATE 長時差異 + Renew 前置驗證（F-11 守衛價值）— D061 實戰
- **L058**：對方塔台自行吸收 pattern（CP-T0094/95 = CT-T001 先例複製）
- **L059**：BUG 觀察對照表證據法（BUG-040 兩次事件對照推根因方向）
- **L060**：條件式拆單策略（T0167 Q2 未決時「三分支平行」讓工單 1 不阻塞）
- **L061**：Worker 實際工時遠低於估時（T0168=7min/T0169=4min/T0170=6min/T0172=2min 連續）
- **L062**：對方塔台實作比 Worker 草稿更嚴謹（yolo 硬鉤子失敗不跑 Step 11，狀態重複避免）

---

## 🎉 本 Session 成就（2026-04-18 下半場）

**PLAN-020 yolo autonomous mode**：插隊 + 閉環 ~3.5h（原估 7-11h，含 CT 跨專案整合 + 對方塔台自行吸收加速）

**產出**：
- 7 張本專案工單 DONE（T0166-T0172）
- 1 張跨專案 DELEGATE DONE（CT-T002，v4.2.0 tag 落地）
- 2 張本地草稿檔 + 1 份研究報告
- 1 PLAN + 3 決策 + 2 BUG（039 CLOSED / 040 OPEN）
- 對方塔台 v4.2.0 發布（`~/.claude/skills/` 已同步）

---

## 🔄 本 Session 焦點（2026-04-18 12:18）— PLAN-020 yolo 模式插隊（D059）

**插隊原因**：使用者觀察 `auto_session: on` 反向通道（Worker→塔台）未觸發，提出 `yolo` 模式提案 — Worker 自動送出 + 塔台自主決策多工單。

**關鍵技術發現**：
- ✅ `scripts/bat-notify.mjs` 已存在（雙管道：UI toast + pty:write 預填）
- ✅ `scripts/bat-terminal.mjs` 已存在（開新 Worker terminal）
- ❌ 當前塔台 session `BAT_TOWER_TERMINAL_ID=`（空字串）— 推測是 on 反向不觸發的根因
- ❌ `pty:write` 不送 `\r`（只預填，使用者仍要手按 Enter）

**對齊結果（Q1-Q3）**：
- Q1.B：開 PLAN-020 + 立刻派研究工單
- Q2.B：skill + BAT 同時改（整合 bat-notify 基礎設施）
- Q3.C：PLAN-018 冷凍，yolo 完成後用 PLAN-018 剩下 4 張工單作驗證

**已建立**：
- 📋 PLAN-020 🔴 High — yolo autonomous mode
- ✅ T0167 research DONE（2026-04-18 12:25-12:39，14 分鐘，含 1 輪互動）
- 📊 `_report-plan-020-yolo-feasibility.md`（Worker 研究報告）
- 📝 D059 + D060 決策已記錄

**T0167 關鍵結論**（糾正假設）：
- env 注入鏈路**完整**（`BAT_TOWER_TERMINAL_ID` 實測有值）
- 真正根因：ct-exec Step 8.5 標「可選/靜默跳過」+ `pty:write` 不加 `\r` + Step 11 剪貼簿蓋過 Step 8.5
- 5 張條件式拆單，已收斂為單一分支（D060 採 Q2.A）

**對齊結果（Q1-Q3）**：
- Q1.A：接受 Worker 5 張拆單建議
- Q2.A：資訊來源採研究工單 D 區段（D060）
- Q3.B：先 commit meta 批次，再派工單 1

### PLAN-020 進度
- ✅ **T0168** DONE（12:53-13:00，7 分鐘，commit `c4b2a19`）— `bat-notify.mjs --submit`
- ✅ **T0169** DONE（13:01-13:05，4 分鐘，commit `488ad93`）— Worker skill 草稿
- ✅ **T0170** DONE（13:15-13:21，6 分鐘，commit `ff678cc`）— Tower skill 草稿
- ✅ **CT-T002** DONE（13:27-15:08，跨 3 session）— 技術實作 `bfc4ba5` + 對方塔台已吸收（CP-T0094/95）+ Renew #2 補 v4.2.0 tag
- ✅ **T0171** DONE（13:50-14:41，51 分鐘，commits `2abcd0f`/`b00012d`/`604e154`）— BUG-039 修完
- ✅ **CT-T002 Renew #2** DONE（14:55-15:08）— v4.2.0 tag 已打於 `d65f451` 並 push 成功
- 🔄 **T0172** 派發中（14:55）— 驗證 yolo skill sync（並行 CT-T002）
- 📋 **T0173** TODO（已建單）— BUG-040 研究（純讀碼 research，1-1.5h）→ T0174 dogfood 首張場景
- 📋 **T0174** TODO（已改寫為三步方案 Step 1-2，30-45min 觀察）— yolo 機制 dogfood（Step 3 併入 PLAN-018 `*resume`）

### CT-T002 Renew 歷程
- #1（13:55）push Forgejo + snapshot → Worker F-11 守衛觸發（前提失真，對方塔台已吸收）
- #2（14:55）補打 v4.2.0 tag → 單一動作收尾

### 插隊 BUG
- 🚫 **BUG-039** 🟡 Medium CLOSED（14:45，Q1.A 直接關閉）— `bat-terminal.mjs --help` silent passthrough 已修
- 🐛 **BUG-040** 🟡 Medium OPEN — `bat-terminal.mjs` workspace 錯派（疑似 BUG-031 regression，Q2.B 不阻塞）

### T0169 關鍵產出
- Worker 4 分鐘完結，遠低於 1-1.5h 估時
- 4 種狀態字串鎖定：`T#### 完成` / `部分完成` / `失敗` / `需要協助`
- FIXED → 完成；BLOCKED → 需要協助（併入三類簡化塔台 regex）
- 硬鉤子 yolo 下失敗**阻斷工單 DONE**，避免塔台死鎖
- 相容性：舊版 BAT（無 --submit）自動降級為 on + 警告

### T0168 驗收摘要
- A1/A3/A4/A5 全綠（程式碼驗證 + 互斥檢查實測）
- **A2 待使用者實機互測**（雙終端 A/B 送 `echo ok` 驗證 `\r` 生效）— 子 session 自測會污染自己 stdin，Worker 合理跳過
- B1 空字串由既有檢查擋下，B2 用 `/[\r\n]$/` 防雙重結尾

### 最大編號更新
- 工單：T0169（+2，T0168 + T0169）
- PLAN：PLAN-020
- 決策：D060

---

## ⏸ PAUSED — PLAN-018 Remote 資安加固（2026-04-18 07:52 冷凍）

**冷凍點**：T0166 研究 DONE，12 項衝突盤點完成，正對齊 Q1（派發順序）/ Q2（C1/C2/C3 決策時機）
**恢復條件**：PLAN-020 yolo 完成驗收後，`*resume` 回復 PLAN-018
**資料完整性**：`_report-plan-018-remote-security-port.md` 已產出，可直接接續

---

## 🔄 上輪 Session 焦點（2026-04-18 07:52）— PLAN-018 啟動（D059 對齊）

**對齊結果**（Q1-Q6）：
- **Q1.A**：先派研究工單（T0166，~2h）
- **Q2.B**：拆 4 張實作工單（TLS+fingerprint / sandbox / brute-force / 整合測試）
- **Q3.A**：實作用 EXP worktree（`exp/remote-security`，TOPIC=RMTSEC）
- **Q4.C**：整天範圍（6-10h 整包）
- **Q5.B**：研究純靜態分析，不實測打包
- **Q6.A**：每張工單完成回塔台對齊再派下一張

**T0166 已派發**（auto-session: on，已透過 BAT 內部終端開新 session）：
- 產出：`_report-plan-018-remote-security-port.md`
- 內容：4 大面向分析 + 衝突清單 + 4 張實作工單拆單建議 + 依賴順序圖
- 執行位置：主線（純讀碼）

### 下一步（使用者回塔台時）
1. Worker 完成 T0166 → 回報「T0166 完成」
2. 塔台審 `_report-plan-018-remote-security-port.md` → 決策拆單方案
3. 指導 `git worktree add ../better-agent-terminal-remote-security -b exp/remote-security`
4. 建立 EXP-RMTSEC-001（🧪 EXPLORING 統籌）+ 派第 1 張實作工單

### 最大編號更新
- 工單：T0166（+1）
- 待決策：EXP-RMTSEC-001 尚未正式建立

---

## 🔄 上輪 Session 焦點（2026-04-18 07:10）— Upstream v2.1.42+ 同步決策（D058）

---

## 🔄 本 Session 焦點（2026-04-18 07:10）— Upstream v2.1.42+ 同步決策（D058）

**研究工單 T0164 閉環**（2026-04-18 06:49 → 07:08，19 分鐘）：

- **範圍**：upstream `tony1223/better-agent-terminal` 自 `8d23e6e` 後 13 commits（v2.1.42 → v2.1.46-pre.1）
- **分類結果**（實質 11 包）：cherry-pick 2 包 / 移植 1 包 / skip 4 包
- **產出報告**：`_report-upstream-sync-v2.1.42-plus.md`
- **關鍵補充**：使用者指示 C1.1 必須先升 SDK/CLI 再加 Opus 4.7 builtin（否則 `model-not-supported`）
- **D058 決策**：採方案 [A] — T0165 Phase 1 cherry-pick（~2h，本輪執行）+ PLAN-018 Phase 2 remote 資安加固（6-10h，下週）

### 衍生工單狀態
- **T0165** ✅ DONE（07:40 使用者驗收通過）— Phase 1 cherry-pick 閉環
  - C1.1 = `84c2930` Opus 4.7 + SDK/CLI 2.1.111 + EFFORT_LEVELS + xhigh
  - C1.2 = `59a26f8` remote workspace:load + profile fix (upstream `0bc3bc1` cherry-pick)
  - prep = `47bce0c` CT bookkeeping
  - `version.json` 推進 `8d23e6e → 0bc3bc1`，version 改為 `2.1.45`
  - `CLAUDE.md` 新增 Claude Agent SDK / CLI 小節
- **PLAN-018** 📋 PLANNED 🔴 High — Remote 資安加固（TLS + fingerprint + sandbox + anti-bruteforce），排下週
- **PLAN-019** 💡 IDEA 🟢 Low — TypeScript 技術債清理（T0165 順帶發現 ~20 tsc errors）

### 下一步
1. ~~派發 T0165~~（✅ 已完成）
2. ~~T0165 runtime 驗收~~（✅ 已完成）
3. 本輪 CT bookkeeping meta commit（`_decision-log` / `_backlog` / `_tower-state` / PLAN-018/019）
4. PLAN-018 排下週，實作階段再拆 T####
5. PLAN-019 等有空檔再議

### 待處理事項（沿用上輪）
1. ⏸ Worktree 清理：`git worktree remove --force ../better-agent-terminal-builder26 && git branch -d exp/builder26`
2. 🟡 6+ commits 待 push（加上 T0164/T0165/PLAN-018/D058 commit，可能 8+）
3. 💡 `*evolve` 萃取仍在進行中（L039-L056 共 18 條候選）

---

## 🔄 上輪 Session 焦點（2026-04-18 05:30）— 安全升級日完結

**本日集中升級三部曲 + PLAN-016 全案閉環**：

| PLAN | 內容 | 閉環時間 | 關聯 |
|------|------|---------|------|
| **PLAN-016** ✅ | Electron 28.3.3 → 41.2.1 | 05:30 | 三 Phase 全綠（D047→D056） |
| **PLAN-005** ✅ | electron-builder 24.13.3 → 26.8.1 | 05:25 | PLAN-016 Phase 3 載體（D054/D055） |
| **PLAN-003** ✅ | npm audit 殘餘漏洞（三 Group） | 05:25 | Group A=PLAN-005 / B=T0163 / C=WONTFIX |

### 本日累積成果
- **npm audit**：27 → 3（減少 88.9%，剩 Group C WONTFIX）
- **依賴版本**：Electron 41.2.1 + electron-builder 26.8.1 + vite 7.3.2 + Node 24 + Chromium M146
- **EoL 窗口**：Electron 41 EoL 2026-08-25（約 4 個月保護期），下次主升級 Q3 2026 評估 Electron 43+
- **CLAUDE.md**：Electron Runtime + Build Toolchain 段完整記錄
- **相關 commits（2026-04-18 單日）**：17 個 + 本輪 D056 meta commit
- **本輪 unpushed**：5 commits（含本輪 D056 meta）

### Learning 候選（本日累積 15 條，L039-L056）
- **L039-L041**（Phase 2 期間）：Electron IDE self-lock 陷阱 + 雙軌驗證
- **L044-L048**（T0162/T0163/EXP-BUILDER26-001）：研究分階段 + Worker 續接 + EXP worktree 實證
- **L049-L053**（PLAN-005 閉環）：wall-clock vs Worker time + CONCLUDED-PENDING 中間狀態
- **L054-L056**（PLAN-016 閉環）：安全升級日模式 + Success Criteria 具體化 + 跨 PLAN 依賴元資料

### 待處理事項
1. ⏸ Worktree 清理：`git worktree remove --force ../better-agent-terminal-builder26 && git branch -d exp/builder26`（等 file lock 釋放後執行）
2. 🟡 **6+ commits 待 push**（由使用者決定時機）
3. 📦 **本輪歸檔完成**（2026-04-18 05:45）：37 張搬入冷區（29 T 工單 + 6 BUG + 2 PLAN），豁免 T0149/T0150/T0154/BUG-034/PLAN-012 共 5 張（Active 引用）
4. 💡 **正在進行 `*evolve`** — 萃取本輪 18 條 learning
4. 📋 **下一輪工作候選**（優先級待定）：
   - PLAN-004 🟡 GPU Whisper 加速（Win/Linux）
   - PLAN-009 🟡 Sprint 儀表板 UI
   - PLAN-014 🟡 BAT 內建 Git 圖形介面（方向 B）
   - 剩餘 🟢 Low：PLAN-002 / PLAN-007 / PLAN-013 / PLAN-015
5. 🟢 **無 High/Critical 待處理項**（升級相關 High 全結案）

---

## 🔄 上輪 Session 焦點（2026-04-18 05:25，歷史追溯）

**PLAN-005 / PLAN-003 全案閉環**（~3 小時集中升級 session）：

### 依賴升級三部曲（連續閉環）
1. **T0163** ✅ DONE（04:18，commit `83ae7cf`）— vite 5.4.21 → 7.3.2 + 3 plugin 連動，PLAN-003 Group B 閉環
2. **EXP-BUILDER26-001** 📊 CONCLUDED（05:25，merge commit `75bb77f`）— electron-builder 24.13.3 → 26.8.1，PLAN-003 Group A 閉環
3. **PLAN-003 整體** ✅ DONE — Group A + Group B + Group C WONTFIX 全數完結

### 閉環成果
- **npm audit**：13 → 3（僅剩 Group C whisper-node-addon → cmake-js → tar WONTFIX 鏈）
- **電子依賴現狀**：vite 7.3.2 + electron 41.2.1 + electron-builder 26.8.1（全部最新 stable）
- **CLAUDE.md Build Toolchain 段**：完整記錄 vite 7 + electron-builder 26 migration notes
- **使用者 Step 5.4 Installer 手動驗收通過**：CT panel / 終端機 / Sidebar / IPC 全綠

### 本輪 commits（4 個 unpushed）
- `83ae7cf` chore(deps): vite 5→7（T0163）
- `ca8057b` chore(ct): T0163 DONE + PLAN-005 launch（D054）
- `75bb77f` Merge EXP-BUILDER26-001（no-ff）
  - `f79f735` chore(deps): electron-builder 24→26
  - `d146c9a` chore(ct): commit hash 回填
  - `f105eb9` chore(ct): Worker 收尾
- **本輪 meta commit 待建立**（EXP + PLAN × 2 + tower-state + backlog + D055）

### Learning 候選（下次 `*evolve` 評估晉升）
- **L046-L053** 累積 8 條，涵蓋：續接中斷 Worker / EXP worktree 實證 / auto-session 組合 / Worker time vs wall-clock 估時 / schema breaking 處理 / CONCLUDED-PENDING-X 中間狀態

### 待處理事項
1. ⏸ Worktree 清理：`git worktree remove ../better-agent-terminal-builder26 && git branch -d exp/builder26`（塔台可執行）
2. 📋 下一輪候選（使用者決定）：
   - PLAN-004 🟡 GPU Whisper 加速
   - PLAN-009 🟡 Sprint 儀表板 UI
   - PLAN-014 🟡 BAT 內建 Git 圖形介面（方向 B）
   - PLAN-016 🔴 Electron Phase 3（暫緩中）
3. 🟡 4 commits 待 push（由使用者決定時機）
4. 💡 下次 `/ct-evolve --playbook` 可評估 L049/L050/L052 晉升為 global playbook

---

## 🔄 上輪 Session 焦點（2026-04-18 04:25，歷史追溯）

**T0163 DONE 閉環**：
- vite 5.4.21 → 7.3.2 + 3 plugin 連動（commit `83ae7cf`，13 分鐘完成）
- npm audit 13 → 11（esbuild SSRF + vite path traversal 2 moderate 清除）
- CLAUDE.md Build Toolchain 段寫入
- Smoke test 10/10 checklist 全綠（dev/HMR/CT panel/terminal/IPC/build）
- **執行過程特殊事件**：前任 Worker 在 Step 5 前中斷（自 kill），續接 Worker 從 Step 1 盤點驗證接手到 Step 8 收尾，無資料損失
- **PLAN-003 Group B ✅ DONE**

**PLAN-005 啟動（D054）**：
- **執行方案**：使用者對齊 A/C/C/A
  - Q1-A：立刻動，趁 vite 升級工具鏈熱度
  - Q2-C：**EXP worktree 模式**（`exp/builder26`），主線零污染
  - Q3-C：Windows 完整打包 + macOS/Linux YAML dry-run（無 macOS 機器）
  - Q4-A：`electron-builder: ^24.0.0 → ^26.8.1`（npm audit 指向版本）
- **派發 EXP-BUILDER26-001**（🧪 EXPLORING，4-6h）
- **完結路徑**：CONCLUDED → merge 回主線 → PLAN-005 DONE → PLAN-003 Group A 關閉 → PLAN-003 整體 DONE

**使用者執行計畫**（本 session 結束後）：
1. 塔台批次 commit 本輪 meta（T0163 meta + PLAN-005 / PLAN-003 更新 + D054 + tower-state + EXP-BUILDER26-001）
2. 使用者執行 `git worktree add ../better-agent-terminal-builder26 -b exp/builder26`
3. 進入 worktree 目錄，開新 sub-session 輸入 `/ct-exec EXP-BUILDER26-001`
4. Worker 完成後回塔台說「EXP-BUILDER26-001 CONCLUDED」或「ABANDONED」或「卡關：<原因>」

---

## 🔄 舊 Session 焦點（2026-04-18 03:58，歷史追溯）

**T0162 全 phase 完成**：
- Phase 1 DONE（commit `edf913a`，11 分鐘）— 漏洞盤點 13 個全 dev-only，D052 混合策略
- Phase 2 DONE（commits `8be4e5a` + `51201d1`，實耗 7 分鐘）— 3 個 OQ 全解：
  1. ✅ vite-plugin-electron 0.29.1 stable 支援 vite 7/8（Phase 1 peer 判斷不精確已修正）
  2. ⏭ electron-vite 遷移成本過高，不採用
  3. ✅ vite 5→7 改動小；5→8 重磅（Oxc/Rolldown + CJS）

**塔台 D053 決策：路徑 A（vite 7 stable）**
- 使用者選擇：A，對齊 1B/2B/3A
- 理由：漏洞清除相同，路徑 B 吃 beta + CJS interop + Oxc/Rolldown 新引擎風險，production app 保守為上
- 下次升 vite 8 等 `vite-plugin-electron@1.0.0` GA 脫離 beta（6-12 個月後）

**T0163 派發**（📋 PENDING，3-5h）：
- vite 5→7 + 3 plugin 連動 + vite.config migration + CLAUDE.md Build Toolchain 段 + 主要功能 smoke test + 獨立 commit（3A）

**使用者執行計畫**：塔台 meta commit 後，開 sub-session `/ct-exec T0163` 執行實作。

---

## 🛏 前次 Session 退出快照（2026-04-18 03:43，歷史追溯）

**退出原因**：使用者移回 BAT 內 sub-session 繼續 T0162 Phase 2（Worker 已於 03:43 領取 Renew #1 指示，狀態 IN_PROGRESS）。塔台 session 先結束避免 context 膨脹，等 Worker 完成 Phase 2 後再恢復決策。

**恢復指引**（下次 `/control-tower` 啟動時）：
1. Fast Path 載入此快照（快照 <24h，無需 `*rescan`）
2. 檢查 T0162 狀態：
   - 若 Worker Phase 2 回報完成 → 讀「Phase 2 回報（Renew #1）」區段 → 塔台決策派實作工單 or 再 Renew
   - 若仍在 IN_PROGRESS → 使用者應已完成 Phase 2，提示「T0162 Phase 2 完成了嗎？」
3. 若需派實作工單 → 下一張是 **T0163**（vite 5→8 升級 + plugin 連動）
4. 若需要，處理尚未 commit 的 6 個 meta 檔（見下方清單）

**當前狀態凍結**：
- **T0162** 🔄 IN_PROGRESS（Phase 1 DONE commit `edf913a` / Phase 2 Worker 起動 03:43）
- **PLAN-003** 📋 PLANNED（3-group 策略 D052，Group B 等 Phase 2 結論）
- **PLAN-001** 🚫 DROPPED（被 PLAN-003 Group B 吸收）
- **D052** 已寫入（混合策略 + PLAN-001 DROPPED 副作用）
- **最大編號**：T0162 / BUG-038 / PLAN-016 / D052 / EXP-ELECTRON41-001

**未 commit 清單**（6 檔，等 T0162 完全結案一起 commit）：
```
 M _ct-workorders/PLAN-001-vite-v5-to-v6-upgrade.md         (DROPPED 註記)
 M _ct-workorders/PLAN-003-npm-audit-remaining-vulnerabilities.md (3-group 策略)
 M _ct-workorders/T0162-research-npm-audit-post-electron41-remediation.md (Renew #1 指示)
 M _ct-workorders/_backlog.md                               (PLAN-001 → Dropped)
 M _ct-workorders/_decision-log.md                          (D052)
 M _ct-workorders/_tower-state.md                           (本檔)
```

**建議 commit 訊息**（T0162 完全結案時，含 Phase 2 產出 + 實作工單派發）：
```
chore(ct): T0162 renew + PLAN-003 3-group strategy (D052)

- T0162 Phase 1 DONE (13 vulns all dev-only), Renew #1 resolves
  vite plugin peer compatibility OQs
- PLAN-003: IDEA -> PLANNED with 3-group strategy
  - Group A (9 electron-builder chain): defer to PLAN-005
  - Group B (vite/esbuild): upgrade vite 5->8 (impl workorder)
  - Group C (whisper/tar): WONTFIX (postinstall-only, no runtime)
- PLAN-001 (vite v5->v6): DROPPED, absorbed by PLAN-003 Group B
- D052: mixed strategy decision + PLAN-001 drop side-effect
```

**使用者執行計畫**（本 session 結束後）：
1. 回 BAT 內 sub-session（Worker 已在跑 T0162 Phase 2，狀態 IN_PROGRESS 03:43）
2. 等 Worker 完成 Phase 2（~15-30 分鐘），查看「Phase 2 回報（Renew #1）」
3. Phase 2 完成後，回塔台說「T0162 Phase 2 完成」→ 塔台決策派 T0163 實作工單

---

## 🔄 本 Session 焦點（2026-04-18 03:40，退出前凍結）

**T0162 Renew #1 已派**（PLAN-003 Group B 實作前置探測）：
- Phase 1 DONE（commit `edf913a`，11 分鐘）— 漏洞盤點 + D052 混合策略
- Phase 2（Renew #1）待 Worker 接續 — 解 3 個 Open Questions：
  1. vite-plugin-electron / vite-plugin-electron-renderer 的 npm registry peer 支援版本
  2. electron-vite 替代評估（僅在 OQ1 顯示無 plugin 支援時觸發）
  3. vite 6/7/8 migration breaking changes 摘要
- 預估 15-30 分鐘
- Renew 後塔台依結論派**實作工單**（vite 5→8 升級 + plugin 連動 + smoke test，4-8h，若改 electron-vite 加 2-4h）

**告知 sub-session Worker**：回 BAT 內 terminal 的 sub-session，告訴 Worker「**T0162 重讀工單**」以載入 Renew #1 補充指示。

---

## 🎉 前置閉環（2026-04-18 03:01）

**成果摘要**：
使用者關閉 VSCode 在外部 Windows Terminal 重跑 `npm install` 解除 EBUSY 鎖定 → `npm run build` 產出 Windows NSIS installer（electron=41.2.1）→ 手動重裝測試通過。PLAN-016 Phase 2 + BUG-038 閉環完成。

**狀態轉移**：
- **T0160** ✅ DONE（runtime 驗收通過，原 follow-up 註記更新）
- **T0161** FIXED → **✅ DONE**（執行期驗證勾選）
- **BUG-038** FIXED → **🚫 CLOSED**（元資料補關閉時間 + 驗收結果）
- **PLAN-016 Phase 2** 完結，Phase 3（electron-builder 24→26）依 D049 暫緩
- 新決策 **D051** 記錄閉環

**塔台 meta 批次 commit 範圍**（本次收工）：
- `_tower-state.md`：02:55 退出快照更新 + tooltip typo 修正（build:win → build，5 處）
- `_decision-log.md`：D050 body typo 修正（2 處）+ 新增 D051
- `_bug-tracker.md`：BUG-038 移入 CLOSED section + 統計更新 (8 → 9)
- `BUG-038-*.md`：狀態 FIXED → CLOSED + 關閉時間 + 驗收結果
- `T0161-*.md`：狀態 FIXED → DONE + 執行期驗證結果
- `T0160-*.md`：follow-up 註記更新（阻擋 → 通過）

**Learning 候選升級**（待 `*evolve` 寫入）：
- **L040**（🟢 global 候選，跨專案通用）：Electron-based IDE self-lock 陷阱 — D051 實戰驗證 candidate 升 🟢 reliable
- **L041**（🟡 本專案 playbook 候選）：repo 層 + runtime 層雙軌驗證 — D051 實戰驗證，候選升 🟢

---

## 🗄️ 前次 Session 退出快照（2026-04-18 00:55）

**退出原因**：BUG-037 全鏈路閉環完成，塔台推薦等 PLAN-014 Phase 3 Tα3+ 再動 PLAN-015 refactor（避免架構 churn）

**恢復指引**（下次 `/control-tower` 啟動時）：
1. Fast Path 載入此快照（<24h 有效）
2. `git log -1` 應為 `2def77a`（chore(ct) BUG-037 follow-up）— 未 push，等使用者決定推送時機
3. 本 session 4 個 commit（`378a124` / `fbcf2d2` / `ad6f9e8` / `2def77a`）尚未 push
4. 下一輪起點候選：PLAN-014 Phase 3 Tα3（若 roadmap 已定義）/ PLAN-004 🟡 / PLAN-009 🟡 / PLAN-015 🟢（暫緩）

**當前狀態凍結**：
- BUG-037 🚫 CLOSED（T0158 commit `fbcf2d2`，方案 A + Layer 2 PROXIED_CHANNELS bridge）
- PLAN-014 Phase 3 Tα1 (T0155) + Tα2 (T0156) ✅ DONE，Tα3+ 尚未規劃
- PLAN-015 💡 IDEA 🟢 Low（塔台推薦 Phase 3 完整收官後再動）
- 2 條新 learning（L035 / L036）寫入，candidate 標記待晉升評估
- 工作樹乾淨，4 commits unpushed

---

## 🗄️ 舊 Session 退出快照（2026-04-17 14:22，歷史追溯用）

**退出原因**：使用者手動 rebuild + 換版 BAT（塔台當前在 BAT 裡跑，重裝會斷 session）

**恢復指引**（下次 `/control-tower` 啟動時）：
1. Fast Path 載入此快照（快照 <24h）
2. 檢查 `git status` 確認 meta 變更狀態（可能已由使用者自行 commit，或仍 uncommitted）
3. 檢查 `git log -1` 確認最新 commit（應為 `412d52c` 或之後使用者的 meta commit）
4. 若 BAT 已換新版 → 新 session 在 BAT 內（`BAT_SESSION=1`）→ 派 T0145 驗收
5. 若尚未換版 → 提醒使用者 `npm run build` + 重裝

**當前狀態凍結**：
- T0144 ✅ DONE (commit 412d52c by Worker，14:18)
- PLAN-012 實作完成，等 T0145 驗收
- BUG-032 🚫 CLOSED（T0143 Task B 驗證通過）
- **9 檔塔台 meta uncommitted**（見下方清單）

**未 commit 清單**（塔台建立/修改，尚未進入 git history）：
```
modified:  _ct-workorders/_backlog.md              (PLAN-012 加入)
modified:  _ct-workorders/_bug-tracker.md          (BUG-032 移至 CLOSED)
modified:  _ct-workorders/_tower-state.md          (本檔，decisions/起手式)
modified:  _ct-workorders/BUG-032-...md            (CLOSED + D036)
modified:  _ct-workorders/PLAN-012-...md           (翻盤描述)
modified:  _ct-workorders/T0142-...md              (MERGED → DONE)
modified:  _ct-workorders/T0143-...md              (Worker 已 commit 為 215e8757，塔台這端可能還有微調)
new:       _ct-workorders/T0144-...md              (塔台建立 + Worker 補回報)
new:       _ct-workorders/T0145-...md              (塔台建立，驗收工單)
```

**建議 commit 訊息**（下次恢復後提供給使用者）：
```
chore(ct): PLAN-012 + BUG-032 meta (D033-D037)

- BUG-032 → CLOSED (T0143 Task B all-green)
- T0142 → DONE (merged into T0143)
- PLAN-012 strategy: native Electron dialog (D035)
- T0143 DONE (research, Worker commit 215e8757)
- T0144 DONE (impl, Worker commit 412d52c)
- New: T0145 acceptance workorder pending
```

---

## 🌅 起手式（Quick Recovery）
> 最後更新：2026-04-18 00:55 UTC+8

### 🎉 BUG-037 全鏈路閉環（2026-04-18 00:23~00:43）

**本 session 成果**（~1.5h，4 commits unpushed）：
- **T0157** 研究 DONE（commit `378a124`）— 靜態 + 1 輪使用者互動定位根因：`WorkspaceView::renderTabContent` 缺 `case 'git-graph'`（T0155 commit 只補了 App.tsx，漏 WorkspaceView 的 main zone render path）
- **T0158** 修復 DONE（commit `fbcf2d2`）— 方案 A（最小修改）+ **Layer 2 範圍擴展**（UAT 發現 `electron/remote/protocol.ts::PROXIED_CHANNELS` 漏 `git-scaffold:*` 3 channels，Worker 依 F-11 問 [A/B/C]，使用者選 [B] 合併修復）
- **BUG-037** OPEN → CLOSED（使用者 runtime UAT 通過，VERIFY 決策流選項 [1] 直接 CLOSED）
- **2 條 learning 寫入**：
  - L035: Dockable panel 雙 render 路徑同步 checklist（App.tsx + WorkspaceView.tsx）
  - L036: Electron IPC PROXIED_CHANNELS scaffold checklist
- **PLAN-015** 入 backlog（🟢 Low IDEA — 抽 shared helper 消除雙 render path，塔台推薦 Phase 3 Tα3+ 完整收官後再動）
- **塔台 meta** 2 commit 批次收尾（`ad6f9e8` + `2def77a`）

### 立即待辦（本輪結束，下一輪從這裡接）
- ✅ **T0159 完成**（commit `4e5af2f`，01:32）— 三合一研究結論
- ✅ **EXP-ELECTRON41-001 CONCLUDED**（commit `ef3624f` on `exp/electron41`，02:16，27 分鐘）
- ✅ **T0160 DONE**（commit `e7eab33`，02:30）— PLAN-016 Phase 2 完成：FF merge + postinstall rebuild + CLAUDE.md + worktree 清理
- ✅ **T0161 DONE**（commit `9d734a8`，02:33 FIXED → 03:01 DONE）— 方案 B：pty-manager.ts + terminal-server.ts 在 spawn 前刪除 `ELECTRON_RUN_AS_NODE`；runtime 驗收通過
- ✅ **BUG-038 CLOSED**（03:01）— runtime 驗收通過
- ✅ **Electron 41 升級 CLOSED**（03:01，D051）— runtime 閉環完成
- 💡 **Learning candidates**（下次 `*evolve` 寫入）：
  - **L037**：一次性大批 deps 升級失敗率高（證據 `b5b3d1a` → `d8ee82a` revert +7557/-813）
  - **L038**：大型升級假設常過度悲觀（EXP 預估 4-8h / 實際 27 分鐘），研究階段應採「先 EXP 驗證再定優先級」
  - **L039**：BAT 內跑 Electron dev 需清 `ELECTRON_RUN_AS_NODE`（跨專案通用）
- 🟡 **待 push**：本 session ~8 個 commit 累計
- 📋 **PLAN-016 Phase 3（PLAN-005 builder 26）暫緩**：等 T0160 merged + 主線穩定 1-2 輪
- 📋 **其他下一輪候選**：
  1. **PLAN-014 Phase 3 Tα3**（若已定義）— 繼續 Git GUI 實作主線
  2. **PLAN-004** 🟡 Medium — GPU Whisper 加速（Win/Linux）
  3. **PLAN-009** 🟡 Medium — Sprint 儀表板 UI
- 💡 **可選 learning 晉升**：L003/L004/L005 等 `candidate: global` 標記已累積多時，下次 `/ct-evolve --playbook` 可評估晉升

### 🟠 上一輪起手式（2026-04-17 17:12 存檔，歷史追溯用）

### 🎉 PLAN-012 全案結案（2026-04-17 17:12）— 5 BUG 批次 CLOSED
**收官**：使用者 rebuild + 重裝後實測 T0145 情境 1-5 + 8 + 9 全綠，D044 批次結案：
- **PLAN-012** ✅ DONE（Quit Dialog + CheckBox 主動關 server，四路徑一致）
- **BUG-031** 🚫 CLOSED（外部 PTY workspace 分配）
- **BUG-033** 🚫 CLOSED（托盤 Quit bypass Dialog）
- **BUG-034** 🚫 CLOSED（checkbox 勾選後 reconnect 路徑 server 未結束）
- **BUG-035** 🚫 CLOSED（watchdog shutdown race 誤 re-fork）
- **T0145/T0147/T0148/T0149/T0150** 全數 DONE

**PLAN-013** 💡 IDEA（🟢 Low）：Installer 檔案鎖定詢問 kill（依 D033 劃出 PLAN-012 範圍，入 backlog）

**🟢 BUG-036** 🚫 CLOSED 🟢 Low（17:30）：T0151 三連修復 `cb0d535`+`feb84df`+`4d9fba4`（status + priority + meta），使用者驗證通過。

**本輪最大收穫**：T0144 實作引爆連環 bug（BUG-033 → BUG-034 → BUG-035），每層靠 log 鐵證定位根因，堅守「塔台不改 code」邊界；研究工單（T0146/T0148）+ 修復工單（T0147/T0149/T0150）節奏穩定。

### 🟠 舊起手式（2026-04-17 14:38 存檔，歷史追溯用）

### 🔴 BUG-033 發現（2026-04-17 14:35）— PLAN-012 T0144 regression
**現象**：使用者 rebuild + 重裝新版 BAT 實測 → **從系統托盤 Quit 時完全沒出現 Dialog**，直接退出，Terminal Server 殘留背景（使用者 Q1.A / Q2.D 確認）。
**影響**：T0145 驗收無法進行（Dialog 是所有情境前提），PLAN-012 設計失效，且破壞原版 Quit 行為（regression）。
**行動**：BUG-033 OPEN + T0146 研究工單已派發（允許 Worker 加 trace log 請使用者重測）。

### 🟢 BUG-032 已 CLOSED（2026-04-17 13:58）
T0143 Task B 全綠：`BAT_HELPER_DIR` 正確、helper 可執行、notify exit 0、UUID 路由無 cwd first-match 誤判。Helper packaging + path resolution 修復鏈（T0139/T0140/T0141）驗收通過。

### 🔴 當前焦點：BUG-033 → T0146 研究 → 修復 → T0145 驗收 → PLAN-012 DONE
T0143 研究定調：採 **Electron 原生 `dialog.showMessageBox`**（內建 checkboxLabel）。T0144 實作完成（commit 412d52c）但使用者實測托盤路徑 Dialog 未觸發。

### 🔴 BUG-035 發現（2026-04-17 16:49）— watchdog shutdown race
**現象**：打包版 T0149 實測勾 checkbox 退出，原 server 真的被殺（log `via TCP shutdown`），但 PtyManager heartbeat watchdog 把 TCP close 誤判為 crash，20ms 內 re-fork 出 PID 26412 孤兒 server → 孤兒持 refed TCP socket → main event loop 卡住 → `crashpad-handler` 殘留。
**性質**：pre-existing watchdog（T0108 期間的 crash recovery 邏輯）+ T0149 graceful TCP close 觸發的 race，**不是 T0149 引入**，是 T0149 才讓它顯現化。
**BUG-034 不退回 FIXING**（原始根因 early-return 已修好，log 為證）；開 BUG-035 另案追蹤。
**修復方向**（T0150）：`PtyManager.beginShutdown()` + `attemptRecovery` guard，shutdown 期間跳過 re-fork。根因明確不需研究工單。

### 🟢 BUG-034 已 FIXED（2026-04-17 16:20）— 等 T0145 情境 8 打包驗收
**現象**：打包版 T0147 修好 Dialog 出現（BUG-033 → VERIFY）後，使用者勾選「一併結束 Terminal Server」checkbox 實測 → `terminal-server.js` 子進程 + `crashpad-handler` 殘留；托盤 + File 兩路徑皆中（Q2.A+B）。
**根因**（T0148 確認）：T0144 `stopTerminalServerGracefully()` 只處理 fork 路徑（`_terminalServerProcess` 有值），BAT reconnect 路徑 `_terminalServerProcess=null` → 早退，SIGTERM 從未發出。
**修復**（T0149 commit `cd460d2`）：方案 C — Step A `child.kill('SIGTERM')` → Step B `sendShutdownToServer(port)` TCP shutdown → Step C `waitForPidFileRemoval` 1500ms → Step D Unix `SIGKILL` / Windows `execFile('taskkill', ['/F','/T','/PID', pid])`；各路徑 log `via <method>`，失敗則 `logger.error`。+ `pty-manager.dispose()` 補 destroy tcpSocket（修 crashpad-handler leak 候選）+ 移除 main.ts:1491 誤報 log。
**驗收計畫**：T0145 擴增**情境 8**（4 子情境 8a/8b/8c/8d，涵蓋 fork/reconnect × dev/packaged × 成功路徑 + fallback）→ 使用者 rebuild + 打包驗收。

### 立即待辦（全部完成 ✅，下一輪新起點）
1. ~~T0144 實作~~ ✅ commit `412d52c`
2. ~~T0146 研究（BUG-033 根因）~~ ✅ commit `4bc8d26`
3. ~~T0147 修復（BUG-033 Tray handler）~~ ✅ commit `ef867a2`
4. ~~T0148 研究（BUG-034 根因）~~ ✅ commit `98be02d`
5. ~~T0149 修復（reconnect + tcpSocket + 誤報 log）~~ ✅ commit `cd460d2`
6. ~~T0150 修復（watchdog guard）~~ ✅ commit `31b4ec2`
7. ~~T0145 驗收（情境 1-5 + 8 + 9 全綠）~~ ✅ 使用者打包實測通過
8. ~~批次 CLOSED + PLAN-012 DONE + PLAN-013 IDEA~~ ✅（D044）

### 下一輪候選（優先級待定）
- **PLAN-004** 📋 PLANNED 🟡：GPU Whisper 加速（Win/Linux）
- **PLAN-009** 📋 PLANNED 🟡：Sprint 儀表板 UI
- **PLAN-013** 💡 IDEA 🟢：Installer 檔案鎖定詢問 kill（本 session 新開）
- **PLAN-001/002/003/005/007** 💡 IDEA 🟢：Vite 升級、Dynamic Import、npm audit、Electron Builder 升級、遠端容器
- **`*evolve`**：本 session 有 learning 候選（T0144 連環 bug 模式 + 工單引用檔案路徑前應驗證存在 + BUG 不退回假 FIXING 的追蹤紀律）
8. BUG-031 runtime 驗證（🟡 Medium，FIXED → CLOSED）— 低優先
9. T0135 PARTIAL（6.2 `--help` 未實作）— 獨立處理
10. Backlog 剩餘 PLAN 待排優先級（PLAN-001~007）

### 本 session 決策
- **D032**：BUG-032 拆單方案 [A]（一張統籌 BUG + 一張研究 + N 張修復）；`_local-rules.md` 暫不動 [A]（避免破壞 baseline，等 BUG-032 整體方案敲定一起改）
- **追加**：BUG-031 維持 FIXED 狀態（PTY allocation 邏輯本身已透過使用者實測驗證），副作用檢查併入 BUG-032 範圍
- **D033**（2026-04-17 13:15）：建立 PLAN-012 — Quit Dialog 加「一併結束 Terminal Server」CheckBox，預設**不勾選**（避免誤按關掉背景 server）；Installer 強制 kill 另開 PLAN；時程緊急，排 T0142 驗收後
- **D034**（2026-04-17 13:25）：PLAN-012 拆單策略 Q1.D + Q2.A — 先派研究工單 T0143 摸清 Quit Dialog + Terminal Server 現狀；T0142 驗收 checklist Phase 2-5 內嵌到 T0143「Task B」觀察表，T0142 狀態改 🔀 MERGED；dogfood 驗收（派 T0143 行為本身即為 BUG-032 鏈路驗證）；CT 上游回 PR 編號順延
- **D035**（2026-04-17 13:58）：PLAN-012 UI 路線定調 — 採 **Electron 原生 `dialog.showMessageBox`**（內建 checkboxLabel），放棄 Custom React Modal；main.ts +~50 行 + i18n 6 行，零 React 改動，零 IPC 擴充
- **D036**（2026-04-17 13:58）：**BUG-032 → CLOSED** — T0143 Task B B1/B3/B4/B5 全綠（BAT_HELPER_DIR 正確、helper 可執行、notify exit 0、UUID 路由無 cwd 誤判），BUG-032 原範圍（helper packaging + path resolution）完全驗收通過；**版本更新檔案鎖定**問題屬 PLAN-012 範圍，獨立追蹤不混為一談
- **D037**（2026-04-17 14:00）：PLAN-012 拆單定案 — 採 T0143 Worker 推薦方案 B（2 張）：**T0144 實作**（`before-quit` 原生 Dialog + CheckBox + SIGTERM+timeout fallback + i18n，~60-80 行）+ **T0145 驗收**（6 情境 + 版本更新安裝場景）；T0142 合併完成後狀態改 ✅ DONE
- **D038**（2026-04-17 14:35）：**BUG-033 建立 + T0146 派發** — 使用者實測 rebuild + 重裝後托盤 Quit 無 Dialog 直接退出（Q1.A/Q2.D 確認），Terminal Server 殘留；屬 T0144 regression。策略：開研究工單（非直接修復）— 根因不明（可能 Tray handler bypass `before-quit` / Dialog async race / packaging 未涵蓋 / i18n init 失敗）；研究允許 Worker 加 trace log 請使用者重測（使用者已主動授權）。不直接派修復因為風險：盲修可能再 regression，也無從驗證其他 Quit 路徑（File/Ctrl+Q/視窗X）是否同病
- **D046**（2026-04-17 17:30）：**BUG-036 CLOSED + T0151 DONE（含 priority follow-up）** — Worker 實際根因比塔台假設精確：`src/types/backlog.ts:55` `sectionToStatus` 只認 `DONE`/`已完成`，不認 `COMPLETED`（而 skill 模板 `_backlog.md` 用的是 `## Completed`）→ fallback 'IDEA'；外加 Completed 表 schema 無「狀態」欄 → `rowStatusToStatus` 無法 override。雙因合力。修復三連：`cb0d535`（加 COMPLETED match 主修）+ `feb84df`（meta）+ `4d9fba4`（使用者追加反映 priority 也 Unknown，Worker 新增 `extractPriorityFromPlanContent` 從 PLAN metadata 補讀）。使用者驗證通過 → BUG-036 OPEN→CLOSED + T0151 DONE。**潛在上游 PR 候選**：本修復對所有使用 CT Panel 框架的專案都有用，類似 PLAN-011 模式可推回 CT 上游（留待後續評估）。
- **D045**（2026-04-17 17:22）：**BUG-036 建立 + T0151 派發（UI parser 缺 DONE 支援）** — D044 批次結案後使用者在 CT panel Backlog tab 發現 PLAN-012 顯示 Unknown 而非 Done，右側詳細頁正確顯示 ✅ DONE → UI 列表 parser 問題（列表 parser 可能只讀 `_backlog.md` Active 表找不到 Completed 區塊的 PLAN / 或 status enum mapping 缺 DONE case / 或 regex 未覆蓋）。非緊急純 UI 顯示缺陷，嚴重度 🟢 Low，不影響資料正確性。使用者選項 [B]：直接派修復工單（T0151），Worker 自行 grep 定位 parser，不另派研究工單。預期修完後類似 PLAN-008/010/011 歸檔前的 DONE 顯示邏輯將補齊。
- **D044**（2026-04-17 17:12）：**PLAN-012 全案結案 + 5 BUG 批次 CLOSED + PLAN-013 開立（IDEA）** — 使用者完成 rebuild + 重裝後實測：BUG-031 / BUG-033 / BUG-034 / BUG-035 **全部通過驗收**（T0145 情境 1-5/8/9 全綠）。一次結案：BUG-031 FIXED→CLOSED（T0137 runtime 驗證通過）、BUG-033 VERIFY→CLOSED（T0147 四路徑通過）、BUG-034 FIXED→CLOSED（T0149 方案 C 通過）、BUG-035 OPEN→CLOSED（T0150 watchdog guard 通過）、PLAN-012 PLANNED→DONE（四個實作 commits `412d52c`+`ef867a2`+`cd460d2`+`31b4ec2`）、T0145 READY→DONE、T0149/T0150 FIXED→DONE。**情境 7（installer 強制 kill 檔案鎖定場景）依 D033 劃出範圍**，使用者選項 [B] 另開 PLAN-013 IDEA 🟢 Low 入 backlog，不排入本輪結案。本輪最大收穫：T0144 實作引爆連環 bug（BUG-033 regression + BUG-034 reconnect early-return + BUG-035 watchdog race），每一層都靠 log 鐵證快速定位根因，堅守「塔台不直接改 code」邊界讓所有決策透明可追。
- **D043**（2026-04-17 16:49）：**BUG-035 建立 + T0150 派發（不退回 BUG-034）** — 使用者實測 T0149 打包版勾 checkbox 退出，觀察到 `terminal-server.js` + `crashpad-handler` 仍殘留。Log 鐵證（08:42:48 時間序）：`.814 TCP closed` → `.814 Terminal Server died — attempting recovery` → `.815 re-forking` → `.833 re-forked with pid 26412` → `.839 [quit] terminal server stopped (via TCP shutdown)`。性質明確：**BUG-034 根因已修好**（原 server graceful close，log `via TCP shutdown` 為證），但 PtyManager heartbeat watchdog（pre-existing T0108 期間的 crash recovery 邏輯）把 T0149 觸發的 graceful TCP close 誤判為 crash → 20ms 內 re-fork 孤兒 server PID 26412 → 孤兒持 refed TCP socket 卡住 main event loop → crashpad-handler 殘留。不是 T0149 引入，是 T0149 才讓它顯現化（之前 SIGTERM 根本沒送，watchdog 自然不觸發）。**BUG-034 保持 FIXED**（避免假退回汙染追蹤），開 BUG-035 另案追蹤。修復方向明確（`PtyManager.beginShutdown()` + `attemptRecovery` guard）→ 不需研究工單直接派 T0150。
- **D042**（2026-04-17 16:20）：**T0149 完成採 Worker 方案偏差合理化** — Worker 實作方案 C 時遭遇 2 處工單指示與現實衝突：(1) 工單要求用 `src/utils/execFileNoThrow.ts`，但此 util **不存在於本專案** → Worker 採專案既有 pattern（main.ts:1696、2353 已用動態 import + `execFile` 非 `exec` + Promise wrapper），安全性等價（`execFile` 天生無 shell 解析、`windowsHide: true`、`timeout: 3000`）；(2) `getPidFilePath` 為 pid-manager.ts module-local 未匯出 → Worker 硬編碼 `path.join(userDataPath, 'bat-pty-server.pid')` 並在註解標註「與 pid-manager.ts:4 `PID_FILENAME` 常數保持一致，若未來檔名變更需同步兩處」。兩處偏差塔台**批准合理化**：Worker 判斷正確（安全性等價 + 不新建 util 檔符合保守原則），但塔台寫工單時**未驗證 `execFileNoThrow.ts` 存在**是疏漏，learning 候選（工單引用具體檔案路徑前應先 grep 確認）。BUG-034 FIXING → FIXED（等 T0145 情境 8 打包驗收）
- **D041**（2026-04-17 16:04）：**T0148 結論採方案 C + 派發 T0149** — Worker Static 分析 + log 證據鏈完整確定根因：T0144 `stopTerminalServerGracefully()` 只處理 fork 路徑（`_terminalServerProcess` 有值），reconnect 路徑 `_terminalServerProcess=null` → `if (!child) return` 早退，SIGTERM 從未發出。log L123→L124 只差 1ms 鐵證。使用者在 T0148 互動 [15:54] 選定**方案 C**（TCP shutdown 優先 → PID SIGTERM fallback → Windows taskkill 兜底）+ 同意併修 tcpSocket leak（`pty-manager.dispose` 漏 destroy tcpSocket，疑似 crashpad-handler 殘留根因）+ 修誤報 log。T0149 範圍：3 檔案修改（main.ts 重寫 stop 函式 / pty-manager dispose 補 destroy / main.ts:1424 移除誤報 log）。**關鍵約束**：Windows taskkill 必須用專案 util `src/utils/execFileNoThrow.ts`（shell-safe，security hook 約束）。BUG-034 → FIXING
- **D040**（2026-04-17 15:38）：**BUG-034 建立 + T0148 研究工單派發** — 使用者重測打包版（含 T0147 `ef867a2`）確認 Dialog 會問 ✅ + checkbox 可勾 ✅，但勾選後仍殘留 `terminal-server.js` 子進程 + `crashpad-handler`（暗示 main 也沒完全退）。使用者確認托盤 + File 選單**兩條路徑都中**（Q2.A+B）→ 非路徑特定，是 checkbox → kill-server 邏輯本身失效。與 BUG-033（Dialog 不出現）性質不同，開新 BUG-034 另案追蹤避免 scope 爆炸。派研究工單而非直接修復 — 理由：可能根因多元（SIGTERM 對象 / Windows signal 行為 / child handle 遺失 / timeout race / main exit 未觸發），盲修風險高。Q3.C 授權 Worker 自行判斷 static vs trace log 策略。嚴重度 🟡 Medium（Dialog 主功能 OK，checkbox 為延伸功能，workaround 為工作管理員手動結束）
- **D039**（2026-04-17 14:58）：**T0146 結論採方案 A + 派發 T0147** — Worker 靜態分析 + log 交叉驗證 100% 確定根因（電子證據鏈：main.ts:540-546 Tray handler / main.ts:1334-1339 before-quit 守護條件 / log 完全無 `[quit]` prefix），未使用 trace log。**性質確認**：pre-existing bug，非 T0144 引入（Tray handler 的 `isAppQuitting = true` 在 commit `d09c45e` 就存在），但 T0144 才顯現化（T0144 前沒 Dialog 感知不到）。採方案 A（刪除 1 行）而非 B（改守護條件，跨路徑驗證面積大）或 C（重構 ~80 行 overkill）。雖僅 1 行改動仍派工單而非塔台自主 commit — 理由：屬邏輯變更 + regression 修復 + 需 4 路徑冒煙測試，超出 `auto_commit` 小變動範圍

### 本 session 新增工單
| ID | 標題 | 狀態 |
|----|------|------|
| BUG-032 | Helper scripts 打包與路徑解析設計缺漏 | 🚫 CLOSED |
| T0138 | 研究：BAT Helper Scripts 打包與路徑解析設計 | ✅ DONE |
| PLAN-012 | Quit Dialog 新增「一併結束 Terminal Server」CheckBox | 🔄 IN_PROGRESS |
| T0143 | 研究：Quit Dialog + Terminal Server 現狀（PLAN-012 起手 + T0142 驗收內嵌） | ✅ DONE (commit 215e8757) |
| T0144 | PLAN-012 實作：Quit Dialog + CheckBox（原生 dialog + SIGTERM fallback + i18n） | ⚠️ DONE but regression 顯現化（commit 412d52c） |
| T0145 | PLAN-012 驗收：6 情境 + 版本更新安裝場景 + BUG-033 四路徑打包覆蓋 | 📋 READY（等 build） |
| BUG-033 | 托盤 Quit 無 Dialog 直接退出，Terminal Server 殘留背景 | 🔍 VERIFY（dev serve 四路徑通過，等打包驗收） |
| T0146 | 研究：托盤 Quit 為何 bypass Dialog（BUG-033 根因調查） | ✅ DONE（推薦方案 A） |
| T0147 | 修復：刪除 Tray handler 的 `isAppQuitting = true`（方案 A，1 行） | ✅ DONE（commit `ef867a2`） |
| BUG-034 | Quit Dialog checkbox 勾選後 Terminal Server 未結束（托盤 + File 皆中） | 🔧 FIXING |
| T0148 | 研究：checkbox → kill-server 邏輯失效根因（BUG-034 根因調查） | ✅ DONE（commit `98be02d`，推薦方案 C） |
| T0149 | 修復：stopTerminalServerGracefully 支援 reconnect 路徑 + tcpSocket leak + 誤報 log（方案 C） | ✅ FIXED（commit `cd460d2`，log `via TCP shutdown` 證實 early-return 已修；T0145 情境 9.1 發現 watchdog race → BUG-035） |
| BUG-035 | PtyManager watchdog 在 shutdown 期間誤觸發 re-fork，孤兒 server 卡住 main event loop | 🚫 CLOSED（D044） |
| T0150 | 修復：PtyManager.beginShutdown() + attemptRecovery guard 避免 graceful shutdown 被誤判 crash | ✅ DONE（commit `31b4ec2`，T0145 情境 9.1 驗收通過） |
| PLAN-013 | NSIS Installer 偵測檔案鎖定時詢問 kill Terminal Server | 💡 IDEA 🟢 Low（D044 依 D033 剝離，入 backlog） |
| BUG-036 | CT Panel Backlog 列表對 DONE 狀態的 PLAN 顯示 Unknown | 🚫 CLOSED（D046） |
| T0151 | 修復：CT Panel Backlog 列表讓 DONE PLAN 正確顯示 Done（BUG-036） | ✅ DONE（commits `cb0d535`+`4d9fba4`，使用者驗證通過） |

### 本 session 新增工單（2026-04-17 02:00-03:05）
| ID | 標題 | 狀態 | Commit |
|----|------|------|--------|
| T0135 | BAT v2.x + CT v4.1.0 全鏈路驗收（統籌） | ✅ DONE | c98a04c, 8ec97ad |
| T0136 | BUG-030 修復 — MSYS 路徑轉換 | ✅ FIXED | f77d2d0 |
| T0137 | BUG-031 修復 — PTY workspace 分配 | ✅ FIXED | f325d1d |
| BUG-030 | bat-terminal.mjs Git Bash MSYS 路徑污染 | 🚫 CLOSED | c23bae2 |
| BUG-031 | 外部 PTY 被分配到錯 workspace（cwd first-match） | ✅ FIXED（待驗） | 7fdd76a |

### 本 session 關鍵發現
1. **BUG-030**：Git Bash MSYS2 把 `/ct-exec` 誤轉成 `C:/Program Files/Git/ct-exec`，T0136 加 regex 還原
2. **BUG-031 真根因**：不是「default workspace」，是 `cwd.startsWith(folderPath)` first-match，當 parent + 子專案 workspace 都打開時 match 到較早建立的
3. **PARTIAL**：`bat-terminal.mjs --help` 未實作（會被當命令執行）
4. **Worker→Tower 通知鏈路** 不受 BUG-031 影響（PTY 預填用 targetId 全域唯一；Toast 廣播到所有 BrowserWindows）— 仍需 T0138 runtime 確認

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（Open: 0 / Fixed: 1 / Closed: 1）
- Backlog → [_backlog.md](_backlog.md)
- 工單列表 → 熱區 14 + EXP/CP 雜項 — 全部 ✅ DONE 或 ✅ FIXED

### 近期完成摘要（本 session）
- **T0126** DONE：修復 CT 面板工單按鈕命令格式（`/ct-exec` → `claude "/ct-exec"`）
- **T0127** DONE：研究 BAT 內部終端建立機制 → 推薦方案 A
- **T0128** DONE：Agent 自訂參數 Settings UI + 7 處啟動路徑套用
- **T0129** DONE：RemoteServer 自動啟動 + BAT_REMOTE_PORT/TOKEN env vars 注入
- **T0130** DONE：外部建立終端 UI 同步（縮圖 + xterm + 自動聚焦）
- **T0131** DONE：CLI helper bat-terminal.mjs（零依賴 WebSocket invoke）
- **T0132** DONE：研究 Worker→Tower 自動通知 → 推薦方案 A（雙管道）
- **T0133** DONE：Worker→Tower 自動通知實作（雙管道 + 三層 badge 冒泡）
- **T0134** DONE：【統籌】CT 上游整合（COORDINATED → CT-T001 DONE）
- **CT-T001** DONE：CT v4.0.1 → v4.1.0（BAT 路由 + Worker 通知整合）
- **PLAN-011** DONE：CT 上游 PR 完成（v4.1.0 發布）
- `_local-rules.md` 更新：BAT auto-session 路由規則 + Bash 白名單

### 工單統計
- Done: 137 + CT-T001 | Active: 0 | 總計: 138
- 最高編號：T0137 / BUG-031 / PLAN-011 / D031
- FIXED BUG（待 rebuild 驗證）: BUG-031（Medium，T0137 commit f325d1d）
- Closed BUG（本輪）: BUG-030（High → CLOSED, 02:42）

## 🌅 明日起手式（Quick Recovery）<!-- ORIGINAL -->

**目前進度**：單據系統遷移 + 歸檔完成。20 張工單全部 DONE。目錄已清理。

**最後完成工單**：T0085（Commit all + v0.0.9-pre.1 pre-release）
**本輪完成**：T0065-T0085（21 張），涵蓋 BMad UI 整合、workspace 切換修復、VS Code 開啟功能、BUG-012 根因確認與修復

**下一步建議**：
1. 參考 `_backlog.md` 的 PLAN-001~007 決定下一批工作
2. BUG-001 待 runtime 驗收（最後一張 VERIFY bug）

**快速連結**：
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（Open: 0，Closed: 24）
- Backlog → [_backlog.md](_backlog.md)（Active: 6）
- 工單索引 → [_workorder-index.md](_workorder-index.md)（Active only）
- 決策日誌 → [_decision-log.md](_decision-log.md)（最新：D028）
- 學習紀錄 → [_learnings.md](_learnings.md)
- 歷史 Checkpoint → [_archive/checkpoint-2026-04.md](_archive/checkpoint-2026-04.md)

---

## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（lastSyncCommit: 079810025，上游版號 2.1.3） |
| **Fork 版號** | 1.0.0（獨立版號，從 1.0.0 開始，D026） |
| **目前里程碑** | Phase 1 — Voice Input（實作完成，收官驗收中） |
| **工單最大編號** | T0163 |
| **BUG 最大編號** | BUG-038 |
| **PLAN 最大編號** | PLAN-016 |
| **EXP 最大編號** | EXP-BUILDER26-001 |
| **上游同步版本** | v2.1.42-pre.2（2026-04-16） |
| **決策最大編號** | D056 |
| **塔台版本** | Control Tower v4.0 |

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
> 最後掃描：2026-04-18 20:07 (UTC+8) — *rescan

| 偵測項 | 狀態 | 備註 |
|--------|------|------|
| BMad-Method | ✅ | _bmad/ 已偵測到 |
| ECC 學習 | ✅ Level 1 | ~/.claude/homunculus/ |
| bmad-guide skill | ✅ | 可用 |
| mem0 REST | ✅ | memsync healthy, queue:2 |
| 終端環境 | BAT | TERM_PROGRAM=better-agent-terminal |
| BAT 終端 | ✅ | BAT_SESSION=1, port:9876, workspace:0228e89a-... |
| ct-exec | ✅ | |
| ct-done | ✅ | |
| ct-status | ✅ | |
| ct-evolve | ✅ | |
| ct-insights | ✅ | |
| ct-fieldguide | ✅ | |
| ct-help | ✅ | |
| _archive/ | ✅ | 201 張歸檔（workorders/bugs/plans/ + checkpoint + 舊 index） |
| _playbooks/ | ✅ | 空目錄（0 張） |
| _decision-log | ✅ | D### (34 條) |
| 跨專案參照 | 📋 | 無關聯（_cross-references.md 不存在） |
| Global 學習 | ✅ | 48 patterns, 0 playbooks, 3 fieldguide |
| BUG/PLAN 追蹤 | ✅ | BUG:6 熱區 / PLAN:15 熱區 |
| 實驗追蹤 | ✅ | EXP:2 熱區 |
| 設定來源 | project | _tower-config.yaml (yolo + retries:1 + commit:on) |
| 能力等級 | Level 2 | ECC + mem0 |

---

## YOLO 歷程

> 本區段依 `references/yolo-mode.md` § 「`_tower-state.md` 新增 `## YOLO 歷程` 區段」規格產生。
> **Footnote**：本 session [斷點 C] 標記僅取狹義（Worker 跨 PLAN 建議）；使用者手動「停」暫不歸 A/B/C，列為 `[使用者中斷]` 自訂事件（待 L064 上游修正）。

### 當前 Session（2026-04-18 ~16:10 啟動，第三 session，收尾）

- [啟動] 2026-04-18 ~16:10 — 塔台 Fast Path 恢復，YOLO MODE ACTIVE 警語自動顯示（配置 `auto-session: yolo`, `yolo_max_retries: 1`）
- [派發] 2026-04-18 ~16:12 — CT-T003 DELEGATE 派發指引已送出（跨專案，目標 `BMad-Control-Tower-v4.x.x/`），使用者選 [B] 手動切換；本端更新 CT-T003 狀態 TODO → DISPATCHED
- [部分完成] 2026-04-18 16:18 — CT-T003 PARTIAL（commits monorepo:`1d02727` + 本地:`c73a23b`）。Worker 規格三步 + CHANGELOG 完成；Worker 自主 inference 調整 Step 2（工單預設字串在 v4.2.0 不存在，改為新增「使用者中斷快捷」段落，符合互動規則第 1 條）。剩餘 Step A(push) / C(sync) / D(tag) 待使用者決策。L065 候選：跨專案 DELEGATE 工單 monorepo vs 獨立 repo 結構假設缺口
- [完成] 2026-04-18 16:25 — CT-T003 DONE（使用者收尾全綠）。A-1: better-agent-terminal push origin/main（27 commits，`6ccf369..c73a23b`）; A-2: BMad-Guide monorepo push origin/dev-main（`d65f451..1d02727`）; D: v4.2.1 tag 打於 1d02727 並 push; C: 生產塔台 sync 驗證通過（grep 三處命中）。L064 drift 修正閉環
- [evolve] 2026-04-18 ~16:35 — `*evolve` 批次萃取 L057-L065 + L066，寫入 GP038-GP043（6 Global）+ L062/L063/L066（3 Project）+ L065 補充。GP039/GP042 直接升 🟢
- [archive-test] 2026-04-18 ~16:45 — `*archive --dry-run` → 3 張候選（T0149/T0150/BUG-034）→ 執行 → 全數觸發活躍引用豁免還原（PLAN-013 🟢 IDEA 引用鎖）→ L066 記錄 → archive_days 1→7 恢復保守設定

### 上個 Session（2026-04-18 ~15:30 啟動，T0174 Phase 2-6）

- [啟動] 2026-04-18 ~15:30 — 塔台啟動偵測 `auto-session: yolo` (持久化於 `_tower-config.yaml`)，自動顯示 YOLO MODE ACTIVE 警語面板（驗證 Phase 1 session-to-session 延續）
- [派發] 2026-04-18 15:45 — T0173 (BUG-040 研究，Phase 2 dogfood 首張，BAT 內部終端 `--notify-id $BAT_TERMINAL_ID`)
- [完成] 2026-04-18 15:50 — T0173 DONE (commit `5a2030c`，Worker 自動回報「T0173 完成」經斷點 A regex 通過)
- [斷點 C] 2026-04-18 15:55 — T0173 回報「建議實作工單列表 T-NEXT-1/2/3」跨出 PLAN-020 → 塔台 PAUSE（當下未明確識別為斷點 C，事後對照規格才確認 — L064 候選）
- [使用者中斷] 2026-04-18 ~16:00 — Phase 5 dogfood 測試：使用者輸入「停」→ 塔台正確 abort 派發。事件類型規格未定義（沿用 SKILL.md 警語語意，L064 已記錄）
- [完成] 2026-04-18 15:59 — Phase 6 區段建立中（本條為 self-recursive 紀錄）

### 計數器

- 連續 FAILED: 0 / 1（`yolo_max_retries: 1` dogfood 設定）
- 本 session yolo 派發工單數: 1（T0173）
- 本 session 斷點觸發: A×0, B×0, C×1, 使用者中斷×1
- 本 session 學習候選新增: L064（規格 drift）

### 歷史 Session（摘要）

- 2026-04-18 上半場（PLAN-020 開發）：派發 7 張本專案工單 + 1 跨專案 DELEGATE，全 DONE，無斷點觸發（pre-yolo / 早期 yolo 混用）
- 2026-04-18 下半場第二 session：T0174 Phase 0-1 dogfood 完成（無工單派發，純 setup + 警語驗證）
