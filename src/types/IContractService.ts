import { Network, Slug } from './_';

export interface IContractService {
  getTotalSupply: (
    collectionName: string,
    networkName: string
  ) => Promise<number>;
  totalSupplyMap: Record<Slug, Record<Network, number>>;
}
