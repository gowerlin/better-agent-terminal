import * as os from 'os'
import * as path from 'path'

function resolveHomeDir(): string {
  const home = os.homedir()
  if (!home) {
    throw new Error('Unable to resolve HOME for bat-server data directory')
  }
  return home
}

export function resolveDefaultDataDir(): string {
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA
    if (!localAppData) {
      throw new Error('LOCALAPPDATA is not set; use --data-dir or BAT_SERVER_DATA_DIR')
    }
    return path.join(localAppData, 'bat-server')
  }

  if (process.platform === 'darwin') {
    return path.join(
      process.env.XDG_DATA_HOME || path.join(resolveHomeDir(), 'Library', 'Application Support'),
      'bat-server'
    )
  }

  return path.join(
    process.env.XDG_DATA_HOME || path.join(resolveHomeDir(), '.local', 'share'),
    'bat-server'
  )
}
