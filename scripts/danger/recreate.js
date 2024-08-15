require('dotenv').config()

const db = require('knex')({
  client: 'pg',
  connection: process.env.PG_CONNECTION_STRING,
})

async function main() {
  await db.schema.dropTableIfExists('imola_metrics')
  console.log(`Table imola_metrics dropped successfully`)

  await db.schema.createTable('imola_metrics', (table) => {
    table.string('hash').unique()
    table.string('type').notNullable()
    table.integer('block').notNullable()
    table.integer('version').notNullable()
    table.timestamp('timestamp').defaultTo(null)
    table.specificType('addresses', 'text[]').notNullable()
  })
  console.log(`Table imola_metrics created successfully`)
}

main().then(() => db.destroy())