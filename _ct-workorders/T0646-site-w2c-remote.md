---
schema_version: 1
schema_kind: workorder
id: T0646
title: "PLAN-049 W2c：「遠端開發」頁（`/remote/`）——overview、WSL、SSH、Docker 四頁，改寫成繁中使用者語氣"
type: feature
status: TODO
repo: better-agent-terminal
project: PLAN-049
priority: P2
sizing: M
created_at: "2026-10-18T18:13:30+0800"
depends_on: [T0635]
related:
  - "D159（CT 不開源、不提供取得管道）；D160（`docs/` 只取遠端部署指南改寫、不上站原文）；D164（視覺方向）；D165 / D166（CT 字樣規則）"
  - "主規格：`_ct-workorders/_spec-site-v2-bat-ct-story.md` § 6（`/remote/` 另開單）、§ 7（視覺）、§ 8（文案與內容規則）；設計語言 `docs/design/site-design-language.md`"
  - "T0622 回報區 Q3-1（`docs/remote-dev-overview.md` 改寫上「遠端開發」頁、內部編號需清除）、Q3-2 頁面表（`/remote/`：overview、wsl、ssh、docker）"
  - "前例：T0635（`/features`、`/faq` 的 `TODO(W2c)`）、T0638（`/cases`，回報區格式）"
affects_files:
  - "site/remote/index.md（新，overview）"
  - "site/remote/wsl.md（新）"
  - "site/remote/ssh.md（新）"
  - "site/remote/docker.md（新）"
  - "site/.vitepress/config.mts（nav / sidebar：換掉兩處 `TODO(W2c)`）"
  - "site/.vitepress/theme/**（只在既有元件不夠用時新增元件 / 樣式，例如本機 ↔ 遠端架構示意 SVG）"
  - "site/features.md（只把 `TODO(W2c)` 註解處改成連到 `/remote/` 各頁）"
  - "site/faq.md（選做：「遠端開發」節加連到 `/remote/` 的連結，不改既有答案的事實）"
  - _ct-workorders/T0646-site-w2c-remote.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 開工第一步載入 **`frontend-design`** skill（名稱以 skill 清單為準）；清單裡沒有 → `BLOCKED` 回報。另用 `bmad-editorial-review-prose`（文案校稿）。"
  - "🔴 **來源與事實**：底稿是 `docs/remote-dev-overview.md`、`docs/wsl-deployment.md`、`docs/ssh-deployment.md`、`docs/docker-deployment.md`（英文、2026-10-16 最後更新，含內部編號約 50 處）。這四份**可能落後於目前行為**：每個寫上站的步驟與限制都要對照目前的程式碼或 `docs/agent-guide/`（至少 `remote-security.md`、`multi-remote-profiles.md`、`remote-tower-notify.md`、`packaging-release-checks.md` 的 server bundle 節與 `docs/server-bundle-distribution.md`）。底稿與程式碼衝突時以程式碼為準，並把衝突列進回報區「底稿落後清單」（檔案 + 段落 + 實際行為 + 出處）。**不改 `docs/*.md` 本身**（不在 `affects_files`）。"
  - "🔴 已知必須反映的現況（底稿可能沒寫或寫錯）：安裝檔不內建伺服器套件，第一次設定時從 GitHub `server-bundle-v<版號>` 下載並快取，下載失敗可匯入本機 tarball；同時最多 8 個遠端連線；macOS 只有 Apple Silicon；遠端塔台 / Worker 每個分頁拿自己的範圍權杖（與 `/control-tower` 的『支援的 Agent 與遠端』一致）。逐項以程式碼確認後再寫，確認不了就不寫。"
  - "🔴 **CT 字樣規則（D159 / D165 / D166）**：網站不得出現 CT 文件名、CT 版本號、星號 / 斜線 / 錢字號開頭的指令、skill 名稱、CT 資料路徑、取得管道、委派單編號、規則或決策編號。遠端頁提到 Control Tower 時只寫「遠端那一側也要能執行 Control Tower」這類概念（沿用 `/control-tower` 既有寫法），不寫安裝方式。"
  - "🔴 **隱私**：範例主機名、使用者名稱、IP、路徑、distro / container 名一律用明顯虛構的值（例如 `dev-server`、`you@dev-server`、`192.0.2.10`（RFC 5737 文件用位址）、`demo-shop`）；不得出現真實帳號、真實主機、本機使用者路徑、權杖、憑證指紋實值、上游作者路徑。"
  - "🔴 不得誇大、不得與 BAT 的真實行為衝突：回報區附「主張 → 出處」（出處 = 程式碼檔:函式 / `docs/agent-guide/` 檔名 / README 段落）。不寫未實機驗證的平台承諾（例如 macOS 主機的 SSH 目標若無實測就照底稿的限制寫，不加碼）。"
  - "🔴 **Worker 不 push、不改 GitHub 設定**；只改 `affects_files`；不新增 npm 依賴；`site/` 內 grep `T0\\d{3}`、`D1\\d{2}`、`BUG-\\d+`、`PLAN-\\d+`、`_ct-workorders`、`CLAUDE.md` = 0（include 原文除外）。"
  - "🔴 **預覽伺服器**（L164）：不要用背景 shell 跑 `vitepress preview` 再靠結束 shell 收尾。改用 `e2e-results/site-preview/serve.mjs` 服務 `dist` 的複本，用完以埠查 PID 結束；回報寫明已無殘留程序。"
  - "🔴 非隔離工單。另一張工單 T0647（PLAN-051 研究，唯讀）可能同時進行，它只改自己的工單檔，不碰。`src/styles/settings.css` 的 M 不是你的變更，不碰。commit 用 `git commit --only <檔案>`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write / Edit（L129）。"
---

# T0646 — 「遠端開發」頁（`/remote/`）

## 目標

PLAN-049 網站 v2 的 W2c。`/features` 已有一節「遠端開發：WSL、SSH、Docker」的摘要，但讀者想真的接上遠端時沒有地方看步驟。本單把 `docs/` 的四份英文部署指南改寫成四頁繁中、使用者語氣的設定指南：先幫讀者選對環境，再一步步帶過設定精靈，最後列常見狀況。

## 頁面結構（可依內容調整並在回報說明）

1. **`/remote/`（overview）**
   - 一句話說明模式：BAT 留在你的電腦，Agent 在遠端環境執行；遠端裝的是同一份 BAT 伺服器套件，連線加密並以憑證指紋確認對象
   - 本機 ↔ 遠端的示意圖（SVG，沿用 D164 的線條語彙，跟著深淺色切換，有文字等價說明）
   - 「該選哪一種」對照（WSL / SSH / Docker：適合情境、需要什麼、限制），窄螢幕改卡片（沿用 `CardTable` 等既有元件）
   - 共通概念：設定精靈做了哪些事、伺服器套件從哪來（下載 / 快取 / 匯入本機檔案）、同時多個遠端、升級與移除、在遠端用塔台與 Worker（連到 `/control-tower#agents`）
2. **`/remote/wsl`、`/remote/ssh`、`/remote/docker`**：各自的前置條件 → 設定精靈步驟 → 連線後能做什麼 → 升級 / 移除 → 常見狀況（底稿的 troubleshooting 改寫，只留使用者會遇到的）
3. 頁尾連到 `/faq#remote`、`/contribute`（遠端問題回報要附什麼）

## 其他要做的事

- `config.mts`：nav 與 sidebar 換掉兩處 `TODO(W2c)`（nav 放「遠端開發」→ `/remote/`，位置照註解；sidebar 加四頁一組），註解移除
- `site/features.md`：`TODO(W2c)` 註解處改成連到 `/remote/` 各頁，移除註解
- （選做）`site/faq.md`「遠端開發」節加一句連到 `/remote/`
- 插圖位置可留 `<!-- TODO(W3): 截圖 -->`（W3 補設定精靈截圖），比照 `/features`

## 驗證

- `bmad-editorial-review-prose` 審四頁；採納 / 不採納列在回報區
- `site/` 內 `npm ci` + `npm run build`：0 錯誤、0 死連結；console 0；手機無整頁水平捲動；reduced-motion 下無動畫
- CT 字樣 grep = 0（網站自己的路由 `/control-tower`、`/control-tower-tour` 除外）＋既有內部編號 grep = 0；隱私 grep（本機使用者名、`tonyqwang`、`gowerlin` 以外的帳號、真實 IP）= 0
- 截圖存 `e2e-results/site-w2c/`（不入版控）：四頁桌面 1440 / 手機 390 × 淺 / 深色（每頁至少一張；overview 每個 h2 一張）
- 預覽伺服器用完已結束（L164）

## 驗收

- `/remote/` 四頁完成，nav / sidebar / `/features` 都連得到；`TODO(W2c)` 全數清除
- 內容對得上目前程式碼；回報區附「主張 → 出處」與「底稿落後清單」
- build 0 錯誤、0 死連結；console 0；手機無水平捲動；CT 字樣 / 內部編號 / 隱私 grep = 0
- 回報區附：截圖清單、文案校稿採納清單、給使用者的預覽指令
- 未 push、未改 GitHub 設定；本機沒有殘留的預覽伺服器

---

## 回報區

（Worker 填寫）
