import { createHash } from 'crypto'
import { createWriteStream, existsSync, mkdirSync, rmSync, statSync, readdirSync } from 'fs'
import { cp, chmod, copyFile, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { execFileSync } from 'child_process'
import { Readable } from 'stream'

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true })
}

export function cleanDir(dir) {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
}

export async function copyRecursive(src, dest) {
  await cp(src, dest, { recursive: true, force: true })
}

export async function copyFileWithMode(src, dest, mode) {
  ensureDir(path.dirname(dest))
  await copyFile(src, dest)
  if (mode != null) {
    await chmod(dest, mode)
  }
}

export function run(command, args, options = {}) {
  return execFileSync(command, args, {
    stdio: 'pipe',
    encoding: 'utf8',
    windowsHide: true,
    ...options,
  })
}

export function runStreaming(command, args, options = {}) {
  execFileSync(command, args, {
    stdio: 'inherit',
    windowsHide: true,
    ...options,
  })
}

export async function writeExecutableScript(filePath, content) {
  await writeFile(filePath, content, 'utf8')
  await chmod(filePath, 0o755)
}

export async function sha256File(filePath) {
  const content = await readFile(filePath)
  return createHash('sha256').update(content).digest('hex')
}

export async function downloadFile(url, destination) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Download failed (${response.status} ${response.statusText}) for ${url}`)
  }
  if (!response.body) {
    throw new Error(`Download returned no body for ${url}`)
  }
  ensureDir(path.dirname(destination))
  const out = createWriteStream(destination)
  await new Promise((resolve, reject) => {
    out.on('error', reject)
    out.on('finish', resolve)
    if (typeof response.body.pipeTo === 'function') {
      Readable.fromWeb(response.body).on('error', reject).pipe(out)
      return
    }
    reject(new Error(`Unsupported response.body implementation for ${url}`))
  })
}

export async function makeTempDir(prefix) {
  return mkdtemp(path.join(tmpdir(), prefix))
}

export function existsAndIsDirectory(target) {
  return existsSync(target) && statSync(target).isDirectory()
}

export function existsAndIsFile(target) {
  return existsSync(target) && statSync(target).isFile()
}

export async function removePath(target) {
  await rm(target, { recursive: true, force: true })
}

export function listRelativeFiles(rootDir, currentDir = rootDir, results = []) {
  const entries = readdirSync(currentDir, { withFileTypes: true })
  for (const entry of entries) {
    const absolute = path.join(currentDir, entry.name)
    if (entry.isDirectory()) {
      listRelativeFiles(rootDir, absolute, results)
      continue
    }
    results.push(path.relative(rootDir, absolute).replace(/\\/g, '/'))
  }
  return results
}
