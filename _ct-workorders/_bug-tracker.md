---
schema_version: 1
schema_kind: index
id: _bug-tracker
index_kind: bugs
generated_at: "2026-10-04T20:48:06+08:00"
generator: control-tower-sync
source_globs:
  - _ct-workorders/BUG-*.md
exclude_globs:
  - _ct-workorders/_archive/**
  - _ct-workorders/examples/**
total: 10
breakdown:
  OPEN: 1
  FIXING: 0
  FIXED: 3
  VERIFY: 0
  CLOSED: 6
  WONTFIX: 0
---

# Bug Tracker

> ⚠️ 此文件由 `*sync` 自動生成，請勿手動編輯。
> 最後同步：2026-10-04 22:04 (UTC+8) — 第五十二 session：新開 BUG-089（WSL 網路模式誤判 NAT，併入 T0380 研究）

## 統計
- 🔴 Open: 2 | ⏳ Fixing: 0 | ✅ Fixed: 3 | 🧪 Verify: 0 | 🚫 Closed: 9 | ⛔ Won't Fix: 0 | **Total: 14**

## 🔴 Open / 處理中

| ID | 標題 | 嚴重度 | 建立時間 | 連結 |
|----|------|--------|---------|------|
| BUG-089 | WSL 精靈把 Mirrored 網路模式誤判為 NAT（default route 含 `via` 即判 NAT 的啟發式不成立） | 🟡 medium | 2026-10-04 | [BUG-089](BUG-089-wsl-network-mode-misdetected-as-nat.md) |
| BUG-061 | `CodexAgentPanel.tsx` baseline tsc errors（dev-only，pre-existing） | 🟢 low | 2026-04-26 | [BUG-061](BUG-061-codex-agent-panel-tsc-baseline-errors.md) |

## ⏳ 修復中 (FIXING)

| ID | 標題 | 嚴重度 | 建立時間 | 連結 |
|----|------|--------|---------|------|
| _（無）_ | | | | |

## ✅ 已修復

| ID | 標題 | 嚴重度 | 修復時間 | 連結 |
|----|------|--------|---------|------|
| BUG-088 | SSH 設定精靈寫出的 systemd unit / launchd plist 含字面 `~`，服務無法啟動（BUG-087 缺陷 B 的 SSH 版） | 🔴 high | 2026-10-04 | [BUG-088](BUG-088-ssh-wizard-service-unit-literal-tilde.md) |
| BUG-087 | WSL 精靈「寫入 systemd 使用者服務」失敗：linger 未帶使用者、unit 檔 `~` 不展開、失敗後 bundle 被回滾 | 🔴 high | 2026-10-04 | [BUG-087](BUG-087-wsl-wizard-systemd-step-linger-tilde-rollback.md) |
| BUG-086 | WSL 設定精靈把「已裝 WSL 但無發行版」誤判為「找不到 WSL2」，引導使用者重裝 WSL | 🟢 low | 2026-10-04 | [BUG-086](BUG-086-wsl-wizard-no-distro-misreported-as-no-wsl.md) |

## 🧪 驗收中 (VERIFY)

| ID | 標題 | 嚴重度 | 驗證時間 | 連結 |
|----|------|--------|---------|------|
| _（無）_ | | | | |

## 🚫 已關閉 (CLOSED)

| ID | 標題 | 嚴重度 | 關閉時間 | 連結 |
|----|------|--------|---------|------|
| BUG-071 | Setup Wizard install-server-bundle 硬性失敗：server bundle tarball 自動取得未實作 | 🔴 high | 2026-10-04 | [BUG-071](BUG-071-server-bundle-download-flow-missing.md) |
| BUG-085 | Codex CLI 0.160 在提權的 Windows 上拒絕啟動 daemon，Codex CLI 終端 preset 直接失敗 | 🟡 medium | 2026-10-04 | [BUG-085](BUG-085-codex-cli-daemon-refuses-elevated-windows.md) |
| BUG-084 | 內嵌 Claude CLI 2.1.113 被服務端拒絕 Claude 5 主力模型（claude_code_version_too_old） | 🔴 high | 2026-10-04 | [BUG-084](BUG-084-embedded-claude-cli-too-old-for-claude-5.md) |
| BUG-083 | Codex agent 出錯，測試者指稱需更新 codex 版本（內嵌 0.124.0，上游 0.160.0） | 🟡 medium | 2026-10-04 | [BUG-083](BUG-083-codex-agent-errors-outdated-bundled-cli.md) |
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
