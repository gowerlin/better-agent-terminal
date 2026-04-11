export const VOICE_IPC_CHANNELS = {
  listModels: 'voice:listModels',
  isModelDownloaded: 'voice:isModelDownloaded',
  downloadModel: 'voice:downloadModel',
  deleteModel: 'voice:deleteModel',
  cancelDownload: 'voice:cancelDownload',
  getPreferences: 'voice:getPreferences',
  setPreferences: 'voice:setPreferences',
  transcribe: 'voice:transcribe',
  getModelsDirectory: 'voice:getModelsDirectory',
  modelDownloadProgress: 'voice:modelDownloadProgress',
} as const
