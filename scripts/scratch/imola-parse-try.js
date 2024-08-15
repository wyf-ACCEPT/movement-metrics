const { Aptos, TransactionResponseType, Block, } = require("@aptos-labs/ts-sdk")
const { writeFileSync } = require("fs")

require("dotenv").config()

// CHECKPOINT = 100
const BATCH_SIZE = 100
const TIME_INFO_GREEN = () =>
  `[${(new Date(Date.now())).toString().slice(4, 24)}] \x1b[32m[INFO]\x1b[0m`
const TIME_INFO_GREEN_YELLOW = () =>
  `[${(new Date(Date.now())).toString().slice(4, 24)}] \x1b[33m[INFO]\x1b[0m`

/**
 * @param {Block} blockRaw 
 * @returns {[number, number, string, string, string[], string][]}
 */
function parseBlockRaw(blockRaw) {
  return blockRaw.transactions === null ? [] : blockRaw.transactions
    .filter(txn => txn.type != TransactionResponseType.Pending)
    .map(txn => {
      const addressList = txn.changes
        .filter(change => change.type === 'write_resource' && change.address != '0x1')
        .map(change => change.address)
      const addressListUnique = [...new Set(addressList)]
      return [
        parseInt(blockRaw.block_height), parseInt(txn.version), txn.hash, txn.type, addressListUnique,
        txn.timestamp
      ]
    })
}

const main = async () => {
  const rpcAptos = new Aptos({ fullnode: process.env.RPC_APTOS })

  rpcAptos.getBlockByHeight(
    { blockHeight: 200, options: { withTransactions: true } }
  ).then(blockRaw => {
    console.log(parseBlockRaw(blockRaw))
  })


  // for (let i = 0; i < 500; i++) {
  //   const dataBatch = []
  //   const blockPromises = []
  //   for (let j = 0; j < BATCH_SIZE; j++) {
  //     const blockCurrent = i * BATCH_SIZE + j
  //     blockPromises.push(
  //       rpcAptos.getBlockByHeight(
  //         { blockHeight: blockCurrent, options: { withTransactions: true } }
  //       ).then(blockRaw => {
  //         dataBatch.push(parseBlockRaw(blockRaw))
  //       })
  //     )
  //     // if (j % CHECKPOINT === CHECKPOINT - 1) {
  //     //   console.log(`${TIME_INFO_GREEN_YELLOW()} Checkpoint ${j+1} for batch ${i}`)
  //     // }
  //   }
  //   Promise.all(blockPromises)
  //     .then(() => {
  //       console.log(`${TIME_INFO_GREEN()} Batch parsed: ${i}`)
  //       dataConcat = [].concat(...dataBatch)
  //       writeFileSync(
  //         `./data/blocks/batch_${i}.json`,
  //         JSON.stringify(dataConcat.sort((a, b) => (a[0] - b[0])), null, 2)
  //       )
  //     })
  // }

}

main()
