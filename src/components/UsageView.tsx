import { Bell, ShieldCheck, Clock3 } from 'lucide-react';
import { countdown, type Scenario, type UsageSnapshot } from '../usage';

type UsageViewProps = {
  usage: UsageSnapshot;
  scenario: Scenario;
  threshold: number;
  now: number;
  onScenarioChange: (scenario: Scenario) => void;
};

export function UsageView({
  usage,
  scenario,
  threshold,
  now,
  onScenarioChange,
}: UsageViewProps) {
  const low = usage.current.remaining <= threshold;
  const exhausted = usage.current.remaining === 0;

  return (
    <section className="content">
      <div className="section-heading">
        <h1>SEUS LIMITES DO CODEX</h1>
        <span className="live-label">DADOS SIMULADOS</span>
      </div>
      <div className="metric-heading">
        <h2>Janela atual</h2>
        <span>5 horas · exemplo</span>
      </div>
      <div className={'big-number ' + (low ? 'warning-text' : '')}>
        {usage.current.remaining}
        <span>%</span>
        <small>restantes</small>
      </div>
      <div
        className={'segments ' + (low ? 'warning' : '')}
        role="progressbar"
        aria-label="Limite atual restante"
        aria-valuenow={usage.current.remaining}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${usage.current.remaining}% restantes`}
      >
        {Array.from({ length: 25 }, (_, index) => (
          <i
            key={index}
            className={
              index < Math.ceil(usage.current.remaining / 4) ? 'filled' : ''
            }
          />
        ))}
      </div>
      <div className="renewal">
        <span>
          <Clock3 size={13} />
          Renova em
        </span>
        <strong>{countdown(usage.current.resetsAt, now)}</strong>
      </div>
      <div className="divider" />
      <div className="metric-heading">
        <h2>Limite semanal</h2>
        <span>7 dias · exemplo</span>
      </div>
      <div className="weekly-value">
        <strong>
          {usage.weekly.remaining}
          <span>%</span>
        </strong>
        <span>restantes</span>
      </div>
      <div
        className="week-bar"
        role="progressbar"
        aria-label="Limite semanal restante"
        aria-valuenow={usage.weekly.remaining}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${usage.weekly.remaining}% restantes`}
      >
        <div style={{ width: `${usage.weekly.remaining}%` }} />
      </div>
      <div className="renewal">
        <span>Próxima renovação</span>
        <strong>
          {new Intl.DateTimeFormat('pt-BR', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          }).format(usage.weekly.resetsAt)}
        </strong>
      </div>
      <aside className={'callout ' + (low ? 'warning' : '')}>
        {low ? <Bell size={17} /> : <ShieldCheck size={18} />}
        <div>
          <strong>
            {exhausted
              ? 'Hora de uma pausa'
              : low
                ? 'Seu limite está chegando ao fim'
                : 'Pode seguir no seu ritmo'}
          </strong>
          <p>
            {exhausted
              ? 'O limite desta janela acabou no cenário simulado.'
              : low
                ? `Restam ${usage.current.remaining}% nesta janela. Confira o tempo até a renovação.`
                : 'Você tem limite disponível para continuar.'}
          </p>
        </div>
      </aside>
      <div className="demo">
        <label htmlFor="scenario">Explorar cenários</label>
        <select
          id="scenario"
          value={scenario}
          onChange={(event) =>
            onScenarioChange(event.target.value as Scenario)
          }
        >
          <option value="normal">Uso tranquilo</option>
          <option value="low">Limite baixo</option>
          <option value="exhausted">Limite esgotado</option>
        </select>
      </div>
    </section>
  );
}
