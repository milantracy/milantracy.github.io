import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import GvisorSyscall from './GvisorSyscall.jsx'
import '../index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GvisorSyscall />
  </StrictMode>,
)
