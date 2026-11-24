import express from 'express';
import cors from 'cors';

const app = express();

// Only our own frontend may call this API from a browser (study guide 02, section 2.1)
const allowedOrigins = (process.env.CLIENT_URL ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '100kb' })); // parse JSON bodies, refuse huge ones

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

export default app;
