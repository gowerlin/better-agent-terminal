---
schema_kind: tower-state
summary_version: 1
updated_at: "2026-11-05T07:43:49+08:00"
session: "2026-11-05 07:01 第一百二十一 session（CT v6.0.0-beta.11）"
next_ids:
  workorder: "T0865"
  decision: "D289"
  bug: "BUG-213"
  plan: "PLAN-066"
todo:
  - "▶ 派單已恢復（D288）：T0860 DONE（`44982662`）→ T0864 DONE（`7a07cfca`）→ T0861 IN_PROGRESS（07:43 派，`started:` 23:43:49Z）→ T0862"
  - "T0864 後續候選（未開單）：`e2e/fixtures/electron-isolation.ts` `launchIsolated` 統一預寫 `settings.json`（`checkForUpdates: false`＋`checkForUpdatesMigrated: true`），讓所有 e2e 都不連 GitHub（目前只有經 UI 存過設定再重開的流程會檢查）"
  - "T0860〈待 W6 驗收〉併入 T0862：N → N+1 真實升級保留 holder、`--updated` 解除安裝不碰 holder、真的解除安裝（per-user / per-machine）刪根目錄、降級、內嵌 claude 實機"
  - "本機 28 個 commit 未 push；push 前跑 `.private/` 去識別化與金鑰樣式檢查"
  - "✅ `0.7.4-pre.9` 已發佈（D284，run `41809413443` 全綠，publishedAt 2026-11-04T09:55:51Z，target `095470f7`，含 `server-bundle-v0.7.4-pre.9`）；更版重點已改寫；三文件＋版號已更新；Pages run `41811025246` 綠、首頁 pre.9、link-check 0；NSIS 重裝驗收 PASS-WITH-WARN（18:00，WARN = 原安裝版 pre.8，預期；備份已刪）；待：Docker Desktop（Windows / macOS）實機走精靈；🔴 0.7.4 線已用到 pre.9，下一版要先與使用者確認新版號線"
  - "PLAN-052（IN_PROGRESS，D282）：研究 T0848 DONE（`74f9e837`）——推薦 (c′) 基底映像＋bundle volume；「讀不到權杖」推論不成立（實測）；拆單 W1 權杖與安全／W2 選容器＋掛載／W3 重跑更新設定／W4a・W4b (c′)／W5 文件與驗收；D283 使用者裁決 U1–U5 皆照建議 → 實作 T0849 W1 `36a55028` ✅ ∥ T0850 W3 `c0ace27e` ✅（legacy 回歸由 T0855 `3d042497` ✅ 修）→ T0851 W2 `c3bda9ad` ✅ → T0852 W4a `2f0abf4b` ✅ → T0853 W4b `f8af303c` ✅ → T0854 W5 `2a2a1d8e` ✅；本批完成，待：push、GitHub 首跑 `docker-acceptance.yml`、發版、Docker Desktop（Windows / macOS）實機走精靈；後續候選：fetch-fingerprint Docker 分支比對憑證指紋、`scripts/docker-acceptance.mjs` 純函式單元測試 → T0852 W4a → T0853 W4b → T0854 W5（批次做完再一起發版）"
  - "✅ `0.7.4-pre.8` 已發佈並驗收（D280）：PLAN-063 ③ 一鍵接回 PASS（pre.7 → pre.8）、同版重裝中性 toast / 對話框 PASS（T0846 / T0847）、NSIS 完整重裝 PASS（15:00 判讀，備份已刪）；PLAN-063 DONE（D281），holder 模型移到 PLAN-065 IDEA"
  - "T0836 e2e 乾淨 HEAD 重跑：併入 T0844"
  - "T0843（D274，使用者「一起修好再發版」）：上傳失敗提示先講原因、檔名只出現一次；排在 T0841 後（同改 locales）"
  - "BUG-211 FIXED（T0842 `bb8cbe1a`）：待發版與遠端實機驗證（遠端視窗附 3 張 > 8 MiB 圖 → 提示、不送出、連線不斷；2 張照常）；後續候選：CLAUDE.md / multi-remote-profiles docs 補 `ws-limits.ts` / `FRAME_TOO_LARGE` 一行；fork 後自動送出 pending 圖片的路徑沒有面板檢查（只靠 client 守門）"
  - "本批（D271 / D272，做完一起發 `0.7.4-pre.7`＋PLAN-063 真實升級驗收）：DONE T0826 `83f1d5bf`、T0827 `93c6507a`、T0828（研究）、T0829 `841f5e6a`、T0830 `add1b932`、T0831（研究）、T0837（BUG-211 重現 `319c3646`）、T0838 `919a006e`、T0842 `bb8cbe1a`、T0832 `0382882b`（契約 C-1–C-10）、T0833 `8f8c4579`、T0839 `aaf5201b`、T0834 `61cd028c`、T0835 `64dbb3f4`、T0836 `d99eac4c`（e2e 12 項 PASS）、T0840 `790aacf9`（拋棄式發行版實測 PASS、已 unregister）、T0841 `715c30de`、T0843 `ab391de9`、T0844（驗證 PASS）、T0845 `e0e9e6b7`；待做：發版確認；PLAN-043 Phase 3（W5–W8）等驗收 VM 再開單"
  - "待實機驗收：T0827 Linux AppImage 缺字型提示（回報區〈待實機驗收〉4 項）；T0830 真 WSL 的 install-bundle 中止（`pkill tar`）與 keep-alive 關閉後閒置關機（`docs/wsl-deployment.md` Real WSL Pre-Flight Checklist）；T0832 smoke S14 對已部署 server（發版後 `node scripts/smoke-remote-headless.mjs --target wsl:<distro>`）；PLAN-038 實機 6 項（T0836 回報區〈待實機驗收〉：SSH claude 貼圖認成圖片、codex 收路徑、WSL Alt+V、WSL 其他 distro、macOS Finder 提示、真實拖放＋agent 讀檔）；T0840 精靈在真的 BAT 視窗對拋棄式發行版從頭跑一次（清單→套用→完成畫面），之後 W8 / 實機時一併；T0841「改用 Mirrored 並重試」實機（兩次 `wsl --shutdown`，步驟在 T0841 回報區〈待實機驗收〉）"
  - "T0830 後續候選（未開單）：SSH / Docker 精靈主行程長呼叫接 operation id；`src/components/profiles/types.ts` 補 `wslKeepAlive`；CLAUDE.md 是否補 keep-alive 開關 / 精靈中止的必守規則"
  - "MSRC 回報 microsoft/node-pty（使用者自行處理，D255）"
  - "PLAN-058：T0814（W1）`fc22e04a`＋T0815（W0）`0b67db03` DONE，T0819 安裝版 pre.5 假 API e2e PASS，待使用者手動確認（清單在 T0819 回報區）；可選後續：卡片等待時讓輸入框可送出（T0815〈遭遇問題〉1，未開單）"
  - "觀察：語音可用性檢查 macOS 未實機；`unknown(timeout)` 若實機出現可把逾時提到 30 s（T0802 後續建議）"
  - "PLAN-060（IDEA）：macOS Developer ID 簽章（目前 macOS 不顯示系統通知）"
  - "觀察：t0757 偶發失敗再發生才開 BUG（D218）"
  - "✅ T0863 DONE（`ee53eaf5`，D287）→ BUG-212 FIXED：檢查新版啟動一次、Help「Check for Updates…」、「包含預覽版」（預設開）、開該版本 Release 頁；待發版後實機驗證；併入 `0.7.5-pre.1`"
  - "版號線：`0.7.4-pre.N` 已用完（pre.1 – pre.9）；D285 起 **`0.7.5-pre.N`**，下一版 `0.7.5-pre.1`，等 PLAN-065 本批實作做完再發"
  - "PLAN-065（IN_PROGRESS，D285 / D286）：Windows 升級不中斷全部分頁的 PTY（holder＝官方 node.exe）；研究 T0856 DONE `7cb8a426` → 實作 T0857 W1 `db562330` ✅ ∥ T0858 W2 `aa59902e` ✅ → T0859 W3 `517541b5` ✅ → T0860 W4 `44982662` ✅ → （T0864 插隊）→ T0861 W5 → T0862 W6 真實升級驗收（需授權 push＋觸發 desktop-build ×2；情境 1–7 全 PASS 才發 `0.7.5-pre.1`）；真實的使用者升級保留要到 pre.1 → 下一版"
---
# Tower State — better-agent-terminal

> 🟢 **第一百二十一 session 開工**（2026-11-05 07:01 (UTC+8)，CT v6.0.0-beta.11，Fast Path；塔台 session `0681a600-06a6-44f6-8777-1ed0ae7cdc5a`；`--set-role tower --mode on` exit 0；`bat_whoami` 名稱 `better-agent-terminal · Tower`；安裝版 `0.7.4-pre.9`（FileVersion 與 helper 一致）；HEAD `b5b0d4d2`，領先 `origin/main` 24 個 commit（未 fetch）、工作區乾淨；熱區 259 張工單：DONE 256、PENDING 3（T0860–T0862，⏸ 派單暫停中）；`bat_list_questions` pending 0；熱檔皆 < 400 KB 預算）。第一百二十 session 的開工細節見下方收工快照與 T0856–T0863 工單回報區。07:02 使用者「B，恢復派單」→ **D288**：`checkForUpdates` 預設改開＋一次遷移既有 `false`，開 **T0864**（排 T0860 之後、T0861 之前）；解除派單暫停。07:03 派 T0860（`--mode yolo --no-interactive`，`started:` 23:03:26Z，分頁 `fb5268c4…`）。07:35 T0860 DONE（產品 `44982662`，9 檔皆在範圍內；holder 版升級只結束主行程＋idle 24 h＋結束安裝目錄下的程序並寫 schema 2、`--uninstall-quit-request`、`customUnInstall`；沒有 holder 走 T0823 原路徑；e2e 打包版＋真 holder 3 場景 PASS、NSIS 只編譯 PASS；unit 8224、legacy 472 / 33、typecheck 0 / 0；無提問）。偏離 2 項接受：強制結束改由請求行程以 pid 做（T0823 guard 禁 nsh 強制結束）、`t0823` e2e control 情境依 T0846 規則更新（自 T0846 起過時）。收單核對 commit 範圍、session id `fcc0b9cc` 與 BAT 一致；session 快照已寫；`--close-worker T0860 --delay-ms 10000` exit 0。後續建議寫進 T0861〈塔台補充（開工前）〉；〈待 W6 驗收〉併入 T0862。07:36 派 T0864（`started:` 23:36:34Z，分頁 `ccedc7a9…`）。07:42 T0864 DONE（產品 `7a07cfca`，12 檔皆在範圍內；純函式 `resolveCheckForUpdates`（`src/lib/check-for-updates-migration.ts`）、標記 `checkForUpdatesMigrated: true`、只有本機非 detached / 非 remote 視窗寫回一次、`main.ts` 未動、5 個 e2e spec 補標記；unit 8241、legacy 472 / 33、typecheck 0 / 0；無提問）。收單核對 session id `3800d91d` 一致；session 快照已寫；`--close-worker T0864 --delay-ms 10000` exit 0。T0861 補充第 6 點（e2e 標記寫法）。07:43 派 T0861（`started:` 23:43:49Z，分頁 `7978af06…`）。

> 最後更新:2026-11-04 19:30 (UTC+8) — **第一百二十 session 收工**：D285 版號線 `0.7.5-pre.N`、PLAN-065 啟動；T0856 研究 → D286 拆 T0857–T0862；T0857 / T0858 / T0859 DONE；D287 檢查新版改版 → T0863 DONE（BUG-212 FIXED）；使用者指示暫停派單。
>
> **下次起手**:⏸ **自動派單暫停中**（使用者說「恢復派單」才派）。① 先問使用者 **`checkForUpdates` 預設值**（T0863 後續建議 1：`settings-store.ts` 預設 `false`，存過設定的使用者啟動檢查實際是關的；選項 A 預設改開只影響新使用者／B 預設改開＋一次遷移既有 `false`／C 維持）；② 恢復後派 **T0860**（W4，開工前補充已寫）→ T0861 → T0862（T0862 需授權 push＋觸發 `desktop-build.yml` ×2＋新驗收 workflow；同時安排 `linux-acceptance` / `macos-acceptance` 跑「保留 server → 重開 → 接回」，T0857 後續）；③ 本機 **23 個 commit 未 push**（push 前跑 `.private/` 去識別化與金鑰樣式檢查）；④ `_tower-state.md` 45 KB 超軟警告 → 建議 `*archive --state`。

---

## 🛏 本 Session 收工快照 (第一百二十 session, 2026-11-04 18:04 - 2026-11-04 19:30, ~1h26m)

### 主軸：pre.9 NSIS 驗收 → PLAN-065 研究與 W1–W3 → 檢查新版改版（BUG-212）

#### 時間線（時間取自系統 / git）

1. **18:04** Fast Path；`--set-role tower --mode on` exit 0；安裝版 `0.7.4-pre.9`；讀 pre.9 NSIS 驗收 PASS-WITH-WARN（WARN = 原安裝版 pre.8）、刪 `userdata-backup` → `93b8055e`
2. **18:05–18:12** 使用者「處理 PLAN-065，下一版 0.7.5-pre.1」→ D285（版號線 `0.7.5-pre.N`、Windows only、全部分頁、先研究）→ 開並派 T0856
3. **18:25** T0856 DONE（`7cb8a426`）：做得到、規模 L；node-pty 用系統 conhost → 18:28 使用者 D1–D9 皆照建議 → D286 開 T0857–T0862 → 18:31 派 T0857 ∥ T0858
4. **18:33–18:36** 使用者要求檢查新版只在啟動時一次＋Help 檢查＋開 Release 頁 → 核對發現 `releases/latest` 404 → BUG-212、D287、開 T0863
5. **18:52 / 18:53** T0858 DONE（`aa59902e`）、T0857 DONE（`db562330`）；後續建議併入 T0859 / T0860；T0859 與 T0863 同改 `main.ts` → 循序 → 18:54 派 T0859
6. **19:14** T0859 DONE（`517541b5`）→ T0860 補充 → 19:15 派 T0863
7. **19:23** 使用者「T0863 收單後暫停派單」
8. **19:27** T0863 DONE（`ee53eaf5`）→ BUG-212 FIXED；T0862 補 exp 版號更新對話框注意事項 → `426f24a2`
9. **19:30** 收工（未 push）

### 本輪戰績
- 工單 DONE 5：T0856（研究）、T0857、T0858、T0859、T0863；開單 8（T0856–T0863）；未派 3（T0860–T0862）
- 決策 D285 / D286 / D287；BUG-212 開單 → FIXED；PLAN-065 IDEA → IN_PROGRESS
- 驗證基線（T0863 @ `ee53eaf5`）：unit 8186 passed / 447 files、legacy 472 / 33、typecheck 0 / 0、vite build
- 結構化提問 0；`worker_auto_close` 回收 5 次；全部 `--wait-started` 皆 `started:`

### 編號起始（下 session）
- **T0864** / **BUG-213** / **PLAN-066** / **D288** / **L186** / **CT-T023**

---

## 🌅 起手式（Quick Recovery）

> 最後更新：2026-11-04 19:30 UTC+8（第一百二十 session 收工）

### 近期完成
- **PLAN-065 W1–W3**（第一百二十 session）：T0857 協定 v1（hello＋TCP 權杖）、T0858 Windows PTY holder 打包（Node 24.22.2）、T0859 從 holder 啟動；T0863 檢查新版改版（BUG-212 FIXED）；皆未發版（等 `0.7.5-pre.1` 批次）
- **`v0.7.4-pre.7` – `pre.9` 發佈**（第一百一十六 – 一百一十九 session）：PLAN-038 上傳、PLAN-063 升級說明與真實升級 PASS、PLAN-052 Docker (c′)；pre.9 NSIS 驗收 PASS-WITH-WARN
- **`v0.7.4-pre.6` 發佈**（第一百一十四 session，run `41701904056`，target `4b726a86`）：PLAN-063 子項 1–3（T0821 / T0822 / T0823）、BUG-210（T0825）；NSIS 重裝驗收 PASS-WITH-WARN（第一百一十五 session）
- **`v0.7.4-pre.5`**（第一百一十三 session）：PLAN-058 W0 / W1（T0815 / T0814）、Terminal Server fork（T0816，BUG-209）
- **`v0.7.4-pre.4`**（第一百一十二 session）：Linux PTY / child_process 子程序 fd 繼承（T0806 / T0807，BUG-205 – 207）
- **`v0.7.4-pre.3`**（第一百一十一 session）：語音可用性事先檢查（T0802）、驗收腳本 `-Version` 必填（T0801）

### 待辦（依優先序；完整內容見 frontmatter `todo`）
1. ▶ 派單已恢復（D288）：T0860 進行中 → T0864（`checkForUpdates` 預設開＋遷移）→ T0861 → T0862（`0.7.5-pre.1` 批次）
2. PLAN-058：待使用者手動確認（清單在 T0819 回報區）；PLAN-052：Docker Desktop 實機
3. MSRC 回報 microsoft/node-pty（使用者自行處理，D255）
4. 觀察：語音可用性 macOS 未實機（T0802）、t0757 偶發失敗（D218）；PLAN-060 IDEA

### ⚠️ 鐵則
- **所有 `gh` 指令必須帶 `-R gowerlin/better-agent-terminal`**（L122）
- 版本驗證用 diff / 雜湊，不用 grep（L127）；每次發版：`gh release edit --notes-file` 更版重點 → 更新 `CHANGELOG.md` / `release-note.md` / `README.md` 並 push → Pages 綠燈、首頁版號、`link-check`，才回報已發佈（L150）
- 公開 repo（D176）：工單 / commit / BUG 不寫真名、客戶名、家目錄路徑；push 前跑 `.private/` 的檢查樣式
- 改 `_bug-tracker.md` / `_backlog.md` 不用全檔 `sed`，改完跑 parser 測試（L179）

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（熱區：Open 0 / Fixing 0 / Fixed 2（BUG-211 / 212）/ Closed 73 / WONTFIX 1）｜ Backlog → [_backlog.md](_backlog.md)
- Decision Log → [_decision-log.md](_decision-log.md)（最大 D287）｜ Learnings → [_learnings.md](_learnings.md)（最大 L185）
- 研究報告 Artifact「Herdr 對照 BAT」→ https://claude.ai/artifact/Ybj66gYLkMHZE8xUyyDiEy（私人）
- 網站 → https://gowerlin.github.io/better-agent-terminal/｜ 素材 spec → `e2e/site-media.spec.ts`（`BAT_SITE_MEDIA=1`，輸出 `e2e-media/`）
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)（134 entries；最新 `2026-Q4-c.md`）

### 編號起始
- **T0864** / **BUG-213** / **PLAN-066** / **D288** / **EXP-WFMINE-002**（其他 TOPIC 從 001） / **L186** / **CT-T023**

---

## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（另有 `scandnavik` remote；⚠️ gh 預設解析到 upstream，見 L122） |
| **目前版號** | **0.7.4-pre.9**（package.json + lock）；下一版 **`0.7.5-pre.1`**（D285 `0.7.5-pre.N` 線） |
| **最新 release** | `v0.7.4-pre.9`（2026-11-04T09:55:51Z，run `41809413443`，target `095470f7`：PLAN-052 Docker 遠端路線）；前一 tag `v0.7.4-pre.8`；更早見 `release-note.md` / `CHANGELOG.md` |
| **目前主軸** | PLAN-065（Windows 升級不中斷終端）W1–W3 DONE、W4–W6 未派（⏸ 派單暫停）；T0863 檢查新版 DONE；`0.7.5-pre.1` 等本批 |
| **工單最大編號** | **T0863** DONE（檢查新版，BUG-212；第一百二十 session）；T0860–T0862 PENDING |
| **BUG 最大編號** | **BUG-212** FIXED；熱區 Open 0 / Fixing 0 / Fixed 2 / Closed 73 / WONTFIX 1 |
| **PLAN 最大編號** | **PLAN-065** IN_PROGRESS；IN_PROGRESS 6（038 / 043 / 052 / 058 / 064 / 065）；IDEA 3 |
| **決策最大編號** | **D287**（檢查新版改版，第一百二十 session） |
| **EXP 最大編號** | **EXP-WFMINE-001**（📊 CONCLUDED 2026-10-20）；EXP-GPUWHIS-001（CONCLUDED，已歸檔） |
| **塔台版本** | Control Tower **v6.0.0-beta.11**（第一百零九 session 起） |
| **unit test 基線** | **8186 passed / 447 files**（T0863 Worker 回報 @ `ee53eaf5`）；typecheck 0 / 0、vite build、legacy 472 / 33 |
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
