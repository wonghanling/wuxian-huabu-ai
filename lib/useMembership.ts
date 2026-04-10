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

  useEffect(() => {
    refresh();

    // Supabase realtime 订阅 users 表，余额/会员状态变化时自动刷新
    const supabase = createClient();
    if (!supabase) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      channel = supabase
        .channel('user-balance')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'users',
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
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
            }));
          }
        )
        .subscribe();
    });

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { ...state, refresh };
}
