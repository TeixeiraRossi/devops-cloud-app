# Estação Jogável

Loja de jogos digitais da Atividade Avaliativa N3 de DevOps & Cloud Computing. A API Node.js serve o catálogo e o formulário. O MySQL guarda os jogos e o Redis mantém a lista em cache por até 30 segundos.

## Docker Compose

1. Copie `.env.example` para `.env`. Os valores de exemplo são fictícios e próprios para o laboratório local.
2. Na raiz, execute `docker compose up -d --build` e acompanhe com `docker compose ps`.
3. Abra http://localhost:3000 e cadastre um jogo. Para comprovar a persistência, execute `docker compose down`, suba com `docker compose up -d` e consulte o mesmo jogo. O volume nomeado é preservado pelo `down` comum.

A imagem `estacao-jogavel:1.0` também pode ser gerada na raiz com `docker build -t estacao-jogavel:1.0 app`. O Dockerfile usa a imagem slim do Node, instala as dependências conforme o lockfile e executa a API como usuário `node`.

## Rotas

| Rota | Uso |
|---|---|
| `GET /` | Página do catálogo e formulário |
| `GET /jogos` | Lista os jogos. O cabeçalho `X-Cache` mostra `HIT` ou `MISS` |
| `POST /jogos` | Cria um jogo e invalida o cache |
| `GET /health` | Verifica se o processo da API responde |
| `GET /ready` | Verifica se MySQL e Redis respondem |

A configuração é fornecida por `PORT`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` e `REDIS_URL`. A API cria a tabela `jogos` no primeiro acesso ao banco.
