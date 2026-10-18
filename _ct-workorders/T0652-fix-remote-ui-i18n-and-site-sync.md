---
schema_version: 1
schema_kind: workorder
id: T0652
title: "BUG-158：遠端設定畫面的英文字樣改走 i18n、補齊缺的 key、修正 SSH 認證失敗的「帳號密碼」文案；同步網站 `/remote/` 引用的 UI 字樣與指紋段落"
type: bugfix
status: TODO
repo: better-agent-terminal
project: BUG-158
priority: P3
sizing: M
created_at: "2026-10-18T18:44:16+0800"
depends_on: [T0649, T0650]
related:
  - "BUG-158（T0646 回報區「給塔台的後續建議」第 6、7 點）；T0650 回報區「偏差」「給塔台：網站 `/remote/` 指紋段落」「後續建議」（需處理的字串、指紋段落建議）；T0649 回報區（若列出需要的新 key）"
  - "網站規則：`_ct-workorders/_spec-site-v2-bat-ct-story.md` § 8（文案與內容規則）；CT 字樣規則 D159 / D165 / D166；預覽伺服器 L164"
affects_files:
  - "src/locales/en.json、src/locales/zh-TW.json、src/locales/zh-CN.json"
  - "src/components/setup-wizard/**（精靈 modal 標題、WSL 發行版選單、WSL1 / systemd 警告、Docker 模式按鈕、error-mapper 文案）"
  - "src/components/profiles/**、src/components/ProfilePanel.tsx（設定卡 tooltip、`Pin expected fingerprint`、`Pinned fingerprint (read-only)`、相關 `title`、`profiles.legacyTargetOsPrompt` banner）"
  - "src/locales/__tests__/**、src/**/__tests__/**（i18n key 一致性測試、受字串影響的既有測試）"
  - "site/remote/index.md、site/remote/wsl.md、site/remote/ssh.md、site/remote/docker.md（只改引用到的 UI 字樣與指紋段落）"
  - _ct-workorders/T0652-fix-remote-ui-i18n-and-site-sync.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 範圍是**遠端設定相關畫面**（WSL / SSH / Docker 精靈、配置面板 / 設定卡 / 編輯連線對話框、遷移 banner）的使用者可見字串，不擴及其他功能的英文字樣（另列清單給塔台）。開工先 grep 這些元件的硬寫字串，列出最終清單（原文 → key → zh-TW / zh-CN / en）寫進回報區；BUG-158 的清單是起點，以實際程式碼為準。"
  - "🔴 不改行為、不改字串以外的邏輯；`data-testid`、程式內部比對用的字串、log 訊息、送進 PTY / 遠端的命令字串一律不動。改字串後若有 e2e / unit test 以文字定位元素，同步更新（改用 role / testid 更好，但不擴大範圍）。"
  - "🔴 SSH 認證失敗文案：BAT 的 SSH 一律 `BatchMode=yes`（`electron/remote/ssh-args.ts` `buildBaseSshArgs`），只能用金鑰 / ssh-agent；文案改成指向金鑰、ssh-agent、`~/.ssh/config`，不得提密碼。三個語系一致。"
  - "🔴 中文用語：繁中介面一律台灣用語（設定、連線、伺服器、憑證、指紋、發行版、容器），簡中照既有 zh-CN 用語；與網站 `/remote/` 的稱呼一致。en 保留原意。"
  - "🔴 **網站同步**（`site/remote/*.md`）：① 網站引用到的 UI 字樣改成修正後的中文字樣（例如 Docker 模式按鈕、「Pin expected fingerprint」、精靈標題）；② 指紋段落（`site/remote/index.md` `#fingerprint`）依 T0650 回報區建議：保留「重跑精靈」為主，加「在編輯連線裡重新釘選」作為另一個做法，並寫明兩點——釘選以**已儲存**的連線資料連線、會接受當下回應的伺服器並送出權杖，只適合確定是自己剛重裝的伺服器；要同時改位址 / 權杖時先儲存再釘選；伺服器資料被刪、權杖也換掉時仍要重跑精靈。③ 若 T0649（BUG-156）已修正 Docker 埠衝突，依 T0649 回報區的「網站 `/remote/docker` 埠衝突段落怎麼改」一併更新（T0649 未修正或回報 FAILED 則不動）。CT 字樣 / 內部編號 / 隱私 grep = 0；`npm run build` 0 錯誤 0 死連結。"
  - "🔴 **Worker 不 push、不改 GitHub 設定**；網站預覽用 `e2e-results/site-preview/serve.mjs` 服務 dist 複本，用完以埠查 PID 結束（L164）。"
  - "🔴 非隔離工單。T0651（codex `--no-daemon`，改 `electron/agent-runtime/**`、`electron/bat-mcp-launch.ts` 等）可能同時進行，不碰它們的檔。`src/styles/settings.css` 的 M 不是你的變更，不碰。commit 用 `git commit --only <檔案>`；產品與網站可分兩個 commit。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。"
---

# T0652 — 遠端畫面 i18n 與網站同步

## 背景

T0646 改寫網站 `/remote/` 時發現遠端設定相關畫面殘留不少英文字樣、zh-TW 缺 `profiles.legacyTargetOsPrompt`，而且 SSH 認證失敗的中文文案提到「帳號密碼」，但 BAT 無法用密碼登入（BUG-158）。T0650 修 BUG-157 時刻意沒動字串，留下的清單：`Pin expected fingerprint`、`Pinned fingerprint (read-only)`、兩個按鈕 / 欄位 `title`。網站 `/remote/` 目前引用這些英文原字樣，指紋段落只建議重跑精靈。

## 要做的事

1. 盤點遠端設定相關元件的硬寫英文字串與缺的 key，列最終清單。
2. 改走 i18n：三個語系補齊；修正 SSH 認證失敗文案。
3. 測試：既有 i18n key 一致性測試通過（三語系 key 相同）；受影響的測試同步更新；若沒有 key 一致性測試，回報說明，不新增大型測試框架。
4. 網站同步（見 memory_overrides）。
5. 截圖（不入版控）：`e2e-results/t0652/`——可行時以隔離實例拍精靈 / 編輯連線對話框的 zh-TW 畫面；網站 `/remote/` 修改處桌面 1440 淺 / 深色各一張。

## 驗證

- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npm run test:unit` 全綠（回報 passed / files 數）
- `npx vite build` 成功
- `site/` 內 `npm run build`：0 錯誤、0 死連結；CT 字樣 / 內部編號 / 隱私 grep = 0

## 驗收

- zh-TW 介面的遠端設定畫面不再出現 BUG-158 清單上的英文；SSH 認證失敗文案不提密碼
- 網站 `/remote/` 的 UI 字樣與產品一致；指紋段落含「重新釘選」做法與兩點說明
- 驗證全過；回報區附字串清單、範圍外英文字樣清單（給塔台）、截圖清單、給使用者的網站預覽指令、commit
- 只改 `affects_files`；未 push
