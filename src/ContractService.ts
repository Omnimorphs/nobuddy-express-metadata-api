import { TokenDatabase } from './types/TokenDatabase';
import { IContractService } from './types/IContractService';
import { Network, Slug } from './types/_';
import { ethers } from 'ethers';
import { ApiConfig } from './types/ApiConfig';
import { get, set } from 'lodash';

export const abi = ['function state(uint256 id) view returns (uint256)'];

class ContractService implements IContractService {
  /**
   * Collection->Network->Contract
   */
  private _contracts: Record<Slug, Record<Network, ethers.Contract>> = {};
  private readonly _providers: Record<Network, ethers.providers.BaseProvider> =
    {};
  private _stateMap: Record<
    Slug,
    Record<Network, Record<string, { value: number; timestamp: number }>>
  > = {};

  constructor(
    private readonly _database: TokenDatabase,
    private readonly _config: ApiConfig
  ) {
    this._initContracts();
  }

  async state(
    collectionName: Slug,
    networkName: Network,
    tokenId: number
  ): Promise<number> {
    const timestamp = Date.now() / 1000;
    const savedValue = get(this._stateMap, [
      collectionName,
      networkName,
      tokenId,
      'value',
    ]);
    const savedTimestamp = get(this._stateMap, [
      collectionName,
      networkName,
      tokenId,
      'timestamp',
    ]);

    if (
      typeof savedValue === 'number' &&
      savedTimestamp > timestamp - this._config.stateCacheTTLSeconds
    ) {
      return savedValue;
    }

    let value;
    try {
      value = parseInt(
        await this._contracts[collectionName][networkName].state(tokenId)
      );
    } catch (e) {
      return savedValue || 0;
    }

    set(this._stateMap, [collectionName, networkName, tokenId], {
      value,
      timestamp,
    });

    return value;
  }

  private _initContracts() {
    // iterating collections in the database
    for (const [collectionName, collection] of Object.entries(this._database)) {
      // iterating deployed contracts for the collection
      for (const [network, { address }] of Object.entries(
        collection.contract.deployments
      )) {
        // if provider for the given network does not exist yet, create it
        if (!this._providers[network]) {
          this._providers[network] = ethers.getDefaultProvider(
            network,
            this._config.ethers?.apiKeys
          );
        }
        // create the contract instance with the appropriate provider
        set(
          this._contracts,
          [collectionName, network],
          new ethers.Contract(address, abi, this._providers[network])
        );
      }
    }
  }
}

export default ContractService;
