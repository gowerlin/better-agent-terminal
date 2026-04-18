# 工單 T0182-remote-tls-fingerprint

## 元資料
- **工單編號**：T0182
- **任務名稱**：Remote TLS + fingerprint pinning + safeStorage + remoteFingerprint（PLAN-018 第一張）
- **類型**：implementation
- **狀態**：TODO
- **建立時間**：2026-04-18 20:00 (UTC+8)
- **預估工時**：5.5h（T0181 研究上修自 T0164 原估 2-3h）
- **優先級**：🔴 High（P0 資安）
- **Renew 次數**：0

## 前置條件

- **PLAN-018 PLANNED**：Remote 資安加固
- **T0181 DONE**（`4822dbd`）：拆分研究報告 `_report-t0181-plan-018-breakdown.md` **§C 為本工單權威規格**
- **T0164 DONE**：Upstream sync 研究（報告 `_report-upstream-sync-v2.1.42-plus.md` §3.2 #7+#8）
- **Upstream commits**：`3a0af80`（主體）+ `5d9f486`（selfsigned v5 async 修復）
- **塔台決策**（使用者 2026-04-18 採 Worker 全推薦）：
  - **Q1.A**：`safeStorage` Linux 無 keychain → fallback plaintext + warn（維持 fork 現行）
  - **Q2.A**：`bind-interface=tailscale` 無介面 → fail-closed error，不 fallback
  - **Q3.是**：ProfilePanel fingerprint 首次連線允許空白 + TOFU 回寫 + read-only + 「Pin expected fingerprint」按鈕

## 權威規格

**閱讀順序**：
1. `_report-t0181-plan-018-breakdown.md` **§C**（完整規格：修改檔案清單含精確行號、改動方向、AC 對照表、測試策略、工時分階段估計）
2. `_report-t0181-plan-018-breakdown.md` **§H**（Fork 客製化熱區 3 處 — 必須保留）
3. `_report-t0181-plan-018-breakdown.md` **§I.1**（風險 R1/R2/R3）
4. `_report-upstream-sync-v2.1.42-plus.md` §3.2 #7（補充背景）

## 修改範圍（摘要，完整見報告 §C）

- **新檔**：`electron/remote/certificate.ts`（~103 行）+ `electron/remote/secrets.ts`（~54 行）
- **改寫**：`electron/remote/remote-server.ts`（整段）+ `electron/remote/remote-client.ts` + `electron/remote/tunnel-manager.ts`
- **擴充**：`profile-manager.ts` 新增 `remoteFingerprint` 欄位 + `ProfilePanel.tsx` UI
- **package.json**：新增 `selfsigned@^5.x`

## 驗收條件

見 `_report-t0181-plan-018-breakdown.md` §C 的 AC 對照表（8-10 條，含 handshake 驗證、TOFU 流程、fail-closed 檢查）。

**commit 訊息**：`feat(remote): TLS + fingerprint pinning + safeStorage (PLAN-018 T0182)`

## 互動規則

**禁止 Worker 互動**（規格已完整）：
- 遇到規格不明 → 先讀 `_report-t0181-plan-018-breakdown.md` §C
- Fork 客製化熱區（§H）衝突 → 停止工作，回塔台
- 使用者已於 Q1/Q2/Q3 給出決策，Worker 依此實作

## 依賴

- **必須先完成**：本工單（T0183 可並行，T0184 必須等 T0182）
- **同屬 PLAN-018 其他工單**：T0183 (path sandbox)、T0184 (brute-force)

## 備註

- 實作前先 `git checkout -b feature/plan-018-t0182-tls` 建分支（若採 feature branch workflow）
- 手動驗證項目 5（QR 掃描跨裝置測試）可能因行動裝置信任 self-signed cert 失敗 — 若失敗不阻擋 DONE，記錄於回報區供後續擴充
- `selfsigned@^5.x` 是 async API，cert 生成需 await

---

## 回報區

> 以下由 sub-session 填寫

（待填：執行摘要、AC 驗收結果、修改檔案清單、Commit、Renew 歷程、DONE 時間）
