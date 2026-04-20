# PLAN-026 — JetBrains Gateway Dev Container 剪貼簿 proxy(HTTP daemon via host.docker.internal)

| 欄位 | 內容 |
|------|------|
| **狀態** | 💡 IDEA |
| **優先級** | 🟢 Low |
| **類型** | 技術改善(UX 延伸) |
| **建立時間** | 2026-04-20 |
| **建立者** | Gower |
| **驅動契機** | Selene v4.3.3 實測後仍有「剪貼簿降級文字提示」的日常摩擦(L088 + OSC 52 穿透失敗證據鏈);CT-T009 只解決環境識別,不解決剪貼簿 UX |
| **關聯** | CT-T009(v4.3.3 前置)、PLAN-025、L088 |

---

## 動機 / 背景

v4.3.3(CT-T009)確認 JetBrains Gateway Dev Container 環境下:

1. **無法自動開新分頁**:Gateway 協議本身不支援(非可修復問題)
2. **OSC 52 穿透失敗**:escape sequence 被容器/Gateway/IDE terminal 吞掉,不傳到 macOS host clipboard(2026-04 Selene 實測確認)

導致 auto-session 在此情境只能**降級文字提示**,使用者需手動選取指令 + Cmd+C + 切終端 + Cmd+V,體驗遠差於其他環境(WT / macOS Terminal / VS Code Remote-Containers 都有真正的自動化能力)。

本 PLAN 針對此缺口探索**剪貼簿 proxy daemon** 方案,讓 devcontainer 內的指令能透過 `host.docker.internal`(或等價 bridge)呼叫 mac 側 daemon,由 daemon 呼叫 `pbcopy` 寫入 host clipboard。

---

## 概念方案

### 架構

```
┌─────────────────────────┐          ┌────────────────────────┐
│ JB Gateway Dev Container│          │  macOS Host            │
│                         │          │                        │
│ Claude CLI              │  HTTP    │  clipboard-daemon      │
│   └─ auto-session       ├────────▶ │   (listens 127.0.0.1)  │
│        └─ curl bridge   │          │   └─ pbcopy <body>     │
└─────────────────────────┘          └────────────────────────┘
      (via host.docker.internal)
```

### 使用者體驗流程

1. 使用者首次安裝 BAT / claude-control-tower → 提示「若使用 JetBrains Gateway Dev Container,建議安裝 clipboard-helper daemon」
2. 提供一鍵安裝(`brew install ...` 或 shell script)
3. daemon 於 macOS 背景常駐(launchd plist)
4. auto-session 偵測 JB Gateway + daemon 可達 → 走 HTTP 寫入剪貼簿
5. 使用者在 mac Cmd+V 貼出 → 完整指令進入終端

---

## 非目標 / 範圍外

- ❌ **不改 Gateway 協議**(上游問題,無解)
- ❌ **不做 Windows / Linux host 版本**(目標使用者:macOS + JB Gateway;其他平台暫不考量)
- ❌ **不嵌入 control-tower skill**(helper daemon 屬獨立工具鏈,skill 只負責偵測 daemon 是否可達)
- ❌ **不做自動安裝**(第一版採「提示使用者手動安裝」策略,避免自動寫入 launchd)

---

## 前置條件

- [ ] CT-T009(v4.3.3)已交付並 tag
- [ ] 使用者或試跑者累積 ≥1 個月 JB Gateway 日常使用 feedback,確認「文字提示摩擦」是真痛點
- [ ] Selene 或其他 JB Gateway 使用者明確表示願意裝 helper daemon

---

## 技術考量(未細化,留給研究工單)

| 議題 | 候選方案 | 備註 |
|------|---------|------|
| daemon 實作語言 | Go / Rust / Node(pkg 化) | 取決於分發方式 |
| 分發方式 | Homebrew formula / shell installer / DMG | Homebrew 最親和 |
| 認證 | localhost-only + token | 防本機其他 process 亂寫剪貼簿 |
| Bridge 位址 | `host.docker.internal`(Docker Desktop / OrbStack 都支援) | Linux 原生 Docker 不一定有 → 超範圍 |
| 協議 | HTTP POST plaintext body / HTTP POST JSON + base64 | KISS 原則選 plaintext |
| 相容其他 devcontainer | VS Code Remote-Containers(OSC 52 可用,不需 proxy)| 不衝突 |

---

## 驗收標準(未來研究 + 實作時定義)

- [ ] daemon 可啟動 + 背景常駐
- [ ] `curl -X POST --data 'test' http://host.docker.internal:PORT/copy` 可將 "test" 寫入 mac 剪貼簿
- [ ] auto-session 偵測 daemon 可達 → 走 proxy 路徑
- [ ] daemon 不可達 → 優雅降級文字提示(不擋流程)
- [ ] 認證 token 不洩漏(log 不含 token)

---

## 評估時機

**不主動排入下輪**。待以下任一觸發再考慮研究工單:

- 使用者或試跑者明確回報「文字提示降級很煩,願意裝 helper」
- 其他 JB Gateway 使用者加入試跑,形成 ≥3 人樣本
- control-tower 整體方向決定「擴張 devcontainer 支援度」

若 Selene 日常使用幾個月後回報「文字提示其實可以接受」→ 本 PLAN 可轉 🚫 DROPPED。

---

## 備註

- 本 PLAN 從 L088(devcontainer 假設失誤根因教訓)+ Selene OSC 52 實測結果衍生
- 與 PLAN-025(跨平台終端偵測)為**延伸關係**,不重疊:PLAN-025 解「偵測 + 原生能力善用」,本 PLAN 解「JB Gateway 無原生能力時的替代路徑」
- 提案時留下:host.docker.internal 在 macOS Docker Desktop / OrbStack 皆支援,Linux 原生 Docker 不支援,但目標使用者目前只有 macOS 情境,不是 blocker
