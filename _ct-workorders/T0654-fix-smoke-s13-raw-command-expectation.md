---
schema_version: 1
schema_kind: workorder
id: T0654
title: "`smoke:remote:headless` S13 過時：raw command 探測仍預期 `Forbidden: channel-not-allowed`，T0579 起塔台權杖可呼叫 `terminal:create-with-command`"
type: bugfix
status: TODO
repo: better-agent-terminal
project: PLAN-049
priority: P3
sizing: S
created_at: "2026-10-18T19:09:32+0800"
depends_on: [T0653]
related:
  - "T0653 回報區「新發現的落後項」最後一列、「給塔台的後續建議」第 2 點；T0434（S13 原設計）；T0579（塔台權杖允許 raw command）；`electron/remote/helper-capability.ts` `HELPER_CHANNEL_ROLES` / `authorizeHelperInvoke`；`docs/agent-guide/remote-tower-notify.md`"
affects_files:
  - scripts/smoke-remote-headless.mjs
  - scripts/__tests__/smoke-remote-headless.test.mjs
  - "docs/remote-dev-overview.md（只移除 T0653 加的「S13 這半段已過時、未重跑」註記，改成新行為）"
  - _ct-workorders/T0654-fix-smoke-s13-raw-command-expectation.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 先確認：S13 的 smoke PTY 拿到的權杖角色（tower / worker / 未宣告）與 T0579 後 `terminal:create-with-command` 對該角色的實際授權結果（讀 `helper-capability.ts` 與 T0579 相關測試）。若對該角色仍應拒絕，S13 本來就正確 → 不改腳本，回報 `FAILED` 附證據。"
  - "🔴 修正原則：S13 驗證的是「權杖範圍正確」，不是「raw command 一律被拒」。改成對得上 T0579 後契約的斷言；🔴 **探測不得在伺服器真的建出分頁或執行命令**：若 raw command 對該角色已允許，就不要再送會成功的 raw command（改測一個對該角色仍被拒的 channel，或用不建分頁的驗證方式），並在回報說明選擇。`S13_PROBE_AGENT` 的「授權但不建分頁」探測維持。"
  - "🔴 不改產品碼（`electron/**`、`src/**`）。不實際對遠端伺服器跑 smoke（沒有可用的遠端環境時寫明）；以 `scripts/__tests__/smoke-remote-headless.test.mjs` 單元測試涵蓋判斷函式。"
  - "🔴 非隔離工單。T0652（改 `src/**`、`site/remote/**`、`e2e/t0567-dialog-esc.spec.ts`）同時進行，不碰它的檔。`src/styles/settings.css` 的 M 不是你的變更，不碰。commit 用 `git commit --only <檔案>`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。不 push。"
---

# T0654 — 更新 S13 的 raw command 預期

## 背景

T0653 更新 `docs/remote-dev-overview.md` 時發現：`scripts/smoke-remote-headless.mjs` 的 S13（T0434）以 `bat-terminal.mjs --cwd /tmp echo …-s13-denied` 送 raw command（`terminal:create-with-command`），預期一律 `Forbidden: channel-not-allowed`。T0579 起塔台權杖可以呼叫這個 channel，所以對新伺服器 S13 可能失敗，而且探測命令可能真的在伺服器上建出一個分頁。

## 要做的事

1. 確認 S13 smoke PTY 的權杖角色與 T0579 後的授權結果。
2. 依結果更新 S13 的探測與判斷（`checkHelperProbeAnswers` 等），確保探測不會建出分頁。
3. 更新單元測試；`docs/remote-dev-overview.md` 的過時註記改成新行為。

## 驗證

- `node --test scripts/__tests__/smoke-remote-headless.test.mjs`（或專案慣用的執行方式）全綠
- `npm run test:unit` 全綠（若 scripts 測試不在 vitest 範圍，寫明各自的執行方式與結果）

## 驗收

- S13 與 T0579 後的權杖契約一致；探測不建分頁
- 回報區附角色 / 授權確認、修改說明、測試結果、commit
- 只改 `affects_files`；未 push
