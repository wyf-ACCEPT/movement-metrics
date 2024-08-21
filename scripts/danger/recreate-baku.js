require('dotenv').config()

const db = require('knex')({
  client: 'pg',
  connection: process.env.PG_CONNECTION_STRING,
})

async function main() {
  await db.schema.dropTableIfExists('baku_metrics')
  console.log(`Table baku_metrics dropped successfully`)

  await db.schema.createTable('baku_metrics', (table) => {
    table.string('digest').unique()
    table.string('type').notNullable()
    table.integer('checkpoint').notNullable()
    table.integer('epoch').notNullable()
    table.timestamp('timestamp').defaultTo(null)
    table.specificType('addresses', 'text[]').notNullable()
  })
  console.log(`Table baku_metrics created successfully`)
}

main().then(() => db.destroy())