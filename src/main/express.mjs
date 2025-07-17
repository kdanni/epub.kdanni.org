import appName from '../app.mjs';
import express from 'express';
import { errorHandler } from './../api/error-mw.mjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import Epub from 'epub';

const app = express();
const port = process.env.FEEDGEN_PORT || process.env.PORT || 3004;

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

// Serve static frontend
app.use(express.static(path.join(process.cwd(), 'public')));

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({ storage });

// In-memory index of EPUBs (should be persisted in production)
const epubs = {};

// Scan uploads dir on startup
fs.readdirSync(UPLOADS_DIR).forEach(file => {
    if (file.endsWith('.epub')) {
        const id = path.parse(file).name;
        epubs[id] = { id, filename: file };
    }
});

// Upload endpoint
app.post('/api/upload', upload.single('epub'), (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });
    const id = path.parse(file.filename).name;
    epubs[id] = { id, filename: file.filename };
    res.json({ id, filename: file.originalname });
});

// List EPUBs
app.get('/api/epubs', (req, res) => {
    res.json(Object.values(epubs));
});

// Book metadata
app.get('/api/epub/:id/metadata', (req, res) => {
    const epub = epubs[req.params.id];
    if (!epub) return res.status(404).json({ error: 'Not found' });
    const epubPath = path.join(UPLOADS_DIR, epub.filename);
    const book = new Epub(epubPath);
    book.on('end', () => {
        res.json({
            title: book.metadata.title,
            author: book.metadata.creator,
            cover: book.metadata.cover,
        });
    });
    book.on('error', err => res.status(500).json({ error: err.message }));
    book.parse();
});

// List chapters
app.get('/api/epub/:id/chapters', (req, res) => {
    const epub = epubs[req.params.id];
    if (!epub) return res.status(404).json({ error: 'Not found' });
    const epubPath = path.join(UPLOADS_DIR, epub.filename);
    const book = new Epub(epubPath);
    book.on('end', () => {
        const chapters = book.flow.map((ch, idx) => ({ id: ch.id, label: ch.title || `Chapter ${idx + 1}` }));
        res.json(chapters);
    });
    book.on('error', err => res.status(500).json({ error: err.message }));
    book.parse();
});

// Serve chapter content
app.get('/api/epub/:id/chapter/:chapterId', (req, res) => {
    const epub = epubs[req.params.id];
    if (!epub) return res.status(404).json({ error: 'Not found' });
    const epubPath = path.join(UPLOADS_DIR, epub.filename);
    const book = new Epub(epubPath);
    book.on('end', () => {
        const chapter = book.flow.find(ch => ch.id === req.params.chapterId);
        if (!chapter) return res.status(404).send('Chapter not found');
        book.getChapter(chapter.id, (err, text) => {
            if (err) return res.status(500).send('Error loading chapter');
            res.send(text);
        });
    });
    book.on('error', err => res.status(500).json({ error: err.message }));
    book.parse();
});

app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`${appName.appName} listening at *:${port}`);
});

import wellKnown from '../api/well-known/route.mjs';
app.use('/.well-known', wellKnown);

app.use(errorHandler);