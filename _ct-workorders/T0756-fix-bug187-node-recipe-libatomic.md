---
schema_version: 1
schema_kind: workorder
id: T0756
title: "修正 BUG-187：Node.js 安裝 / 更新 recipe 先確保 `libatomic1`、裝完驗證可執行；順修 T0755 後過時的 server PATH 文件"
type: implementation
status: DONE
started_at: "2026-11-02T01:14:00+0800"
updated_at: "2026-11-02T01:35:01+0800"
completed_at: "2026-11-02T01:35:01+0800"
session_ids:
  - "f9a96616-3bb6-4857-8184-eaa4e1e6acc6"
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-02T01:12:29+0800"
depends_on: [T0755]
related:
  - "BUG-187；D208；BUG-186 / T0753（`parseVersionError` / `missingLibrary` 說明原因）；T0555 / T0556（nvm recipe、login profile loader）"
  - "`src/lib/remote-tools/recipes.ts`（node 的 install / update 命令、`apk` 的 `alpinePackages` prerequisite 前例、`rootPrefix` / `needsSudoFor`）、`install-runner.ts`、`src/lib/remote-tools/__tests__/recipes.test.ts`"
  - "過時文件：`docs/agent-guide/remote-security.md` 第 18 行「BAT 不改 server / systemd / launchd / Docker 的 PATH」、`docs/remote-dev-overview.md`「Where the server PATH comes from (none of these is changed by BAT)」——T0755 / PLAN-057 起 bat-server 預設取登入 shell PATH（`docs/agent-guide/headless-login-shell-path.md`）"
affects_files:
  - src/lib/remote-tools/recipes.ts
  - src/lib/remote-tools/install-runner.ts
  - src/lib/remote-tools/__tests__/
  - src/components/remote-tools/
  - src/components/__tests__/remote-tools-panel.test.tsx
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - docs/agent-guide/remote-security.md
  - docs/remote-dev-overview.md
  - _ct-workorders/T0756-fix-bug187-node-recipe-libatomic.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 先查證再修：① 以 `recipes.ts` 實際組出的 node install / update 命令（各 pkgManager × privilege）列出現況；② 確認 nodejs.org 官方 Linux binary 哪些版本 / 架構需要 `libatomic.so.1`（以實際 `ldd` 或官方說明為準，不憑印象）；③ 各套件管理器提供該程式庫的套件名（apt `libatomic1`、dnf / yum、zypper、pacman 等，查證後再寫；查不到的不對應，改走④的說明）。`src/components/remote-tools/`（`RemoteToolsPanel.tsx` / `InstallConfirmDialog.tsx`）/ locales / `install-runner.ts` 只有確實需要時才改。"
  - "🔴 修正方向（D208）：A. 有對應套件的套件管理器：Linux 安裝 / 更新 Node.js 前，若系統沒有 `libatomic.so.1`（例：`ldconfig -p` 查不到，或沿用既有偵測）就先以 recipe 既有的提權方式（`rootPrefix`，比照 `apk` 的 prerequisite）補裝，並列進 `prerequisites` 讓使用者在確認畫面看得到；需要 root 但沒有 sudo（`needs-root-no-sudo`）時不中止 node 安裝，改在命令最後提示缺少的程式庫與手動指令。B. 安裝 / 更新後跑一次 `node --version` 驗證：失敗時以 T0753 的方式（exit code ＋缺少的程式庫檔名白名單，不回 stderr 原文）讓面板顯示原因與修法，不把壞掉的版本當成功。🔴 nvm 本身仍不需要 sudo（T0555）；有 `libatomic.so.1` 時命令與現況一致（不多跑套件管理器）；macOS / musl / Docker root 不受影響或照實說明。"
  - "🔴 文件：修正上列兩處過時描述，改為「預設由 bat-server 啟動時取登入 shell PATH（PLAN-057 / T0755，可在 Settings 關閉）」並連到 `docs/agent-guide/headless-login-shell-path.md`；remote-dev-overview 的 BUG-186 段落補一句 BAT 的 Node.js 安裝會先處理 libatomic（BUG-187）。CLAUDE.md 不必改（除非新增必守規則）。"
  - "🔴 驗證：recipes 單元測試（含 apt 有 / 無 sudo、root、apk 不變、macOS 不變、已有程式庫時不多跑）、驗證步驟的解析測試、突變檢查（拿掉 prerequisite / 驗證步驟各一次，測試要失敗）；`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npx vite build`。實機：WSL Docker 只用 `bat-e2e-t0756-` 容器（例：`ubuntu:24.04` 最小映像，確認沒有 `libatomic1`），在容器內實際跑組出的 install 命令，裝完 `node --version` 成功；另以「無 sudo、非 root」情境驗提示。結束清掉測試容器 / 映像（不得 `prune`、不碰使用者容器）。不動使用者的 WSL 發行版與 bat-server；不用 SSH 主機。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 本單範圍。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。用 Python 改檔一律 `newline=''`（T0755 曾把 LF 改成 CRLF）。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。"
---

# T0756 — 修正 BUG-187：Node.js recipe 與 `libatomic1`

## 元資料

- **工單編號**：T0756
- **類型**：implementation
- **優先級**：P2
- **建立時間**：2026-11-02T01:12:29+0800
- **預估規模**：M

## 背景

遠端工具的「安裝 / 更新 Node.js」以 nvm 裝 LTS（目前 v26），v26 的官方 Linux binary 需要 `libatomic.so.1`；最小安裝的 Ubuntu / Debian 沒有 `libatomic1`，裝完 node 跑不起來（BUG-186 的根源，使用者 WSL 已由塔台手動補裝）。使用者決定修好後與 PLAN-057 一起發 `0.7.3-pre.3`（D208）。同時 T0755 讓 bat-server 取登入 shell PATH 後，兩份文件仍寫「BAT 不改 server PATH」，一併修正。

## 範圍

1. 查證 recipe 現況、libatomic 需求與各套件管理器套件名。
2. 安裝 / 更新前補裝程式庫（可提權時）或提示（不可提權時）；裝完驗證 `node --version`，失敗顯示原因。
3. 修正兩份過時文件。

## 不做

- 不改 nvm 安裝方式（仍免 sudo）、不改偵測端（T0753）、不改 PLAN-057 實作；不動使用者環境；不發版。

## 驗收

- [x] 查證①–③有證據
- [x] 單元測試 ＋ 突變檢查；typecheck 0 / 0、`test:unit`、`vite build`
- [x] Docker 最小映像實跑：沒有 `libatomic1` → 安裝後 `node --version` 成功；無 sudo 情境顯示提示；測試資源已清
- [x] 兩份文件已更新

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

- **狀態**：DONE
- **完成時間**：2026-11-02T01:35:01+0800
- **產品 commit**：`915f90ab` fix(remote-tools): node recipe installs libatomic first and verifies node runs (T0756, BUG-187)
- **session_id**：f9a96616-3bb6-4857-8184-eaa4e1e6acc6

### 落點檢查

- 結果：**PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（REPO_ROOT = main repo）
- C-1：工單位於 REPO_ROOT 的 `_ct-workorders/` 下 → PASS
- C-3：前 5 筆可測項目都存在 → PASS（資訊性）
- C-2：工單沒有 `branch` 欄位；目前分支 `main`
- 環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`、未設 `CT_HOME`（非 worktree）、`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`、`BAT_REMOTE_TOKEN` 已設定

### 查證結果（①–③）

**① recipe 現況（改動前）**：node 的 install / update 只在 `nodeUnsupported`（unknown OS → `no-recipe`；musl / apk → `node-musl-source-build`）分流。其餘所有 Linux（apt / dnf / yum / none / brew × 4 種 privilege）與 macOS 都組出**完全相同**的 nvm 命令，`needsSudo: false`、沒有 `prerequisites`，沒有任何程式庫檢查，也沒有驗證步驟（改動前的 snapshot 共 20 列 node，內容都一樣）。

**② 哪些 Node.js 需要 `libatomic.so.1`**（WSL Docker `ubuntu:24.04` 最小映像，下載 nodejs.org 官方 tarball，用 `readelf -d` 看 NEEDED，x64 另跑 `ldd` 與 `node --version`）：

| 版本 | linux-x64 | linux-arm64 | x64 實跑（無 libatomic1） |
|---|---|---|---|
| v26.13.0（目前 LTS Lithium） | 需要 | 需要 | `libatomic.so.1 => not found`，exit **127**，`error while loading shared libraries` |
| v26.0.0 / v25.9.0 / v25.0.0 | 需要 | （未測） | （未跑） |
| v24.22.2 / v22.23.4 / v20.20.2 | 不需要 | 不需要 | 正常輸出版本，exit 0 |

⇒ 從 Node.js 25 起需要。`ubuntu:24.04` 基礎映像沒有這個程式庫（`ldconfig -p` 查不到、dpkg 也沒有安裝）。

**③ 各套件管理器的套件名**：

| 系統 | 套件管理器 | 套件 | 證據 |
|---|---|---|---|
| Ubuntu 24.04 | apt | `libatomic1` | `apt-cache policy` 有候選版 14.2.0-4ubuntu2~24.04.1；`dpkg-deb -c` 內含 `/usr/lib/x86_64-linux-gnu/libatomic.so.1` |
| Debian 12 | apt | `libatomic1` | 候選版 12.2.0-14+deb12u1；同樣含 `libatomic.so.1` |
| Fedora 44 | dnf | `libatomic` | `dnf provides libatomic.so.1` → `libatomic-16.2.1-3.fc44` |
| Rocky 9.3 | dnf | `libatomic` | → `libatomic-11.5.0-14.el9` |
| Amazon Linux 2 | yum | `libatomic` | `yum provides` → `libatomic-7.2.1-2.amzn2.0.2` |

- 以上四個基礎映像都**沒有**這個程式庫。
- zypper / pacman：探測端（`REMOTE_PKG_MANAGERS`）不會回報這兩個，這類主機的 pkgManager 是 `none`，所以不建對應；結尾改提示「用發行版的套件管理器安裝（libatomic1 或 libatomic）」。
- 另外發現：Debian 12 非 root 的 login PATH 沒有 `/usr/sbin`，`ldconfig` 不在 PATH 上（Ubuntu 有）。所以檢查命令依序試 `ldconfig` → `/sbin/ldconfig` → `/usr/sbin/ldconfig`。

### 實作摘要

- `src/lib/remote-tools/recipes.ts`
  - 新增 `NODE_LIBATOMIC_SONAME`、`LIBATOMIC_PACKAGES`、`LIBATOMIC_CHECK`、`NODE_VERIFY_COMMAND`、`withLibatomicHint`、`missingLibraryFix`，以及內部的 `nodeLinuxParts`。
  - **A — 有對應套件、可提權**（apt / dnf / yum 搭配 root 或 sudo）：
    - 命令開頭加 `( <check> || ( <install> ) )`，同一段也放進 `prerequisites`，確認畫面的「先執行」看得到。
    - 有 sudo 時 `needsSudo: true`；root 不帶 sudo（Docker）。
    - 主機已經有這個程式庫時，只跑 `ldconfig -p | grep`，不會執行任何套件管理器。
  - **A — 沒有 sudo**（`sudo-missing`）：
    - 不中止 node 安裝，沒有 `prerequisites`，`needsSudo: false`。
    - 命令最後是 `|| { bat_rc=$?; <check> || echo "<提示>"; (exit $bat_rc); }`：node 跑不起來而且缺程式庫時，印出要請管理員以 root 執行的指令，並保留原本的 exit code。
  - **A — 沒有對應的套件管理器**（Linux 上的 `none` / `brew`）：同樣在結尾提示，內容改成通用的套件名說明。
  - **B**：所有 Linux 的 node install / update 最後都跑 `node --version`。
  - **不變**：macOS 的命令完全不變（測試守住）；musl / apk、unknown OS 照舊 unsupported；nvm 本身仍不用 sudo。
  - 每種情境各加一個 note（`nodeLibatomic` / `nodeLibatomicNoSudo` / `nodeLibatomicManual`）。
- `src/lib/remote-tools/install-runner.ts`
  - 新增 `cannotRunNotice`：只用 T0753 白名單欄位（程式庫檔名、exit code），不回 stderr 原文。
  - `libatomic.so.1` 搭配 apt / dnf / yum 時附上修正指令；沒有 sudo 時改用「請管理員以 root 執行」的文字。
  - `completionNotice` 遇到 `error` 且帶有 `versionError` 時，顯示原因，不再顯示「未偵測到」。
  - node 的命令以非 0 結束時，先重新偵測：確認是跑不起來 → 顯示原因與修法；否則照舊顯示 `failed`。其他工具的行為不變（不會多跑一次偵測）。
- `src/components/remote-tools/RemoteToolsPanel.tsx`：`error` 列缺 `libatomic.so.1` 時，提示改成附修正指令（`versionErrorMissingLibraryFix` / `FixAsRoot`）；其他程式庫、macOS、musl 維持 T0753 原本的文字。
- locales（en / zh-TW / zh-CN）：新增 2 個 hint、3 個 note、4 個 result key。
- 文件：
  - `docs/agent-guide/remote-security.md`：「BAT 不改 server … PATH」改為「PLAN-057 / T0755 起預設取登入 shell PATH，可在設定 › 進階 › BAT 伺服器 PATH 關閉」，連到 `headless-login-shell-path.md`；並補一句 Node.js 安裝會先處理 libatomic。
  - `docs/remote-dev-overview.md`：「Where the server PATH comes from」改寫，連到同一份文件；BUG-186 段落補一句指向新節；新增「Remote tools: Node.js and libatomic (T0756 / BUG-187)」一節。
  - CLAUDE.md 未改（沒有新增必守規則）。

### 驗證

**原始碼與單元測試**
- `recipes.test.ts`：明寫預期字串，不引用模組常數，涵蓋：
  - apt / dnf / yum × root / passwordless / password-required / sudo-missing、none / brew；
  - install 與 update；
  - macOS 不變；apk / musl 不變（unsupported）；
  - nvm 部分不含 sudo；
  - 提示文字不含 `!`、`$`、反引號、引號、`sudo`；
  - `missingLibraryFix`（含竄改過的 env → null）。
  - matrix 不變式「`needsSudo` ⇔ 命令含 sudo」照常成立（第一版提示句含「no sudo」字樣被它抓到，已改寫措辭）。
  - snapshot 只有 20 列 node 更新，其他工具沒有變。
- `node-libatomic-shell.test.ts`（新檔）：用真的 `sh`（本機是 Git Bash），PATH 前面放假的 `ldconfig` / `sudo` / `apt-get` / `dnf` / `node`，共 10 個案例：
  - 已有程式庫 → 只呼叫 `node --version`，不跑套件管理器；
  - apt + sudo 缺程式庫 → `sudo apt-get update`、`sudo apt-get install -y libatomic1`；
  - root 缺程式庫 → 不帶 sudo；
  - dnf → `sudo dnf install -y libatomic`；
  - 套件管理器失敗 → 命令在那一步停下，exit 100；
  - node 跑不起來 → exit 127；
  - 沒有 sudo + 缺程式庫 → 印出提示，exit 127 保留；
  - 沒有 sudo + node 正常 → exit 0，不印提示；
  - 有程式庫但 node 因其他原因失敗 → 不印提示；
  - 沒有對應套件管理器 → 印出通用提示。
- `install-runner.test.ts`：
  - node exit 127 → 重新偵測 → `cannotRunMissingLibraryFix`；
  - 沒有 sudo → `FixAsRoot`；
  - exit 非 0 但 node 正常，或重新偵測失敗 → 照舊 `failed`；
  - exit 0 但跑不起來 → 顯示原因；
  - `cannotRunNotice` 的白名單、null 情況、竄改過的 env。
- `remote-tools-panel.test.tsx`：
  - 修正指令 5 種組合；
  - 其他程式庫、macOS、musl 不附指令；
  - 確認對話框：有 sudo 時顯示 sudo「是」、「先執行」、note；沒有 sudo 時不列 prerequisite。
- `src/locales/__tests__/i18n-completeness.test.ts`：登記 2 個新 hint key（見〈偏差〉）。

**突變檢查**（暫時改 `recipes.ts` / `install-runner.ts` 跑測試，每次都從備份還原，`diff -q` 確認一致；沒有用 git 指令還原）：

| 突變 | 結果 |
|---|---|
| M1：命令拿掉 prerequisite | 12 個測試失敗 |
| M2：拿掉 `node --version` 驗證步驟 | 14 個失敗 |
| M3：拿掉 libatomic 檢查（每次都裝） | 7 個失敗 |
| M4：提示不保留 exit code | shell 測試 3 個失敗 |
| R1：runner 遇到 node exit 非 0 不重新偵測 | 2 個失敗 |
| R2：`completionNotice` 不看 `versionError` | 1 個失敗 |

**Build 與 typecheck**
- `npm run typecheck` = 0
- `npm run typecheck:electron` = 0
- `npx vite build` 成功
- `npm run test:unit`：364 檔、6479 通過、10 skipped、0 失敗

**實機驗證**（WSL Docker；容器都叫 `bat-e2e-t0756-*` 並帶 `--rm`；跑的是 TS 實際組出、加上 sentinel 的命令；`ubuntu:24.04` 最小映像先只裝 `curl` / `ca-certificates`）：

1. **root**（Docker 情境）
   - 執行前 `ldconfig -p` 查不到 libatomic，執行後查得到（1 筆）；
   - 過程中 `Setting up libatomic1:amd64`，nvm 裝好 v26.13.0；
   - 最後 `node --version` = `v26.13.0`，sentinel exit **0**；
   - `bash -lc 'node --version'` 也是 v26.13.0。
2. **非 root、沒有 sudo**（容器內沒有 sudo，執行前沒有 libatomic）
   - nvm 照樣印 `Now using node v26.13.0`（nvm 自己 exit 0，就是 BUG-186 的成因）；
   - 驗證步驟印出 loader 錯誤，接著印出 `BetterAgentTerminal: Node.js cannot start because libatomic.so.1 is missing, and this account cannot install system packages. Ask an administrator to run as root: apt-get update && apt-get install -y libatomic1`；
   - sentinel exit **127**；
   - 用 login shell 跑實際的 `LOGIN_PROBE_SCRIPT`，得到 `tool.node.version_rc=127`、`tool.node.missing_lib=libatomic.so.1`，也就是 runner 會顯示 `cannotRunMissingLibraryFixAsRoot`；
   - 管理員裝好 `libatomic1` 後，`node --version` = v26.13.0。
3. **免密碼 sudo 的使用者**
   - prerequisite 透過 sudo 安裝了 `libatomic1`，`node --version` = v26.13.0，exit 0；
   - 接著在**已有程式庫**的情況下跑 update：沒有任何 apt 輸出，只印 `Node.js v26.13.0 is already the latest LTS`、`v26.13.0`，exit 0；
   - probe：`tool.node.version=v26.13.0`。
4. **清理**
   - 容器：都帶 `--rm`，`docker ps -a --filter name=bat-e2e-t0756` 查不到任何容器。
   - 映像：只刪本單才拉的 `ubuntu:24.04`、`fedora:latest`、`rockylinux:9`、`amazonlinux:2`（開工前確認過不存在）。使用者原有的 `debian:bookworm-slim` 只拿來跑過 `--rm` 唯讀查詢，保留不刪。沒有用 `prune`。
   - WSL `/tmp/bat-e2e-t0756-*` 已刪除。
   - 沒有動使用者的 WSL 發行版與 bat-server，沒有用 SSH 主機。

### 偏差

- 改了 `src/locales/__tests__/i18n-completeness.test.ts`（不在 `affects_files`）：這份測試維護一份 `remoteTools.*` key 的預期清單，在 locales 新增 hint key 就一定要登記。只加了 2 行 key 與一行註解，沒有改其他內容。
- 盤點時順帶發現：現行 `pkgManager` 沒有 zypper / pacman，這類主機走通用提示（工單已預期「查不到的不對應」）。

### 遭遇問題

- 第一版「沒有 sudo」的提示句含 `no sudo` 字樣，違反 matrix 不變式（「`needsSudo` ⇔ 命令含 sudo」），已改寫為 `cannot install system packages`，並在註解寫明原因。
- 第一次完整驗證開始後又做了小重構（把 env 正規化收進 `missingLibraryFix`），所以停掉重跑；上面的數字是最後一次的結果。

### 後續建議

- 無必要的後續工單。若日後探測端回報 zypper / pacman，再把 `LIBATOMIC_PACKAGES` 擴充（openSUSE `libatomic1`、Arch 屬於 `gcc-libs`，屆時需另行查證）。

### 互動紀錄

- 無（yolo；沒有向塔台提問）。

### Commit 狀態

- 產品 commit：`915f90ab`（只用 `git commit --only` 提交本單範圍的檔案）。
- 工單 commit：本回報之後另行提交。
- 未 push。
