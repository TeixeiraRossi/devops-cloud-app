# Operação do cluster

Roteiro de execução da N3 no contexto `docker-desktop`, namespace `n3-guilherme`. Guarde as saídas reais no relatório. Os passos 1 e 2 trazem o roteiro de execução. Os passos 3 a 6 também registram os resultados observados no laboratório.

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

## 3. Falha proposital e rollback

```powershell
kubectl -n n3-guilherme get deployment api -o wide
kubectl -n n3-guilherme set image deployment/api api=estacao-jogavel:tag-inexistente-n3
kubectl -n n3-guilherme get pods -l app=api -w
kubectl -n n3-guilherme describe pod NOME_DO_POD_COM_ERRO
kubectl -n n3-guilherme rollout undo deployment/api
kubectl -n n3-guilherme rollout status deployment/api --timeout=180s
kubectl -n n3-guilherme get deployment api -o wide
```

Saia do acompanhamento com Ctrl+C quando aparecer o erro e substitua `NOME_DO_POD_COM_ERRO` antes de executar o `describe`. Na execução registrada, o novo pod entrou em `ErrImagePull` e `ImagePullBackOff`, e as duas réplicas anteriores continuaram rodando. O rollback restaurou `estacao-jogavel:2.0` com `2/2` réplicas prontas.

## 4. Requests e limits

```powershell
kubectl -n n3-guilherme set resources deployment/api -c api --requests=cpu=25m,memory=64Mi --limits=cpu=200m,memory=160Mi
kubectl -n n3-guilherme rollout status deployment/api --timeout=180s
kubectl -n n3-guilherme describe pods -l app=api
```

Os dois pods novos ficaram prontos. O `describe` confirmou requests de `25m` de CPU e `64Mi` de memória, e limits de `200m` e `160Mi`.

## 5. Escala automática com HPA

```powershell
kubectl -n n3-guilherme top pods -l app=api
kubectl -n n3-guilherme autoscale deployment api --min=2 --max=5 --cpu=60%
kubectl -n n3-guilherme get hpa api -w
```

Em outro terminal, crie a carga. Depois de registrar o aumento de réplicas, remova o gerador.

```powershell
kubectl -n n3-guilherme create deployment carga-hpa --image=busybox:1.36 --replicas=2 -- sh -c 'while true; do wget -q -T 2 -O /dev/null http://api:3000/jogos || sleep 1; done'
kubectl -n n3-guilherme delete deployment carga-hpa
```

Confirme o retorno ao mínimo.

```powershell
kubectl -n n3-guilherme get hpa api
kubectl -n n3-guilherme get deployment api
```

O HPA registrou a sequência de 2, 4 e 5 réplicas e voltou a 2 após a remoção da carga. Na conferência final, registrou CPU de 4% e o Deployment estava com `2/2` prontas. A meta de 60% é relativa ao request de CPU de cada pod: com `25m`, equivale a `15m` em média por pod.

## 6. Recursos do nó

```powershell
kubectl describe node docker-desktop
```

O nó apresentou 2 CPUs, memória total de `1950460Ki` em **Capacity** e `1848060Ki` disponíveis aos pods em **Allocatable**. **Allocated resources** mostrou requests agregados de `1020m` de CPU e `600Mi` de memória. Esses totais representam configuração dos pods, enquanto `kubectl top` mostra consumo medido.
