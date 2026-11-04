# MA Gestão e Consultoria · Página de acesso aos Painéis CRM

Página inicial (anterior às páginas iniciais dos painéis) com um link para o Painel CRM de cada empresa atendida.

## Como adicionar ou atualizar uma empresa

Edite `lib/empresas.js`: adicione um objeto com `id`, `nome`, `descricao` e `url` (a URL pública da página inicial do painel dessa empresa). Enquanto `url` estiver vazio, o cartão aparece como "Em configuração".

## Rodar localmente

    npm install
    npm run dev

## Deploy

Crie um projeto na Vercel a partir deste repositório (sem variáveis de ambiente — a página é estática, só com links).
