---
schema_kind: tower-state
summary_version: 1
updated_at: "2026-10-30T14:30:00+0800"
session: "2026-10-30 13:02 第九十七 session 啟動（CT v5.14.0）"
next_ids:
  workorder: "T0713"
  decision: "D189"
  bug: "BUG-174"
  plan: "PLAN-056"
todo:
  - "v0.7.2-pre.1 已發佈（T0710–T0712）；CT 端已 RESOLVED，最低 BAT 版本放在 CT 5.14.2（v6 beta.6），Codex＋BAT＋plugin 端到端派工未實機跑，CT 有問題會通知"
  - "使用者以 v0.7.1-pre.9 日常使用驗收 BUG-171"
  - "外部測試者A 驗收 BUG-165 / 166 / 169"
  - "BUG-156 / 159 待特定環境驗收"
---
# Tower State — better-agent-terminal

> 最後更新:2026-10-29 10:22 (UTC+8) — **第九十六 session 收工**（CT v5.13.0）：CT D408 ADVISORY → BUG-172 / 173 → T0708 / T0709 → **`v0.7.1-pre.9` 發佈**（文件 `094b3afe`）→ 已回覆 / 通知 BMad-Guide 塔台。前次：第九十五 session 收工（2026-10-26 03:22，`*archive` 138 張）。
>
> **下次起手**:使用者以 `v0.7.1-pre.9` 日常使用驗收 BUG-171 / 172 / 173；外部測試者A 驗收 BUG-165 / 166 / 169；BUG-156 / 159 仍待特定環境；熱區無進行中工單；⚠️ 0.7.1 線已到 `pre.9`，下一版須換版號線（先與使用者確認）。
---

## 🛏 本 Session 收工快照 (第九十六 session, 2026-10-29 09:38 - 10:22, ~45m)

### 主軸：BMad-Guide 塔台 ADVISORY（CT D408 面板讀取契約）→ BUG-172 / 173 → T0708 / T0709 平行 → **`v0.7.1-pre.9` 發佈** → 回覆 CT 塔台

#### 時間線（時間取自系統 / git / gh）

1. **09:38** 收到 BMad-Guide 塔台 ADVISORY（CT v6.0.0-beta.3 `memory-protocol.md` § BAT 塔台面板讀取契約，CT D408）：建議 3 點；對照原始碼確認 1、2 屬實（`fs:readFile` > 512 KiB 回 `File too large`，臭蟲／待辦／決策三頁靜默空、工單消失；`critical` 文字路徑 Unknown，PLAN 檔補優先級也中）；第 3 點（報修時間欄名）BAT 不用改
2. **09:39** 使用者「開」→ BUG-172（medium）/ BUG-173（low）（`1180cc7c`）
3. 使用者「現在派, 一起出版」→ CT v5.13.0 啟動：`--set-role tower --mode on` exit 0；熱檔皆 < 400 KB；`_tower-state.md` 補 frontmatter 摘要 v1
4. **09:47** T0708 / T0709 派工（`5a90ee35`，檔案不重疊平行，`--mode yolo`；`started:` 01:47:18Z / 01:47:20Z）
5. **09:51** T0709 DONE（`809eab0d`，`extractPriority` / `extractSeverity` 認 `critical`）→ BUG-173 FIXED（`c2a4a8ef`）、`--close-worker` exit 0
6. **09:54** T0708 DONE（`50fe08d3`，`readCtFile` 分開 loaded / missing / error，10 檔）→ BUG-172 FIXED（`810651a2`）；main 上 typecheck / typecheck:electron = 0；`--close-worker` exit 0
7. **09:55** 去識別化 + 金鑰掃描 0 → push → `pre-release.yml` `0.7.1-pre.9`（run `40803320599`，12 job 全綠，release 02:05:43Z）
8. 回覆 BMad-Guide 塔台已修正（使用者指示）→ 更版重點 `gh release edit` → 文件 `094b3afe`（CHANGELOG / release-note / README CT 整合點表補 512 KB 一句 / package.json）→ Pages `40804521352` 綠、link-check 1331 / 0、首頁 pre.9 → 通知 BMad-Guide 塔台已發佈
9. **10:22** 收工（使用者「收工」）；本次收工歸檔第九十四 session 快照

### 本輪戰績

| 類別 | 數量 | 備註 |
|---|---|---|
| 派發工單 | 2 | T0708 / T0709，皆 DONE、首派即過 |
| BUG | 2 開 / 2 FIXED | BUG-172 / 173，待 pre.9 實機驗收 |
| 發版 | `v0.7.1-pre.9` | 0.7.1 線最後一個預覽版（`-pre.N` 上限 9） |
| 決策 / 學習 | 無 | |

### 編號起始（下 session）

- **T0710** / **BUG-174** / **PLAN-056** / **D187** / **EXP-WFMINE-002** / **L178** / **CT-T023**

---

## 🛏 前 Session 收工快照 (第九十五 session, 2026-10-26 02:29 - 03:22, ~55m)

### 主軸：啟動 → `*sync` → `*archive` 138 張 → 收工（無派工、無發版）

#### 時間線（時間取自系統 / git）

1. **02:29** 啟動（CT v5.12.6，Fast Path：環境快照 3 天前）；`--set-role tower --mode on` exit 0；安裝版 helper `v0.7.1-pre.8`；`bat_whoami` session 名稱 `better-agent-terminal · Tower`
2. 觀察：塔台分頁 env 已無 `BAT_IDLE_TIMEOUT_MS` / `BAT_SCROLL_BUFFER_LINES`（10-23 快照還有）→ T0705 server env 修正在 pre.8 生效的旁證；heartbeat 誤判仍待日常使用驗收
3. `*sync`：BUG 56（FIXED 28 / CLOSED 28）、PLAN 26，與索引一致；`EXP-WFMINE-001` 無 frontmatter（既有）
4. `*archive`（`archive_days: 2`，使用者確認全部歸檔）：T 111 / BUG 21 / PLAN 6 共 138 張 `git mv` 到 `_archive/`；113 張因被 FIXED BUG、IDEA / PLANNED PLAN、EXP-WFMINE-001、起手式引用而保留；產品程式碼 / 網站 / docs 無以檔名讀取；索引移除已歸檔列（`d7218647`）。熱區剩 T 103 / BUG 35（FIXED 28 / CLOSED 7）/ PLAN 20 / EXP 1
5. **03:22** 收工（使用者「收工」）；本次收工歸檔第九十三 session 快照

### 本輪戰績

| 類別 | 數量 | 備註 |
|---|---|---|
| 派發工單 | 0 | |
| 歸檔 | **138**（T 111 / BUG 21 / PLAN 6） | `d7218647`；tower-hook 對 T0582 的敏感內容警告為誤報（遮罩規則說明，純搬檔） |
| 決策 / 學習 | 無 | |

### 編號起始（下 session）

- **T0708** / **BUG-172** / **PLAN-056** / **D187** / **EXP-WFMINE-002** / **L178** / **CT-T023**

---

## 🌅 起手式（Quick Recovery）

> 最後更新：2026-10-29 10:22 UTC+8（第九十六 session 收工）

### 近期完成
- **`v0.7.1-pre.9` 發佈**（第九十六 session，run `40803320599`，target `810651a2`）：BUG-172（CT 檔讀取失敗顯示錯誤，T0708 `50fe08d3`）、BUG-173（`critical` 算 High，T0709 `809eab0d`）；源自 BMad-Guide 塔台 ADVISORY（CT D408）；文件 `094b3afe`；Pages `40804521352` 綠、link-check 1331 / 0、首頁 pre.9
- **`*archive` 138 張**（第九十五 session，`d7218647`）：T 111 / BUG 21 / PLAN 6；熱區剩 T 103 / BUG 35 / PLAN 20 / EXP 1
- **`v0.7.1-pre.8` 發佈**（第九十四 session，run `40199964626`，target `b2696b15`）：BUG-171（NTP 時鐘跳變 → heartbeat 誤判 → recovery 殺掉所有 agent 分頁；T0703 研究、T0704 修正、T0705 toast i18n + server env、T0706 Recovery 提示 i18n、T0707 ubuntu 測試修正；首次 run `40198701601` 被 Test gate 擋下、未建 tag）；文件 `2365e2f8`；Pages `40200991489` 綠、link-check 1326 / 0、首頁 pre.8；D186、L177、PLAN-055 IDEA
- **`v0.7.1-pre.7` 發佈**（第九十三 session，run `40192111428`，target `0905e0c0`）：指揮塔總覽改版（T0701：塔台狀態＋`*config` 三層＋自動更新、`_tower-state.md` 摘要契約 v1、`no status` 不算 pending）、T0702（引用區塊狀態、`PAUSED`、`TODO` 別名）；文件 `aca99bf8`；Pages `40193056396` 綠、link-check 1320 / 0；CT 結案（CT D347）
- **CT 正式公開**（第九十二 session，D183 / T0700）：BAT 站 5 處「Control Tower 目前未公開提供」改成「已公開、MIT，取得與安裝方式見安裝頁」（`CT_INSTALL_URL` 由 `CT_PORTAL_URL` 組出）；Pages `40149342854` 上線；回覆稿已直接交 CT 塔台

### 待辦（依優先序）
-1. 🔴 **CT plugin 安裝的派工字串**（2026-10-30 BMad-Guide HANDOVER `_handover-2026-10-30-bat-ct-plugin-install-detection.md`，已受理 → [_reply-2026-10-30-ct-plugin-install-detection.md](_reply-2026-10-30-ct-plugin-install-detection.md)）：開單做 3-1（Codex 依安裝方式送 `$ct-exec` / `$ct:ct-exec`，必要）、3-2（ct-config 預設值層找 plugin）、3-3（skill 面板 / `*` 補全）；3-4 評估。驗證用 CT 提供的隔離試裝步驟（handover § 6，BMad-Guide `3021724`；判斷一律用分頁的 `CODEX_HOME`，不寫死 `~/.codex`）。不單獨發版，下一批一起出，發版後把版號回報 CT（CT 5.14.1 據此改最低 BAT 版本）。另：`6e00031c` 已補 `bat-notify --source` 說明（CT 5.13.1 ADVISORY 可選建議），隨下一版出
0. ✅ ~~BUG-172 / 173 實機驗收~~ → 2026-10-30 使用者以 `v0.7.1-pre.9` 驗收通過，CLOSED。下一版發 `0.7.2-pre.1`（D187）
1. 🔴 **BUG-171 實機驗收**（`v0.7.1-pre.8` 起）：日常使用遇 NTP 校時 / 睡眠喚醒不再「終端已恢復」、分頁不再 exit 1；可看 debug log `[heartbeat] late pong`。T0704 後續候選（TCP 模式 pid 重用、舊 server 結束失敗無補救、卡住但存活永不 recovery）暫不開單
2. 🔴 **外部測試者A 驗收**（`v0.7.1-pre.8`，更版重點「待驗收」清單）：BUG-165（macOS 觸控板 Codex 分頁捲動；之前設的 `mouse_scroll_speed = 3` 先移除）、BUG-166（`printf '\e[?1003h\e[?1006h'` 後移動滑鼠，殘骸幾筆即停）、BUG-169（安裝版 `bat-terminal.mjs --version`）→ 通過即 CLOSED
3. 🟢 **後續候選**：PLAN-055（recovery 後 agent 分頁可 `--resume`）；總覽計數加「需要處理」徽章（PAUSED / BLOCKED / PARTIAL…，T0702 建議 2）；BAT 封存區 3 檔 `status: CLOSED` 顯示 Invalid（T0702 建議 1）；BAT 自己的 `_tower-state.md` 在 CT v6 上線後寫入摘要；codex Worker 分頁也接管滾輪（T0698 Q-1 [B]，`externalAgent` 欄位）；T0698 e2e（選做未做）；Windows / Linux 滾輪一格行數是否過快待回饋
4. 🔴 `v0.7.1-pre.2` 剩餘實機驗收：BUG-156 需 Docker Desktop、BUG-159 需一般權限 + codex
5. 🟢 PLAN-053 Electron 42+、PLAN-052 Docker 可用性（IDEA）；PLAN-054 B6 延後（CT D090）；T0656 網站素材手動拍；`RECOVERY_PENDING` 未實機驗證；前期驗收（外部測試者A BUG-127-135 / 116 / 118、BUG-130 / 105 / 107 / 108 / 097 / 111、T0550、dmg / AppImage、NSIS 重裝、T0360）；dev PC／NAS 主機名稱（使用者未列入去識別化決定）

### ⚠️ 鐵則
- **所有 `gh` 指令必須帶 `-R gowerlin/better-agent-terminal`**（L122）
- 版本驗證用 diff / 雜湊，不用 grep（L127）；每次發版：`gh release edit --notes-file` 更版重點 → 更新 `CHANGELOG.md` / `release-note.md` / `README.md` 並 push → Pages 綠燈、首頁版號、`link-check`，才回報已發佈（L150）
- 公開 repo（D176）：工單 / commit / BUG 不寫真名、客戶名、家目錄路徑；push 前跑 `.private/` 的檢查樣式

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（熱區：Open 0 / Fixing 0 / Fixed 28 / Closed 9，2026-10-30 BUG-172 / 173 CLOSED；2026-10-26 第九十五 session `*archive` 歸檔 138 張：T 111 / BUG 21 / PLAN 6，熱區剩 T:103 / BUG:35 / PLAN:20 / EXP:1）｜ Backlog → [_backlog.md](_backlog.md)
- Decision Log → [_decision-log.md](_decision-log.md)（最大 D186）｜ Learnings → [_learnings.md](_learnings.md)（最大 L177）
- 網站 → https://gowerlin.github.io/better-agent-terminal/｜ 素材 spec → `e2e/site-media.spec.ts`（`BAT_SITE_MEDIA=1`，輸出 `e2e-media/`）
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)（112 entries）

### 編號起始
- **T0713** / **BUG-174** / **PLAN-056** / **D189** / **EXP-WFMINE-002**（其他 TOPIC 從 001） / **L178** / **CT-T023**

---

## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（另有 `scandnavik` remote；⚠️ gh 預設解析到 upstream，見 L122） |
| **目前版號** | **0.7.1-pre.8**（package.json + lock，2026-10-25 `c55de49e`）；前一筆記錄：**0.7.1-pre.6**（package.json + lock，2026-10-22 `8fb92004`；`0.7.1` 線，D168，最多到 pre.9） |
| **最新 release** | `v0.7.1-pre.6`（2026-10-22 02:14，run `39649193569`，target `8fb92004`：BUG-165 codex 分頁滾輪、BUG-169 helper 版號、T0692 用量限制 resumed、T0694 `↻`、內嵌 codex 0.163；Test gate tests 18:06:48Z → build 18:06:50Z；更版重點已寫；文件 `8bd1f47a`；Pages `39651190345` 綠、link-check 1274 / 0；exe 309 / zip 428 / AppImage 305 / dmg 322 MiB）+ `server-bundle-v0.7.1-pre.6`（7 assets）。前一版 `v0.7.1-pre.5`（2026-10-21 22:43，run `39617678592`，target `d0ebd708`：SSH 啟動失敗字首、內嵌 claude CLI 2.1.306、安裝檔只收 6 個執行期 helper、Test gate、MCP 寫入型 tool 政策、網站 `/why`；**Test gate 首次生效**：`tests / unit-tests` 14:32:29–14:36:27Z，build 14:36:30Z 才開始；更版重點已寫；exe 306 / zip 423 / AppImage 306 / dmg 319 MiB）+ `server-bundle-v0.7.1-pre.5`（7 assets；darwin-arm64 job 在 API 停在 `in_progress`，但每個 step 含 Complete job 都 success、tarball 已發佈，屬 GitHub 顯示問題）。前一版 `v0.7.1-pre.4`（2026-10-19 18:03，run `39233550117`，target `8883cebd`：BUG-166 滑鼠追蹤殘留自動 / 手動重設；更版重點已寫；repo 文件 `4ae0e89d`；Pages `39234927266` 綠、link-check 1152 / 0 errors、首頁 pre.4；exe 298 / zip 412 / AppImage 297 / dmg 309 MiB）+ `server-bundle-v0.7.1-pre.4`（7 assets）。前一版 `v0.7.1-pre.3`（2026-10-19 13:00，run `39201696170`，target `bf4bfe4f`：BUG-136 縮圖預覽上限、BUG-164 macOS 停用 Graphite + GPU 崩潰後重建；更版重點已寫；repo 文件 `892df2ec`；exe 298 / zip 412 / AppImage 297 / dmg 310 MiB）+ `server-bundle-v0.7.1-pre.3`（7 assets）。更早見 `release-note.md` / `CHANGELOG.md` |
| **前一 tag** | `v0.7.1-pre.5`（2026-10-21 22:43，`d0ebd708`） |
| **目前主軸** | `v0.7.1-pre.5` 已發佈（第八十八 session，D179 小批 T0687–T0690）；等 外部測試者A 驗收 BUG-166（pre.4 起）；BUG-165 有空再排；下一批候選 BUG-169；T0675 PARTIAL 等使用者下載 S2-04／05；熱區無進行中工單 |
| **工單最大編號** | **T0698** DONE `ec4b3c13`（第八十九 session：BUG-165 codex 分頁滾輪依累積行數送多個 SGR 回報，上限 8；Q-1 塔台代決只認 `agentPreset === 'codex-cli'`；`test:unit` 5891 passed）；T0697 DONE `3bdd34eb`（內嵌 codex 0.160 → 0.163，整合點皆無變動，e2e t0592 / t0621 綠）；T0696 DONE `4b25af6e`（第八十九 session：CT-T022 驗收情境 2，舊分頁已關 → `--close-worker` exit 3、照常派工）；T0695 DONE `76306429`（CT-T022 驗收情境 1，備援重派前回收 exit 0、收單 exit 0）；T0675 PARTIAL → DONE（使用者已下載 S2-04／05）；**T0694** DONE `cefb9db3`（第八十九 session：Worker 回報後又在執行顯示 `↻`、不列入批次關閉，D180；`test:unit` 5857 passed / 329 files；e2e t0694 / t0538 / t0609 / t0621 綠；Worker 已回收）；T0693 DONE `6f3f623c`（第八十九 session：研究 Renew 後 Worker 分頁 ✓ 是否該清除，只查不修；建議 a + d1 + d2，Worker 已回收）；T0692 FIXED `560409a3`（第八十九 session：`Usage limit reset · continuing automatically` 歸 `claude-cli-resumed`；`test:unit` 5812 passed；Worker 已回收）；T0691 FIXED `b0ff5673`（第八十九 session：BUG-169，electron-builder `afterPack` 寫只含 name / version 的 `resources/package.json`，`verify-packaged-native.js` 新增 `helper-version`；`test:unit` 5805 passed / 326 files；Worker 已回收）；T0690 DONE `09509698`（第八十八 session：內嵌 claude CLI 追版 2.1.300 → 2.1.306，核對全部無變動，D179 追加）；T0689 DONE `b9afa02e`（`v0.7.1-pre.5` 前小批：安裝檔只收 6 個執行期 helper，打包前後守門）；T0688 DONE `79412e61`（SSH `start-failed` 字首跟 `errorCode` 一致、`@` 測試）；T0687 DONE `873e6efb`（PLAN-054 B4 MCP 寫入型 tool 政策，只寫文件）；T0686 DONE `bb926fdc`（第八十八 session：Test gate：`tests.yml` 可重用、pre-release／release 加 `tests` job 並列進 `build.needs`；actionlint 0，含反向測試；未觸發發版）；T0685 DONE `063c4efb`（第八十八 session：CI 第二步：`test:legacy` 33 檔 472 項全過、tests.yml 加 legacy 步驟、刪 5 個失效 script、5 處註解、wsl-systemd describeError、start-failed 補 11 項測試、`tsx` 4.23.15 devDependency、CLAUDE.md 測試位置規則）；T0684 DONE `4d4bce72`（29 項改跨平台／不依賴時區：9 檔 Windows 與 Linux TZ=UTC 皆 202 / 202、無 skip；時區是測試假設、產品正確；D178 兩處 path.win32）；T0683 DONE `a35c4ce3`（第八十八 session：CI 第一步：helper-env 隔離 + 手動 `tests.yml`；WSL 模擬 ubuntu 9 檔 21 項寫死 Windows 的測試會失敗）；T0682 DONE `5bd04ef4`（G4：9 檔 37 / 37、缺 mock 直接失敗；塔台重跑 37 / 37，0.66 s）；T0681 DONE `eaf8c168`（G3：SSH／WSL 4 檔 47 項去重，新增 vitest 35 項、錯誤期望不搬；塔台重跑 122 / 122）；T0680 DONE `21ce7b79`（G2：4 檔收進 vitest，+55 項；塔台重跑 142 / 142）；T0679 DONE `6fb40e70`（第八十八 session：BUG-168 研究分類，全部 A、無回歸）；T0678 DONE `d90b3b50`（第八十八 session：BUG-167 遷移測試斷言 + tests/ 盤點）；T0677 DONE `e95b445e`（第八十八 session：去識別化第二批，D176 追加）；T0676 DONE `b8ea0f8b`（第八十八 session：公開 repo 去識別化，D176）；T0675 PARTIAL `c09fe063`（第八十八 session：NotebookLM 製作第二季 Podcast；S2-04／05 排程生成，使用者自行下載）；T0674 DONE `0f50a83d`（第八十八 session：網站新頁「把腦力留給判斷」`/why`，D175；已 push、Pages `39576224181` 綠）；T0673 DONE（第八十七 session：EXP-WFMINE-001 執行單，`84e21f2d`）；第八十六 session：T0670 / T0671 研究、T0672 修正；第八十五 session：T0666–T0669；更早見 `_archive/state-snapshots/` |
| **BUG 最大編號** | **BUG-170** FIXED（第八十九 session：CT v5.12.x 重派前回收，T0695 / T0696 驗收 PASS；原 OPEN low，第八十九 session：yolo 備援重派後舊 Worker 分頁讓 `--close-worker` AMBIGUOUS，T0693 推演，D180 先記錄）；BUG-169 FIXED low（第八十九 session T0691 `b0ff5673`；第八十八 session 開立：安裝版 helper 版號 v0.0.0，T0689 發現；熱區 Open 2（BUG-165 / 170）/ Fixed 25）；BUG-168 FIXED（第八十八 session：tests/ 未納入 test:unit 的測試失敗與逾時；T0680–T0685，ubuntu 試跑全過，擋版 T0686）；BUG-167 FIXED（第八十八 session：遷移測試斷言過時，T0678 `d90b3b50`）；BUG-166（第八十六 session 開立並 FIXED，待 外部測試者A）；BUG-165 OPEN（有空再排）；BUG-164 CLOSED（收工後 外部測試者A 確認）；BUG-136 第八十六 session CLOSED（外部測試者A 確認）；熱區 Open 1 / Fixing 0 / Fixed 22 / Closed 28；BUG-165 OPEN、BUG-166 FIXED（T0672 `64209d44`，未發版，第八十六 session） |
| **PLAN 最大編號** | **PLAN-054**（PLANNED：CT Workflow 智能的 BAT 側事項，B4 / B6，第八十七 session 2026-10-20）；PLAN-053 IDEA（Electron 42+ 升級，第八十五 session）；PLAN-052 / 051 IDEA；PLAN-049 / 047 DONE；PLAN-015 / 029 / 038 / 043 IDEA |
| **決策最大編號** | **D180**（Renew 後 Worker 分頁 ✓：T0693 方案 a + d1 + d2，旁支開 BUG-170，使用者決定，2026-10-22 第八十九 session）；D179（`v0.7.1-pre.5` 發版前先開小批 T0687–T0689，使用者決定，2026-10-21 第八十八 session）；D178（T0684 Q-1／Q-2 檢查 Windows 路徑用 path.win32，塔台代決，2026-10-21 第八十八 session）；D177（BUG-168 修正分組與 CI 兩步，2026-10-21 第八十八 session）；D176（公開 repo 去識別化，2026-10-21 第八十八 session）；D175（網站 `/why` 設計初衷，2026-10-21 第八十八 session）；D174（T0672 Q-1，2026-10-19 第八十六 session）；D173（網站示意可用 `_ct-workorders/`，放寬 D159 / D165 grep 規則一項，2026-10-19 第八十五 session）；D171 / D172 第八十四 session |
| **EXP 最大編號** | **EXP-WFMINE-001**（📊 CONCLUDED 2026-10-20 17:26；執行單 T0673 DONE `84e21f2d`，7.35M tokens／39 agents；BMad-Guide Workflow 智能提案 Phase 1 試點）；EXP-GPUWHIS-001（CONCLUDED，已歸檔） |
| **塔台版本** | Control Tower **v5.12.6**（第九十二 session 載入；第九十一 session v5.12.5；第九十 session v5.12.2；CT v5.12.3 起 `--close-worker` 最低 BAT 改為 `>= 0.6.1-pre.4`）；前次 v5.12.1（第八十九 session 重啟後載入；CT-T022 重派前回收舊 Worker 分頁）；前次 v5.11.0（第八十八 session 啟動時載入；本檔未記錄 v5.10 / v5.11 升級過程）；前次記錄 v5.9.0（第八十二 session 載入；CT-T021，BMad-Guide T0174，兩端；實機驗收結案 D071） |
| **unit test 基線** | **6130 passed / 343 files / 3 skipped**；`test:legacy` 472 / 0（塔台聯合驗證 @ `ae4602ed`，`0.7.2-pre.1` 批次，2026-10-30 第九十七 session，Node 26；typecheck 0 / 0、vite build 成功）。前次 5972 passed / 334 files / 3 skipped；`test:legacy` 472 / 0（塔台聯合驗證 @ `bfe7f0d6`，發 `v0.7.1-pre.7` 前，2026-10-25 第九十三 session；typecheck 0 / 0、vite build 成功）。前次 5661 passed / 322 files（@ `72d77cf1`，發 `v0.7.1-pre.4` 前，2026-10-19 第八十六 session） |

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
> 最後掃描:2026-10-23 06:50 (UTC+8) 第九十 session **Full Scan**（啟動時快照已 8 天，依 Startup Protocol 第 7 點；前次 Full Scan 2026-10-15 19:57）

| 偵測項 | 狀態 | 備註 |
|--------|------|------|
| 終端環境 | BAT | `BAT_SESSION=1`, port `9876`, workspace `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`, terminal `8131f1a6…`；無 `BAT_TOWER_TERMINAL_ID` |
| BAT 派發 | ✅ | 五項 dispatch env 齊備（PowerShell 確認）；另有 `BAT_USER_DATA` / `BAT_IDLE_TIMEOUT_MS` / `BAT_SCROLL_BUFFER_LINES` |
| BAT 安裝版 | ✅ `0.7.1-pre.6` | exe FileVersion `0.7.1-pre.6`（2026-10-22 02:13）；安裝版 `bat-terminal.mjs --version` → `v0.7.1-pre.6` exit 0（BUG-169 驗收項目的實機證據）；Tower `--set-role tower --mode on` exit 0；`bat_whoami` session 名稱 `better-agent-terminal · Tower` |
| BAT_HELPER_DIR | ✅ | `C:\Program Files\BetterAgentTerminal\resources\scripts` |
| BAT debug log | ✅ | `%APPDATA%\BetterAgentTerminal\Logs\debug-20261023-041137.log`（本次啟動） |
| 平台 | Windows 11 | PowerShell 主，Bash tool 並存；node `v24.22.1` / npm `12.2.1` |
| gh CLI | ✅ | **必須帶 `-R gowerlin/better-agent-terminal`**（L122） |
| git remote | 3 個 | `origin`=gowerlin / `upstream`=tony1223 / `scandnavik` |
| git 同步 | ✅ | `main` = `origin/main` @ `98e84050`（fetch 後 0 / 0）；工作區乾淨；另有 worktree `../.ct-integration/better-agent-terminal`（detached `4e5f5e7f`）；無 stash |
| 最新 CI / release | ✅ | Pre-Release 2026-10-21 18:02Z success → `v0.7.1-pre.6`；Pages 18:16Z success |
| Control Tower skills | ✅ v5.12.5 | control-tower 5.12.5（第九十一 session 啟動時；06:50 掃描時為 5.12.2） |
| 熱區單據 | **T:205 / BUG:55 / PLAN:25 / EXP:1** | BUG：FIXED 27 / CLOSED 28（與 `_bug-tracker.md` 一致）；PLAN：IDEA 7 / PLANNED 1（PLAN-054） |
| 非終態工單 | 無 | T0153 / T0543 ABANDONED（終態）；EXP-WFMINE-001 frontmatter 無 `status`（內文 CONCLUDED） |
| 最大編號 | **T0698 / BUG-170 / PLAN-054 / D181 / L174 / CT-T022** | 下張：T0699 / BUG-171 / PLAN-055 / D182 / L175 / CT-T023 |
| unit test / typecheck | 未重跑 | 最近：5891 passed / 331 files、typecheck 0 / 0（@ `767985e9`，第八十九 session 發 pre.6 前） |
| state 檔 | ⚠️ 31.9 KB | 超 30 KB 軟警告；季檔 `2026-Q4.md` 166,702 bytes（接近 200 KB 切割點）、INDEX 102 entries |
| 設定來源 | project | `_tower-config.yaml`（auto-session **on**，`yolo_max_retries: 1`，`auto_commit: on`，`worker_auto_close: done`，`worker_close_delay: 10`） |
| 塔台版本 | v5.12.5 | control-tower skill（第九十一 session） |

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
