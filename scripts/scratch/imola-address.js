require('dotenv').config()

const db = require('knex')({
  client: 'pg',
  connection: process.env.PG_CONNECTION_STRING,
})

async function main() {
  if (!(await db.schema.hasTable('imola_addresses'))) {
    await db.schema.createTable('imola_addresses', (table) => {
      table.timestamp('timestamp');
      table.string('address');
    });

    await db.raw(`
      INSERT INTO imola_addresses (timestamp, address)
      SELECT timestamp, unnest(addresses) as address
      FROM imola_metrics
    `);
    console.log('Inserted all addresses from imola_metrics to imola_addresses');

    await db.raw(`
      DELETE FROM imola_addresses
      WHERE timestamp > (
        SELECT MIN(sub.timestamp)
        FROM imola_addresses sub
        WHERE sub.address = imola_addresses.address
      )
    `);
    console.log('Deleted duplicate addresses from imola_addresses');

    // await db.raw(`
    //   INSERT INTO imola_addresses (timestamp, address)
    //   SELECT m.timestamp, address
    //   FROM (
    //     SELECT timestamp, unnest(addresses) as address
    //     FROM imola_metrics
    //   ) as m
    //   WHERE NOT EXISTS (
    //     SELECT 1
    //     FROM imola_addresses a
    //     WHERE a.address = m.address
    //   )
    //   ORDER BY m.timestamp
    // `)
  }

  else {

    await db.raw(`
      DELETE FROM imola_addresses
      WHERE timestamp > (
        SELECT MIN(sub.timestamp)
        FROM imola_addresses sub
        WHERE sub.address = imola_addresses.address
      )
    `);
    console.log('Deleted duplicate addresses from imola_addresses');


    console.log(await db('imola_addresses')
      // .select('*')
      // .whereNotNull('timestamp')
      // .orderBy('timestamp', 'desc')
      // .limit(5)
      .select('address')
      .count('address')
      .groupBy('address')
      .where('timestamp', '>=', '2024-07-16 00:00:00')
      .andWhere('timestamp', '<=', '2024-08-05 23:59:59')
    );
  }

  db.destroy();
}
// '2024-07-16 00:00:00', '2024-08-05 23:59:59'
main().catch(console.error);
