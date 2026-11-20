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
docker compose run --rm app npm install --no-audit --no-fund
docker compose up
```

O volume `node_modules` mantém os pacotes fora da pasta do projeto. A porta fica acessível somente no computador local. Nenhuma credencial do host é montada. A imagem instala as dependências no build; o primeiro build exige acesso ao registro npm. Ainda não foi gerado um lockfile; devemos adicioná-lo assim que a instalação puder ser concluída, passando então a usar `npm ci`.

## O que já existe

- Painel compacto com limites atual e semanal, renovação e atualização simulada.
- Cenários de uso tranquilo, limite baixo e limite esgotado.
- Preferências de avisos e percentual, persistidas no armazenamento local do navegador.
- Estados visuais que respondem ao percentual configurado.
- Login com conta ChatGPT no app desktop, usando o Codex app-server.
- Base Rust com menu na bandeja: Abrir Token Peek / Sair; fechar a janela a recolhe.

Os números do painel continuam simulados. As preferências não enviam notificações do sistema nesta etapa. Inicialização automática e atalho global ainda não estão implementados.

## Autenticação

O login funciona apenas no app desktop Tauri e requer o Codex CLI instalado, com o comando `codex` disponível no `PATH`. O app inicia `codex app-server` por comunicação local via entrada e saída padrão e usa o fluxo oficial de código de dispositivo da conta ChatGPT. O código é exibido no Token Peek e a aprovação ocorre na página oficial da OpenAI.

O Token Peek não pede senha ou chave de API e não expõe tokens ao frontend. O Codex app-server gerencia a sessão em um diretório exclusivo do Token Peek, dentro dos dados locais do aplicativo. A configuração prioriza o chaveiro do sistema e usa esse diretório, restrito ao usuário no Linux, como alternativa. Conectar ou desconectar o Token Peek não altera a sessão usada pelo Codex CLI. A prévia servida pelo Docker não acessa autenticação nem credenciais.

O login já identifica a conta conectada; os indicadores de limite ainda são exemplos e serão ligados aos dados reais em uma etapa posterior.

## Desktop e Docker

A prévia web serve para desenvolver o design. O contêiner atual não executa a janela Tauri. Bandeja, janela e atalhos dependem da sessão gráfica do Linux. Rodar o desktop dentro de um contêiner exigiria configurar o acesso a Wayland/X11 e D-Bus; isso será tratado separadamente. Não usamos contêiner privilegiado nem montamos a sessão gráfica nesta etapa.

Para executar nativamente no futuro, instale Rust e os requisitos do Tauri para sua distribuição (https://v2.tauri.app/start/prerequisites/), depois:

```sh
npm install
npm run desktop
```

No Linux, usamos o menu da bandeja porque eventos de clique direto no ícone não são suportados pelo Tauri. Alguns ambientes gráficos também precisam habilitar suporte a indicadores. O comportamento desktop ainda precisa ser compilado e testado em uma sessão Linux real.

## Organização

- `src/main.tsx`: ponto de entrada React.
- `src/App.tsx`: estado global, navegação entre telas e composição do painel.
- `src/components/`: componentes do cabeçalho, rodapé, painel, preferências e conexão.
- `src/hooks/useAccount.ts`: estado e ações da autenticação no Tauri.
- `src/styles.css`: identidade visual e layout responsivo.
- `src/usage.ts`: fonte de dados simulados, contagem regressiva e leitura de preferências.
- `src-tauri/src/main.rs`: inicialização do Tauri e registro dos comandos.
- `src-tauri/src/auth/`: protocolo do Codex app-server, comandos e modelos de autenticação.
- `src-tauri/src/tray.rs`: menu da bandeja e comportamento ao fechar a janela.
- `src-tauri/tauri.conf.json`: configuração do aplicativo desktop.

## Estado de validação neste ambiente

Não foi possível validar esta alteração neste ambiente: o acesso ao Docker socket foi negado, as dependências npm não estão instaladas no host e Rust/Cargo não estão disponíveis. O build desktop ainda precisa ser conferido em uma máquina com Docker ou Rust configurados.
