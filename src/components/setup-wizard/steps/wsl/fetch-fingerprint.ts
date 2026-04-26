import * as https from 'node:https'
import type { WizardStep } from '../../wizard-runner'

type HttpsGetResult = Promise<string>

let fetchFingerprintImpl = (port: number): HttpsGetResult =>
  new Promise((resolve, reject) => {
    const request = https.get(
      `https://localhost:${port}/fingerprint`,
      { rejectUnauthorized: false },
      (response) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
        response.on('end', () => {
          if ((response.statusCode ?? 500) >= 400) {
            reject(new Error(`Fingerprint endpoint returned HTTP ${response.statusCode}`))
            return
          }
          resolve(Buffer.concat(chunks).toString('utf8').trim())
        })
      },
    )
    request.on('error', reject)
  })

export function setFetchFingerprintImplForTests(impl: (port: number) => HttpsGetResult): void {
  fetchFingerprintImpl = impl
}

export function resetFetchFingerprintImplForTests(): void {
  fetchFingerprintImpl = (port: number) =>
    new Promise((resolve, reject) => {
      const request = https.get(
        `https://localhost:${port}/fingerprint`,
        { rejectUnauthorized: false },
        (response) => {
          const chunks: Buffer[] = []
          response.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
          response.on('end', () => {
            if ((response.statusCode ?? 500) >= 400) {
              reject(new Error(`Fingerprint endpoint returned HTTP ${response.statusCode}`))
              return
            }
            resolve(Buffer.concat(chunks).toString('utf8').trim())
          })
        },
      )
      request.on('error', reject)
    })
}

export const fetchFingerprintStep: WizardStep = {
  id: 'fetch-fingerprint',
  title: 'Fetch TLS fingerprint',
  appliesTo: 'all',
  retryable: true,
  async run(ctx) {
    if (ctx.systemdServiceActive === false) {
      ctx.fingerprint = null
      return
    }

    const port = ctx.serverPort ?? 9876
    let lastError: unknown = null
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        ctx.fingerprint = await fetchFingerprintImpl(port)
        return
      } catch (error) {
        lastError = error
        await new Promise((resolve) => setTimeout(resolve, 1_000))
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  },
}
