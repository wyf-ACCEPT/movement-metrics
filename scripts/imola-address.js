require('dotenv').config()

const db = require('knex')({
  client: 'pg',
  connection: process.env.PG_CONNECTION_STRING,
})

async function main() {
  await db.schema.createTable('imola_addresses', (table) => {
    table.timestamp('timestamp');
    table.string('address');
  });

  await db.raw(`
    INSERT INTO imola_addresses (timestamp, address)
    SELECT timestamp, unnest(addresses) as address
    FROM imola_metrics
  `);

  db.destroy();
}

main().catch(console.error);
