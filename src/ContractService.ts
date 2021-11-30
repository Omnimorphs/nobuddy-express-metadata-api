import { TokenDatabase } from './types/TokenDatabase';
import { IContractService } from './types/IContractService';
import { Network, Slug } from './types/_';
import { ethers } from 'ethers';
import { ApiConfig } from './types/ApiConfig';
import { set } from 'lodash';

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
    const timestamp = Date.now() / 1000;
    if (
      typeof this._existsMap[collectionName][networkName][tokenId]?.value ===
        'boolean' &&
      this._existsMap[collectionName][networkName][tokenId]?.timestamp >
        timestamp - this._config.totalSupplyCacheTTlSeconds
    ) {
      return this._existsMap[collectionName][networkName][tokenId].value;
    }

    let value = true;
    try {
      await this._contracts[collectionName][networkName].ownerOf(tokenId);
    } catch (e) {
      value = false;
    }
    this._existsMap[collectionName][networkName][tokenId] = {
      value,
      timestamp,
    };
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
