---
schema_version: 1
schema_kind: workorder
id: T0878
title: "mermaid 12：建置時把 elkjs 換成空殼、不打包；移除已無作用的 overrides.langium"
type: implementation
status: PENDING
created_at: "2026-11-17T11:02:17+0800"
started_at: ""
updated_at: "2026-11-17T11:02:17+0800"
completed_at: ""
session_ids: []
repo: better-agent-terminal
priority: P2
sizing: S
depends_on: [T0877]
related:
  - "D299；T0876 回報區〈bundle 大小〉〈elkjs 授權〉〈建議後續〉"
affects_files:
  - _ct-workorders/T0878-mermaid-stub-elk.md
  - vite.config.ts
  - src/lib/**（只限新增的空殼模組，或放在 vite.config.ts 旁的建置用檔案）
  - src/components/FileTreeMarkdown.tsx（只限必要時）
  - scripts/__tests__/** 或 src/**/__tests__/**（守門測試）
  - package.json（只限移除 `overrides.langium`）
  - package-lock.json（只在 npm 自動改寫時）
  - docs/agent-guide/build-toolchain.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 目標：renderer 的建置產物（`dist/`，以及 `app.asar`）不含 elkjs 的程式碼，安裝檔不散布 EPL／GPL 程式碼。做法以 vite 設定（`resolve.alias` 或小 plugin）把 mermaid 對 elkjs 的匯入換成 BAT 自己的空殼模組；不得修改 `node_modules`、不得 patch mermaid、不得用 `patch-package`。"
  - "🔴 行為：除了 ELK 之外，mermaid 預覽的行為與 T0876 最終完全相同（7 種圖的渲染結果、顏色）。圖裡寫 `layout: elk` 或 `flowchart-elk` 時，可以退回 dagre 或由 mermaid 顯示錯誤圖，但預覽不得整個壞掉、不得有未處理的例外讓其他圖不顯示。"
  - "🔴 不改 mermaid 或任何套件版本（只移除 `overrides.langium`）。"
  - "🔴 yolo：不得問使用者；問題問塔台。不 push、不發版、不觸發 workflow。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
---

# T0878 — mermaid 12：不打包 elkjs

## 元資料
- **工單編號**：T0878｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-17 11:02 (UTC+8)
- **規模**：S｜**依賴**：T0877（同一個 checkout，依序執行）｜**決策**：D299

## 背景
T0876 升 mermaid 12.3.0 後，mermaid 內建的 ELK layout 帶進 `elkjs` 0.12.1（`EPL-2.0 OR GPL-3.0-or-later`），vite 把它打成 lazy chunk `dist/assets/elk-*.js`（1,513,070 bytes）。BAT 設 `layout: 'dagre'`，執行時不會載入，但會隨安裝檔散布。使用者決定不打包（D299）。T0876 也確認 `overrides.langium` 已無作用（lock 中沒有任何套件依賴 langium）。

## 任務
1. 找出 mermaid 12.3.0 的 dist 中載入 elkjs 的確切匯入（模組 specifier 與載入方式，例如 `registerLayoutLoaders` 的動態 import），決定替換點。替換點要用套件路徑（例如 `elkjs/lib/elk.bundled.js`），不要依賴 mermaid 內部 chunk 的雜湊檔名。
2. 在 `vite.config.ts` 加替換，空殼模組的行為讓 mermaid 退回或報錯而不影響其他圖；加註解說明原因（D299、授權）。
3. 守門測試（vitest 收得到的位置）：`vite build` 後 `dist/` 不含 elkjs 的特徵字串（例如 elkjs 的授權標頭或獨有識別字），以及沒有 `elk-*.js` chunk（或 chunk 只剩空殼）。比照 `asar-runtime-deps.test.mjs` 沒有 build 時跳過的寫法。
4. 渲染驗證：沿用 T0876 的 scratch 方式，7 種圖結果與 T0876 最終（C 變體）相同；另測一張 `layout: elk` 的圖與一張 `flowchart-elk`，記錄結果（退回 dagre 或錯誤圖），確認同頁其他圖照常顯示、console 沒有未處理例外。
5. 移除 `package.json` 的 `overrides.langium`；`npm install` 後確認 lock 只有預期變化（或沒有變化）。
6. `docs/agent-guide/build-toolchain.md` 記一段：為什麼替換 elkjs、替換點、升 mermaid 時要檢查什麼（匯入 specifier 改了，守門測試會失敗）。

## 關卡
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npm run test:unit`、`npm run test:legacy`（與 T0877 後比較）
- `npx vite build`（記錄升級前後 `dist/assets` JS 總大小，應回到約 T0876 前 +0.3 MB 的水準）
- `npm run build:dir` ＋ `verify-packaged-native --platform win --arch x64`，並確認 `app.asar` 內沒有 elkjs
- `npm ci` 在最終 lock 上 exit 0；`npm audit` 與 T0876 後相同（6 項，T0875 例外）

## 驗收條件
- [ ] 替換點與空殼模組說明（含 mermaid 的 specifier 來源 檔案:行）
- [ ] 守門測試：有 build 時驗證、沒有 build 時跳過；故意拿掉替換時會失敗（附輸出）
- [ ] 7 種圖與 T0876 最終相同；`layout: elk`／`flowchart-elk` 的行為記錄
- [ ] `dist/assets` JS 大小前後、`app.asar` 不含 elkjs
- [ ] `overrides.langium` 已移除，lock 變化說明
- [ ] commit 只含本單範圍，不 push

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
