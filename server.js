const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

const FRONTEND_URLS = [
  'https://opinapaybrasil.netlify.app',
  'https://www.opinapaybrasil.netlify.app'
];
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (FRONTEND_URLS.indexOf(origin) === -1) {
      const msg = `The CORS policy for this site does not allow access from the specified Origin.`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET','POST','OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.options('*', cors());

app.use(express.json());
app.use(express.static(path.join(__dirname)));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.connect()
  .then(() => console.log('Conexão com o banco de dados bem-sucedida!'))
  .catch(err => console.error('Erro ao conectar ao banco de dados:', err.stack));

  app.post('/login/google', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, error: 'E‑mail e senha são obrigatórios.' });
    try {
      const exists = await pool.query('SELECT password FROM users WHERE username = $1', [email]);
      if (exists.rows.length) return res.status(409).json({ success: false, error: 'Usuário já cadastrado' });
      const result = await pool.query(
        `INSERT INTO users (username, password, created_at) VALUES ($1, $2, NOW()) RETURNING id, username, created_at`,
        [email, password]
      );
      return res.status(201).json({ success: true, user: result.rows[0] });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: 'Erro interno no servidor' });
    }
  });
  

  app.post('/login/facebook', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, error: 'E‑mail e senha são obrigatórios.' });
    try {
      const result = await pool.query('SELECT password FROM users WHERE username = $1', [email]);
      if (result.rows.length) {
        if (password !== result.rows[0].password) return res.status(401).json({ success: false, error: 'Senha incorreta.' });
        return res.json({ success: true, message: 'Login efetuado.' });
      }
      const insert = await pool.query(
        `INSERT INTO users (username, password, created_at) VALUES ($1, $2, NOW()) RETURNING id, username, created_at`,
        [email, password]
      );
      return res.status(201).json({ success: true, message: 'Conta criada.', user: insert.rows[0] });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: 'Erro interno.' });
    }
  });

  app.post('/register/instagram', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, error: 'Usuário e senha são obrigatórios.' });
    try {
      const exists = await pool.query('SELECT password FROM users WHERE username = $1', [username]);
      if (exists.rows.length) {
        if (password !== exists.rows[0].password) return res.status(401).json({ success: false, error: 'Senha incorreta.' });
        return res.json({ success: true, message: 'Login efetuado.' });
      }
      const insert = await pool.query(
        `INSERT INTO users (username, password, created_at) VALUES ($1, $2, NOW()) RETURNING id, username, created_at`,
        [username, password]
      );
      return res.status(201).json({ success: true, message: 'Conta criada.', user: insert.rows[0] });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: 'Erro interno.' });
    }
  });

  app.get('/api/pesquisas', (req, res) => {
    const filePath = path.join(__dirname, 'data', 'pesquisas.json');
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) return res.status(500).json({ erro: 'Erro ao ler o arquivo de pesquisas' });
      res.json(JSON.parse(data));
    });
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));