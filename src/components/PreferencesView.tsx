import { Check, Link2 } from 'lucide-react';
import { ShortcutInput } from './ShortcutInput';
import { ALERT_THRESHOLDS, type Preferences } from '../preferences';

type PreferencesViewProps = {
  preferences: Preferences;
  connected: boolean;
  shortcutError: string;
  systemShortcut: boolean;
  saveError: string;
  saving: boolean;
  onChange: (preferences: Preferences) => void;
  onSave: () => void;
  onManageAccount: () => void;
};

export function PreferencesView({
  preferences,
  connected,
  shortcutError,
  systemShortcut,
  saveError,
  saving,
  onChange,
  onSave,
  onManageAccount,
}: PreferencesViewProps) {
  return (
    <section
      className="content preferences"
      aria-labelledby="preferences-heading"
    >
      <div className="section-heading">
        <h1 id="preferences-heading" tabIndex={-1}>
          Preferências
        </h1>
      </div>

      <form
        aria-busy={saving}
        onSubmit={(event) => {
          event.preventDefault();
          if (!saving) onSave();
        }}
      >
        <fieldset className="preferences-fields" disabled={saving}>
          <legend>Aplicativo</legend>
          <div className="settings-group">
            <div className="setting">
              <label htmlFor="theme">Tema</label>
              <select
                id="theme"
                value={preferences.theme}
                onChange={(event) =>
                  onChange({
                    ...preferences,
                    theme: event.target.value as Preferences['theme'],
                  })
                }
              >
                <option value="system">Do sistema</option>
                <option value="light">Claro</option>
                <option value="dark">Escuro</option>
              </select>
            </div>
            <div className="setting setting-shortcut">
              <span id="shortcut-label">Atalho global</span>
              {systemShortcut ? (
                <small>
                  Configure nas opções de teclado do sistema. Use{' '}
                  <code>token-peek</code> como comando.
                </small>
              ) : (
                <ShortcutInput
                  value={preferences.shortcut}
                  error={shortcutError}
                  onChange={(shortcut) =>
                    onChange({ ...preferences, shortcut })
                  }
                />
              )}
            </div>
            <div className="setting">
              <label htmlFor="start-on-system-startup">
                Iniciar com o sistema
              </label>
              <input
                className="switch"
                id="start-on-system-startup"
                type="checkbox"
                role="switch"
                checked={preferences.startOnSystemStartup}
                onChange={(event) =>
                  onChange({
                    ...preferences,
                    startOnSystemStartup: event.target.checked,
                  })
                }
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="preferences-fields" disabled={saving}>
          <legend>Notificações</legend>
          <div className="settings-group">
            <div className="setting">
              <label htmlFor="alerts">Avisos de limite</label>
              <input
                className="switch"
                id="alerts"
                type="checkbox"
                role="switch"
                checked={preferences.alerts}
                onChange={(event) =>
                  onChange({ ...preferences, alerts: event.target.checked })
                }
              />
            </div>
            <div className="setting">
              <label htmlFor="threshold">Avisar quando restarem</label>
              <select
                id="threshold"
                value={preferences.threshold}
                disabled={!preferences.alerts}
                onChange={(event) =>
                  onChange({
                    ...preferences,
                    threshold: Number(event.target.value),
                  })
                }
              >
                {ALERT_THRESHOLDS.map((value) => (
                  <option key={value} value={value}>
                    {value}%
                  </option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>

        {saveError && (
          <p className="auth-error" role="alert">
            {saveError}
          </p>
        )}
        <button className="primary" type="submit" aria-disabled={saving}>
          <Check size={16} aria-hidden="true" />
          {saving ? 'Salvando…' : 'Salvar preferências'}
        </button>
        <button
          className="text-button"
          type="button"
          onClick={onManageAccount}
          disabled={saving}
        >
          <Link2 size={15} aria-hidden="true" />
          {connected ? 'Gerenciar conta' : 'Conectar conta'}
        </button>
      </form>
    </section>
  );
}
