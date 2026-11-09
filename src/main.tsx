import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

function dismissSplashScreen() {
  const splash = document.getElementById('app-splash-screen');
  if (!splash) return;
  // Dismiss smoothly after 1.4 seconds
  setTimeout(() => {
    splash.classList.add('fade-out');
    setTimeout(() => splash.remove(), 550);
  }, 1400);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', dismissSplashScreen);
} else {
  dismissSplashScreen();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

