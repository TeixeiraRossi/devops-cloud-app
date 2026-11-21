const express = require('express');
const mysql = require('mysql2/promise');
const { createClient } = require('redis');
const path = require('node:path');
const { readFileSync } = require('node:fs');

const pastaPublica = path.join(__dirname, 'public');
const versao = process.env.APP_VERSION ?? '1.0';
if (!/^\d+\.\d+$/.test(versao)) {
  throw new Error('APP_VERSION deve ter o formato major.minor, como 1.0.');
}
const pagina = readFileSync(path.join(pastaPublica, 'index.html'), 'utf8')
  .replace('{{VERSAO}}', versao);

const app = express();
const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectTimeout: 2000,
  connectionLimit: 5,
  queueLimit: 20,
});
const redis = createClient({
  url: process.env.REDIS_URL,
  disableOfflineQueue: true,
  socket: { connectTimeout: 2000 },
});
redis.on('error', (error) => console.error('Redis:', error.message));
redis.connect().catch((error) => console.error('Conexão com Redis:', error.message));

const chaveCatalogo = 'loja:jogos:v1';
let tabelaPronta = false;

async function prepararTabela() {
  if (tabelaPronta) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS jogos (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      titulo VARCHAR(120) NOT NULL,
      descricao VARCHAR(500) NOT NULL,
      genero VARCHAR(60) NOT NULL,
      plataforma VARCHAR(60) NOT NULL,
      preco DECIMAL(8,2) UNSIGNED NOT NULL,
      capa VARCHAR(500)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  tabelaPronta = true;
}

app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok', versao }));

app.get('/ready', async (_req, res) => {
  try {
    await prepararTabela();
    await Promise.all([db.query('SELECT 1'), redis.ping()]);
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'indisponivel' });
  }
});

app.get('/jogos', async (_req, res) => {
  await prepararTabela();
  // O Redis é um cache. Se falhar, o catálogo ainda pode ler o MySQL.
  const cache = await redis.get(chaveCatalogo).catch(() => null);
  if (cache) {
    res.set('X-Cache', 'HIT').json(JSON.parse(cache));
    return;
  }

  const [jogos] = await db.query('SELECT * FROM jogos ORDER BY id DESC');
  await redis.set(chaveCatalogo, JSON.stringify(jogos), { EX: 30 }).catch((error) => {
    console.error('Gravação do cache:', error.message);
  });
  res.set('X-Cache', 'MISS').json(jogos);
});

app.post('/jogos', async (req, res) => {
  const { titulo, descricao, genero, plataforma, preco, capa = '' } = req.body || {};
  const campos = [[titulo, 120], [descricao, 500], [genero, 60], [plataforma, 60]];
  if (campos.some(([valor, limite]) => typeof valor !== 'string' || !valor.trim() || valor.trim().length > limite)) {
    res.status(400).json({ erro: 'Confira o título, a descrição, o gênero e a plataforma.' });
    return;
  }
  const precoValido = (typeof preco === 'number' || typeof preco === 'string')
    && /^\d{1,6}(\.\d{1,2})?$/.test(String(preco));
  if (!precoValido) {
    res.status(400).json({ erro: 'Informe um preço válido com até duas casas decimais.' });
    return;
  }
  const urlCapa = typeof capa === 'string' && capa.length <= 500 ? URL.parse(capa) : null;
  if (capa !== '' && !urlCapa) {
    res.status(400).json({ erro: 'Informe uma URL válida para a capa.' });
    return;
  }
  if (urlCapa && !['http:', 'https:'].includes(urlCapa.protocol)) {
    res.status(400).json({ erro: 'A URL da capa deve usar HTTP ou HTTPS.' });
    return;
  }

  await prepararTabela();
  const [resultado] = await db.execute(
    'INSERT INTO jogos (titulo, descricao, genero, plataforma, preco, capa) VALUES (?, ?, ?, ?, ?, ?)',
    [titulo.trim(), descricao.trim(), genero.trim(), plataforma.trim(), preco, capa || null],
  );
  await redis.del(chaveCatalogo).catch((error) => console.error('Invalidação do cache:', error.message));
  res.status(201).json({ id: resultado.insertId });
});

app.get(['/', '/index.html'], (_req, res) => {
  res.set('Cache-Control', 'no-store').type('html').send(pagina);
});
app.use(express.static(pastaPublica));

app.use((error, _req, res, _next) => {
  if (error.type === 'entity.parse.failed') return res.status(400).json({ erro: 'JSON inválido.' });
  if (error.type === 'entity.too.large') return res.status(413).json({ erro: 'Requisição muito grande.' });
  console.error(error);
  res.status(500).json({ erro: 'Não foi possível concluir a operação.' });
});

const server = app.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => {
  console.log('Loja de jogos pronta para receber conexões.');
});

process.once('SIGTERM', () => {
  server.close(async () => {
    if (redis.isOpen) redis.destroy();
    await db.end();
  });
});
