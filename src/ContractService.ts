import { InvalidTotalSupplyResponse } from './errors';
import { TokenDatabase } from './types/TokenDatabase';
import { IContractService } from './types/IContractService';
import { Network, Slug } from './types/_';
import { ethers } from 'ethers';
import { ApiConfig } from './types/ApiConfig';
import { get, set } from 'lodash';

export const abi = ['function totalSupply() view returns (uint256)'];

class ContractService implements IContractService {
  /**
   * Collection->Network->totalSupply
   */
  public totalSupplyMap: Record<Slug, Record<Network, number>> = {};

  /**
   * Collection->Network->Contract
   */
  private _contracts: Record<Slug, Record<Network, ethers.Contract>> = {};
  /**
   * Collection->Network->totalSupplyLastQueried
   * @private
   */
  private _totalSupplyLastQueriedMap: Record<Slug, Record<Network, number>> =
    {};
  private readonly _providers: Record<Network, ethers.providers.BaseProvider> =
    {};

  constructor(
    private readonly _database: TokenDatabase,
    private readonly _config: ApiConfig
  ) {
    this._initContracts();
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
      !get(this.totalSupplyMap, [collectionName, networkName]) ||
      this._totalSupplyLastQueriedMap[collectionName][networkName] +
        (this._config.totalSupplyCacheTTlSeconds as number) * 1000 <=
        Date.now()
    ) {
      const totalSupplyBigNumber: ethers.BigNumber =
        await this._getTotalSupplyResponse(collectionName, networkName);

      const totalSupply = totalSupplyBigNumber.toNumber();

      if (isNaN(totalSupply)) {
        throw new InvalidTotalSupplyResponse(
          `Invalid total supply response for collection ${collectionName}`
        );
      }

      set(this.totalSupplyMap, [collectionName, networkName], totalSupply);
      set(
        this._totalSupplyLastQueriedMap,
        [collectionName, networkName],
        Date.now()
      );
    }
    return this.totalSupplyMap[collectionName][networkName];
  }

  private async _getTotalSupplyResponse(
    collectionName: Slug,
    networkName: Network
  ): Promise<ethers.BigNumber> {
    return await this._contracts[collectionName][networkName].totalSupply();
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
