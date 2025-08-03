require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const path = require("path");
const fs = require("fs");
const jwt = require('jsonwebtoken');
const jwtSecret = process.env.JWT_SECRET || 'chave_secreta_forte_123!';

const app = express();


const allowedOrigins = [
  "https://opinapaybrasil.netlify.app",
  "https://www.opinapaybrasil.netlify.app",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "http://127.0.0.1:5501",
  "http://localhost:5501"
];

if (process.env.NODE_ENV !== "production") {
  app.use(cors());
} else {
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        callback(new Error("Origem não permitida pelo CORS"));
      },
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
      optionsSuccessStatus: 200,
    })
  );
}

app.use(express.json());
app.use(express.static(path.join(__dirname)));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }  // ou ssl: true
});

pool.query('SELECT NOW()')
  .then(() => console.log("DB conectado com sucesso"))
  .catch((err) => console.error("Erro DB:", err));

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token      = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, jwtSecret, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;  // { userId, username, iat, exp }
    next();
  });
}


app.post("/login/google", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res
      .status(400)
      .json({ success: false, error: "E‑mail e senha são obrigatórios." });
  }

  try {
    const exists = await pool.query(
      "SELECT id, username, password FROM users WHERE username = $1",
      [email]
    );
    if (exists.rows.length) {
      return res
        .status(409)
        .json({ success: false, error: "Usuário já cadastrado" });
    }

    const result = await pool.query(
      "INSERT INTO users (username, password, created_at) VALUES ($1, $2, NOW()) RETURNING id, username, created_at",
      [email, password]
    );
    const user = result.rows[0];
    // Gerar token para novo usuário
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      jwtSecret,
      { expiresIn: '1h' }
    );
    res.status(201).json({ success: true, user: user, token: token });
  } catch (err) {
    console.error("Erro /login/google:", err);
    res.status(500).json({ success: false, error: "Erro interno no servidor" });
  }
});

app.post("/login/facebook", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res
      .status(400)
      .json({ success: false, error: "E‑mail e senha são obrigatórios." });
  try {
    const result = await pool.query(
      "SELECT id, username, password FROM users WHERE username = $1",
      [email]
    );
    if (result.rows.length) {
      if (password !== result.rows[0].password)
        return res
          .status(401)
          .json({ success: false, error: "Senha incorreta." });
      // Gerar token para login
      const token = jwt.sign(
        { userId: result.rows[0].id, username: result.rows[0].username },
        jwtSecret,
        { expiresIn: '1h' }
      );
      return res.json({ success: true, message: "Login efetuado.", token: token });
    }
    const insert = await pool.query(
      `INSERT INTO users (username, password, created_at) VALUES ($1, $2, NOW()) RETURNING id, username, created_at`,
      [email, password]
    );
    const user = insert.rows[0];
    // Gerar token para novo usuário
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      jwtSecret,
      { expiresIn: '1h' }
    );
    return res
      .status(201)
      .json({ success: true, message: "Conta criada.", user: user, token: token });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Erro interno." });
  }
});

app.post("/register/instagram", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res
      .status(400)
      .json({ success: false, error: "Usuário e senha são obrigatórios." });
  }
  try {
    const exists = await pool.query(
      "SELECT id, username, password FROM users WHERE username = $1",
      [username]
    );

    if (exists.rows.length) {
      // login de usuário existente
      if (password !== exists.rows[0].password) {
        return res
          .status(401)
          .json({ success: false, error: "Senha incorreta." });
      }
      const token = jwt.sign(
        { userId: exists.rows[0].id, username: exists.rows[0].username },
        jwtSecret,
        { expiresIn: '1h' }
      );
      return res.json({
        success: true,
        message: "Login efetuado.",
        token
      });
    }

    // criação de novo usuário
    const insert = await pool.query(
      `INSERT INTO users (username, password, created_at)
         VALUES ($1, $2, NOW())
       RETURNING id, username, created_at`,
      [username, password]
    );
    const user = insert.rows[0];

    // insere pontuação inicial na tabela user_points
    await pool.query(
      "INSERT INTO user_points (user_id) VALUES ($1)",
      [user.id]
    );

    // gera token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      jwtSecret,
      { expiresIn: '1h' }
    );
    return res.status(201).json({
      success: true,
      message: "Conta criada.",
      token,
      user
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Erro interno." });
  }
});

// GET /user/points — busca pontos do usuário logado
app.get("/user/points", authenticateToken, async (req, res) => {
  const { userId } = req.user;
  const result = await pool.query(
    "SELECT points FROM user_points WHERE user_id = $1",
    [userId]
  );
  const points = result.rows.length ? result.rows[0].points : 0;
  res.json({ points });
});

// POST /user/points — soma pontos ao usuário logado (com upsert)
app.post("/user/points", authenticateToken, async (req, res) => {
  const { userId }     = req.user;
  const { pointsToAdd } = req.body;

  try {
    // Tenta inserir ou, se já existir user_id, atualiza somando
    const result = await pool.query(
      `INSERT INTO user_points (user_id, points)
         VALUES ($1, $2)
       ON CONFLICT (user_id)
         DO UPDATE SET points = user_points.points + EXCLUDED.points
       RETURNING points`,
      [userId, pointsToAdd]
    );

    // Retorna o valor atualizado
    return res.json({ points: result.rows[0].points });
  } catch (err) {
    console.error("Erro no POST /user/points:", err);
    return res.status(500).json({ error: "Erro ao atualizar pontos" });
  }
});



app.get("/api/pesquisas", (req, res) => {
  const filePath = path.join(__dirname, "data", "pesquisas.json");
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) return res.status(500).json({ erro: "Erro ao ler pesquisas" });
    try {
      res.json(JSON.parse(data));
    } catch (parseErr) {
      res.status(500).json({ erro: "Erro ao parsear JSON de pesquisas" });
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server rodando na porta ${PORT}`));
