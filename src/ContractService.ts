import { Contract } from 'web3-eth-contract';
import { WebsocketProvider } from 'web3-core';
import { AbiItem } from 'web3-utils';
import Web3 from 'web3';
import { InvalidAuthTypeError, InvalidTotalSupplyResponse } from './errors';
import { TokenDatabase } from './types/TokenDatabase';
import { IContractService } from './types/IContractService';
import { Web3Config } from './types/Web3Config';
import { Network, Slug } from './types/_';

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
  /**
   * Collection->Network->totalSupply
   */
  public totalSupplyMap: Record<Slug, Record<Network, number>> = {};
  public web3: Web3;

  /**
   * Collection->Network->Contract
   */
  private _contracts: Record<Slug, Record<Network, Contract>> = {};
  /**
   * Collection->Network->lastQueriedDate
   * @private
   */
  private _totalSupplyLastQueriedMap: Record<Slug, Record<Network, number>> =
    {};
  private readonly _config: Web3Config;
  private readonly _database: TokenDatabase;

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
   * @param networkName
   */
  public async getTotalSupply(
    collectionName: Slug,
    networkName: Network
  ): Promise<number> {
    // if the collection has no contractAddress, it will not be added to the
    // contracts map, therefore this logic does not apply
    if (!this._contracts[collectionName][networkName]) {
      return Infinity;
    }
    if (
      !this.totalSupplyMap[collectionName][networkName] ||
      this._totalSupplyLastQueriedMap[collectionName][networkName] +
        (this._config.totalSupplyCacheTTlSeconds as number) * 1000 <=
        Date.now()
    ) {
      let response;
      try {
        response = await this._getTotalSupplyResponse(
          collectionName,
          networkName
        );
      } catch (e) {
        // a single retry on error, after re-initializing the web3 instance and connection
        await this.resetConnection();
        response = await this._getTotalSupplyResponse(
          collectionName,
          networkName
        );
      }

      const totalSupply = parseInt(response);

      if (isNaN(totalSupply)) {
        throw new InvalidTotalSupplyResponse(
          `Invalid total supply response for collection ${collectionName}`
        );
      }

      this.totalSupplyMap[collectionName][networkName] = totalSupply;
      this._totalSupplyLastQueriedMap[collectionName][networkName] = Date.now();
    }
    return this.totalSupplyMap[collectionName][networkName];
  }

  /**
   * Initializes Web3.eth.Contract objects for all deployed contracts
   * of all collections in the database
   * @private
   */
  private _initContracts(): void {
    this._contracts = Object.entries(this._database)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .filter(([_, collection]) => collection.contract.deployments)
      .reduce((obj, [collectionName, collection]) => {
        obj[collectionName] = {};
        Object.entries(collection.contract.deployments).forEach(
          ([network, { address }]) => {
            obj[collectionName][network] = new this.web3.eth.Contract(
              abi,
              address
            );
          }
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

  private async _getTotalSupplyResponse(
    collectionName: Slug,
    networkName: Network
  ) {
    return await this._contracts[collectionName][networkName].methods
      .totalSupply()
      .call();
  }
}

export default ContractService;
