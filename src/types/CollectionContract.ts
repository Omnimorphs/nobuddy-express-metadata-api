import { Address, Network } from './_';

export type CollectionContract = {
  deployments: Record<Network, { address: Address }>;
};
