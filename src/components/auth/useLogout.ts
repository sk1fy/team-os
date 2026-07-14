import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api';

export function useLogout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      queryClient.clear();
      navigate('/auth/login', { replace: true });
    }
  }, [navigate, queryClient]);
}
