/**
 * T0409 (PLAN-037 C): install / update recipes for the remote tools panel.
 *
 * Every command and URL here is a compile-time constant. The remote host only
 * contributes enums (osFamily / pkgManager / privilege / musl); versions, paths and any
 * other string the server reports are never read here, so a tampered or outdated server
 * cannot inject anything into the command typed into the remote terminal (T0407 §6).
 *
 * Strategy (T0407 Q3): user-space first — claude / codex / uv use the vendor install.sh
 * into `~/.local/bin` (no sudo); git / gh / rg use the distro package manager (gh via its
 * signed repo); node uses nvm in `~/.nvm` (no sudo, T0555), with the nvm install script
 * pinned to a release tag.
 */

import {
  REMOTE_OS_FAMILIES,
  REMOTE_PKG_MANAGERS,
  REMOTE_PRIVILEGES,
  REMOTE_TOOL_IDS,
  type RemotePkgManager as PkgManager,
  type RemotePrivilege as Privilege,
  type RemoteToolId,
  type RemoteToolsEnv,
} from '../../types/remote-tools'

/** The only inputs a recipe may depend on. Extra fields on the object passed in are ignored. */
export type RecipeEnv = Pick<RemoteToolsEnv, 'osFamily' | 'pkgManager' | 'privilege' | 'musl'>

/** Hosts any recipe URL (command, script, docs) may point at; guarded by tests. */
export const ALLOWED_URL_HOSTS: readonly string[] = [
  'claude.ai',
  'code.claude.com',
  'chatgpt.com',
  'github.com',
  'cli.github.com',
  'astral.sh',
  'docs.astral.sh',
  'git-scm.com',
  'nodejs.org',
  /** nvm install.sh at a pinned tag (`NVM_VERSION_TAG`); with METHOD=script it fetches nvm.sh from here too. */
  'raw.githubusercontent.com',
]

/**
 * nvm release the node recipe installs (T0555). Pinned: the install script, and the nvm.sh it
 * downloads, come from this tag, never from `master`. Bump deliberately.
 */
export const NVM_VERSION_TAG = 'v0.40.8'

/** i18n keys (flat `remoteTools.*` namespace, T0407 §5) the confirm dialog renders. */
export const INTEGRITY_KEYS = [
  'remoteTools.integrity.claudeManifestSha256',
  'remoteTools.integrity.codexSha256Sums',
  'remoteTools.integrity.uvEmbeddedSha256',
  'remoteTools.integrity.distroRepo',
  'remoteTools.integrity.ghRepoGpg',
  'remoteTools.integrity.homebrew',
  /** nvm install.sh pinned to `NVM_VERSION_TAG`; nvm checks Node.js against nodejs.org SHASUMS256.txt. */
  'remoteTools.integrity.nvmNodeShasums',
] as const
export type IntegrityKey = typeof INTEGRITY_KEYS[number]

export const LOCATION_KEYS = [
  'remoteTools.location.userLocalBin',
  'remoteTools.location.system',
  'remoteTools.location.homebrew',
  'remoteTools.location.nvmDir',
] as const
export type InstallLocationKey = typeof LOCATION_KEYS[number]

export const NOTE_KEYS = [
  /** `~/.profile` only adds `~/.local/bin` at login: already-open tabs need a reopen (T0407 §0). */
  'remoteTools.note.reopenTerminalForPath',
  /** codex install.sh appends a PATH block to the shell profile. */
  'remoteTools.note.codexEditsProfile',
  /** Alpine: claude must use the system rg — set `USE_BUILTIN_RIPGREP=0` in settings.json `env`. */
  'remoteTools.note.alpineUseSystemRipgrep',
  /** RHEL-family repos ship ripgrep in EPEL only. */
  'remoteTools.note.rgNeedsEpel',
  /** In BAT remote terminals background auto-update is off (`DISABLE_AUTOUPDATER=1`). */
  'remoteTools.note.claudeManualUpdate',
  /** nvm install.sh appends its loader to ~/.bashrc (or ~/.zshrc / ~/.profile). */
  'remoteTools.note.nvmEditsProfile',
  /** T0556: a marked nvm loader block in the bash login profile, added once (`bash -lc` sees node). */
  'remoteTools.note.nvmLoginProfile',
  /** A system node (apt / dnf) stays installed; shells that load nvm use nvm's node first. */
  'remoteTools.note.nvmKeepsSystemNode',
  /** Tabs opened before the install have not loaded nvm. */
  'remoteTools.note.nvmReopenTerminal',
  /** Update: newest LTS, global npm packages reinstalled from the old version, default alias moved. */
  'remoteTools.note.nvmUpdateMovesDefault',
] as const
export type RecipeNoteKey = typeof NOTE_KEYS[number]

export const UNSUPPORTED_REASONS = [
  /** No install button for this tool (curl / bash / python3; node on an unknown OS). */
  'no-recipe',
  /** Needs root, but the account is not root and has no sudo. */
  'needs-root-no-sudo',
  /** No supported package manager detected. */
  'no-package-manager',
  /** Only a manual / GUI path exists (macOS git without brew: `xcode-select --install`). */
  'manual-only',
  /** Homebrew refuses to run as root. */
  'brew-as-root',
  /** musl host without apk: the claude runtime dependencies cannot be installed. */
  'musl-without-apk',
  /** musl (Alpine): nodejs.org has no official musl build, so nvm would compile Node.js from source. */
  'node-musl-source-build',
] as const
export type UnsupportedReason = typeof UNSUPPORTED_REASONS[number]

export interface InstallPlan {
  toolId: RemoteToolId
  kind: 'install' | 'update'
  /**
   * The single line typed into the remote terminal (before the completion sentinel).
   * Already includes `prerequisites`, chained with `&&`.
   */
  command: string
  /** Some step runs through sudo; the user may have to type a password in the tab. */
  needsSudo: boolean
  installLocation: InstallLocationKey
  /** Display path for user-space installs, e.g. `~/.local/bin/claude`. */
  installPath?: string
  docsUrl: string
  /** Remote script the command pipes into a shell (shown with a "view script" link). */
  scriptUrl?: string
  /** `scriptUrl` is fixed to a release tag (nvm), not the vendor's moving latest script. */
  scriptPinned?: boolean
  integrity: IntegrityKey
  /** Package is community-maintained, not by the vendor (Alpine gh). */
  unofficial?: boolean
  /** Steps `command` runs first, listed separately for the confirm dialog. */
  prerequisites?: string[]
  notes?: RecipeNoteKey[]
}

export interface UnsupportedPlan {
  unsupported: UnsupportedReason
  /** Where the manual instructions live, when there are any. */
  docsUrl?: string
}

export type RecipeResult = InstallPlan | UnsupportedPlan

export function isInstallPlan(result: RecipeResult): result is InstallPlan {
  return 'command' in result
}

const DOCS = {
  claude: 'https://code.claude.com/docs/en/setup',
  codex: 'https://github.com/openai/codex',
  uv: 'https://docs.astral.sh/uv/getting-started/installation/',
  gitLinux: 'https://git-scm.com/install/linux',
  gitMac: 'https://git-scm.com/install/mac',
  ghLinux: 'https://github.com/cli/cli/blob/trunk/docs/install_linux.md',
  ghGeneral: 'https://github.com/cli/cli#installation',
  rg: 'https://github.com/BurntSushi/ripgrep#installation',
  node: 'https://nodejs.org/en/download',
  nvm: `https://github.com/nvm-sh/nvm/blob/${NVM_VERSION_TAG}/README.md#installing-and-updating`,
} as const

const SCRIPT = {
  claude: 'https://claude.ai/install.sh',
  codex: 'https://chatgpt.com/codex/install.sh',
  uv: 'https://astral.sh/uv/install.sh',
  nvm: `https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION_TAG}/install.sh`,
} as const

const GH_KEYRING_URL = 'https://cli.github.com/packages/githubcli-archive-keyring.gpg'
const GH_APT_REPO_URL = 'https://cli.github.com/packages'
const GH_RPM_REPO_URL = 'https://cli.github.com/packages/rpm/gh-cli.repo'

/** Alpine prerequisites from the Claude Code setup docs (§Alpine). */
const ALPINE_CLAUDE_PACKAGES = 'bash curl libgcc libstdc++ ripgrep'
/** Alpine ships neither bash nor curl; the sh-based installers need curl. */
const ALPINE_CURL_PACKAGES = 'curl'

function assertMember<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw new TypeError(`remote-tools recipe: invalid ${field}`)
  }
  return value as T
}

/**
 * Copies the four enum fields out of an untrusted object, throwing on anything else.
 * The error message never echoes the offending value.
 */
export function normalizeRecipeEnv(env: unknown): RecipeEnv {
  if (typeof env !== 'object' || env === null) throw new TypeError('remote-tools recipe: invalid env')
  const raw = env as Record<string, unknown>
  if (typeof raw.musl !== 'boolean') throw new TypeError('remote-tools recipe: invalid musl')
  return {
    osFamily: assertMember(raw.osFamily, REMOTE_OS_FAMILIES, 'osFamily'),
    pkgManager: assertMember(raw.pkgManager, REMOTE_PKG_MANAGERS, 'pkgManager'),
    privilege: assertMember(raw.privilege, REMOTE_PRIVILEGES, 'privilege'),
    musl: raw.musl,
  }
}

/**
 * Prefix for steps that need root: nothing as root, `sudo ` when sudo exists
 * (passwordless or not — a password prompt is answered in the tab), null without sudo.
 */
function rootPrefix(privilege: Privilege): string | null {
  if (privilege === 'root') return ''
  if (privilege === 'sudo-missing') return null
  return 'sudo '
}

function needsSudoFor(privilege: Privilege): boolean {
  return privilege === 'passwordless' || privilege === 'password-required'
}

/** `<pm> install <pkg>` for the distro package managers (brew handled separately). */
function distroInstall(pkgManager: Exclude<PkgManager, 'brew' | 'none'>, s: string, pkg: string): string {
  switch (pkgManager) {
    case 'apt': return `${s}apt-get update && ${s}apt-get install -y ${pkg}`
    case 'dnf': return `${s}dnf install -y ${pkg}`
    case 'yum': return `${s}yum install -y ${pkg}`
    case 'apk': return `${s}apk add ${pkg}`
  }
}

interface ScriptRecipe {
  toolId: 'claude' | 'codex' | 'uv'
  script: string
  docsUrl: string
  installPath: string
  integrity: IntegrityKey
  /** Packages Alpine needs before the script can run. */
  alpinePackages: string
  notes: RecipeNoteKey[]
  alpineNotes: RecipeNoteKey[]
}

const SCRIPT_RECIPES: Record<ScriptRecipe['toolId'], ScriptRecipe> = {
  claude: {
    toolId: 'claude',
    script: `curl -fsSL ${SCRIPT.claude} | bash -s stable`,
    docsUrl: DOCS.claude,
    installPath: '~/.local/bin/claude',
    integrity: 'remoteTools.integrity.claudeManifestSha256',
    alpinePackages: ALPINE_CLAUDE_PACKAGES,
    notes: ['remoteTools.note.reopenTerminalForPath', 'remoteTools.note.claudeManualUpdate'],
    alpineNotes: ['remoteTools.note.alpineUseSystemRipgrep'],
  },
  codex: {
    toolId: 'codex',
    // install.sh reads `Start Codex now? [y/N]` from /dev/tty, which holds the sentinel until
    // someone answers; CODEX_NON_INTERACTIVE=1 answers No to every prompt (BUG-104).
    script: `curl -fsSL ${SCRIPT.codex} | CODEX_NON_INTERACTIVE=1 sh`,
    docsUrl: DOCS.codex,
    installPath: '~/.local/bin/codex',
    integrity: 'remoteTools.integrity.codexSha256Sums',
    alpinePackages: ALPINE_CURL_PACKAGES,
    notes: ['remoteTools.note.reopenTerminalForPath', 'remoteTools.note.codexEditsProfile'],
    alpineNotes: [],
  },
  uv: {
    toolId: 'uv',
    script: `curl -LsSf ${SCRIPT.uv} | sh`,
    docsUrl: DOCS.uv,
    installPath: '~/.local/bin/uv',
    integrity: 'remoteTools.integrity.uvEmbeddedSha256',
    alpinePackages: ALPINE_CURL_PACKAGES,
    notes: ['remoteTools.note.reopenTerminalForPath'],
    alpineNotes: [],
  },
}

/** User-space install.sh tools: the script itself never needs sudo; only Alpine prerequisites do. */
function scriptPlan(recipe: ScriptRecipe, env: RecipeEnv): RecipeResult {
  const scriptUrl = SCRIPT[recipe.toolId]
  const base = {
    toolId: recipe.toolId,
    kind: 'install' as const,
    installLocation: 'remoteTools.location.userLocalBin' as const,
    installPath: recipe.installPath,
    docsUrl: recipe.docsUrl,
    scriptUrl,
    integrity: recipe.integrity,
  }

  if (env.pkgManager === 'apk') {
    const s = rootPrefix(env.privilege)
    if (s === null) return { unsupported: 'needs-root-no-sudo', docsUrl: recipe.docsUrl }
    const prerequisite = `${s}apk add ${recipe.alpinePackages}`
    return {
      ...base,
      command: `${prerequisite} && ${recipe.script}`,
      needsSudo: needsSudoFor(env.privilege),
      prerequisites: [prerequisite],
      notes: [...recipe.notes, ...recipe.alpineNotes],
    }
  }

  // claude on musl needs libgcc / libstdc++ / rg from the system; only apk is mapped.
  if (env.musl && recipe.toolId === 'claude') {
    return { unsupported: 'musl-without-apk', docsUrl: recipe.docsUrl }
  }

  return { ...base, command: recipe.script, needsSudo: false, notes: [...recipe.notes] }
}

function brewPlan(toolId: RemoteToolId, formula: string, docsUrl: string, env: RecipeEnv): RecipeResult {
  if (env.privilege === 'root') return { unsupported: 'brew-as-root', docsUrl }
  return {
    toolId,
    kind: 'install',
    command: `brew install ${formula}`,
    needsSudo: false,
    installLocation: 'remoteTools.location.homebrew',
    docsUrl,
    integrity: 'remoteTools.integrity.homebrew',
  }
}

function distroPlan(
  toolId: RemoteToolId,
  env: RecipeEnv,
  docsUrl: string,
  build: (s: string, pkgManager: Exclude<PkgManager, 'brew' | 'none'>) => string,
  extra: Partial<Pick<InstallPlan, 'integrity' | 'unofficial' | 'notes'>> = {},
): RecipeResult {
  if (env.pkgManager === 'brew' || env.pkgManager === 'none') throw new Error('distroPlan: not a distro package manager')
  const s = rootPrefix(env.privilege)
  if (s === null) return { unsupported: 'needs-root-no-sudo', docsUrl }
  return {
    toolId,
    kind: 'install',
    command: build(s, env.pkgManager),
    needsSudo: needsSudoFor(env.privilege),
    installLocation: 'remoteTools.location.system',
    docsUrl,
    integrity: 'remoteTools.integrity.distroRepo',
    ...extra,
  }
}

function gitPlan(env: RecipeEnv): RecipeResult {
  if (env.pkgManager === 'brew') return brewPlan('git', 'git', env.osFamily === 'darwin' ? DOCS.gitMac : DOCS.gitLinux, env)
  if (env.pkgManager === 'none') {
    // macOS without brew: `xcode-select --install` opens a GUI dialog — impossible over SSH.
    return env.osFamily === 'darwin'
      ? { unsupported: 'manual-only', docsUrl: DOCS.gitMac }
      : { unsupported: 'no-package-manager', docsUrl: DOCS.gitLinux }
  }
  return distroPlan('git', env, DOCS.gitLinux, (s, pm) => distroInstall(pm, s, 'git'))
}

/** gh's signed apt repo (install_linux.md), with `apt` → `apt-get` and `type -p` → `command -v` for non-bash shells. */
function ghAptCommand(s: string): string {
  return [
    `(command -v wget >/dev/null 2>&1 || (${s}apt-get update && ${s}apt-get install -y wget))`,
    `${s}mkdir -p -m 755 /etc/apt/keyrings`,
    `out=$(mktemp)`,
    `wget -nv -O"$out" ${GH_KEYRING_URL}`,
    `cat "$out" | ${s}tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null`,
    `rm -f "$out"`,
    `${s}chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg`,
    `${s}mkdir -p -m 755 /etc/apt/sources.list.d`,
    `echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] ${GH_APT_REPO_URL} stable main" | ${s}tee /etc/apt/sources.list.d/github-cli.list > /dev/null`,
    `${s}apt-get update`,
    `${s}apt-get install -y gh`,
  ].join(' && ')
}

/**
 * gh's signed rpm repo. `dnf config-manager` syntax differs between dnf4 and dnf5, so the
 * `.repo` file is placed directly — the same file `config-manager --add-repo` would write.
 */
function ghRpmCommand(s: string, pm: 'dnf' | 'yum'): string {
  return `${s}curl -fsSL -o /etc/yum.repos.d/gh-cli.repo ${GH_RPM_REPO_URL} && ${s}${pm} install -y gh`
}

function ghPlan(env: RecipeEnv): RecipeResult {
  if (env.pkgManager === 'brew') return brewPlan('gh', 'gh', DOCS.ghGeneral, env)
  if (env.pkgManager === 'none') return { unsupported: 'no-package-manager', docsUrl: env.osFamily === 'darwin' ? DOCS.ghGeneral : DOCS.ghLinux }
  if (env.pkgManager === 'apk') {
    // Listed under "Community (Unofficial)" in the gh install docs.
    return distroPlan('gh', env, DOCS.ghLinux, (s) => `${s}apk add github-cli`, { unofficial: true })
  }
  return distroPlan('gh', env, DOCS.ghLinux, (s, pm) => (pm === 'apt' ? ghAptCommand(s) : ghRpmCommand(s, pm as 'dnf' | 'yum')), {
    integrity: 'remoteTools.integrity.ghRepoGpg',
  })
}

function rgPlan(env: RecipeEnv): RecipeResult {
  if (env.pkgManager === 'brew') return brewPlan('rg', 'ripgrep', DOCS.rg, env)
  if (env.pkgManager === 'none') return { unsupported: 'no-package-manager', docsUrl: DOCS.rg }
  const notes: RecipeNoteKey[] | undefined = env.pkgManager === 'dnf' || env.pkgManager === 'yum' ? ['remoteTools.note.rgNeedsEpel'] : undefined
  return distroPlan('rg', env, DOCS.rg, (s, pm) => distroInstall(pm, s, 'ripgrep'), notes ? { notes } : {})
}

// ── node via nvm (T0555) ──────────────────────────────────────────────────────

/**
 * Same directory the probe looks in (`${NVM_DIR:-$HOME/.nvm}`). Set before install.sh so it
 * never picks `$XDG_CONFIG_HOME/nvm`, and created because install.sh refuses a missing $NVM_DIR.
 */
const NVM_DIR_SETUP = 'export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"'
/** nvm is a shell function: load it into the tab's shell (sh / bash / zsh / dash all supported). */
const NVM_LOAD = '. "$NVM_DIR/nvm.sh"'
const NVM_DEFAULT_LTS = "nvm alias default 'lts/*'"

/**
 * T0556: the block appended to the bash login profile. nvm puts its own loader at the end of
 * `~/.bashrc`, which the stock Ubuntu `~/.bashrc` never reaches in a non-interactive shell, so a
 * plain `bash -lc` / `sh -lc` (agents, `npx` MCP servers) would not find nvm's node.
 * - POSIX sh: `~/.profile` is also read by `sh -l` (dash) and ksh.
 * - Loads only when `nvm` is not a function yet: an interactive login shell has already loaded it
 *   from `~/.bashrc` (Ubuntu's `~/.profile` sources it first), so it is not loaded twice. For a
 *   function `command -v` prints the bare name; an `nvm` program on PATH (nvm-windows seen from
 *   Git Bash) prints a path and does not count.
 * - `command .`: a syntax error in a dot script ends a non-interactive POSIX shell (dash, bash as
 *   sh); through `command` it only fails the dot. Output is discarded, so a broken or missing
 *   nvm never fails or clutters a login.
 * No single quotes in these lines: they are passed to printf inside single quotes.
 */
export const NVM_PROFILE_MARKER_BEGIN = '# >>> nvm loader for login shells (added by BetterAgentTerminal) >>>'
export const NVM_PROFILE_MARKER_END = '# <<< nvm loader for login shells (added by BetterAgentTerminal) <<<'
export const NVM_PROFILE_SNIPPET_LINES: readonly string[] = [
  NVM_PROFILE_MARKER_BEGIN,
  'export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"',
  'if [ "$(command -v nvm 2>/dev/null)" != nvm ] && [ -s "$NVM_DIR/nvm.sh" ]; then command . "$NVM_DIR/nvm.sh" >/dev/null 2>&1; fi',
  NVM_PROFILE_MARKER_END,
]

/**
 * Appends the block, once, to the file a bash login shell reads: the first of `~/.bash_profile`,
 * `~/.bash_login`, `~/.profile` that exists (bash reads only that one), else a new `~/.profile`.
 * The begin marker already there → no change. Runs in a subshell so `p` / `f` stay out of the tab.
 */
export const NVM_PROFILE_COMMAND = [
  '( p="$HOME/.profile"',
  'for f in "$HOME/.bash_profile" "$HOME/.bash_login"; do if [ -e "$f" ]; then p="$f"; break; fi; done',
  `if grep -qsF '${NVM_PROFILE_MARKER_BEGIN}' "$p"; then echo "nvm loader for login shells already in $p"`,
  `else printf '\\n${NVM_PROFILE_SNIPPET_LINES.map(() => '%s').join('\\n')}\\n' ${NVM_PROFILE_SNIPPET_LINES.map((line) => `'${line}'`).join(' ')} >> "$p" && echo "nvm loader for login shells added to $p"; fi )`,
].join('; ')

/**
 * `METHOD=script`: fetch nvm.sh at the pinned tag with curl instead of `git clone` — no git
 * dependency, and no macOS `/usr/bin/git` stub popping the Command Line Tools dialog.
 */
const NVM_INSTALL_COMMAND = [
  NVM_DIR_SETUP,
  'mkdir -p "$NVM_DIR"',
  `curl -fsSL ${SCRIPT.nvm} | METHOD=script bash`,
  NVM_LOAD,
  'nvm install --lts',
  NVM_DEFAULT_LTS,
  NVM_PROFILE_COMMAND,
].join(' && ')

/**
 * Already on the newest LTS → say so and exit 0 (`--reinstall-packages-from=current` fails with
 * "Can not reinstall packages from the current version"); otherwise install it, bring the global
 * npm packages over and move `default`. The old version stays installed. The login profile block
 * is ensured first (T0556), so a T0555 install gets it from one Update, whatever nodejs.org says.
 */
const NVM_UPDATE_COMMAND = [
  NVM_DIR_SETUP,
  NVM_LOAD,
  NVM_PROFILE_COMMAND,
  `if [ "$(nvm version-remote --lts)" = "$(nvm current)" ]; then echo "Node.js $(nvm current) is already the latest LTS"; else nvm install --lts --reinstall-packages-from=current && ${NVM_DEFAULT_LTS}; fi`,
].join(' && ')

/** Hosts nvm's prebuilt Node.js runs on; null = a plan can be built. */
function nodeUnsupported(env: RecipeEnv): UnsupportedPlan | null {
  if (env.osFamily === 'unknown') return { unsupported: 'no-recipe', docsUrl: DOCS.node }
  // Alpine and other musl hosts: no official binary, nvm falls back to a long source build.
  if (env.musl || env.pkgManager === 'apk') return { unsupported: 'node-musl-source-build', docsUrl: DOCS.node }
  return null
}

function nodeInstallPlan(env: RecipeEnv): RecipeResult {
  return nodeUnsupported(env) ?? {
    toolId: 'node',
    kind: 'install',
    command: NVM_INSTALL_COMMAND,
    needsSudo: false,
    installLocation: 'remoteTools.location.nvmDir',
    installPath: '~/.nvm',
    docsUrl: DOCS.nvm,
    scriptUrl: SCRIPT.nvm,
    scriptPinned: true,
    integrity: 'remoteTools.integrity.nvmNodeShasums',
    notes: ['remoteTools.note.nvmEditsProfile', 'remoteTools.note.nvmLoginProfile', 'remoteTools.note.nvmKeepsSystemNode', 'remoteTools.note.nvmReopenTerminal'],
  }
}

function nodeUpdatePlan(env: RecipeEnv): RecipeResult {
  return nodeUnsupported(env) ?? {
    toolId: 'node',
    kind: 'update',
    command: NVM_UPDATE_COMMAND,
    needsSudo: false,
    installLocation: 'remoteTools.location.nvmDir',
    installPath: '~/.nvm',
    docsUrl: DOCS.nvm,
    integrity: 'remoteTools.integrity.nvmNodeShasums',
    notes: ['remoteTools.note.nvmUpdateMovesDefault', 'remoteTools.note.nvmLoginProfile'],
  }
}

/**
 * Install recipe for one tool on a host described only by enums.
 * Throws `TypeError` when `toolId` or `env` is not a known enum value.
 */
export function buildInstallPlan(toolId: RemoteToolId, env: RecipeEnv): RecipeResult {
  const tool = assertMember(toolId, REMOTE_TOOL_IDS, 'toolId')
  const e = normalizeRecipeEnv(env)
  switch (tool) {
    case 'claude':
    case 'codex':
    case 'uv':
      return scriptPlan(SCRIPT_RECIPES[tool], e)
    case 'git':
      return gitPlan(e)
    case 'gh':
      return ghPlan(e)
    case 'rg':
      return rgPlan(e)
    case 'node':
      return nodeInstallPlan(e)
    case 'curl':
    case 'bash':
    case 'python3':
      return { unsupported: 'no-recipe' }
  }
}

/**
 * Update recipe. The system claude has one: BAT remote terminals export `DISABLE_AUTOUPDATER=1`,
 * so it never updates itself in the background (T0407 §2). T0555: an nvm-managed node moves to
 * the newest LTS (the panel offers it only for `nvmManaged` nodes).
 */
export function buildUpdatePlan(toolId: RemoteToolId, env: RecipeEnv): RecipeResult {
  const tool = assertMember(toolId, REMOTE_TOOL_IDS, 'toolId')
  const e = normalizeRecipeEnv(env)
  if (tool === 'node') return nodeUpdatePlan(e)
  if (tool !== 'claude') return { unsupported: 'no-recipe' }
  return {
    toolId: 'claude',
    kind: 'update',
    command: 'claude update',
    needsSudo: false,
    installLocation: 'remoteTools.location.userLocalBin',
    installPath: SCRIPT_RECIPES.claude.installPath,
    docsUrl: DOCS.claude,
    integrity: 'remoteTools.integrity.claudeManifestSha256',
  }
}
