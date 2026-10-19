# Tower State — better-agent-terminal

> 最後更新:2026-10-19 13:07 (UTC+8) — **第八十五 session 收工**：BUG-136 根因確認（縮圖預覽無上限累積，T0666 / T0667）、BUG-164 macOS GPU CHECK 崩潰（T0668 / T0669）→ 發 `v0.7.1-pre.3`；PLAN-053 IDEA；D173。
>
> **第八十六 session（15:33 起）**：Gary 15:19 回報打字卡頓已解決 → BUG-136 CLOSED；15:40 BUG-164 graphite disabled 已生效（另兩項待回報）；15:40 Gary 希望 Codex CLI 捲動更順 → BUG-165 OPEN、T0670 研究（15:44 追加平台範圍）；15:50 Gary 截圖：完成的 Worker 分頁滑鼠回報變成 shell 文字 → BUG-166 OPEN、T0671 研究。
>
> **下次起手**:等 Gary 回報 BUG-164（`skia_graphite=`、有無 GPU 崩潰）→ CLOSED 或退回；BUG-156 / 159 仍待特定環境；PLAN-053 等排程。
---

## 🛏 本 Session 收工快照 (第八十五 session, 2026-10-19 11:42 - 13:07, ~1h25m)

### 主軸：Gary macOS 日誌 → BUG-136 根因確認（縮圖預覽無上限累積）、GPU 崩潰拆成 BUG-164 → 兩者修正 → 發 `v0.7.1-pre.3`

#### 時間線（時間取自系統 / git / gh）

1. **11:42** 啟動（CT v5.9.0；BAT 安裝版 `0.7.1-pre.2`；`--set-role tower --mode on` exit 0；session 名稱 `better-agent-terminal · Tower`，不顯示提示）；發現早上 10:35 / 10:51 兩個未記錄的網站 commit（`45cbdaf0` / `3262b416`）
2. **11:44** 使用者貼 Gary 的 `ps` 與 `D:\Downloads\封存`（兩份日誌 + `103931.ips`）＋ Gary「Context used 20–30% 開始卡」→ T0666 研究 → **11:53 DONE**：假設 C（`TerminalThumbnail.tsx` 預覽無上限累積；alt screen 輸出沒有 `\n`，只在 macOS 發生）；GPU 崩潰不是必要條件
3. **11:55** 使用者指出網站的 `work-orders/` 應為 `_ct-workorders` → `3262b416` 已修好但未 push；**D173** 放寬網站 grep 規則；派 T0667（預覽上限）；push + Pages `39197192155` 綠
4. **12:05** T0667 DONE（`a9f0ad5a`，預覽 6.78 M → 256 字元）→ BUG-136 FIXED；**12:06** 使用者同意 GPU 崩潰另案 → **BUG-164**
5. **12:08** 使用者選 B（先查清 GPU 再一起發）→ T0668 符號化 → **12:21 DONE**：Chromium 146 `graphite_shared_context.cc:291` CHECK（`kOutOfOrderRecording`）；Chromium 147 / Electron 42 起改為 context lost
6. **12:4x** 使用者：派 A+B、開 **PLAN-053**（Electron 42+）；Gary 量測 `[714855, 1055128, 977397, 3358]` → 假設 C 確認；T0669 派工 → **12:50 DONE**（`32d62a45`）→ BUG-164 FIXED
7. **12:51–13:03** 塔台複驗（5635 passed / 321 files、typecheck 0 / 0、vite build）→ bump `bf4bfe4f` → run `39201696170` 全綠 → **13:00 `v0.7.1-pre.3`** → 更版重點 → 三文件 `892df2ec` → Pages `39202451234` 綠、link-check 1148 / 0 errors、首頁版號 pre.3
8. **13:07** 收工（使用者「收工, push」）

### 本輪戰績

| 類別 | 數量 | 備註 |
|---|---|---|
| 派發工單 | **4**（T0666–T0669） | 全部 `started:`；`worker_auto_close` 回收 4 次；無並行、無提問 |
| BUG | BUG-136 OPEN → FIXED（T0667）；BUG-164 新開 → FIXED（T0669） | 皆待 Gary 以 pre.3 實機確認；熱區 Open 0 / Fixing 0 / Fixed 23 / Closed 26 |
| PLAN / 決策 | PLAN-053 IDEA（Electron 42+）；D173（網站可顯示 `_ct-workorders/`） | |
| 發版 | 1（`v0.7.1-pre.3`） | exe 298 / zip 412 / AppImage 297 / dmg 310 MiB |
| unit test | 5597 → **5635 passed / 321 files** | 塔台複驗 @ `ee7d1047`（發版前） |

### 重點觀察

- 只看日誌容易被「GPU 崩潰時間吻合」誤導。T0666 同時讀原始碼、做實測（WSL 擷取 codex 位元組流、Electron 41 layout 量測），才找到和 GPU 無關的真因；Gary 跑一行 Console 指令就確認了
- Windows 的 ConPTY 會插入 `\n`，所以在 Windows 重現不了 macOS / Linux 的 alt screen 問題。macOS 專屬的現象改用 WSL 原生 PTY 擷取
- 符號化不需要 1.3 GB 的 dSYM：Electron 官方 breakpad 符號（123 MB）+ 反組譯 + 暫存器值，就能定位 CHECK 和狀態值。符號檔是 Electron 官方公開的，不必發給使用者

### 編號起始（下 session）

- **T0670** / **BUG-165** / **PLAN-054** / **D174** / **L171** / **CT-T022**

---

## 🛏 前 Session 收工快照 (第八十四 session, 2026-10-18 21:27 - 22:45, ~1h18m)

### 主軸：`v0.7.1-pre.2` 安裝版自動化驗收 → BUG-157 / 158 / 160 / 161 / 162 / 163 CLOSED；PLAN-047、PLAN-049 結案；網站 metadata 補齊上線

#### 時間線（時間取自系統 / git / gh）

1. **21:27** 啟動（CT v5.9.0；BAT 安裝版 FileVersion `0.7.1-pre.2` 確認；`--set-role tower --mode on` exit 0；本分頁 `better-agent-terminal · Tower`，不顯示提示）
2. **21:30** 使用者「從清單開始，只做能自動化的」→ T0663（BUG-157 / 158 / 160 / 161 / 163）＋ T0664（BUG-162）建單（`7a2387fa`），21:32 並行派工皆 `started:`；BUG-156（Docker Desktop）/ BUG-159（一般權限）不納入
3. **21:44** T0664 DONE（V0–V2 PASS；真實 claude haiku 1 回合，危險 rm 120 s 自動拒絕後 `post-tool-batch` 先於 `Stop` 清除）；**21:47** T0663 DONE（40 項：39 PASS / 1 NEEDS-HUMAN，24 個錯誤 code 本機觸發不了）
4. **22:24** 使用者同意 → 六張 BUG CLOSED、T0650 / 0652 / 0655 / 0657 / 0658 / 0660 DONE（`3ecf9049`）；T0663 觀察（`Expand` / `Collapse`、無自訂 focus 樣式）記入 BUG-161 殘留；順修 bug-tracker frontmatter 計數
5. **22:26** 使用者「看缺甚麼或可 done」→ PLAN-047 DONE（D171：M2 / M3 不續做；已知缺口 T0620 elicitation 未經安裝版實機；`a77c3dc1`，順修 backlog 計數）
6. **22:28** T0665 網站 description / 404 中文 → DONE 22:32（`c31c2db0`）→ 塔台補 `site/releases.md` `title: 更版紀錄` → push `bd061968..a300975b` → Pages run `39137082682` 全綠、link-check 1141 / 0 errors、線上 meta 確認
7. **22:44** PLAN-049 DONE（D172：手動素材改為使用者拍好後另開工單；`5fc14b8f`）
8. **22:45** 收工（使用者「收工, push」）

### 本輪戰績

| 類別 | 數量 | 備註 |
|---|---|---|
| 派發工單 | **3**（T0663–T0665） | 全部 `started:`；`worker_auto_close` 回收 3 次；最多 2 張並行；無提問 |
| BUG | 6 CLOSED（157 / 158 / 160 / 161 / 162 / 163） | 剩 BUG-156 / 159 FIXED 待特定環境；熱區 Open 1 / Fixed 21 / Closed 26 |
| PLAN / 決策 | PLAN-047 DONE（D171）、PLAN-049 DONE（D172） | 熱區已無 IN_PROGRESS PLAN |
| 網站 | 1 次上線 | link-check 0 errors |
| 新增 opt-in e2e | `e2e/v071-pre2-acceptance.spec.ts`、`e2e/v071-pre2-blocked-acceptance.spec.ts`、`e2e/real-remote/t0663-*` | `BAT_E2E_V071PRE2=1`（V2 另需 `BAT_E2E_REAL_CLAUDE=1`） |

### 重點觀察

- 安裝版自動化驗收（T0520 模式）可延伸到真實 claude：temp `CLAUDE_CONFIG_DIR` + 只讀 access token、1 回合即驗 hook 時序；`pty:write { auto: true }` 不算使用者輸入，可當驗收手段
- 塔台手改索引時 frontmatter 計數會落後於統計行（bug-tracker 40 / 20 / 19、backlog 22 / IDEA 5）→ 改索引要兩處一起改
- Worker 截圖可能拍進隔離實例權杖（T0663 `v1a-after-pin.png`，已失效、只在 temp）

### 編號起始（下 session）

- **T0666** / **BUG-164** / **PLAN-053** / **D173** / **L171** / **CT-T022**

---

## 🌅 起手式（Quick Recovery）

> 最後更新：2026-10-19 13:07 UTC+8（第八十五 session 收工）

### 近期完成
- `v0.7.1-pre.3` 發佈（第八十五 session，run `39201696170`）：BUG-136 縮圖預覽上限（T0667）、BUG-164 macOS 停用 Graphite + GPU 崩潰後重建（T0669）
- BUG-136 根因確認（T0666 研究 + Gary 量測）、BUG-164 符號化（T0668）；PLAN-053（Electron 42+）IDEA；D173
- `v0.7.1-pre.2` 安裝版自動化驗收：BUG-157 / 158 / 160 / 161 / 162 / 163 CLOSED（第八十四 session）
- PLAN-047 DONE（D171）、PLAN-049 DONE（D172）

### 待辦（依優先序）

1. 🔴 **Gary 以 `v0.7.1-pre.3` 驗收**：
   - ~~BUG-136：打字延遲~~ → ✅ 2026-10-19 15:19 Gary 確認解決，CLOSED（第八十六 session）
   - BUG-164：日誌有 `[gpu] skia graphite: disabled`、`skia_graphite=` 不再是 `enabled_on`、期間有無 `child-process-gone type=GPU`
   - 另請 Gary 補 10-15 的 `.ips`（看 `x21` 是否都 = 5）
   - 驗收訊息已給使用者轉貼
2. 🔴 `v0.7.1-pre.2` 剩餘實機驗收：BUG-156 需 Docker Desktop、BUG-159 需一般權限 + codex
3. 🟡 PLAN-053 Electron 42+ 升級（IDEA，Electron 41 已停更）；PLAN-052 Docker 可用性（IDEA）
4. 🟢 T0656 列的「需使用者手動拍」網站素材，拍好後另開小工單
5. 🟢 `RECOVERY_PENDING` 未經實機驗證；WSL bat-server 仍是 `0.6.1-pre.5`；前期驗收（Gary BUG-127-135 / 116 / 118、BUG-130 / 105 / 107 / 108 / 097 / 111、T0550、dmg / AppImage、NSIS 重裝、T0360）

### ⚠️ 本專案 gh 鐵則（L122）
**所有 `gh` 指令必須帶 `-R gowerlin/better-agent-terminal`**。

### ⚠️ 版本驗證鐵則（L127）／更版重點必寫（L150 → `_local-rules.md`）／發佈後同步 repo 文件與網站
**不要用 grep 字串存在性判斷安裝版是否換新** —— 用 diff / 雜湊比對。**每次發版** run 完成後同一步 `gh release edit --notes-file` 寫更版重點，`gh release view --json body` 確認後，再更新 `CHANGELOG.md` / `release-note.md` / `README.md` 並 commit + push，確認 Pages 綠燈、首頁版號、`link-check` summary，才回報已發佈。

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（熱區：Open 2 / Fixing 0 / Fixed 22 / Closed 27）｜ Backlog → [_backlog.md](_backlog.md)
- Decision Log → [_decision-log.md](_decision-log.md)（最大 D173）｜ Learnings → [_learnings.md](_learnings.md)（最大 L170）
- 網站 → https://gowerlin.github.io/better-agent-terminal/｜ 素材 spec → `e2e/site-media.spec.ts`（`BAT_SITE_MEDIA=1`，輸出 `e2e-media/`）
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)（100 entries）

### 編號起始
- **T0672** / **BUG-167** / **PLAN-054** / **D174** / **EXP-[TOPIC]-001** / **L171** / **CT-T022**

---

## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（另有 `scandnavik` remote；⚠️ gh 預設解析到 upstream，見 L122） |
| **目前版號** | **0.7.1-pre.3**（package.json + lock，2026-10-19 `bf4bfe4f`；`0.7.1` 線，D168，最多到 pre.9） |
| **最新 release** | `v0.7.1-pre.3`（2026-10-19 13:00，run `39201696170`，target `bf4bfe4f`：BUG-136 縮圖預覽上限、BUG-164 macOS 停用 Graphite + GPU 崩潰後重建；更版重點已寫；repo 文件 `892df2ec`；exe 298 / zip 412 / AppImage 297 / dmg 310 MiB）+ `server-bundle-v0.7.1-pre.3`（7 assets）。更早見 `release-note.md` / `CHANGELOG.md` |
| **前一 tag** | `v0.7.1-pre.2`（2026-10-18 20:55，`9c5fe2b1`） |
| **目前主軸** | `v0.7.1-pre.3` 已發佈（第八十五 session），等 Gary 驗收 BUG-136 / BUG-164；熱區無進行中 PLAN / 工單 |
| **工單最大編號** | **T0669** DONE（第八十五 session：T0666 / T0668 研究、T0667 / T0669 修正）；第八十四 session：T0663–T0665；更早見 `_archive/state-snapshots/` |
| **BUG 最大編號** | **BUG-164**（第八十五 session 開立並 FIXED，待 Gary）；BUG-136 第八十六 session CLOSED（Gary 確認）；熱區 Open 2 / Fixing 0 / Fixed 22 / Closed 27；BUG-165 / 166 OPEN（第八十六 session） |
| **PLAN 最大編號** | **PLAN-053**（IDEA：Electron 42+ 升級，第八十五 session）；PLAN-052 / 051 IDEA；PLAN-049 / 047 DONE；PLAN-015 / 029 / 038 / 043 IDEA |
| **決策最大編號** | **D173**（網站示意可用 `_ct-workorders/`，放寬 D159 / D165 grep 規則一項，2026-10-19 第八十五 session）；D171 / D172 第八十四 session |
| **EXP 最大編號** | EXP-GPUWHIS-001（CONCLUDED，已歸檔） |
| **塔台版本** | Control Tower **v5.9.0**（第八十二 session 載入；CT-T021，BMad-Guide T0174，兩端；實機驗收結案 D071） |
| **unit test 基線** | **5635 passed / 321 files / 3 skipped**（塔台複驗 @ `ee7d1047`，發 `v0.7.1-pre.3` 前，2026-10-19 第八十五 session；typecheck 0 / 0、vite build 成功） |

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
