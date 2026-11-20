import { useEffect, useState } from 'react';
import { Activity, Check, ExternalLink } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauri } from '@tauri-apps/api/core';
import { AppFooter } from './components/AppFooter';
import { AppHeader } from './components/AppHeader';
import { ConnectionView } from './components/ConnectionView';
import { EmptyState } from './components/EmptyState';
import { PreferencesView } from './components/PreferencesView';
import { UsageView } from './components/UsageView';
import { useAccount } from './hooks/useAccount';
import {
  getDemoUsage,
  readPreferences,
  type Preferences,
  type Scenario,
} from './usage';

type View = 'usage' | 'preferences' | 'connection';

export function App() {
  const [view, setView] = useState<View>('usage');
  const [scenario, setScenario] = useState<Scenario>('normal');
  const [usage, setUsage] = useState(() => getDemoUsage('normal'));
  const [preferences, setPreferences] = useState(readPreferences);
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState('');
  const [hidden, setHidden] = useState(false);
  const account = useAccount();

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  async function hide() {
    if (isTauri()) {
      try {
        await getCurrentWindow().hide();
      } catch {
        setMessage('Não foi possível recolher a janela.');
      }
    } else {
      setHidden(true);
    }
  }

  function savePreferences() {
    try {
      localStorage.setItem(
        'token-peek:preferences',
        JSON.stringify(preferences),
      );
      setMessage('Preferências salvas neste computador.');
      setView('usage');
    } catch {
      setMessage('Não foi possível salvar as preferências.');
    }
  }

  function selectScenario(value: Scenario) {
    setScenario(value);
    setUsage(getDemoUsage(value));
  }

  function updatePreferences(value: Preferences) {
    setPreferences(value);
  }

  return (
    <main className="workspace">
      {!isTauri() && (
        <div className="preview-bar">
          <span>
            <Activity size={14} /> Token Peek{' '}
            <span className="preview-label">/ prévia web</span>
          </span>
          <button onClick={() => setHidden(!hidden)}>
            <span className="status-dot" />
            {usage.current.remaining}%
          </button>
        </div>
      )}

      {hidden ? (
        <EmptyState onOpen={() => setHidden(false)} />
      ) : (
        <article className="panel">
          <AppHeader
            account={account.account}
            showPreferences={view === 'preferences'}
            onTogglePreferences={() =>
              setView(view === 'preferences' ? 'usage' : 'preferences')
            }
            onHide={hide}
          />
          <nav className="tabs" aria-label="Navegação">
            <button
              className={view === 'usage' ? 'selected' : ''}
              onClick={() => setView('usage')}
            >
              Visão geral
            </button>
            <button
              className={view === 'preferences' ? 'selected' : ''}
              onClick={() => setView('preferences')}
            >
              Preferências
            </button>
          </nav>

          {view === 'usage' && (
            <UsageView
              usage={usage}
              scenario={scenario}
              threshold={preferences.threshold}
              now={now}
              onScenarioChange={selectScenario}
            />
          )}
          {view === 'preferences' && (
            <PreferencesView
              preferences={preferences}
              connected={account.account?.connected ?? false}
              onChange={updatePreferences}
              onSave={savePreferences}
              onManageAccount={() => setView('connection')}
            />
          )}
          {view === 'connection' && (
            <ConnectionView
              account={account.account}
              loginPrompt={account.loginPrompt}
              loading={account.loading}
              error={account.error}
              onBack={() => setView('preferences')}
              onConnect={account.connect}
              onDisconnect={async () => {
                if (await account.disconnect()) {
                  setMessage('Conta desconectada.');
                }
              }}
              onCancel={async () => {
                if (await account.cancelLogin()) {
                  setMessage('Conexão cancelada.');
                }
              }}
              onOpenVerificationPage={account.openVerificationPage}
              onContinueDemo={() => {
                setView('usage');
                setMessage('Você está explorando com dados simulados.');
              }}
            />
          )}

          <AppFooter
            updatedAt={usage.updatedAt}
            now={now}
            onRefresh={() => {
              setUsage(getDemoUsage(scenario));
              setMessage('Dados simulados atualizados.');
            }}
          />
        </article>
      )}

      {message && (
        <div className="toast" role="status">
          <Check size={15} />
          {message}
        </div>
      )}
      {!isTauri() && (
        <p className="preview-caption">
          <ExternalLink size={12} /> Protótipo local · nenhum dado real é
          acessado
        </p>
      )}
    </main>
  );
}
