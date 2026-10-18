---
schema_version: 1
schema_kind: workorder
id: T0636
title: "PLAN-049 W2b-3：「Control Tower 功能導覽」頁（`/control-tower-tour`）——CT 不開源，以「概念加細節」介紹 CT 本身"
type: feature
status: PENDING
repo: better-agent-terminal
project: PLAN-049
priority: P2
sizing: L
created_at: "2026-10-18T14:40:30+0800"
depends_on: [T0635]
related:
  - "D166（本單的公開程度與放置，使用者決定）；D159（CT 不開源、不提供取得管道）；D165（CT 字樣規則）"
  - "主要來源（唯讀）：`D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\BMad-Control-Tower\\BMad-Control-Tower-v5.8.0\\docs\\BMad Control Tower 安裝(升級)與使用指南 v5.md`"
  - "輔助來源：`_ct-workorders/_spec-site-v2-ct-features-cases.md`（T0633 提案，F1–F16 已審過的寫法與公開判斷）；`site/control-tower.md`（T0634，已上線的 BAT × CT 協作頁，避免重複）"
  - "主規格：`_ct-workorders/_spec-site-v2-bat-ct-story.md` § 6、§ 7、§ 8；視覺 D164 與 `docs/design/site-design-language.md`"
affects_files:
  - "site/control-tower-tour.md（新）"
  - "site/control-tower.md（只加連到導覽頁的連結與一句說明）"
  - "site/.vitepress/config.mts（nav / sidebar）"
  - "site/.vitepress/theme/**（必要的新元件與樣式）"
  - _ct-workorders/T0636-site-w2b3-control-tower-tour.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 開工第一步載入 **`frontend-design`** skill（名稱以 skill 清單為準）；清單裡沒有 → `BLOCKED` 回報。另用 `vitepress-book`（只當參考）與 `bmad-editorial-review-prose`（文案校稿）。"
  - "🔴 **公開程度（D166，使用者決定）＝「概念加細節」**。可以寫：CT 是什麼、四級能力、基本操作流程、工單生命週期與狀態、自主模式（沿用首頁與 `/control-tower` 已用的 `off` / `ask` / `on` / `yolo` 與說法，不另取名）與斷點、自我學習、多塔台協調、Debug 三層防線、去識別化的使用情境、常見問題。**不得寫**：命令名稱（任何星號、斜線、錢字號開頭的指令）、skill 名稱、CT 版本號（含「v4.x」「v5.x」等版本演進）、取得管道或「如何取得 / 聯絡我們」、安裝 / 升級步驟、skill 檔原文、完整參數 / 設定表（可以寫「有哪些設定可以調」的概念，不列鍵名與值域）、檔案格式範本與檔名（例如塔台狀態檔、設定檔、工單資料夾的實際名稱）、內部 repo 位置與路徑。引用原文一律改寫，單段直接引用 ≤ 1 句。"
  - "🔴 **隱私**：指南 § 7「使用情境案例」與 § 9「多塔台協調」可能含真實專案或客戶名稱 → 一律改寫成虛構專案（`demo-shop` 等）；任何可能指回真實對象的內容不用，並在回報區列出。"
  - "🔴 **唯讀來源**：BMad-Guide repo 只讀不改。指南 § 3、§ 4（升級與安裝）不使用；§ 2（各版新功能）只用來理解功能，不寫版本號、不做版本時間軸；§ 12–§ 14（速查表）不轉貼。"
  - "🔴 不得誇大、不得與 BAT 的真實行為衝突：凡寫到 BAT 的部分，對得上 README 或 `docs/agent-guide/`；CT 的部分附指南章節出處（只在回報區，不上站）。回報區附「主張 → 出處」。"
  - "🔴 **Worker 不 push、不改 GitHub 設定**；只改 `affects_files`；不新增 npm 依賴；`site/` 內 grep `T0\\d{3}`、`D1\\d{2}`、`BUG-\\d+`、`PLAN-\\d+`、`_ct-workorders`、`CLAUDE.md` = 0（include 原文除外）；不放權杖、使用者路徑、帳號。預覽伺服器用完就結束（含 esbuild 子程序），回報寫明。"
  - "🔴 非隔離工單。`src/styles/settings.css` 的 M 不是你的變更，不碰；其他 Worker 的工單檔不碰。commit 用 `git commit --only <檔案>`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write / Edit（L129）。"
---

# T0636 — 「Control Tower 功能導覽」頁

## 目標

使用者決定：CT 不開源，但網站可以「稍微詳細」介紹 CT 本身（D166）。`/control-tower` 講的是 BAT 與 CT **怎麼一起用**；本單新開 `/control-tower-tour`，講 **CT 本身能做什麼、怎麼運作**，讓讀者看懂這套流程的完整樣貌——但不提供取得管道、不寫命令與版本。

## 來源與讀法

- 主要：CT 使用指南 v5 的 § 1、§ 5–§ 11（全文讀）；§ 2 只用來理解每個功能在做什麼（不寫版本）；§ 3、§ 4 不用；§ 12–§ 14 只當理解用的索引，不轉貼。
- 已審過的寫法：T0633 提案稿 § 2（F1–F16）可直接沿用或延伸，避免和已上線內容說法不一致。
- 不重複：`/control-tower` 已有的內容（機場比喻、一張工單的一生、權限模型、整合點等）在導覽頁只用一句帶過並連回去。

## 頁面結構（建議，可依內容調整並在回報說明）

1. **Control Tower 是什麼**：以檔案為核心的多 Agent 開發流程；為什麼用「塔台」管理、Worker 執行（對應指南 § 1）
2. **四級能力**：每一級能做什麼、適合什麼情境（§ 5；可做成階梯或卡片）
3. **一天的基本流程**：從啟動塔台、對齊需求、開單、派工、收單到收工交接（§ 6；不寫命令名稱，用「你說… → 塔台會…」的寫法）
4. **工單的狀態與驗收**：狀態流轉與每個狀態的意義、證據式驗收、Renew（§ 6 與相關段落；狀態名稱可以寫）
5. **自主程度與斷點**：四種模式與一定會停下來的情況（與 `/control-tower`、首頁的說法一致）
6. **自我學習**：觀察 → 已驗證 → 標準流程 → 技能、教戰手冊、視覺規範（§ 8；沿用 `GrowthLadder`）
7. **多塔台協調**：多個專案或子專案時，塔台之間怎麼分工與交接（§ 9；去識別化）
8. **Debug 三層防線**（§ 10）
9. **使用情境**：從 § 7 挑 3–4 個，寫成去識別化的小情境（每個 80–150 字）；與 W2d `/cases` 的案例不重複（`/cases` 尚未建立，不連結）
10. **常見問題**（§ 11 改寫；保留「Control Tower 去哪取得？目前未公開提供」，與 `/faq`、`/control-tower` 一致）

## 其他要做的事

- `/control-tower` 開頭或「Control Tower 是什麼」節加一句與連結：「想看 Control Tower 本身的完整介紹，見功能導覽」
- `config.mts`：nav 的「BAT × Control Tower」可改成下拉（協作 / 功能導覽），或在 sidebar 同一群組加入導覽頁；擇一並說明
- 視覺沿用 D164（A 的字體與色彩語意：紫 = 塔台、藍 = 你、中性 = Worker）與既有元件；新元件只在必要時新增

## 驗證

- `bmad-editorial-review-prose` 審導覽頁；採納 / 不採納列在回報區
- `site/` 內 `npm ci` + `npm run build`：0 錯誤、0 死連結；console 0；手機無整頁水平捲動；reduced-motion 下無動畫
- **CT 字樣 grep = 0**（網站自己的路由 `/control-tower`、`/control-tower-tour` 除外，同 T0634 的判讀）：星號 / 斜線 / 錢字號開頭的指令、skill 名稱（含 `ct-` 開頭的名稱）、`v[3-5]\.[0-9]` 版本號、CT 檔名與路徑、「取得」「下載 CT」「聯絡」等取得管道字樣（FAQ 的「目前未公開提供」除外）；加上既有的內部編號 grep
- 截圖存 `e2e-results/site-v2b3/`（不入版控）：導覽頁桌面 1440 / 手機 390 × 淺 / 深色（每個 h2 至少一張）
- 預覽伺服器用完已結束

## 驗收

- 導覽頁 10 節（或回報說明的調整版）完成，`/control-tower` 與 nav / sidebar 都連得到
- 公開程度符合 D166；CT 字樣 grep = 0；使用情境全部去識別化
- build 0 錯誤、0 死連結；console 0；手機無水平捲動
- 回報區附：截圖清單、「主張 → 出處」（含指南章節）、文案校稿採納清單、去識別化與不使用內容清單、給使用者的預覽指令
- 未 push、未改 GitHub 設定；本機沒有殘留的預覽伺服器

---

## 回報區

（Worker 填寫）
