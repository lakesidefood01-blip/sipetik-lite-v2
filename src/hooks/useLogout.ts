import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';

export function useLogout() {
  const navigate = useNavigate();

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    navigate('/login');
  }, [navigate]);

  return logout;
}
