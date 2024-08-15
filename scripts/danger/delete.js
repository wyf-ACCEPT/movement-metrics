require('dotenv').config()

const db = require('knex')({
  client: 'pg',
  connection: process.env.PG_CONNECTION_STRING,
})

async function main() {
  await db('imola_metrics').del()
  console.log('Deleted all rows from imola_metrics')
}

main().then(() => db.destroy())