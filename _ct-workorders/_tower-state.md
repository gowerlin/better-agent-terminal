---
schema_kind: tower-state
summary_version: 1
updated_at: "2026-11-05T11:58:29+08:00"
session: "2026-11-05 11:32 第一百二十四 session（CT v6.0.0-rc.1）"
next_ids:
  workorder: "T0870"
  decision: "D294"
  bug: "BUG-214"
  plan: "PLAN-066"
todo:
  - "✅ `0.7.5-pre.1` 發佈後驗收全 PASS（第一百二十四 session）：NSIS 重裝（11:31 `bat-nsis-acceptance-20261105-113131`，備份已刪）、linux-acceptance `41962694457`（22.04 / 24.04 各 4 passed）、macos-acceptance `41962698832`、docker-acceptance `41962703643`（pre.9 → pre.1）、WSL smoke `wsl:Ubuntu-24.04` 14/14（server `0.7.5-pre.1`，含 T0832 S14）"
  - "下一版前（PLAN-065 IN_PROGRESS 的最後一哩）：從 `0.7.5-pre.1` 升到下一版的真實使用者升級保留分頁；per-machine 未提權互動升級（UAC）手動驗收；降級到 `0.7.4-pre.9` 會結束所有終端且沒有說明（已寫在更版重點〈已知事項〉）"
  - "BUG-211 / 212 / 213 FIXED，已隨 `0.7.5-pre.1` 發佈，待實機驗證後 CLOSED：BUG-211 遠端視窗附 3 張 > 8 MiB 圖 → 提示、不送出、連線不斷（2 張照常）；BUG-212 Help「Check for Updates…」與啟動檢查找得到預覽版（需下一版才能實測找到新版）；BUG-213 帶 pipe 啟動 BAT 時保留的 holder 不讓呼叫端卡住"
  - "PLAN-052（IN_PROGRESS）：待 Docker Desktop（Windows / macOS）實機走精靈；後續候選（未開單）：fetch-fingerprint Docker 分支比對憑證指紋、`scripts/docker-acceptance.mjs` 純函式單元測試"
  - "PLAN-058：T0819 安裝版 pre.5 假 API e2e PASS，待使用者手動確認（清單在 T0819 回報區）；可選後續：卡片等待時讓輸入框可送出（T0815〈遭遇問題〉1，未開單）"
  - "待實機驗收：T0827 Linux AppImage 缺字型提示（回報區〈待實機驗收〉4 項）；T0830 真 WSL 的 install-bundle 中止與 keep-alive 關閉後閒置關機；PLAN-038 實機 6 項（T0836 回報區〈待實機驗收〉）；T0840 精靈在真的 BAT 視窗對拋棄式發行版從頭跑一次；T0841「改用 Mirrored 並重試」實機"
  - "候選（未開單）：T0864 後續 `e2e/fixtures/electron-isolation.ts` `launchIsolated` 統一預寫 `settings.json`（不連 GitHub）；T0867 後續 `terminal-server-protocol-v1.test.ts` B 組 line 214 同寫法改 `until()`；T0830 後續（SSH / Docker 精靈長呼叫接 operation id、`types.ts` 補 `wslKeepAlive`、CLAUDE.md keep-alive 規則）；BUG-211 後續（docs 補 `ws-limits.ts` / `FRAME_TOO_LARGE`、fork 後 pending 圖片路徑沒有面板檢查）"
  - "MSRC 回報 microsoft/node-pty（使用者自行處理，D255）"
  - "觀察：語音可用性檢查 macOS 未實機（`unknown(timeout)` 出現可把逾時提到 30 s，T0802）；t0757 偶發失敗再發生才開 BUG（D218）；PLAN-060（IDEA）macOS Developer ID 簽章"
  - "版號線：D285 起 `0.7.5-pre.N`，pre.1 已發佈，下一版 `0.7.5-pre.2`（`-pre.N` 最多到 pre.9）"
---
# Tower State — better-agent-terminal

> 🟢 **第一百二十四 session 開工**（2026-11-05 11:32 (UTC+8)，CT v6.0.0-rc.1，Fast Path；塔台 session `4383de43-387c-4326-a169-c3cb291e5803`；`--set-role tower --mode on` exit 0；`bat_whoami` 名稱 `better-agent-terminal · Tower`；安裝版 `0.7.5-pre.1`；HEAD `c77a1abd`，領先 `origin/main` 9 個 commit（未 fetch）、工作區乾淨；熱區 265 張工單全 DONE；`bat_list_questions` pending 0）。判讀 11:31 NSIS 驗收第三次（real）→ **PASS**（⓪–④ 全 PASS；③ debug log 新增 1 / 輪替 1 屬預期；④ 以 ③ 結束時快照為基準 0 差異）；含權杖 `userdata-backup` 已刪（11:33）。`0.7.5-pre.1` 發版後 NSIS 驗收完成。11:36 使用者選跑全部可自動化驗收（對 `0.7.5-pre.1`）→ ✅ `linux-acceptance` `41962694457`（22.04 / 24.04 各 4 passed）、✅ `macos-acceptance` `41962698832`（1 passed）、✅ `docker-acceptance` `41962703643`（from `0.7.4-pre.9` → to `0.7.5-pre.1`）全綠；WSL smoke `wsl:Ubuntu-24.04` 13 PASS / 1 SKIP（S14：WSL server bundle 仍 `0.7.3-pre.3`，早於 T0832；待使用者經精靈升級 WSL server 後重跑）→ 11:54 使用者已升級 WSL server 到 `0.7.5-pre.1`，重跑 **14/14 PASS**（S14 兩塊 262,208 B、目錄 0700 / 檔案 0600、sha256 相符、錯誤 offset → `BAD_OFFSET`、`claude:dispose-session` 清掉、未認證 socket 被拒；smoke PTY 皆已清除）。

> 最後更新:2026-11-05 11:58 (UTC+8) — **第一百二十四 session 收工**：`0.7.5-pre.1` 發佈後驗收全部 PASS（NSIS 重裝、linux / macos / docker acceptance、WSL smoke 14/14）；push 到 `79af45dd`；`*archive --state`。
>
> **下次起手**:熱區工單全 DONE、無派工中工單。① 下一版前：從 `0.7.5-pre.1` 升到下一版的真實升級保留分頁（PLAN-065 最後一哩）、per-machine 未提權互動升級（UAC）手動驗收；② BUG-211 / 212 / 213 已隨 pre.1 發佈，待實機驗證後 CLOSED；③ 候選未開單（frontmatter `todo`）可批次開單。

---

## 🛏 本 Session 收工快照 (第一百二十四 session, 2026-11-05 11:32 - 2026-11-05 11:58)

### 主軸：`0.7.5-pre.1` 發佈後驗收

#### 時間線（時間取自系統 / git）

1. **11:32** Fast Path；`--set-role tower --mode on` exit 0；判讀 11:31 NSIS 驗收第三次（real）PASS；刪含權杖備份 → `1406e7b3`
2. **11:36** 使用者選跑全部可自動化驗收 → 觸發 linux `41962694457` / macos `41962698832` / docker `41962703643`（pre.9 → pre.1）；WSL smoke 13 PASS / 1 SKIP（S14：server `0.7.3-pre.3`）
3. **11:50** 三個 CI 全綠（linux 22.04 / 24.04 各 4 passed、macos 1 passed、docker success）→ `88adafff`
4. **11:54** 使用者經精靈升級 WSL server 到 `0.7.5-pre.1` → smoke 14/14 PASS（T0832 S14 驗收完成）→ `79af45dd`
5. push 前掃描（`.private/` 檢查樣式＋金鑰樣式，12 commit 新增內容與訊息）0 筆 → push `7735ff9d..79af45dd`
6. **11:58** `*archive --state`（第一百二十 – 一百二十三 session → `2026-Q4-c.md`，INDEX 140 – 143）→ 收工

### 本輪戰績
- 工單 0（無派工）；決策 0；驗收 PASS 5（NSIS 重裝、linux、macos、docker、WSL smoke）
- 結構化提問 0；`worker_auto_close` 0

### 編號起始（下 session）
- **T0870** / **BUG-214** / **PLAN-066** / **D294** / **L186** / **CT-T023**

---

## 🌅 起手式（Quick Recovery）

> 最後更新：2026-11-05 11:58 UTC+8（第一百二十四 session 收工）

### 近期完成
- **`v0.7.5-pre.1` 發佈＋驗收全 PASS**（第一百二十一 – 一百二十四 session）：PLAN-065 W1–W6（Windows PTY holder，升級不中斷終端）、BUG-212 檢查新版、BUG-213 holder handle 繼承（N-API addon）；NSIS 驗收腳本 T0868 / T0869；NSIS 重裝 / linux / macos / docker / WSL smoke 全 PASS
- **`v0.7.4-pre.7` – `pre.9`**（第一百一十六 – 一百一十九 session）：PLAN-038 上傳、PLAN-063 升級說明與真實升級、PLAN-052 Docker (c′)
- **`v0.7.4-pre.6`**（第一百一十四 session）：PLAN-063 子項 1–3、BUG-210

### 待辦（依優先序；完整內容見 frontmatter `todo`）
1. 下一版前：pre.1 → 下一版真實升級保留分頁、per-machine UAC 互動升級手動驗收；BUG-211 / 212 / 213 實機驗證
2. PLAN-052：Docker Desktop（Windows / macOS）實機走精靈；PLAN-058：使用者手動確認（T0819 回報區）
3. 候選未開單：T0864 `launchIsolated` 預寫設定、T0867 B 組同寫法、T0830 / PLAN-052 後續
4. MSRC（使用者自行處理，D255）；觀察項（語音 macOS、t0757）；PLAN-060 IDEA

### ⚠️ 鐵則
- **所有 `gh` 指令必須帶 `-R gowerlin/better-agent-terminal`**（L122）
- 版本驗證用 diff / 雜湊，不用 grep（L127）；每次發版：`gh release edit --notes-file` 更版重點 → 更新 `CHANGELOG.md` / `release-note.md` / `README.md` 並 push → Pages 綠燈、首頁版號、`link-check`，才回報已發佈（L150）
- 公開 repo（D176）：工單 / commit / BUG 不寫真名、客戶名、家目錄路徑；push 前跑 `.private/` 的檢查樣式
- 改 `_bug-tracker.md` / `_backlog.md` 不用全檔 `sed`，改完跑 parser 測試（L179）

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（熱區：Open 0 / Fixing 0 / Fixed 3（BUG-211 / 212 / 213）/ Closed 73 / WONTFIX 1）｜ Backlog → [_backlog.md](_backlog.md)
- Decision Log → [_decision-log.md](_decision-log.md)（最大 D293）｜ Learnings → [_learnings.md](_learnings.md)（最大 L185）
- 研究報告 Artifact「Herdr 對照 BAT」→ https://claude.ai/artifact/Ybj66gYLkMHZE8xUyyDiEy（私人）
- 網站 → https://gowerlin.github.io/better-agent-terminal/｜ 素材 spec → `e2e/site-media.spec.ts`（`BAT_SITE_MEDIA=1`，輸出 `e2e-media/`）
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)（143 entries；最新 `2026-Q4-c.md`）

### 編號起始
- **T0870** / **BUG-214** / **PLAN-066** / **D294** / **EXP-WFMINE-002**（其他 TOPIC 從 001） / **L186** / **CT-T023**

---


## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（另有 `scandnavik` remote；⚠️ gh 預設解析到 upstream，見 L122） |
| **目前版號** | **0.7.5-pre.1**（package.json + lock）；下一版 **`0.7.5-pre.2`**（D285 `0.7.5-pre.N` 線） |
| **最新 release** | `v0.7.5-pre.1`（2026-11-05T02:58:21Z，run `41956896040`，target `e7461b37`：PLAN-065 Windows PTY holder、BUG-212 / 213）；前一 tag `v0.7.4-pre.9`；更早見 `release-note.md` / `CHANGELOG.md` |
| **目前主軸** | `0.7.5-pre.1` 發佈後驗收全 PASS；PLAN-065 等 pre.1 → 下一版真實升級保留；無派工中工單 |
| **工單最大編號** | **T0869** DONE（NSIS 驗收 ④ 基準，第一百二十三 session）；熱區 265 張全 DONE |
| **BUG 最大編號** | **BUG-213** FIXED；熱區 Open 0 / Fixing 0 / Fixed 3 / Closed 73 / WONTFIX 1 |
| **PLAN 最大編號** | **PLAN-065** IN_PROGRESS；IN_PROGRESS 6（038 / 043 / 052 / 058 / 064 / 065）；IDEA 3 |
| **決策最大編號** | **D293**（NSIS 驗收 ④ 基準，第一百二十三 session） |
| **EXP 最大編號** | **EXP-WFMINE-001**（📊 CONCLUDED 2026-10-20）；EXP-GPUWHIS-001（CONCLUDED，已歸檔） |
| **塔台版本** | Control Tower **v6.0.0-rc.1**（第一百二十二 session 起） |
| **unit test 基線** | **8355 passed / 456 files**（T0869 Worker 回報 @ `6269139c`）；typecheck 0 / 0、legacy 472 |
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
