---
schema_version: 1
schema_kind: workorder
id: T0720
title: "研究：`v0.7.2-pre.5` 安裝檔比 pre.4 大約 24 MiB、超過 D146 預算的原因與可行對策（只查不修）"
type: research
status: DONE
repo: better-agent-terminal
project: ""
priority: P1
sizing: M
created_at: "2026-11-01T09:49:34+0800"
started_at: "2026-11-01T09:52:43+08:00"
updated_at: "2026-11-01T10:07:31+08:00"
completed_at: "2026-11-01T10:07:31+08:00"
depends_on: []
related:
  - "D146（安裝檔瘦身；每平台安裝檔 ≤ 320 MiB、可攜 zip ≤ 450 MiB，以 CI `Report artifact sizes` 量測）；T0544 組成實測、T0546 白名單、T0547 不內建 baseline"
  - "T0717（內嵌 claude CLI 2.1.306 → 2.1.316、codex 0.163 → 0.166，`101adaaf`）、T0718（Agent SDK 0.2 → 0.3.316，含 8 個 `claude-agent-sdk-*` 平台子套件，`61dff300` / `45113164` / `54f52048`）、T0719（BUG-176：ajv / ajv-formats 加進 `dependencies`，`59ef7f37`）"
  - "release：`v0.7.2-pre.4`（run `41226677868`，exe 309 / zip 428 / AppImage 305 / dmg 322 MiB）、`v0.7.2-pre.5`（run `41260924862`，exe 333 / zip 458 / AppImage 328 / dmg 345 MiB）"
  - "CLAUDE.md「Packaging / Release 前置檢查」（安裝檔瘦身、`build.files` 白名單、🔴 不得使用 `build.<platform>.files`）、`docs/agent-guide/packaging-release-checks.md`"
affects_files:
  - _ct-workorders/T0720-research-pre5-installer-size-growth.md
  - "_ct-workorders/_report-T0720-installer-size.md（回報太長時另寫，選用）"
renew_count: 0
workdir: main repo
worker_question_timeout: 30
research_max_questions: 3
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只查不修：不改任何產品程式、測試檔、`package.json` / lock、`build` 設定、CI workflow、CLAUDE.md、docs。下載的安裝檔、解壓結果、暫存腳本一律放 Worker 的 scratchpad（下載檔放獨立的空目錄，腳本放另一個目錄），結束後可刪。"
  - "🔴 結論要有證據：每個「多了 X MiB 來自 Y」都附量測方式與數字（檔案路徑、bytes、比較表）；推論與事實分開標示（【推論】）。"
  - "🔴 GitHub 只做唯讀操作，所有 `gh` 指令帶 `-R gowerlin/better-agent-terminal`（L122）：可 `gh release download`、`gh run view --log`；不得建立 / 編輯 release、tag、issue，不得觸發 workflow。"
  - "🔴 不在本 repo 跑 `npx vite build` / `npm run build*` / electron-builder：同時有 T0722 Worker 在本 repo 改程式並跑 build，`dist-electron/`、`release/` 會互相覆蓋。只比較 CI 產物（GitHub Release 資產與 CI log）；若真的需要本機打包才能回答，寫進「建議下一步」，不執行。不得碰使用者正在用的 BAT 與已安裝的 BAT。"
  - "🔴 可以自己開唯讀子代理平行讀程式碼；回報區要有「子代理使用」紀錄：幾個、做什麼、約多少 tokens（讀不到就寫怎麼估的）。不使用 Workflow 工具（本單沒有授權）。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，回報不寫真名、家目錄路徑（寫 `<使用者資料夾>`）或權杖。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit `affects_files`；不 push。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0720 — 研究：`v0.7.2-pre.5` 安裝檔變大的原因與對策

## 元資料

- **工單編號**：T0720
- **類型**：research（只查不修）
- **優先級**：P1（結論決定是否放寬 D146）
- **建立時間**：2026-11-01T09:49:34+0800
- **預估規模**：M

## 研究目標

`v0.7.2-pre.5` 四個安裝檔都比 pre.4 大約 23–30 MiB，全部超過 D146 預算（每平台 ≤ 320 MiB、可攜 zip ≤ 450 MiB）：

| 產物 | pre.4（MiB） | pre.5（MiB） | D146 上限 |
|---|---|---|---|
| exe（NSIS） | 309 | 333 | 320 |
| zip（可攜） | 428 | 458 | 450 |
| AppImage | 305 | 328 | 320 |
| dmg | 322 | 345 | 320 |

使用者決定**先看本單結論，再決定要不要放寬 D146**。本單要回答：

1. **增加量來自哪裡**：逐項列出 pre.4 → pre.5 的大小差異（至少 Windows 完整拆解，其他平台盡量），對到 T0717 / T0718 / T0719 的哪個變更。
2. **哪些是必要的、哪些可以拿掉**：例如 SDK 0.3 的平台子套件是否把用不到的 binary 打進安裝檔（D146 / T0544 時「SDK 內建 claude（不執行）」就是被排除的一項）、是否有重複的 claude / codex binary、其他平台的子套件是否被打進來。
3. **對策選項與預估**：每個選項預估省多少（每個平台）、要動哪些檔案、風險（會不會壞掉 Claude 面板 / runtime router / 打包驗證）、規模；以及「不瘦身、直接放寬 D146」時建議的新上限。

## 已知資訊

- pre.5 包含：內嵌 `@anthropic-ai/claude-code` 2.1.316（T0717 回報：`bin/claude.exe` 與 `claude-code-win32-x64/claude.exe` 都是 335,469,216 bytes、hardlink 2，套件檔案清單與 2.1.306 相同）、內嵌 codex 0.166.0、`@anthropic-ai/claude-agent-sdk` 0.3.316（含 8 個 `claude-agent-sdk-*` 平台子套件）、ajv / ajv-formats（T0719 為 BUG-176 加進 `dependencies`）。
- D146：T0544 量過的組成（Electron、codex、claude、Windows 重複 claude.exe、SDK 內建 claude、asar 內用不到的 node_modules 等）；T0546 以 `build.files` 否定 extglob 白名單瘦身。
- CI `Report artifact sizes` step 有每次 run 的產物大小；pre.4 run `41226677868`、pre.5 run `41260924862`。
- 【塔台推測，待查】SDK 0.3 的平台子套件可能各帶一個原生 binary，而 Claude 面板走 `pathToClaudeCodeExecutable` 指到內嵌 CLI，不需要它。

## 調查範圍

1. **CI 產物比較**：下載 pre.4 / pre.5 的 Windows zip（必要），解壓後依目錄 / 套件比較大小差異（`resources/app.asar` 內容可用 `@electron/asar` 列表或解開、`app.asar.unpacked`、`resources/` 其他檔）。AppImage / dmg 視可行性比較（例如 CI log、tar 清單、`--appimage-extract` 不可用時說明），做不到的寫明理由並以 Windows 結果推估。
2. **差異歸因**：每一筆差異對到哪個套件 / 版本 / 工單；確認 SDK 0.3 平台子套件、claude-code 2.1.316、codex 0.166、ajv 各佔多少；確認 asar 白名單是否讓不需要的檔案進來（含其他平台的子套件）。
3. **執行期需求**：被懷疑可拿掉的檔案，執行期是否真的用不到（Claude 面板 `query()` 用哪個 executable、`resolveEmbeddedClaudePath` / runtime router、SDK 0.3 在找不到子套件 binary 時的行為、headless / server bundle 是否另有需求）。附程式碼位置。
4. **對策**：列 2–4 個選項（例：白名單排除 SDK 平台子套件、去除重複 binary、改壓縮設定、放寬 D146），每個附各平台預估大小、要動的檔案、需要補的守門（`asar-runtime-deps.test.mjs`、`verify-packaged-native.js` 等）、風險、規模。給出推薦。

## 研究指引

- 先讀 `package.json` 的 `build` 區塊（`files` 白名單、`asarUnpack`、`extraResources`）、`scripts/verify-packaged-native.js`、`electron/claude-agent-manager.ts` 的 `query()` 選項、`electron/claude-runtime-router.ts`。
- 結論第一段用一句話回答「pre.5 多出的約 24 MiB 主要來自 ___，可以 / 不可以安全拿掉」，再接比較表與選項。
- 若某項只能在 mac / Linux 實機確認，寫進「待實機確認」。

## 互動規則

- yolo：不問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台，每輪最多 3 題。
- 互動紀錄寫入回報區。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**（研究完成，只查不修；沒有改任何產品檔案）

- 落點檢查：**PASS**。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS；C-1 工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS；C-3 `affects_files` 只有 `_ct-workorders/` 底下的檔案 → 不適用；C-2 工單沒有 `branch` 欄位（目前 `main`）。`CT_HOME` 未設定（不是 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄，不比對）。
- 模式：`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 互動紀錄

無（沒有問題需要問塔台）。

### 調查結論

**一句話**：pre.5 多出的約 23–31 MiB **幾乎全部來自上游 binary 本身變大**：內嵌 claude CLI 2.1.306 → 2.1.316（約佔 64–69%）與 codex 0.163 → 0.166（約佔 30–38%）。這兩項都是執行期真的會用到的 binary，**不能安全拿掉**。SDK 0.3 的平台子套件、重複的 claude binary、其他平台的子套件**都沒有被打進安裝檔**，塔台的推測不成立。

#### 1. 量測方式

- 產物：`gh release download v0.7.2-pre.4` / `v0.7.2-pre.5`（`-R gowerlin/better-agent-terminal`），四個平台的安裝檔都下載到 Worker 的 scratchpad。
- 安裝檔總大小用 GitHub Release asset 的 bytes。和 CI `Report artifact sizes` 對照：0.1 MiB 以內一致。
- 各檔案壓縮後的大小：
  - Windows zip：`7z l -slt` 的 `Packed Size`（每個檔案各自 deflate）。
  - exe：用 7z 解開 NSIS，取出 `$PLUGINSDIR/app-64.7z`，再看 `7z l -slt`。這個 7z 不是 solid，每個檔案一個 block，所以 `Packed Size` 就是每個檔案壓縮後的大小。
  - AppImage：7z 直接開 SquashFS（xz、block 1 MiB），看每個檔案的 `Packed Size`。
  - dmg：UDBZ 以 block 為單位壓縮，沒有每個檔案的壓縮大小。改用 7z 讀 HFS 內的原始大小，再把變大的三個 binary 解出來各自 `bzip2 -9`，用來估計壓縮後的大小。估計合計 23.3 MiB，實際總差 23.7 MiB，差 0.4 MiB。
- asar 內容：`@electron/asar` 3.4.1 `getRawHeader` 逐檔列出大小。

#### 2. 總表（MiB = 1,048,576 bytes）

| 產物 | pre.4 | pre.5 | 差 | D146 上限 |
|---|---|---|---|---|
| exe（NSIS） | 309.9（324,932,037 B） | 333.0（349,209,594 B） | **+23.3** | 320 |
| zip（可攜） | 428.1（448,853,404 B） | 458.9（481,186,010 B） | **+30.8** | 450 |
| AppImage | 305.3（320,108,997 B） | 328.8（344,813,236 B） | **+23.5** | 320 |
| dmg | 322.1（337,717,801 B） | 345.8（362,547,991 B） | **+23.7** | 320 |

（事實）dmg 從 `v0.7.1-pre.6`（2026-10-21，322.2 MiB）起就已經超過 320。pre.5 是四個平台第一次全部超標。

#### 3. 差異歸因（壓縮後的增量，MiB）

| 來源 | 工單 | exe | zip | AppImage | dmg（估） |
|---|---|---|---|---|---|
| 內嵌 claude CLI binary（Win `claude-code/bin/claude.exe` 295,628,960 → 335,469,216 B；Linux / mac 是平台子套件裡的 `claude`） | T0717 | **+14.65** | **+19.11** | **+16.18** | **+15.90** |
| codex 主程式 `codex(.exe)`（Win 341,270,320 → 371,735,856 B） | T0717 | +6.85 | +9.45 | +6.53 | +6.63 |
| codex `codex-code-mode-host` | T0717 | +0.83 | +1.22 | +0.70 | +0.81 |
| codex `codex-windows-sandbox-setup` + `codex-command-runner`（Windows 專用） | T0717 | +0.71 | +0.93 | — | — |
| `app.asar`（SDK 0.3 打包進 `dist-electron/sdk-*.js`，520,692 → 887,636 B） | T0718 | +0.11 | +0.13 | +0.13 | ≈ +0.1 |
| ajv / ajv-formats 依賴閉包 | T0719 | **0** | **0** | **0** | **0** |
| **合計** | | **+23.15**（實際 +23.3） | **+30.83**（實際 +30.8） | **+23.54**（實際 +23.5） | **+23.3**（實際 +23.7） |

- 檔案數量兩版都是 170 個（Windows zip）。除了 vite 產生的 hash 檔名，沒有新增或移除任何檔案。
- ajv 為 0 的證據：pre.4 的 asar 已經有 ajv 依賴閉包，400 檔、1,054,865 B；pre.5 完全相同。pre.4 時這些套件是經 SDK 0.2 的 dependencies 帶進來的，T0719 只是把它們補回 production tree。
- 上游大小（npm registry `dist.unpackedSize`，唯讀查詢）：
  - `claude-code-win32-x64`：2.1.250 226.7 MB → 2.1.306 295.6 MB → 2.1.314 301.4 MB → **2.1.315 335.5 MB（單版 +34 MB）** → 2.1.316 335.5 MB。
  - `codex-win32-x64`：0.150 404.0 → 0.163 465.7 → 0.166 502.7 MB。
  - linux-x64 / darwin-arm64 的增幅相近：claude +37.7 / +37.1 MB，codex +26.2 / +22.6 MB。
- 安裝檔歷史（Release assets）：D146 定案時（`v0.6.1-pre.4`）是 exe 298.0 / zip 412.3 / AppImage 297.4 / dmg 309.7。之後只有兩次變大，都是升內嵌 CLI 的版次：`v0.7.1-pre.5` / `pre.6`（+8～12）和 `v0.7.2-pre.5`（+23～31）。其他版次變動都在 0.1 MiB 以內。

#### 4. 塔台懷疑可以拿掉的項目：逐項查證

| 項目 | 是否在安裝檔 | 證據 |
|---|---|---|
| SDK 0.3 平台子套件 `@anthropic-ai/claude-agent-sdk-*`（含內建的 claude binary） | **不在**（四個平台都是 0 個檔案） | 四個 listing 都 `grep -c claude-agent-sdk` = 0。白名單 `!node_modules/@anthropic-ai/!(claude-code\|claude-code-*){,/**}` 把它排除（`package.json` `build.files`，T0546 C2a），`verify-packaged-native.js` 的 `sdk-binary` 檢查（:534）守住。pre.4 的 SDK 0.2 也有 8 個平台子套件，同樣被排除，所以這項沒有變化。 |
| 重複的 claude binary | **不在** | Windows 只有 `claude-code/bin/claude.exe` 一份，`claude-code-win32-x64/` 只剩 `package.json` / `LICENSE.md`（`!node_modules/@anthropic-ai/claude-code-win32-*/claude.exe`，`duplicate-claude` 檢查 :541）。Linux / mac 只有平台子套件的 `claude` 一份。 |
| 其他平台的子套件 | **不在** | listing 裡只有本平台的 `claude-code-<平台>`、`codex-<平台>`。CI 的 `npm ci` 只裝本平台的 optional 套件。Linux codex 的 `x86_64-unknown-linux-musl` 是 linux-x64 套件自己的 target，不是另一個平台。 |
| codex 附帶元件（`codex-code-mode-host` 75 MiB、`voice/` 18–50 MiB、Windows sandbox / command-runner） | 在 | 都是 `@openai/codex-<平台>` 套件內容。codex binary 的字串裡會引用它們：`features.code_mode_host` … `install codex-code-mode-host`、`voice package unavailable`、`codex-command-runner.exe`；另外有 `CodexPackageManifest` / `codex-package.json` 的套件版面檢查（列了 `codex-code-mode-host.exe`、`codex-path/rg.exe`、`codex-resources/*`）。【推論】code mode 要開 feature flag 才會用、voice 缺少時 codex 似乎能降級，但 codex 會不會因版面檢查把缺檔的安裝判為損壞，**未實測**。 |

**執行期需求（程式碼位置）**：

- Claude 面板的 `query()` 一律帶 `pathToClaudeCodeExecutable: resolvedRuntime.path`（`electron/claude-agent-manager.ts:711/843`、`:1603/1608`、`:2195/2221`）。路徑來源依序是：
  1. `resolveClaudeRuntime`（`electron/claude-runtime-router.ts:307`）
  2. embedded 時走 `resolveEmbeddedClaudePath`（`:225`），指向內嵌的 `claude-code` CLI
  3. 找不到時丟 `EmbeddedClaudeMissingError`（`:319-329`），不會退回 SDK 自己的子套件
- 所以 SDK 平台子套件在打包版本來就不需要，這一點和 pre.4 相同。
- headless / server bundle 由 `headless-entry.ts:426` 判斷 layout，另有自己的 bundle（D146 起不內建在安裝檔），和本題無關。

#### 5. 壓縮設定的實測（Windows exe 的一個意外發現）

- 事實（electron-builder 26.8.1 原始碼）：`NsisTarget.isBuildDifferentialAware` 預設是 `true`（`nsis.differentialPackage !== false`，`NsisTarget.js:65-66`）。這時 `configureDifferentialAwareArchiveOptions`（`differentialUpdateInfoBuilder.js:33-60`）把 app-64.7z 固定成 **字典 1 MiB（`-md=1m`）、非 solid、compression normal**。listing 也對得上：`Method = LZMA2:20`（2^20）、`Solid = -`、`Blocks = 171`。
- 這個設定只是為了給 electron-updater 做差分更新。BAT 沒有使用 electron-updater（`electron/`、`src/` 都 grep 不到 `electron-updater` / `autoUpdater`），release 也沒有上傳 `.blockmap`。
- 實測：用 electron-builder 自帶的 7za 21.07（`node_modules/7zip-bin`），照它在 `differentialPackage: false` 時會用的參數（`a -mx=9 -mtc=off -mtm=off -mta=off`，solid、字典 64 MiB = `LZMA2:26`），在 scratchpad 重壓解開的 Windows app 目錄：

  | | NSIS 內層 7z（現況） | 重壓後 | 省下 | 推估 exe |
  |---|---|---|---|---|
  | pre.5 | 348,275,100 B | 306,170,558 B | **−40.2 MiB** | **≈ 292.9 MiB** |
  | pre.4 | 323,997,568 B | 284,551,570 B | −37.6 MiB | ≈ 272.3 MiB |

  推估 exe = 原 exe − 原 app-64.7z + 重壓 7z；NSIS stub 與標頭約 0.9 MiB 不變。重壓的來源是 zip 解出的 170 個檔案；NSIS 內層的檔案總大小與它差 0.1 MiB（多一個解除安裝相關檔），誤差在 ±0.1 MiB。
- 其他平台沒有同類空間：
  - AppImage 已經是 squashfs xz，block 1 MiB 是 squashfs 上限。
  - dmg 是 UDBZ，ULMO 已被 D146 D2 否決。
  - zip 的 maximum 只小 0.3%（T0547 / T0548 實測）。

### 建議方向

| 選項 | 每平台預估（MiB） | 要動的檔案 | 守門 | 風險 | 規模 |
|---|---|---|---|---|---|
| **A. NSIS 關閉 differential 打包**（`build.nsis.differentialPackage: false`） | exe **≈ 293**（−40）；zip / AppImage / dmg 不變（458.9 / 328.8 / 345.8） | `package.json` `build.nsis`；`docs/agent-guide/packaging-release-checks.md` 壓縮那段 | 可在 `scripts/__tests__/server-bundle-helpers.test.mjs` 旁加斷言（照 T0548 對 zip `-mx=7` 的做法），鎖住 NSIS archive options 不帶 `-md=1m`；Release 驗收照舊必跑 NSIS 完整重裝 | 低。這個選項在 schema 內（`scheme.json:4132`），但型別上標 `@private`，electron-builder 升版時要確認還在。安裝時改為解 solid 7z，記憶體約 64 MiB，安裝時間可能變長，需要實測。BAT 不用 electron-updater，失去差分更新沒有影響 | S |
| **B. 白名單排除 codex 選用元件**（`codex-code-mode-host*`、`codex-resources/voice/**`） | exe ≈ 307（−25.7）、zip ≈ 424（−35.4）、AppImage ≈ 297（−31.8）、dmg ≈ 317（−28.8，bzip2 估） | `package.json` `build.files`；`verify-packaged-native.js` 加「已排除」檢查；`asar-runtime-deps.test.mjs` 加 `keeps(...) === false` 斷言；docs | 同左，另需 codex e2e（`e2e/t0592-codex-tower-worker.spec.ts`、`t0621-codex-osc-state.spec.ts`） | **中～高**。會拿掉 codex 的 code mode 與語音功能。codex 有套件版面檢查（`CodexPackageManifest`），缺檔時的行為未驗證。每次升 codex 都要重查元件清單 | M（含三平台實機驗證） |
| **C. 放寬 D146** | 不瘦身；建議新上限：每平台安裝檔 **≤ 384 MiB**、可攜 zip **≤ 512 MiB**（同樣以 CI `Report artifact sizes` 量測） | `_decision-log.md`（新決策取代 D146 的數值）、CLAUDE.md / docs 有寫 320 / 450 的地方 | — | 無功能風險。上游還會繼續變大，見下方推估 | XS |
| D. claude / codex 改成隨需下載 | 每平台約 −110～−230 | 大改：runtime router、codex 啟動、離線安裝 | 很多 | 高，而且 D146 已否決「codex 不內建」（B1 / B2） | L，不建議 |

**新上限的推估**【推論】：從 2.1.250 到 2.1.316，claude 每平台壓縮後大小每 10 個版次平均增加約 5–17 MiB，而且是跳躍式（2.1.315 單版 +34 MB 未壓縮）；codex 每 3 個 minor 約 +7–9 MiB。pre.5 最大的平台安裝檔是 dmg 345.8：
- 384 約可再吸收 1–2 次「pre.5 這種規模」的升版；
- 512 比 zip 現況多 53 MiB，餘裕比例相同。

再超過時重新評估。若同時採 A，exe 會降到約 293，與其他平台拉開距離，也可以只對 dmg / AppImage 用新上限。

**推薦：A + C**。
- A 成本最低、零功能風險，exe 回到約 293 MiB，比 D146 定案時還小。
- AppImage / dmg / zip 沒有壓縮上的空間，而唯一能拿掉的東西（B）會砍掉 codex 功能，風險和效益不成比例，所以這三項以 C 放寬上限處理。
- B 只在使用者堅持「四個平台都 ≤ 320」時才做，而且要先做實機驗證（見下方）。

### 建議下一步

1. 塔台 / 使用者決定 D146 是否放寬（選項 C 的數值）。這是 D194 指定的決策點。
2. 若採 A：開一張實作工單，改 `build.nsis.differentialPackage: false`，加 NSIS archive options 的斷言與 docs。驗收：
   - CI 打包的 exe 大小，預期約 293 MiB；
   - NSIS 完整重裝（安裝 / 解除安裝 / 覆蓋安裝）；
   - 安裝時間與 pre.5 對照；
   - `verify-packaged-native.js` 全部通過。
   需要本機打包時，避開正在跑 build 的 Worker（本單沒有執行）。
3. 若考慮 B，先開一張實機研究單，在三平台上確認：
   - codex 0.166 拿掉 `codex-code-mode-host` / `voice` 後，`codex --version`、互動 session、`exec`、BAT 派工的 codex Worker（OSC 7501）是否正常；
   - codex 的套件版面檢查是否把它判為損壞安裝。
4. 每次升內嵌 CLI 的工單（T0717 類）回報時，附上 npm `dist.unpackedSize` 的前後差，讓塔台在發版前就知道安裝檔會不會超標。

**待實機確認**：
- 選項 A 的安裝時間與記憶體（Windows 實機）。
- 選項 B 的 codex 缺元件行為（三平台）。
- dmg 的增量是 bzip2 估計值（與實際總差差 0.4 MiB），不是逐檔實測。

### 子代理使用

未使用（沒有開子代理，也沒有使用 Workflow 工具）。

### 遭遇問題

- 無阻斷。dmg 是以 block 為單位的 bzip2，沒有逐檔壓縮大小，改用解出 binary 後 `bzip2 -9` 估算（方法與誤差見〈量測方式〉）。
- 下載與解壓的檔案都在 Worker scratchpad（下載檔、解壓結果、腳本各自分開放），沒有寫進 repo。沒有在本 repo 跑 build / electron-builder，也沒有碰已安裝的 BAT。
- 本 repo 檔案只改了本工單。

### 回報時間

2026-11-01T10:07:31+08:00
