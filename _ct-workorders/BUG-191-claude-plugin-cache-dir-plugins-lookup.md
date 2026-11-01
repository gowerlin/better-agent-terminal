---
schema_version: 1
schema_kind: bug
id: BUG-191
title: "設了 `CLAUDE_CODE_PLUGIN_CACHE_DIR` 時，BAT 仍在 `<config>/plugins/installed_plugins.json` 找 plugins：CT plugin 偵測與面板 plugins 清單漏掉"
status: FIXING
severity: low
reproducibility: always
created_at: "2026-11-02T02:23:44+0800"
updated_at: "2026-11-02T02:23:44+0800"
impact:
  - claude-config-dir
  - ct-plugin-detect
links:
  discovered_in: "T0730 回報區〈發現的問題 / 後續候選〉1（2026-11-01）"
  related: [T0760, T0730, T0710, BUG-178]
---
# BUG-191 — 設了 `CLAUDE_CODE_PLUGIN_CACHE_DIR` 時，BAT 仍在 `<config>/plugins/installed_plugins.json` 找 plugins：CT plugin 偵測與面板 plugins 清單漏掉

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（只影響設了該變數的使用者） |
| 可重現 | 待 T0760 以 CLI 2.1.316 實測確認 |
| **狀態** | 🔧 FIXING（T0760） |
| 回報者 | T0730 Worker |

## 現象

- CT `data-layer-architecture.md` 記載：設了 `CLAUDE_CODE_PLUGIN_CACHE_DIR` 時整個 plugins 目錄（含 `installed_plugins.json`）都在那裡（CT T0357 / T0374 實測）。
- BAT 的 `findClaudeCtPlugins`（`electron/ct-install-detect.ts`）與面板 plugins 清單都在 `<config>/plugins/installed_plugins.json` 找，只有 cache 根目錄跟著該變數。
- 預期：與 CLI 實際行為一致（以內嵌 CLI 2.1.316 實測為準）。
