---
schema_version: 1
schema_kind: workorder
id: T0753
title: "BUG-186 修正：遠端工具偵測 nvm 的 Node.js「無回應」與 `~/.local/bin` 工具「伺服器：不可見」；WSL / Docker / SSH 三種遠端都檢查"
type: implementation
status: FIXED
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-01T22:33:34+0800"
started_at: "2026-11-01T22:38:29+0800"
updated_at: "2026-11-01T22:52:04+0800"
completed_at: "2026-11-01T22:52:04+0800"
session_ids:
  - "f9aec736-0fbd-409d-9e6f-0683e87b752d"
depends_on: []
related:
  - "BUG-186（使用者 WSL 精靈截圖）；D205（本單完成後與 T0750 / T0751 / T0752 一起發 `0.7.3-pre.2`，使用者指示「nvm 與 uv 偵測錯誤也一起修」）"
  - "CLAUDE.md「Remote 資安（PLAN-018 T0182）」（SSH / WSL bundle 安裝）、「Child Process Spawning」；`docs/agent-guide/remote-security.md`"
affects_files:
  - "electron/remote-tools/probe-script.ts（推測）"
  - "electron/remote-tools/parse.ts（推測）"
  - "electron/handlers/remote-tools.ts（推測）"
  - "src/components/remote-tools/RemoteToolsPanel.tsx（推測，只在顯示邏輯需要時）"
  - "src/locales/{en,zh-TW,zh-CN}.json（只在需要新字串時）"
  - "對應的 unit test"
  - "docs/agent-guide/（遠端工具偵測的說明；找現有對應檔，沒有就寫進 remote-security.md）"
  - _ct-workorders/T0753-fix-bug186-remote-tools-nvm-uv-detection.md
  - _ct-workorders/BUG-186-remote-tools-nvm-node-no-version-uv-hidden.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 目標 1（Node.js 無回應）：nvm 安裝的 node（`~/.nvm/versions/node/<v>/bin/node`）已在 PATH 上卻「沒有回報版本」→ 查清探測腳本怎麼取版本（PATH、`NVM_DIR`、shell 初始化、逾時、stdout / stderr、版本解析 regex），修到正確顯示 node 版本（例 `v26.13.0`），並確認 nvm 版本標籤（`nvm 0.40.8`）與 node 版本分開呈現的邏輯沒有互相覆蓋。"
  - "🔴 目標 2（伺服器：不可見）：先查證「伺服器：可見 / 不可見」的判斷依據，與 BAT server 開出的 PTY 實際能不能執行到該工具（例 `~/.local/bin/uv`、nvm 的 node）是否一致。一致（server 開的分頁真的找不到）→ 這不是偵測錯誤而是 server PATH 問題：🔴 改 server / systemd unit / launchd / Docker 容器的 PATH 屬行為變更，先以 ct-exec § Questions For Tower 問塔台，附選項與影響（例：unit 加 `Environment=PATH=…`、PTY 一律走 login shell、只改顯示說明），塔台答覆前不改。不一致（分頁其實找得到）→ 修判斷。兩種情況都要把結論與證據寫進回報。"
  - "🔴 三種遠端都要檢查（使用者要求）：WSL（使用者回報的環境）、Docker、SSH 各自的工具偵測路徑（共用或各自的 probe、server 的啟動方式與 PATH 來源）是否有同樣問題；每種寫結論與依據。Docker 實測只用 WSL 內的 Docker（T0743 做法：只建 / 刪 `bat-e2e-t0753-` 前綴的資源，前後比對使用者的容器 / 映像 / volume 清單相同，不 `builder prune`）；SSH 沒有測試主機就以程式碼與 unit test 判斷，🔴 不得連線使用者的 SSH 主機（含 `~/.ssh/config` 裡的主機），需要實機時問塔台。WSL 實測照 T0748 做法：測試專用 headless server（`/tmp/bat-e2e-t0753`、不經 systemd），🔴 不動使用者的 WSL bat-server、`~/.config/systemd/user`、`~/.nvm`、`~/.local`（只讀可以，前後比對）；WSL 未執行就 skip，不由測試啟動 WSL。"
  - "🔴 安全：遵守 CLAUDE.md「Child Process Spawning」（`execFile` / `spawn` + array args、外部輸入白名單、timeout 必設）；探測腳本不得執行使用者的 shell rc 以外的未知程式，不得輸出權杖或環境變數值到日誌。"
  - "🔴 不回歸（R-G003）：其他工具（ripgrep、Python 3、curl、bash、claude、codex 等）的偵測結果與顯示不變；精靈各步驟（T0554 升級 / rollback、T0751 的 t0512 e2e）不受影響；BUG-183 / 184 / T0752 的修正不受影響。回報區列〈相關通過案例〉判定。"
  - "🔴 驗證：unit 涵蓋 nvm node 版本解析、`~/.local/bin` 工具的可見性判斷（依查證結論）、Docker / SSH 相關路徑；`npm run test:unit` 全過、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功；重跑 `e2e/t0512-profile-panel-layout.spec.ts` 綠；有實測的遠端寫結果，修正前後對照（修正前重現 → 修正後正確）。完成後 BUG-186 改 FIXED（附 commit、`fixed_at` 取系統時間）。不發版、不 push、不改 CHANGELOG。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，回報 / 測試 / spec 不得出現使用者家目錄路徑、使用者名稱、主機名或 SSH 主機別名（寫 `<使用者家目錄>`）。"
  - "🔴 範圍：只修 BUG-186；發現其他缺陷記在回報區〈發現的問題〉，由塔台開單。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0753 — BUG-186 修正：遠端工具偵測（nvm node / `~/.local/bin`）

## 元資料

- **工單編號**：T0753
- **類型**：implementation（bug fix）
- **優先級**：P2
- **建立時間**：2026-11-01T22:33:34+0800
- **預估規模**：S

## 背景

使用者以設定精靈把 WSL bat-server 升到 `0.7.3-pre.1` 時，完成畫面的工具清單把 nvm 安裝的 Node.js 標「無回應」（在 PATH 上找到但沒有回報版本），`~/.local/bin` 的 uv 標「伺服器：不可見」，其實兩者都已安裝可用。使用者要求一起修，並檢查 Docker / SSH 是否有同樣問題；完成後併入 `0.7.3-pre.2`。

## 範圍

1. 查清 node 版本偵測失敗與「伺服器：可見」判斷依據。
2. 修正偵測（server PATH 若要改，先問塔台）。
3. WSL / Docker / SSH 三種遠端逐一檢查。
4. unit / build / e2e；docs；BUG-186 → FIXED。

## 不做

- 未經塔台答覆不改 server / systemd unit / 容器的 PATH。
- 不連線使用者的 SSH 主機、不動使用者的 WSL server 與工具安裝。

## 驗收

- [ ] nvm node 顯示正確版本
- [ ] 「伺服器：可見 / 不可見」與 server 分頁實際可用性一致（或依塔台答覆處理）
- [ ] WSL / Docker / SSH 各自結論
- [ ] 〈相關通過案例〉判定
- [ ] unit / typecheck 0 / 0 / build / t0512 e2e

## 回報區

### 待塔台決策

#### Q-1：node「無回應」其實是正確的偵測結果（node 本身無法執行），要怎麼呈現？
- **提問時間**：2026-11-01T22:38:29+0800
- **證據**（WSL `Ubuntu-24.04`，唯讀）：`<使用者家目錄>/.nvm/versions/node/v26.13.0/bin/node --version` → `error while loading shared libraries: libatomic.so.1: cannot open shared object file`，exit 127；使用者自己的登入互動 shell（`bash -l -i -c 'node --version'`）同樣失敗；`libatomic1` 未安裝（`ldconfig -p` 0 筆）。nvm 預設 `lts/*` 指向 v26.13.0；另一版 v24.22.0 正常。探測腳本取版本的方式（`timeout 5 <path> --version`）沒有問題，工單要求「顯示 v26.13.0」無法成立。
- **選項**：
  - A（建議）：維持「無回應」，探測另記 `--version` 的 exit code 與「缺少的共用程式庫名稱」（只取符合 `lib…\.so…` 白名單的檔名，不回傳 stderr 原文），面板說明改成「在 PATH 上找到，但無法執行：缺少共用程式庫 libatomic.so.1」（沒有可辨識原因時附 exit code）。所有工具共用，ok 的工具顯示不變。
  - B：從 nvm 路徑推出 `v26.13.0` 顯示在版本欄，狀態仍「無回應」。
  - C：只改文案（不改探測）。
  - 其他。
- **建議理由**：A 讓使用者知道要裝 `libatomic1`（或換 node 版本），且不把壞掉的 node 顯示成有版本；B 會誤導。
- **影響**：probe 多兩個 key、parse / types / i18n（三語）、面板一行；不影響其他工具。
- **是否阻塞**：是（決定目標 1 的實作）。
- **通道**：BAT（`q-b3b87d5d-eef05e09b74cf346`）

#### Q-2：「伺服器：不可見」對 server 程序是正確的、對 server 開的終端分頁不正確，要怎麼修？
- **提問時間**：2026-11-01T22:38:29+0800
- **證據**：判斷依據 = bat-server 程序自己的 PATH（`/bin/sh -c 'command -v …'`，`buildServerProbeInvocation`）。WSL 的 bat-server（systemd user unit）PATH = `/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games:/snap/bin`（unit 沒設 PATH，繼承 `systemctl --user show-environment`），沒有 `~/.local/bin`、沒有 nvm。server 開的終端分頁走 `bash -l -i`（`PtyManager`，headless 共用），`~/.profile` 加入 `~/.local/bin`、`.bashrc` 載入 nvm → 分頁裡 `uv` 找得到（實測登入互動 shell `command -v uv` = `<使用者家目錄>/.local/bin/uv`）。server 程序本身：Git / GitHub 面板的 git / gh 另有 resolver 會掃 `~/.local/bin`、`/usr/local/bin`；Claude 面板（內嵌 claude）的 Bash 工具、MCP 子程序繼承 server PATH，確實找不到 uv / nvm node。tooltip 只寫「Git / GitHub 面板」。三種遠端同一套探測：SSH Linux 同 WSL（systemd user unit）、SSH macOS 是 launchd（PATH 更窄，沒有 Homebrew）、Docker 用映像 PATH（root；`/root/.local/bin` 連登入 shell 都不在 PATH，登入檢視本來就標「不在 PATH」）。
- **選項**：
  - A（建議，本單）：不改 server PATH，只修判斷 / 顯示：登入檢視找得到、server 程序找不到時改標「伺服器程序：不可見（終端分頁可用）」之類的文案，tooltip 寫清楚影響範圍（Git / GitHub 面板、Claude 面板的工具與 MCP）；git / gh 的 server 判斷比照 headless resolver 多掃 `~/.local/bin`、`/usr/local/bin`（與實際一致）。
  - B：bat-server 啟動時以登入 shell 取得 PATH 套到自己（比照 macOS 的 `early-path-fix`，含 timeout），systemd / launchd / Docker 都生效 → Claude 面板、MCP 也找得到；行為變更，影響所有 headless 子程序，需重啟 server，建議另開單。
  - C：systemd / launchd unit 寫入 `Environment=PATH=…`（安裝當下的登入 PATH）；只有新裝 / 升級生效，Docker 不適用。
  - D：拿掉這個標記。
  - 其他。
- **建議理由**：A 範圍小、可隨 `0.7.3-pre.2` 發；B 才是「server 程序真的用得到」的根治，但屬行為變更且影響面大，不宜併入本批。
- **影響**：A：parse（server 判斷）、i18n 三語、面板文案、unit test；B / C：另開單。
- **是否阻塞**：是（決定目標 2 的實作）。
- **通道**：BAT（`q-b3b87d5d-88293996fd757add`）

### 互動紀錄

- [22:34] 開工；落點檢查 C-0 PASS（`repo` = `better-agent-terminal` = basename），`CT_HOME` 未設。
- [22:38] 實測確認 node 無法執行（libatomic）、server PATH 與分頁 PATH 不同 → Q-1、Q-2 問塔台。
- [22:40] Q-1: node 無法執行要怎麼呈現 → A（塔台，BAT 通道）: 採 A，維持「無回應」，探測另記 `--version` exit code 與缺少的共用程式庫檔名（白名單、不回 stderr 原文），面板說明「在 PATH 上找到，但無法執行：缺少共用程式庫 <檔名>」，沒有可辨識原因時附 exit code；不得從 nvm 路徑推版本；目標 1 改為「正確說明無法執行的原因」 → Action: 依 A 實作。
- [22:40] Q-2: 「伺服器：不可見」怎麼修 → A（塔台，BAT 通道）: 採 A，不改任何 PATH；登入檢視找得到、server 程序找不到時改標「伺服器程序：不可見（終端分頁…）」類文案，tooltip 寫清楚影響範圍；git / gh 的 server 判斷比照 headless resolver 多掃 `~/.local/bin`、`/usr/local/bin`；B 由塔台另提，回報〈發現的問題〉附 B 的影響評估 → Action: 依 A 實作。
- [22:41] 實作探測 / parse / 面板 / i18n；WSL 以新舊腳本對照（只多 node 兩行）、假工具測 glibc / musl / timeout / stderr 不外洩。
- [22:43] Docker（WSL 內，拋棄式容器 `bat-e2e-t0753-probe`）新舊對照；資源清單前後相同。
- [22:44] 真實 handler 打包在 WSL 以 server 環境執行，node `versionError` = 127 / libatomic.so.1。
- [22:47] 補 unit test；全套 unit 首跑 `i18n-completeness` 3 項失敗（預期 key 清單）→ 補上後 6408 全過；typecheck 0 / 0、vite build、t0512 e2e 2 passed。
- [22:50] 產品 commit `0f021e67`；BUG-186 → FIXED；WSL 暫存 `/tmp/bat-e2e-t0753` 已刪，使用者 bat-server（MainPID 不變）未動。

### 完成狀態

- **狀態**：FIXED（實作與驗證完成，待實機驗收：使用者 WSL server 升到含 T0753 探測的版本後，精靈 / 設定檔卡片「重新檢查」）
- **完成時間**：2026-11-01T22:52:04+0800
- **產品 commit**：`0f021e67`（fix(remote-tools): T0753 …），基底 `6a2c6771`
- **session_id**：f9aec736-0fbd-409d-9e6f-0683e87b752d
- **工單目標 1 依塔台 Q-1 答覆改為**「正確說明無法執行的原因」（node 本身跑不起來，顯示 v26.13.0 不成立）。

### 落點檢查

- 結果：**PASS**
- C-0：工單 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（`CT_HOME` 未設，非 worktree）
- C-1：工單位於 REPO_ROOT 之下 → PASS
- C-3：資訊性；`affects_files` 前 5 項（`electron/remote-tools/*`、`electron/handlers/remote-tools.ts`、`src/components/remote-tools/RemoteToolsPanel.tsx`、`src/locales/…`）皆存在 → PASS
- C-2：工單無 `branch` 欄位，不適用（目前 `main`）
- `BAT_WORKSPACE_ID`：`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）

### 查證結論與證據

**目標 1：node「無回應」（WSL，使用者回報的環境，全程唯讀）**

- 修正前重現：以現行探測腳本在 WSL 跑登入檢視（`bash -l -i -c 'exec /bin/sh -c "$1"' …`，與 bat-server 相同呼叫方式）→ `tool.node.state=found`、`tool.node.path=<使用者家目錄>/.nvm/versions/node/v26.13.0/bin/node`、`tool.node.version=`（空）、`tool.node.nvm=0.40.8` → 面板「無回應」。
- 根因：**node 本身無法執行**，不是偵測錯誤。`<使用者家目錄>/.nvm/versions/node/v26.13.0/bin/node --version` → `error while loading shared libraries: libatomic.so.1: cannot open shared object file: No such file or directory`，exit 127；使用者自己的登入互動 shell `node --version` 同樣失敗；`ldconfig -p | grep -c libatomic` = 0、`libatomic1` 未安裝；nvm 預設 `lts/*` 指向 v26.13.0，另一版 v24.22.0 正常。PATH、`NVM_DIR`、shell 初始化、逾時（5 s）、stdout / stderr 處理、版本 regex 都沒有問題。
- nvm 標籤與 node 版本：`nvm 0.40.8` 是 `tool.node.nvm`（`nvm --version`），node 版本是 `tool.node.version`，兩者分開解析、分開呈現，沒有互相覆蓋；截圖版本欄的 `nvm 0.40.8` 是 nvm chip（node 沒有版本可顯示）。
- 修正後（同一環境）：探測多出 `tool.node.version_rc=127`、`tool.node.missing_lib=libatomic.so.1`，其他所有工具（claude / git / gh / codex / curl / bash / rg / uv / python3）的輸出逐行相同（新舊腳本 diff 只有這兩行）。以真實 handler 程式碼（`runRemoteToolsDetect` esbuild 打包，在 WSL 以模擬 systemd server 的環境 `env -i HOME PATH=<server PATH> SHELL=/bin/bash` 執行）得到 `node error versionError={"exitCode": 127, "missingLibrary": "libatomic.so.1"}`，面板顯示「在 PATH 上找到，但無法執行：缺少共用程式庫 libatomic.so.1。」
- 使用者要讓 node 可用：`sudo apt install libatomic1`，或 `nvm alias default 24`（v24.22.0 正常）。這屬使用者主機狀態，本單未動。

**目標 2：「伺服器：不可見」**

- 判斷依據：`buildServerProbeInvocation` = `/bin/sh -c 'command -v …'`，用 bat-server 程序自己的 env。WSL 的 bat-server（systemd user unit，`Environment` 只有 `BAT_PORT` / `BAT_SERVER_PORT` / `BAT_DATA_DIR` / `BAT_SERVER_DATA_DIR`）程序 PATH = `/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games:/snap/bin:/snap/bin`（= `systemctl --user show-environment`），沒有 `~/.local/bin`、沒有 nvm。
- server 開的終端分頁：`PtyManager.create`（headless 共用）在 Linux / macOS 以 `-l -i` 啟動 shell → `~/.profile` 加入 `~/.local/bin`、`.bashrc` 載入 nvm；登入互動 shell 實測 `command -v uv` = `<使用者家目錄>/.local/bin/uv`。
- 結論：**不一致**——標記反映 server 程序（Git / GitHub 面板、Claude 面板的 Bash 工具 / MCP 子程序繼承這個 PATH），不反映終端分頁；git / gh 在 server 端另有 `resolveGitBinary` / `resolveGhBinary` 掃 `~/.local/bin` 等位置，原判斷對 git / gh 也偏窄。依塔台 Q-2 答覆 A 修判斷與文案，不改任何 PATH。
- 修正後：登入檢視找得到（ok / too-old / error）、server 程序找不到 → 「伺服器程序：不可見（終端分頁找得到）」（uv、claude、codex、node 在使用者 WSL 都是這種）；git / gh 的 server 判斷多掃 `/usr/bin`、`/usr/local/bin`、（macOS）`/opt/homebrew/bin`、`~/.local/bin`；tooltip 寫明影響範圍與「終端分頁以左邊的狀態為準」。

**三種遠端各自的結論**

| 遠端 | 探測路徑 | server PATH 來源 | node 無法執行 | `~/.local/bin` 工具 | 依據 |
|---|---|---|---|---|---|
| WSL | headless `remote-tools:detect`（同一份 probe） | systemd user unit，未設 PATH | 同樣顯示原因（實測 libatomic） | 登入檢視 ok、server 程序不可見 → 新文案 | 使用者 WSL 唯讀實測＋真實 handler 打包執行 |
| Docker | 同上（容器內 bat-server） | 映像 `PATH`（`/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`），root | 同樣顯示原因 | `/root/.local/bin` 連登入 shell 也不在 PATH → 登入檢視「不在 PATH」、server「不可見」，兩者一致，文案不變 | WSL 內 Docker，`bat-server:latest` 拋棄式容器 `bat-e2e-t0753-probe` 實測（新舊腳本對照） |
| SSH Linux | 同上 | systemd user unit（`ssh-start-server.ts`），同 WSL | 同 WSL | 同 WSL | 程式碼（同一份 probe / handler / unit 產生方式）＋ unit test；未連線任何 SSH 主機 |
| SSH macOS | 同上 | launchd 預設 PATH（`/usr/bin:/bin:/usr/sbin:/sbin`，無 Homebrew） | 載入器句型不同（dyld），只顯示 exit code | Homebrew / `~/.local/bin` 工具 → 新文案；git / gh 多掃 `/opt/homebrew/bin` | 程式碼＋ unit test |

Docker 實測細節：容器 `--rm --network none`，以唯讀 bind mount 帶入腳本，在容器內建立假的 nvm（v26.13.0 node 模擬載入器錯誤）與 `/root/.local/bin/uv`。修正前 `tool.node.version=`（空）；修正後多 `tool.node.version_rc=127`、`tool.node.missing_lib=libatomic.so.1`；`uv` 兩版都是 `offpath`；server 檢視兩版相同。開始前與結束後 `docker ps -a` / `images` / `volume ls` / `network ls`（名稱與 id）比對 **完全相同**（`diff` 無差異；使用者原有 1 個執行中容器、映像、volume、network 皆未變）。未 pull、未 build、未 prune。

### 變更檔案

- `electron/remote-tools/probe-script.ts`：登入檢視 `--version` 改為同時取 exit code（`__bat_rc` 尾行，避免 `head` 的 SIGPIPE）；沒有版本行時輸出 `tool.<id>.version_rc`，非 124 / 137 / 143 時再跑一次，只以 `sed` 取 glibc / musl 載入器句型的檔名輸出 `tool.<id>.missing_lib`（stderr 其餘內容不輸出）；server 檢視 git / gh 多掃 resolver 位置。
- `electron/remote-tools/parse.ts`：whitelist 加兩個 key；`parseVersionError`（exit code 0–255、檔名 `^lib[A-Za-z0-9._+-]*\.so(\.[0-9]+)*$` ≤ 128 字）；只在 `error` 列設 `versionError`。
- `src/types/remote-tools.ts`：`RemoteToolReport.versionError?`、`serverVisible` 說明。schema 版號維持 1（選用欄位，新舊 client / server 互通）。
- `src/components/remote-tools/RemoteToolsPanel.tsx`：`serverVisibilityKey`、`versionErrorHint`（模組內函式）。
- `src/locales/{en,zh-TW,zh-CN}.json`：`remoteTools.server.hiddenLoginOnly`、`remoteTools.hint.versionErrorMissingLibrary`、`remoteTools.hint.versionErrorExitCode`；`remoteTools.server.tooltip` 改寫。
- 測試：`electron/remote-tools/__tests__/probe-script.test.ts`、`parse.test.ts`、`src/components/__tests__/remote-tools-panel.test.tsx`、`src/locales/__tests__/i18n-completeness.test.ts`（預期 key 清單加 3 個）。
- 文件：`docs/remote-dev-overview.md` 新節「Remote tools: "No response" and the server badge (T0753 / BUG-186)」（現有遠端工具說明在此檔，`docs/agent-guide/` 沒有對應主題檔）；`docs/agent-guide/remote-security.md` 加一條摘要與連結。
- 單據：`_ct-workorders/BUG-186-…md` → FIXED（`fixed_at` 取系統時間、`fix_commit: 0f021e67`、查證結論與修正段）。`_bug-tracker.md` 依 `_local-rules.md`「索引架構」由塔台 `*sync` 重建，本單未手改（也不在 `affects_files`）。

### 驗證結果

| 關卡 | 結果 | 證據 |
|---|---|---|
| `npm run test:unit` | PASS | 361 files / 6408 passed / 6 skipped（第一次跑 `i18n-completeness` 3 項失敗：預期 key 清單沒有新 key → 補上後全過） |
| `npm run typecheck` | 0 | exit 0 |
| `npm run typecheck:electron` | 0 | exit 0 |
| `npx vite build` | PASS | exit 0 |
| `e2e/t0512-profile-panel-layout.spec.ts` | PASS | 2 passed（4.5 s）；完成畫面截圖可見新文案「伺服器程序：不可見（終端分頁找得到）」，版面正常 |
| 真實 `/bin/sh` 測試（Windows 上 skip 的 3 個 describe） | PASS（等效） | 同內容以 esbuild 打包、在 WSL 以 node v24 執行：3 個案例全過（glibc / musl 檔名、stderr 不外洩、正常工具不受影響、git / gh 在 `~/.local/bin` 可見而 uv 不可見）；CI `tests.yml`（ubuntu-24.04）會直接跑 |
| WSL 實機（修正前後） | PASS | 見上〈查證結論〉；逾時工具（`sleep 10`）實測 5.0 s 結束、`version_rc=124`、不跑第二次 |
| Docker 實機（修正前後） | PASS | 見上；資源前後相同 |
| SSH | 程式碼＋ unit test | 未連線（工單禁止） |

- `validated_sha`：驗證在 `6a2c6771` 上的工作樹執行，內容即 commit `0f021e67`（驗證後未再改產品檔）。

### 相關通過案例判定

- 其他工具（ripgrep、Python 3、curl、bash、claude、codex、git、gh、uv）的偵測：新舊探測在使用者 WSL 的輸出逐行相同（只多 node 的兩行）→ **不變**。有版本的工具即使帶了 `version_rc` / `missing_lib` 也被忽略（unit test）。
- 「伺服器：可見 / 不可見」：server 看得到的列文案不變；登入檢視也找不到的列（missing / not-on-path / interop-only）文案不變；只有「登入檢視找得到、server 程序找不到」改為新文案（塔台 Q-2 指定的變更）。tooltip 文字改寫（塔台 Q-2 指定）。
- T0433 headless agent 可用性判斷（`RUNNABLE_TOOL_STATUSES` 含 `error`）：狀態值不變 → **不變**。
- 安裝 / 更新按鈕（`toolAction`）：依狀態決定，狀態值不變 → **不變**（`remote-tools-panel.test.tsx` 55 項全過）。
- 精靈 T0554 升級 / rollback、T0751 t0512 e2e：unit（`wizard-upgrade-rollback` 等）全過、t0512 e2e 2 passed → **不受影響**。
- BUG-183 / 184、T0752（profile 視窗、系統匣）：未改相關程式；全套 unit 通過 → **不受影響**。
- 未發現會改變任何通過案例的情況。

### 遭遇問題

- `i18n-completeness.test.ts` 以固定清單比對 `remoteTools` key，新增字串時須同步（已補）。
- Windows 上跑不到真實 `/bin/sh` 的測試，改以 WSL 等效執行驗證（見上）。

### 發現的問題

1. **（塔台 Q-2 要求附）選項 B 的影響評估：bat-server 啟動時以登入 shell 取得 PATH**
   - 效果：server 程序與其所有子程序（Git / GitHub 面板、Claude 面板的 Bash 工具 / hooks / MCP server、worktree、git-scaffold）看得到 `~/.local/bin`、nvm、Homebrew；「伺服器程序：不可見」幾乎消失；Claude 面板的 MCP（`npx` / `uvx`）在遠端才找得到 node / uv。
   - 範圍：headless 入口（WSL / SSH Linux 的 systemd、SSH macOS 的 launchd、Docker 的 ENTRYPOINT）。比照 `electron/early-path-fix.ts`（目前只對 macOS Electron 主程序），需含 timeout 與失敗 fallback；Docker 的 root 登入 shell 通常不加 `/root/.local/bin`，效果有限。
   - 風險：使用者 rc 檔慢 / 互動式輸出 / 錯誤會影響 server 啟動（必須 timeout、只取 PATH、輸出雜訊過濾）；PATH 會包含 WSL interop 的 `/mnt/c/...`（Windows 程式被 server 子程序叫到）；啟動時取一次，使用者之後改 rc 要重啟 server；所有 headless 子程序環境改變，需回歸 git / gh resolver、Claude 面板、headless PTY env（`buildPtyEnv` 以 server env 為底，登入 shell 會再加一次 PATH，可能重複項）。
   - 生效：需 server 升級並重啟。建議另開 PLAN / 工單，先在測試 headless server 量測啟動耗時與 PATH 差異。
2. **macOS SSH 的載入器錯誤（dyld `Library not loaded: …dylib`）不會被辨識為缺少程式庫**，只顯示 exit code。macOS 上 Homebrew 套件少見此情形，未處理；需要時另開單。
3. **本機（非遠端）Linux 視窗**：server 檢視的 git 判斷改為掃常見位置，但 Electron 主程序的 git 是純 PATH 查找（`electron/handlers/git.ts` 註解「Electron spawns plain `git`」），git 只在 `~/.local/bin`、不在 PATH 時，本機 Linux 會顯示可見但 Git 面板找不到。情境罕見，未處理。
4. gh 的 `githubCliPath` 設定（自訂路徑）不在 server 檢視考量內，與改前相同。

### 回報區互動 / 子代理

- 未使用子代理與 Workflow。

### Renew 歷程

- 無。
