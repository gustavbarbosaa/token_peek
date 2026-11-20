import { useEffect, useRef, useState } from 'react';
import { Activity, Check, CircleAlert, ExternalLink } from 'lucide-react';
import { isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { AppHeader } from './components/AppHeader';
import { ConnectionView } from './components/ConnectionView';
import { EmptyState } from './components/EmptyState';
import { PreferencesView } from './components/PreferencesView';
import { UsageView } from './components/UsageView';
import { useAccount } from './hooks/useAccount';
import { useLimitNotifications } from './hooks/useLimitNotifications';
import { useUsage } from './hooks/useUsage';
import { usePreferences } from './hooks/usePreferences';

type View = 'usage' | 'preferences' | 'connection';

export function App() {
  const [view, setView] = useState<View>('usage');
  const connectionOrigin = useRef<'usage' | 'preferences'>('usage');
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(
    null,
  );
  const settings = usePreferences(setToast);
  const [hidden, setHidden] = useState(false);
  const previousScreen = useRef<string | null>(null);
  const account = useAccount();
  const usage = useUsage(account.account);
  useLimitNotifications(
    usage.error ? null : usage.usage,
    account.account?.email ?? 'connected-account',
    account.account?.connected ?? false,
    settings.preferences.alerts,
    settings.preferences.threshold,
  );

  const screen = hidden ? 'empty' : view;
  useEffect(() => {
    if (previousScreen.current !== null && previousScreen.current !== screen) {
      document.getElementById(`${screen}-heading`)?.focus();
    }
    previousScreen.current = screen;
  }, [screen]);

  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    let unlisten: (() => void) | undefined;

    void listen('show-usage-view', () => {
      if (active) setView('usage');
    })
      .then((stopListening) => {
        if (active) unlisten = stopListening;
        else stopListening();
      })
      .catch((error: unknown) =>
        console.warn('Falha ao acompanhar a abertura da janela:', error),
      );

    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  function openConnection(origin: 'usage' | 'preferences') {
    connectionOrigin.current = origin;
    setView('connection');
  }

  return (
    <main className={isTauri() ? 'workspace' : 'workspace web-preview'}>
      {!isTauri() && (
        <div className="preview-bar">
          <span>
            <Activity size={14} /> Token Peek{' '}
            <span className="preview-label">/ prévia web</span>
          </span>
          <button
            type="button"
            aria-expanded={!hidden}
            onClick={() => setHidden(!hidden)}
          >
            {hidden ? 'Mostrar painel' : 'Ocultar painel'}
          </button>
        </div>
      )}

      {hidden ? (
        <EmptyState onOpen={() => setHidden(false)} />
      ) : (
        <article className="panel">
          <AppHeader account={account.account} />
          {isTauri() && account.account === null ? (
            <section className="content" aria-label="Conta do Codex">
              <div className="usage-message">
                {account.statusError ? (
                  <>
                    <p role="alert">{account.statusError}</p>
                    <button className="primary" onClick={account.retryStatus}>
                      Tentar novamente
                    </button>
                  </>
                ) : (
                  <p role="status">Verificando sua conta do Codex…</p>
                )}
              </div>
            </section>
          ) : (
            <>
              <nav className="tabs" aria-label="Navegação">
                <button
                  className={view === 'usage' ? 'selected' : ''}
                  aria-current={view === 'usage' ? 'page' : undefined}
                  onClick={() => setView('usage')}
                >
                  Visão geral
                </button>
                <button
                  className={view === 'preferences' ? 'selected' : ''}
                  aria-current={view === 'preferences' ? 'page' : undefined}
                  onClick={() => setView('preferences')}
                >
                  Preferências
                </button>
              </nav>

              {view === 'usage' && (
                <UsageView
                  usage={usage.usage}
                  connected={account.account?.connected ?? false}
                  desktop={isTauri()}
                  loading={usage.loading}
                  error={usage.error}
                  threshold={settings.preferences.threshold}
                  onConnect={() => openConnection('usage')}
                />
              )}
              {view === 'preferences' && (
                <PreferencesView
                  preferences={settings.draft}
                  shortcutError={settings.shortcutError}
                  systemShortcut={settings.systemShortcut}
                  saveError={settings.saveError}
                  saving={settings.saving}
                  connected={account.account?.connected ?? false}
                  onChange={settings.updateDraft}
                  onSave={async () => {
                    if (await settings.savePreferences()) {
                      setToast({
                        text: 'Preferências salvas neste computador.',
                      });
                      setView('usage');
                    }
                  }}
                  onManageAccount={() => openConnection('preferences')}
                />
              )}
              {view === 'connection' && (
                <ConnectionView
                  account={account.account}
                  loginPrompt={account.loginPrompt}
                  loading={account.loading}
                  error={account.error}
                  onBack={() => setView(connectionOrigin.current)}
                  onConnect={account.connect}
                  onDisconnect={async () => {
                    if (await account.disconnect()) {
                      setToast({ text: 'Conta desconectada.' });
                    }
                  }}
                  onCancel={async () => {
                    if (await account.cancelLogin()) {
                      setToast({ text: 'Conexão cancelada.' });
                    }
                  }}
                  onOpenVerificationPage={account.openVerificationPage}
                />
              )}
            </>
          )}
        </article>
      )}

      {toast && (
        <div
          className={toast.error ? 'toast toast-error' : 'toast'}
          role={toast.error ? 'alert' : 'status'}
        >
          {toast.error ? <CircleAlert size={15} /> : <Check size={15} />}
          {toast.text}
        </div>
      )}
      {!isTauri() && (
        <p className="preview-caption">
          <ExternalLink size={12} /> Prévia local · conecte a conta no app
          desktop para consultar limites
        </p>
      )}
    </main>
  );
}
