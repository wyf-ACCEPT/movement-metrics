require('dotenv').config()

const db = require('knex')({
  client: 'pg',
  connection: process.env.PG_CONNECTION_STRING,
})

async function main() {
  // await db.schema.dropTableIfExists('baku_metrics')
  // console.log(`Table baku_metrics dropped successfully`)

  await db.schema.createTable('baku_metrics', (table) => {
    table.string('digest').unique()     // `hash` in imola
    table.string('type').notNullable()
    table.integer('checkpoint').notNullable()     // `block` in imola
    table.integer('epoch').notNullable()          // Imola doesn't have `epoch` but has `version`
    table.timestamp('timestamp').defaultTo(null)
    table.specificType('addresses', 'text[]').notNullable()
  })
  console.log(`Table baku_metrics created successfully`)
}

main().then(() => db.destroy())