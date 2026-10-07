import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { SnackbarProvider } from './contexts/SnackbarContext.tsx';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { QueryProvider } from './providers/QueryProvider.tsx';

// Global error handlers
window.onerror = (message, source, lineno, colno, error) => {
  console.error('[Global Error]', { message, source, lineno, colno, error });
};
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise Rejection]', event.reason);
});

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
