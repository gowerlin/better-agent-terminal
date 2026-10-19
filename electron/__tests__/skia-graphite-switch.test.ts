// @vitest-environment node
/**
 * T0669 / BUG-164: macOS disables Skia Graphite by default (its CHECK kills the GPU process in
 * Electron 41); `BAT_SKIA_GRAPHITE=1` keeps it. Windows / Linux get no switch. main.ts must keep a
 * single `disable-features` switch — a second one would replace `disable-features=ServiceWorker`.
 * main.ts also tells every window when the GPU process died, so visible terminals redraw.
 */
import * as fs from 'fs'
import * as path from 'path'
import { describe, expect, it } from 'vitest'
import { decideSkiaGraphite, formatSkiaGraphiteDecision, SKIA_GRAPHITE_ENV } from '../gpu-status-log'

describe('decideSkiaGraphite', () => {
  it('darwin → disabled by default', () => {
    expect(decideSkiaGraphite('darwin', {})).toEqual({ disable: true, reason: 'darwin-default' })
  })

  it('darwin + BAT_SKIA_GRAPHITE=1 → not disabled (escape hatch)', () => {
    expect(SKIA_GRAPHITE_ENV).toBe('BAT_SKIA_GRAPHITE')
    expect(decideSkiaGraphite('darwin', { BAT_SKIA_GRAPHITE: '1' })).toEqual({ disable: false, reason: 'env-override' })
    expect(decideSkiaGraphite('darwin', { BAT_SKIA_GRAPHITE: ' 1 ' })).toEqual({ disable: false, reason: 'env-override' })
  })

  it('darwin + any other BAT_SKIA_GRAPHITE value → still disabled', () => {
    for (const value of ['', '0', 'true', 'yes']) {
      expect(decideSkiaGraphite('darwin', { BAT_SKIA_GRAPHITE: value })).toEqual({ disable: true, reason: 'darwin-default' })
    }
  })

  it('win32 / linux → never disabled, with or without the env', () => {
    for (const platform of ['win32', 'linux']) {
      expect(decideSkiaGraphite(platform, {})).toEqual({ disable: false, reason: 'not-darwin' })
      expect(decideSkiaGraphite(platform, { BAT_SKIA_GRAPHITE: '1' })).toEqual({ disable: false, reason: 'not-darwin' })
    }
  })

  it('startup log line names the decision and its reason', () => {
    expect(formatSkiaGraphiteDecision(decideSkiaGraphite('darwin', {}), 'darwin'))
      .toBe('[gpu] skia graphite: disabled (darwin default, --disable-skia-graphite; BAT_SKIA_GRAPHITE=1 keeps it on)')
    expect(formatSkiaGraphiteDecision(decideSkiaGraphite('darwin', { BAT_SKIA_GRAPHITE: '1' }), 'darwin'))
      .toBe('[gpu] skia graphite: not disabled (BAT_SKIA_GRAPHITE=1)')
    expect(formatSkiaGraphiteDecision(decideSkiaGraphite('win32', {}), 'win32'))
      .toBe('[gpu] skia graphite: not disabled (platform=win32)')
  })
})

describe('main.ts command-line switches (source guard)', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'main.ts'), 'utf-8')
  const count = (pattern: RegExp) => (source.match(pattern) ?? []).length

  it('exactly one disable-features switch, still ServiceWorker', () => {
    expect(count(/appendSwitch\(\s*['"]disable-features['"]/g)).toBe(1)
    expect(source).toContain("app.commandLine.appendSwitch('disable-features', 'ServiceWorker')")
  })

  it('disable-skia-graphite is appended only behind decideSkiaGraphite, at module load', () => {
    expect(count(/['"]disable-skia-graphite['"]/g)).toBe(1)
    expect(source).toContain('const skiaGraphite = decideSkiaGraphite(process.platform, process.env)')
    expect(source).toContain("if (skiaGraphite.disable) app.commandLine.appendSwitch('disable-skia-graphite')")
    expect(source).toContain('logger.log(formatSkiaGraphiteDecision(skiaGraphite, process.platform))')
    // before app.whenReady — switches appended later do not reach the GPU process
    expect(source.indexOf('decideSkiaGraphite(process.platform')).toBeLessThan(source.indexOf('app.whenReady()'))
  })

  it('a GPU child-process-gone is sent to every window with the crash count', () => {
    const handler = source.slice(source.indexOf("app.on('child-process-gone'"))
    const body = handler.slice(0, handler.indexOf('\n  })'))
    expect(body).toContain('const gpuCrash = gpuStatusLog.onChildProcessGone(details)')
    expect(body).toContain("if (details.type === 'GPU')")
    expect(body).toContain('for (const win of getAllWindows())')
    expect(body).toContain("win.webContents.send('system:gpu-process-gone', { crash: gpuCrash })")
  })
})
