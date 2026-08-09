require('dotenv').config();
const pool = require('./postgres');
const bcrypt = require('bcrypt');

const TEST_USER = {
  email: 'test@example.com',
  password: 'password123',
  name: 'Test User',
  role: 'student',
  status: 'active',
};

async function seed() {
  console.log('Running seed...');

  const passwordHash = await bcrypt.hash(TEST_USER.password, 10);

  try {
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING
       RETURNING id, email`,
      [TEST_USER.email, passwordHash, TEST_USER.name, TEST_USER.role, TEST_USER.status]
    );

    if (result.rows.length > 0) {
      console.log('Seed user created:', result.rows[0]);
    } else {
      console.log('Seed user already exists — skipped.');
    }

    console.log('\nTest credentials:');
    console.log('  email   :', TEST_USER.email);
    console.log('  password:', TEST_USER.password);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
