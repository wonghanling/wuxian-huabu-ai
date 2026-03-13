'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface MembershipState {
  loading: boolean;
  isMember: boolean;
  balance: number;
  userId: string | null;
}

export function useMembership() {
  const [state, setState] = useState<MembershipState>({
    loading: true,
    isMember: false,
    balance: 0,
    userId: null,
  });

  const refresh = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) { setState(s => ({ ...s, loading: false })); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setState({ loading: false, isMember: false, balance: 0, userId: null }); return; }

    const { data } = await supabase
      .from('users')
      .select('is_member, member_expires_at, balance')
      .eq('id', user.id)
      .single();

    const isMember = !!(
      data?.is_member &&
      data?.member_expires_at &&
      new Date(data.member_expires_at) > new Date()
    );

    setState({
      loading: false,
      isMember,
      balance: data?.balance ?? 0,
      userId: user.id,
    });
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { ...state, refresh };
}
