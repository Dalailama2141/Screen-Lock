const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const port = Number(process.env.PORT || 3000);
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/userdb';

app.use(cors());
app.use(express.json());

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
  },
  { timestamps: true },
);

const User = mongoose.models.User || mongoose.model('User', userSchema);

const lockCredentialSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, unique: true, index: true },
    method: { type: String, enum: ['Fingerprint', 'Pattern', 'PIN'], required: true },
    credentialHash: { type: String, required: true },
    salt: { type: String, required: true },
  },
  { timestamps: true },
);

const LockCredential = mongoose.models.LockCredential || mongoose.model('LockCredential', lockCredentialSchema);

function hashCredential(credential, salt) {
  return crypto.scryptSync(credential, salt, 64).toString('hex');
}

app.get('/', (_req, res) => {
  res.json({
    service: 'screen-guard-backend',
    status: 'ok',
    endpoints: ['/health', '/users'],
  });
});

app.get('/health', async (_req, res) => {
  try {
    await mongoose.connection.db.admin().command({ ping: 1 });
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'degraded', database: 'disconnected' });
  }
});

app.get('/users', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    const users = await User.find().sort({ createdAt: -1 }).skip(offset).limit(limit);
    const total = await User.countDocuments();
    res.json({ users, total, limit, offset });
  } catch (error) {
    console.error('Error fetching users', error);
    res.status(503).json({ error: 'Database unavailable' });
  }
});

app.post('/users', async (req, res) => {
  const { name, email } = req.body;
  if (typeof name !== 'string' || typeof email !== 'string' || !name.trim() || !email.trim()) {
    return res.status(400).json({ error: 'name and email are required' });
  }

  try {
    const user = await User.create({ name, email });
    res.status(201).json(user);
  } catch (error) {
    console.error('Error creating user', error);
    res.status(503).json({ error: 'Database unavailable' });
  }
});

app.get('/lock-credentials/:deviceId', async (req, res) => {
  try {
    const credential = await LockCredential.findOne({ deviceId: req.params.deviceId }).select('deviceId method');
    if (!credential) return res.status(404).json({ error: 'Lock credential not configured' });
    res.json(credential);
  } catch (error) {
    console.error('Error fetching lock credential', error);
    res.status(503).json({ error: 'Database unavailable' });
  }
});

app.put('/lock-credentials/:deviceId', async (req, res) => {
  const { method, credential } = req.body;
  if (!['Fingerprint', 'Pattern', 'PIN'].includes(method) || typeof credential !== 'string' || !credential) {
    return res.status(400).json({ error: 'method and credential are required' });
  }

  try {
    const salt = crypto.randomBytes(16).toString('hex');
    const saved = await LockCredential.findOneAndUpdate(
      { deviceId: req.params.deviceId },
      { deviceId: req.params.deviceId, method, salt, credentialHash: hashCredential(credential, salt) },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).select('deviceId method');
    res.json(saved);
  } catch (error) {
    console.error('Error saving lock credential', error);
    res.status(503).json({ error: 'Database unavailable' });
  }
});

app.post('/lock-credentials/:deviceId/verify', async (req, res) => {
  const { credential } = req.body;
  if (typeof credential !== 'string' || !credential) return res.status(400).json({ error: 'credential is required' });

  try {
    const saved = await LockCredential.findOne({ deviceId: req.params.deviceId });
    if (!saved) return res.status(404).json({ error: 'Lock credential not configured' });
    const expected = Buffer.from(saved.credentialHash, 'hex');
    const actual = Buffer.from(hashCredential(credential, saved.salt), 'hex');
    res.json({ valid: expected.length === actual.length && crypto.timingSafeEqual(expected, actual) });
  } catch (error) {
    console.error('Error verifying lock credential', error);
    res.status(503).json({ error: 'Database unavailable' });
  }
});

async function startServer() {
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected to MongoDB');
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`Backend listening on http://localhost:${port}`);
    });

    const shutdown = async (signal: string) => {
      console.log(`${signal} received, starting graceful shutdown...`);
      server.close(async () => {
        console.log('HTTP server closed');
        await mongoose.disconnect();
        console.log('MongoDB disconnected');
        process.exit(0);
      });

      setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error(`Unable to connect to MongoDB at ${mongoUri}`);
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };