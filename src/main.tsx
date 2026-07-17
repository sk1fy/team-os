import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/api/queryClient';
import { TooltipProvider, Toaster } from '@/components/ui';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { ThemeSync } from '@/components/layout/ThemeSync';
import { AuthBootstrap } from '@/components/auth/AuthBootstrap';
import { App } from '@/App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeSync />
        <AuthBootstrap>
          <TooltipProvider>
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
            <Toaster />
          </TooltipProvider>
        </AuthBootstrap>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
