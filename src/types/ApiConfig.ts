import { ApiKeys } from './ApiKeys';

export type ApiConfig = {
  ethers?: {
    apiKeys?: ApiKeys;
  };
  stateCacheTTLSeconds: number;
};
