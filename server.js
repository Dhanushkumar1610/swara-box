const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { body, validationResult } = require('express-validator');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MySQL connection
const db = mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: 'Rootpass@123',
    database: 'spotify_clone'
});

// JWT secret
const JWT_SECRET = 'swara_box_secure_key_123';

// Connect to MySQL
db.connect(err => {
    if (err) {
        console.error('Failed to connect to MySQL:', err.message, err.stack);
        process.exit(1);
    }
    console.log('MySQL connected');
});

// Multer storage for images
const imageStorage = multer.diskStorage({
    destination: './public/images/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

// Image upload middleware (only allow jpg, jpeg, png)
const uploadImage = multer({
    storage: imageStorage,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
            return cb(new Error('Only JPG, JPEG, and PNG images are allowed'));
        }
        cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Multer setup for songs
const storage = multer.diskStorage({
    destination: './public/songs/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (path.extname(file.originalname).toLowerCase() !== '.mp3') {
            return cb(new Error('Only MP3 files are allowed'));
        }
        cb(null, true);
    },
    limits: { fileSize: 10 * 1024 * 1024 }
});

// Middleware: authenticateJWT (moved above routes)
const authenticateJWT = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        console.error('No token provided');
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        console.error('Invalid token:', error.message);
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Route to upload image
app.post('/api/upload-image', authenticateJWT, uploadImage.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image file uploaded' });
    }

    const imagePath = `/images/${req.file.filename}`;
    console.log('Image uploaded:', imagePath);

    res.json({
        message: 'Image uploaded successfully',
        imageUrl: imagePath
    });
});

// Routes
app.post('/api/register', [
    body('username').isLength({ min: 3 }).trim().escape(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { username, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.query(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            [username, email, hashedPassword],
            (err) => {
                if (err) {
                    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Username or email exists' });
                    console.error('Register error:', err);
                    return res.status(500).json({ error: 'Server error' });
                }
                res.status(201).json({ message: 'User registered' });
            }
        );
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { email, password } = req.body;
    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
        if (err) {
            console.error('Login error:', err);
            return res.status(500).json({ error: 'Server error' });
        }
        if (results.length === 0) return res.status(400).json({ error: 'User not found' });
        const user = results[0];
        if (await bcrypt.compare(password, user.password)) {
            const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
            res.json({ message: 'Login successful', token, userId: user.id });
        } else {
            res.status(400).json({ error: 'Invalid password' });
        }
    });
});

// Note: Duplicate /api/songs POST route detected. Keeping the second one as it includes transactions
app.post('/api/songs', authenticateJWT, upload.single('song'), [
    body('title').isLength({ min: 1 }).trim().escape(),
    body('artist').isLength({ min: 1 }).trim().escape(),
    body('type').isIn(['retro', 'classic', 'latest']),
    body('language').isIn(['Kannada', 'Hindi', 'English'])
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { title, artist, isPodcast, type, language } = req.body;
    if (!req.file || !type || !language) {
        console.error('Missing required fields:', { file: !!req.file, type, language });
        return res.status(400).json({ error: 'Missing required fields' });
    }
    const filePath = `/songs/${req.file.filename}`;
    console.log('Uploading song:', { title, artist, filePath, type, language, userId: req.userId });
    db.beginTransaction(err => {
        if (err) {
            console.error('Transaction start error:', err);
            return res.status(500).json({ error: 'Server error' });
        }
        db.query(
            'INSERT INTO songs (title, artist, file_path, user_id, is_podcast, language) VALUES (?, ?, ?, ?, ?, ?)',
            [title, artist, filePath, req.userId, isPodcast === 'true', language],
            (err, result) => {
                if (err) {
                    db.rollback(() => {
                        console.error('Song insert error:', err);
                        res.status(500).json({ error: 'Failed to upload song' });
                    });
                    return;
                }
                const songId = result.insertId;
                const typeTable = `${type}_songs`;
                db.query(
                    `INSERT INTO ${typeTable} (song_id, additional_info) VALUES (?, ?)`,
                    [songId, `${type} song`],
                    (err) => {
                        if (err) {
                            db.rollback(() => {
                                console.error(`Insert into ${typeTable} error:`, err);
                                res.status(500).json({ error: 'Failed to upload song' });
                            });
                            return;
                        }
                        db.commit(err => {
                            if (err) {
                                db.rollback(() => {
                                    console.error('Commit error:', err);
                                    res.status(500).json({ error: 'Server error' });
                                });
                                return;
                            }
                            res.json({ message: 'Song uploaded', songId });
                        });
                    }
                );
            }
        );
    });
});

app.get('/api/songs', authenticateJWT, (req, res) => {
    const { type, language } = req.query;
    let query = `
        SELECT s.*, l.user_id IS NOT NULL AS liked,
               CASE
                   WHEN r.song_id IS NOT NULL THEN 'retro'
                   WHEN c.song_id IS NOT NULL THEN 'classic'
                   WHEN t.song_id IS NOT NULL THEN 'latest'
                   ELSE NULL
               END AS type
        FROM songs s
        LEFT JOIN likes l ON s.id = l.song_id AND l.user_id = ?
        LEFT JOIN retro_songs r ON s.id = r.song_id
        LEFT JOIN classic_songs c ON s.id = c.song_id
        LEFT JOIN latest_songs t ON s.id = t.song_id
    `;
    let params = [req.userId];
    
    if (type || language) {
        query += ' WHERE ';
        let conditions = [];
        if (type) {
            if (type === 'retro') conditions.push('r.song_id IS NOT NULL');
            else if (type === 'classic') conditions.push('c.song_id IS NOT NULL');
            else if (type === 'latest') conditions.push('t.song_id IS NOT NULL');
        }
        if (language) {
            conditions.push('s.language = ?');
            params.push(language);
        }
        query += conditions.join(' AND ');
    }
    
    query += ' ORDER BY s.created_at DESC';

    console.log('Fetching songs:', { query, params });
    db.query(query, params, (err, results) => {
        if (err) {
            console.error('Fetch songs error:', err);
            return res.status(500).json({ error: 'Failed to fetch songs' });
        }
        console.log('Songs fetched:', results.length, 'songs', results.map(s => ({ id: s.id, title: s.title, type: s.type })));
        res.json(results);
    });
});

app.get('/api/likes/:songId', authenticateJWT, (req, res) => {
    const { songId } = req.params;
    db.query(
        'SELECT 1 FROM likes WHERE user_id = ? AND song_id = ?',
        [req.userId, songId],
        (err, results) => {
            if (err) {
                console.error('Check like error:', err);
                return res.status(500).json({ error: 'Failed to check like status' });
            }
            res.json({ liked: results.length > 0 });
        }
    );
});

app.post('/api/likes', authenticateJWT, [
    body('songId').isInt()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { songId } = req.body;
    db.query(
        'INSERT INTO likes (user_id, song_id) VALUES (?, ?)',
        [req.userId, songId],
        (err) => {
            if (err) {
                console.error('Like error:', err);
                if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Already liked' });
                return res.status(500).json({ error: 'Failed to like song' });
            }
            res.json({ message: 'Song liked' });
        }
    );
});

app.delete('/api/likes', authenticateJWT, [
    body('songId').isInt()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { songId } = req.body;
    db.query(
        'DELETE FROM likes WHERE user_id = ? AND song_id = ?',
        [req.userId, songId],
        (err, result) => {
            if (err) {
                console.error('Unlike error:', err);
                return res.status(500).json({ error: 'Failed to unlike' });
            }
            if (result.affectedRows === 0) return res.status(404).json({ error: 'Like not found' });
            res.json({ message: 'Song unliked' });
        }
    );
});

app.delete('/api/songs/:songId', authenticateJWT, (req, res) => {
    const { songId } = req.params;
    db.query(
        'SELECT file_path FROM songs WHERE id = ? AND user_id = ?',
        [songId, req.userId],
        (err, results) => {
            if (err) {
                console.error('Fetch song error:', err);
                return res.status(500).json({ error: 'Failed to fetch song' });
            }
            if (results.length === 0) return res.status(403).json({ error: 'Not authorized or song not found' });
            const filePath = results[0].file_path;
            db.query(
                'DELETE FROM songs WHERE id = ?',
                [songId],
                (err, result) => {
                    if (err) {
                        console.error('Delete song error:', err);
                        return res.status(500).json({ error: 'Failed to delete song' });
                    }
                    if (result.affectedRows === 0) return res.status(404).json({ error: 'Song not found' });
                    if (filePath) {
                        const fullPath = path.join(__dirname, 'public', filePath);
                        fs.unlink(fullPath, err => {
                            if (err) console.error('Failed to delete file:', err);
                        });
                    }
                    res.json({ message: 'Song deleted' });
                }
            );
        }
    );
});

// Start server
const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));