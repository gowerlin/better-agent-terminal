---
schema_version: 1
schema_kind: workorder
id: T0654
title: "`smoke:remote:headless` S13 過時：raw command 探測仍預期 `Forbidden: channel-not-allowed`，T0579 起塔台權杖可呼叫 `terminal:create-with-command`"
type: bugfix
status: DONE
repo: better-agent-terminal
project: PLAN-049
priority: P3
sizing: S
created_at: "2026-10-18T19:09:32+0800"
started_at: "2026-10-18T19:10:17+0800"
updated_at: "2026-10-18T19:15:47+0800"
completed_at: "2026-10-18T19:15:47+0800"
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

## 回報區

### 結果摘要

DONE。S13 的 smoke PTY 是**塔台角色**，T0579 後 raw command 對它是**允許**的（舊 S13 對新伺服器會真的建出一個執行 `echo …-s13-denied` 的分頁，並以「expected channel-not-allowed」FAIL）。改成帶別人的 `--notify-id` 的 raw command 探測：T0579+ 在建立前回 `Forbidden: tower-not-bound`，T0579 前回 `Forbidden: channel-not-allowed`，兩者皆 PASS；任何一個探測建出分頁 → FAIL 並在 cleanup 刪掉。

### 落點檢查

- C-0：PASS（frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`）
- C-1：PASS（工單在 REPO_ROOT 下）；C-2：工單無 `branch`，N/A（實際 `main`）
- C-3：PASS（`scripts/smoke-remote-headless.mjs`、`scripts/__tests__/smoke-remote-headless.test.mjs` 存在）
- 非隔離（`CT_HOME` 未設）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

### 角色 / 授權確認

- S13 的 PTY 以 `pty:create { id: <ptyId>-tower, type: 'terminal', workspaceId }` 建立，**沒有** `customEnv.BAT_TOWER_TERMINAL_ID` → `HelperCapabilityRegistry.issue` 發 **tower** 權杖（`electron/remote/helper-capability.ts` issue：無 towerId → `role: 'tower'`）。
- `HELPER_CHANNEL_ROLES['terminal:create-with-command'] = ['tower']`（T0579，headless 用同一張表，`headless-entry.ts` 1108 行註解）；`headless-helper-narrowing.test.ts`「tower create-with-command — raw command mode on headless (T0579)」實測 tower 會建出分頁並執行命令。⇒ 舊 S13 的預期確實過時（不屬於 memory_overrides 第 1 點的「仍應拒絕 → FAILED」情形）。
- 選擇的探測：`authorizeHelperInvoke` 對 create 類 channel 的 `customEnv.BAT_TOWER_TERMINAL_ID` ≠ 呼叫者自己 → `deny('tower-not-bound')`，在 RemoteServer 交給 handler 之前、也在 `HelperTowerSpawnQuota.reserve` 之前（`remote-server.ts` ~1104–1137），所以**不會建分頁、不佔配額**。這個檢查自 T0432 起就存在（`git log -S tower-not-bound` → aec20c0d），T0579 前的伺服器在 channel 白名單就擋下（`channel-not-allowed`），所以新舊伺服器都不建分頁。
- 為何不選「改測一個仍被拒的 channel」：tower 能呼叫的 helper 腳本裡，對 tower 仍被拒的只有 worker channel（`bat-notify`），那驗的是另一件事；現在的探測同時證明「tower 能進 raw command 模式」與「權杖範圍（新分頁只能回報給自己）正確」，更貼近 S13 原意。
- 拒絕次數不變（raw 1 次 + agent 1 次），不影響 `HELPER_DENIAL_THRESHOLD`。

### 修改內容（commit `a96371d0`）

- `scripts/smoke-remote-headless.mjs`
  - 新增 `s13ForeignTowerId(nonce)`（`<nonce>-s13-other-tower`）；`buildHelperRawProbe` 改為 `bat-terminal.mjs --notify-id <foreign> --cwd /tmp echo <nonce>-s13-denied`。
  - `checkHelperProbeAnswers`：raw 接受 exit 1 + `tower-not-bound`（T0579+）或 `channel-not-allowed`（T0579 前）；`raw.createdId` 有值 → FAIL（`raw probe created terminal …`）；其他回答 FAIL。
  - runner：raw 輸出若有 `Terminal created: <id>` 記入 `s13Strays`（原 `s13Stray` 改為陣列），cleanup 一併 kill + 存在確認。檔頭 ground rules 說明同步。
  - `S13_PROBE_AGENT` 的「授權但不建分頁」探測未改。
- `scripts/__tests__/smoke-remote-headless.test.mjs`
  - fake server 的 raw 回應改成模擬 T0579+ 授權（`--notify-id` ≠ 呼叫 PTY → `tower-not-bound`，否則真的建分頁）；新增 `pre-t0579` / `refused` 情境。
  - 新增：T0579 前伺服器 PASS、建出分頁 FAIL 且 cleanup 後 0 個 PTY、role-not-allowed FAIL、`checkHelperProbeAnswers` raw 判斷表、**以真實 `authorizeHelperInvoke` 驗證探測 payload 對 tower 回 `tower-not-bound`、不帶 `--notify-id` 則 `ok: true`**（把 smoke 的假設綁在產品契約上）。
- `docs/remote-dev-overview.md`：S13 列移除 T0653 的「⚠️ … out of date … not re-run」註記，改寫成新行為。

### 驗證

- `npx vitest run scripts/__tests__/smoke-remote-headless.test.mjs`：95 passed（scripts 測試在 vitest `include` 內，非 `node --test`）
- `npm run test:unit`：314 files passed，5446 passed / 3 skipped（輸出中的 `AttachConsole failed` 是 node-pty conpty agent 的 stderr，非測試失敗）
- 未對遠端伺服器實跑 `smoke:remote:headless`（工單規定不跑；本機沒有可用的遠端 headless 環境）。未改 `electron/**` / `src/**`，typecheck 不適用。

### Commit

- 產品：`a96371d0` fix(smoke): S13 raw command probe follows T0579 tower raw command mode (T0654)（`git commit --only` 3 檔）
- 工單：本次回報 commit（另一筆）；未 push

### 偏差 / 遭遇問題

- 工單初始 `status: TODO`（非 `PENDING`），直接改為 `IN_PROGRESS`。
- 工作期間 HEAD 由其他 Worker 前進（T0652 等），未觸碰其檔案；`src/styles/settings.css`、T0652/T0655/T0656 工單的 M 皆非本單變更。

### 互動紀錄

無（未向塔台提問）。

### 給塔台的後續建議

- 下次有可用的 WSL / SSH headless 時跑一次 `npm run smoke:remote:headless`，確認 S13 evidence 出現 `tower-not-bound (T0579+…)`。
