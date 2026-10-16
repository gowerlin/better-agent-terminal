---
schema_version: 1
schema_kind: workorder
id: T0556
title: "T0555 後續：nvm 安裝 / 更新時，在 bash login 實際會讀的 profile 檔追加「nvm 尚未載入才載入」的片段（冪等、可辨識），讓非互動 login shell（`bash -lc`）也找得到 nvm 管理的 node"
type: feature
status: DONE
repo: better-agent-terminal
project: "T0555 後續（使用者決定，第六十六 session）"
priority: P2
sizing: S
created_at: "2026-10-16T04:52:56+0800"
updated_at: "2026-10-16T05:08:50+0800"
started_at: "2026-10-16T04:53:46+0800"
completed_at: "2026-10-16T05:08:50+0800"
commit: "e16e75b8"
target_version: "0.6.1-pre.5（與 T0551–T0555 同批）"
depends_on: [T0555]
related:
  - "T0555（`e9cae8d8`；PARTIAL：`bash -lc` 看不到 nvm 的 node，回報區「遭遇問題 1」選項 b）"
  - "`src/lib/remote-tools/recipes.ts`（node install / update 指令、notes）、`docs/remote-dev-overview.md`「Remote tools: Node.js via nvm (T0555)」"
affects_files:
  - src/lib/remote-tools/recipes.ts
  - "src/lib/remote-tools/__tests__/**（含 snapshot）"
  - "src/components/remote-tools/**（若 notes / 對話框文字需調整）"
  - "src/locales/*.json（三語）"
  - "e2e/t0555-node-nvm-wsl.spec.ts（僅在需要時補斷言，opt-in 行為不變）"
  - docs/remote-dev-overview.md
  - _ct-workorders/T0556-nvm-login-shell-profile-snippet.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`；工單檔一併 commit（`src/styles/settings.css` 的 M 不是你的變更；`_ct-workorders/T0555-*.md` 的回報區由塔台處理，不要改）。"
  - "🔴 使用者已核准：在 WSL `Ubuntu-24.04` 的使用者 profile 檔**只追加**一段 nvm 載入片段。動之前備份該檔（路徑寫進回報區）；不得刪改檔案其他內容；不動 `.bashrc`（T0555 的 nvm 片段已在）。不碰 `/mnt/c`、nvm4w、使用者 BAT（9876）；WSL server 結束時 9877、active、指紋不變（若需部署測試版 server JS，結束時 rollback，同 T0555）。"
  - "🔴 不改 nvm 本身的安裝方式（釘選 tag `v0.40.8`、`METHOD=script`、`NVM_DIR` 先設定皆維持 T0555）。"
---

# T0556 — nvm：讓 `bash -lc` 也找得到 node

## 背景

T0555 讓遠端工具的 Node.js 可以透過 nvm 一鍵安裝。BAT 偵測與 BAT 終端都看得到 node，但非互動 login shell（`bash -lc 'command -v node'`）看不到：nvm 官方只在 `~/.bashrc` 結尾追加載入片段，而 Ubuntu 預設 `.bashrc` 對非互動 shell 在開頭就 `return`。遠端的 AI agent / 工具（例如 `npx` 啟動的 MCP server、agent 執行的指令）常以非互動 login shell 執行，所以這個缺口有實際影響。使用者 2026-10-16 選擇 T0555 回報的選項 b，並要求加上防重複。

## 任務

1. **目標檔案**：bash 的 login shell 只讀 `~/.bash_profile`、`~/.bash_login`、`~/.profile` 中**第一個存在的**。片段要寫進那個檔案；三個都不存在時建立 `~/.profile`。（若存在的是 `~/.bash_profile` 卻不讀 `.profile`，寫進 `.profile` 就無效。）macOS（SSH 目標）同一規則；zsh 的 `~/.zprofile` 不在本單範圍，回報區說明。
2. **片段**：以標記註解包住，可辨識、冪等（已存在就不再追加），內容為「`NVM_DIR` 設定 + nvm 尚未載入才載入 `nvm.sh`」（例如 `command -v nvm >/dev/null 2>&1 || [ ! -s "$NVM_DIR/nvm.sh" ] || . "$NVM_DIR/nvm.sh"`，實際寫法由你決定）。要求：
   - POSIX `sh` 相容（`.profile` 也會被 `sh` / dash 讀）
   - 互動 login shell（`.profile` 再 source `.bashrc`）不會載入兩次
   - nvm 不存在或 `nvm.sh` 損毀時不讓 login 失敗、不印錯誤
3. **套用時機**：install 指令在 `nvm alias default` 之後追加；update 指令也確保片段存在。這樣 T0555 已裝過的環境（例如使用者的 WSL）按一次「更新」就能補上。追加動作要冪等，重複按不會累積。
4. **說明文字**：確認對話框的 notes（三語）改為「會在 `.bashrc` 與 login profile 檔加入 nvm 載入片段」，移除 T0555 的「`bash -lc` 看不到」限制說明；更新 `docs/remote-dev-overview.md`。
5. **測試**：
   - 食譜 snapshot / 單元：install / update 都含片段、標記、冪等判斷、目標檔案選擇。
   - 真 shell 實跑（比照 T0552 / T0554 的 Git Bash `sh` 測試；Windows 無 dash 時另在 WSL 手動跑並記錄）：三種 profile 檔組合、重複執行不重複追加、`sh -lc` / `bash -lc` / `bash -lic` 都找得到 node、nvm 不存在時 login 正常且無輸出。
6. **WSL 實機**（`Ubuntu-24.04`，已由 T0555 裝好 nvm + Node 24.22.0）：以隔離實例（本機 build）對 Node.js 按「更新」→ 片段寫入 → `wsl -d Ubuntu-24.04 --exec bash -lc 'command -v node'` 找得到；再按一次「更新」→ 片段不重複；列出 profile 檔前後 diff 與 sha256；smoke 13/13。

## 驗收條件

- [ ] `bash -lc` / `sh -lc` 找得到 nvm 管理的 node；`bash -lic` 不載入兩次
- [ ] 片段冪等、有標記、只追加；寫進 bash login 實際會讀的檔案
- [ ] install 與 update 都會套用；三語說明已更新
- [ ] `npm run test:unit` 全綠（基線 4345 passed / 252 files，加上新測試）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功
- [ ] WSL 實機通過、smoke 13/13；profile 檔備份路徑與 diff 寫進回報區

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

**DONE**：驗收條件全部通過。WSL 實機按兩次「更新」：第一次寫入片段，第二次不重複。之後 `bash -lc` 與 `sh -lc` 都找得到 `/home/gower/.nvm/versions/node/v24.22.0/bin/node`；`bash -lic` 只載入一次 nvm.sh。smoke 13/13。

Commit：`e16e75b8` feat(remote-tools): T0556 nvm loader block for bash login shells（11 檔，未 push）；本收尾 metadata 另一個 commit。

落點檢查：**PASS**
- C-0：`repo`=`better-agent-terminal`，`basename(REPO_ROOT)`=`better-agent-terminal`，相符
- C-1：工單位於 REPO_ROOT 底下
- C-3：`affects_files` 抽查的項目都存在（C-0 已 PASS，此項只作紀錄）
- C-2：工單沒有 `branch` 欄位；HEAD 為 `main`
- 只作紀錄：`BAT_WORKSPACE_ID`=`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`、`CT_MODE`=`yolo`、`CT_INTERACTIVE`=`0`
- 工單開工時 status 為 `TODO`（不是 `PENDING`），照常改成 `IN_PROGRESS`

### 產出摘要

**食譜**（`src/lib/remote-tools/recipes.ts`）
- 新增匯出常數 `NVM_PROFILE_MARKER_BEGIN` / `NVM_PROFILE_MARKER_END` / `NVM_PROFILE_SNIPPET_LINES` / `NVM_PROFILE_COMMAND`。
- 寫入的片段（前面空一行，以標記註解包住）：
  ```sh
  # >>> nvm loader for login shells (added by BetterAgentTerminal) >>>
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ "$(command -v nvm 2>/dev/null)" != nvm ] && [ -s "$NVM_DIR/nvm.sh" ]; then command . "$NVM_DIR/nvm.sh" >/dev/null 2>&1; fi
  # <<< nvm loader for login shells (added by BetterAgentTerminal) <<<
  ```
  - **POSIX sh 相容**：只用 `[ ]`、`$( )`、`command`、`.`。
  - **不重複載入**：只有 `nvm` 還不是 shell function 時才載入。實作時發現 `command -v nvm >/dev/null` 不夠：Git Bash 與 WSL interop 的 PATH 上有 nvm-windows 的 `nvm` 程式，會被當成「已載入」而跳過（第一版真 shell 測試就是因此失敗）。改成比對輸出：function 時 `command -v` 只印名稱 `nvm`，程式則印路徑。
  - **nvm 壞掉不影響 login**：
    - 用 `command .`：dash 與 bash-as-sh 遇到 dot script 語法錯誤時，非互動 shell 會直接結束。實測 plain `.` 後面的指令不會執行，`command .` 則只讓 dot 失敗。
    - 輸出全部丟到 `/dev/null`。
    - nvm.sh 不存在或為空時 `[ -s ]` 會跳過。
- **追加指令**：
  ```
  ( p="$HOME/.profile"; for f in "$HOME/.bash_profile" "$HOME/.bash_login"; do if [ -e "$f" ]; then p="$f"; break; fi; done; if grep -qsF '<begin marker>' "$p"; then echo "… already in $p"; else printf '\n%s\n%s\n%s\n%s\n' '<4 行>' >> "$p" && echo "… added to $p"; fi )
  ```
  - **目標檔案**：`~/.bash_profile` → `~/.bash_login` → `~/.profile` 中第一個存在的；三個都沒有時建立 `~/.profile`。判斷用 `-e`，與 bash 相同：檔案存在但不可讀時，bash 也不會往下找（`maybe_execute_file` 遇到非 ENOENT 錯誤就停）。
  - **冪等**：檔案裡已有 begin marker 就不動。
  - **只追加**：唯一的寫入是 `>> "$p"`。
  - **不污染分頁 shell**：整段在 subshell 內執行，`p` / `f` 不會留在分頁 shell。
- **套用時機**：
  - install：接在 `nvm alias default 'lts/*'` 之後（`&&`）。
  - update：放在 `. "$NVM_DIR/nvm.sh"` 之後、版本比對之前。所以即使已是最新 LTS，或連不上 nodejs.org，片段也會補上。T0555 已裝的環境按一次「更新」即可。

**說明文字（三語）**
- `remoteTools.note.nvmEditsProfile`：刪除「bash -lc 不會載入」的限制說明，只保留「nvm 會改 `.bashrc`」。
- 新增 `remoteTools.note.nvmLoginProfile`：說明 BAT 會在 bash login profile 加入有標記的片段、檔案的選擇規則、只加一次、不重複載入、讓 `bash -lc` 也找得到 node。
- install notes 與 update notes 都會列出這一條。

**文件**：`docs/remote-dev-overview.md` 的「Remote tools: Node.js via nvm (T0555)」一節：
- 新增「Login profile block (T0556)」小節：片段全文、目標檔案規則、冪等、`command .`、`.bash_profile` 存在時 `sh -lc` 讀不到。
- 更新 Update 與 Non-interactive shells 兩段，以及實機驗證說明。

**測試**
- `src/lib/remote-tools/__tests__/recipes.test.ts`（含 snapshot，node 的 20 行更新）：
  - install / update 的完整指令
  - install 最後一步是片段
  - update 中片段排在版本比對之前
  - 片段的標記
  - 每行都不含單引號與 bash 專屬語法
  - 目標檔案順序
  - 唯一寫入為 `>> "$p"`，且整段包在 subshell
- **新增** `src/lib/remote-tools/__tests__/nvm-login-profile.test.ts`（24 項，真 shell，`@vitest-environment node`）。Windows 上用 Git Bash 的 `sh` / `bash` / `dash`，Git Bash 附有 dash，三種都實際跑過，沒有 skip。以暫存 `$HOME` 搭配假 nvm（會計算載入次數，也會往 stdout / stderr 印字）：
  - **目標檔案**：
    - 無檔 → 建 `.profile`
    - 只有 `.profile` → 追加在原內容後面
    - 原檔無結尾換行時也能正確追加
    - 5 種 `.bash_profile` / `.bash_login` / `.profile` 組合 → 寫進 bash 會讀的那一個，其他檔不動
  - **冪等**：重複執行不累積；只留 begin marker 的手改片段也不再追加。
  - **login 行為**：
    - 加片段前，`bash -lc` 看不到 nvm 的 node（T0555 的缺口重現）
    - `sh -lc` / `dash -lc` / `bash -lc` 都找得到 node、載入 1 次、nvm 的輸出不外漏
    - `bash -lic` 只載入 1 次（由 `.bashrc` 載入，片段跳過）
    - `.bash_profile` 版面同樣成立
    - PATH 上有名為 `nvm` 的程式時仍會載入
  - **壞掉的 nvm**：`~/.nvm` 不存在、nvm.sh 為空、nvm.sh 有語法錯誤三種情況，在 `sh` / `bash` / `dash -lc` 下，有片段與沒片段的 stdout、stderr、exit code 完全相同。
- `src/components/__tests__/remote-tools-panel.test.tsx`：
  - install 對話框顯示 `nvmLoginProfile`，且 `nvmEditsProfile` 不再提到 `bash -lc`
  - 新增 update 對話框測試：顯示兩條 note，指令含片段
- **WSL 手動真 shell**（Ubuntu-24.04 的 dash / bash；暫存 HOME 在 `/tmp/bat-t0556-*`，以 `/etc/skel` 的 `.profile` / `.bashrc` 加上 nvm 片段模擬，跑完即刪，不碰使用者檔案）：
  - 加片段前 `bash -lc` → `node-not-found`
  - 追加兩次 → marker 1 個
  - `sh -lc` / `dash -lc` / `bash -lc` 都找得到 node，loads=1
  - `bash -lic` loads=1
  - `bash -x` trace：`-lic` 只出現 `++ . …/nvm.sh`（來自 `.bashrc`），`-lc` 只出現 `+ command . …/nvm.sh`（來自片段）
  - nvm.sh 語法錯誤或不存在時，三種 shell 都正常印出 `login-ok`
- **e2e**：在 `e2e/t0555-node-nvm-wsl.spec.ts` 新增一個獨立 test：
  - 由 `BAT_E2E_T0556=1` 開啟，需要已裝 nvm 的 distro：按兩次「更新」，檢查片段只加一次、只追加、`bash -lc` / `sh -lc` / `bash -lic` 結果、xtrace 載入次數、偵測結果。
  - T0555 安裝測試仍只由 `BAT_E2E_T0555=1` 開啟，行為不變。只多一個斷言：安裝後 `bash -lc` 必須找得到 node，因為安裝指令現在也會寫入片段。原本「只記錄、不斷言」的註解已更新。

**驗證**
| 項目 | 結果 |
|---|---|
| `npm run test:unit` | PASS：253 檔，4372 passed，3 skipped（基線 252 檔 / 4345；+1 檔、+27 項） |
| `npm run typecheck` | exit 0 |
| `npm run typecheck:electron` | exit 0 |
| `npx vite build` | 成功（exit 0） |
| WSL 實機：隔離實例（本機 build）→ Profiles 卡片工具面板 → Node.js「更新」→ 確認 | PASS：exit 0，輸出 `nvm loader for login shells added to /home/gower/.profile`、`Node.js v24.22.0 is already the latest LTS` |
| 第二次「更新」 | PASS：exit 0，`nvm loader for login shells already in /home/gower/.profile`；`.profile` sha256 與第一次之後相同，marker 計數 1 |
| `wsl -d Ubuntu-24.04 --exec bash -lc 'command -v node'` | PASS：`/home/gower/.nvm/versions/node/v24.22.0/bin/node`（更新前為 `node-not-found`） |
| `--exec sh -lc 'command -v node'` | PASS：同上路徑 |
| `--exec bash -lic` | PASS：同上路徑，`v24.22.0`；`bash -x -lic` 的 nvm.sh 載入 1 次（`++ . /home/gower/.nvm/nvm.sh`） |
| `remoteTools.detect` | `node` `status: ok`、`nvmManaged: true` |
| `npm run smoke:remote:headless -- --target wsl:Ubuntu-24.04` | 13/13，共三次：基線、部署 T0555 probe 後（S10 `node=ok@24.22.0(nvm 0.40.8, managed)`）、回滾後 |

**WSL `~/.profile`**（三個 profile 檔中只有 `~/.profile` 存在，`.bash_profile` / `.bash_login` 都不存在 → 目標為 `~/.profile`）
- 備份：`/home/gower/.profile.t0556-20261016-050607.bak`（`cp -p`，sha256 與原檔相同）
- 前：sha256 `28b4a453b68dde64f814e94bab14ee651f4f162e15dd9920490aa1d49f05d2a4`，27 行
- 後：sha256 `22780e8ba8ab09b89b64b84f3f8e7cf9e5d360dffd249b088c5fdea649d8816a`，32 行
- diff（`diff ~/.profile.t0556-20261016-050607.bak ~/.profile`）：
  ```
  27a28,32
  >
  > # >>> nvm loader for login shells (added by BetterAgentTerminal) >>>
  > export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  > if [ "$(command -v nvm 2>/dev/null)" != nvm ] && [ -s "$NVM_DIR/nvm.sh" ]; then command . "$NVM_DIR/nvm.sh" >/dev/null 2>&1; fi
  > # <<< nvm loader for login shells (added by BetterAgentTerminal) <<<
  ```
- `~/.bashrc` 未變（`e111bf20…cb90`，與 T0555 結束時相同）。

**WSL server JS**
- 「更新」按鈕只對 `nvmManaged` 的 node 顯示，因此需要 T0555 的 probe。驗證時以 `node scripts/dev-deploy-headless.mjs --target wsl:Ubuntu-24.04 --tag t0556 --yes` 部署。
- 結束時以 `--rollback --yes` 還原。4 個 server JS 的 sha256 與 `.bak-t0555`（原始 0.6.1-pre.4）一致。
- 結束狀態：9877 LISTEN、service active、指紋 `22:3A:E4:C7…79:97` 不變。新留下的 `.bak-t0556` 備份共 8 個：`electron/remote/` 下 4 個、`scripts/` 下 4 個。

**未碰**：使用者 BAT（9876）、`.bashrc`、nvm 的安裝方式（`v0.40.8`、`METHOD=script`、`NVM_DIR` 先設定都沒改）、nvm4w、`/mnt/c` 的寫入（例外見「遭遇問題」第 3 點）。

**e2e 證據**：`C:\Users\Gower\AppData\Local\Temp\bat-t0556\evidence\`，內容：
- 兩次確認對話框的文字與截圖
- 兩次更新的分頁輸出
- `.profile` 的前、後版本與追加的段落
- `t0556-after.txt`（三種 shell 的結果與 xtrace）
- `t0556-detect-after.json`

**Commit**：`e16e75b8` `feat(remote-tools): T0556 …`，用 `git commit --only` 提交本單變更的 11 個檔案，工單檔也包含在內。`src/styles/settings.css` 不在其中（工單已註明不是本單的變更）。未 push。

### 互動紀錄

無（CT_INTERACTIVE=0，yolo）。以下為自行決定的事項：
- **nvm 是否已載入的判斷**：改成只認 shell function，原因見「產出摘要」。
- **update 中片段的位置**：放在版本比對之前，讓「已是最新」或連不上網路時也會補上片段。
- **note 的寫法**：新增 `nvmLoginProfile` 一條，不把兩件事塞進 `nvmEditsProfile`。update 不會改 `.bashrc`，兩條分開，update 才能只列它適用的那條。
- **只寫一個檔**：照工單規則，只寫 bash login 會讀的那一個檔，不另外同時寫 `.profile`（範圍見「遭遇問題」第 1 點）。

### Renew 歷程

無。

### 遭遇問題

1. **範圍說明**（不影響驗收）：
   - **zsh**：`~/.zprofile` 不在本單範圍，zsh 不讀這些檔。macOS 預設 zsh，nvm install.sh 會寫 `~/.zshrc`，所以互動 zsh 有 nvm；`zsh -lc`（非互動 login）不讀 `.zshrc`，看不到 nvm 的 node。需要的話另開單處理 `~/.zprofile`。macOS 上的 `bash -lc` 依同一規則處理（bash 3.2 讀檔順序相同），沒有實機驗證。
   - **`.bash_profile` 存在時**：片段寫進 `.bash_profile`。`sh -lc`（dash）只讀 `~/.profile`，所以找不到 node；`bash -lc` 找得到。Ubuntu 預設沒有 `.bash_profile`，不受影響。
   - **非 login 的非互動 shell**：例如 `bash -c`，仍然不會載入 nvm。這是 shell 的規則，文件已註明。
2. **第一版片段在 Git Bash 下失效**：`command -v nvm` 找到 nvm-windows 的 `/c/ProgramData/nvm/nvm`，所以跳過了載入。WSL 若 PATH 上有名為 `nvm` 的檔案也會一樣。已改為比對 function 名稱，並補上測試（PATH 上有 `nvm` 程式的情境）。
3. **`/mnt/c` 唯讀存取一次**：在 WSL 驗證「plain `.` 與 `command .` 遇到語法錯誤的差異」時，WSL 讀了一個由我在 `C:\Users\Gower\AppData\Local\Temp` 建立的暫存檔（`/mnt/c/.../t0556bad.sh`），讀完即從 Windows 端刪除。沒有經 `/mnt/c` 寫入或修改任何東西；之後的 WSL 驗證都改用 stdin 傳入腳本，暫存檔放在 WSL 的 `/tmp`。
4. **e2e「before」紀錄第一次為 `ERR`**：`ls` 列出不存在的 `.bash_profile` / `.bash_login` 時 exit 非 0，`run()` 因此 reject，那一次 evidence 的檔案清單變成 `ERR`。判定沒有受影響：目標檔案判斷與 `.profile` 前內容是分開取得的，前後比對仍有效。已在該指令尾端加 `; true` 修正，修正後**未重跑**，因為片段已經存在，要重跑必須先拿掉。前狀態以手動紀錄為準（見上方 sha256 / 行數）。
5. **WSL 留下的檔案**，待使用者決定是否刪除：
   - `~/.profile.t0556-20261016-050607.bak`
   - `~/.local/bat-server/electron/remote/*.bak-t0556`（4 個）
   - `~/.local/bat-server/scripts/*.bak-t0556`（4 個）
   - T0555 留下的 `.bak-t0555` 等檔案仍在

### 回報時間

2026-10-16T05:08:33+0800

---

## 塔台收單（第六十六 session，2026-10-16T05:10:26+0800）

- ✅ **T0556 已確認 DONE**：`e16e75b8`（11 檔）+ `fec2a112`。塔台複驗 @ `fec2a112`：`npm run test:unit` 4372 passed / 253 files（3 skipped）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0；WSL：`bash -lc` 找得到 nvm 的 node、`~/.profile` 標記 1 個、server active。
- 自行決定事項（只認 shell function 判斷已載入、update 中片段排在版本比對前、note 分兩條、只寫一個檔）採納。範圍說明（zsh `~/.zprofile`、`.bash_profile` 存在時 `sh -lc` 讀不到、`bash -c` 不載入）接受並記錄；zsh 視需求另開單。
- 遭遇問題 3（WSL 唯讀存取 `/mnt/c` 下自建暫存檔一次，已刪）：未違反「不得改 `/mnt/c`」，記錄。
- → T0555 依 Resolved PARTIAL 規則補正為 DONE。pre.5 批次（T0551–T0556）全部完成。
- WSL 留下的備份待使用者決定：`~/.bashrc.t0555-20261016-042526.bak`、`~/.profile.t0556-20261016-050607.bak`、`~/.local/bat-server/electron/remote/*.bak-t055{5,6}`（8 個）、`~/.local/bat-server/scripts/*.bak-t055{5,6}`（8 個）。


---

## 塔台追記：pre.5 實機目視（第六十七 session，2026-10-16T14:44:08+0800）

- 使用者 BAT `0.6.1-pre.5`，WSL `Ubuntu-24.04` profile（`localhost:9877`，server pre.5）→ 配置 → 工具面板截圖：Node.js「已安裝」`24.22.0`、chip `nvm 0.40.8`、按鈕「更新」、路徑 `/home/gower/.nvm/versions/node/v24.22.0/bin…` → **PASS**（T0555 / T0556 實機）。
- Node.js / Claude Code / Codex / uv 顯示「伺服器：不可見」：systemd user service 的 PATH 不含 `~/.nvm`、`~/.local/bin`，屬設計（tooltip：只影響 Git / GitHub 面板；git / gh 皆「可見」；`remote-tools-panel.test.tsx` 亦預期 claude 為 hidden）。
