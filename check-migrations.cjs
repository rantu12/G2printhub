require("dotenv").config();

const { Client } = require("pg");

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();

  try {
    const result = await client.query(`
      SELECT migration_name, finished_at, rolled_back_at
      FROM "_prisma_migrations"
      WHERE migration_name LIKE '%custom_print%'
         OR migration_name LIKE '%custom_artwork%'
      ORDER BY migration_name
    `);

    console.table(result.rows);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
