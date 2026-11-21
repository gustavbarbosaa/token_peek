# Token Peek

Protótipo de um aplicativo Linux para consultar os limites do Codex. Interface em React + TypeScript; base desktop em Tauri 2 + Rust.

## Desenvolvimento com Docker

É necessário ter Docker Engine e o plugin Compose. Node, npm e as dependências da interface ficam no contêiner.

```sh
cd token-peek
docker compose up --build
```

Abra http://localhost:1420. As alterações em `src/` aparecem automaticamente no navegador.

```sh
# Verificar tipos e gerar a versão de produção da interface
docker compose run --rm app npm run build

# Encerrar sem apagar dependências
docker compose down
```

## Qualidade do código

Execute os comandos npm no contêiner:

```sh
docker compose run --rm app npm run lint
docker compose run --rm app npm run lint:fix
docker compose run --rm app npm run format
docker compose run --rm app npm run format:check
```

O Husky executa `lint-staged` antes de cada commit, chamando o contêiner Docker para usar as dependências do projeto. Ele corrige ESLint e Prettier nos arquivos TypeScript/JavaScript preparados e aplica Prettier aos demais arquivos compatíveis. O hook é ativado pelo script `prepare` após a instalação das dependências em um repositório Git.

Após alterar `package.json`, reconstrua e atualize o volume de dependências:

```sh
docker compose build
docker compose run --rm app npm ci --no-audit --no-fund
docker compose up
```

O volume `node_modules` mantém os pacotes fora da pasta do projeto. A porta fica acessível somente no computador local. Nenhuma credencial do host é montada. A imagem instala as dependências no build; o primeiro build exige acesso ao registro npm. O repositório inclui `package-lock.json`, então o Docker pode usar `npm ci` para instalar as versões travadas.

## O que já existe

- Painel de consumo com percentuais usados e janelas de limite retornadas pelo Codex.
- Atualização ao receber eventos do Codex, ao voltar ao painel e a cada 30 segundos enquanto a conta estiver conectada.
- Preferências de avisos e percentual, persistidas no armazenamento local do navegador.
- Estados visuais que respondem ao percentual configurado.
- Login com conta ChatGPT no app desktop, usando o Codex app-server.
- Base Rust com menu na bandeja: barras compactas para o consumo das janelas, abrir o painel completo / sair; fechar a janela a recolhe.

O aplicativo desktop oferece avisos de limite, inicialização automática e um atalho global configurável. O atalho depende do suporte do ambiente gráfico.

## Autenticação

O login funciona no aplicativo desktop Tauri. O Snap inclui o Codex CLI. No pacote Debian e no desenvolvimento local, instale o CLI e disponibilize o comando `codex` no `PATH`. O app inicia `codex app-server` por comunicação local via entrada e saída padrão e oferece login no navegador e login por código de dispositivo. A autorização ocorre na página oficial da OpenAI. Para usar o código, o login por dispositivo precisa estar habilitado na conta ou no espaço de trabalho.

O Token Peek não pede senha ou chave de API e não expõe tokens ao frontend. O Codex app-server gerencia a sessão em um diretório exclusivo do Token Peek, dentro dos dados locais do aplicativo. No Linux, o Codex usa armazenamento em arquivo nesse diretório privado, com acesso restrito ao usuário. A migração do modo automático para o armazenamento em arquivo pode exigir uma nova conexão se a sessão anterior estiver apenas no chaveiro. Conectar ou desconectar o Token Peek não altera a sessão usada pelo Codex CLI. A prévia servida pelo Docker não acessa autenticação nem credenciais.

Com a conta conectada, o Token Peek consulta `account/rateLimits/read` pelo Codex app-server. A interface recebe somente percentuais de consumo, duração das janelas e horários de renovação; tokens de autenticação permanecem gerenciados pelo app-server. Os limites exibidos dependem das janelas que o Codex retornar para o plano e a conta.

## Desktop e Docker

A prévia web serve para desenvolver o design. O contêiner atual não executa a janela Tauri. Bandeja, janela e atalhos dependem da sessão gráfica do Linux. Rodar o desktop dentro de um contêiner exigiria configurar o acesso a Wayland/X11 e D-Bus; isso será tratado separadamente. Não usamos contêiner privilegiado nem montamos a sessão gráfica nesta etapa.

### Testar o desktop no Linux (Debian/Ubuntu)

Instale as dependências de sistema do Tauri e o Rust. Os comandos abaixo são para Debian/Ubuntu; outras distribuições devem usar os pacotes equivalentes descritos nos pré-requisitos oficiais do Tauri.

```sh
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
```

Reabra o terminal após instalar o Rust. Instale as dependências JavaScript no host e inicie a janela desktop:

```sh
npm ci
npm run desktop
```

O `node_modules` do host é separado do volume npm usado pelo Docker.

### Gerar e instalar o pacote

No host, com as dependências de desenvolvimento já instaladas:

```sh
npm ci
npm run tauri build -- --bundles deb -- --locked
```

O instalador fica em `src-tauri/target/release/bundle/deb/`. Quem for apenas usar o app pode baixar o `.deb` e instalar com `sudo apt install ./nome-do-arquivo.deb`. O Codex CLI precisa estar instalado separadamente para conectar a conta e consultar os limites.

### Snap para Ubuntu (amd64)

O Snap inclui o cliente nativo do Codex e usa confinamento estrito. Para gerar um pacote de teste, execute o workflow manual **Snap de teste** no GitHub Actions e baixe o artefato. Para compilar localmente, execute `snapcraft pack` na raiz do projeto com Snapcraft e um provedor de build configurados.

Extraia o arquivo do artefato e, em uma máquina Ubuntu de teste, execute na pasta do pacote:

```bash
sudo snap install --dangerous ./token-peek_0.1.4_amd64.snap
snap run token-peek
```

A opção `--dangerous` permite instalar o arquivo local sem assinatura da loja. Para validar a experiência de quem instala pela primeira vez, use uma sessão gráfica limpa, abra o app, conecte a conta e confira a leitura dos limites. Feche a janela e reabra pela bandeja. Ative **Iniciar com o sistema**, encerre a sessão e entre novamente. O workflow gera um artefato de teste e a publicação na Snap Store é uma etapa posterior.

### Disponibilizar no GitHub

1. Versione o código e os arquivos de lock usados no build.
2. Crie uma release em rascunho no GitHub, com uma tag correspondente à versão (por exemplo, `v0.1.0`) apontando para o commit do pacote.
3. Anexe o `.deb` e o checksum SHA-256, descreva quais versões e arquiteturas do Linux foram verificadas e publique a release quando estiver pronta.

Para distribuir a versões anteriores do Ubuntu ou Debian, gere o pacote na versão mais antiga que deseja suportar e valide a instalação nela. O binário usa bibliotecas do sistema que podem ter versões mais novas na máquina de build.

### Atalho global no Wayland

No GNOME com Wayland, abra **Configurações → Teclado → Ver e personalizar atalhos → Atalhos personalizados**. Crie um atalho chamado **Abrir Token Peek**, com o comando `token-peek`, e escolha uma combinação livre, como **Ctrl+Alt+X**. Ao executar o comando novamente, o app reabre o painel da instância existente. Em X11, o atalho continua disponível nas preferências do Token Peek.

No Linux, o painel rápido fica no menu da bandeja. Alguns ambientes gráficos precisam de suporte a indicadores habilitado. Valide bandeja, atalhos e notificações em uma sessão gráfica antes de distribuir.

## Organização

- `src/main.tsx`: ponto de entrada React.
- `src/App.tsx`: estado global, navegação entre telas e composição do painel.
- `src/components/`: componentes do cabeçalho, rodapé, painel, preferências e conexão.
- `src/hooks/useAccount.ts`: estado e ações da autenticação no Tauri.
- `src/styles.css`: identidade visual e layout responsivo.
- `src/usage.ts`: tipos do consumo e formatação das janelas de limite.
- `src/preferences.ts`: opções padrão, leitura e gravação das preferências.
- `src/hooks/usePreferences.ts`: edição das preferências e integração com o tema, o atalho e a inicialização do sistema.
- `src/hooks/useUsage.ts`: leitura dos limites via Tauri por evento, ao recuperar foco ou conexão e por consulta periódica.
- `src-tauri/src/main.rs`: inicialização do Tauri e registro dos comandos.
- `src-tauri/src/auth/`: protocolo do Codex app-server, autenticação, consumo e modelos.
- `src-tauri/src/tray.rs`: menu da bandeja e comportamento ao fechar a janela.
- `src-tauri/tauri.conf.json`: configuração do aplicativo desktop.

## Integração contínua

O GitHub Actions usa os arquivos de versões travadas para verificar o frontend e a integração Rust. A rotina roda lint, formatação, build, `cargo check` e auditoria das dependências dos dois ecossistemas. Atalhos, bandeja e notificações devem ser conferidos em uma sessão gráfica.
