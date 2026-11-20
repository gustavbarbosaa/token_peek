import { ChevronLeft, ExternalLink, Link2, ShieldCheck } from 'lucide-react';
import { isTauri } from '@tauri-apps/api/core';
import type { AccountStatus, LoginPrompt } from '../types/auth';

type ConnectionViewProps = {
  account: AccountStatus | null;
  loginPrompt: LoginPrompt | null;
  loading: boolean;
  error: string;
  onBack: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onCancel: () => void;
  onOpenVerificationPage: () => void;
  onContinueDemo: () => void;
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
  onContinueDemo,
}: ConnectionViewProps) {
  return (
    <section className="content connection">
      <button className="text-button back" onClick={onBack}>
        <ChevronLeft size={15} />
        Voltar
      </button>
      <div className="connection-icon">
        <Link2 size={27} />
      </div>
      <h1>{account?.connected ? 'Conta conectada.' : 'Conecte sua conta.'}</h1>
      <p className="subtitle">
        {account?.connected
          ? `${account.email || 'Conta ChatGPT'}${
              account.planType ? ` · plano ${account.planType}` : ''
            }`
          : 'Entre com sua conta ChatGPT para autorizar o Token Peek.'}
      </p>
      <div className="help">
        <ShieldCheck size={19} />
        <p>
          O Codex app-server gerencia o login e a sessão em um espaço isolado. A
          interface do Token Peek não recebe tokens.
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
          <span>CÓDIGO DE AUTORIZAÇÃO</span>
          <strong>{loginPrompt.userCode}</strong>
          <button className="text-button" onClick={onOpenVerificationPage}>
            <ExternalLink size={15} />
            Abrir página segura da OpenAI
          </button>
          <small>Digite o código acima e aprove o acesso.</small>
          <button className="text-button" onClick={onCancel}>
            Cancelar conexão
          </button>
        </div>
      )}
      {error && <p className="auth-error">{error}</p>}
      {account?.connected ? (
        <button
          className="text-button"
          onClick={onDisconnect}
          disabled={loading}
        >
          Desconectar conta
        </button>
      ) : (
        <button
          className="primary"
          onClick={onConnect}
          disabled={!isTauri() || loading || !!loginPrompt}
        >
          {loading
            ? 'Preparando conexão…'
            : loginPrompt
              ? 'Aguardando autorização…'
              : 'Entrar com ChatGPT'}
        </button>
      )}
      <button className="text-button" onClick={onContinueDemo}>
        Continuar na demonstração
      </button>
    </section>
  );
}
