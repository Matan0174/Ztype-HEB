require("dotenv").config();
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-this";
const usePostgres = !!process.env.DATABASE_URL;

// Middleware
app.use(express.json());
app.use(cors());

// Security middleware
app.use((req, res, next) => {
  if (
    req.path.endsWith(".db") ||
    req.path.endsWith("server.js") ||
    req.path.includes("package.json")
  ) {
    return res.status(403).send("Forbidden");
  }
  next();
});

app.use(express.static(path.join(__dirname, ".")));

// -----------------------------------------------------------------------------
// Database Adaptation Layer (SQLite vs PostgreSQL)
// -----------------------------------------------------------------------------

let sqliteDb;
let pgPool;

if (usePostgres) {
  console.log("Using PostgreSQL database (Neon)...");
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  pgPool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE,
      password VARCHAR(255),
      high_score INTEGER DEFAULT 0,
      max_level INTEGER DEFAULT 1
    )
  `).catch((err) => console.error("Error creating PG table:", err));
} else {
  console.log("Using SQLite database (local mode)...");
  sqliteDb = new sqlite3.Database("./users.db", (err) => {
    if (err) console.error("Error opening SQLite DB:", err.message);
    else {
      console.log("Connected to SQLite.");
      sqliteDb.run(
        `CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              username TEXT UNIQUE,
              password TEXT,
              high_score INTEGER DEFAULT 0,
              max_level INTEGER DEFAULT 1
          )`,
        (err) => {
          if (err) console.error("Error creating table in SQLite:", err);
          else {
            sqliteDb.run(
              `ALTER TABLE users ADD COLUMN max_level INTEGER DEFAULT 1`,
              (e) => {},
            );
          }
        },
      );
    }
  });
}

const formatQueryForPg = (sql) => {
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
};

const DB = {
  run: async (sql, params = []) => {
    if (usePostgres) {
      let pgSql = formatQueryForPg(sql);
      // Automatically add RETURNING id for INSERT queries if not present
      if (pgSql.trim().toUpperCase().startsWith("INSERT") && !pgSql.toUpperCase().includes("RETURNING ID")) {
        pgSql += " RETURNING id";
      }
      const res = await pgPool.query(pgSql, params);
      const lastID = res.rows && res.rows.length > 0 ? res.rows[0].id : null;
      return { lastID, changes: res.rowCount };
    } else {
      return new Promise((resolve, reject) => {
        sqliteDb.run(sql, params, function (err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    }
  },

  get: async (sql, params = []) => {
    if (usePostgres) {
      const pgSql = formatQueryForPg(sql);
      const res = await pgPool.query(pgSql, params);
      return res.rows[0];
    } else {
      return new Promise((resolve, reject) => {
        sqliteDb.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    }
  },

  all: async (sql, params = []) => {
    if (usePostgres) {
      const pgSql = formatQueryForPg(sql);
      const res = await pgPool.query(pgSql, params);
      return res.rows;
    } else {
      return new Promise((resolve, reject) => {
        sqliteDb.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    }
  },
};

// -----------------------------------------------------------------------------
// Auth Helpers
// -----------------------------------------------------------------------------

const generateToken = (user) => {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: "24h",
  });
};

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// -----------------------------------------------------------------------------
// API Routes
// -----------------------------------------------------------------------------

// Register
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    let result;
    const sql = `INSERT INTO users (username, password, max_level) VALUES (?, ?, 1)`;

    try {
      result = await DB.run(sql, [username, hashedPassword]);
    } catch (err) {
      if (err.message && err.message.includes("UNIQUE")) {
        return res.status(400).json({ error: "Username already exists" });
      }
      throw err;
    }

    const userId = result.lastID;
    const token = generateToken({ id: userId, username });

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: { id: userId, username, highScore: 0, maxLevel: 1 },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required" });
  }

  try {
    const user = await DB.get(`SELECT * FROM users WHERE username = ?`, [
      username,
    ]);

    if (!user) {
      return res.status(400).json({ error: "Invalid username or password" });
    }

    if (await bcrypt.compare(password, user.password)) {
      const token = generateToken(user);
      res.json({
        message: "Login successful",
        token,
        user: {
          id: user.id,
          username: user.username,
          highScore: user.high_score,
          maxLevel: user.max_level || 1,
        },
      });
    } else {
      res.status(400).json({ error: "Invalid username or password" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get Profile
app.get("/api/me", authenticateToken, async (req, res) => {
  try {
    const user = await DB.get(
      `SELECT id, username, high_score, max_level FROM users WHERE id = ?`,
      [req.user.id],
    );
    if (!user) return res.sendStatus(404);
    res.json({
      id: user.id,
      username: user.username,
      highScore: user.high_score,
      maxLevel: user.max_level || 1,
    });
  } catch (e) {
    res.sendStatus(500);
  }
});

// Update Score
app.post("/api/score", authenticateToken, async (req, res) => {
  const { score } = req.body;
  if (typeof score !== "number")
    return res.status(400).json({ error: "Invalid score" });

  try {
    // Only update if higher
    const result = await DB.run(
      `UPDATE users SET high_score = ? WHERE id = ? AND high_score < ?`,
      [score, req.user.id, score],
    );
    res.json({ message: "Score processed", updated: result.changes > 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update Progress (Max Level)
app.post("/api/progress", authenticateToken, async (req, res) => {
  const { level } = req.body;
  if (typeof level !== "number")
    return res.status(400).json({ error: "Invalid level" });

  try {
    const result = await DB.run(
      `UPDATE users SET max_level = ? WHERE id = ? AND max_level < ?`,
      [level, req.user.id, level],
    );
    res.json({ message: "Progress saved", updated: result.changes > 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Leaderboard
app.get("/api/leaderboard", async (req, res) => {
  try {
    const rows = await DB.all(
      `SELECT username, high_score FROM users ORDER BY high_score DESC LIMIT 10`,
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`Database: SQLite`);
});
