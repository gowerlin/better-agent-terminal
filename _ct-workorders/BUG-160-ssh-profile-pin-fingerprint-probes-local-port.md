---
schema_version: 1
schema_kind: bug
id: BUG-160
title: "SSH 設定的「重新釘選指紋」直接連本機 `localhost:<遠端埠>`、不經 SSH 通道：可能釘到本機其他 BAT 伺服器的指紋，並把 SSH 設定的權杖送給它"
status: FIXING
severity: medium
reproducibility: conditional（程式碼推論；本機剛好有別的 BAT 伺服器聽在同一埠時）
created_at: "2026-10-18T19:12:43+0800"
impact:
  - remote-security
  - remote-profile-edit
links:
  discovered_in: "T0652（回報區「給塔台：後續建議」第 1 點）"
  related: [T0650, T0652, T0655, BUG-157, T0182]
---

# BUG-160 — SSH 設定的釘選指紋走錯對象

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（權杖可能送到錯的伺服器；但對象仍是使用者自己機器上的 BAT 伺服器，通常只是連不上） |
| 可重現 | 條件式（程式碼推論）：本機 `localhost:<SSH 設定的 remotePort>` 剛好有別的 BAT 伺服器 |
| **狀態** | ⏳ FIXING（T0655） |

## 現象（T0652 程式碼追蹤）

- `src/components/ProfilePanel.tsx` `handlePinFingerprint` 以設定的 `remoteHost:remotePort` 直接呼叫 `remote:test-connection`，**不經 SSH 通道**。
- SSH 設定的 `remoteHost` 是 `localhost`、`remotePort` 是**遠端主機上**伺服器的埠（實際連線時由 SSH tunnel 轉到系統挑的本機埠）。
- 結果：通常只是連不上（顯示錯誤）；若本機剛好有別的 BAT 伺服器聽在同一埠（WSL 伺服器 9877 起、本機 BAT 自己的 9876、或 Docker 容器的埠），會把**那台**的指紋釘進 SSH 設定，並把 SSH 設定的權杖送給它（釘選是 TOFU、不帶預期指紋，`remote-client.ts` 只有在有預期指紋時才在送權杖前比對）。
- 網站 `/remote/#fingerprint` 已寫「SSH 的設定請重跑設定精靈」。

## 修正方向（T0655）

- 最小修正：SSH 設定停用「重新釘選指紋」按鈕（附說明：請重跑設定精靈），並在 `handlePinFingerprint` 防禦性拒絕 SSH 設定。
- 改走通道（先開 tunnel 再探測）屬較大變更，不在本單。
