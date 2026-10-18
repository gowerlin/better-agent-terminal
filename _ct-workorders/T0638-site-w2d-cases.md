---
schema_version: 1
schema_kind: workorder
id: T0638
title: "PLAN-049 W2d：「實戰案例」頁（`/cases`）——3 個去識別化情境案例 + 「BAT 自己就是這樣開發的」3 個真實案例"
type: feature
status: TODO
repo: better-agent-terminal
project: PLAN-049
priority: P2
sizing: M
created_at: "2026-10-18T15:32:42+0800"
depends_on: [T0636]
related:
  - "D165（`/cases` 範圍與 R1 數字寫法，使用者決定）；D159（CT 不開源、不提供取得管道）；D164（視覺方向）；D166（CT 公開程度）"
  - "主要來源：`_ct-workorders/_spec-site-v2-ct-features-cases.md` § 3（C1–C3、R1–R3 已審過的文案與隱私判斷）、§ 4.1（`/cases` 版面與元件）、§ 7（上站前檢查）"
  - "主規格：`_ct-workorders/_spec-site-v2-bat-ct-story.md` § 6、§ 8；設計語言 `docs/design/site-design-language.md`"
affects_files:
  - "site/cases.md（新）"
  - "site/.vitepress/config.mts（nav / sidebar：換掉兩處 `TODO(W2d)`）"
  - "site/.vitepress/theme/**（`CaseCard` 新元件、R1 的 SVG 與樣式）"
  - "site/control-tower.md（只把 `TODO(W2d)` 註解處的四段改成連到 `/cases` 對應案例）"
  - "site/control-tower-tour.md（選做：「使用情境」節尾加一句連到 `/cases`）"
  - _ct-workorders/T0638-site-w2d-cases.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 開工第一步載入 **`frontend-design`** skill（名稱以 skill 清單為準）；清單裡沒有 → `BLOCKED` 回報。另用 `bmad-editorial-review-prose`（文案校稿）。"
  - "🔴 **內容範圍（D165，使用者決定）**：C1「合併之後，問題一層一層冒出來」、C2「兩個服務，同一個欄位」、C3「規劃到一半，正式站出事」；R1「BAT 定介面契約，CT 依契約撰寫」、R2「一句話變成塔台的原則」、R3「這個網站的設計語言，就是從 BAT 的程式碼抽出來的」。**C4（塔台被慣壞）不放本頁**。R1 **不寫**「CT 新版由 BAT 塔台實機驗收」或任何同義說法。"
  - "🔴 **R1 的數字**：寫「約 20 次」並標「截至 2026 年 10 月」。開工時重數一次本 repo 工單目錄（含 `_archive/`）中不同的 `CT-T###` 委派單編號（唯讀）；結果在 15–24 之間就照寫「約 20 次」，超出範圍 → 在工單提問（不得自行改寫數字）。「10 項功能」以 README「與 BMad Control Tower 協作」的版本對照表實際列數為準；列數不是 10 → 寫實際列數並在回報區說明。"
  - "🔴 **CT 字樣規則（D159 / D165 / D166）**：網站不得出現 CT 文件名、CT 版本號、星號 / 斜線 / 錢字號開頭的指令、skill 名稱、CT 資料路徑、取得管道、委派單編號、CT 的 repo 名稱、規則或決策編號。提案稿的「出處」欄只供內部核對，上站時整欄刪除。案例只用虛構專案 `demo-shop` 與 `T1024` 以後的虛構工單編號；不得出現任何真實客戶、學員、公司、產品或服務名稱。"
  - "🔴 不得誇大、不得與 BAT 的真實行為衝突：凡寫到 BAT 的部分，對得上 README 或 `docs/agent-guide/`；回報區附「主張 → 出處」。"
  - "🔴 **Worker 不 push、不改 GitHub 設定**；只改 `affects_files`；不新增 npm 依賴；`site/` 內 grep `T0\\d{3}`、`D1\\d{2}`、`BUG-\\d+`、`PLAN-\\d+`、`_ct-workorders`、`CLAUDE.md` = 0（include 原文除外）；不放權杖、使用者路徑、帳號。"
  - "🔴 **預覽伺服器**（L164）：不要用背景 shell 跑 `vitepress preview` 再靠結束 shell 收尾（Windows 上 node / esbuild 子程序會殘留並鎖住 `site/node_modules`）。改用 `e2e-results/site-preview/serve.mjs` 服務 `dist` 的複本，用完以埠查 PID 結束；回報寫明已無殘留程序。"
  - "🔴 非隔離工單。另一張工單 T0637（codex 探針）可能同時進行，它只改自己的工單檔，不碰。`src/styles/settings.css` 的 M 不是你的變更，不碰。commit 用 `git commit --only <檔案>`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write / Edit（L129）。"
---

# T0638 — 「實戰案例」頁（`/cases`）

## 目標

PLAN-049 網站 v2 的 W2d。首頁講「一個早上」，`/control-tower` 講分工與流程，`/control-tower-tour` 講 CT 本身；本頁用 6 個案例讓讀者看到「其他早上」：現實比計劃更混亂時，塔台與 Worker 怎麼接住。

## 頁面結構（依提案稿 § 4.1，可依內容調整並在回報說明）

1. **導語**：一兩句說明本頁是什麼（情境案例為虛構的 `demo-shop`；後半是 BAT 自己的開發紀錄）
2. **情境案例** C1–C3：每個案例用 `CaseCard`（案例標題、情境標籤、出處面向：CT / BAT / 搭配）包住，內容沿用 `StoryChapter` 的兩欄（左「以前」、右「BAT + CT」）＋分工標籤；文案以提案稿 § 3.1 為底，可微調語氣但不改事實
3. **BAT 自己就是這樣開發的** R1–R3：R1 加一張 SVG 小圖（BAT 定契約 → 委派 → CT 照契約 → 版本對照表），沿用 A 的雷達線條語彙但維持淺色；R3 刻意比其他案例短
4. 頁尾連回 `/control-tower`、`/control-tower-tour`

## 其他要做的事

- `config.mts`：nav 在「BAT × Control Tower」之後加「實戰案例」→ `/cases`；sidebar 換掉 `TODO(W2d)`；兩處 `TODO(W2d)` 註解都移除
- `site/control-tower.md`：`TODO(W2d)` 那四段（現實比計劃更混亂時）各連到 `/cases` 的對應案例（錨點），移除該註解；沒有對應案例的段落不連，回報說明
- （選做）`site/control-tower-tour.md`「使用情境」節尾加一句連到 `/cases`；導覽頁的情境與本頁不得重複
- 視覺沿用 D164（A 的字體與色彩語意：紫 = 塔台、藍 = 你、中性 = Worker）與既有元件；新元件只有 `CaseCard`（必要時再加）

## 驗證

- `bmad-editorial-review-prose` 審 `/cases`；採納 / 不採納列在回報區
- `site/` 內 `npm ci` + `npm run build`：0 錯誤、0 死連結；console 0；手機無整頁水平捲動；reduced-motion 下無動畫
- **CT 字樣 grep = 0**（網站自己的路由 `/control-tower`、`/control-tower-tour` 除外）＋既有的內部編號 grep；案例內不得出現真實名稱
- 截圖存 `e2e-results/site-w2d/`（不入版控）：`/cases` 桌面 1440 / 手機 390 × 淺 / 深色（每個 h2 至少一張）；`/control-tower` 的新連結各一張
- 預覽伺服器用完已結束（L164）

## 驗收

- `/cases` 6 個案例完成，nav / sidebar / `/control-tower` 都連得到
- 範圍符合 D165（無 C4、R1 無「代跑驗收」）；CT 字樣 grep = 0；案例全部去識別化
- build 0 錯誤、0 死連結；console 0；手機無水平捲動
- 回報區附：截圖清單、「主張 → 出處」、R1 委派單重數結果、文案校稿採納清單、給使用者的預覽指令
- 未 push、未改 GitHub 設定；本機沒有殘留的預覽伺服器

---

## 回報區

（Worker 填寫）
