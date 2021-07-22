import { ethers } from 'ethers';
import { mocked } from 'ts-jest';
import { ApiKeys } from '../src/types/ApiKeys';
import { Network } from '../src/types/_';
import { ApiConfig } from '../src/types/ApiConfig';
import ContractService, { abi } from '../src/ContractService';
import { TokenDatabase } from '../src/types/TokenDatabase';

jest.mock('ethers');

const database = {
  collection0: {
    contract: {
      deployments: {
        network0: {
          address: 0
        },
        network1: {
          address: 1
        }
      }
    }
  },
  collection1: {
    contract: {
      deployments: {}
    }
  },
  collection2: {
    contract: {
      deployments: {
        network0: {
          address: 0
        },
        network2: {
          address: 2
        }
      }
    }
  }
} as unknown as TokenDatabase;

class MockContract {
  public totalSupply = jest.fn();

  constructor(public address: string, public abi: ethers.ContractInterface, public provider: any) {
    this.totalSupply = jest.fn();
  }
}

class MockProvider {
  constructor(public network?: Network | ethers.providers.Network, public apiKeys?: ApiKeys) {}
}

mocked(ethers.Contract)
  .mockImplementation((address, abi, provider) =>
    new MockContract(address, abi, provider) as unknown as ethers.Contract);

mocked(ethers.getDefaultProvider)
  .mockImplementation((network?: Network | ethers.providers.Network, apiKeys?: ApiKeys) =>
    new MockProvider(network, apiKeys) as unknown as ethers.providers.BaseProvider)

const config = {
  ethers: {
    apiKeys: {
      etherscan: '325435435',
      pocket: '54354354',
      alchemy: '543254',
      infura: '434543454'
    }
  }
} as unknown as ApiConfig;

describe('ContractService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('constructor', () => {
    it('should construct instance, and init contracts map correctly', () => {
      const instance = new ContractService(database, config);

      // check providers
      expect(Object.keys(instance['_providers'])).toHaveLength(3);

      const providerNetworks: Network[] = [];
      Object.values(instance['_providers']).forEach(provider => {
        expect(provider).toBeInstanceOf(MockProvider);
        expect((provider as MockProvider).apiKeys).toStrictEqual(config.ethers?.apiKeys);
        providerNetworks.push((provider as MockProvider).network as Network);
      })

      expect(providerNetworks).toHaveLength(3);
      expect(providerNetworks.includes('network0')).toBeTruthy();
      expect(providerNetworks.includes('network1')).toBeTruthy();
      expect(providerNetworks.includes('network2')).toBeTruthy();

      // check contracts
      expect(Object.keys(instance['_contracts'])).toHaveLength(2);
      expect(Object.keys(instance['_contracts']).includes('collection0')).toBeTruthy();
      expect(Object.keys(instance['_contracts']).includes('collection2')).toBeTruthy();

      expect(Object.keys(instance['_contracts']['collection0'])).toHaveLength(2);
      expect(Object.keys(instance['_contracts']['collection2'])).toHaveLength(2);

      expect(instance['_contracts']['collection0']['network0']).toBeInstanceOf(MockContract);
      expect(instance['_contracts']['collection0']['network0'].abi).toEqual(abi);
      expect(instance['_contracts']['collection0']['network0'].address).toEqual(0);
      expect(instance['_contracts']['collection0']['network0'].provider).toBeInstanceOf(MockProvider);
      expect((instance['_contracts']['collection0']['network0'].provider as MockProvider).network).toEqual('network0');
      expect(instance['_contracts']['collection0']['network1']).toBeInstanceOf(MockContract);
      expect(instance['_contracts']['collection0']['network1'].abi).toEqual(abi);
      expect(instance['_contracts']['collection0']['network1'].address).toEqual(1);
      expect(instance['_contracts']['collection0']['network1'].provider).toBeInstanceOf(MockProvider);
      expect((instance['_contracts']['collection0']['network1'].provider as MockProvider).network).toEqual('network1');

      expect(instance['_contracts']['collection2']['network0']).toBeInstanceOf(MockContract);
      expect(instance['_contracts']['collection2']['network0'].abi).toEqual(abi);
      expect(instance['_contracts']['collection2']['network0'].address).toEqual(0);
      expect(instance['_contracts']['collection2']['network0'].provider).toBeInstanceOf(MockProvider);
      expect((instance['_contracts']['collection2']['network0'].provider as MockProvider).network).toEqual('network0');
      expect(instance['_contracts']['collection2']['network2']).toBeInstanceOf(MockContract);
      expect(instance['_contracts']['collection2']['network2'].abi).toEqual(abi);
      expect(instance['_contracts']['collection2']['network2'].address).toEqual(2);
      expect(instance['_contracts']['collection2']['network2'].provider).toBeInstanceOf(MockProvider);
      expect((instance['_contracts']['collection2']['network2'].provider as MockProvider).network).toEqual('network2');
    });
  });

  describe('getTotalSupply', () => {
    it('should get the total supply from the contract', async () => {
      const instance = new ContractService(database, config);

      (instance['_contracts']['collection0']['network0'] as unknown as MockContract)
        .totalSupply
        .mockResolvedValueOnce(jest.requireActual('ethers').ethers.BigNumber.from(3))

      await expect(instance.getTotalSupply('collection0', 'network0')).resolves.toEqual(3);
      expect(instance.totalSupplyMap['collection0']['network0']).toEqual(3);
    });

    it('should use the cached value, if cache did not yet expire', async () => {
      const configWithCache = {...config, totalSupplyCacheTTlSeconds: 10}

      const instance = new ContractService(database, configWithCache);

      (instance['_contracts']['collection0']['network0'] as unknown as MockContract)
        .totalSupply
        .mockResolvedValueOnce(jest.requireActual('ethers').ethers.BigNumber.from(3))

      // from contract
      await expect(instance.getTotalSupply('collection0', 'network0')).resolves.toEqual(3);

      // from cache
      await expect(instance.getTotalSupply('collection0', 'network0')).resolves.toEqual(3);

      expect(instance['_contracts']['collection0']['network0'].totalSupply).toHaveBeenCalledTimes(1);
    });

    it('should query the value from the contract again, after the cache expired', async () => {
      const configWithCache = {...config, totalSupplyCacheTTlSeconds: 1}

      const instance = new ContractService(database, configWithCache);

      (instance['_contracts']['collection0']['network0'] as unknown as MockContract)
        .totalSupply
        .mockResolvedValueOnce(jest.requireActual('ethers').ethers.BigNumber.from(3))
        .mockResolvedValueOnce(jest.requireActual('ethers').ethers.BigNumber.from(4))

      // from contract
      await expect(instance.getTotalSupply('collection0', 'network0')).resolves.toEqual(3);

      // from cache
      await expect(instance.getTotalSupply('collection0', 'network0')).resolves.toEqual(3);

      // from contract again
      const totalSupply = await new Promise(resolve => setTimeout(() =>
        instance.getTotalSupply('collection0', 'network0').then(resolve), 1000))

      expect(totalSupply).toEqual(4);

      expect(instance['_contracts']['collection0']['network0'].totalSupply).toHaveBeenCalledTimes(2);
    });
  });
});
