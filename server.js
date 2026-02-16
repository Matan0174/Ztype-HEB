const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = "your-secret-key-change-this"; // In production, use environment variable

// Middleware
app.use(express.json());
app.use(cors());

// Security middleware to block access to sensitive files
app.use((req, res, next) => {
    if (req.path.endsWith('.db') || req.path.endsWith('server.js') || req.path.includes('package.json')) {
        return res.status(403).send('Forbidden');
    }
    next();
});

app.use(express.static(path.join(__dirname, ".")));

// Database Setup
const db = new sqlite3.Database("./users.db", (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
  } else {
    console.log("Connected to the SQLite database.");
    
    // Create users table if not exists with max_level
    db.run(
      `CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            high_score INTEGER DEFAULT 0,
            max_level INTEGER DEFAULT 1
        )`,
      (err) => {
        if (err) console.error("Error creating table:", err.message);
      }
    );

    // Attempt to add max_level column if it doesn't exist (for existing DBs)
    db.run(`ALTER TABLE users ADD COLUMN max_level INTEGER DEFAULT 1`, (err) => {
        // Ignore error if column already exists
    });
  }
});

// Helper for JWT
const generateToken = (user) => {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: "24h",
  });
};

// Middleware to authenticate token
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

// Routes

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

    const sql = `INSERT INTO users (username, password, max_level) VALUES (?, ?, 1)`;
    db.run(sql, [username, hashedPassword], function (err) {
      if (err) {
        if (err.message.includes("UNIQUE constraint failed")) {
          return res.status(400).json({ error: "Username already exists" });
        }
        return res.status(500).json({ error: err.message });
      }

      const token = generateToken({ id: this.lastID, username });
      res.status(201).json({
        message: "User registered successfully",
        token,
        user: { id: this.lastID, username, highScore: 0, maxLevel: 1 },
      });
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Login
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required" });
  }

  const sql = `SELECT * FROM users WHERE username = ?`;
  db.get(sql, [username], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!user) {
      return res.status(400).json({ error: "Invalid username or password" });
    }

    try {
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
      res.status(500).json({ error: "Server error" });
    }
  });
});

// Get User Profile
app.get("/api/me", authenticateToken, (req, res) => {
  const sql = `SELECT id, username, high_score, max_level FROM users WHERE id = ?`;
  db.get(sql, [req.user.id], (err, user) => {
    if (err) return res.sendStatus(500);
    if (!user) return res.sendStatus(404);
    res.json({
        id: user.id,
        username: user.username,
        highScore: user.high_score,
        maxLevel: user.max_level || 1
    });
  });
});

// Update High Score
app.post("/api/score", authenticateToken, (req, res) => {
  const { score } = req.body;

  if (typeof score !== "number") {
    return res.status(400).json({ error: "Invalid score" });
  }

  const sql = `UPDATE users SET high_score = ? WHERE id = ? AND high_score < ?`;
  // Only update if new score is higher
  db.run(sql, [score, req.user.id, score], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Score processed", updated: this.changes > 0 });
  });
});

// Update Level Progress
app.post("/api/progress", authenticateToken, (req, res) => {
    const { level } = req.body;

    if (typeof level !== "number") {
        return res.status(400).json({ error: "Invalid level" });
    }

    const sql = `UPDATE users SET max_level = ? WHERE id = ? AND max_level < ?`;
    // Only update if new level is higher
    db.run(sql, [level, req.user.id, level], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Progress saved", updated: this.changes > 0 });
    });
});

// Get Leaderboard (Top 10)
app.get("/api/leaderboard", (req, res) => {
  const sql = `SELECT username, high_score FROM users ORDER BY high_score DESC LIMIT 10`;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
