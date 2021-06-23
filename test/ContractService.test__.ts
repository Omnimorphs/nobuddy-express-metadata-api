jest.mock('web3');
import { TokenDatabase } from '../src/types/TokenDatabase';
import Web3 from 'web3';
import { ApiConfig } from '../src/types/ApiConfig';
import ContractService, { wsConfig } from '../src/ContractService';
import { Web3Config } from '../src/types/Web3Config';
import { mocked } from 'ts-jest/utils';
import {
  InvalidAuthTypeError,
  InvalidTotalSupplyResponse,
} from '../src/errors';

afterEach(() => jest.clearAllMocks());

const database: TokenDatabase = {
  collection: {
    contract: {
      deployments: {
        network: {
          address: 'dadsdas',
        },
      },
    },
    tokens: {
      placeholder: {
        name: 'placeholder',
      },
      0: {
        name: 0,
      },
    },
  },
};

const config: ApiConfig = {
  web3: {
    host: 'testWeb3Host',
    authorization: {
      type: 'Basic',
      value: 'authValue',
    },
  },
};

const mockContractConstructor = jest.fn((abi, contractAddress) => ({
  contractAddress,
}));

mocked(Web3).mockReturnValue({
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  eth: { Contract: mockContractConstructor },
});

describe('ContractService.constructor', () => {
  it('should call constructor with all proper values', () => {
    const contractService = new ContractService(
      database,
      config.web3 as Web3Config
    );

    // check if web3, _contracts, _database and _config are assigned
    expect(contractService.web3).toStrictEqual({
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      eth: { Contract: mockContractConstructor },
    });
    expect(Object.keys(contractService['_contracts'])).toHaveLength(1);
    expect(Object.keys(contractService['_contracts'].collection)).toHaveLength(
      1
    );
    expect(contractService['_contracts'].collection.network).toEqual({
      contractAddress: database.collection.contract.deployments.network.address,
    });
    expect(contractService['_database']).toStrictEqual(database);
    expect(contractService['_config']).toStrictEqual(config.web3);
  });
});

describe('ContractService._createProvider', () => {
  it('should create with different auth types', () => {
    const config: ApiConfig = {
      web3: {
        host: 'testWeb3Host',
        authorization: {
          type: 'Basic',
          value: 'authValue',
        },
      },
    };
    const web3Config = config.web3 as Web3Config;
    const contractService = new ContractService(database, web3Config);

    // Basic auth
    contractService['_createProvider']();

    expect(Web3.providers.WebsocketProvider).toHaveBeenCalledWith(
      web3Config.host,
      {
        headers: {
          authorization: `${web3Config.authorization.type} ${Buffer.from(
            web3Config.authorization.value as string
          ).toString('base64')}`,
        },
        ...wsConfig,
      }
    );

    // Bearer auth
    web3Config.authorization.type = 'Bearer';

    contractService['_createProvider']();

    expect(Web3.providers.WebsocketProvider).toHaveBeenCalledWith(
      web3Config.host,
      {
        headers: {
          authorization: `${web3Config.authorization.type} ${web3Config.authorization.value}`,
        },
        ...wsConfig,
      }
    );

    // Invalid auth type
    web3Config.authorization.type = 'Invalid type';

    expect(contractService['_createProvider'].bind(contractService)).toThrow(
      InvalidAuthTypeError
    );
  });
});

describe('ContractService._initContracts', () => {
  it('should init contracts for all collections in the database', () => {
    const database = {
      collection0: {
        contractAddress: '0',
        tokens: {},
      },
      collection1: {
        contractAddress: '1',
        tokens: {},
      },
      collection2: {
        contractAddress: '2',
        tokens: {},
      },
    };
    const web3Config = config.web3 as Web3Config;

    const contractService = new ContractService(database, web3Config);

    contractService['_initContracts']();

    const contracts = contractService['_contracts'];

    expect(Object.keys(contracts)).toHaveLength(3);
    expect(contracts.collection0).toEqual({
      contractAddress: database.collection0.contractAddress,
    });
    expect(contracts.collection1).toEqual({
      contractAddress: database.collection1.contractAddress,
    });
    expect(contracts.collection2).toEqual({
      contractAddress: database.collection2.contractAddress,
    });
  });
  it('should only init contracts, where the collection has a contractAddress field', () => {
    const database = {
      collection0: {
        contractAddress: '0',
        tokens: {},
      },
      collection1: {
        tokens: {},
      },
      collection2: {
        contractAddress: '2',
        tokens: {},
      },
    };
    const web3Config = config.web3 as Web3Config;

    const contractService = new ContractService(database, web3Config);

    contractService['_initContracts']();

    const contracts = contractService['_contracts'];

    expect(Object.keys(contracts)).toHaveLength(2);
    expect(contracts.collection0).toEqual({
      contractAddress: database.collection0.contractAddress,
    });
    expect(contracts.collection2).toEqual({
      contractAddress: database.collection2.contractAddress,
    });
  });
});

describe('ContractService.getTotalSupply', () => {
  it('should return Infinity, if there is no contractAddress for collection', async () => {
    const database = {
      collection: {
        tokens: {},
      },
    };
    const web3Config = config.web3 as Web3Config;

    const contractService = new ContractService(database, web3Config);

    await expect(contractService.getTotalSupply('collection')).resolves.toEqual(
      Infinity
    );
  });
  it('should return the totalSupply, and save it to the map on the class instance', async () => {
    const database = {
      collection: {
        contractAddress: '1',
        tokens: {},
      },
    };
    const web3Config = config.web3 as Web3Config;

    const mockTotalSupply = 10;
    const mockGetTotalSupplyResponse = jest
      .fn()
      .mockReturnValueOnce(mockTotalSupply);

    const contractService = new ContractService(database, web3Config);

    contractService['_getTotalSupplyResponse'] = mockGetTotalSupplyResponse;

    await expect(contractService.getTotalSupply('collection')).resolves.toEqual(
      mockTotalSupply
    );
    expect(mockGetTotalSupplyResponse).toHaveBeenCalledTimes(1);
    expect(contractService.totalSupplyMap['collection']).toEqual(
      mockTotalSupply
    );
    expect(
      typeof contractService['_totalSupplyLastQueriedMap']['collection']
    ).toEqual('number');
  });
  it('should only query total supply again, if the configuredx TTL value is exceeded', async () => {
    const database = {
      collection: {
        contractAddress: '1',
        tokens: {},
      },
    };
    const config: ApiConfig = {
      web3: {
        host: 'testWeb3Host',
        authorization: {
          type: 'Basic',
          value: 'authValue',
        },
        totalSupplyCacheTTlSeconds: 1,
      },
    };
    const web3Config = config.web3 as Web3Config;

    const mockTotalSupply = 10;
    const mockTotalSupply2 = 11;
    const mockGetTotalSupplyResponse = jest
      .fn()
      .mockReturnValueOnce(mockTotalSupply)
      .mockReturnValueOnce(mockTotalSupply2);

    const contractService = new ContractService(database, web3Config);

    contractService['_getTotalSupplyResponse'] = mockGetTotalSupplyResponse;

    await expect(contractService.getTotalSupply('collection')).resolves.toEqual(
      mockTotalSupply
    );
    expect(mockGetTotalSupplyResponse).toHaveBeenCalledTimes(1);
    expect(contractService.totalSupplyMap['collection']).toEqual(
      mockTotalSupply
    );
    expect(
      typeof contractService['_totalSupplyLastQueriedMap']['collection']
    ).toEqual('number');

    // getting again, now the value is returned from the local map, and not queried again
    // from the blockchain
    await contractService.getTotalSupply('collection');

    expect(mockGetTotalSupplyResponse).toHaveBeenCalledTimes(1);

    // now, total supply is queried again after TTL seconds has passed
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await expect(contractService.getTotalSupply('collection')).resolves.toEqual(
      mockTotalSupply2
    );

    expect(mockGetTotalSupplyResponse).toHaveBeenCalledTimes(2);

    expect(contractService.totalSupplyMap['collection']).toEqual(
      mockTotalSupply2
    );
  });
  it('should fail to get totalSupply on first try, then reconnect and succeed the second time', async () => {
    const database = {
      collection: {
        contractAddress: '1',
        tokens: {},
      },
    };
    const web3Config = config.web3 as Web3Config;

    const mockTotalSupply = 10;
    const mockGetTotalSupplyResponse = jest
      .fn()
      .mockRejectedValueOnce(null)
      .mockResolvedValueOnce(mockTotalSupply);

    const mockResetConnection = jest.fn();

    const contractService = new ContractService(database, web3Config);

    contractService['_getTotalSupplyResponse'] = mockGetTotalSupplyResponse;

    contractService.resetConnection = mockResetConnection;

    await expect(contractService.getTotalSupply('collection')).resolves.toEqual(
      mockTotalSupply
    );

    expect(mockGetTotalSupplyResponse).toHaveBeenCalledTimes(2);
    expect(mockResetConnection).toHaveBeenCalledTimes(1);
  });
  it('should throw error if a totalSupply value is returned that cannot be parsed as a number', async () => {
    const database = {
      collection: {
        contractAddress: '1',
        tokens: {},
      },
    };
    const web3Config = config.web3 as Web3Config;

    const mockGetTotalSupplyResponse = jest
      .fn()
      .mockReturnValueOnce('non-number-string');

    const contractService = new ContractService(database, web3Config);

    contractService['_getTotalSupplyResponse'] = mockGetTotalSupplyResponse;

    await expect(() =>
      contractService.getTotalSupply('collection')
    ).rejects.toThrow(InvalidTotalSupplyResponse);
  });
});
