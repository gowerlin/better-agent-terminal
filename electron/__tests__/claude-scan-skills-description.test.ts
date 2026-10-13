/**
 * BUG-125 (T0518): `claude:scan-skills` read `.claude/commands/*.md` descriptions
 * from the first non-empty line, so a command with YAML frontmatter showed "---".
 * Commands now use frontmatter `description:` like skills; skills and star commands
 * share the same frontmatter parser and must keep their previous results.
 *
 * BUG-126 (T0519): skills and star commands without a frontmatter `description:`
 * never left the frontmatter in their fallback (the closing `---` equals
 * `lines[0]`), so they showed ''. They now use `parseCommandDescription` too.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../logger', () => ({ logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() } }))

import { frontmatterDescription, parseCommandDescription, registerClaudeHandlers } from '../handlers/claude'

type Handler = (ctx: unknown, ...args: unknown[]) => unknown

function handlersFor(homeDir: string): Map<string, Handler> {
  const handlers = new Map<string, Handler>()
  registerClaudeHandlers(((channel: string, fn: Handler) => { handlers.set(channel, fn) }) as never, {
    emit: () => {},
    homeDir,
    getClaudeManager: () => null,
  })
  return handlers
}

describe('parseCommandDescription', () => {
  it('uses frontmatter description', () => {
    expect(parseCommandDescription('---\ndescription: Deploy the app\nallowed-tools: Bash\n---\n\n# Deploy\n')).toBe('Deploy the app')
  })

  it('drops surrounding double quotes', () => {
    expect(parseCommandDescription('---\ndescription: "Run the review"\n---\nbody\n')).toBe('Run the review')
  })

  it('falls back to the first non-empty line without frontmatter', () => {
    expect(parseCommandDescription('\n\n# Fix the build\n\nSteps...\n')).toBe('Fix the build')
    expect(parseCommandDescription('Plain first line\nmore\n')).toBe('Plain first line')
  })

  it('uses the first non-empty line after frontmatter without description', () => {
    expect(parseCommandDescription('---\nallowed-tools: Bash\n---\n\n# Release notes\n')).toBe('Release notes')
  })

  it('handles CRLF files', () => {
    expect(parseCommandDescription('---\r\ndescription: "CRLF command"\r\n---\r\n# Title\r\n')).toBe('CRLF command')
    expect(parseCommandDescription('---\r\nargument-hint: <id>\r\n---\r\n\r\n# CRLF title\r\n')).toBe('CRLF title')
    expect(parseCommandDescription('# No frontmatter\r\nbody\r\n')).toBe('No frontmatter')
  })

  it('returns empty for unclosed frontmatter or an empty file', () => {
    expect(parseCommandDescription('---\nallowed-tools: Bash\n# Title\n')).toBe('')
    expect(parseCommandDescription('')).toBe('')
    expect(parseCommandDescription('---\n---\n')).toBe('')
  })
})

describe('frontmatterDescription', () => {
  it('only reads description inside a leading frontmatter block', () => {
    expect(frontmatterDescription(['---', 'name: x', 'description: inside', '---'])).toBe('inside')
    expect(frontmatterDescription(['---', 'name: x', '---', 'description: outside'])).toBe('')
    expect(frontmatterDescription(['# Title', 'description: not frontmatter'])).toBe('')
  })
})

describe('claude:scan-skills / claude:scan-star-commands', () => {
  let root: string
  let home: string
  let cwd: string

  const write = (file: string, content: string) => {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, content, 'utf-8')
  }

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0518-'))
    home = path.join(root, 'home')
    cwd = path.join(root, 'project')
    fs.mkdirSync(home, { recursive: true })
    fs.mkdirSync(cwd, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('reads command descriptions from frontmatter (BUG-125)', async () => {
    const commands = path.join(cwd, '.claude', 'commands')
    write(path.join(commands, 'deploy.md'), '---\ndescription: "Deploy to staging"\nallowed-tools: Bash\n---\n\n# Deploy\n')
    write(path.join(commands, 'plain.md'), '# Plain command\n\nbody\n')
    write(path.join(commands, 'nodesc.md'), '---\nargument-hint: <id>\n---\n\nFix ticket $ARGUMENTS\n')
    write(path.join(home, '.claude', 'commands', 'global.md'), '---\r\ndescription: Global CRLF\r\n---\r\n')

    const result = await handlersFor(home).get('claude:scan-skills')!({}, cwd)
    expect(result).toEqual(expect.arrayContaining([
      { name: 'deploy', description: 'Deploy to staging', scope: 'project' },
      { name: 'plain', description: 'Plain command', scope: 'project' },
      { name: 'nodesc', description: 'Fix ticket $ARGUMENTS', scope: 'project' },
      { name: 'global', description: 'Global CRLF', scope: 'global' },
    ]))
  })

  it('reads skill descriptions (BUG-126 fallback)', async () => {
    const skills = path.join(cwd, '.claude', 'skills')
    write(path.join(skills, 'quoted', 'SKILL.md'), '---\nname: quoted\ndescription: "Quoted skill"\n---\n# Heading\n')
    write(path.join(skills, 'crlf', 'SKILL.md'), '---\r\nname: crlf\r\ndescription: CRLF skill\r\n---\r\n')
    write(path.join(skills, 'heading', 'SKILL.md'), '\n# Heading skill\n')
    write(path.join(skills, 'nodesc', 'SKILL.md'), '---\nname: nodesc\n---\n# After frontmatter\n')
    write(path.join(skills, 'nodesc-crlf', 'SKILL.md'), '---\r\nname: nodesc-crlf\r\n---\r\n\r\nCRLF body line\r\n')
    write(path.join(skills, 'unclosed', 'SKILL.md'), '---\nname: unclosed\n# Never closed\n')

    const result = await handlersFor(home).get('claude:scan-skills')!({}, cwd)
    expect(result).toEqual(expect.arrayContaining([
      { name: 'quoted', description: 'Quoted skill', scope: 'project' },
      { name: 'crlf', description: 'CRLF skill', scope: 'project' },
      { name: 'heading', description: 'Heading skill', scope: 'project' },
      { name: 'nodesc', description: 'After frontmatter', scope: 'project' },
      { name: 'nodesc-crlf', description: 'CRLF body line', scope: 'project' },
      { name: 'unclosed', description: '', scope: 'project' },
    ]))
  })

  it('reads star command descriptions (BUG-126 fallback)', async () => {
    const skills = path.join(home, '.claude', 'skills')
    write(path.join(skills, 'ct-exec', 'SKILL.md'), '---\nname: ct-exec\ndescription: "Execute a work order"\n---\n')
    write(path.join(skills, 'gsd-do', 'SKILL.md'), '# Do the thing\n')
    write(path.join(skills, 'ct-help', 'SKILL.md'), '---\nname: ct-help\n---\n\n# Help for the tower\n')
    write(path.join(skills, 'other', 'SKILL.md'), '---\ndescription: ignored\n---\n')

    const result = await handlersFor(home).get('claude:scan-star-commands')!({})
    expect(result).toHaveLength(3)
    expect(result).toEqual(expect.arrayContaining([
      { name: 'do', description: 'Do the thing', prefix: 'gsd' },
      { name: 'exec', description: 'Execute a work order', prefix: 'ct' },
      { name: 'help', description: 'Help for the tower', prefix: 'ct' },
    ]))
  })
})
