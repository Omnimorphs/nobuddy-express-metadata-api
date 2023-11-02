import { TokenDatabase } from './types/TokenDatabase';
import { IContractService } from './types/IContractService';
import { Network, Slug } from './types/_';
import { ethers } from 'ethers';
import { ApiConfig } from './types/ApiConfig';
import { get, set } from 'lodash';

export const abi = ['function ownerOf(uint256) view returns (address)'];

class ContractService implements IContractService {
  /**
   * Collection->Network->Contract
   */
  private _contracts: Record<Slug, Record<Network, ethers.Contract>> = {};
  private readonly _providers: Record<Network, ethers.providers.BaseProvider> =
    {};
  private _existsMap: Record<
    Slug,
    Record<Network, Record<string, { value: boolean; timestamp: number }>>
  > = {};

  constructor(
    private readonly _database: TokenDatabase,
    private readonly _config: ApiConfig
  ) {
    this._initContracts();
  }

  async exists(
    collectionName: Slug,
    networkName: Network,
    tokenId: number
  ): Promise<boolean> {
    let timestamp = Date.now() / 1000;

    const savedValue = get(
      this._existsMap,
      [collectionName, networkName, tokenId, 'value'],
      false
    );
    const savedTimestamp = get(
      this._existsMap,
      [collectionName, networkName, tokenId, 'timestamp'],
      0
    );

    if (
      typeof savedValue === 'boolean' &&
      savedTimestamp > timestamp - this._config.totalSupplyCacheTTlSeconds
    ) {
      return savedValue;
    }

    let value = true;
    try {
      await this._contracts[collectionName][networkName].ownerOf(tokenId);
    } catch (e) {
      console.error(
        `Error for collection: ${collectionName}, on network: ${networkName}, for tokenId: ${tokenId}`,
        e
      );
      value = savedValue;
      timestamp = savedTimestamp || timestamp;
    }
    set(this._existsMap, [collectionName, networkName, tokenId], {
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
