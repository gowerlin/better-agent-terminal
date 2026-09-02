---
schema_version: 1
schema_kind: index
id: _bug-tracker
index_kind: bugs
generated_at: "2026-09-02T16:05:00+08:00"
generator: control-tower-sync
source_globs:
  - _ct-workorders/BUG-*.md
exclude_globs:
  - _ct-workorders/_archive/**
  - _ct-workorders/examples/**
total: 7
breakdown:
  OPEN: 2
  FIXING: 0
  FIXED: 0
  VERIFY: 0
  CLOSED: 5
  WONTFIX: 0
---

# Bug Tracker

> ⚠️ 此文件由 `*sync` 自動生成，請勿手動編輯。
> 最後同步：2026-09-02 16:05 (UTC+8) — 第四十八 session：*archive 後重建（BUG-081 移入冷區）

## 統計
- 🔴 Open: 2 | ⏳ Fixing: 0 | ✅ Fixed: 0 | 🧪 Verify: 0 | 🚫 Closed: 5 | ⛔ Won't Fix: 0 | **Total: 7**

## 🔴 Open / 處理中

| ID | 標題 | 嚴重度 | 建立時間 | 連結 |
|----|------|--------|---------|------|
| BUG-071 | Setup Wizard install-server-bundle 硬性失敗：server bundle tarball 自動取得未實作 | 🔴 high | 2026-04-27 | [BUG-071](BUG-071-server-bundle-download-flow-missing.md) |
| BUG-061 | `CodexAgentPanel.tsx` baseline tsc errors（dev-only，pre-existing） | 🟢 low | 2026-04-26 | [BUG-061](BUG-061-codex-agent-panel-tsc-baseline-errors.md) |

## ⏳ 修復中 (FIXING)

| ID | 標題 | 嚴重度 | 建立時間 | 連結 |
|----|------|--------|---------|------|
| _（無）_ | | | | |

## ✅ 已修復

| ID | 標題 | 嚴重度 | 修復時間 | 連結 |
|----|------|--------|---------|------|
| _（無）_ | | | | |

## 🧪 驗收中 (VERIFY)

| ID | 標題 | 嚴重度 | 驗證時間 | 連結 |
|----|------|--------|---------|------|
| _（無）_ | | | | |

## 🚫 已關閉 (CLOSED)

| ID | 標題 | 嚴重度 | 關閉時間 | 連結 |
|----|------|--------|---------|------|
| BUG-082 | 跨專案工單前綴（CP-/CT-）被結構化派工路徑拒收，且四處 ID 規則彼此不一致 | 🔴 high | 2026-09-02 | [BUG-082](BUG-082-workorder-id-prefix-rejected-by-structured-dispatch.md) |
| BUG-078 | ct-drift-telemetry.ts 引用 node:fs/path/os 觸發 D090 guard，CI verify-renderer-imports fail | 🔴 high | 2026-09-02 | [BUG-078](BUG-078-ct-drift-telemetry-renderer-node-imports-d090-violation.md) |
| BUG-074 | SSH setup wizard：input step 在使用者輸入前就顯示 failed | 🟡 medium | 2026-09-02 | [BUG-074](BUG-074-ssh-wizard-input-step-shows-failed-on-init.md) |
| BUG-073 | Docker setup wizard：daemon 未運作時錯誤訊息純技術，無 actionable 引導 | 🟡 medium | 2026-09-02 | [BUG-073](BUG-073-docker-wizard-daemon-not-running-error-handling.md) |
| BUG-072 | WSL setup wizard：systemd linger 失敗訊息不友善 + bat-server.service timeout | 🟡 medium | 2026-09-02 | [BUG-072](BUG-072-wsl-systemd-linger-error-handling.md) |

> 💡 BUG-079/080 已於 2026-05-19 歸檔；BUG-081 於 2026-09-02 歸檔 → [_archive/bugs/](_archive/bugs/)
>
> ⚠️ BUG-072/073/074 以 **field evidence** 就地結案（上線 101 天零回饋），**非人工 smoke**；
> BUG-078 則有 CI 正面證據。結案依據差異見各 BUG 文末結案紀錄。

## ⛔ 不修復 (WONTFIX)

| ID | 標題 | 嚴重度 | 標記時間 | 連結 |
|----|------|--------|---------|------|
| _（無）_ | | | | |
