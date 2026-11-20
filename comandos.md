# Operação do cluster

Roteiro de execução da N3 no contexto `docker-desktop`, namespace `n3-guilherme`. Guarde as saídas reais no relatório. Os resultados descritos aqui são os critérios de validação.

## 1. Escala manual

```sh
kubectl -n n3-guilherme get deployment api
kubectl -n n3-guilherme scale deployment/api --replicas=4
kubectl -n n3-guilherme get deployment api -w
```

Quando aparecer `4/4` em READY, guarde a saída e encerre o acompanhamento com Ctrl+C. Volte para duas réplicas e aguarde `2/2`.

```sh
kubectl -n n3-guilherme scale deployment/api --replicas=2
kubectl -n n3-guilherme get deployment api -w
```

## 2. Rollout de 1.0 para 2.0

Na raiz do projeto atualizado, gere a nova imagem no Docker Desktop. O argumento `APP_VERSION` define a versão que o catálogo e o `/health` mostram. A tag identifica a imagem que o Kubernetes deve executar.

```sh
kubectl config current-context
kubectl -n n3-guilherme get deployment api -o wide
docker build --build-arg APP_VERSION=2.0 -t estacao-jogavel:2.0 app
```

Com a API ainda em `1.0`, abra outro terminal e monitore a rota `/health` pelo Service de dentro do cluster. Aguarde a primeira resposta com `versao: 1.0` antes de atualizar.

```sh
kubectl -n n3-guilherme run monitor-rollout --image=busybox:1.36 --restart=Never --command -- sh -c 'while true; do if resposta=$(wget -T 2 -qO- http://api:3000/health); then echo "$(date +%T) $resposta"; else echo "$(date +%T) FALHA HTTP"; fi; sleep 1; done'
kubectl -n n3-guilherme wait --for=condition=Ready pod/monitor-rollout --timeout=120s
kubectl -n n3-guilherme logs -f pod/monitor-rollout
```

Deixe os logs rodando e aplique a versão `2.0` no primeiro terminal.

```sh
kubectl -n n3-guilherme set image deployment/api api=estacao-jogavel:2.0
kubectl -n n3-guilherme rollout status deployment/api --timeout=180s
kubectl -n n3-guilherme rollout history deployment/api
kubectl -n n3-guilherme get deployment api -o wide
```

Guarde o histórico e as respostas do monitor mostrando a transição. Se aparecer `FALHA HTTP`, registre e investigue antes de afirmar que a atualização foi contínua. Abra a loja pelo Service e confira o selo `v2.0`. Pare de acompanhar os logs com Ctrl+C e remova o pod temporário.

```sh
kubectl -n n3-guilherme delete pod monitor-rollout
```
