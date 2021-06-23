import { Network, Slug } from './_';

export interface IContractService {
  getTotalSupply: (
    collectionName: string,
    networkName: string
  ) => Promise<number>;
  waitForWeb3Connection: () => Promise<void>;
  totalSupplyMap: Record<Slug, Record<Network, number>>;
}
