import { TokenDatabase } from './types/TokenDatabase';
import { IContractService } from './types/IContractService';
import { Network } from './types/_';
import { ethers } from 'ethers';
import { ApiConfig } from './types/ApiConfig';
import { get, set } from 'lodash';

export const abi = [
  'function state(uint256 collectionIndex, uint256 id) view returns (uint256)',
];

class ContractService implements IContractService {
  /**
   * Collection->Network->Contract
   */
  private _contracts: Record<Network, ethers.Contract> = {};

  private _stateMap: Record<
    Network,
    Record<string, { value: number; timestamp: number }>
  > = {};

  constructor(
    private readonly _database: TokenDatabase,
    private readonly _config: ApiConfig
  ) {
    this._initContracts();
  }

  async state(
    networkName: Network,
    collectionIndex: string | number,
    tokenId: number
  ): Promise<number> {
    const timestamp = Date.now() / 1000;
    const savedValue = get(this._stateMap, [networkName, tokenId, 'value']);
    const savedTimestamp = get(this._stateMap, [
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
        await this._contracts[networkName].state(
          parseInt(collectionIndex.toString()),
          tokenId
        )
      );
    } catch (e) {
      // if intentional contract error, throw
      if (e?.message?.match(/PixelBlossom:/)) {
        throw e;
      }
      // return saved value or 0, if not intentional contract error
      return savedValue || 0;
    }

    set(this._stateMap, [networkName, tokenId], {
      value,
      timestamp,
    });

    return value;
  }

  private _initContracts() {
    // iterating deployed contracts for the collection
    for (const [network, { address }] of Object.entries(
      this._database.contract.deployments
    )) {
      // create the contract instance with the appropriate provider
      set(
        this._contracts,
        network,
        new ethers.Contract(
          address,
          abi,
          ethers.getDefaultProvider(network, this._config.ethers?.apiKeys)
        )
      );
    }
  }
}

export default ContractService;
