---
schema_version: 1
schema_kind: workorder
id: T0742
title: "T0738 B 類補 e2e：BUG-135 detached 收回後 focus、BUG-156 精靈選 port 避開 RemoteServer、BUG-108 面板圖片附件、BUG-107 拖放路徑、BUG-159 手動 codex 分頁 `--no-daemon` 注入"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-01T18:26:58+0800"
started_at: ""
updated_at: "2026-11-01T18:26:58+0800"
completed_at: ""
depends_on: [T0739]
related:
  - "T0738 回報區〈B 類後續候選〉（情境與做法以該表為起點）"
  - "BUG-135 / T0532、BUG-156 / T0649、BUG-108 / T0436、BUG-107 / T0435、BUG-159 / T0651；`e2e/detached-close-edges.spec.ts`、`e2e/t0524-terminal-image-paste.spec.ts`（剪貼簿備份還原寫法）、`e2e/fixtures/electron-isolation.ts`"
affects_files:
  - "e2e/t0742-*.spec.ts（新增，最多 5 支，可合併）"
  - _ct-workorders/T0742-e2e-b-class-bug-acceptance.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 情境（每項 ≤ 1 個情境，以 T0738〈B 類後續候選〉為準，開工時先讀該表與各 BUG 單 / 修正工單回報區確認名稱與行為）：① BUG-135：兩個工作區 A / B 各有終端；B detach → 主視窗切到 A 並聚焦 A 的分頁 → 關閉 B 的 detached 視窗（收回）→ 主視窗 active 工作區仍是 A、focused terminal 屬於 A。② BUG-156：隔離實例 RemoteServer 綁 `remotePort`，另佔一個 port；呼叫精靈選 port 的 IPC（T0649 的實際名稱）→ 回傳值不是 RemoteServer port、也不是被佔的 port；🔴 不呼叫 docker、不建容器。③ BUG-108：本機工作區，Claude 面板以 tmpdir 外的 PNG 加附件（`setInputFiles` 合成 drop，或 stub 檔案對話框）→ 附件縮圖出現、沒有 path guard denied；不送訊息、不需模型。④ BUG-107：`setInputFiles` 真檔合成 drop 到終端分頁 → PTY 收到含真實路徑的字串（`webUtils.getPathForFile`）。⑤ BUG-159（子項）：關 BAT MCP、開手動 codex 分頁（PATH 上 codex ≥ 0.156.0，內嵌或系統 0.166.0）→ debug log 或命令列有 `--no-daemon`；不登入 codex、不跑 daemon 行為。"
  - "🔴 每項要有修正前會失敗的論證：能便宜驗紅就驗（例如暫時把修正條件改掉、重 build、跑一次後從暫存備份還原；🔴 不得用 git stash / checkout / restore），否則以 `git show <修正 commit>^` 的程式碼說明舊版會走哪條路徑。某項在本機做不到就寫原因，其餘照做，可回 PARTIAL。"
  - "🔴 不改產品程式碼（`src/` / `electron/` / `scripts/` 都不動）；發現產品缺陷記在〈發現的問題〉附重現步驟，由塔台開 BUG。不改 BUG 單狀態與 `_bug-tracker.md`（由塔台處理）；回報區列〈BUG 結案建議〉（每張：可 CLOSED / 仍需手動，附證據）。會寫系統剪貼簿就先備份、跑完還原；無法還原就不做。"
  - "🔴 隔離：一律用 `e2e/fixtures/electron-isolation.ts` 的隔離實例，不以預設實例啟動 source build、不碰使用者正在用的 BAT 與 userData、不執行安裝檔、不碰 Docker / WSL / SSH。T0739 完成後才派本單（避免同時 build）；先 `npx vite build`。暫存目錄跑完要清掉；清不掉就把路徑寫進回報區。不需要 LLM；若某項會啟動 claude / codex 的模型呼叫，只能打本機假 API，回報對外請求數。"
  - "🔴 驗證：新 spec 各連跑 2 次綠；`npm run typecheck` = 0、`npm run typecheck:electron` = 0（e2e 不在 tsconfig 範圍則另以單檔 tsc 檢查）。不發版、不改 CHANGELOG、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0742 — T0738 B 類補 e2e

## 元資料

- **工單編號**：T0742
- **類型**：implementation（驗收用 e2e）
- **優先級**：P2
- **建立時間**：2026-11-01T18:26:58+0800
- **預估規模**：M

## 背景

T0738 盤點 22 張待驗收 BUG，12 張 A 類已由塔台結案；B 類（可在本機 Windows 補 e2e）中 BUG-127 / 131 / 175 已在 T0738 補上，其餘 5 項（BUG-135、156、108、107、159 子項）由本單補，結果作為結案或縮小手動範圍的依據。

## 範圍

1. 情境 ①–⑤（見 frontmatter）。
2. 修正前會失敗的論證。
3. 〈BUG 結案建議〉。

## 不做

- 不改產品程式碼、不改 BUG 狀態。
- 不碰 Docker / WSL / SSH、不用真實模型；BUG-107 真實 OS 拖放、BUG-108 / 107 遠端部分、BUG-159 daemon 行為維持手動。

## 驗收

- [ ] ①–⑤ 逐項 PASS / 未涵蓋與原因
- [ ] 每項的驗紅或論證
- [ ] 新 spec 連跑 2 次綠、兩個 typecheck = 0
- [ ] 〈BUG 結案建議〉

---

## 回報區

### 完成狀態

### 情境結果

### 發現的問題

### BUG 結案建議

### 互動紀錄

### 回報時間
