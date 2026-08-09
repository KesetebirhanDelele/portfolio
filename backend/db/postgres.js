const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'repo2reputation',
  password: process.env.DB_PASSWORD,
  port: 5432,
});
pool.connect((err) => {
  if (err) {
    console.error('PostgreSQL connection failed:', err.message);
  } else {
    console.log('PostgreSQL connected successfully');
  }
});

module.exports = pool;

