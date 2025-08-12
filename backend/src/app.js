const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
require('express-async-errors');

const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');
const Category = require('./models/Category');

const app = express();

app.use(cors());
app.use(express.json());
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Attempt to drop legacy unique index on (parent, sortOrder)
(async () => {
  try {
    const indexes = await Category.collection.indexes();
    const target = indexes.find(i => i.name === 'uniq_parent_sortOrder');
    if (target) {
      await Category.collection.dropIndex('uniq_parent_sortOrder');
      console.log('Dropped index uniq_parent_sortOrder');
    }
  } catch (e) {
    // ignore
  }
})();

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/v1', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;