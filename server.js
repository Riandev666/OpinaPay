require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const path = require("path");
const fs = require("fs");

const app = express();

// — CORS —

// Lista de origens autorizadas em produção
const allowedOrigins = [
  "https://opinapaybrasil.netlify.app",
  "https://www.opinapaybrasil.netlify.app",
  "http://127.0.0.1:5500",
  "http://localhost:5500"
];

// Em dev libera tudo; em prod só allowedOrigins
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
  ssl: { rejectUnauthorized: false }
});

pool
  .connect()
  .then(() => console.log("DB conectado com sucesso"))
  .catch((err) => console.error("Erro DB:", err));

app.post("/login/google", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res
      .status(400)
      .json({ success: false, error: "E‑mail e senha são obrigatórios." });
  }

  try {
    const exists = await pool.query(
      "SELECT password FROM users WHERE username = $1",
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

    res.status(201).json({ success: true, user: result.rows[0] });
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
      "SELECT password FROM users WHERE username = $1",
      [email]
    );
    if (result.rows.length) {
      if (password !== result.rows[0].password)
        return res
          .status(401)
          .json({ success: false, error: "Senha incorreta." });
      return res.json({ success: true, message: "Login efetuado." });
    }
    const insert = await pool.query(
      `INSERT INTO users (username, password, created_at) VALUES ($1, $2, NOW()) RETURNING id, username, created_at`,
      [email, password]
    );
    return res
      .status(201)
      .json({ success: true, message: "Conta criada.", user: insert.rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Erro interno." });
  }
});

app.post("/register/instagram", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res
      .status(400)
      .json({ success: false, error: "Usuário e senha são obrigatórios." });
  try {
    const exists = await pool.query(
      "SELECT password FROM users WHERE username = $1",
      [username]
    );
    if (exists.rows.length) {
      if (password !== exists.rows[0].password)
        return res
          .status(401)
          .json({ success: false, error: "Senha incorreta." });
      return res.json({ success: true, message: "Login efetuado." });
    }
    const insert = await pool.query(
      `INSERT INTO users (username, password, created_at) VALUES ($1, $2, NOW()) RETURNING id, username, created_at`,
      [username, password]
    );
    return res
      .status(201)
      .json({ success: true, message: "Conta criada.", user: insert.rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Erro interno." });
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
