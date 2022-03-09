import { Network } from './_';

export interface IContractService {
  state: (
    networkName: Network,
    collectionIndex: string | number,
    tokenId: number
  ) => Promise<number>;
}
