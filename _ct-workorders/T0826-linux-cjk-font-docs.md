---
schema_version: 1
schema_kind: workorder
id: T0826
title: "文件：Linux / WSL 執行 AppImage 需安裝中文與 emoji 字型（否則介面中文與圖示顯示為方框）"
type: documentation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-04T08:45:47+0800"
started_at: "2026-11-04T08:47:14+0800"
updated_at: "2026-11-04T08:48:57+0800"
completed_at: "2026-11-04T08:48:57+0800"
session_ids:
  - "91aa8603-21aa-453f-b190-79650dcb0cf2"
depends_on: []
related:
  - "D270；PLAN-064（啟動時偵測缺中文字型並提示，IDEA）；T0797（`docs/agent-guide/linux-ci-acceptance.md` 已記錄 runner 缺 `fonts-noto-cjk` / `fonts-noto-color-emoji` 時截圖是方塊）；T0818（AppImage WSL 驗收）"
affects_files:
  - _ct-workorders/T0826-linux-cjk-font-docs.md
  - README.md
  - site/install.md
  - site/faq.md
  - CHANGELOG.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只改文件：不改任何程式碼、CSS、打包設定，不加字型檔進 repo（自帶字型已由 D270 否決）。"
  - "🔴 公開 repo（D176）：不寫家目錄路徑、真名；範例路徑用 `/home/tester`、`C:\\Users\\demo`。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。不發版、不 push。Git：只 commit 本單範圍。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0826 — 文件：Linux / WSL 需安裝中文與 emoji 字型

## 元資料

- **工單編號**：T0826
- **類型**：documentation
- **狀態**：DONE
- **建立時間**：2026-11-04 08:45 (UTC+8)
- **intervention_type**：fire-and-forget
- **預估規模**：小；Context Window 風險：低

## 規格層級自問

- 目標層：執行（文件段落位置與措辭由 Worker 決定）
- 決策權：Worker 可決定段落位置、措辭；不得改程式或加字型檔
- 資訊完整度：足夠（下方輸入上下文含實測與指令）
- 回頭成本：A（改幾行文件）
- 記憶覆蓋：見 frontmatter `memory_overrides`

## 任務指令

### 前置條件
- `README.md`（第 200–210 行平台表、`#### Linux` 段約第 387 行）
- `site/install.md`（Linux AppImage 段約第 23–28 行）
- `site/faq.md`（看是否有適合放「中文變方框」的常見問題位置）
- `docs/agent-guide/linux-ci-acceptance.md` 第 38 行（T0797 的同一觀察，可引用）

### 輸入上下文

使用者在 WSL（Ubuntu 24.04，WSLg）執行 BAT 的 Linux AppImage，介面上的中文（工作區、終端、Git 差異、新增工作區…）與多數圖示全變成方框；終端內的 ASCII 正常。

塔台 2026-11-04 實測該 WSL 發行版：`fc-list :lang=zh` = 0、emoji 字型 = 0、未安裝 `fonts-noto-cjk` 等套件；`LANG=C.UTF-8`。原因：Linux 版 BAT（Chromium）只用該 Linux 系統的 fontconfig 字型，不會用 Windows 的字型；WSL 與精簡安裝的發行版預設沒有中文與 emoji 字型。BAT 不自帶字型，CSS 只列字型名稱交給系統替代。不是編碼問題。

解法（Debian / Ubuntu）：

```bash
sudo apt update
sudo apt install -y fonts-noto-cjk fonts-noto-color-emoji
```

裝完完全關閉 BAT 再開；可用 `fc-list :lang=zh | wc -l` 確認 > 0。終端分頁內的中文（例如 agent 的中文回覆）也一併正常。`LANG` 不需要改。

其他發行版可附對應套件名（Fedora `google-noto-sans-cjk-fonts` / `google-noto-color-emoji-fonts`，Arch `noto-fonts-cjk` / `noto-fonts-emoji`）——Worker 若無法確認套件名就只寫 Debian / Ubuntu，並註明「其他發行版請安裝 Noto CJK 與 Noto Color Emoji 字型」。

### 預期產出

1. `README.md`：Linux 安裝處（平台表附近，或另起 Linux / WSL 小節，由 Worker 判斷最順的位置）加一段「Linux / WSL：介面中文或圖示顯示為方框」的說明與上面的指令；不要放在「麥克風權限 › Linux」那段裡（那段是語音）。
2. `site/install.md`：Linux AppImage 段落後加同樣說明（可用 VitePress `::: tip` / `::: warning`，比照該檔既有寫法）。
3. `site/faq.md`：若有合適的常見問題區，加一題「Linux / WSL 中文變成方框」，連到 install 頁對應段落；沒有合適位置就不加，回報說明。
4. `CHANGELOG.md` `[Unreleased]`：加一條文件更新（`Changed` 或該段既有的文件分類），附 T0826。
5. 檢查 README「與 BMad Control Tower 協作」章節不受影響（本單不改它）。

### 驗收條件
- [ ] README 與 site/install 都有說明＋可直接複製的安裝指令，且說清楚「Linux 版只用 Linux 系統字型、不用 Windows 字型」
- [ ] 不改任何程式碼、設定、字型檔
- [ ] 網站可建置：`site/` 有 build 指令時跑一次（例 `npm --prefix site run build` 或該目錄 package.json 的 build script），失敗要回報原因；沒裝依賴而無法跑時照實回報
- [ ] 去識別化：新增內容無家目錄路徑、真名
- [ ] commit 只含 `affects_files`

## Sub-session 執行指示

1. 讀取本工單全部內容，更新開始時間
2. 載入前置條件文件
3. 依任務指令修改文件
4. 驗證後 commit（`docs: Linux / WSL CJK and emoji font requirement (T0826)` 或類似）
5. 填寫回報區、更新狀態與完成時間

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

- **狀態**：DONE
- **session_id**：91aa8603-21aa-453f-b190-79650dcb0cf2
- **產品 commit**：`83f1d5bf`（`docs: Linux / WSL CJK and emoji font requirement (T0826)`，含 `README.md` / `site/install.md` / `site/faq.md` / `CHANGELOG.md`）
- **落點檢查**：PASS — C-0 `repo` = `better-agent-terminal`、`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 PASS（工單在 REPO_ROOT 下）；C-3 4 個檔案全部存在；C-2 工單沒有 `branch` 欄位（目前在 `main`）。`CT_HOME` 未設定（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 產出摘要

| 檔案 | 改動 |
|---|---|
| `README.md` | 「快速開始 › 方式一：直接下載」的平台表與 macOS / Windows 提示後面，加一段 ⚠️ **Linux / WSL：介面中文或圖示顯示為方框**：原因（Linux 版只用 Linux 系統 fontconfig 字型、不用 Windows 字型、BAT 不附字型、不是編碼問題、`LANG` 不用改）、可直接複製的 `apt` 指令、重開與 `fc-list :lang=zh \| wc -l` 確認方式、終端分頁中文也一併正常、其他發行版的通用說明。沒有放在「麥克風權限 › Linux」那段。 |
| `site/install.md` | Linux AppImage `chmod` 區塊後面加 `### Linux / WSL：中文與 emoji 字型 {#linux-fonts}`：`::: warning` 說明原因，接著是安裝指令、確認指令、其他發行版說明；frontmatter `description` 加上這個主題。 |
| `site/faq.md` | 「安裝與平台」區加一題 `### Linux / WSL 上介面的中文或圖示變成方框？ {#linux-cjk-font}`，給出指令並連到 `./install#linux-fonts`；frontmatter `description` 加上這個主題。 |
| `CHANGELOG.md` | `[Unreleased]` 新增 `### Changed`，加一條文件更新（T0826）。 |

驗收：
- [x] README 與 site/install 都有原因說明與可直接複製的指令，並寫明「Linux 版只用 Linux 系統字型、不用 Windows 字型」
- [x] 沒改任何程式碼、設定或字型檔（diff 只有 4 份文件與工單）
- [x] 網站建置：`npm --prefix site run build`（vitepress 1.6.4）→ `build complete in 2.75s.`；產出的 `install.html` 有 `id="linux-fonts"`，`faq.html` 有 `id="linux-cjk-font"` 與 `href="./install#linux-fonts"`（寫法與該檔既有的 `./contribute` 連結一致）。`site/.vitepress/dist` 被 git 忽略，沒有進 commit。
- [x] 去識別化：新增內容的 `+` 行掃 `/home/`、`C:\Users`、`Gower` 都沒有符合；新增內容沒有任何範例路徑。
- [x] commit 只含 `affects_files`（`83f1d5bf` 改 4 個檔，工單另外 commit）
- 預期產出 5：README「與 BMad Control Tower 協作」章節沒動（README 只有第 211 行開始的一個 hunk，在「快速開始」內）。

其他發行版的套件名稱：查證後 Arch（`noto-fonts-cjk` / `noto-fonts-emoji`）可以確認，但 Fedora 的 emoji 套件名稱在不同版本不一樣（F35 是 `google-noto-emoji-color-fonts`，工單寫的是 `google-noto-color-emoji-fonts`），沒辦法確定。依工單規定，只寫 Debian / Ubuntu 的指令，其他發行版寫「請安裝 Noto CJK 與 Noto Color Emoji 字型（套件名稱依發行版而不同）」。

### 互動紀錄

- [08:47] 開工；yolo / fire-and-forget，沒有向塔台提問。
- [08:48] 查證 Fedora / Arch 字型套件名稱（WebSearch）→ Fedora emoji 套件名稱無法確定 → 依工單規定只寫 Debian / Ubuntu 指令＋通用說明。

### Renew 歷程

（無）

### 遭遇問題

- 無阻礙。後續可考慮：如果要列出 Fedora / Arch 的指令，需要有人在各發行版實際確認套件名稱（交給 PLAN-064 或之後的文件工單）。

### 回報時間

2026-11-04T08:48:35+0800
