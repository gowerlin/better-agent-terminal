---
schema_version: 1
schema_kind: workorder
id: T0663
title: "v0.7.1-pre.2 已安裝版自動化驗收：BUG-157 釘選→儲存、BUG-160 SSH 釘選停用、BUG-158 / 161 中文、BUG-163 精靈樣式"
type: implementation
status: TODO
repo: better-agent-terminal
project: BUG-verify-071pre2
priority: P1
sizing: M
created_at: "2026-10-18T21:30:28+0800"
started_at: ""
updated_at: "2026-10-18T21:30:28+0800"
completed_at: ""
target_version: "0.7.1-pre.2（驗收，不發版）"
related:
  - "BUG-157 / T0650（`5594ec57`）"
  - "BUG-160 / T0655（`02f1c6f8`）"
  - "BUG-158 / T0652（`15a792d4`）"
  - "BUG-161 / T0660（`a5caf04a`）"
  - "BUG-163 / T0658（`9d8e1985`）"
  - "T0520（`e2e/pre7-acceptance.spec.ts`：安裝版 + 隔離實例的做法範本）、T0515（`e2e/real-remote/t0515-*`：容器 sshd）"
  - "T0664（同時進行：BUG-162，另一個 spec 檔）"
affects_files:
  - e2e/v071-pre2-acceptance.spec.ts
  - e2e/real-remote/t0663-*
  - _ct-workorders/T0663-pre2-installed-remote-ui-acceptance.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **只寫驗收工具 / opt-in spec，不改產品程式碼**（`electron/**`、`src/**`、`scripts/**`、`package.json`、`e2e/fixtures/**` 不動，`e2e/fixtures/` 只讀 / 只 import）。發現產品缺陷 → 回報區記證據，該項 FAIL、整單 PARTIAL，**不自行修**。BUG 檔與 `_bug-tracker.md` 不動。"
  - "🔴 **受測 build = 已安裝的 pre.2**：`C:/Program Files/BetterAgentTerminal/BetterAgentTerminal.exe`（開工時確認 FileVersion `0.7.1-pre.2`，隔離實例 `app.getVersion()` 也要相符），以 `BAT_E2E_EXECUTABLE` + `e2e/fixtures/electron-isolation.ts` 的 `launchIsolated` 啟動（獨立 `--runtime` / userData、RemoteServer 用空閒埠）。"
  - "🔴 **不碰使用者正在用的 BAT**（port 9876、真實 userData 只讀）；不得連線、停止或改動 WSL 內使用者的 bat-server（port 9877、`~/.local/bat-server`）；WSL 精靈不得執行到會寫入任何發行版的步驟。"
  - "🔴 **不得消耗 Claude token**（不開 Claude 面板 / claude-cli 分頁；必要時沿用 T0514 / T0520 的 recorder 做法）。"
  - "🔴 **Docker / WSL**（若用到容器）：只建立、操作、刪除名稱前綴 `bat-t0663-` 且帶 label `bat.t0663=1` 的容器 / network；不得 prune、不得動其他容器 / image；不得 `wsl --shutdown` / `--terminate`；收尾刪除本單容器 / network。`~/.ssh/config` 若要動，沿用 T0515 / T0520 標記區塊 + SHA-256 還原。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 `npm run test:e2e`（L141）。commit 用 `git commit --only <本單檔案>`（L168：T0664 同時在跑）。工作樹裡 `src/styles/settings.css` 顯示 M（內容無差異），不要動、不要提交。"
  - "🔴 **證據（截圖 / JSON）不要放在 Playwright `outputDir`（`e2e-results/`）底下**（L169：每次執行會被清空）；放 temp / scratch 目錄，回報區寫絕對路徑。"
---

# T0663 — v0.7.1-pre.2 已安裝版自動化驗收（遠端畫面 / 精靈）

## 背景

`v0.7.1-pre.2`（run `39128867451`，target `9c5fe2b1`）已發佈，使用者本機已安裝（FileVersion `0.7.1-pre.2`，塔台 2026-10-18 21:27 確認）。BUG-157 / 160 / 158 / 161 / 163 都是 ✅ FIXED，修正工單驗的是 source build 與單元測試，本單改用**已安裝的 pre.2 exe** 再驗一次，做法沿用 T0520。

使用者指示「只做能自動化的」：能以 DOM / IPC / computed style / 截圖判定的項目做到 PASS / FAIL；真的需要外部環境（Docker Desktop、真實 SSH 主機）而本機做不到的，記 NEEDS-HUMAN 並寫明缺什麼，**不要為了湊 PASS 擴大環境**。

每項先讀對應 BUG 檔與修正工單回報區，再依那裡的情境設計步驟。

## 驗收項目

| # | BUG | 驗收重點（以 BUG 檔與修正工單為準） |
|---|---|---|
| V1 | BUG-157 | 釘選 → 儲存不回退。目標用**另一個隔離實例的 RemoteServer**（不同 userData → 不同憑證指紋），不得用使用者的 9876 / 9877。受測實例建一個 WSL 或 Docker 型 remote profile 指向該埠、指紋欄位先放舊值（另一個實例或假值）：(a) 編輯連線 → 「重新釘選指紋」→ 欄位立刻變成目標的實際指紋；(b) 按儲存 → 關掉重開對話框 / reload → 仍為新值（讀 profile 檔或 IPC 交叉確認）；(c) profile 可連線；(d) 指向關閉的埠 → 釘選出現紅字錯誤、欄位不變 |
| V2 | BUG-160 | SSH 型 profile（`targetOS` = `ssh-linux` / `ssh-darwin`）的編輯對話框：釘選按鈕停用並顯示說明（重跑設定精靈）；WSL / Docker 型照舊可按 |
| V3 | BUG-158 | zh-TW 介面不出現 BUG-158 列的英文字樣：精靈 modal 標題、Docker 模式按鈕（Create new / Use existing）、WSL 發行版選單與 WSL1 / systemd 警告（只到顯示畫面，不執行寫入步驟）、設定卡 tooltip（Open / Edit / Delete）、釘選按鈕、舊設定檔遷移 banner（`profiles.legacyTargetOsPrompt`，以沒有 `targetOS` 的 profile 觸發）。SSH 認證失敗文案（指向金鑰 / ssh-agent、不提密碼）：能在不碰真實主機的情況下觸發就驗（例如 T0515 式容器 sshd 不放金鑰），否則以畫面上的 i18n 字串比對 + NEEDS-HUMAN 說明 |
| V4 | BUG-161 | zh-TW：(a) 精靈遇到 step 錯誤時顯示中文（挑本機自然會發生、且不寫入任何發行版的錯誤，例如 Windows 主機沒有 Docker 時 Docker 精靈的錯誤；觸發不了的 code 列出並記 NEEDS-HUMAN）；(b) 縮圖列「+」選單的 `suggested` 標籤是中文；(c) 縮圖右鍵選單「設為監督者」不是 `Set as Supervisor`；(d) 各 modal 的 × 有 `aria-label`；(e) Docker 精靈選項的 description 有顯示 |
| V5 | BUG-163 | 精靈第一步（SSH / WSL / Docker 各一）：選項按鈕與輸入框不是原生白底按鈕（`getComputedStyle` 背景色 / 邊框 / 按鈕間距、class 含 `profile-action-btn` / `bat-wizard-*`），hover / focus 有樣式變化；步驟說明 zh-TW 不再出現「選擇主機、帳號、port、金鑰與安裝路徑」「BAT_AUTH_OK probe」等舊字樣。三張截圖附在回報區給使用者目視（目視不是本單 PASS 的條件） |

每項標 PASS / FAIL / NEEDS-HUMAN，附證據（截圖、DOM 文字 / class、IPC 回傳、指紋比對）。

## 驗證

- 新增 opt-in spec `e2e/v071-pre2-acceptance.spec.ts`：以 `BAT_E2E_V071PRE2=1` + `BAT_E2E_EXECUTABLE` gate，預設 skip；未設時回報 skip 數。
- 需要環境腳本時新增 `e2e/real-remote/t0663-*`；T0515 / T0520 既有腳本不改。
- 回報區附執行指令、結果（passed 數、耗時）、證據目錄。
- 收尾：隔離 userData 已刪、Terminal Server 不殘留、本單容器 / network（若有）已刪、`~/.ssh/config`（若有動）雜湊一致。

## 驗收條件

- [ ] V1–V5 各有 PASS / FAIL / NEEDS-HUMAN 與證據
- [ ] 受測 exe FileVersion 與 `app.getVersion()` = `0.7.1-pre.2`
- [ ] 未改產品程式碼；未碰使用者 BAT / WSL bat-server；未耗 Claude token
- [ ] 環境清理完成

## Sub-session 執行指示

1. 讀本工單、BUG-157 / 158 / 160 / 161 / 163、T0650 / T0652 / T0655 / T0658 / T0660 回報區、`e2e/pre7-acceptance.spec.ts` 與 `e2e/fixtures/electron-isolation.ts`
2. 填 `started_at`、`status: IN_PROGRESS`（時間用 `date "+%Y-%m-%dT%H:%M:%S%z"` 取，R-G001）
3. 實作 → 執行 → 填回報區（DONE：每項都有結論且無 FAIL；PARTIAL：有 FAIL 或沒做完）
4. `git commit --only` 本單產出；不 push；依派發 mode 通知塔台

---

## 回報區

### 完成狀態

### 產出摘要

### 互動紀錄

### 遭遇問題

### 回報時間
