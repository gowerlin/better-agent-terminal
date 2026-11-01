---
schema_version: 1
schema_kind: workorder
id: T0753
title: "BUG-186 修正：遠端工具偵測 nvm 的 Node.js「無回應」與 `~/.local/bin` 工具「伺服器：不可見」；WSL / Docker / SSH 三種遠端都檢查"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-01T22:33:34+0800"
updated_at: "2026-11-01T22:33:34+0800"
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

（Worker 填寫）
