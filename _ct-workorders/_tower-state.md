# Tower State — better-agent-terminal

> 最後更新:2026-10-21 23:24 (UTC+8) — **第八十八 session 收工**（CT v5.11.0）：`v0.7.1-pre.5` 已發佈（D179 小批 T0687–T0690，Test gate 首次生效）；本 session 另有 T0674 `/why`、T0675 PARTIAL、D176 去識別化、BUG-167／168 與 Test gate（T0678–T0686）。前次：第八十七 session 收工（2026-10-20 19:59）EXP-WFMINE-001 / T0673 CONCLUDED、PLAN-054。
>
> **下次起手**:等 外部測試者A 以 `v0.7.1-pre.5` 驗收 BUG-166（C 選做 → BUG-165）；T0675 等使用者下載 S2-04／05；下一批候選 BUG-169；BUG-156 / 159 仍待特定環境。
---

## 🛏 本 Session 收工快照 (第八十八 session, 2026-10-21 11:26 - 23:24, ~11h58m)

### 主軸：認知負荷討論 → 網站 `/why`（T0674）→ 第二季 Podcast 與 NotebookLM（T0675 PARTIAL）→ 公開 repo 去識別化（D176）→ BUG-167 / BUG-168 與 CI Test gate（T0678–T0686）→ pre.5 前小批（D179，T0687–T0690）→ 發 `v0.7.1-pre.5`

#### 時間線（時間取自系統 / git / gh）

1. **11:26** 啟動（CT v5.11.0；`--set-role tower --mode on`）；使用者給兩篇文章 + 群組對話，討論 CT + BAT 如何降低認知負荷 → 去識別化的虛構故事網頁 artifact
2. **16:33** 網站呈現設計初衷（D175）→ T0674 `/why`（`0f50a83d`；使用者補「不規範 SDD/TDD/BDD、仍需專業知識、不是 Vibe Coding」→「這不是什麼」節）；**17:22** push 後 Pages `39576224181` 綠、link-check 1260 / 0
3. **17:04** 第二季 Podcast 素材 5 集（內部教育訓練版，11 檔，存 BMad-Guide repo，未 commit）；**17:09** T0675 NotebookLM 製作（chrome-live）→ **17:44** PARTIAL（S2-01～03 生成，S2-04／05 排程，使用者自行下載）；L172
4. **18:11** 使用者要求檢查金鑰與個資 → D176：T0676（`b8ea0f8b`，153 檔）、T0677（`e95b445e`，66 檔）、塔台改 BUG-129 一處；對照表只在 `.private/`；`_local-rules.md` 新增去識別化一節；不改寫 git 歷史
5. **19:20** BUG-167 + T0678（`d90b3b50`）；盤點發現 `tests/` 41 檔不在 `test:unit` → **20:17** BUG-168 + T0679 研究（29 項失敗 + 9 個逾時全部測試過時；CI 原本沒跑 `test:unit`）
6. **20:40** D177（G1～G4 全做、往 vitest 收斂、CI 分兩步）→ T0680 / T0681 / T0683 並行 → T0682 → T0684（ubuntu 試跑 29 項寫死 Windows / 時區；Q-1／Q-2 → D178 `path.win32`）→ T0685 `test:legacy`；第二次 ubuntu 試跑 run `39609350106` 全過 → **21:41** BUG-168 FIXED → T0686 Test gate（`bb926fdc`），手動 `tests.yml` run `39611026294` 綠
7. **22:00** 使用者問「可以發布 v0.7.1-pre.5 了嗎」→ 先開小批（D179）：T0687 MCP 寫入型 tool 政策（`873e6efb`）、T0688 SSH `start-failed` 字首 + `@` 測試（`79412e61`）、T0689 安裝檔只收 6 個執行期 helper（`b9afa02e`；與 T0687 同改 CLAUDE.md，等 T0687 完成再派）；聯合驗證時才查到內嵌 claude CLI 落後 → T0690 追版 2.1.306（`09509698`，L173）；T0689 發現 BUG-169（helper 版號 `v0.0.0`，排下一批）
8. **22:31** bump `d0ebd708` → push → run `39617678592` 全綠（**Test gate 首次生效**：tests 14:36:27Z 結束、build 14:36:30Z 才開始）→ **22:43 `v0.7.1-pre.5`** → 更版重點 → 文件 `10f16cc9` → Pages `39619776202` 綠、link-check 1265 / 0、首頁 pre.5
9. **23:24** 收工（未 push 的塔台 commit 等使用者指示）

### 本輪戰績

| 類別 | 數量 | 備註 |
|---|---|---|
| 派發工單 | **17**（T0674–T0690） | 全部 `started:`；T0675 PARTIAL（等使用者下載），其餘 DONE 並回收 Worker 分頁；結構化提問 1 次（T0684 Q-1／Q-2） |
| BUG | BUG-167 / BUG-168 新開 → FIXED；BUG-169 新開 OPEN（low） | 熱區 Open 2 / Fixing 0 / Fixed 24 / Closed 28 |
| 決策 | D175–D179 | 網站 `/why`、去識別化、測試修正與 CI 兩步、`path.win32`、pre.5 前小批 |
| 發版 | 1（`v0.7.1-pre.5`） | exe 306 / zip 423 / AppImage 306 / dmg 319 MiB |
| unit test | 5661 → **5779 passed / 326 files**（3 skipped）；`test:legacy` 33 檔 472 / 0 | CI 首次在發版前跑 unit + legacy |
| 學習 | L172、L173 | |

### 重點觀察

- 「CI 有跑測試」不能假設：四個 workflow 原本只跑 typecheck，5,600 多項單元測試從沒在 CI 跑過；Test gate 接上後，第一次 pre-release 就看到 build 等 tests 結束才開始
- WSL 模擬 ubuntu 抓不到時區相依的測試（10 項），第一次 GitHub 試跑才現形；跨平台測試要在 CI 的實際 runner 跑一次
- GitHub API 的 job 狀態可能停在 `in_progress`（pre.5 的 darwin server-bundle job），但 run 已 completed / success、每個 step 都 success、tarball 已發佈：以 jobs API 的 steps 與 release assets 判斷，不要誤判發版失敗
- 公開 repo：工單的字詞檢查清單不得直接列出真名（T0674 的教訓，已寫進 `_local-rules.md`）

### 編號起始（下 session）

- **T0691** / **BUG-170** / **PLAN-055** / **D180** / **EXP-WFMINE-002** / **L174** / **CT-T022**

---

## 🛏 前 Session 收工快照 (第八十七 session, 2026-10-20 16:24 - 19:59, ~3h35m)

### 主軸：BMad-Guide「CT Workflow 智能」提案 → BAT 試點 EXP-WFMINE-001 / T0673（全讀 Workflow，718 檔）→ PLAN-054（B4 併下次發版、B6 延後）

#### 時間線（時間取自系統 / git）

1. **16:24** 啟動（CT v5.9.0；`--set-role tower --mode on`）；使用者 `/plan`：依提案 §5.1 對本專案 `_ct-workorders/`（含 `_archive`）做 Phase 1 挖掘
2. **16:41** 開 EXP-WFMINE-001 + T0673（`e92f0010`）：使用者選全讀 Workflow（約 45 agent、上限 5.5M）；BMad-Guide HANDOVER 寫 small 版，使用者依 D077 改選全量 + 逐張判定 JSONL；16:42 `started:`
3. **16:51** Worker Q-1（預估超過 5.5M）：塔台處理跨 session 訊息時漏看，使用者在 Worker 分頁直接答「A，放寬到 7.0M」（`72715226`，L171）
4. **17:25** T0673 DONE（`84e21f2d`）：候選 WFC001–006（對抗式複核全部 weakened）、§5.1.4 確認 3 / 部分 7 / 推翻 1、JSONL 718 行、39 agents / 7.35M tokens（超過 7.0M 約 5%）→ 17:26 EXP CONCLUDED + L171（`d7b7979f`）；Worker 回收
5. **17:29** 使用者「開 PLAN-054 照建議，B1 先不做，push」→ `37adb490`；以跨 session 訊息回覆 BMad-Guide 塔台 HANDOVER §6
6. **17:44** 使用者「併到下次發版」→ PLAN-054 B4 併入下一次發版批次（`02cc26f4`）
7. **19:15** BMad-Guide 塔台通知：CT T0182 回測 G2 未通過、CT D090，v5.11.0 不定義 workflow 欄位 → B6 延後（`8fd45899`）
8. **19:59** 收工

### 本輪戰績

| 類別 | 數量 | 備註 |
|---|---|---|
| 派發工單 | **1**（T0673） | `started:`；Workflow `wf_738991d2-209`，39 agents / 7.35M tokens / dropped 0；提問 1 次（Q-1，使用者直接答）；`worker_auto_close` 回收 1 次 |
| EXP / PLAN | EXP-WFMINE-001 CONCLUDED（假設部分成立）；PLAN-054 PLANNED | B1 不做、B4 併下次發版、B6 延後 |
| 學習 | L171 | 中文工單 token 估算；跨 session 訊息後查 Worker 提問 |
| 發版 / 程式 | 0 | 只改 `_ct-workorders/`，未重跑 unit test |

### 重點觀察

- token 估算：中文工單約 1.9 bytes/token，每個讀取 agent 另有約 31k 固定開銷；先試跑一小批再估全量（原估 3.1M，實際內容約 4.6M）。Workflow 執行中讀不到 token 用量
- 處理完跨 session 訊息後要查 `bat_list_questions` / `bat_get_state`，不然會漏接 Worker 提問
- 【推論】BAT 的扇出多在工單之間（塔台依序派工），單張工單內很少需要 Workflow；CT 回測（T0182）也未達標

### 編號起始（下 session）

- **T0674** / **BUG-167** / **PLAN-055** / **D175** / **EXP-WFMINE-002** / **L172** / **CT-T022**

---

## 🌅 起手式（Quick Recovery）

> 最後更新：2026-10-21 23:24 UTC+8（第八十八 session 收工）

### 近期完成
- `v0.7.1-pre.5` 發佈（第八十八 session，run `39617678592`，Test gate 首次生效）：T0687–T0690（MCP 寫入型 tool 政策、SSH 啟動失敗字首、安裝檔只收 6 個執行期 helper、內嵌 claude CLI 2.1.306）；Pages `39619776202` 綠、link-check 1265 / 0
- BUG-167 / BUG-168 FIXED、CI 加 Test gate（T0678–T0686，D177 / D178）：`test:unit` 5779 / 0、`test:legacy` 472 / 0
- 公開 repo 去識別化（D176，T0676 / T0677）：對照表只在 `.private/`，push 前跑 `.private/T0676-deid-mapping.md` 的檢查樣式
- 網站 `/why`「把腦力留給判斷」（T0674，D175）；第二季 Podcast 素材 5 集（BMad-Guide repo，未 commit）
- `v0.7.1-pre.4` 發佈（第八十六 session）：BUG-166（T0672）

### 待辦（依優先序）
1. 🔴 **外部測試者A 驗收**（可直接用 `v0.7.1-pre.5`）：A BUG-166（`printf '\e[?1003h\e[?1006h'` 後移動滑鼠，殘骸幾筆即停；codex 分頁 Shift + 右鍵有兩個新選項）→ CLOSED；C（選做）BUG-165 `mouse_scroll_speed = 3` → 確認後派 S 修正（`attachCustomWheelEventHandler`）
2. 🟡 **T0675 PARTIAL**（NotebookLM，`c09fe063`）：使用者確認 S2-04／05 生成並下載後補 DONE、回收 Worker 分頁（PARTIAL 不自動回收）
3. 🟡 **下一批**：BUG-169 已 FIXED（第八十九 session T0691 `b0ff5673`，afterPack 寫 `resources/package.json`；下一個預覽版看 CI 三平台 `helper-version` 並驗安裝版 `--version`）；T0690 觀察的 `Usage limit reset · continuing automatically` 已由 T0692（`560409a3`）歸為 resumed，修正 Settings 開啟時徽章殘留「CLI 將於 … 自動繼續」；T0693 研究 DONE（`6f3f623c`）：Renew 後 ✓ 只在下次 notify 才變、批次關閉會誤關，建議方案 a + d1 + d2（主行程回合信號 → 「已回報、又在執行」不列入批次關閉；確認框加註近期輸出），使用者選 a + d1 + d2（D180）→ T0694 實作中；旁支 e 記為 BUG-170（OPEN，之後再排）；規劃發版小批時先查內嵌 claude CLI 版本（L173）
4. 🔴 `v0.7.1-pre.2` 剩餘實機驗收：BUG-156 需 Docker Desktop、BUG-159 需一般權限 + codex
5. 🟢 PLAN-053 Electron 42+、PLAN-052 Docker 可用性（IDEA）；PLAN-054 B6 延後（CT D090）；T0656 網站素材手動拍；`RECOVERY_PENDING` 未實機驗證；前期驗收（外部測試者A BUG-127-135 / 116 / 118、BUG-130 / 105 / 107 / 108 / 097 / 111、T0550、dmg / AppImage、NSIS 重裝、T0360）；dev PC／NAS 主機名稱（使用者未列入去識別化決定）

### ⚠️ 鐵則
- **所有 `gh` 指令必須帶 `-R gowerlin/better-agent-terminal`**（L122）
- 版本驗證用 diff / 雜湊，不用 grep（L127）；每次發版：`gh release edit --notes-file` 更版重點 → 更新 `CHANGELOG.md` / `release-note.md` / `README.md` 並 push → Pages 綠燈、首頁版號、`link-check`，才回報已發佈（L150）
- 公開 repo（D176）：工單 / commit / BUG 不寫真名、客戶名、家目錄路徑；push 前跑 `.private/` 的檢查樣式

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（熱區：Open 2 / Fixing 0 / Fixed 25 / Closed 28）｜ Backlog → [_backlog.md](_backlog.md)
- Decision Log → [_decision-log.md](_decision-log.md)（最大 D179）｜ Learnings → [_learnings.md](_learnings.md)（最大 L173）
- 網站 → https://gowerlin.github.io/better-agent-terminal/｜ 素材 spec → `e2e/site-media.spec.ts`（`BAT_SITE_MEDIA=1`，輸出 `e2e-media/`）
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)（102 entries）

### 編號起始
- **T0695** / **BUG-171** / **PLAN-055** / **D181** / **EXP-WFMINE-002**（其他 TOPIC 從 001） / **L174** / **CT-T022**

---

## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（另有 `scandnavik` remote；⚠️ gh 預設解析到 upstream，見 L122） |
| **目前版號** | **0.7.1-pre.5**（package.json + lock，2026-10-21 `d0ebd708`；`0.7.1` 線，D168，最多到 pre.9） |
| **最新 release** | `v0.7.1-pre.5`（2026-10-21 22:43，run `39617678592`，target `d0ebd708`：SSH 啟動失敗字首、內嵌 claude CLI 2.1.306、安裝檔只收 6 個執行期 helper、Test gate、MCP 寫入型 tool 政策、網站 `/why`；**Test gate 首次生效**：`tests / unit-tests` 14:32:29–14:36:27Z，build 14:36:30Z 才開始；更版重點已寫；exe 306 / zip 423 / AppImage 306 / dmg 319 MiB）+ `server-bundle-v0.7.1-pre.5`（7 assets；darwin-arm64 job 在 API 停在 `in_progress`，但每個 step 含 Complete job 都 success、tarball 已發佈，屬 GitHub 顯示問題）。前一版 `v0.7.1-pre.4`（2026-10-19 18:03，run `39233550117`，target `8883cebd`：BUG-166 滑鼠追蹤殘留自動 / 手動重設；更版重點已寫；repo 文件 `4ae0e89d`；Pages `39234927266` 綠、link-check 1152 / 0 errors、首頁 pre.4；exe 298 / zip 412 / AppImage 297 / dmg 309 MiB）+ `server-bundle-v0.7.1-pre.4`（7 assets）。前一版 `v0.7.1-pre.3`（2026-10-19 13:00，run `39201696170`，target `bf4bfe4f`：BUG-136 縮圖預覽上限、BUG-164 macOS 停用 Graphite + GPU 崩潰後重建；更版重點已寫；repo 文件 `892df2ec`；exe 298 / zip 412 / AppImage 297 / dmg 310 MiB）+ `server-bundle-v0.7.1-pre.3`（7 assets）。更早見 `release-note.md` / `CHANGELOG.md` |
| **前一 tag** | `v0.7.1-pre.4`（2026-10-19 18:03，`8883cebd`） |
| **目前主軸** | `v0.7.1-pre.5` 已發佈（第八十八 session，D179 小批 T0687–T0690）；等 外部測試者A 驗收 BUG-166（pre.4 起）；BUG-165 有空再排；下一批候選 BUG-169；T0675 PARTIAL 等使用者下載 S2-04／05；熱區無進行中工單 |
| **工單最大編號** | **T0694** IN_PROGRESS（第八十九 session：Worker 回報後又在執行不顯示 ✓、不列入批次關閉，D180）；T0693 DONE `6f3f623c`（第八十九 session：研究 Renew 後 Worker 分頁 ✓ 是否該清除，只查不修；建議 a + d1 + d2，Worker 已回收）；T0692 FIXED `560409a3`（第八十九 session：`Usage limit reset · continuing automatically` 歸 `claude-cli-resumed`；`test:unit` 5812 passed；Worker 已回收）；T0691 FIXED `b0ff5673`（第八十九 session：BUG-169，electron-builder `afterPack` 寫只含 name / version 的 `resources/package.json`，`verify-packaged-native.js` 新增 `helper-version`；`test:unit` 5805 passed / 326 files；Worker 已回收）；T0690 DONE `09509698`（第八十八 session：內嵌 claude CLI 追版 2.1.300 → 2.1.306，核對全部無變動，D179 追加）；T0689 DONE `b9afa02e`（`v0.7.1-pre.5` 前小批：安裝檔只收 6 個執行期 helper，打包前後守門）；T0688 DONE `79412e61`（SSH `start-failed` 字首跟 `errorCode` 一致、`@` 測試）；T0687 DONE `873e6efb`（PLAN-054 B4 MCP 寫入型 tool 政策，只寫文件）；T0686 DONE `bb926fdc`（第八十八 session：Test gate：`tests.yml` 可重用、pre-release／release 加 `tests` job 並列進 `build.needs`；actionlint 0，含反向測試；未觸發發版）；T0685 DONE `063c4efb`（第八十八 session：CI 第二步：`test:legacy` 33 檔 472 項全過、tests.yml 加 legacy 步驟、刪 5 個失效 script、5 處註解、wsl-systemd describeError、start-failed 補 11 項測試、`tsx` 4.23.15 devDependency、CLAUDE.md 測試位置規則）；T0684 DONE `4d4bce72`（29 項改跨平台／不依賴時區：9 檔 Windows 與 Linux TZ=UTC 皆 202 / 202、無 skip；時區是測試假設、產品正確；D178 兩處 path.win32）；T0683 DONE `a35c4ce3`（第八十八 session：CI 第一步：helper-env 隔離 + 手動 `tests.yml`；WSL 模擬 ubuntu 9 檔 21 項寫死 Windows 的測試會失敗）；T0682 DONE `5bd04ef4`（G4：9 檔 37 / 37、缺 mock 直接失敗；塔台重跑 37 / 37，0.66 s）；T0681 DONE `eaf8c168`（G3：SSH／WSL 4 檔 47 項去重，新增 vitest 35 項、錯誤期望不搬；塔台重跑 122 / 122）；T0680 DONE `21ce7b79`（G2：4 檔收進 vitest，+55 項；塔台重跑 142 / 142）；T0679 DONE `6fb40e70`（第八十八 session：BUG-168 研究分類，全部 A、無回歸）；T0678 DONE `d90b3b50`（第八十八 session：BUG-167 遷移測試斷言 + tests/ 盤點）；T0677 DONE `e95b445e`（第八十八 session：去識別化第二批，D176 追加）；T0676 DONE `b8ea0f8b`（第八十八 session：公開 repo 去識別化，D176）；T0675 PARTIAL `c09fe063`（第八十八 session：NotebookLM 製作第二季 Podcast；S2-04／05 排程生成，使用者自行下載）；T0674 DONE `0f50a83d`（第八十八 session：網站新頁「把腦力留給判斷」`/why`，D175；已 push、Pages `39576224181` 綠）；T0673 DONE（第八十七 session：EXP-WFMINE-001 執行單，`84e21f2d`）；第八十六 session：T0670 / T0671 研究、T0672 修正；第八十五 session：T0666–T0669；更早見 `_archive/state-snapshots/` |
| **BUG 最大編號** | **BUG-170** OPEN low（第八十九 session：yolo 備援重派後舊 Worker 分頁讓 `--close-worker` AMBIGUOUS，T0693 推演，D180 先記錄）；BUG-169 FIXED low（第八十九 session T0691 `b0ff5673`；第八十八 session 開立：安裝版 helper 版號 v0.0.0，T0689 發現；熱區 Open 2（BUG-165 / 170）/ Fixed 25）；BUG-168 FIXED（第八十八 session：tests/ 未納入 test:unit 的測試失敗與逾時；T0680–T0685，ubuntu 試跑全過，擋版 T0686）；BUG-167 FIXED（第八十八 session：遷移測試斷言過時，T0678 `d90b3b50`）；BUG-166（第八十六 session 開立並 FIXED，待 外部測試者A）；BUG-165 OPEN（有空再排）；BUG-164 CLOSED（收工後 外部測試者A 確認）；BUG-136 第八十六 session CLOSED（外部測試者A 確認）；熱區 Open 1 / Fixing 0 / Fixed 22 / Closed 28；BUG-165 OPEN、BUG-166 FIXED（T0672 `64209d44`，未發版，第八十六 session） |
| **PLAN 最大編號** | **PLAN-054**（PLANNED：CT Workflow 智能的 BAT 側事項，B4 / B6，第八十七 session 2026-10-20）；PLAN-053 IDEA（Electron 42+ 升級，第八十五 session）；PLAN-052 / 051 IDEA；PLAN-049 / 047 DONE；PLAN-015 / 029 / 038 / 043 IDEA |
| **決策最大編號** | **D180**（Renew 後 Worker 分頁 ✓：T0693 方案 a + d1 + d2，旁支開 BUG-170，使用者決定，2026-10-22 第八十九 session）；D179（`v0.7.1-pre.5` 發版前先開小批 T0687–T0689，使用者決定，2026-10-21 第八十八 session）；D178（T0684 Q-1／Q-2 檢查 Windows 路徑用 path.win32，塔台代決，2026-10-21 第八十八 session）；D177（BUG-168 修正分組與 CI 兩步，2026-10-21 第八十八 session）；D176（公開 repo 去識別化，2026-10-21 第八十八 session）；D175（網站 `/why` 設計初衷，2026-10-21 第八十八 session）；D174（T0672 Q-1，2026-10-19 第八十六 session）；D173（網站示意可用 `_ct-workorders/`，放寬 D159 / D165 grep 規則一項，2026-10-19 第八十五 session）；D171 / D172 第八十四 session |
| **EXP 最大編號** | **EXP-WFMINE-001**（📊 CONCLUDED 2026-10-20 17:26；執行單 T0673 DONE `84e21f2d`，7.35M tokens／39 agents；BMad-Guide Workflow 智能提案 Phase 1 試點）；EXP-GPUWHIS-001（CONCLUDED，已歸檔） |
| **塔台版本** | Control Tower **v5.11.0**（第八十八 session 啟動時載入；本檔未記錄 v5.10 / v5.11 升級過程）；前次記錄 v5.9.0（第八十二 session 載入；CT-T021，BMad-Guide T0174，兩端；實機驗收結案 D071） |
| **unit test 基線** | **5661 passed / 322 files / 3 skipped**（塔台複驗 @ `72d77cf1`，發 `v0.7.1-pre.4` 前，2026-10-19 第八十六 session；typecheck 0 / 0、vite build 成功）。前次 5635 passed / 321 files（@ `ee7d1047`，發 `v0.7.1-pre.3` 前，2026-10-19 第八十五 session；typecheck 0 / 0、vite build 成功） |

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
> 最後掃描:2026-10-15 19:57 (UTC+8) 第六十五 session **Full Scan**（`*rescan`；前次 Full Scan 2026-10-13 15:40）

| 偵測項 | 狀態 | 備註 |
|--------|------|------|
| 終端環境 | BAT | `BAT_SESSION=1`, port `9876`, workspace `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`, terminal `66447ea9…`；`WT_SESSION` 無 |
| BAT 派發 | ✅ | 五項 dispatch env 齊備（PowerShell 複核 2026-10-15 19:54）；另有 `BAT_USER_DATA` |
| BAT 安裝版 | ⚠️ `0.7.1-pre.1`（2026-10-18 18:10 FileVersion）；`v0.7.1-pre.2` 已於 20:55 發佈、使用者收工後換版（新塔台以 FileVersion / 雜湊確認，L127） | 分頁權杖 `batcap.`；Tower `--set-role tower --mode on` exit 0（標題 `Claude CLI · Tower`；session 名稱 `better-agent-terminal · Tower`） |
| BAT_HELPER_DIR | ✅ | `C:\Program Files\BetterAgentTerminal\resources\scripts` |
| BAT debug log | ✅ 單一目錄 | `%APPDATA%\BetterAgentTerminal\Logs\debug-20261015-195413.log`（本次啟動）；`.userdata-migration.json` marker 存在 |
| 平台 | Windows 11 | PowerShell 主，Bash tool 並存；node `v24.22.0` / npm `12.2.0`；`.gitattributes` `* text=auto eol=lf` |
| UAC | ⚠️ `EnableLUA=0` | BAT 與子 shell 皆提權（BUG-085 背景） |
| gh CLI | ✅ | 已登入 `gowerlin`（keyring）；**必須帶 `-R gowerlin/better-agent-terminal`**（L122） |
| git remote | 3 個 | `origin`=gowerlin / `upstream`=tony1223 / `scandnavik` |
| git 同步 | ✅ | `main` = `origin/main` @ `2b983a79`（fetch 後）；無其他 worktree / stash；`src/styles/settings.css` 顯示 M 但 `git diff` 無內容（stat-only，未處理） |
| 最新 CI / release | ✅ | Pre-Release run `38871114752` success → `v0.6.1-pre.6` + `server-bundle-v0.6.1-pre.6`（2026-10-16 16:11） |
| WSL | Ubuntu-24.04 | `~/.local/bat-server` = `0.6.1-pre.5`（T0559 2026-10-16 14:17；T0559 / T0560 備份已依使用者指示於 14:27 刪除；port 9877，systemd user service active）；nvm 0.40.8 + Node 24.22.0（T0555 / T0556）；`docker.io` 29.1.3 |
| Control Tower skills | ✅ v5.1.0 | control-tower / ct-exec / ct-done / ct-status / ct-evolve / ct-insights / ct-fieldguide / ct-help 全為 5.1.0 |
| 熱區單據 | **T:80 檔 / BUG:30 / PLAN:17 / EXP:0** | 2026-10-17 第七十一 session `*archive` 搬出 176 張（T 135 / BUG 40 / PLAN-039）；43 張因被未結案單據引用保留 |
| 最大編號 | **T0567 / BUG-141 / PLAN-046 / D148 / L153 / CT-T013** | 下張：T0568 / BUG-142 / PLAN-047 / D149 / L154 / CT-T014（第六十七 session 收工時） |
| 非終態工單 | T0360 FIXED（舊單） | 2026-10-16 17:29：T0551 / T0552 / T0554 FIXED → DONE（BUG 已 CLOSED）；第六十六 session 已補正 T0510 / T0153 / CT-T001 / 011 / 012；報告檔 T0292 / 293 / 298 / 302 已歸檔 |
| unit test | ✅ **3939 passed / 1 skipped / 237 files** | 塔台 rescan 複驗 @ `2b983a79`（31 s） |
| typecheck | ✅ src 0 / electron 0 | 塔台 rescan 複驗 @ `2b983a79` |
| e2e | 未重跑 | 最近：T0535-T0541 各自 e2e（需先 `npx vite build`） |
| state 檔 | ✅ 19.9 KB | < 30 KB 軟警告；季檔 `2026-Q4.md` 86,352 bytes、INDEX 80 entries |
| 設定來源 | project | `_tower-config.yaml`（auto-session **on**，`yolo_max_retries: 1`，`auto_commit: on`） |
| 塔台版本 | v5.1.0（本 session 起生效） | control-tower skill |

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
