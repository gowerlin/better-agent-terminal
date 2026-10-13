---
schema_version: 1
schema_kind: workorder
id: T0505
title: "SSH wizard：選 ~/.ssh/config alias 時 sshUser 為空 → verify-ssh-auth 必失敗（alias 路徑整條不通）——user 交由 ssh config 決定或自 `ssh -G` 解析"
type: implementation
status: TODO
repo: better-agent-terminal
project: D139
priority: P1
sizing: M
created_at: "2026-10-14T00:12:39+08:00"
started_at: null
updated_at: "2026-10-14T00:12:39+08:00"
completed_at: null
target_version: v0.6.0-pre.5
depends_on:
  - "T0502"
  - "T0496"
related:
  - "T0502 回報區「觀察」：`configure-ssh-host` 選 alias 後存 `sshUser: ''`；`steps/ssh/verify-auth.ts:65` 要求 `sshUser` 非空；electron `buildBaseSshArgs` / `validateSshIdentifier`（`electron/remote/ssh-args.ts:46-63`）也要求 user 非空 ⇒ 只有手動輸入 `user@host` 才能通過"
  - "`buildBaseSshArgs` 消費者：`ssh-auth-probe.ts`、`ssh-bundle-uploader.ts`、`ssh-start-server.ts`、`ssh-tunnel.ts`、`ssh-wizard-verify.ts`；F-004（開頭 `-` 會被 ssh 當 option，RCE）"
affects_files:
  - "electron/remote/ssh-args.ts"
  - "electron/remote/"
  - "src/components/setup-wizard/steps/ssh/"
  - "src/components/setup-wizard/__tests__/"
  - "electron/remote/__tests__/"
  - "src/lib/"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 安全邊界不得放寬：F-004 防護（user / host 不得以 `-` 開頭、白名單驗證）維持；若改為「無 user 時只傳 host / alias」，alias 同樣須過白名單且不得以 `-` 開頭，並在 argv 中以 `--` 或固定位置避免被解析為 option（附負向測試）"
  - "🔴 先查證再改：比較 (a) user 可空——空時不組 `user@`，由 ssh config 決定 user / port / identity；(b) 選 alias 時以 `ssh -G <alias>`（execFile + array args + timeout）解析有效 user / hostname / port 寫入；評估 SSH profile 既有資料、teardown（`TEARDOWN_*_RE`）、tunnel、known_hosts 對兩者的影響，推薦並說明"
  - "🔴 既有「手動輸入 user@host」與已存 profile 行為不變（測試證明）"
  - "🔴 批次並行（D139）：`git commit --only` 本單檔案；不改 CLAUDE.md（建議文字寫回報區由 T0493 套用）；`npm run typecheck` / `npm run typecheck:electron` 維持 0"
  - "🔴 不得以預設實例啟動 source build；不得對真實遠端主機連線（用 mock / 測試 fixture）"
  - "🔴 不 push、不觸發 workflow；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；換行維持各檔現況"
---

# T0505 — SSH wizard alias 路徑

## 實作

1. 追 SSH profile 從 wizard 到 runtime 的所有 `sshUser` 使用點（wizard steps、`buildBaseSshArgs` 消費者、profile 儲存 / 連線、teardown），列表
2. 依 memory_overrides 比較 (a) / (b)，選定並實作；alias 選單路徑能通過 `verify-ssh-auth` 及後續步驟（單元層級以 mock execFile 驗證組出的 argv）
3. 負向測試：alias / user / host 以 `-` 開頭或含非法字元被拒；argv 不出現可被解析為 option 的使用者輸入
4. 若現有已存 profile 有 `sshUser: ''`（alias 路徑曾存下但無法用），確認新行為下可直接使用或給出明確提示

## 驗收條件

- [ ] 使用點表、方案比較與推薦
- [ ] 單元：alias 路徑 verify → install → start → tunnel 的 argv 正確；手動 `user@host:port` 不變；安全負向測試
- [ ] `npm run test:unit`、`npm run typecheck`、`npm run typecheck:electron`、`npx vite build`
- [ ] 回報區：需實機驗證項目（真 SSH alias）、CLAUDE.md 建議文字、`git diff --stat`

## Sub-session 執行指示

1. 讀本工單 + D139 + T0502 回報區 + `electron/remote/ssh-args.ts` 與消費者 + `src/components/setup-wizard/steps/ssh/`
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

（Worker 填寫）
