import express from 'express';
import pool from './config/db.js';

const app = express();
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 + 1 AS result');
    res.json({ status: 'ok', database: 'connected', result: rows[0].result });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

export default app;