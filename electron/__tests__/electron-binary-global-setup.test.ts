// @vitest-environment node
/**
 * T0898 / BUG-218: the vitest globalSetup fetches the Electron binary exactly when
 * `node_modules/electron/index.js` would download it on its first require (so no test worker does).
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  electronBinaryNeedsDownload,
  resolveElectronPkgDir,
} from './helpers/electron-binary-global-setup'

let dir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 't0898-electron-pkg-'))
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('electronBinaryNeedsDownload (mirrors node_modules/electron/index.js)', () => {
  it('no path.txt → download', () => {
    expect(electronBinaryNeedsDownload(dir, {})).toBe(true)
  })

  it('empty path.txt → download', () => {
    fs.writeFileSync(path.join(dir, 'path.txt'), '')
    expect(electronBinaryNeedsDownload(dir, {})).toBe(true)
  })

  it('path.txt names an executable that is not in dist/ → download', () => {
    fs.writeFileSync(path.join(dir, 'path.txt'), 'electron.exe')
    expect(electronBinaryNeedsDownload(dir, {})).toBe(true)
  })

  it('path.txt + dist/<executable> present → no download', () => {
    fs.writeFileSync(path.join(dir, 'path.txt'), 'electron.exe')
    fs.mkdirSync(path.join(dir, 'dist'))
    fs.writeFileSync(path.join(dir, 'dist', 'electron.exe'), '')
    expect(electronBinaryNeedsDownload(dir, {})).toBe(false)
  })

  it('ELECTRON_OVERRIDE_DIST_PATH set → index.js never downloads', () => {
    expect(electronBinaryNeedsDownload(dir, { ELECTRON_OVERRIDE_DIST_PATH: dir })).toBe(false)
  })

  it('the repo resolves its own electron package (the one with install.js)', () => {
    const pkgDir = resolveElectronPkgDir()
    expect(pkgDir).not.toBeNull()
    expect(fs.existsSync(path.join(pkgDir as string, 'install.js'))).toBe(true)
  })
})
