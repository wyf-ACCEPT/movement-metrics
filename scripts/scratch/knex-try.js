require('dotenv').config()

const TIME_INFO_GREEN = () =>
  `\x1b[33m[${(new Date(Date.now())).toString().slice(4, 24)}]\x1b[0m \x1b[32m[INFO]\x1b[0m `

const db = require('knex')({
  client: 'pg',
  connection: process.env.PG_CONNECTION_STRING,
})

async function createTable() {
  const exists = await db.schema.hasTable('imola_metrics')
  if(!exists) {
    await db.schema.createTable('imola_metrics', (table) => {
      table.integer('block').notNullable()
      table.integer('version').notNullable()
      table.string('hash').notNullable()
      table.string('type').notNullable()
      table.specificType('addresses', 'text[]').notNullable()
    })
    console.log(`${TIME_INFO_GREEN()}Table imola_metrics created successfully`)
  } else {
    console.log(`${TIME_INFO_GREEN()}Table imola_metrics already exists`)
  }
}

async function main() {
  await createTable()

  // await db('imola_metrics').insert({
  //   block: 1,
  //   version: 1,
  //   hash: '0x1234',
  //   type: 'state_transition',
  //   addresses: ['0x1234', '0x5678']
  // })
  console.log(await db.select('*').from('imola_metrics'))

  await db('imola_metrics')
    .where({ hash: '0x1234' })
    .del()

  console.log(await db.select('*').from('imola_metrics'))
  
  db.destroy()
}

main();