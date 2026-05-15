<claude-mem-context>
# Memory Context

# [_ct-workorders] recent context, 2026-05-15 11:38am GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (23,052t read) | 2,376,921t work | 99% savings

### May 4, 2026
S6161 T0612 CoopID/SSO Build Warnings Cleanup (NuGet vulnerabilities + backend NU1510 + frontend ESLint cleanup) (May 4, 4:29 AM)
S6166 T0613 CoopCRM build warnings cleanup execution with cross-product line validation (May 4, 4:39 AM)
S6169 Control Tower task T0614 state hygiene execution - archival, snapshot rotation, and index rebuilding (May 4, 4:53 AM)
S6163 Execute T0613 CoopCRM build warnings cleanup following T0611/T0612 template pattern (May 4, 4:53 AM)
S6374 Task T0673: Full-scan audit of CRM frontend codebase for design token violations and component adoption gaps, generating comprehensive violation report with Top-15 prioritized remediation targets for PLAN-039 decision (May 4, 5:07 AM)
### May 5, 2026
14931 12:13p 🔵 MSYS2 Path Translation Breaks Python File Access on Windows
14932 12:14p ⚖️ cygpath Utility Resolves MSYS2-Python Path Translation
14933 " 🔵 Design Token Violation Patterns: CSS Variables, Inline Spacing, Element UI Colors
14935 " 🟣 CRM Visual Violations Audit Report Generated with 3,419 Violations Catalogued
14934 12:15p 🔵 Design Token Violations Follow Pareto Distribution: Top 20% Files Contain 66% of Violations
14936 12:18p 🟣 Task T0673 Completed: CRM Visual Violations Audit Committed with 558 Lines
S6376 Execute T0674 workorder: CRM visual violations hotfix for top-15 high-ROI files (May 5, 12:18 PM)
14938 12:19p 🔵 Design token documentation exists but CSS variables not implemented
S7018 Observer session monitoring T0902 workorder execution - Round 3 smoke testing on DevIIS database with comprehensive reporting and bug discovery (May 5, 12:19 PM)
14940 12:31p 🔵 Design Token Registry Gap: Spec Delivered Without Implementation
14942 12:32p 🔵 Current Token Registry State Confirmed: Nearly Empty var.scss
14943 " 🟣 Complete --coop-* Design Token Registry Implemented
14944 12:35p 🔵 T0668 specification gap - token registry implementation missing
### May 7, 2026
15268 3:38a 🔴 BUG-020 fixed via operational convention R-017 for BAT dispatch judgment
15276 3:48a 🔵 T0732 dead import cleanup blocked — NuGet.ProjectModel required for FileFormatException
15312 4:17a 🔴 Dialer audit test transitive vulnerability eliminated
15314 4:22a 🔴 SSO dashboard stylelint warnings eliminated via design token migration
### May 11, 2026
15899 5:06p 🔵 DevIIS database missing __EFMigrationsHistory table
15900 5:08p 🔵 DevIIS schema present but migrations table missing
15901 " ✅ DemoSeeder build succeeded with expected obsolete API warnings
15902 " 🔴 Unit tests passed but dry-run failed with DI configuration error
15903 " 🔵 Dry-run failure root cause: DbContext registered before dry-run check
15904 5:09p 🔵 AddSeederDbContext DI wiring bug confirmed even with valid connection string
15905 " 🔵 Root cause identified: EF Core AddDbContext requires provider configuration
15907 " 🔵 Type mismatch confirmed: SeederDbContext and MainDbContext both use same generic parameter
15906 5:10p 🔵 Bug introduced in T0899 commit bc26513c just hours before T0902 smoke test
15908 5:11p 🔴 BUG-026 fix applied: rewired AddSeederDbContext DI registration to use parent-typed DbContextOptions
S7020 Observer session monitoring T0903 batch bugfix completion (BUG-022/023/026/027) (May 11, 5:11 PM)
15910 5:25p ✅ T0903 batch bugfix workorder started - 4 PLAN-071 bugs from T0902 smoke
15911 5:27p 🔵 T0894 int(N) fix pattern identified for BUG-022 TelephonyStage regression
15912 " 🔵 BUG-023 root cause located: ActivitySeeder trusts upstream ActivitySeederInputs, doesn't resolve creator account independently
15913 5:28p 🔴 Fixed FK violation by reordering TelephonyStage before IvrSurveyStage
S7023 T0904 Round 4 smoke testing after T0903 batch fixes - verify 4 BUGs (022/023/026/027) truly fixed and achieve full-green smoke acceptance (May 11, 5:34 PM)
15914 5:40p 🔴 Created missing __EFMigrationsHistory table in coopdialer database
15915 " 🔵 LookupVerifier validates EF Core migration history for schema consistency
15916 5:44p ✅ Manually populated __EFMigrationsHistory with expected migration T0803_CallbackListRuntime
15917 " 🔵 Campaign stage fails on fk_activities_line_groups constraint during ActivitySeeder execution
15918 " 🔵 CampaignStage queries line_groups by business key but table appears empty or missing fixture rows
15919 5:54p 🔵 T0905 workorder location discovered outside expected directory
15920 5:55p 🔵 T0905 retrospective task defines PARTIAL_CARRY_OVER closeout workflow
15921 " 🔵 Decision log format mismatch detected during T0905 retro preparation
15922 5:56p 🔵 D153 and D154 decisions already exist in decision log from T0897
15923 " ⚖️ PLAN-071 Sprint partial closure strategy under YOLO breakpoint
15924 6:03p ⚖️ PLAN-071 PARTIAL_CARRY_OVER closeout and PLAN-072 initiation
S7027 Execute T0905 - PLAN-071 retrospective closeout and transition to PLAN-072 (May 11, 6:03 PM)
15929 7:15p 🔴 BUG-024 IDENTITY_INSERT error verified as FIXED
15930 " 🔴 BUG-025 JSON implicit conversion error verified as FIXED
15931 " 🔵 OPENJSON int(11) type-width issue blocks Campaign downstream stages
15959 9:02p 🔵 EF Core migration baseline drift traced to missing ModelSnapshot (pre-existing, not T0913)
**15975** 10:22p 🔵 **Dialer MainDbContext missing ModelSnapshot confirmed across all migration history**
T0919 research workorder systematically investigated BUG-031 by examining Dialer migration structure, git history, and DbContext configuration. Investigation confirmed missing ModelSnapshot.cs is structural not temporal—no snapshot ever existed post-rename. Dialer uses hybrid migration governance with both EF C# migrations (20251107_CreateEAVCoreTables.cs) and manual SQL scripts (T0803_CallbackListRuntime.sql, T0898_*.sql). MainDbContext dynamically applies provider-specific model configuration through ModelBuilderExtensions.ApplyCoopDialerModel() with SQL Server column type normalization, meaning single snapshot cannot prove both providers clean. Architectural discovery: EF pending-model gate blocked not by drift but by missing baseline reference point since bfb6e5d8 project rename.
~408t 🔍 110,721

15976 " ⚖️ BUG-031 fix path A baseline reset recommended with SQL Server authority constraint
**15979** 10:35p 🔵 **CRM ModelSnapshot health: bounded drift + provider tooling incompatibility**
T0920 research workorder scanned CRM and SSO MainDbContext ModelSnapshot health following T0919's discovery that Dialer was missing its snapshot. CRM investigation revealed two separate issues: (1) the DesignTimeDbContextFactory defaults to MariaDB provider which is incompatible with current package versions, blocking standard EF CLI health checks without environment variable override, and (2) when forcing SQL Server provider the tool reports pending model changes, indicating the snapshot exists but current model metadata has drifted since the last migration. This bounded drift differs fundamentally from Dialer's missing-snapshot scenario. Recommendation is to handle CRM via separate small workorder: first fix or quarantine default MariaDB design-time provider path, then reconcile SQL Server pending model drift.
~434t 🔍 119,521

**15980** " 🔵 **SSO ModelSnapshot health: clean with no drift**
T0920 research workorder confirmed SSO CoopIdContext has healthy ModelSnapshot with no drift. Running has-pending-model-changes returned clean status indicating the snapshot matches current model. SSO uses pure EF migrations without manual SQL migration files, showing simpler migration governance than CRM. SSO does not share Dialer's missing-snapshot root cause and does not need the T0919 Dialer baseline reset path. No action required for PLAN-074.
~288t 🔍 119,521

**15981** " ⚖️ **PLAN-074 scope recommendation: keep BUG-031 baseline reset Dialer-only**
T0920 research concluded that PLAN-074 BUG-031 baseline reset should remain scoped to Dialer only because CRM and SSO do not exhibit the same missing-snapshot failure mode. CRM's issues are: (1) bounded model drift requiring reconciliation migration and (2) design-time provider tooling incompatibility requiring either Pomelo upgrade to match EF Core 10 or changing CRM design-time default to SQL Server path. SSO requires no action. Recommendation is to track CRM issues separately via small/medium research-or-fix workorder rather than expanding BUG-031 baseline reset scope to all product lines, because the root failure modes differ.
~343t ⚖️ 119,521

**15990** 11:02p 🔵 **BUG-031 baseline reset blocked by 31-table synthetic migration**
T0924 executed PLAN-074 BUG-031 baseline reset path A for CoopDialer MainDbContext missing ModelSnapshot. Worker installed dotnet-ef 9.0.15, verified DevIIS SQL Server environment (DOTNET_ENVIRONMENT=DevIIS), and attempted to scaffold InitialSnapshotBaseline migration. EF Core 9.0.15 generated a massive synthetic migration with 31 CreateTable and 31 DropTable operations, indicating that without a ModelSnapshot, EF treats the entire current model as needing creation. This triggered the workorder's explicit safety guardrail: "若產出大型 synthetic migration，表示 DevIIS DB 與 current model drift 超出 baseline reset 假設範圍 → 立即停止 + 回塔台決策". Worker correctly halted, removed the unsafe files, updated workorder to PARTIAL status with detailed findings, committed (c0ad6d4d), and notified tower via YOLO mode. Suggested tower decision paths: (A) schema compare research, (B) authorize no-op with D decision, (C) SQL Server-only provider baseline policy. This discovery confirms BUG-031 cannot be resolved by simply adding missing files—requires schema equivalence proof first.
~469t 🔍 139,322


Access 2377k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>