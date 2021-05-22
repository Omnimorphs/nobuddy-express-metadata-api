export type Web3Config = {
  host?: string;
  authorization: {
    type: string;
    value?: string;
  };
  totalSupplyCacheTTlSeconds: number;
};
