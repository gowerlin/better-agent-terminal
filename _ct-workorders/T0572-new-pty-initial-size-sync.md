---
schema_version: 1
schema_kind: workorder
id: T0572
title: "BUG-145：新分頁 PTY 有時停在建立時的尺寸，xterm 已 fit 成別的欄數；找出競態並讓第一次 fit 後的尺寸一定送達 PTY"
type: bugfix
status: TODO
repo: better-agent-terminal
project: BUG-145
priority: P2
sizing: S
created_at: "2026-10-16T22:12:44+0800"
updated_at: "2026-10-16T22:12:44+0800"
target_version: "0.6.1-pre.8（與 BUG-144 / T0571 同批）"
depends_on: []
related:
  - "BUG-145；T0571 回報區「e2e 附註」（隔離實例 PTY 停在 120x30、xterm 137 欄，spec 以 `terminal-redraw` 繞過）"
affects_files:
  - src/components/TerminalPanel.tsx
  - "src/**（尺寸同步相關的實際檔案，回報區列出）"
  - "electron/pty-manager.ts、electron/terminal-server/**、electron/handlers/pty.ts（若根因在 main / Terminal Server；回報區列出）"
  - "src/**/__tests__/**、electron/__tests__/** 新增或擴充的測試"
  - "e2e/t0572-*.spec.ts（若可行）"
  - "CLAUDE.md（若需記錄，簡短）"
  - _ct-workorders/T0572-new-pty-initial-size-sync.md
  - _ct-workorders/BUG-145-new-pty-stays-at-spawn-size.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`（`src/styles/settings.css` 的 M 不是你的變更）。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）與它的 Terminal Server；e2e 只用隔離實例（需先 `npx vite build`）。"
  - "🔴 不改 `e2e/t0571-shift-right-click-copy.spec.ts` 既有的 redraw 繞法（修好後可在回報區建議移除，由塔台決定）。"
---

# T0572 — BUG-145：新分頁 PTY 初始尺寸同步

## 背景

T0571 的 e2e 觀察到：隔離實例新建分頁後，PTY 有時停在 spawn 尺寸 120x30，而 xterm 已 fit 成 137 欄；按工具列重繪（`terminal-redraw`）重送尺寸後才一致。若真實使用者也會遇到，claude / codex 等 TUI 會用錯的欄數排版（折行錯位、狀態列跑位），只能手動重繪。

## 任務

1. **重現並找根因**（隔離實例；node 腳本在 PTY 內印出 `process.stdout.columns` / `rows` 並監聽 SIGWINCH 寫檔，不耗額度）：
   - 直接建立分頁、重複多次，統計 PTY 尺寸與 xterm `cols` / `rows` 不一致的比例；分別看 Terminal Server 模式（預設）與 direct 模式
   - 追 renderer 第一次 fit → `pty:resize` 的路徑：resize 是否在 `pty:create` 完成前送出而被丟掉、是否因尺寸「沒變」而被去重略過、Terminal Server 是否在 PTY 註冊前收到 resize 等
   - 涵蓋：一般新分頁、BAT 重開還原的分頁、⏻ 重啟、外部建立（`terminal:created-externally`，例 Worker 分頁）；做得到幾種就測幾種，回報區列出
   - 若確認只在 e2e / 隔離實例才會發生（真實路徑不會），照實回報證據，不必硬修
2. **修正**：確保 xterm 第一次 fit 後的尺寸（以及 PTY 建立期間發生的每一次 fit）最終一定送達 PTY。做法依根因決定，例如 `pty:create` 完成後補送目前尺寸、或 create 直接帶 fit 後的尺寸。不得改變既有 resize 去抖 / 節流的行為造成大量多餘 resize，也不得影響 Terminal Server 冪等重建（T0108 replay）與 restart 的既有測試。
3. **測試**：單元 / 元件測試守住根因對應的時序；若可行，e2e（隔離實例）建立數個分頁後檢查 PTY 尺寸 = xterm 尺寸，不經重繪。
4. BUG-145 狀態改 FIXED、填修正 commit（若結論是不需修，改寫為調查結論並在回報區建議 WONTFIX，由塔台決定）。

## 驗收條件

- [ ] 根因有證據（或「真實路徑不會發生」的證據）
- [ ] 修正後新分頁 PTY 尺寸與 xterm 一致，不需重繪；restart / 還原 / 外部建立不退化
- [ ] `npm run test:unit` 全綠（基線 4626 passed / 265 files，加上新測試）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功
- [ ] 相關既有 e2e（至少 `t0571` / `t0568`）仍通過
- [ ] BUG-145 → FIXED（或調查結論）

---

## 回報區

> 以下由 sub-session 填寫
