const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Middleware
app.use(express.json());
app.use(cors());

// Security middleware
app.use((req, res, next) => {
    if (req.path.endsWith('.db') || req.path.endsWith('server.js') || req.path.includes('package.json')) {
        return res.status(403).send('Forbidden');
    }
    next();
});

app.use(express.static(path.join(__dirname, '.')));

// -----------------------------------------------------------------------------
// Database Adaptation Layer (SQLite vs PostgreSQL)
// -----------------------------------------------------------------------------

// Determines if we are using PostgreSQL (Cloud) or SQLite (Local)
const isPostgres = !!process.env.DATABASE_URL;

let db;

// Abstract Database Interface to unify queries
const DB = {
    // Run a query that doesn't return rows (INSERT, UPDATE, DELETE)
    run: async (sql, params = []) => {
        if (isPostgres) {
            // Convert ? to $1, $2, etc.
            let i = 1;
            const pgSql = sql.replace(/\?/g, () => `$${i++}`);
            const result = await db.query(pgSql, params);
            return { 
                lastID: result.rows[0]?.id || 0, // setup returning clause for INSERTs
                changes: result.rowCount 
            };
        } else {
            return new Promise((resolve, reject) => {
                db.run(sql, params, function(err) {
                    if (err) reject(err);
                    else resolve({ lastID: this.lastID, changes: this.changes });
                });
            });
        }
    },
    
    // Get a single row
    get: async (sql, params = []) => {
        if (isPostgres) {
            let i = 1;
            const pgSql = sql.replace(/\?/g, () => `$${i++}`);
            const result = await db.query(pgSql, params);
            return result.rows[0];
        } else {
            return new Promise((resolve, reject) => {
                db.get(sql, params, (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        }
    },

    // Get all rows
    all: async (sql, params = []) => {
        if (isPostgres) {
            let i = 1;
            const pgSql = sql.replace(/\?/g, () => `$${i++}`);
            const result = await db.query(pgSql, params);
            return result.rows;
        } else {
            return new Promise((resolve, reject) => {
                db.all(sql, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        }
    }
};

// Initialize DB Connection
if (isPostgres) {
    console.log('Using PostgreSQL database...');
    db = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } // Required for many cloud providers (Heroku/Render/AWS/GCP often need SSL)
    });
    
    // Create Table for Postgres
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            high_score INTEGER DEFAULT 0,
            max_level INTEGER DEFAULT 1
        );
    `;
    
    db.query(createTableQuery)
        .then(() => console.log('PostgreSQL table ensured.'))
        .catch(err => console.error('Error creating table in PG:', err));

} else {
    // SQLite Fallback
    console.log('Using SQLite database (local mode)...');
    db = new sqlite3.Database('./users.db', (err) => {
        if (err) console.error('Error opening SQLite DB:', err.message);
        else {
            console.log('Connected to SQLite.');
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE,
                password TEXT,
                high_score INTEGER DEFAULT 0,
                max_level INTEGER DEFAULT 1
            )`, (err) => {
                if (err) console.error('Error creating table in SQLite:', err);
                else {
                    // Migration for existing SQLite DBs
                    db.run(`ALTER TABLE users ADD COLUMN max_level INTEGER DEFAULT 1`, (e) => {});
                }
            });
        }
    });
}

// -----------------------------------------------------------------------------
// Auth Helpers
// -----------------------------------------------------------------------------

const generateToken = (user) => {
    return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
};

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

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
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        let sql, result;
        
        if (isPostgres) {
            // Postgres needs RETURNING id to get the ID back
            sql = `INSERT INTO users (username, password, max_level) VALUES (?, ?, 1) RETURNING id`;
            // Note: Our DB.run helper handles '?' replacement, but getting the return ID from PG
            // requires `RETURNING id`.
            // Let's handle it specifically here or update DB.run logic.
            // We'll trust DB.run to return { lastID } for simpler abstraction if possible,
            // but standard 'pg' requires explicit RETURNING.
            // Let's modify the query slightly for PG in the adapter or just use specialized query here.
            // Easier: Update the sql string before calling DB.run if isPostgres.
             sql = `INSERT INTO users (username, password, max_level) VALUES (?, ?, 1) RETURNING id`;
        } else {
            sql = `INSERT INTO users (username, password, max_level) VALUES (?, ?, 1)`;
        }

        try {
            result = await DB.run(sql, [username, hashedPassword]);
        } catch (err) {
            if (err.message && err.message.includes('unique')) { // 'unique' covers both sqlite and pg errors roughly
                 return res.status(400).json({ error: 'Username already exists' }); 
            }
             // Specific checks
            if (err.message?.includes('UNIQUE') || err.code === '23505') {
                return res.status(400).json({ error: 'Username already exists' });
            }
            throw err;
        }

        const userId = result.lastID;
        const token = generateToken({ id: userId, username });
        
        res.status(201).json({ 
            message: 'User registered successfully',
            token,
            user: { id: userId, username, highScore: 0, maxLevel: 1 }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const user = await DB.get(`SELECT * FROM users WHERE username = ?`, [username]);
        
        if (!user) {
            return res.status(400).json({ error: 'Invalid username or password' });
        }

        if (await bcrypt.compare(password, user.password)) {
            const token = generateToken(user);
            res.json({ 
                message: 'Login successful',
                token,
                user: { id: user.id, username: user.username, highScore: user.high_score, maxLevel: user.max_level || 1 }
            });
        } else {
            res.status(400).json({ error: 'Invalid username or password' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get Profile
app.get('/api/me', authenticateToken, async (req, res) => {
    try {
        const user = await DB.get(`SELECT id, username, high_score, max_level FROM users WHERE id = ?`, [req.user.id]);
        if (!user) return res.sendStatus(404);
        res.json({
             id: user.id, 
             username: user.username, 
             highScore: user.high_score,
             maxLevel: user.max_level || 1
        });
    } catch (e) {
        res.sendStatus(500);
    }
});

// Update Score
app.post('/api/score', authenticateToken, async (req, res) => {
    const { score } = req.body;
    if (typeof score !== 'number') return res.status(400).json({ error: 'Invalid score' });

    try {
        // Only update if higher
        const result = await DB.run(
            `UPDATE users SET high_score = ? WHERE id = ? AND high_score < ?`,
            [score, req.user.id, score]
        );
        res.json({ message: 'Score processed', updated: result.changes > 0 });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Update Progress (Max Level)
app.post('/api/progress', authenticateToken, async (req, res) => {
    const { level } = req.body;
    if (typeof level !== 'number') return res.status(400).json({ error: 'Invalid level' });

    try {
        const result = await DB.run(
            `UPDATE users SET max_level = ? WHERE id = ? AND max_level < ?`,
            [level, req.user.id, level]
        );
        res.json({ message: 'Progress saved', updated: result.changes > 0 });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Leaderboard
app.get('/api/leaderboard', async (req, res) => {
    try {
        const rows = await DB.all(`SELECT username, high_score FROM users ORDER BY high_score DESC LIMIT 10`);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Database: ${isPostgres ? 'PostgreSQL' : 'SQLite'}`);
});
