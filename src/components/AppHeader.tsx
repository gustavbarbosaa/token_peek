import { Activity, Settings, X } from 'lucide-react';
import type { AccountStatus } from '../types/auth';

type AppHeaderProps = {
  account: AccountStatus | null;
  showPreferences: boolean;
  onTogglePreferences: () => void;
  onHide: () => void;
};

export function AppHeader({
  account,
  showPreferences,
  onTogglePreferences,
  onHide,
}: AppHeaderProps) {
  return (
    <>
      <header className="header">
        <div className="brand">
          <span className="brand-icon">
            <Activity size={20} />
          </span>
          <span>Token Peek</span>
        </div>
        <div className="actions">
          <button
            className={showPreferences ? 'icon-button active' : 'icon-button'}
            aria-label="Preferências"
            onClick={onTogglePreferences}
          >
            <Settings size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="Recolher painel"
            onClick={onHide}
          >
            <X size={18} />
          </button>
        </div>
      </header>
      <div className="account">
        <span>
          <span className="status-dot" />
          {account?.connected
            ? account.email || 'Conta conectada'
            : 'Modo demonstração'}
        </span>
        <span className="badge">
          {account?.connected ? 'CONECTADA' : 'SEM CONTA'}
        </span>
      </div>
    </>
  );
}
