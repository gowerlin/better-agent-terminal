# PLAN-018-remote-security-hardening

## 元資料
- **編號**：PLAN-018
- **標題**：Remote 連線資安加固（Phase 2 移植）— TLS + fingerprint pinning + path sandbox + brute-force 防護
- **狀態**：PLANNED
- **優先級**：🔴 High（P0 資安）
- **建立時間**：2026-04-18 06:55 (UTC+8)
- **完成時間**：（完成時填入）
- **關聯研究**：T0164（研究報告 `_report-upstream-sync-v2.1.42-plus.md` §3.2 #7+#8 / §4 Phase 2）
- **決策依據**：D058（基於 T0164 結論採方案 [A]，Phase 2 獨立 PLAN）

## 描述

Upstream `tony1223/better-agent-terminal` v2.1.42+ 的 remote 資安加固為 P0 級變更，涵蓋：

| 面向 | 內容 |
|------|------|
| **TLS** | Remote 連線強制 TLS，排除純 HTTP 明文路徑 |
| **Fingerprint pinning** | Server 憑證指紋驗證（selfsigned 支援，由 `5d9f486` 補強） |
| **Path sandbox** | Workspace 路徑沙盒化，阻絕 path traversal |
| **Brute-force 防護** | Auth 失敗次數限制 + cooldown |

**來源 commits**：
- `3a0af80` — remote 資安加固主體
- `5d9f486` (v2.1.46-pre.1) — selfsigned fingerprint 修復（依附修復）

**變更規模**：16 檔案，+1288 / -285 行（移植版本可能 ±20-30%，視 fork 既有實作差異）。

## 為什麼是移植（port）而非 cherry-pick

（詳見 T0164 研究報告 §3.2 #7+#8 分析）

fork 側 remote 子系統已有部分客製化（workspace loader、profile 身份、supervisor routing），直接 cherry-pick 可能出現：
1. **衝突面積大**：remote 模組多處檔案與 fork 本地修改交疊
2. **需適配 BAT supervisor 架構**：upstream 是純 worker，fork 引入 supervisor 後，auth / session 權限模型需要重新設計
3. **需要獨立測試環境**：TLS / fingerprint 測試需要 remote server + client 雙端驗證

因此採「移植」策略：讀懂 upstream 設計意圖，在 fork 架構上重新實作，而非機械 cherry-pick。

## 預估工時

**6-10h**（整包）：
- 讀懂 upstream 設計與測試案例：1.5-2h
- TLS + fingerprint pinning 實作：2-3h
- Path sandbox：1-2h
- Brute-force 防護：1-1.5h
- 整合測試（remote server + client 雙端）：1-2h
- 文件與 CLAUDE.md 更新：0.5h

## 建議時程

- **本週**：❌ 不排入（本日 PLAN-016/005/003 剛全閉環，負荷已滿）
- **下週**：✅ 建議排入（context 乾淨、測試環境可準備）
- **觸發條件**：T0165（Phase 1）完成且 smoke 通過 → 啟動 PLAN-018

## 關聯

- **T0164** — 研究工單（已 DONE），提供完整分析
- **T0165** — Phase 1 cherry-pick（本輪執行），C1.1 / C1.2 與本 PLAN 獨立無依賴
- **版號管理** — 本 PLAN 完成後需更新 `version.json.lastSyncCommit` 到 `5d9f486`

## 相關工單
（實作階段另開 T####，可能需要拆分多張：如 T####-tls-fingerprint / T####-path-sandbox / T####-brute-force 防護）

## 備註

- **P0 分級理由**：remote 是公開連線介面，缺 TLS / 缺 fingerprint pinning 等於明文傳輸敏感 workspace 內容；缺 path sandbox 可能被利用讀取任意檔案
- **不阻塞 T0165**：Phase 1 cherry-pick 與 remote 資安加固互相獨立，可並行規劃
- **Fork 既有 remote 偏離**（需保留，實作時避免直接覆蓋）：
  - `workspace:load` 載入流程（T0165 C1.2 可能有微調）
  - profile 身份辨識（T0165 C1.2 可能有微調）
  - Supervisor 路由與 remote session 的互動關係
