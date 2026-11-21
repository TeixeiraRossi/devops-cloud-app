# lojinho de joguin

Loja de jogos digitais da Atividade Avaliativa N3 de DevOps & Cloud Computing. A API Node.js serve o catálogo e o formulário. O MySQL guarda os jogos e o Redis mantém a lista em cache por até 30 segundos.

## Docker Compose

1. Copie `.env.example` para `.env`. Os valores de exemplo são fictícios e próprios para o laboratório local.
2. Na raiz, execute `docker compose up -d --build` e acompanhe com `docker compose ps`.
3. Abra http://localhost:3000 e cadastre um jogo. Para comprovar a persistência, execute `docker compose down`, suba com `docker compose up -d` e consulte o mesmo jogo. O volume nomeado é preservado pelo `down` comum.

A imagem `lojinho:1.0` também pode ser gerada na raiz com `docker build -t lojinho:1.0 app`. O Dockerfile usa a imagem slim do Node, instala as dependências conforme o lockfile e executa a API como usuário `node`.

## Rotas

| Rota | Uso |
|---|---|
| `GET /` | Página do catálogo e formulário |
| `GET /jogos` | Lista os jogos. O cabeçalho `X-Cache` mostra `HIT` ou `MISS` |
| `POST /jogos` | Cria um jogo e invalida o cache |
| `GET /health` | Verifica se o processo da API responde |
| `GET /ready` | Verifica se MySQL e Redis respondem |

A configuração é fornecida por `PORT`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` e `REDIS_URL`. A API cria a tabela `jogos` no primeiro acesso ao banco.

## Kubernetes no Docker Desktop (kubeadm)

Na área **Kubernetes** do Docker Desktop, habilite ou crie um cluster **kubeadm**. No terminal, selecione o contexto local e confira se o nó está `Ready` e existe uma StorageClass padrão para o PVC do MySQL.

```sh
kubectl config use-context docker-desktop
kubectl get nodes
kubectl get storageclass
```

Na raiz do repositório, gere a imagem com a mesma tag do Deployment (ou reaproveite a imagem criada pelo Compose) e aplique os manifestos. A API usa a imagem local quando ela está disponível no nó, graças a `IfNotPresent`.

```sh
docker build -t lojinho:1.0 app
kubectl apply -f k8s/
kubectl -n n3-guilherme-ana rollout status deployment/api --timeout=180s
kubectl -n n3-guilherme-ana get all
kubectl -n n3-guilherme-ana get pvc
kubectl -n n3-guilherme-ana describe deployment api
```

O Service `api` tem uma porta externa atribuída pelo cluster. Confira o valor e acesse `http://localhost:<NODE_PORT>`. Se o NodePort não responder no Mac, faça o encaminhamento abaixo e abra http://localhost:8080 enquanto o comando estiver rodando.

```sh
kubectl -n n3-guilherme-ana get service api
kubectl -n n3-guilherme-ana port-forward service/api 8080:3000
```

A readiness em `/ready` espera MySQL e Redis antes de o Service encaminhar tráfego ao pod. A liveness em `/health` só verifica se o processo HTTP está respondendo. O Deployment da API começa com duas réplicas. Os valores de CPU e memória são um ponto de partida para a prática e podem ser ajustados depois de medir a aplicação.

### Prova de persistência

1. Abra a loja pelo Service e cadastre um jogo de teste. O MySQL do Kubernetes tem seu próprio armazenamento, então cadastre um registro novo mesmo se já houver um no Compose.
2. Guarde a saída de `get pods` e da consulta abaixo. Apague **apenas o pod** do banco.
3. Confirme visualmente que há um pod com **novo nome** e aguarde até ficar `1/1 Ready`. Repita a consulta SQL e guarde a saída com o mesmo ID e título. A consulta direta ao MySQL evita usar o cache do Redis como prova.

```sh
kubectl -n n3-guilherme-ana get pods -l app=mysql
kubectl -n n3-guilherme-ana exec deployment/mysql -- sh -ec 'MYSQL_PWD="$MYSQL_PASSWORD" mysql -h 127.0.0.1 -u "$MYSQL_USER" "$MYSQL_DATABASE" -e "SELECT id, titulo FROM jogos ORDER BY id DESC LIMIT 5;"'
kubectl -n n3-guilherme-ana delete pod -l app=mysql
kubectl -n n3-guilherme-ana get pods -l app=mysql -w
```

O MySQL usa uma réplica e a estratégia `Recreate` para evitar sobreposição durante atualizações do Deployment. O pod novo usa o mesmo PVC `mysql-dados`. O Redis pode iniciar vazio, pois o catálogo é reconstruído a partir do MySQL.

Se o pod da API ficar em `ImagePullBackOff`, confira o contexto do Docker, a tag com `docker image inspect lojinho:1.0` e os eventos do pod com `kubectl -n n3-guilherme-ana describe pod <POD_API>`. Em um cluster remoto, coloque a imagem em um registro acessível e ajuste a referência no Deployment.

## Exercícios de operação

Siga o [roteiro de comandos](comandos.md) para escalar a API, atualizar para a versão `2.0`, testar o rollback e acompanhar os recursos e o HPA.
