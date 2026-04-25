# Upstream Sync Report: v2.2.26-pre.7 (T0252)

> 研究範圍：`lastSyncCommit = 5d9f486`（已同步到 fork）之後，`upstream/main` 到 `f364e38` 的 **114 個 non-merge commits**。

- **調查日期**：2026-04-25
- **工單**：T0252
- **fork 現況**：`version.json` 已記錄上一輪同步完成（T0165 + PLAN-018）；目前 fork 還有大量 BAT 客製化與本地獨立演進
- **總體建議**：**分流處理**。本輪不建議整包同步；建議先做 3 包低風險 cherry-pick（約 4.5h），其餘切成 3 個獨立 port 計畫。大量 Codex / workspace 類 commit 已被 fork 本地實作部分或完全超前，應直接 skip 留痕。

## 1. 總覽

| 項目 | 值 |
|---|---|
| 新增 non-merge commits | 114 |
| BAT 客製檔案受影響 commits | 73 / 114 |
| Tag 跨度 | `v2.1.46` → `v2.2.26-pre.7` |
| 主要主題 | remote/window scoping、Codex worktree、OpenAI Direct、headless bat-server、packaging/binary、Claude/Codex UX |
| 分類摘要 | `cherry-pick 33` / `port 26` / `skip 55` |
| 風險判斷 | 高。因 BAT 在 `electron/main.ts`、`electron/claude-agent-manager.ts`、`electron/pty-manager.ts`、`src/components/ClaudeAgentPanel.tsx`、`src/components/WorkerPanel.tsx`、`src/components/SettingsPanel.tsx`、remote stack、packaging 均有重度客製化 |

### 1.1 核心結論

1. **Remote / profile / workspace 線值得優先吸收**，但只建議拿低衝突修補；`f364e38` / `e142f1b` 本身已被 fork 的 `bce1987` 部分超前，應標 skip-superseded。
2. **OpenAI Direct 是真實功能增量，但不是 cherry-pick 級別**。它是一條全新的 agent/runtime/tooling 線，建議獨立成 PLAN 做 BAT 適配。
3. **Headless bat-server / server-core 抽離值得跟，但要和 BAT 既有 remote server / helper scripts / packaging 流程一起重整**，不能機械 cherry-pick。
4. **大量 Codex / Claude UX 小修可作為 Phase 1 快速收益**，但只挑和 BAT custom 區塊接觸較少者。
5. **WorkerPanel upstream 已完全走 Procfile 多進程面板**，與 BAT supervisor worker panel 分歧明顯；凡觸及 WorkerPanel 流的 commit 預設 skip 或 port，不列入 cherry-pick。

## 2. Tag 時序表

| Tag | Commit | 日期 | 主題 |
|---|---|---|---|
| `v2.1.46` | `c189dbf` | 2026-04-18 | profile index.json 損壞防資料遺失 |
| `v2.2.0` | `77ad1c0` | 2026-04-19 | remote image preview proxy |
| `v2.2.1` | `7e65c00` | 2026-04-19 | Electron 41 file drag 修補 |
| `v2.2.2` | `cb61342` | 2026-04-19 | `/auto-continue` |
| `v2.2.3` | `4906e9c` | 2026-04-20 | Intel DMG artifactName |
| `v2.2.4` | `7898b6c` | 2026-04-20 | artifactName 位置修正 |
| `v2.2.5` | `ac9ac06` | 2026-04-20 | `claude-code` 2.1.114 |
| `v2.2.6` | `a1ee90d` | 2026-04-20 | `claude-agent-sdk` 0.2.114 |
| `v2.2.7-pre.1` | `89505e8` | 2026-04-20 | Codex agent + worktree flows |
| `v2.2.8` | `fe3def4` | 2026-04-20 | release tag |
| `v2.2.9` | `fe3def4` | 2026-04-20 | release retag |
| `v2.2.10` | `ceeb5c1` | 2026-04-20 | packaged bat-server path 修補 |
| `v2.2.11` | `6114fa8` | 2026-04-20 | Codex native binary Windows 直解 |
| `v2.2.12` | `0b5dae9` | 2026-04-20 | merge tag |
| `v2.2.13-pre.1` | `90dd593` | 2026-04-20 | merge tag |
| `v2.2.14` | `84c46ee` | 2026-04-21 | middle-click autoscroll |
| `v2.2.15-pre.1` | `f7493ca` | 2026-04-21 | worker spotlight |
| `v2.2.15-pre.2` | `600f7ac` | 2026-04-21 | Codex interrupt-on-new-prompt |
| `v2.2.15-pre.3` | `175e85d` | 2026-04-21 | drop bundled codex binary |
| `v2.2.15-pre.4` | `0d6d8a7` | 2026-04-21 | `claude-code` 2.1.116 |
| `v2.2.15-pre.5` | `91fc27a` | 2026-04-22 | claude.exe filename 修補 |
| `v2.2.16` | `b38a023` | 2026-04-22 | codex CLI 用 `--yolo` |
| `v2.2.17` | `91fc27a` | 2026-04-22 | same payload retag |
| `v2.2.18` | `58e7cc9` | 2026-04-23 | OpenAI modelMessages duplicate fix |
| `v2.2.19` | `22146cf` | 2026-04-24 | `claude-code` 2.1.119 |
| `v2.2.20` | `4e76ac5` | 2026-04-24 | merge tag |
| `v2.2.21-pre.1` | `75bfedb` | 2026-04-24 | merge tag |
| `v2.2.21` | `75bfedb` | 2026-04-24 | merge tag |
| `v2.2.22-pre.1` | `c5b32a6` | 2026-04-24 | merge tag |
| `v2.2.22` | `c5b32a6` | 2026-04-24 | merge tag |
| `v2.2.23-pre.1` | `1666314` | 2026-04-24 | merge tag |
| `v2.2.23` | `1666314` | 2026-04-24 | merge tag |
| `v2.2.24-pre.1` | `150fccb` | 2026-04-24 | merge tag |
| `v2.2.24-pre.2` | `c9b85c2` | 2026-04-24 | merge tag |
| `v2.2.25` | `e62a429` | 2026-04-24 | Codex binary resolve/hint |
| `v2.2.26-pre.1` | `b50e9ac` | 2026-04-24 | OpenAI Direct Windows bash |
| `v2.2.26-pre.2` | `8b43e3d` | 2026-04-24 | Codex interrupt queue fix |
| `v2.2.26-pre.3` | `76b7e91` | 2026-04-24 | show Codex tool calls |
| `v2.2.26-pre.4` | `47f6238` | 2026-04-24 | Codex tool output + plan approval |
| `v2.2.26-pre.5` | `800797e` | 2026-04-25 | Codex worktree preset |
| `v2.2.26-pre.6` | `2a3c4d5` | 2026-04-25 | remote client status scope |
| `v2.2.26-pre.7` | `f364e38` | 2026-04-25 | active workspace preserve on remote reload |

## 3. 分類摘要

| 類別 | 數量 | 判準 |
|---|---|---|
| `cherry-pick` | 33 | 可獨立落地、與 BAT custom 區塊接觸少、或 fork 現況已證明相容 |
| `port` | 26 | 值得跟，但牽涉 BAT 客製檔 / 架構差異 / 多檔聯動 |
| `skip` | 55 | fork 已搶先、同功能已本地實作、方向不合、release/deps 噪音、或 WorkerPanel/packaging 架構衝突 |

### 3.1 建議 Phase 結構

| Phase | 範圍 | 估時 |
|---|---|---|
| Phase 1 | 3 包 cherry-pick | ~4.5h |
| Phase 2A | OpenAI Direct port | ~12-16h |
| Phase 2B | headless server-core / bat-server port | ~8-12h |
| Phase 2C | Codex/Claude BAT reconciliation | ~8-10h |
| Phase 3 | skip 留檔 | 0h |

## 4. 逐 Commit 分析

> 註：
> - `⚠️ BAT-CUSTOM` 表示觸及工單要求的 BAT 客製檔。
> - `ETA` 只在 `cherry-pick/port` 有意義；`skip` 記 `-`。

### 4.1 批次 A：v2.2.26-pre.7 回推到 remote / Codex 新一輪收尾

| Hash | Subject | 類別 | 風險 | ETA | 判斷 |
|---|---|---|---|---|---|
| `f364e38` | Preserve active workspace on remote reloads | skip | 低 | - | fork `bce1987` 已本地實作 workspace reload 保存語意，屬 superseded |
| `2a3c4d5` | Scope remote client status to profile windows | cherry-pick | 中 | 0.4h | `⚠️ BAT-CUSTOM electron/main.ts`；小修補且方向與 BAT remote model 一致 |
| `d455e23` | Handle image-only Codex prompts | cherry-pick | 低 | 0.3h | 只碰 `electron/codex-agent-manager.ts`，收益明確 |
| `e86891b` | Reuse existing Codex worktree directories | skip | 低 | - | fork `5aeeb42` 已自行處理 worktree support，需以 fork 實作為主 |
| `77812f2` | Handle Codex worktree cwd rehydration | skip | 低 | - | 同上，fork 已有獨立 worktree 流 |
| `5743c03` | Fix Codex worktree sessions | skip | 中 | - | 上游修的是其 worktree session model；fork 已另行演化，直接套風險高 |
| `999de5c` | Refactor Codex agent internals | port | 高 | 4h | 大規模 manager/refactor，不適合直 cherry-pick |
| `aff737f` | Fix agent message and history handling | port | 高 | 2h | `⚠️ BAT-CUSTOM`；同時碰 Claude/Codex/remote protocol，價值高但需 reconcile |
| `800797e` | Add Codex Agent worktree preset | skip | 低 | - | fork 既有 agent registry / preset 已獨立實作 |
| `9366b01` | Make agent user messages host authoritative | port | 高 | 1.5h | `⚠️ BAT-CUSTOM`；跟 fork 本地 workspace reload/message handling 交錯 |
| `b015442` | Fix agent output auto-scroll follow state | cherry-pick | 中 | 0.4h | `⚠️ BAT-CUSTOM src/components/ClaudeAgentPanel.tsx`；局部 UI bugfix |
| `1bd029b` | Gate OpenAI Direct settings behind debug | skip | 低 | - | fork 尚未引入 OpenAI Direct，先不需要 debug gate |
| `e142f1b` | Fix remote workspace reload sync | skip | 中 | - | fork `bce1987` 已局部超前，保留報告但不重複導入 |
| `877063f` | Support mobile remote window context | port | 中 | 1.5h | `⚠️ BAT-CUSTOM`；與 BAT mobile/remote window context 一致，但需接 BAT server stack |
| `47f6238` | Improve Codex tool output display and plan approval | port | 高 | 2h | 涉及 Codex/OpenAI panel 與 tool plan rendering；功能好但需 BAT UI 適配 |
| `c50587c` | Respect host worker state for remote Procfile panels | skip | 極高 | - | `⚠️ BAT-CUSTOM src/components/WorkerPanel.tsx`；upstream Procfile panel 與 BAT supervisor panel 架構不合 |
| `76b7e91` | Show Codex response item tool calls | port | 中 | 1h | manager-only 但需比對 fork 當前 response-items 流 |
| `711dad4` | Improve OpenAI Direct UX and worker cleanup | port | 高 | 2h | `⚠️ BAT-CUSTOM`；有 WorkerPanel 碰撞，只能跟隨 OpenAI Direct port 包一起做 |
| `8b43e3d` | start new turn immediately on interrupt | cherry-pick | 低 | 0.3h | Codex turn queue 修補，邏輯獨立 |
| `b50e9ac` | Fix OpenAI Direct bash execution on Windows | port | 中 | 0.5h | 依賴 OpenAI Direct 存在；列入該 port 包 |
| `b61ef63` | Improve OpenAI Direct agent planning | port | 高 | 2.5h | 新增 `diff/plan/todo` tools，價值高但屬獨立子系統 |
| `a383bc9` | add gpt-5.5 to OpenAI model list | skip | 低 | - | fork Codex 已預設 `gpt-5.5`；僅 OpenAI Direct 模型表增量，待 port 時自然吸收 |
| `542f704` | strip previous wrapper before re-wrapping interrupted prompt | port | 中 | 0.8h | `⚠️ BAT-CUSTOM electron/claude-agent-manager.ts`；有價值但需手併 |
| `c3c582c` | Harden remote service boundaries | port | 高 | 2h | `⚠️ BAT-CUSTOM`；remote/profile/server-core 邊界加固，值得做但非快補 |

### 4.2 批次 B：OpenAI Direct 啟動 + binary / build / CLI 流

| Hash | Subject | 類別 | 風險 | ETA | 判斷 |
|---|---|---|---|---|---|
| `e62a429` | resolve codex binary robustly and hint on model-not-found | skip | 低 | - | fork 已有 `42b45b0/4894b18/058412a` runtime/binary resolver 線 |
| `d0312e3` | always show model selector button for codex sessions | cherry-pick | 低 | 0.2h | Codex UX 小修，基本無副作用 |
| `7ecd817` | add GPT-5.5 and 5.4 family to codex model list | skip | 低 | - | fork 現況已含 `gpt-5.5`，屬 superseded |
| `561734b` | defer electron imports so bat-server runs under ELECTRON_RUN_AS_NODE | cherry-pick | 低 | 0.5h | 若後續導 headless/server-cli，此修補可先拿 |
| `870cb23` | dedup native binary by routing SDK through pathToClaudeCodeExecutable | skip | 中 | - | BAT 已走自己的 binary resolver；另有 helper bundle 驗證腳本 |
| `60944d1` | include platform-specific native binary packages in installer | skip | 低 | - | BAT 已有更寬鬆 `asarUnpack` 與 fail-fast 驗證 |
| `8d93986` | update claude-agent-sdk to 0.2.119 | skip | 低 | - | 純版本 bump，應等下一輪整體依賴策略處理 |
| `22146cf` | update claude-code to 2.1.119 | skip | 低 | - | 同上 |
| `58e7cc9` | avoid duplicate user message when rebuilding modelMessages | port | 中 | 0.5h | 依賴 OpenAI Direct manager 存在，跟隨其 port 包 |
| `7bd9845` | gate OpenAI Direct preset behind BAT_DEBUG | skip | 低 | - | 沒有 OpenAI Direct 主體前不採納 |
| `c7b9639` | add debug fetch logger | skip | 低 | - | debug 噪音，不值單獨導入 |
| `bfd2b22` | Chat Completions for Codex OAuth + preload duplicate shell fix | port | 中 | 1h | `⚠️ BAT-CUSTOM electron/preload.ts`；OpenAI Direct 子修補 |
| `2679621` | cross-turn memory, image resize, tool input fix | port | 高 | 2h | `⚠️ BAT-CUSTOM`；OpenAI Direct 大幅強化，值得但非快補 |
| `8b7189a` | support Codex OAuth via ChatGPT backend API | port | 高 | 1.5h | `⚠️ BAT-CUSTOM`；屬 OpenAI Direct 身分驗證路徑 |
| `f960c33` | fallback to OPENAI_API_KEY env var | port | 低 | 0.3h | OpenAI Direct 隨包吸收 |
| `e765507` | add OpenAI-native agent session using Vercel AI SDK | port | 高 | 8h | 全新子系統；需獨立 PLAN |
| `91fc27a` | resolve claude.exe filename on all platforms | skip | 低 | - | fork `42b45b0` 已解同類問題 |
| `b38a023` | use --yolo instead of --sandbox danger-full-access | skip | 低 | - | fork Codex runtime 已有本地策略；不急著追此小差異 |
| `56948c3` | skip git repo check to run in arbitrary directories | cherry-pick | 低 | 0.3h | `⚠️ BAT-CUSTOM remote/protocol/settings-store`；可改善非 repo 場景 |
| `0d6d8a7` | bump claude-code 2.1.116 | skip | 低 | - | 版本 bump 保留 |
| `175e85d` | drop bundled codex binary; require user install | skip | 中 | - | BAT 打包策略與 helper bundle 不同，不跟 |
| `600f7ac` | interrupt running turn on new prompt | cherry-pick | 低 | 0.4h | Codex session 體驗改善，隔離度高 |
| `52005a0` | exclude unused claude-agent-sdk platform packages | skip | 低 | - | BAT 已有自家打包/驗證邏輯 |
| `96239db` | exclude duplicate claude-code platform packages | skip | 低 | - | 同上 |
| `9d5750f` | externalize claude-agent-sdk to avoid fileURLToPath(undefined) | skip | 中 | - | BAT 現 build 鏈與 upstream 不同，應整包看 vite/builder 策略時再處理 |
| `110b30b` | docs: add /auto-continue guide | skip | 低 | - | docs-only |

### 4.3 批次 C：settings / workspace / Claude/Codex UX 中段

| Hash | Subject | 類別 | 風險 | ETA | 判斷 |
|---|---|---|---|---|---|
| `139c18d` | reorganize settings into General / Agent / Remote / Advanced tabs | skip | 高 | - | `⚠️ BAT-CUSTOM src/components/SettingsPanel.tsx`；fork 已自行大改 Settings |
| `68e0a50` | persist last focused terminal per workspace and FileTree scroll position | cherry-pick | 中 | 0.7h | `⚠️ BAT-CUSTOM src/types/index.ts`；對 BAT workspace UX 有實益 |
| `f7493ca` | worker spotlight mode | skip | 極高 | - | `⚠️ BAT-CUSTOM WorkerPanel` 架構不相容 |
| `45f9165` | implement listSessions from ~/.codex/sessions | skip | 低 | - | fork 已有 listSessions 能力 |
| `84c46ee` | restore native middle-click autoscroll in messages | cherry-pick | 低 | 0.3h | `⚠️ BAT-CUSTOM ClaudeAgentPanel`；純 UX bugfix |
| `5849890` | make git/gh handlers async to prevent bat-server freeze | cherry-pick | 低 | 0.4h | server handler 單點修補，收益明確 |
| `282eb81` | route chat file links through FilePreviewModal | cherry-pick | 中 | 0.5h | `⚠️ BAT-CUSTOM electron/main.ts + ClaudeAgentPanel`；獨立可驗證 |
| `5a7dcf8` | add claude:turn-end event and fix Codex SDK field coverage | port | 中 | 1h | `⚠️ BAT-CUSTOM`；跨 manager/preload/protocol |
| `97aa275` | render tool calls that only emit item.completed | cherry-pick | 低 | 0.3h | Codex tool call 完整性修補 |
| `ab0a867` | resolve relative markdown links against session cwd | cherry-pick | 低 | 0.3h | `⚠️ BAT-CUSTOM ClaudeAgentPanel`；收益大、風險小 |
| `1f6fe0d` | forward pasted images to Codex SDK as local_image inputs | cherry-pick | 低 | 0.4h | Codex image workflow改進 |
| `15fe760` | preserve worktree banner across /new session reset | cherry-pick | 低 | 0.3h | `⚠️ BAT-CUSTOM ClaudeAgentPanel`；小修可拿 |
| `2174fa0` | add manual Procfile reload button | skip | 極高 | - | `⚠️ BAT-CUSTOM WorkerPanel`；Procfile 流不適用 |
| `56671cb` | make /abort and double-Esc force-unstick stalled sessions | cherry-pick | 低 | 0.4h | Codex stuck-session recovery 有價值 |
| `ac40ecf` | apply sandbox/approval/model/effort changes live and on resume | port | 高 | 1.5h | `⚠️ BAT-CUSTOM preload + settings-state`；值得但跨 UI/manager |
| `2867f77` | show unreachable dialog with 6s timeout and local fallback | cherry-pick | 中 | 0.6h | `⚠️ BAT-CUSTOM electron/main.ts`；可大幅改善 remote failure UX |
| `6114fa8` | resolve native binary directly on Windows | skip | 低 | - | BAT 已先行修正 |
| `750a11e` | native binary support on Windows + libc-aware Linux selection | skip | 中 | - | BAT 已有自己的 resolver 線 |
| `0330e94` | increase idle timeout from 120s to 300s | cherry-pick | 低 | 0.2h | Codex 空閒逾時上調可直接拿 |
| `220b093` | open external links in system browser | cherry-pick | 低 | 0.3h | `⚠️ BAT-CUSTOM`；通用 UX 修補 |

### 4.4 批次 D：Codex 上線期 / early remote / packaging / FolderPicker

| Hash | Subject | 類別 | 風險 | ETA | 判斷 |
|---|---|---|---|---|---|
| `ceeb5c1` | resolve server-cli.js path in packaged app | cherry-pick | 低 | 0.3h | 若導 server-cli，此修補先拿無害 |
| `fe3def4` | chore(release): v2.2.8 | skip | 低 | - | release-only |
| `ae38cff` | Refine session preview labels | skip | 低 | - | 純文案/輕 UX，不列優先 |
| `04409ff` | standalone CodexAgentPanel and session log recovery | skip | 中 | - | fork 已有 Codex panel 本地演進 |
| `4e39cba` | middle-click pan + agent terminal title persistence | cherry-pick | 低 | 0.4h | Thumbnail/title 小修，與 BAT 相容度高 |
| `71879d1` | split mac build into arm64/x64 and extend Chocolatey gate date | skip | 低 | - | BAT 早已自訂 dual-arch / CI 流 |
| `68f31d5` | Refine terminal naming and Codex runtime logging | skip | 中 | - | `⚠️ BAT-CUSTOM`；fork 對 terminal naming/logging 已重寫 |
| `231674e` | highlight scrollbar in claude messages area | skip | 低 | - | 純視覺，優先度低 |
| `5ff30d6` | add context menu to close window and middle-click horizontal pan | cherry-pick | 低 | 0.4h | `⚠️ BAT-CUSTOM ClaudeAgentPanel`；可單獨驗證 |
| `89505e8` | add codex agent and worktree terminal flows | skip | 高 | - | `⚠️ BAT-CUSTOM`；fork `5aeeb42/fc4cd33/3abfb98` 已自行超前 |
| `1b2cd13` | expand ~ to home directory in fs:list-dirs | cherry-pick | 低 | 0.2h | FolderPicker 小修，可跟 port 包或單獨拿 |
| `561c047` | rename codex-cli preset to codex-agent | skip | 低 | - | fork 已採 `codex-agent`，屬 superseded |
| `2269bbd` | simplify Homebrew install | skip | 低 | - | docs-only |
| `a1ee90d` | bump claude-agent-sdk to 0.2.114 | skip | 低 | - | 版本 bump |
| `ac9ac06` | bump claude-code to 2.1.114 | skip | 低 | - | 版本 bump |
| `7898b6c` | move artifactName to dmg section | skip | 低 | - | BAT 已修過相同 build 問題 |
| `4906e9c` | add artifactName to force -x64 suffix on Intel DMG | skip | 低 | - | BAT 已修過相同 build 問題 |
| `cb61342` | /auto-continue slash command + shorten fork button label | skip | 低 | - | fork 已具 `/auto-continue` |
| `7e65c00` | use webUtils.getPathForFile for dropped files | cherry-pick | 中 | 0.5h | `⚠️ BAT-CUSTOM preload + ClaudeAgentPanel`；Electron 41 相容修補 |
| `77ad1c0` | proxy image:read-as-data-url so previews resolve remotely | cherry-pick | 中 | 0.5h | `⚠️ BAT-CUSTOM remote/protocol`；建議列 Phase 1 |
| `a6c8ffd` | refresh account info when account is switched | cherry-pick | 低 | 0.3h | `⚠️ BAT-CUSTOM ClaudeAgentPanel`；有益且局部 |
| `32aa1b5` | scope IPC + event broadcasts per-window profile | cherry-pick | 中 | 0.8h | `⚠️ BAT-CUSTOM electron/main.ts + ProfilePanel`；remote 正確性關鍵修補 |
| `47a0f7f` | build mac as separate arm64 + x64 DMGs | skip | 低 | - | BAT 已做 |
| `256ceea` | notarize must be boolean in electron-builder 26 | skip | 低 | - | BAT 已做 |
| `18e1abf` | preserve whitespace inside code blocks | cherry-pick | 低 | 0.2h | `⚠️ BAT-CUSTOM ClaudeAgentPanel`；簡單可驗證 |
| `08564e1` | one-shot connection URL for paste-to-create profiles | port | 中 | 1.5h | `⚠️ BAT-CUSTOM ProfilePanel/SettingsPanel`；值得做但牽涉 remote UX |
| `6aa31d6` | bat-server CLI wrappers for Windows/macOS/Linux | port | 高 | 2h | `⚠️ BAT-CUSTOM package.json`；跟 headless CLI 同包處理 |
| `bf00d05` | upgrade electron 28→41, vite 5→8, electron-builder 24→26 | skip | 中 | - | fork 已完成 41/26/7 升級，僅 vite8 差異，不為本輪目標 |
| `1c53505` | resolve claude-code native binary after v2.1.113 layout change | skip | 低 | - | fork 已有本地修補 |
| `815a59a` | update in-range packages and drop deprecated @types/dompurify | skip | 低 | - | 依賴噪音 |
| `29bc1f5` | in-app FolderPicker with remote support and quick locations | port | 高 | 4h | `⚠️ BAT-CUSTOM App/FolderPicker/preload/protocol`；功能好但面積大 |

### 4.5 批次 E：base 區段，remote/profile/server-core/perf

| Hash | Subject | 類別 | 風險 | ETA | 判斷 |
|---|---|---|---|---|---|
| `e9ecced` | show correct running state per profile when remote is connected | cherry-pick | 中 | 0.4h | `⚠️ BAT-CUSTOM`；可與 remote polish 同包 |
| `b918f20` | update contextWindow label immediately on model switch | cherry-pick | 低 | 0.2h | `⚠️ BAT-CUSTOM claude-agent-manager`；小修 |
| `b872049` | wait for result before aborting so transcript persists | cherry-pick | 中 | 0.4h | `⚠️ BAT-CUSTOM claude-agent-manager`；提升 transcript 完整性 |
| `0d8da13` | add rewind-to-prompt in prompt history dialog | port | 高 | 1.5h | `⚠️ BAT-CUSTOM`；功能佳但涉及 Claude panel / manager / preload |
| `ec2e7e9` | auto-migrate data from legacy directory | skip | 低 | - | fork 已有自己的 data dir 與版本管理 |
| `fb2283e` | add headless bat-server entry point | port | 高 | 3h | `⚠️ BAT-CUSTOM package/vite/server-cli`；值得做 |
| `742c7e3` | extract proxied handlers into register-handlers | port | 高 | 2.5h | `⚠️ BAT-CUSTOM electron/main.ts`；是 headless/server-core 重構前提 |
| `48afd39` | inject electron deps for headless reuse | port | 高 | 2.5h | `⚠️ BAT-CUSTOM claude/pty/snippet/secrets/main`；大面積重構 |
| `c189dbf` | prevent silent data loss when index.json read fails | cherry-pick | 低 | 0.3h | profile 層面硬化，可直接拿 |
| `693603f` | auto-hide plan badge 10 minutes after ExitPlanMode | cherry-pick | 低 | 0.2h | `⚠️ BAT-CUSTOM ClaudeAgentPanel`；純 UX |
| `92c4dec` | use PowerShell-compatible launch on Windows | skip | 極高 | - | `⚠️ BAT-CUSTOM WorkerPanel`；Procfile 啟動邏輯不適用 BAT supervisor |
| `458d14e` | coalesce PTY output, cache markdown, tighten archive + listeners | skip | 高 | - | `⚠️ BAT-CUSTOM`；可拆子議題，但整 commit 不建議直接導入 |
| `b3032ce` | harden macOS keychain CLI invocation | skip | 低 | - | fork 無 `account-manager.ts` |

## 5. 重大 Port 包的關鍵 Diff 預覽

### 5.1 OpenAI Direct（`e765507` 起）

- 新檔：`electron/openai-agent-manager.ts`
- 新檔：`electron/openai-tools/*`
- UI：`src/components/OpenAIAgentPanel.tsx`
- 接線：`electron/main.ts`、`electron/preload.ts`、`electron/server-core/register-handlers.ts`

判斷：這不是「加一個 preset」而已，而是完整第三條 agent runtime。BAT 若要跟，應以 **新功能線 port** 看待，而不是逐 commit 零敲碎打。

### 5.2 Headless bat-server / server-core（`48afd39` + `742c7e3` + `fb2283e` + `6aa31d6`）

- 抽出 `server-core` provider
- 把 handler registration 從 `main.ts` 抽到 `register-handlers.ts`
- 新增 `electron/server-cli.ts`
- 新增 `bin/bat-server.js/.cmd/.sh`

判斷：方向正確，且與 BAT remote 使用情境吻合；但 BAT 已有 helper scripts、extraResources、verify scripts、remote hardening，必須做為 **重構型 port**。

### 5.3 FolderPicker / Remote UX（`29bc1f5` + `08564e1`）

- 以 proxied fs IPC 取代原生 folder dialog
- Remote profile 可直接從 URL 貼上建立

判斷：使用者價值高，但 UI 面積大，建議和 Settings/ProfilePanel 的 BAT custom 一起做。

## 6. 建議 Phase 規劃

### 6.1 Phase 1：建議先做的 cherry-pick 包

| 包 | 內容 | 估時 | 理由 |
|---|---|---|---|
| C1 Remote/Profile polish | `77ad1c0` `32aa1b5` `2a3c4d5` `2867f77` `e9ecced` `c189dbf` | ~1.8h | 修 remote preview、per-window scoping、status scope、unreachable fallback、profile state correctness |
| C2 Codex robustness | `d455e23` `8b43e3d` `d0312e3` `97aa275` `1f6fe0d` `56671cb` `0330e94` | ~1.4h | 純 Codex 使用體驗與穩定性，風險最低 |
| C3 Claude/Codex UX polish | `84c46ee` `282eb81` `ab0a867` `15fe760` `220b093` `18e1abf` `b918f20` `b872049` | ~1.3h | 小而確定的 UI/轉錄修補，能快速產生可見收益 |

**Phase 1 總計**：~4.5h

### 6.2 Phase 2：建議獨立開 PLAN 的移植包

| 建議 PLAN | 範圍 | Commit 主體 | 估時 |
|---|---|---|---|
| `PLAN-030` | OpenAI Direct agent port | `e765507` + `8b7189a` + `2679621` + `bfd2b22` + `58e7cc9` + `b61ef63` + `b50e9ac` 等 | 12-16h |
| `PLAN-031` | headless bat-server / server-core refactor | `48afd39` + `742c7e3` + `fb2283e` + `6aa31d6` + `561734b` + `ceeb5c1` + `c3c582c` | 8-12h |
| `PLAN-032` | Codex/Claude BAT reconciliation | `999de5c` + `aff737f` + `9366b01` + `47f6238` + `76b7e91` + `5a7dcf8` + `542f704` + `0d8da13` + `ac40ecf` | 8-10h |

## 7. 下一步選項

- **A**：直接派 Phase 1 三包實作工單，先拿 ~4.5h 的低風險收益。**推薦**
- **B**：只做 C1 Remote/Profile polish，先把 remote 線穩住。
- **C**：先開 `PLAN-030` 研究/實作 OpenAI Direct，再回頭補 Phase 1。
- **D**：全部暫緩，只留報告，等 fork 本地 Codex/workspace 線穩定後再重審。

## 8. Phase 3 Skip 清單

| 類型 | 代表 commits | skip 理由 |
|---|---|---|
| fork 已超前 / 已同功能 | `f364e38` `e142f1b` `89505e8` `561c047` `7ecd817` `45f9165` `6114fa8` `91fc27a` | fork 本地已有等價或更貼 BAT 的實作 |
| WorkerPanel 架構衝突 | `c50587c` `f7493ca` `2174fa0` `92c4dec` | upstream Procfile panel 不適用 BAT supervisor panel |
| packaging/release 噪音 | `fe3def4` `71879d1` `4906e9c` `7898b6c` `47a0f7f` `256ceea` | fork 已自行處理或只是 release tag |
| 依賴版本 bump | `a1ee90d` `ac9ac06` `0d6d8a7` `8d93986` `22146cf` `815a59a` | 不建議脫離功能脈絡單獨同步 |
| 不適用模組 | `b3032ce` | fork 無 `account-manager.ts` |
| 風險過高 perf 整包 | `458d14e` | 建議若要跟，拆成 snippet-db / TerminalPanel / markdown cache 三個子議題重審 |

## 9. 學習候選

- **L0101 候選**：當 upstream 在 7 天內高速堆疊 100+ commits 時，最佳同步策略不是「逐 tag 追」，而是先把 commits 分成 `superseded / low-risk cherry-pick / architectural port` 三層，再以 fork 現況倒推。否則會把大量已本地超前或不適用的 commit 誤判成必跟。

