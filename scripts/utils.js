const winston = require('winston')
const BigNumber = require('bignumber.js')
const {
  Aptos, Account, Block, AnyNumber, HexInput, AnyRawTransaction, PendingTransactionResponse
} = require("@aptos-labs/ts-sdk")


const logger = winston.createLogger({
  level: 'silly',
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level}]: ${message}`),
  ),
  transports: [
    new winston.transports.Console(),
    // new winston.transports.File({ filename: 'logs/imola-send.log'}),
  ],
})


class AptosWithRetries extends Aptos {
  #interval = 1000

  /**
   * @param {{blockHeight: AnyNumber, options?: {withTransactions?: boolean}}} args 
   * @returns {Promise<Block>}
   */
  async getBlockByHeight(args) {
    return super.getBlockByHeight(args)
      .then(response => response)
      .catch(async error => {
        logger.warn('Error: ', error.toString().slice(0, 1000) + '...')
        logger.warn('Retrying getBlockByHeight...')
        return new Promise(resolve => setTimeout(resolve, this.#interval))
          .then(() => this.getBlockByHeight(args))
      })
  }

  /**
   * @return {Promise<bigint>}
   */
  async getIndexerLastSuccessVersion() {
    return super.getIndexerLastSuccessVersion()
      .then(response => response)
      .catch(async error => {
        logger.warn('Error: ', error.toString().slice(0, 1000) + '...')
        logger.warn('Retrying getIndexerLastSuccessVersion...')
        return new Promise(resolve => setTimeout(resolve, this.#interval))
          .then(() => this.getIndexerLastSuccessVersion())
      })
  }

  /**
   * @param {{signer: Account, transaction: AnyRawTransaction}} args
   * @returns {Promise<PendingTransactionResponse>}
   */
  async signAndSubmitTransaction(args) {
    return super.signAndSubmitTransaction(args)
      .then(response => response)
      .catch(async error => {
        logger.warn('Error: ', error.toString().slice(0, 1000) + '...')
        logger.warn('Retrying signAndSubmitTransaction...')
        return new Promise(resolve => setTimeout(resolve, this.#interval))
          .then(() => this.signAndSubmitTransaction(args))
      })
  }

  /**
   * @param {{transactionHash: HexInput}} args 
   * @returns 
   */
  async getTransactionByHash(args) {
    return super.getTransactionByHash(args)
      .then(response => response)
      .catch(async error => {
        logger.warn('Error: ', error.toString().slice(0, 1000) + '...')
        logger.warn('Retrying getTransactionByHash...')
        return new Promise(resolve => setTimeout(resolve, this.#interval))
          .then(() => this.getTransactionByHash(args))
      })
  }

  /**
   * @param {{accountAddress: AccountAddressInput, minimumLedgerVersion?: AnyNumber}} args
   * @returns {Promise<number>}
   */
  async getAccountAPTAmount(args) {
    return super.getAccountAPTAmount(args)
      .then(response => response)
      .catch(async error => {
        logger.warn('Error: ', error.toString().slice(0, 1000) + '...')
        logger.warn('Retrying getAccountAPTAmount...')
        return new Promise(resolve => setTimeout(resolve, this.#interval))
          .then(() => this.getAccountAPTAmount(args))
      })
  }

}


module.exports = {
  AptosWithRetries, logger,
}

