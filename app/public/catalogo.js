const catalogo = document.querySelector('#jogos');
const estado = document.querySelector('#estado');
const mensagem = document.querySelector('#mensagem');
const formulario = document.querySelector('form');
const botao = formulario.querySelector('button');
const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function elemento(tag, texto, classe) {
  const item = document.createElement(tag);
  item.textContent = texto;
  if (classe) item.className = classe;
  return item;
}

function cartao(jogo) {
  const item = elemento('article', '', 'cartao');
  const capa = elemento('div', 'Sem capa', 'capa');
  if (jogo.capa) {
    const imagem = document.createElement('img');
    imagem.alt = '';
    imagem.loading = 'lazy';
    imagem.addEventListener('error', () => { capa.textContent = 'Capa indisponível'; });
    imagem.src = jogo.capa;
    capa.replaceChildren(imagem);
  }
  const detalhes = elemento('div', '', 'detalhes');
  detalhes.append(
    elemento('p', [jogo.genero, jogo.plataforma].join(' · '), 'metadados'),
    elemento('h2', jogo.titulo),
    elemento('p', jogo.descricao),
    elemento('strong', moeda.format(Number(jogo.preco)), 'preco'),
  );
  item.append(capa, detalhes);
  return item;
}

async function carregar() {
  try {
    const resposta = await fetch('/jogos');
    if (!resposta.ok) throw new Error('Não foi possível carregar o catálogo.');
    const jogos = await resposta.json();
    catalogo.replaceChildren(...jogos.map(cartao));
    estado.textContent = jogos.length ? '' : 'Nenhum jogo cadastrado. Adicione o primeiro pelo formulário.';
  } catch (erro) {
    estado.textContent = erro.message;
  }
}

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  botao.disabled = true;
  mensagem.textContent = 'Salvando…';
  try {
    const jogo = Object.fromEntries(new FormData(formulario));
    const resposta = await fetch('/jogos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jogo),
    });
    if (!resposta.ok) throw new Error((await resposta.json()).erro);
    formulario.reset();
    mensagem.textContent = 'Jogo cadastrado.';
    await carregar();
  } catch (erro) {
    mensagem.textContent = erro.message;
  } finally {
    botao.disabled = false;
  }
});

carregar();
