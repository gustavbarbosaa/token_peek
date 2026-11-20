import { Activity } from 'lucide-react';
import type { AccountStatus } from '../types/auth';

type AppHeaderProps = {
  account: AccountStatus | null;
};

export function AppHeader({ account }: AppHeaderProps) {
  return (
    <header className="header">
      <div className="brand">
        <span className="brand-icon" aria-hidden="true">
          <Activity size={20} />
        </span>
        <span>Token Peek</span>
      </div>
      <div className="account" role="status">
        <span
          className={account?.connected ? 'status-dot online' : 'status-dot'}
        />
        {account?.connected && account.name ? (
          <span>
            <span className="sr-only">Conta conectada: </span>
            {account.name}
          </span>
        ) : (
          <span>
            {account?.connected
              ? 'Conta conectada'
              : account
                ? 'Conta desconectada'
                : 'Conta não verificada'}
          </span>
        )}
      </div>
    </header>
  );
}
