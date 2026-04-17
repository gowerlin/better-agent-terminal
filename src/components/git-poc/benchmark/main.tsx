/**
 * Benchmark Vite entry — 獨立於 BAT 主 app。
 */
import { createRoot } from 'react-dom/client'
import { BenchApp } from './BenchApp'

const root = document.getElementById('root')
if (!root) throw new Error('#root missing')
createRoot(root).render(<BenchApp />)
