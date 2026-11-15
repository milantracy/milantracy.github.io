import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Logbook from './Logbook.jsx'
import '../index.css'
import './logbook.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Logbook />
  </StrictMode>,
)
