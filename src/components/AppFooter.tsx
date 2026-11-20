import { ArrowDownToLine, RefreshCw } from 'lucide-react';
import { isTauri } from '@tauri-apps/api/core';

type AppFooterProps = {
  updatedAt: number;
  now: number;
  onRefresh: () => void;
};

export function AppFooter({ updatedAt, now, onRefresh }: AppFooterProps) {
  const minutesAgo = Math.max(0, Math.floor((now - updatedAt) / 60_000));

  return (
    <>
      <footer>
        <span>
          Atualizado {minutesAgo === 0 ? 'agora' : `há ${minutesAgo} min`}
        </span>
        <button onClick={onRefresh}>
          <RefreshCw size={13} />
          Atualizar
        </button>
      </footer>
      <div className="bottom-hint">
        <ArrowDownToLine size={13} />
        {isTauri()
          ? 'Fechar a janela mantém o app na bandeja.'
          : 'Prévia no navegador · integração desktop via Tauri'}
      </div>
    </>
  );
}
