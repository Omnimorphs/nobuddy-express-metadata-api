import { Contract } from 'web3-eth-contract';
import { WebsocketProvider } from 'web3-core';
import { AbiItem } from 'web3-utils';
import Web3 from 'web3';
import {
  InvalidAuthTypeError,
  InvalidTotalSupplyResponse,
  ContractNotFoundError,
} from './errors';
import { TokenDatabase } from './types/TokenDatabase';
import { IContractService } from './types/IContractService';
import { Web3Config } from './types/Web3Config';

const wsConfig = {
  timeout: 30000,
  clientConfig: {
    keepalive: true,
    keepaliveInterval: 20000,
  },
  reconnect: {
    auto: true,
    delay: 1000,
    maxAttempts: 10,
    onTimeout: false,
  },
};

const abi: AbiItem[] = [
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

class ContractService implements IContractService {
  private readonly _config: Web3Config;
  private readonly _database: TokenDatabase;
  private _web3: Web3;
  private _contracts: Record<string, Contract> = {};
  private _totalSupplyLastQueriedMap: Record<string, number> = {};
  public totalSupplyMap: Record<string, number> = {};

  constructor(database: TokenDatabase, _config: Web3Config) {
    this._config = _config;

    this._database = database;

    this._web3 = new Web3(this._createProvider());

    this._initContracts();
  }

  /**
   * Waits until Web3 is connected through the socket
   */
  public waitForWeb3Connection(): Promise<void> {
    return new Promise<void>((resolve) => {
      (this._web3.currentProvider as WebsocketProvider).once(
        'connected',
        resolve
      );
    });
  }

  /**
   * Returns the current totalSupply value for a collection
   * Caches result for config.totalSupplyCacheTTlSeconds seconds
   * @param collectionName
   */
  public async getTotalSupply(collectionName: string): Promise<number> {
    if (
      !this.totalSupplyMap[collectionName] ||
      this._totalSupplyLastQueriedMap[collectionName] +
        this._config.totalSupplyCacheTTlSeconds * 1000 <=
        new Date().getTime()
    ) {
      if (!this._contracts[collectionName]) {
        throw new ContractNotFoundError(
          `Web3 contract for collection ${collectionName} is not found`
        );
      }
      let response;
      try {
        response = await this._getTotalSupplyResponse(collectionName);
      } catch (e) {
        // a single retry on error, after re-initializing the web3 instance and connection
        await this._resetConnection();
        response = await this._getTotalSupplyResponse(collectionName);
      }

      if (!response || typeof response[0] !== 'number') {
        throw new InvalidTotalSupplyResponse(
          `Invalid total supply response for collection ${collectionName}`
        );
      }

      this.totalSupplyMap[collectionName] = response[0];
      this._totalSupplyLastQueriedMap[collectionName] = new Date().getTime();
    }
    return this.totalSupplyMap[collectionName];
  }

  /**
   * Initializes Web3.eth.Contract objects for all collections in the database
   * @private
   */
  private _initContracts(): void {
    this._contracts = Object.entries(this._database)
      .map(([collectionName, collection]) => ({
        contract: new this._web3.eth.Contract(abi, collection.contractAddress),
        collectionName,
      }))
      .reduce((obj, { collectionName, contract }) => {
        obj[collectionName] = contract;
        return obj;
      }, {});
  }

  /**
   * Creates a Web3 WebsocketProvider based on the provided config
   * @private
   */
  private _createProvider(): WebsocketProvider {
    let authorization: string;
    if (this._config.authorization.type === 'Basic') {
      authorization = `${this._config.authorization.type} ${Buffer.from(
        this._config.authorization.value as string
      ).toString('base64')}`;
    } else if (this._config.authorization.type === 'Bearer') {
      authorization = `${this._config.authorization.type} ${this._config.authorization.value}`;
    } else {
      throw new InvalidAuthTypeError(
        `Invalid web3 auth type: ${this._config.authorization.type}`
      );
    }
    return new Web3.providers.WebsocketProvider(this._config.host as string, {
      headers: { authorization },
      ...wsConfig,
    });
  }

  private async _resetConnection() {
    this._web3 = new Web3(this._createProvider());
    this._initContracts();
    await this.waitForWeb3Connection();
  }

  private async _getTotalSupplyResponse(collectionName: string) {
    return await this._contracts[collectionName].methods.totalSupply().call();
  }
}

export default ContractService;
