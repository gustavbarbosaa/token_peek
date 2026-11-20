import { useEffect, useState } from 'react';
import { Bell, Clock3 } from 'lucide-react';
import {
  countdown,
  formatWindowDuration,
  type UsageLimit,
  type UsageSnapshot,
} from '../usage';

type UsageViewProps = {
  usage: UsageSnapshot | null;
  connected: boolean;
  desktop: boolean;
  loading: boolean;
  error: string;
  threshold: number;
  onConnect: () => void;
};

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

function RenewalCountdown({ resetsAt }: { resetsAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    function tick() {
      const current = Date.now();
      setNow(current);
      const remaining = resetsAt - current;
      if (remaining > 0) {
        timer = setTimeout(tick, remaining % 60_000 || 60_000);
      }
    }

    timer = setTimeout(tick, 0);
    return () => clearTimeout(timer);
  }, [resetsAt]);

  return <strong>{countdown(resetsAt, now)}</strong>;
}

function UsageWindow({
  limit,
  stale,
  threshold,
}: {
  limit: UsageLimit;
  stale: boolean;
  threshold: number;
}) {
  const remaining = 100 - limit.usedPercent;
  const low = remaining <= threshold;
  const label =
    limit.window === 'primary' ? 'Janela principal' : 'Janela secundária';

  const resetsAt = limit.resetsAt ? limit.resetsAt * 1000 : null;

  return (
    <article className="usage-window">
      <div className="metric-heading">
        <h2>{label}</h2>
        <span>{formatWindowDuration(limit.windowDurationMins)}</span>
      </div>
      <div className="metric-values">
        <div
          className={low ? 'big-number warning-text' : 'big-number'}
          aria-hidden="true"
        >
          {limit.usedPercent}
          <span>%</span>
          <small>usados</small>
        </div>
        <p className="remaining">
          <strong>{remaining}%</strong> restantes
        </p>
      </div>
      <div
        className={'segments ' + (low ? 'warning' : '')}
        role="meter"
        aria-label={`Consumo da ${label.toLowerCase()}`}
        aria-valuenow={limit.usedPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${limit.usedPercent}% consumido`}
      >
        {Array.from({ length: 25 }, (_, index) => (
          <i
            key={index}
            className={index < Math.ceil(limit.usedPercent / 4) ? 'filled' : ''}
          />
        ))}
      </div>
      {resetsAt !== null && (
        <div className="renewal">
          <span>
            <Clock3 size={14} aria-hidden="true" />
            {stale ? 'Renovação prevista' : 'Renova em'}
          </span>
          {stale ? (
            <time dateTime={new Date(resetsAt).toISOString()}>
              {dateTime.format(resetsAt)}
            </time>
          ) : (
            <RenewalCountdown resetsAt={resetsAt} />
          )}
        </div>
      )}
    </article>
  );
}

export function UsageView({
  usage,
  connected,
  desktop,
  loading,
  error,
  threshold,
  onConnect,
}: UsageViewProps) {
  const stale = Boolean(error && usage);
  const lowestRemaining = usage
    ? Math.min(...usage.limits.map((limit) => 100 - limit.usedPercent))
    : 100;
  const low = lowestRemaining <= threshold;
  const exhausted = lowestRemaining === 0;

  return (
    <section className="content" aria-labelledby="usage-heading">
      <div className="section-heading">
        <h1 id="usage-heading" tabIndex={-1}>
          Uso do Codex
        </h1>
      </div>

      {stale && usage && (
        <div className="usage-stale" role="status">
          <strong>Dados desatualizados</strong>
          <p>
            Última leitura em{' '}
            <time dateTime={new Date(usage.updatedAt).toISOString()}>
              {dateTime.format(usage.updatedAt)}
            </time>
            .
          </p>
        </div>
      )}

      {!desktop ? (
        <div className="usage-message">
          <p>Os limites reais ficam disponíveis no aplicativo desktop.</p>
        </div>
      ) : !connected ? (
        <div className="usage-message">
          <p>
            Conecte sua conta ChatGPT para consultar o consumo e os limites.
          </p>
          <button className="primary" onClick={onConnect}>
            Conectar conta
          </button>
        </div>
      ) : loading && !usage ? (
        <div className="usage-message" role="status">
          <p>Buscando os limites atuais da sua conta…</p>
        </div>
      ) : error && !usage ? (
        <div className="usage-message" role="alert">
          <p>{error}</p>
          <small>
            Confira a conexão da conta ou reconecte-a nas preferências.
          </small>
        </div>
      ) : usage?.limits.length ? (
        <>
          <div className="usage-windows">
            {usage.limits.map((limit) => (
              <UsageWindow
                key={limit.window}
                limit={limit}
                stale={stale}
                threshold={threshold}
              />
            ))}
          </div>
          {!stale && low && (
            <aside className="callout warning">
              <Bell size={17} aria-hidden="true" />
              <strong>
                {exhausted
                  ? 'Uma janela atingiu o limite'
                  : 'Consumo próximo do limite'}
              </strong>
            </aside>
          )}
        </>
      ) : (
        <div className="usage-message">
          <p>O Codex não informou janelas de limite para esta conta.</p>
          <small>Isso pode variar conforme o plano e o estado da conta.</small>
        </div>
      )}
    </section>
  );
}
