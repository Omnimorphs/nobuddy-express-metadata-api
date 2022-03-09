import { Network, Slug } from './_';

export interface IContractService {
  state: (
    collectionName: Slug,
    networkName: Network,
    tokenId: number
  ) => Promise<number>;
}
