import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { SimProvider } from './store'
import './index.css'

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <SimProvider>
      <App />
    </SimProvider>
  </StrictMode>,
)
