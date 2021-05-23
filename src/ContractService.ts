import { Contract } from 'web3-eth-contract';
import { WebsocketProvider } from 'web3-core';
import { AbiItem } from 'web3-utils';
import Web3 from 'web3';
import { InvalidAuthTypeError, InvalidTotalSupplyResponse } from './errors';
import { TokenDatabase } from './types/TokenDatabase';
import { IContractService } from './types/IContractService';
import { Web3Config } from './types/Web3Config';

export const wsConfig = {
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

export const abi: AbiItem[] = [
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

class ContractService implements IContractService {
  public web3: Web3;
  public totalSupplyMap: Record<string, number> = {};
  private readonly _config: Web3Config;
  private readonly _database: TokenDatabase;
  private _contracts: Record<string, Contract> = {};
  private _totalSupplyLastQueriedMap: Record<string, number> = {};

  constructor(database: TokenDatabase, _config: Web3Config) {
    this._config = _config;

    this._database = database;

    this.web3 = new Web3(this._createProvider());

    this._initContracts();
  }

  /**
   * Resets web3 socket connection and waits until it's connected
   */
  public resetConnection(): Promise<void> {
    this.web3 = new Web3(this._createProvider());
    this._initContracts();
    return this.waitForWeb3Connection();
  }

  /**
   * Waits until Web3 is connected through the socket
   */
  public waitForWeb3Connection(): Promise<void> {
    return new Promise<void>((resolve) => {
      (this.web3.currentProvider as WebsocketProvider).once('connect', resolve);
    });
  }

  /**
   * Returns the current totalSupply value for a collection
   * Caches result for config.totalSupplyCacheTTlSeconds seconds
   * @param collectionName
   */
  public async getTotalSupply(collectionName: string): Promise<number> {
    // if the collection has no contractAddress, it will not be added to the
    // contracts map, therefore this logic does not apply
    if (!this._contracts[collectionName]) {
      return Infinity;
    }
    if (
      !this.totalSupplyMap[collectionName] ||
      this._totalSupplyLastQueriedMap[collectionName] +
        (this._config.totalSupplyCacheTTlSeconds as number) * 1000 <=
        Date.now()
    ) {
      let response;
      try {
        response = await this._getTotalSupplyResponse(collectionName);
      } catch (e) {
        // a single retry on error, after re-initializing the web3 instance and connection
        await this.resetConnection();
        response = await this._getTotalSupplyResponse(collectionName);
      }

      const totalSupply = parseInt(response);

      if (isNaN(totalSupply)) {
        throw new InvalidTotalSupplyResponse(
          `Invalid total supply response for collection ${collectionName}`
        );
      }

      this.totalSupplyMap[collectionName] = totalSupply;
      this._totalSupplyLastQueriedMap[collectionName] = Date.now();
    }
    return this.totalSupplyMap[collectionName];
  }

  /**
   * Initializes Web3.eth.Contract objects for all collections in the database
   * @private
   */
  private _initContracts(): void {
    this._contracts = Object.entries(this._database)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .filter(([_, collection]) => collection.contractAddress)
      .reduce((obj, [collectionName, collection]) => {
        obj[collectionName] = new this.web3.eth.Contract(
          abi,
          collection.contractAddress
        );
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

  private async _getTotalSupplyResponse(collectionName: string) {
    return await this._contracts[collectionName].methods.totalSupply().call();
  }
}

export default ContractService;
