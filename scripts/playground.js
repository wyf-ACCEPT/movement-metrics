const winston = require('winston')
const { SuiClient, Checkpoint, SuiTransactionBlockResponse } = require('@mysten/sui/client')
const { Aptos } = require("@aptos-labs/ts-sdk")
require('dotenv').config()

const main = async () => {
  const rpcSui = new SuiClient({ url: process.env.RPC_BAKU })
  const rpcAptos = new Aptos({ fullnode: process.env.RPC_IMOLA, indexer: process.env.INDEXER_IMOLA })

  console.log(`Total cps Baku: ${await rpcSui.getLatestCheckpointSequenceNumber()}`)
  console.log(`Total txns Baku: ${await rpcSui.getTotalTransactionBlocks()}`)
  console.log(`Total txns Imola: ${await rpcAptos.getIndexerLastSuccessVersion()}`)
  // console.log(await rpcAptos.getTransactionByVersion({ ledgerVersion: 117548246 }))
}

main()