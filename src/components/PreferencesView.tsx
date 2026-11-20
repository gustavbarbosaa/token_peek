import { Check, CircleHelp, Link2 } from 'lucide-react';
import type { Preferences } from '../usage';

type PreferencesViewProps = {
  preferences: Preferences;
  connected: boolean;
  onChange: (preferences: Preferences) => void;
  onSave: () => void;
  onManageAccount: () => void;
};

export function PreferencesView({
  preferences,
  connected,
  onChange,
  onSave,
  onManageAccount,
}: PreferencesViewProps) {
  return (
    <section className="content preferences">
      <h1>Do seu jeito.</h1>
      <p className="subtitle">Sempre por perto, sem interromper.</p>
      <div className="setting">
        <label htmlFor="alerts">
          Avisos de limite
          <small>Preferência para os futuros alertas</small>
        </label>
        <input
          className="switch"
          id="alerts"
          type="checkbox"
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
          onChange={(event) =>
            onChange({ ...preferences, threshold: Number(event.target.value) })
          }
        >
          {[10, 20, 30].map((value) => (
            <option key={value} value={value}>
              {value}%
            </option>
          ))}
        </select>
      </div>
      <div className="setting">
        <div>
          Atalho global<small>Será validado no ambiente Linux</small>
        </div>
        <span className="pending">Em breve</span>
      </div>
      <div className="setting">
        <div>
          Iniciar com o Linux
          <small>Disponível em uma próxima etapa</small>
        </div>
        <span className="pending">Em breve</span>
      </div>
      <div className="help">
        <CircleHelp size={16} />
        <p>
          Neste protótipo, o limite de aviso altera os estados visuais.
          Notificações do sistema ainda não são enviadas.
        </p>
      </div>
      <button className="primary" onClick={onSave}>
        <Check size={16} />
        Salvar preferências
      </button>
      <button className="text-button" onClick={onManageAccount}>
        <Link2 size={15} />
        {connected ? 'Gerenciar conta' : 'Conectar conta'}
      </button>
    </section>
  );
}
