---
schema_version: 1
schema_kind: workorder
id: T0517
title: "SSH 精靈：目標 sshd 禁止 port forwarding 時給出正確錯誤訊息（BUG-124）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: BUG-124
priority: P3
sizing: S
created_at: "2026-10-14T04:03:26+0800"
target_version: "0.6.0-pre.7"
related:
  - BUG-124
  - "T0515（W7(a) 重現情境：`e2e/pre6-wizard-acceptance.spec.ts`、`e2e/real-remote/t0515-wizard-env.mjs`）"
affects_files:
  - electron/remote/
  - src/components/setup-wizard/
  - src/locales/
  - electron/remote/__tests__/
  - src/components/setup-wizard/__tests__/
  - e2e/pre6-wizard-acceptance.spec.ts
  - _ct-workorders/T0517-ssh-wizard-forwarding-denied-error.md
  - _ct-workorders/BUG-124-ssh-wizard-forwarding-denied-misleading-tls-error.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 與 T0518 並行（T0518 改 `electron/handlers/claude.ts`）：本單不改該檔；commit 用 `git commit --only` 或精準 `git add`。"
  - "🔴 不碰使用者正在用的 BAT（port 9876、真實 userData）與 WSL bat-server（9877）；e2e 隔離實例；Docker 資源只用 `bat-t0515-*` / `bat-t0517-*` 前綴並收尾刪除；`~/.ssh/config` 若被腳本暫改須雜湊還原。不消耗 Claude token。"
  - "🔴 改 `electron/**` 驗收 `npm run typecheck:electron` = 0；改 `src/**` 驗收 `npm run typecheck` = 0；i18n 三語齊備。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 e2e（L141）。"
---

# T0517 — SSH 精靈 forwarding 被拒的錯誤訊息（BUG-124）

## 任務

1. 讀 BUG-124 與 T0515 回報區「觀察」節。確認 tunnel ssh 行程在 forwarding 被拒時的實際 stderr（如 `channel N: open failed: administratively prohibited: open failed`）
2. 在精靈驗證階段（fetch-fingerprint / 連線測試，SSH tunnel 路徑）偵測此情況，錯誤改為指出「目標 sshd 不允許 port forwarding（`AllowTcpForwarding`）」並附建議；原始錯誤保留在 detail；三語
3. 不改變既有成功路徑與 rollback 行為

## 驗證

- 單元測試：錯誤分類 / mapper 對 forwarding-denied stderr 的判斷
- 可行時以 T0515 的容器情境（`AllowTcpForwarding no`）在 source build 隔離實例實測新訊息（回報區附截圖或 log）；不可行則說明
- `npx vite build` exit 0、typecheck 雙 0、`npm run test:unit` 全套通過

## 驗收條件

- [ ] forwarding 被拒時顯示正確原因（三語）
- [ ] BUG-124：`status: FIXED`、`fixed_at`、body 狀態列與「根因與修正」同步

## Sub-session 執行指示

1. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
2. 實作 → 驗證 → 填回報區（DONE / PARTIAL / BLOCKED）
3. commit 本單檔案；不 push；依派發 mode 通知塔台

---

## 回報區

