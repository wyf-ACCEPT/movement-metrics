require('dotenv').config()

const db = require('knex')({
  client: 'pg',
  connection: process.env.PG_CONNECTION_STRING,
})

async function main() {
  // await db('imola_metrics')
  //   .where('block', '>=', 5300000)
  //   .del()
  //   .then(() => console.log('Deleted'))
  //   .catch((err) => console.error(err))
}

main().then(() => db.destroy())