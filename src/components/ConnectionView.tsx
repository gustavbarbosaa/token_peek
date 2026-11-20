import { ChevronLeft, ExternalLink, Link2, ShieldCheck } from 'lucide-react';
import { isTauri } from '@tauri-apps/api/core';
import type { AccountStatus, LoginMethod, LoginPrompt } from '../types/auth';

type ConnectionViewProps = {
  account: AccountStatus | null;
  loginPrompt: LoginPrompt | null;
  loading: boolean;
  error: string;
  onBack: () => void;
  onConnect: (method: LoginMethod) => void;
  onDisconnect: () => void;
  onCancel: () => void;
  onOpenVerificationPage: () => void;
};

export function ConnectionView({
  account,
  loginPrompt,
  loading,
  error,
  onBack,
  onConnect,
  onDisconnect,
  onCancel,
  onOpenVerificationPage,
}: ConnectionViewProps) {
  return (
    <section
      className="content connection"
      aria-labelledby="connection-heading"
    >
      <button className="text-button back" onClick={onBack}>
        <ChevronLeft size={15} />
        Voltar
      </button>
      <div className="connection-icon">
        <Link2 size={27} />
      </div>
      <h1 id="connection-heading" tabIndex={-1}>
        {account?.connected ? 'Conta conectada' : 'Conectar conta'}
      </h1>
      <p className="subtitle">
        {account?.connected
          ? `${account.name || 'Conta ChatGPT'}${
              account.planType ? ` · plano ${account.planType}` : ''
            }`
          : 'Entre com sua conta ChatGPT para autorizar o Token Peek.'}
      </p>
      <div className="help">
        <ShieldCheck size={19} />
        <p>
          Você autoriza o acesso na página da OpenAI. O Token Peek não pede sua
          senha.
        </p>
      </div>
      {!isTauri() && (
        <p className="auth-error">
          A autenticação funciona no aplicativo desktop. Esta prévia web não
          acessa contas ou credenciais.
        </p>
      )}
      {loginPrompt && !account?.connected && (
        <div className="login-code">
          {loginPrompt.userCode ? (
            <>
              <p className="sr-only" role="status">
                Código pronto para autorizar a conta.
              </p>
              <span>Código de autorização</span>
              <strong>{loginPrompt.userCode}</strong>
              <small>
                Digite o código na página da OpenAI e autorize o acesso.
              </small>
            </>
          ) : (
            <p className="subtitle" role="status">
              Conclua o login no navegador e volte ao Token Peek.
            </p>
          )}
          <button className="text-button" onClick={onOpenVerificationPage}>
            <ExternalLink size={15} />
            {loginPrompt.userCode
              ? 'Abrir página da OpenAI'
              : 'Reabrir página de login'}
          </button>
          <button className="text-button" onClick={onCancel}>
            Cancelar conexão
          </button>
        </div>
      )}
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {account?.connected ? (
        <button
          className="text-button"
          onClick={onDisconnect}
          disabled={loading}
        >
          Desconectar conta
        </button>
      ) : (
        !loginPrompt && (
          <>
            <button
              className="primary"
              onClick={() => onConnect('browser')}
              disabled={!isTauri() || loading}
            >
              {loading
                ? 'Preparando conexão…'
                : 'Entrar com ChatGPT pelo navegador'}
            </button>
            {isTauri() && (
              <button
                className="text-button"
                onClick={() => onConnect('device')}
                disabled={loading}
              >
                Entrar com código de dispositivo
              </button>
            )}
          </>
        )
      )}
    </section>
  );
}
