---
schema_version: 1
schema_kind: workorder
id: T0798
title: "修正 `linux-acceptance.yml` 的「Inspect the AppImage」步驟在 runner 上中途 exit 1，並在 GitHub 上把兩個 OS 跑到有 `linux-report.md` 的結論"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-03T01:33:04+0800"
started_at: "2026-11-03T01:34:03+0800"
updated_at: "2026-11-03T01:57:04+0800"
completed_at: "2026-11-03T01:57:04+0800"
session_ids:
  - "f3bc506b-45a7-4a17-b088-7a1f2204ceb3"
depends_on: []
related:
  - "T0797（建立本 workflow，DONE `cd938ab6`）；D242 / D243"
  - "失敗 run `41491827025`（2026-11-02T17:30:34Z，`-f version=0.7.4-pre.1`）：ubuntu-22.04 / 24.04 兩個 job 都在 step 10「Inspect the AppImage」`Process completed with exit code 1`，後續 Playwright 步驟沒跑、沒有 `linux-report.md`；artifact 只有 `appimage-inspect.md`（截斷）與 `runner-context.md`"
affects_files:
  - .github/workflows/linux-acceptance.yml
  - e2e/linux/**
  - docs/agent-guide/linux-ci-acceptance.md
  - _ct-workorders/T0798-fix-linux-acceptance-inspect-step.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 現象（run `41491827025`，`gh run view 41491827025 -R gowerlin/better-agent-terminal --log-failed`）：「Inspect the AppImage」印出到「highest GLIBC requirement per ELF file (top 10):」之後的清單只有部分（22.04 列 5 筆、24.04 列 2 筆，數量不同、也沒有 whisper 的 `libggml-*.so`），結尾的 ``` 沒印出就 `exit code 1`（shell `bash -e {0}`）。推測與 `bash -e` 下 pipeline / while 迴圈內的命令替換、`head` 提早關閉管線等有關，但**先以 log 查證根因，不要猜**。本機 WSL 實跑時沒有遇到，差異（`set -e`、檔案權限、runner 環境）一併說明。"
  - "🔴 修法原則：靜態檢查是資訊性的，任何一項取不到都只記錄（例 `n/a` / 錯誤原文）不得讓 job 失敗或中斷後續步驟；整個 ELF 清單要完整掃完（應含 whisper addon 的 `.so`，T0797 本機看到 `GLIBC_2.38`）。不得用 `continue-on-error: true` 掩蓋整個步驟（那樣清單仍會截斷）；若某個 step 確實需要容錯，限縮在單一命令。其他步驟的判讀規則（PASS / WARN / FAIL、sandbox、FUSE）不變。"
  - "🔴 在 GitHub 上驗證（D243 授權）：可 push 分支 `ct/T0798`（只此分支，不 push `main`），以 `gh workflow run linux-acceptance.yml -R gowerlin/better-agent-terminal --ref ct/T0798 -f version=0.7.4-pre.1` 迭代，最多 5 次 dispatch；`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122）。目標：兩個 job 都跑到 Playwright 步驟並產生 `linux-report.md`。job 因**產品**相容性問題而 FAIL / WARN（例：24.04 sandbox、22.04 語音輸入）不算本單失敗——那正是要的結論，照實記錄、不修產品；只有 workflow / spec 本身的錯誤要修。完成後刪除遠端分支 `ct/T0798`（`git push origin --delete ct/T0798`），本機分支保留由塔台處理。"
  - "🔴 回報區必列：根因（附 log 行）、修法、每次 dispatch 的 run id 與兩個 OS 的結論、最後一次的 `linux-report.md` 摘要（verdict、L1 / L2 / L1b、sandbox、`apparmor_restrict_unprivileged_userns`、glibc、啟動耗時、debug log 的 `[ERROR]` / `[CRASH]`）與完整 ELF GLIBC 清單（22.04 上 whisper `.so` 的需求與是否有相關錯誤）。runner 上 24.04 的 `apparmor_restrict_unprivileged_userns = 1`（run `41491827025` 的 `runner-context.md`），即桌面預設設定。"
  - "🔴 commit 在 `main` 上（只 commit 本單範圍，`git commit --only` 或明列路徑），`ct/T0798` 分支只用來在 GitHub 上跑；最後 `main` 的 commit 內容須與通過的那次 dispatch 的 workflow / spec 相同（寫明 SHA 對應）。不改產品程式碼、不發版、不改 CHANGELOG。公開 repo 去識別化（D176）。yolo：不得問使用者；判讀 / 範圍問題依 ct-exec § Questions For Tower 問塔台。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。暫存檔放系統暫存目錄，收尾刪除。完成狀態寫 `DONE`。"
---

# T0798 — 修正 linux-acceptance 的 Inspect 步驟

## 元資料

- **工單編號**：T0798
- **類型**：implementation（CI workflow 修正）
- **互動模式**：yolo（問題問塔台）
- **優先級**：P2
- **建立時間**：2026-11-03T01:33:04+0800
- **預估規模**：S

## 背景

T0797 新增的 `linux-acceptance.yml` 首次在 GitHub 上跑（run `41491827025`）時，兩個 OS 都在靜態檢查「Inspect the AppImage」中途 exit 1，Playwright 驗收沒跑到，還沒有 Ubuntu 22.04 / 24.04 的結論。

## 範圍

1. 以 log 查證根因並修正，讓靜態檢查完整且不會讓 job 中斷。
2. 用 `ct/T0798` 分支在 GitHub 上跑到兩個 OS 都有 `linux-report.md`。
3. 必要時更新 docs。

## 不做

- 不修產品相容性問題（只記錄）、不 push `main`、不發版。

## 驗收

- [x] 根因（附 log）與修法
- [x] 兩個 OS 都跑到 Playwright、有 `linux-report.md`；run id 與結論
- [x] 完整 ELF GLIBC 清單（含 whisper `.so`）
- [x] `main` commit 與通過的 dispatch 內容一致；遠端 `ct/T0798` 已刪

---

## 回報區

### 完成狀態

- **狀態**：DONE
- **完成時間**：2026-11-03T01:57:04+0800
- **session_id**：f3bc506b-45a7-4a17-b088-7a1f2204ceb3
- **摘要**：Inspect 步驟的根因（`bash -e` + `pipefail` + 沒有 glibc 版本符號的 ELF 檔）已用 log 與本機重現查證並修正；在 GitHub 上又找到並修正兩個 spec 錯誤（Playwright launch 失敗讓測試直接停掉、`libfuse2` 永遠顯示 not found）。最後一次 dispatch（run `41495143950`）兩個 OS 都跑到 Playwright、都有 `linux-report.md`：22.04 **PASS**，24.04 **WARN**（預設 AppArmor 設定下 sandbox 被擋，要 `--no-sandbox` 才開得起來，屬產品相容性結果，只記錄）。

### 落點檢查

- **結果**：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單在 REPO_ROOT 底下 → PASS；C-3：`.github/workflows/linux-acceptance.yml`、`e2e/linux/`、`docs/agent-guide/linux-ci-acceptance.md` 都存在 → PASS；C-2：工單沒有 `branch` 欄位，不適用（在 `main` 上）
- `CT_HOME` 未設定（不是 worktree 派工）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`；`CT_MODE` = `yolo`、`CT_INTERACTIVE` = `0`；`BAT_REMOTE_TOKEN` 已設定

### 根因（附 log）

失敗 run `41491827025`（`gh run view 41491827025 -R gowerlin/better-agent-terminal --log-failed`）：

```
shell: /usr/bin/bash -e {0}
...
highest GLIBC requirement per ELF file (top 10):
GLIBC_2.28 resources/app.asar.unpacked/node_modules/@lydell/node-pty-linux-x64/pty.node
GLIBC_2.26 resources/app.asar.unpacked/node_modules/@anthropic-ai/claude-code-linux-x64/claude
##[error]Process completed with exit code 1.          ← 24.04（2 筆）；22.04 列 5 筆後同樣結束
```

- `run:` 預設 shell 是 `bash -e {0}`，errexit 一開始就開著；步驟裡的 `set -uo pipefail` 又開了 pipefail。
- `max_glibc()` 是 `objdump -T | grep -o 'GLIBC_[0-9.]*' | sort | tail`。遇到沒有 glibc 版本符號的 ELF 檔（例：codex 的 musl 靜態執行檔 `codex` / `rg` / `bwrap`）時 `grep` 沒有結果，`objdump` 讀不了的檔案則是 objdump 本身失敗 → 在 pipefail 下函式回非 0 → `v=$(max_glibc "$f")` 這個指派回非 0 → errexit 讓**管線裡的 while 子 shell** 結束（errexit 會繼承到管線子 shell）。迴圈停在那個檔案，`sort` 只輸出已收到的幾筆，`{ … } | tee` 的 pipefail 再讓外層 shell 在印出結尾的 ``` 之前 exit 1。
- 筆數不同（22.04 列 5、24.04 列 2）是因為 `find` 的順序隨檔案系統而變，第一個沒有 glibc 符號的 ELF 出現的位置不同。
- 本機重現（WSL Ubuntu 24.04，用 `/bin/ls`、一個假的 `\x7fELFjunk` `.so`、`/bin/cat` 三個檔案）：`bash -e` 只印出第 1 筆就 exit=1；一般 `bash`（T0797 本機的跑法，沒有 `-e`）三筆都印出、exit=0。所以差異是 `set -e`，跟檔案權限、runner 環境無關。

### 修法

1. **workflow「Inspect the AppImage」**（`41c7f5fa`、`d977a92a`）：步驟開頭 `set +e +o pipefail; set -u`；`max_glibc` 一律回 0，輸出 `GLIBC_x.y` / `none` / `n/a (objdump: <錯誤第一行>)`；`--appimage-extract` 失敗記 `n/a (exit N: …)`；以 `mapfile` + process substitution 掃**全部** ELF 檔（不用管線子 shell、不再 top 10），GLIBC 由新到舊排列，`none` / `n/a` 排在最後；高於該 runner glibc 的標 `(above this system's glibc X)`；每個 ELF 檔另列 `ldd` 的 `not found` 行（去掉 ldd 重複的檔名前綴與 `$root/`）；步驟最後 `exit 0`。沒有用 `continue-on-error`。
2. **spec：launch 失敗讓測試直接停掉**（`498a78d3`）：dispatch #1 的 24.04 L1 在 `electron.launch` 就失敗，報告只有 meta、沒有任何列。原因在 Playwright 1.59.1 的 `playwright-core/lib/server/electron/electron.js`：app 在印出 `Debugger listening` 前結束時，`waitForLine` 的好幾個 promise 一起以 `Process failed to launch!` reject；被 await 的那個會進到 spec 的 catch，但 `waitForXserverError` / `chromeMatchPromise` 沒人處理，`playwright/lib/worker/workerMain.js` 的 `unhandledError` 讓測試失敗並停掉，L2、L1b、verdict 都沒跑。新增 `launchElectron()`：launch 期間（失敗後再 1 s）只吞掉訊息完全等於 `Process failed to launch!` 的 unhandled rejection，其他 rejection 照樣交給 worker 原本的 listener，結束後還原。本機重現（Windows，以 `node -e 0` 當 executable，Playwright 會加 node 不認得的 `--remote-debugging-port=0`）：直接呼叫 → 測試以 `Error: Process failed to launch!` 失敗，連 catch 都沒執行；經 `launchElectron` → catch 有執行、測試繼續，log 顯示 `ignored 3 unhandled … rejection(s)`。
3. **spec：`libfuse2` 永遠顯示 not found**（`d977a92a`）：dispatch #2 的報告在 FUSE 掛載成功的情況下仍寫 `libfuse2: not found (ldconfig -p)`。原因是 `runCmd` 把 stdout 截在前 2000 字元，`ldconfig -p` 的 `libfuse.so.2` 那行在更後面。`runCmd` 加第 4 個參數 `outLimit`（預設 2000，其他呼叫不變），`ldconfig -p` 傳 4 MiB。dispatch #3 兩個 OS 都顯示 `libfuse.so.2 (libc6,x86-64) => /lib/x86_64-linux-gnu/libfuse.so.2`。
4. **docs**（`37f62a9f`）：Inspect 步驟說明（全部 ELF、ldd、只記錄的規則）；「已知限制與陷阱」補 `bash -e` 與 Playwright launch 兩條；驗證清單補 `bash -e` 與 `--ref <分支>` 的 dispatch 方式；新增「GitHub runner 實測（T0798）」一節；註明 24.04 runner 的 `apparmor_restrict_unprivileged_userns` 為 1。

PASS / WARN / FAIL、sandbox、FUSE 的判讀規則沒有改。

### dispatch 紀錄（`--ref ct/T0798 -f version=0.7.4-pre.1`，共 3 次，上限 5）

| # | run id | 分支 SHA | 22.04 | 24.04 | 處置 |
|---|---|---|---|---|---|
| 1 | `41492924250` | `efd0c7ca` | Inspect ✅ 完整 53 個 ELF；L1 PASS，verdict **PASS** | Inspect ✅；L1 launch 失敗後測試被 Playwright worker 停掉，`linux-report.md` 只有 meta，job 紅燈 | spec 錯誤 → 修法 2 |
| 2 | `41493824139` | `5d1f4bc6` | verdict **PASS** | L1 FAIL → L2 FAIL → L1b PASS，verdict **WARN**（job 綠燈＋warning） | 報告的 `libfuse2: not found` 是 spec 錯誤 → 修法 3（順手去掉 ldd 行的重複檔名） |
| 3 | `41495143950` | `f5b94408` | verdict **PASS** | verdict **WARN** | 通過，作為最後結論 |

**`main` 與通過的 dispatch 對應**：run `41495143950` 跑的是 `ct/T0798` `f5b94408`；`git diff ct/T0798 main -- .github/workflows/linux-acceptance.yml e2e/linux` = 0 行（`main` 從 `d977a92a` 起都相同，之後的 `37f62a9f` 只改 docs）。`ct/T0798` 從 `origin/main` `c29793b2` 開出，只多了這三個 commit 的同內容複本，所以 `main` 上兩個 CT commit（`b455c4db`、`c02d4528`）沒有被 push。

### 最後一次的 `linux-report.md` 摘要（run `41495143950`）

| 項目 | ubuntu-22.04 | ubuntu-24.04 |
|---|---|---|
| verdict | **PASS** | **WARN** |
| L1（sandbox 預設開） | PASS：視窗可見、終端分頁、鍵盤 echo 標記、截圖、renderer `NSpid` 三層（sandbox 有開）、正常關閉 1220 ms、Terminal Server 跟著結束 | FAIL：`FATAL:sandbox/linux/suid/client/setuid_sandbox_host.cc:172] The SUID sandbox helper binary was found, but is not configured correctly. Rather than run without sandboxing I'm aborting now. You need to make sure that /tmp/.mount_…/chrome-sandbox is owned by root and has mode 4755.`（SIGTRAP，14.9 s） |
| L2（不經 Playwright） | 沒跑 | FAIL：同一行 FATAL，20 s 內自己結束（SIGTRAP），沒有 debug log |
| L1b（`--no-sandbox`） | 沒跑 | PASS：視窗、終端、鍵盤 echo、截圖、正常關閉 1555 ms；renderer 沒有 sandbox（預期） |
| `apparmor_restrict_unprivileged_userns` | 0 | **1**（= 桌面版預設） |
| glibc | 2.35 | 2.39 |
| libfuse2 | `/lib/x86_64-linux-gnu/libfuse.so.2` | `/lib/x86_64-linux-gnu/libfuse.so.2` |
| 啟動耗時 | 視窗 70.1 s、終端 73.9 s、標記 75.8 s | L1b：視窗 91.7 s、終端 96.7 s、標記 101.9 s |
| debug log | `[CRASH]` 0、`[ERROR]` 0 | L1b `[CRASH]` 0、`[ERROR]` 0（L1 / L2 沒產生 log） |
| app 版本 | 0.7.4-pre.1，Electron 45.2.1（Chromium 156.0.8078.75，Node 24.22.1） | 同左 |

app stderr 裡的 D-Bus `Failed to connect to the bus` 與 `fatal: not a git repository` 是因為 runner 沒有 D-Bus session、測試資料夾也不是 git repo；debug log 裡沒有對應的 `[ERROR]`。

### 完整 ELF GLIBC 清單（run `41495143950`，22.04；24.04 相同，只差沒有「above」註記）

`RU/` = `resources/app.asar.unpacked/node_modules/`，`codex-musl/` = `RU/@openai/codex-linux-x64/vendor/x86_64-unknown-linux-musl/`。共 53 個 ELF 檔。

```
GLIBC_2.38 RU/@kutalia/whisper-node-addon/dist/linux-x64/libggml-vulkan.so (above this system's glibc 2.35)
GLIBC_2.38 RU/@kutalia/whisper-node-addon/dist/linux-x64/libggml-base.so (above this system's glibc 2.35)
GLIBC_2.34 RU/@kutalia/whisper-node-addon/dist/linux-x64/whisper.node
GLIBC_2.34 RU/@kutalia/whisper-node-addon/dist/linux-x64/libggml-cpu.so
GLIBC_2.34 RU/@kutalia/whisper-node-addon/dist/linux-x64/libggml.so
GLIBC_2.32 RU/@kutalia/whisper-node-addon/dist/linux-x64/libwhisper.so.1.7.6
GLIBC_2.32 RU/@kutalia/whisper-node-addon/dist/linux-x64/libwhisper.so.1
GLIBC_2.32 RU/@kutalia/whisper-node-addon/dist/linux-x64/libwhisper.so
GLIBC_2.28 codex-musl/codex-resources/voice/lib/libgstallocators-1.0.so.0
GLIBC_2.28 codex-musl/codex-resources/voice/lib/libglib-2.0.so.0
GLIBC_2.28 codex-musl/codex-resources/voice/lib/libgio-2.0.so.0
GLIBC_2.28 codex-musl/codex-resources/voice/bin/codex-voice-host
GLIBC_2.28 RU/@lydell/node-pty-linux-x64/pty.node
GLIBC_2.27 codex-musl/codex-resources/voice/lib/libffi.so.8
GLIBC_2.26 RU/@anthropic-ai/claude-code-linux-x64/claude
GLIBC_2.25 BetterAgentTerminal
GLIBC_2.17 codex-musl/codex-resources/voice/lib/libgstreamer-1.0.so.0
GLIBC_2.17 libvk_swiftshader.so
GLIBC_2.17 libffmpeg.so
GLIBC_2.17 chrome_crashpad_handler
GLIBC_2.16 libvulkan.so.1
GLIBC_2.14 codex-musl/codex-resources/voice/lib/{libz.so.1, libpcre2-8.so.0, libopus.so.0, libgstvideo-1.0.so.0, libgsttag-1.0.so.0, libgstrtp-1.0.so.0, libgstpbutils-1.0.so.0, libgstbase-1.0.so.0, libgstaudio-1.0.so.0, libgobject-2.0.so.0}
GLIBC_2.14 codex-musl/codex-resources/voice/lib/gstreamer-1.0/{libgstrtpmanager.so, libgstrtp.so, libgstopus.so, libgstcoreelements.so, libgstaudioresample.so, libgstaudioconvert.so}
GLIBC_2.7 usr/lib/libnotify.so.4
GLIBC_2.4 usr/lib/libgconf-2.so.4
GLIBC_2.4 usr/lib/libXtst.so.6
GLIBC_2.4 codex-musl/codex-resources/voice/lib/libgstnet-1.0.so.0
GLIBC_2.4 chrome-sandbox
GLIBC_2.2.5 usr/lib/libindicator.so.7
GLIBC_2.2.5 usr/lib/libappindicator.so.1
GLIBC_2.2.5 usr/lib/libXss.so.1
GLIBC_2.2.5 codex-musl/codex-resources/voice/lib/{libintl.so.8, libgstapp-1.0.so.0, libgmodule-2.0.so.0}
GLIBC_2.2.5 codex-musl/codex-resources/voice/lib/gstreamer-1.0/libgstapp.so
none codex-musl/bin/codex
none codex-musl/bin/codex-code-mode-host
none codex-musl/codex-path/rg
none codex-musl/codex-resources/bwrap
```

（`{…}` 是同版本、同目錄的檔案合併成一行，原始報告每個檔案一行。）

**22.04 上 whisper `.so` 的需求與錯誤**：`libggml-base.so`、`libggml-vulkan.so` 需要 `GLIBC_2.38`（22.04 是 2.35），`ldd` 報 `` /lib/x86_64-linux-gnu/libc.so.6: version `GLIBC_2.38' not found ``；`libggml-vulkan.so` 另有 `` /lib/x86_64-linux-gnu/libstdc++.so.6: version `GLIBCXX_3.4.32' not found ``。其餘 whisper 檔最高 `GLIBC_2.34`。BAT 啟動時不載入 whisper：22.04 的 debug log 只有 `[voice] microphone permission handler installed` / `IPC handlers registered` / `getPreferences`，沒有 whisper / ggml 相關錯誤，所以 L1 PASS 不受影響。22.04 上語音輸入實際能不能用，本單**沒有驗**。另外兩個 OS 的 `ldd` 都列出 whisper `.so` 之間互相依賴的 `libggml*.so => not found`、`libwhisper.so.1 => not found`（它們沒有指向同目錄的 RUNPATH，`ldd` 找不到），以及 `usr/lib/libappindicator.so.1` 缺 `libgtk-x11-2.0.so.0` 等；這些不代表執行期一定失敗（addon 可能自己指定路徑載入）。

### 異動檔案

| commit | 檔案 |
|---|---|
| `41c7f5fa` | `.github/workflows/linux-acceptance.yml` |
| `498a78d3` | `e2e/linux/t0797-linux-appimage-launch.spec.ts` |
| `d977a92a` | `e2e/linux/linux-os.ts`、`.github/workflows/linux-acceptance.yml` |
| `37f62a9f` | `docs/agent-guide/linux-ci-acceptance.md` |

全部在 `main` 上，以 `git commit --only` 提交；沒有 push `main`。沒有改產品程式碼和 CHANGELOG，沒有發版。

### 驗證

- 本機：`npx tsc --noEmit --skipLibCheck --strict --target ES2022 --module esnext --moduleResolution bundler --types node --esModuleInterop e2e/linux/*.ts` = 0；`npx playwright test e2e/linux/ --list` = 1 test；actionlint 1.7.12（從 rhysd/actionlint release 下載）= 0（本機沒有 shellcheck，所以 actionlint 沒做 shell 檢查）；把 Inspect 步驟抽出來，用假的 AppImage 在 WSL 以 `bash -e` 跑：exit 0，清單包含 `n/a (objdump: …)`、GLIBC 排序、above 註記（模擬 glibc 2.35）；ldd 前綴的處理另用腳本確認。
- GitHub：dispatch #3 run `41495143950` conclusion `success`，兩個 job 都跑完 Playwright，artifact 都有 `linux-report.md` / `.json`、`appimage-inspect.md`、`runner-context.md`、截圖、debug log。
- 遠端分支：`git push origin --delete ct/T0798` 完成，`git ls-remote --heads origin ct/T0798` = 0 筆；本機分支 `ct/T0798` 保留（交塔台處理）；暫用的 worktree（放在系統暫存目錄）已用 `git worktree remove` 移除。

### 遭遇問題

- 無阻擋。dispatch #1、#2 各發現一個 spec 錯誤，都在本單範圍內（`e2e/linux/**`）修正。
- 本機沒有可解析 YAML 的套件，改用 actionlint 驗證。

### 互動紀錄

- [01:34] 開工（`CT_MODE=yolo`），全程沒有向塔台提問。
- [01:56] 塔台在執行期間 commit 了 `d46da47d`（只改 `_tower-state.md`）；本工單沒有 `## 塔台補充` 段落。

### 後續建議（給塔台）

- 24.04 預設設定下 AppImage 不加 `--no-sandbox` 開不起來（`apparmor_restrict_unprivileged_userns = 1`）。可考慮的方向（需另開工單決定）：AppArmor profile、AppRun 偵測後加 `--no-sandbox` 並提示、文件說明。
- 22.04 上 whisper 的 `libggml-base.so` / `libggml-vulkan.so` 需要 `GLIBC_2.38` / `GLIBCXX_3.4.32`，語音輸入很可能無法使用；建議另開工單實測語音功能，並決定是否更換 build。
- 本機分支 `ct/T0798` 保留中，可刪除（內容已在 `main`）。
