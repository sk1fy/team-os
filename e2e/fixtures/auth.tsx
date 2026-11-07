import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../src/api/queryClient';
import { MemoryRouter } from 'react-router-dom';
import * as client from '../../src/api/client';
import { httpAuthApi } from '../../src/api/http';
import { useAuthStore } from '../../src/stores/auth';
import { AuthBootstrap, RequireAuth } from '../../src/components/auth/AuthBootstrap';

const fixture = { ...client, api: httpAuthApi, store: useAuthStore, queryClient };
declare global {
  interface Window {
    authFixture: typeof fixture;
  }
}
window.authFixture = fixture;
if (new URLSearchParams(location.search).has('bootstrap')) {
  createRoot(document.getElementById('root')!).render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/tasks']}>
        <AuthBootstrap>
          <RequireAuth>
            <p>Доступ восстановлен</p>
          </RequireAuth>
        </AuthBootstrap>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
