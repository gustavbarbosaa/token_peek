import { useEffect, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import type { AccountStatus, LoginPrompt } from '../types/auth';

export function useAccount() {
  const [account, setAccount] = useState<AccountStatus | null>(null);
  const [loginPrompt, setLoginPrompt] = useState<LoginPrompt | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isTauri()) return;
    let active = true;

    async function refreshAccount() {
      try {
        const status = await invoke<AccountStatus>('auth_account_status');
        if (!active) return;
        setAccount(status);
        setError('');
        if (status.connected) setLoginPrompt(null);
      } catch (error) {
        if (active) setError(String(error));
      }
    }

    void refreshAccount();
    const timer = loginPrompt ? setInterval(refreshAccount, 2500) : undefined;
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [loginPrompt]);

  async function connect() {
    setLoading(true);
    setError('');
    try {
      const prompt = await invoke<LoginPrompt>('auth_start');
      setLoginPrompt(prompt);
    } catch (error) {
      setError(String(error));
    } finally {
      setLoading(false);
    }
  }

  async function disconnect(): Promise<boolean> {
    setLoading(true);
    setError('');
    try {
      const status = await invoke<AccountStatus>('auth_logout');
      setAccount(status);
      setLoginPrompt(null);
      return true;
    } catch (error) {
      setError(String(error));
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function cancelLogin(): Promise<boolean> {
    if (!loginPrompt) return false;
    try {
      await invoke('auth_cancel', { loginId: loginPrompt.loginId });
      setLoginPrompt(null);
      return true;
    } catch (error) {
      setError(String(error));
      return false;
    }
  }

  async function openVerificationPage() {
    try {
      await invoke('auth_open_verification_page');
    } catch (error) {
      setError(String(error));
    }
  }

  return {
    account,
    loginPrompt,
    loading,
    error,
    connect,
    disconnect,
    cancelLogin,
    openVerificationPage,
  };
}
