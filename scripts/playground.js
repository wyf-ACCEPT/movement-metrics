const winston = require('winston')
const { SuiClient: OriginSuiClient, Checkpoint, SuiTransactionBlockResponse, MultiGetTransactionBlocksParams } = require('@mysten/sui/client')
const { Aptos } = require("@aptos-labs/ts-sdk")
require('dotenv').config()


class SuiClient extends OriginSuiClient {

  /**
   * @param {MultiGetTransactionBlocksParams} input
   * @returns {Promise<SuiTransactionBlockResponse[]>}
   */
  async multiGetTransactionBlocks(input) {
    if (input.digests.length <= 50)
      return super.multiGetTransactionBlocks(input)
    else {
      const responsePromises = []
      for (let i = 0; i < input.digests.length; i += 50) {
        responsePromises.push(super.multiGetTransactionBlocks({
          digests: input.digests.slice(i, i + 50),
          options: input.options,
        }))
      }
      return Promise.all(responsePromises)
        .then(responses => responses.flat())
    }
  }
}


const main = async () => {
  const rpcSui = new SuiClient({ url: process.env.RPC_BAKU })
  const rpcAptos = new Aptos({ fullnode: process.env.RPC_IMOLA, indexer: process.env.INDEXER_IMOLA })

  // console.log(`Total cps Baku: ${await rpcSui.getLatestCheckpointSequenceNumber()}`)
  // console.log(`Total txns Baku: ${await rpcSui.getTotalTransactionBlocks()}`)
  // console.log(`Total txns Imola: ${await rpcAptos.getIndexerLastSuccessVersion()}`)
  // console.log(await rpcAptos.getTransactionByVersion({ ledgerVersion: 117548246 }))

  // =============== 2024-08-22 15:20:48 ===============
  // Array(100)
  //   .fill(0)
  //   .forEach((_, idx) => {
  //     rpcSui.getCheckpoint({ id: (6309000 + idx).toString() })
  //       .then(checkpoint => {
  //         console.log(`Checkpoint ${6309000 + idx}: ${checkpoint.transactions.length} txns`)
  //       })
  //   })

  // await rpcSui.getCheckpoint({ id: '6309037' }) // Has 59 txns
  //   .then(checkpoint => {rpcSui.multiGetTransactionBlocks({
  //     digests: checkpoint.transactions, options: { showEffects: true, showInput: true }
  //   }); console.log(checkpoint.transactions)})
  //   .then(responses => require('fs').writeFileSync(
  //     'checkpoint-6309037-2.json', JSON.stringify(responses, null, 2)
  //   ))


  // =============== 2024-08-23 14:05:21 ===============
  // const r = require('../data/1.json')
  // console.log(r)
  console.log(require('fs').existsSync('./data/1.json'))
  console.log(require('../data/1.json'))
  require('fs').writeFileSync('./data/1.json', JSON.stringify([1, 2], null, 2))

}

main()