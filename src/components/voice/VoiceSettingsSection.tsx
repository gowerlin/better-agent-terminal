import { useState, useEffect, useCallback, useRef } from 'react'
import type {
  WhisperModelSize,
  VoiceLanguage,
  VoiceModelInfo,
  VoicePreferences,
  VoiceModelDownloadProgress,
} from '../../types/voice'

// Human-readable model sizes (from T0004 HuggingFace HEAD verification)
const MODEL_DISPLAY: Record<WhisperModelSize, { label: string; size: string; desc: string }> = {
  tiny:   { label: 'Tiny',   size: '77.7 MB',  desc: '速度最快，精確度較低' },
  base:   { label: 'Base',   size: '141 MB',   desc: '平衡選項' },
  small:  { label: 'Small',  size: '466 MB',   desc: '推薦，精確度好' },
  medium: { label: 'Medium', size: '1.43 GB',  desc: '精確度最高，速度較慢' },
}

const MODEL_ORDER: WhisperModelSize[] = ['tiny', 'base', 'small', 'medium']

type ModelStatus = 'not_downloaded' | 'downloading' | 'downloaded'

interface ModelState {
  info: VoiceModelInfo
  status: ModelStatus
  progress?: VoiceModelDownloadProgress
  error?: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function VoiceSettingsSection() {
  const [models, setModels] = useState<Record<WhisperModelSize, ModelState>>({} as Record<WhisperModelSize, ModelState>)
  const [preferences, setPreferences] = useState<VoicePreferences | null>(null)
  const [modelsDir, setModelsDir] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [downloadProgress, setDownloadProgress] = useState<Record<string, VoiceModelDownloadProgress>>({})
  const downloadingRef = useRef<Set<WhisperModelSize>>(new Set())

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [modelList, prefs, dir] = await Promise.all([
          window.electronAPI.voice.listModels(),
          window.electronAPI.voice.getPreferences(),
          window.electronAPI.voice.getModelsDirectory(),
        ])

        const modelMap = {} as Record<WhisperModelSize, ModelState>
        for (const m of modelList) {
          modelMap[m.size] = {
            info: m,
            status: m.downloaded ? 'downloaded' : 'not_downloaded',
          }
        }
        setModels(modelMap)
        setPreferences(prefs)
        setModelsDir(dir)
      } catch (err) {
        window.electronAPI.debug?.log?.(`[VoiceSettings] Failed to load data: ${err}`)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Subscribe to download progress events
  useEffect(() => {
    const unsubscribe = window.electronAPI.voice.onModelDownloadProgress((progress: VoiceModelDownloadProgress) => {
      setDownloadProgress(prev => ({ ...prev, [progress.size]: progress }))

      // When download completes, refresh model list
      if (progress.percent >= 100) {
        setTimeout(async () => {
          try {
            const modelList = await window.electronAPI.voice.listModels()
            const modelMap = {} as Record<WhisperModelSize, ModelState>
            for (const m of modelList) {
              modelMap[m.size] = {
                info: m,
                status: m.downloaded ? 'downloaded' : 'not_downloaded',
              }
            }
            setModels(modelMap)
            downloadingRef.current.delete(progress.size)
            setDownloadProgress(prev => {
              const next = { ...prev }
              delete next[progress.size]
              return next
            })
          } catch (err) {
            window.electronAPI.debug?.log?.(`[VoiceSettings] Failed to refresh models: ${err}`)
          }
        }, 500)
      }
    })
    return unsubscribe
  }, [])

  const refreshModels = useCallback(async () => {
    try {
      const modelList = await window.electronAPI.voice.listModels()
      const modelMap = {} as Record<WhisperModelSize, ModelState>
      for (const m of modelList) {
        modelMap[m.size] = {
          info: m,
          status: downloadingRef.current.has(m.size) ? 'downloading'
            : m.downloaded ? 'downloaded' : 'not_downloaded',
        }
      }
      setModels(modelMap)
    } catch (err) {
      window.electronAPI.debug?.log?.(`[VoiceSettings] Failed to refresh models: ${err}`)
    }
  }, [])

  const handleDownload = useCallback(async (size: WhisperModelSize) => {
    downloadingRef.current.add(size)
    setModels(prev => ({
      ...prev,
      [size]: { ...prev[size], status: 'downloading' as ModelStatus, error: undefined },
    }))
    try {
      await window.electronAPI.voice.downloadModel(size)
      // Progress events will handle completion; refresh just in case
      await refreshModels()
    } catch (err) {
      downloadingRef.current.delete(size)
      const message = err instanceof Error ? err.message : String(err)
      setModels(prev => ({
        ...prev,
        [size]: { ...prev[size], status: 'not_downloaded' as ModelStatus, error: message },
      }))
      setDownloadProgress(prev => {
        const next = { ...prev }
        delete next[size]
        return next
      })
    }
  }, [refreshModels])

  const handleCancel = useCallback(async (size: WhisperModelSize) => {
    try {
      await window.electronAPI.voice.cancelDownload(size)
      downloadingRef.current.delete(size)
      setDownloadProgress(prev => {
        const next = { ...prev }
        delete next[size]
        return next
      })
      await refreshModels()
    } catch (err) {
      window.electronAPI.debug?.log?.(`[VoiceSettings] Failed to cancel download: ${err}`)
    }
  }, [refreshModels])

  const handleDelete = useCallback(async (size: WhisperModelSize) => {
    const display = MODEL_DISPLAY[size]
    if (!window.confirm(`確定要刪除 ${display.label} 模型嗎？`)) return

    try {
      await window.electronAPI.voice.deleteModel(size)
      // If this was the default model, we need to refresh preferences too
      await refreshModels()
      const prefs = await window.electronAPI.voice.getPreferences()
      setPreferences(prefs)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setModels(prev => ({
        ...prev,
        [size]: { ...prev[size], error: `刪除失敗：${message}` },
      }))
    }
  }, [refreshModels])

  const handleSetDefaultModel = useCallback(async (size: WhisperModelSize) => {
    try {
      const updated = await window.electronAPI.voice.setPreferences({ modelSize: size })
      setPreferences(updated)
    } catch (err) {
      window.electronAPI.debug?.log?.(`[VoiceSettings] Failed to set default model: ${err}`)
    }
  }, [])

  const handleSetLanguage = useCallback(async (language: VoiceLanguage) => {
    try {
      const updated = await window.electronAPI.voice.setPreferences({ language })
      setPreferences(updated)
    } catch (err) {
      window.electronAPI.debug?.log?.(`[VoiceSettings] Failed to set language: ${err}`)
    }
  }, [])

  const handleToggleTraditional = useCallback(async (convertToTraditional: boolean) => {
    try {
      const updated = await window.electronAPI.voice.setPreferences({ convertToTraditional })
      setPreferences(updated)
    } catch (err) {
      window.electronAPI.debug?.log?.(`[VoiceSettings] Failed to toggle traditional: ${err}`)
    }
  }, [])

  const handleOpenModelsDir = useCallback(async () => {
    try {
      await window.electronAPI.shell.openPath(modelsDir)
    } catch (err) {
      window.electronAPI.debug?.log?.(`[VoiceSettings] Failed to open models dir: ${err}`)
    }
  }, [modelsDir])

  if (loading) {
    return (
      <div className="settings-section">
        <h3>🎤 語音輸入</h3>
        <div className="settings-group">
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>載入中...</span>
        </div>
      </div>
    )
  }

  const getModelStatus = (size: WhisperModelSize): ModelStatus => {
    if (downloadingRef.current.has(size) || downloadProgress[size]) return 'downloading'
    return models[size]?.status || 'not_downloaded'
  }

  return (
    <div className="settings-section">
      <h3>🎤 語音輸入</h3>

      {/* A. Model Management */}
      <div className="settings-group">
        <label>模型管理</label>
        <div className="voice-model-list">
          {MODEL_ORDER.map(size => {
            const display = MODEL_DISPLAY[size]
            const status = getModelStatus(size)
            const progress = downloadProgress[size]
            const error = models[size]?.error
            const isDefault = preferences?.modelSize === size

            return (
              <div key={size} className="voice-model-row">
                <div className="voice-model-info">
                  <span className="voice-model-name">
                    {display.label}
                    {size === 'small' && <span className="voice-model-badge">推薦</span>}
                    {isDefault && status === 'downloaded' && <span className="voice-model-badge default">預設</span>}
                  </span>
                  <span className="voice-model-meta">
                    {display.size} — {display.desc}
                  </span>
                </div>

                <div className="voice-model-status">
                  {status === 'downloaded' && (
                    <span className="voice-status-tag downloaded">✅ 已下載</span>
                  )}
                  {status === 'not_downloaded' && (
                    <span className="voice-status-tag not-downloaded">未下載</span>
                  )}
                  {status === 'downloading' && progress && (
                    <div className="voice-download-progress">
                      <div className="voice-progress-bar">
                        <div
                          className="voice-progress-fill"
                          style={{ width: `${Math.min(progress.percent, 100)}%` }}
                        />
                      </div>
                      <span className="voice-progress-text">
                        {progress.totalBytes > 0
                          ? `${formatBytes(progress.bytesDownloaded)} / ${formatBytes(progress.totalBytes)} (${Math.round(progress.percent)}%)`
                          : '下載中...'}
                      </span>
                    </div>
                  )}
                  {status === 'downloading' && !progress && (
                    <span className="voice-status-tag downloading">🔄 準備下載...</span>
                  )}
                </div>

                <div className="voice-model-actions">
                  {status === 'not_downloaded' && (
                    <button
                      className="profile-action-btn primary"
                      onClick={() => handleDownload(size)}
                      type="button"
                    >
                      下載
                    </button>
                  )}
                  {status === 'downloading' && (
                    <button
                      className="profile-action-btn danger"
                      onClick={() => handleCancel(size)}
                      type="button"
                    >
                      取消
                    </button>
                  )}
                  {status === 'downloaded' && (
                    <button
                      className="profile-action-btn danger"
                      onClick={() => handleDelete(size)}
                      type="button"
                    >
                      刪除
                    </button>
                  )}
                </div>

                {error && (
                  <div className="voice-model-error">⚠️ {error}</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* B. Default Model Selection */}
      <div className="settings-group">
        <label>預設模型</label>
        <div className="voice-radio-group">
          {MODEL_ORDER.map(size => {
            const display = MODEL_DISPLAY[size]
            const isDownloaded = models[size]?.status === 'downloaded'
            const isSelected = preferences?.modelSize === size

            return (
              <label
                key={size}
                className={`voice-radio-option ${!isDownloaded ? 'disabled' : ''}`}
                title={!isDownloaded ? '請先下載此模型' : undefined}
              >
                <input
                  type="radio"
                  name="voice-default-model"
                  value={size}
                  checked={isSelected}
                  disabled={!isDownloaded}
                  onChange={() => handleSetDefaultModel(size)}
                />
                <span>{display.label} ({display.size})</span>
                {!isDownloaded && <span className="voice-radio-hint">請先下載</span>}
              </label>
            )
          })}
        </div>
      </div>

      {/* C. Language Preference */}
      <div className="settings-group">
        <label>辨識語言</label>
        <div className="voice-radio-group">
          <label className="voice-radio-option">
            <input
              type="radio"
              name="voice-language"
              value="zh"
              checked={preferences?.language === 'zh'}
              onChange={() => handleSetLanguage('zh')}
            />
            <span>繁體中文 (zh)</span>
          </label>
          <label className="voice-radio-option">
            <input
              type="radio"
              name="voice-language"
              value="en"
              checked={preferences?.language === 'en'}
              onChange={() => handleSetLanguage('en')}
            />
            <span>English (en)</span>
          </label>
          <label className="voice-radio-option">
            <input
              type="radio"
              name="voice-language"
              value="auto"
              checked={preferences?.language === 'auto'}
              onChange={() => handleSetLanguage('auto')}
            />
            <span>自動偵測 (auto)</span>
          </label>
        </div>
      </div>

      {/* D. Traditional Chinese Conversion Toggle */}
      <div className="settings-group checkbox-group">
        <label>
          <input
            type="checkbox"
            checked={preferences?.convertToTraditional ?? true}
            onChange={e => handleToggleTraditional(e.target.checked)}
          />
          <span>自動將辨識結果轉為繁體中文</span>
        </label>
        <p className="settings-hint">
          Whisper 的 zh 語言預設輸出簡體，啟用時會透過 OpenCC 轉為繁體
        </p>
      </div>

      {/* E. Models Directory (read-only) */}
      <div className="settings-group">
        <label>模型儲存位置</label>
        <div className="voice-models-dir">
          <code className="voice-dir-path">{modelsDir || '(未知)'}</code>
          {modelsDir && (
            <button
              className="profile-action-btn"
              onClick={handleOpenModelsDir}
              type="button"
              style={{ marginLeft: 8, flexShrink: 0 }}
            >
              開啟資料夾
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
