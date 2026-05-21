'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface MembershipState {
  loading: boolean;
  isMember: boolean;
  balance: number;
  userId: string | null;
  memberExpiresAt: string | null;
}

export function useMembership() {
  const [state, setState] = useState<MembershipState>({
    loading: true,
    isMember: false,
    balance: 0,
    userId: null,
    memberExpiresAt: null,
  });

  const refresh = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) { setState(s => ({ ...s, loading: false })); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setState({ loading: false, isMember: false, balance: 0, userId: null, memberExpiresAt: null }); return; }

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
      memberExpiresAt: data?.member_expires_at ?? null,
    });
  }, []);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const setup = async () => {
      await refresh();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      channel = supabase
        .channel(`user-balance-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'users',
            filter: `id=eq.${user.id}`,
          },
          (payload: any) => {
            const row = payload.new as any;
            const isMember = !!(
              row?.is_member &&
              row?.member_expires_at &&
              new Date(row.member_expires_at) > new Date()
            );
            setState(s => ({
              ...s,
              isMember,
              balance: row?.balance ?? s.balance,
              memberExpiresAt: row?.member_expires_at ?? s.memberExpiresAt,
            }));
          }
        )
        .subscribe();
    };

    setup();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { ...state, refresh };
}
