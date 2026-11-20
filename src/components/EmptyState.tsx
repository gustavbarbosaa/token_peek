import { Activity } from 'lucide-react';

type EmptyStateProps = { onOpen: () => void };

export function EmptyState({ onOpen }: EmptyStateProps) {
  return (
    <div className="empty">
      <Activity size={36} />
      <h1>Perto, quando precisar.</h1>
      <p>O painel está recolhido nesta prévia.</p>
      <button className="primary" onClick={onOpen}>
        Abrir Token Peek
      </button>
    </div>
  );
}
