import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../src/api/queryClient';
import { useAuthStore } from '../../src/stores/auth';
import { queryKeys } from '../../src/api/queryKeys';
import { AmoCompanyEntryPage } from '../../src/pages/auth/AmoCompanyEntryPage';
import { AuthBootstrap } from '../../src/components/auth/AuthBootstrap';

queryClient.setQueryData(['old-company-private-data'], { secret: 'previous tenant' });
function Entered() {
  const current = queryClient.getQueryData<{ id: string }>(queryKeys.currentUser);
  const token = useAuthStore((state) => state.accessToken);
  return (
    <p data-testid="entered">
      {JSON.stringify({
        current,
        token,
        oldTenant: queryClient.getQueryData(['old-company-private-data']) ?? null,
      })}
    </p>
  );
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthBootstrap>
          <Routes>
            <Route path="/auth/amo" element={<AmoCompanyEntryPage />} />
            <Route path="/employees" element={<Entered />} />
          </Routes>
        </AuthBootstrap>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
