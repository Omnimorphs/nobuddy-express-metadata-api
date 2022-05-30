import { Network } from './_';

export interface IContractService {
  state: (networkName: Network) => Promise<number>;
}
