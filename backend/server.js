const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const port = Number(process.env.PORT || 3000);
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/userdb';

app.use(cors());
app.use(express.json());

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
  },
  { timestamps: true },
);

const User = mongoose.models.User || mongoose.model('User', userSchema);

app.get('/', (_req, res) => {
  res.json({
    service: 'screen-guard-backend',
    status: 'ok',
    endpoints: ['/health', '/users'],
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/users', async (_req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
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

async function startServer() {
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected to MongoDB');
    app.listen(port, '0.0.0.0', () => {
      console.log(`Backend listening on http://localhost:${port}`);
    });
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