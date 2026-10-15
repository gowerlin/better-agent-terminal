# Tower State — better-agent-terminal

> 最後更新:2026-10-15 18:16 (UTC+8) — **第六十四 session 收工**：Gary BUG-136 → T0533 GPU 日誌 → **`v0.6.1-pre.2`**；T0534 研究 → D144 / PLAN-041（Worker 分頁回收）+ PLAN-042（衍生修正）→ T0535-T0541 全 DONE → CT v5.1.0（CT-T011 / CT-T012）→ **`v0.6.1-pre.3`**；L150 晉升為發版說明規則。
>
> **下次起手**:Fast Path 載入；塔台改用 **Control Tower v5.1.0**（本 session 結束後生效）；等 Gary `v0.6.1-pre.3` 的 BUG-136 測試結果；PLAN-041 實機驗收（BMad-Guide T0136）；下一版 `0.6.1-pre.4`。
---

## 🛏 本 Session 收工快照 (第六十四 session, 2026-10-15 13:13 - 18:16, ~5h wall)

> 13:13 前另有程式碼簽章研究（網頁 artifact `MxxjPnrMFwhsbV3CA9NdEL`，無 commit，後續等使用者取得 Apple Developer / SSL.com 憑證）；起點未記錄。

### 主軸：Gary BUG-136 → **`v0.6.1-pre.2`**（GPU 日誌）→ T0534 研究 → D144 / PLAN-041 + PLAN-042 → T0535-T0541 → CT v5.1.0 → **`v0.6.1-pre.3`**

#### 時間線（時間取自系統 / git / gh）

1. **13:13** Gary 回報 macOS 舊 Codex 塔台分頁打字延遲（Renderer ~100% CPU、GPU 崩潰 5 次）→ 開 **BUG-136**；13:17 派 **T0533**（GPU 狀態日誌）→ 13:25 DONE（`5dee5bc2`）
2. **13:39** **`v0.6.1-pre.2` 已發佈**（run `38686989923` @ `9dde59f3`）——漏寫更版重點，18:0x 補上
3. **15:15** 使用者問收單後能否自動關 Worker 分頁 → 派 **T0534** 研究 → 15:26 DONE（推薦 B'）；說明網頁 artifact `E9ZBy1JRwibBXrwnMdB4LS`
4. **15:44** 使用者決定開關與延遲放 CT `*config`、不做 local_rule → **D144** / **PLAN-041**（T0535 / T0536 / T0537 / CT-T011）；16:13「完整版」納入方案 D（**T0538**），T0534 §8 衍生問題開 **PLAN-042** / **BUG-137**（T0539 / T0540 / CT-T012）
5. **16:15-17:30** 依序派發（同一工作樹不並行）：T0535 `f26b7641` → T0536 `26f6996e` → T0537 `e965f993` → T0538 `8fd7bdf7` → T0540 `a058fbd4` → T0539 `2ff55bdd`（BUG-137 FIXED），全部一次啟動、DONE
6. **17:14** BMad-Guide 塔台回報 **CT v5.1.0**（CT-T011 / CT-T012）已裝兩端（BMad-Guide `cb2aa09`，**未 push**）；塔台回覆 exit 1 =「本 session 後續不再呼叫」
7. **17:41** 派 **T0541**（內嵌 claude CLI 2.1.296 → 2.1.300）→ DONE（`1cb423c6`，模型 / 計價 / effort / 門檻皆無變動）
8. **17:47** 派 pre.3（`95d1f8e5`）→ **18:06 `v0.6.1-pre.3` 已發佈**（run `38715587426`，全 job success），更版重點已寫
9. **18:0x** 使用者指出 pre.2 無更版重點 → 補寫；**L150 晉升** `_local-rules.md`「更版重點（Release notes）必寫」（`a564e424`）
10. **18:1x** 收工：發現第六十三 session 收工時 `2026-Q4.md` 被覆寫（80,855 → 3,310 bytes，`b83a6909`），已由 `2f169514` 版本還原並補回第六十一 session

### 本輪戰績

| 類別 | 數量 | 備註 |
|------|------|------|
| 派發工單 | **9**（T0533-T0541） | 皆 DONE、一次啟動 |
| 跨專案委派 | 2（CT-T011 / CT-T012） | CT v5.1.0 source / install DONE；runtime 驗收 BMad-Guide T0136 |
| 發版 | 2（`v0.6.1-pre.2` / `v0.6.1-pre.3`） | 皆全 job 綠 + server-bundle 7 assets |
| BUG | 新開 2（136 OPEN / 137 FIXED） | Open 1 / Fixed 17 / Closed 44 |
| PLAN | 新開 2（041 IN_PROGRESS 待實機驗收 / 042 DONE） | |
| 決策 | D144 | 回收開關與延遲放 CT `*config`，BAT 只提供能力與安全檢查 |
| unit test | 3730 → **3939 passed / 237 files** | |

### 重點觀察

- 起手式已寫「發版說明（L150）」仍漏 pre.2 → 晉升為規則並存記憶；回報「已發佈」前必看 `gh release view --json body`
- 收工歸檔把季檔覆寫而非 append（第六十三 session）→ 本次已還原；收工時以 `wc -c` 前後比對季檔大小，只可增加
- 對 Gary 環境曾誤判「macOS 關閉後 terminal-server / codex 存活」，已更正；macOS `stopTerminalServer=false` 時 terminal-server 未存活，原因未查（入待辦）

### 編號起始（下 session）

- **T0542** / **BUG-138** / **PLAN-043** / **D145** / **L151** / **CT-T013**

---

## 🛏 前 Session 收工快照 (第六十三 session, 2026-10-15 01:14 - 02:10, ~56m wall)

### 主軸：Fast Path 起手 → 補第六十二 session 快照 → 連國盛回報 BUG-134 → T0531 → **`v0.6.0-pre.11`** → BUG-135 / T0532 → 版號線改 0.6.1（D143）→ **`v0.6.1-pre.1`**

#### 時間線（時間取自系統 / git / gh）

1. **01:14** Fast Path 起手：發現 state 漏記第六十二 session（T0526-T0530、pre.9 / pre.10）
2. **01:16** 使用者轉述連國盛回報（關閉工作區全部終端後主畫面殘留其他終端、像當機）→ 開 **BUG-134** / 01:17 派 **T0531**（`2c714f6`）
3. **01:22** 補第六十二 session 快照、歸檔第六十 session（INDEX 78，`2f16951`）；塔台誤報「pre.9 / pre.10 發布說明為空」（PowerShell `.Length` 量到行數），實際完整，未改 release
4. **01:22** 使用者本機 pre.10 重現 → 情境 (a) 確認（`c733adc`）
5. **01:27** T0531 DONE（`d41280a`）：根因為 CSS —— `.workspace-container.hidden` 用 `visibility: hidden`，子元素 `.workspace-tab-panel.active` 翻回 visible，空工作區透明容器透出隱藏工作區；`removeTerminal` focus 跨工作區為附帶缺陷 → 塔台聯合複驗全綠（`49af84c`）
6. **01:29** 使用者選 A → push + 派 pre.11；01:32 使用者同意修兩件小事 → 開 **BUG-135** / 派 **T0532**（`491e553`）
7. **01:44** T0532 DONE（`8b5251a`）：5 處 focus fallback 限 active 工作區、預設終端建立中顯示不透明 placeholder → 聯合複驗全綠（`7b5fcb6`）
8. **01:47** **`v0.6.0-pre.11` 已發佈**（run `38607028430` @ `49af84c`）；使用者要求改版號 0.6.1-pre.1 →（選「pre.11 跑完接著發」）→ 01:50 package.json bump + push + 派 run
9. **02:05** **`v0.6.1-pre.1` 已發佈**（run `38610008131` @ `e715c2b`，10 job 全綠）；兩版發布說明皆已寫入；02:08 **D143**（`646c77e`）

### 本輪戰績

| 類別 | 數量 | 備註 |
|------|------|------|
| 派發工單 | **2**（T0531 / T0532） | 皆 DONE、一次啟動 |
| 發版 | 2（`v0.6.0-pre.11` / `v0.6.1-pre.1`） | 各 10 job 全綠 + server-bundle 7 assets |
| BUG | 新開 2（134 / 135）→ 皆 FIXED | Open 0 / Fixed 16 / Closed 44 |
| 決策 | D143 | 預覽版版號線改 `0.6.1-pre.N` |
| unit test | 3713 → **3730 passed / 225 files** | |
| e2e（新） | `t0531-empty-workspace-view`、`t0532-default-terminal-no-empty-flash` | |

### 重點觀察

- 塔台在 Worker 進行中依半成品 diff 向使用者轉述根因（`removeTerminal`），與 Worker 最終結論（CSS visibility）不同 → 已更正；**Worker 未回報前不轉述根因**
- PowerShell 對 gh 多行輸出取 `.Length` 得到行數而非字數，造成「發布說明為空」誤判；檢查 release body 用 `gh release view --json body -q .body | wc -c` 或直接讀內容

### 編號起始（下 session）

- **T0533** / **BUG-136** / **PLAN-041** / **D144** / **L151**（第六十三 session 收工時）

---

## 🌅 起手式（Quick Recovery）

> 最後更新：2026-10-15 18:16 UTC+8（第六十四 session 收工）

### 近期完成
- `v0.6.1-pre.3`（10-15 18:06，run `38715587426` @ `95d1f8e5`）：Worker 分頁回收 `--close-worker`（PLAN-041）、分頁標示 / 批次關閉、BUG-137、Windows 關閉分頁程序樹（T0540）、內嵌 claude 2.1.300
- `v0.6.1-pre.2`（10-15 13:39，run `38686989923` @ `9dde59f3`）：GPU 狀態日誌（T0533，BUG-136 診斷）
- CT v5.1.0 已裝（`worker_auto_close` / `worker_close_delay`），BMad-Guide `cb2aa09` 未 push
- unit 3939 passed / 237 files；BUG Open 1（136）/ Fixed 17 / Closed 44

### 待辦（依優先序）

1. 🟡 **BUG-136**（Gary macOS 打字延遲）：等 Gary 以 pre.3 照新重現法回傳 `debug-*.log`（`[gpu]` 行）/ `.ips` / CPU；可能修正方向見 BUG 單（CanvasAddon context loss，不得破壞 Win11 `clearTextureAtlas`）
2. 🟡 **PLAN-041 實機驗收**：pre.3 + CT v5.1.0（BMad-Guide T0136）——真實 claude / codex Worker 閒置是否被判 `BUSY`；CT v5.1.0 尚未提供給 Gary（BMad-Guide 未 push）
3. 🟡 **待使用者決定**：安裝檔過大（pre.3 dmg 914 MB，D094 上限 280 MB）是否開單；Gary 日誌另案：macOS `stopTerminalServer=false` 時 terminal-server 未存活、啟動 `first-renderer-ipc` +8 s
4. 🟡 前期驗收：Gary BUG-127-135 / 116 / 118；使用者 Windows BUG-130 間歇性、真人項 BUG-105 / 107 / 108、Docker BUG-097 / 111
5. 🟢 程式碼簽章後續（mac Apple Developer、Windows SSL.com eSigner、CI 簽章）等使用者取得帳號；backlog：PID 鏈、遠端 cwd 檢查、`*archive` 到齡候選等

### ⚠️ 本專案 gh 鐵則（L122）
**所有 `gh` 指令必須帶 `-R gowerlin/better-agent-terminal`**。

### ⚠️ 版本驗證鐵則（L127）／更版重點必寫（L150 → `_local-rules.md`）
**不要用 grep 字串存在性判斷安裝版是否換新** —— 用 diff / 雜湊比對。**每次發版** run 完成後同一步 `gh release edit --notes-file` 寫更版重點，`gh release view --json body` 確認後才回報已發佈。

### 快速連結
- Bug Tracker → [_bug-tracker.md](_bug-tracker.md)（Open 1 / Fixing 0 / Fixed 17 / Closed 44）｜ Backlog → [_backlog.md](_backlog.md)
- Decision Log → [_decision-log.md](_decision-log.md)（最大 D144）｜ Learnings → [_learnings.md](_learnings.md)（最大 L150）
- 歷史 sessions → [_archive/state-snapshots/INDEX.md](_archive/state-snapshots/INDEX.md)（80 entries）

### 編號起始
- **T0542** / **BUG-138** / **PLAN-043** / **D145** / **EXP-[TOPIC]-001** / **L151** / **CT-T013**

---

## 📦 基本資訊

| 欄位 | 內容 |
|------|------|
| **專案** | better-agent-terminal |
| **Fork 上游** | tony1223/better-agent-terminal（另有 `scandnavik` remote；⚠️ gh 預設解析到 upstream，見 L122） |
| **目前版號** | **0.6.1-pre.3**（package.json + lock，2026-10-15 17:47 `95d1f8e5`） |
| **最新 release** | `v0.6.1-pre.3`（2026-10-15 18:06，run `38715587426`，target `95d1f8e5`：PLAN-041 Worker 分頁回收 + 分頁標示 / 批次關閉、BUG-137、T0540 程序樹、claude 2.1.300）+ `server-bundle-v0.6.1-pre.3`（7 assets）。前一版 `v0.6.1-pre.2`（2026-10-15 13:39，run `38686989923`，target `9dde59f3`，T0533 GPU 日誌）。再前 `v0.6.1-pre.1`（2026-10-15 02:05，`e715c2b1`，BUG-135）、`v0.6.0-pre.11`（01:47，`49af84ca`，BUG-134）。更早見 `_archive/state-snapshots/2026-Q4.md` |
| **前一 tag** | `v0.6.1-pre.2`（2026-10-15 13:39，`9dde59f3`） |
| **目前主軸** | `v0.6.1-pre.3` 已發佈；BUG-136 等 Gary；PLAN-041 實機驗收（CT v5.1.0） |
| **工單最大編號** | T0541（DONE `1cb423c6`）；T0533-T0541 全 DONE；跨專案 CT-T012 |
| **BUG 最大編號** | **BUG-137**（FIXED，T0539）；Open 1（BUG-136）/ Fixing 0 / Fixed 17 / Closed 44 |
| **PLAN 最大編號** | **PLAN-042**（DONE）；PLAN-041 IN_PROGRESS（BAT 端完成，待實機驗收）；PLAN-040 / 039 DONE；PLAN-038（IDEA）；PLAN-036 / 037 / 035 / 031 IN_PROGRESS |
| **決策最大編號** | D144 |
| **EXP 最大編號** | EXP-GPUWHIS-001（CONCLUDED，已歸檔） |
| **塔台版本** | Control Tower v5.1.0（2026-10-15 安裝，下個 session 生效；v5.0.9 備份於 `~/.claude/skill-backups/`） |
| **unit test 基線** | **3939 passed / 237 files / 1 skipped**（T0541 @ `1cb423c6`）；typecheck 0 / typecheck:electron 0 |

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
> 最後掃描:2026-10-15 01:21 (UTC+8) 第六十三 session（Fast Path 局部更新；前次 Full Scan 2026-10-13 15:40）

| 偵測項 | 狀態 | 備註 |
|--------|------|------|
| 終端環境 | BAT | `BAT_SESSION=1`, port `9876`, workspace `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`, terminal `66447ea9…` |
| BAT 派發 | ✅ | 五項 dispatch env 齊備（PowerShell 複核 2026-10-15 01:15）；T0531 派工 exit 0 |
| BAT 安裝版 | ✅ `v0.6.0-pre.10` | FileVersion 確認（2026-10-15 01:15） |
| BAT_HELPER_DIR | ✅ | `C:\Program Files\BetterAgentTerminal\resources\scripts` |
| BAT debug log | ✅ 單一目錄 | `%APPDATA%\BetterAgentTerminal\Logs\debug-<stamp>.log`（10-14 01:54 新檔）；`.userdata-migration.json` marker 存在（BUG-119） |
| 平台 | Windows | PowerShell 主，Bash tool 並存；repo 已有 `.gitattributes`（`* text=auto eol=lf`，T0493） |
| UAC | ⚠️ `EnableLUA=0` | BAT 與子 shell 皆提權（BUG-085 背景） |
| gh CLI | ✅ | 已登入 `gowerlin`；**必須帶 `-R gowerlin/better-agent-terminal`**（L122） |
| git remote | 3 個 | `origin`=gowerlin / `upstream`=tony1223 / `scandnavik` |
| git 同步 | ✅ | `main` = `origin/main`（2026-10-15 02:10 收工 push）；`src/styles/settings.css` 顯示 M 但內容無差異（未處理） |
| WSL | dev-deploy + docker | `~/.local/bat-server` tag `t0456`（舊）；WSL 內 `docker.io` 29.1.3（T0467 安裝，保留） |
| ct-exec / ct-done / ct-status / evolve / insights / fieldguide / help | ✅ | |
| 熱區工單 | **T:177 檔 / BUG:59 / PLAN:12** | `archive_days: 2` 下大量到齡候選（先 grep 程式碼引用，L133） |
| 最大編號 | **T0532 / BUG-135 / PLAN-040 / D143 / L150** | 下張：T0533 / BUG-136 / PLAN-041 / D144 / L151 |
| unit test | ✅ **3642 passed / 216 files** | 塔台聯合複驗 @ `b00c4f9` |
| typecheck | ✅ src 0 / electron 0 | CI gate |
| e2e | ✅ smoke / t0512 / t0513 / t0523 / t0524 6 passed | 需先 `npx vite build` |
| 開放 PR | 0 | |
| 設定來源 | project | `_tower-config.yaml`（auto-session **on**） |
| 塔台版本 | v5.1.0（2026-10-15 安裝，下個 session 生效） | control-tower skill |

> **Drift / 注意事項**:
> 1. 🔴 **D094 mac installer 280 MB cap 長期超標**未復議（L130）
> 2. ⚠️ `_ct-workorders/T0293-review-report.md` 含 2 個 NUL 位元組（既有）
> 3. ⚠️ **L132**：`T0292/T0293/T0298/T0302-*-report.md` 命名越界，維持現狀
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

- 2026-10-15 第六十三 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0531 / T0532 全 DONE，皆一次啟動；pre.11 / 0.6.1-pre.1 發佈
- 2026-10-14 第六十二 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0526-T0530 全 DONE；pre.9 / pre.10 發佈（第六十三 session 補記）
- 2026-10-14 第六十一 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0521-T0525 全 DONE，皆一次啟動（最多 2 張並行）；pre.8 發佈
- 2026-10-14 第六十 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0513-T0520 全 DONE，皆一次啟動；pre.7 發佈
- 2026-10-14 第五十九 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0510-T0512（T0510 PARTIAL、T0511 / T0512 DONE），皆一次啟動；pre.6 發佈
- 2026-10-13 第五十八 session：auto-session on，per-dispatch `--mode yolo --no-interactive`；T0467-T0509 全 DONE；pre.3 / pre.4 / pre.5；逐筆見 2026-Q4.md「第五十七～五十八 session 時間線」
- 2026-10-05 第五十六 session：session-only yolo（Worker 互動不允許）；D135 PLAN-039 T0462-T0466 全 DONE、皆一次啟動；斷點 C×8 由塔台裁決；逐筆見 2026-Q4.md「YOLO 歷程（第五十六 session）」
- 2026-10-05 第五十五 session：session-only yolo；D134（45 列）全 DONE；斷點 C 由塔台裁決；派工未啟動 2 次 + commit 前停住 1 次（BUG-114）；逐筆見 2026-Q4.md「YOLO 歷程（第五十五 session）」
- 2026-10-04 第四十九 session：session-only yolo；T0365-T0374，含 2 次外部動作閘（bump + push + pre-release 由使用者授權）；逐筆見 2026-Q4.md「YOLO 歷程（第四十九 session）」
- 2026-04-18 第三 session：CT-T003 DELEGATE PARTIAL → DONE；`*evolve` L057-L066；`*archive` 活躍引用豁免測試
- 2026-04-18 T0174 Phase 2-6 session：T0173 研究 DONE；首次斷點 C（事後確認，L064）；使用者中斷「停」驗證
- 2026-04-18 上半場（PLAN-020 開發）：7 張本專案 + 1 跨專案 DELEGATE，全 DONE，無斷點
- 2026-04-18 下半場第二 session：T0174 Phase 0-1 dogfood（無派發）
