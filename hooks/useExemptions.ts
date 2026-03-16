import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { MemberExemption, SetExemptionParams } from '@/types/exemptions';

export function useExemptions() {
  const [exemptions, setExemptions] = useState<MemberExemption[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const fetchExemptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc('get_active_exemptions');
    if (error) setError(error.message);
    else setExemptions((data as MemberExemption[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchExemptions(); }, [fetchExemptions]);

  // Gibt den aktiven Ausnahmestatus eines Users zurück (oder undefined)
  const getExemptionForUser = useCallback(
    (userId: string) => exemptions.find(e => e.user_id === userId),
    [exemptions]
  );

  const setExemption = useCallback(async (params: SetExemptionParams) => {
    const { error } = await supabase.rpc('set_exemption', {
      p_user_id:    params.p_user_id,
      p_reason:     params.p_reason,
      p_note:       params.p_note ?? null,
      p_start_date: params.p_start_date ?? new Date().toISOString().split('T')[0],
      p_end_date:   params.p_end_date ?? null,
    });
    if (error) throw new Error(error.message);
    await fetchExemptions();
  }, [fetchExemptions]);

  const removeExemption = useCallback(async (userId: string) => {
    const { error } = await supabase.rpc('remove_exemption', {
      p_user_id: userId,
    });
    if (error) throw new Error(error.message);
    await fetchExemptions();
  }, [fetchExemptions]);

  return {
    exemptions,
    loading,
    error,
    getExemptionForUser,
    setExemption,
    removeExemption,
    refresh: fetchExemptions,
  };
}
