require('dotenv').config();

const cors = require('cors');
const express = require('express');
const path = require('path');
const expenseRoutes = require('./routes/expenses');
const stageRoutes = require('./routes/stages');
const collectionRoutes = require('./routes/collections');
const userCollectionRoutes = require('./routes/userCollections');
const userStageRoutes = require('./routes/userStages');
const stageNoteRoutes = require('./routes/stageNotes');
const authRoutes = require('./routes/auth');
const budgetRoutes = require('./routes/budgets');
const { requireAuth } = require('./utils/auth');

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/collection-images', express.static(path.join(__dirname, '..', 'public', 'collection-images')));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'fan-accounting-server'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api', requireAuth);

app.use('/api/expenses', expenseRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/stages', stageRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/user-collections', userCollectionRoutes);
app.use('/api/user-stages', userStageRoutes);
app.use('/api/stage-notes', stageNoteRoutes);

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    message: 'API not found'
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    ok: false,
    message: err.message || 'Internal server error'
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Fan accounting API server is running at http://localhost:${port}`);
});

