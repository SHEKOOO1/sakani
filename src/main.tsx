import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { SnackbarProvider } from './contexts/SnackbarContext.tsx';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { QueryProvider } from './providers/QueryProvider.tsx';
import { registerSW } from 'virtual:pwa-register';
import { isNativeApp } from './utils/location';

// Global error handlers
window.onerror = (message, source, lineno, colno, error) => {
  console.error('[Global Error]', { message, source, lineno, colno, error });
};
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise Rejection]', event.reason);
});

// Service worker is for the browser/PWA only. Inside the Capacitor native shell
// it would intercept requests and block native plugin loading, so we skip it.
if (!isNativeApp()) {
  registerSW({ immediate: true });
}

createRoot(document.getElementById('root')!).render(
    <HelmetProvider>
    <BrowserRouter>
      <AuthProvider>
        <QueryProvider>
        <SnackbarProvider>
          <App />
        </SnackbarProvider>
        </QueryProvider>
      </AuthProvider>
    </BrowserRouter>
    </HelmetProvider>,
);
