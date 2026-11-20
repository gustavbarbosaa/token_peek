import { useEffect, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import type { AccountStatus, LoginMethod, LoginPrompt } from '../types/auth';

export function useAccount() {
  const [account, setAccount] = useState<AccountStatus | null>(null);
  const [loginPrompt, setLoginPrompt] = useState<LoginPrompt | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusError, setStatusError] = useState('');

  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    let inFlight = false;

    async function refreshAccount() {
      if (!active || inFlight) return;
      inFlight = true;
      try {
        const status = await invoke<AccountStatus>('auth_account_status');
        if (!active) return;
        setAccount(status);
        setStatusError('');
        if (status.connected) {
          setLoginPrompt(null);
          setError('');
        }
      } catch (error) {
        if (active) setStatusError(String(error));
      } finally {
        inFlight = false;
      }
    }

    void refreshAccount();
    const timer = loginPrompt ? setInterval(refreshAccount, 2500) : undefined;
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [loginPrompt]);

  async function connect(method: LoginMethod) {
    setLoading(true);
    setError('');
    try {
      const prompt = await invoke<LoginPrompt>('auth_start', { method });
      setStatusError('');
      setLoginPrompt(prompt);
      if (method === 'browser') await openVerificationPage();
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
    setError('');
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
    setError('');
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
    error: error || statusError,
    connect,
    disconnect,
    cancelLogin,
    openVerificationPage,
  };
}
