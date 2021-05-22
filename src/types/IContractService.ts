export interface IContractService {
  getTotalSupply: (collectionName: string) => Promise<number>;
  waitForWeb3Connection: () => Promise<void>;
  totalSupplyMap: Record<string, number>;
}
