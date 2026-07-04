require('dotenv').config();

const cors = require('cors');
const express = require('express');
const expenseRoutes = require('./routes/expenses');

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'fan-accounting-server'
  });
});

app.use('/api/expenses', expenseRoutes);

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

app.listen(port, () => {
  console.log(`Fan accounting API server is running at http://localhost:${port}`);
});
