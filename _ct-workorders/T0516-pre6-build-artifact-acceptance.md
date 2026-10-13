---
schema_version: 1
schema_kind: workorder
id: T0516
title: "pre.6 建置產物自動化驗收：BUG-115（release.ps1 -Snapshot）、BUG-118 Linux AppImage 內嵌 claude、BUG-117 / 116 產物層檢查"
type: implementation
status: PENDING
repo: better-agent-terminal
project: BUG-verify-pre6
priority: P2
sizing: M
created_at: "2026-10-14T03:42:23+0800"
target_version: "0.6.0-pre.6（驗收，不發版）"
related:
  - "T0488（BUG-115 修正）、T0475 / T0470（BUG-118 / 117，`scripts/verify-packaged-native.js`）、T0468（BUG-116）"
  - "D136（mac 只打 arm64 dmg）"
  - "並行：T0514（UI 線）、T0515（精靈線）"
affects_files:
  - _ct-workorders/T0516-pre6-build-artifact-acceptance.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **不改產品程式碼、不改 `scripts/**` / `package.json` / workflow**。發現缺陷 → 回報區記證據，該項 FAIL、整單 PARTIAL，不自行修。BUG 檔與 `_bug-tracker.md` 不動。"
  - "🔴 **不發版、不 push、不建 tag、不呼叫 `gh release` / `gh workflow run` 等寫入操作**；`gh` 只做唯讀下載且一律帶 `-R gowerlin/better-agent-terminal`（L122）。"
  - "🔴 **BUG-115 建置要隔離**：T0514 / T0515 正在並行（它們用已安裝 exe，不用 repo 的 build 產物），但不要在主 repo 的 `dist*/` / `release/` 產生會留下的變更。建議 `git worktree add <scratchpad>/t0516-wt HEAD` 後在 worktree 內 `npm ci` + `release.ps1 -Snapshot`；結束後移除 worktree。若 worktree 方案不可行，回報區說明後在主 repo 執行，並確認結束後 `git status` 無新增追蹤變更。"
  - "🔴 **不碰使用者正在用的 BAT**；不安裝 / 解除安裝任何 BAT 安裝檔（只解壓或唯讀檢查）。"
  - "🔴 **WSL**：只在 `<scratch>` / WSL `/tmp/bat-t0516-*` 下解壓與執行；不動 `~/.local/bat-server`；不得 `wsl --shutdown` / `--terminate`。執行內嵌 claude 只跑 `--version`（不消耗 token）。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF。"
---

# T0516 — pre.6 建置產物自動化驗收

## 背景

使用者要求把「已修復待實機驗收」的 BUG 盡量自動化（2026-10-14 第六十 session）。本單是三條並行線之一：**建置流程與發佈產物**，不需要 GUI。

## 驗收項目

| # | BUG | 驗收重點 |
|---|---|---|
| B1 | BUG-115 | `.vscode/scripts/release.ps1 -Snapshot`（本機 snapshot 打包）可跑完：`fetch:baseline` 取基底版號 `0.6.0-pre.6`（不 404），產出安裝檔；附 log 關鍵行（解析出的 baseline 版號、產物路徑與大小） |
| B2 | BUG-118（Linux） | 從 `v0.6.0-pre.6` release 唯讀下載 Linux AppImage，在 WSL `/tmp/bat-t0516-*` 以 `--appimage-extract` 解開，確認 `resources/app.asar.unpacked/node_modules/@anthropic-ai/claude-code-linux-x64/claude`（或 fallback `claude-code/bin/claude.exe`）存在、為 ELF x86-64，執行 `--version` = `2.1.296 (Claude Code)` |
| B3 | BUG-118 / 117（mac 產物層） | 下載 pre.6 arm64 dmg，以可用工具（如 7-Zip）唯讀解開，檢查：內嵌 claude 依 `embeddedClaudeCandidates` 規則存在、Mach-O cputype = arm64；確認 release 不含 x64 dmg（D136）。無法在 Windows 解開 dmg 時，改以 `pre-release.yml` 該 run（`38450958394`）的 `verify-packaged-native` job log 為證據，並標「mac 實機啟動需 Gary」 |
| B4 | BUG-116（產物層） | 同上 dmg：`@kutalia/whisper-node-addon/dist/{mac,darwin}-arm64/whisper.node` 存在。實際啟動不崩潰 → NEEDS-HUMAN（Gary） |

每項標 PASS / FAIL / NEEDS-HUMAN，附證據。

## 驗收條件

- [ ] B1-B4 各有結論與證據
- [ ] 主 repo `git status` 無新增追蹤變更（worktree 已移除）；未發版、未寫入 GitHub

## Sub-session 執行指示

1. 讀本工單、BUG-115 / 116 / 117 / 118 檔
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 執行 → 填回報區（DONE / PARTIAL）
4. commit 本單檔案（精準 `git add`）；不 push；依派發 mode 通知塔台

---

## 回報區

