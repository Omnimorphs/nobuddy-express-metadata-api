import { Network, Slug } from './_';

export interface IContractService {
  exists: (
    collectionName: Slug,
    networkName: Network,
    tokenId: number
  ) => Promise<boolean>;
}
