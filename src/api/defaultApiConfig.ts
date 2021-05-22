import { ApiConfig } from '../types/ApiConfig';

const config: ApiConfig = {
  web3: {
    host: process.env.WEB3_HOST, // node host that web3 connects to
    authorization: {
      type: process.env.WEB3_AUTH_TYPE || 'Basic', // possible values - Basic, Bearer
      value: process.env.WEB3_AUTH_VALUE, // - in case of basic, string value is enough, it will be encoded
    },
    /**
     * The contract will only be queried for the total supply once every n seconds
     * This can be useful if you're using a 3rd party node provider with rate limits, such as Infura
     */
    totalSupplyCacheTTlSeconds: process.env.TOTAL_SUPPLY_CACHE_TTL
      ? parseInt(process.env.TOTAL_SUPPLY_CACHE_TTL)
      : 300,
  },
};

export default config;
