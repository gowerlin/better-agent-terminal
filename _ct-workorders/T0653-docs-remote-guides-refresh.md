---
schema_version: 1
schema_kind: workorder
id: T0653
title: "`docs/` 遠端部署指南更新：依 T0646「底稿落後清單」與 BUG-156 / 157 / 159 修正後的行為，改寫 remote-dev-overview / wsl / ssh / docker 四份英文指南與 server-bundle-distribution"
type: docs
status: TODO
repo: better-agent-terminal
project: PLAN-049
priority: P3
sizing: M
created_at: "2026-10-18T18:52:03+0800"
depends_on: [T0646, T0649, T0650, T0651]
related:
  - "T0646 回報區「底稿落後清單」（四份指南逐段的底稿 vs 實際 vs 出處）與「主張 → 出處」表；網站 `site/remote/*.md`（繁中、已依程式碼改寫，可當事實對照，但本單是英文開發者 / 進階使用者文件，不是翻譯網站）"
  - "BUG-156（T0649 `99abe9a1`：Docker 挑埠 9877–9976、Use existing 沿用公開埠）；BUG-157（T0650 `5594ec57`：釘選後儲存保留新指紋、釘選失敗顯示錯誤；TOFU 說明）；BUG-159（T0651 `5b1be0f5`：codex `--no-daemon`）；BUG-158（T0652 進行中：UI 字樣改中文 / i18n）"
affects_files:
  - docs/remote-dev-overview.md
  - docs/wsl-deployment.md
  - docs/ssh-deployment.md
  - docs/docker-deployment.md
  - "docs/server-bundle-distribution.md（只修 T0646 指出的不存在按鈕等落後處）"
  - _ct-workorders/T0653-docs-remote-guides-refresh.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只改文件，不改任何程式碼、測試、`site/**`、`CLAUDE.md`、`docs/agent-guide/**`。文件維持英文。"
  - "🔴 事實以**目前 main 的程式碼**為準（含 `99abe9a1` / `5594ec57` / `5b1be0f5`）：T0646 的落後清單是起點，每一項改寫前再對一次程式碼；清單沒列但你發現的落後也一併修，列在回報區。不寫未實作或未驗證的承諾；未實機的行為（例如 Docker Create new 的實際錯誤訊息、非系統管理員的 codex daemon）照實標註。"
  - "🔴 UI 標籤：BUG-158（T0652）正在把遠端畫面的英文字樣改走 i18n。文件引用 UI 時寫 en 語系的字樣（以 `src/locales/en.json` 為準；T0652 尚未 commit 的新 key 不要引用，改用描述性寫法，例如「the pin button in the Edit connection dialog」），避免與 T0652 衝突。"
  - "🔴 內部編號：這幾份是 repo 內的開發文件，可以保留必要的 T / BUG / PLAN 參照，但刪掉只對內部歷史有意義、對讀者無用的引用（例如過時的分支名 `feature/plan-007-remote-dev`）。不放權杖、真實主機、使用者路徑；範例用 `dev-server`、`192.0.2.10` 這類明顯虛構值。"
  - "🔴 非隔離工單。T0652（改 `src/locales/**`、`src/components/**`、`site/remote/**`）同時進行，不碰它的檔。`src/styles/settings.css` 的 M 不是你的變更，不碰。commit 用 `git commit --only <檔案>`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。不 push。"
---

# T0653 — `docs/` 遠端部署指南更新

## 背景

T0646 把 `docs/` 的四份遠端指南改寫成網站 `/remote/` 時，發現四份都大幅落後於程式碼（例如 SSH 只剩 tunnel 模式、不能用密碼；WSL 沒有 systemd 無法完成；Docker 需要自己建置映像；精靈步驟 id 與 rollback 行為已變），列成「底稿落後清單」但依規定沒有改 `docs/`。之後 T0649 / T0650 / T0651 又改了 Docker 埠、指紋釘選、codex daemon 的行為。本單把這些文件更新到目前的實況。

## 要做的事

1. 依 T0646 落後清單逐項修正四份指南與 `server-bundle-distribution.md`，每項對一次程式碼。
2. 反映修正後的行為：Docker 挑埠（不再需要先改 BAT 的伺服器埠）、Use existing 沿用容器公開的埠；編輯連線裡的指紋釘選（TOFU、用已儲存的連線資料、儲存不再回退）；遠端 codex 分頁的 `--no-daemon` 條件（簡述，連到 `docs/agent-guide/bat-mcp-shim.md`）。
3. 補上底稿缺的：WSL keepalive、伺服器套件匯入本機 tarball、`BAT_SERVER_BUNDLE_BASE_URL`、升級時的 `.bat-new` / `.bat-old` / `.bat-prev`、各平台移除步驟的完整清單、同時最多 8 個遠端連線。
4. `remote-dev-overview.md` 的「Remote Tower」權限描述改成與 `HELPER_CHANNEL_ROLES` 一致（或改為連到 `docs/agent-guide/remote-tower-notify.md`，不在這裡複述整張表）。

## 驗證

- 每份文件內的相對連結都存在（`grep` 連結目標逐一確認）
- 回報區附：修正清單（文件 / 段落 / 改了什麼 / 程式碼出處）、新發現的落後項、仍未驗證的敘述清單

## 驗收

- 五份文件與目前 main 的行為一致；T0646 落後清單每一項都已處理或說明不處理的理由
- 只改 `affects_files`；未 push
