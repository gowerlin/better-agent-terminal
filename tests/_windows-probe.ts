/**
 * One-shot Windows probe for AC-4 of T0233.
 *
 * Not part of the test suite — run only when validating Windows detection
 * against real filesystem + child_process. tsx-native; no deps beyond this repo.
 */
import { spawn } from 'child_process'
import { detectSystemClaude } from '../electron/claude-resolver'

async function probe() {
  console.log('=== Windows detectSystemClaude probe ===\n')

  // AC-4.1: Auto-detect on PATH (may pick up node_modules/.bin in dev)
  console.log('[AC-4.1] No customPath → auto-detect from PATH / common locations:')
  const autoInfo = await detectSystemClaude()
  console.log(JSON.stringify(autoInfo, null, 2))
  console.log()

  // AC-4.3: Direct spawn of detected binary
  if (autoInfo) {
    console.log(`[AC-4.3 direct spawn] '${autoInfo.path}' --version:`)
    await new Promise<void>((resolve) => {
      try {
        const child = spawn(autoInfo.path, ['--version'])
        let out = ''
        child.stdout.on('data', (d) => (out += d))
        child.on('close', (code) => {
          console.log(`  stdout = ${JSON.stringify(out.trim())}, exit=${code}`)
          resolve()
        })
        child.on('error', (err) => {
          console.log(`  spawn error (caught async): ${err.message}`)
          resolve()
        })
      } catch (err) {
        console.log(`  spawn error (caught sync): ${(err as Error).message}`)
        resolve()
      }
    })
    console.log()
    const ext = autoInfo.path.toLowerCase().split('.').pop()
    console.log(`[AC-4.2 extension choice] auto-picked = .${ext}`)
    console.log()
  }

  // Extra: probe the known-good system exe via customPath override
  const systemExe = 'C:\\Users\\Gower\\.local\\bin\\claude.exe'
  console.log(`[AC-4.2+ customPath → real .exe] ${systemExe}:`)
  const customInfo = await detectSystemClaude(systemExe)
  console.log(JSON.stringify(customInfo, null, 2))
  console.log()

  // Extra: probe npm global .cmd shim (Windows CVE-2024-27980 case).
  // T0235 / BUG-053: PATH + common-location scans no longer pick .cmd shims,
  // but customPath is user-owned and still lets the file through. Expected
  // outcome: Node 20+ spawn() refuses EINVAL → healthStatus: 'spawn-failed'.
  // Kept as a manual regression probe — the router will fall back to embedded
  // (fallbackToEmbedded=true default) or surface a degraded event.
  const cmdShim = 'C:\\Users\\Gower\\AppData\\Roaming\\npm\\claude.cmd'
  console.log(`[AC-4.2++ customPath → .cmd shim] ${cmdShim}:`)
  const cmdInfo = await detectSystemClaude(cmdShim)
  console.log(JSON.stringify(cmdInfo, null, 2))
  console.log()

  console.log('=== probe done ===')
}

probe().catch((err) => {
  console.error('probe crashed:', err)
  process.exit(1)
})
