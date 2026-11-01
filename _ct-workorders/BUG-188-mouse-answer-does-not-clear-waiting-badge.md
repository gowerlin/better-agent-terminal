---
schema_version: 1
schema_kind: bug
id: BUG-188
title: "用滑鼠回答（拒絕權限、取消 AskUserQuestion、codex 等待輸入）後 ⚠️ 不清除，與鍵盤回答結果不一致"
status: CLOSED
severity: medium
reproducibility: always
created_at: "2026-11-02T02:23:44+0800"
updated_at: "2026-11-02T05:22:28+0800"
fixed_at: "2026-11-02T02:53:52+0800"
closed_at: "2026-11-02T05:22:28+0800"
fix_commit: de8a4fd4
impact:
  - terminal-attention
  - blocked-state
links:
  discovered_in: "使用者指示（2026-11-02，第一百零四 session）：工作區 ⚠️ 手動驗收項「滑鼠回答後清除」；`docs/agent-guide/blocked-state.md`〈清除漏洞〉"
  related: [T0757, T0590, T0594, T0597, T0620, T0657, T0735, D209]
---
# BUG-188 — 用滑鼠回答（拒絕權限、取消 AskUserQuestion、codex 等待輸入）後 ⚠️ 不清除，與鍵盤回答結果不一致

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（回答了仍顯示等待使用者，縮圖 / 工作區 ⚠️ 誤導，等到回合結束才消失） |
| 可重現 | 依路徑而定（見現象） |
| **狀態** | 🚫 CLOSED（T0757 `de8a4fd4`；交付版 `v0.7.3-pre.4` 安裝版自動化實測 T0770 PASS） |
| 回報者 | 使用者（D209：鍵盤或滑鼠回答，結果都是有回答，⚠️ 都要清除） |

## 現象

- 鍵盤輸入算使用者輸入，會清除 hook 記的 `blocked`（`permission` / `question` / `elicitation`）。滑鼠回報屬 `isTerminalAutoReply`，不算輸入。
- 已由 hook 清除（但部分只靠二進位靜態閱讀，未實機觸發）：AskUserQuestion 以滑鼠回答（`PostToolUse(AskUserQuestion)`，T0597）、權限以滑鼠允許（`post-tool-batch`，T0657）、elicitation 以滑鼠回答（`elicitation-done`，T0620）。
- 仍未涵蓋（`blocked` 維持到該回合 `Stop` 或鍵盤輸入）：權限對話框以滑鼠**拒絕**而結束回合（`cancelAndAbort`，`Stop` 是否執行未查證）、AskUserQuestion 以滑鼠**取消 / 拒絕**（tool 未執行，沒有 `PostToolUse`）。
- codex：`blockedReason: input` 由 codex 自己送 OSC 7501 清除，🔴 使用者輸入不清除；滑鼠回答時 codex 是否送 `working` / `idle` 未實測。
- 預期（D209）：不論鍵盤或滑鼠回答，回答後 ⚠️（縮圖、工作區列）都清除；看著分頁時回答不留淡化（D203）。

## 修正（T0757 `de8a4fd4`，2026-11-02T02:53:52+0800）

- 查證（真 claude 2.1.316 fullscreen / codex 0.166 ＋假模型，滑鼠點擊）：① 權限允許、③ AskUserQuestion 回答本來就由 hook 清除；**② 權限以滑鼠拒絕 → 回合中斷、沒有任何 hook，⚠️ 一直留著**（BUG-188 的實際成因）；④ AskUserQuestion 取消、⑤ elicitation、⑥ codex 核准在目前版本不接受滑鼠點擊。
- 修正：blocked 中的分頁收到滑鼠**左鍵按下**（SGR / urxvt / X10，不含放開、移動、滾輪、中鍵 / 右鍵）→ 清 hook reason（`hasMouseButtonPress`、`TerminalBlockedTracker.clearForMousePress`、`PtyManager.noteMousePress`、`pty:write` handler）；不算使用者輸入（`--close-worker` 取消規則、用量限制等待不變），不清 codex `input`，blocked 契約不變。
- 驗證：單元 49 項＋突變；e2e t0757 ①–⑤ / 滾輪不清 / 鍵盤照舊 / codex 不變，修正前 ② 失敗；既有 ⚠️ e2e 4 支綠；typecheck 0 / 0、`test:unit` 6542 / 366 files、`vite build`。
- 已知取捨：無法分辨點到哪個選項，blocked 中任何左鍵按下都清（與鍵盤按方向鍵也會清一致，D209）。
- 待實機驗收：fullscreen claude 以滑鼠拒絕權限 → ⚠️ 立即消失。

## 驗收（2026-11-02T05:22:28+0800，第一百零四 session）

- 依據（R-G003）：交付版 `v0.7.3-pre.4` 安裝版（`BAT_E2E_EXECUTABLE`，隔離實例）跑 `e2e/t0757-mouse-answer-clears-waiting.spec.ts`，T0770 情境 ① PASS（`7ad66d1d` / 回報 `01761b22`，D215）：滑鼠點「No」拒絕權限 → `cleared (mouse press)`，縮圖與工作區列 ⚠️ 立即消失、看著分頁不留淡化；滑鼠允許 / AskUserQuestion / elicitation 清除、滾輪不清、鍵盤照舊、codex `input` 不被滑鼠清。
- 未涵蓋：macOS / Linux（t0757 只支援 Windows）。
