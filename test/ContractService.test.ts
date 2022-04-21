import { ethers } from 'ethers';
import { mocked } from 'ts-jest/utils';
import { ApiKeys } from '../src/types/ApiKeys';
import { Network } from '../src/types/_';
import { ApiConfig } from '../src/types/ApiConfig';
import ContractService, { abi } from '../src/ContractService';
import { TokenDatabase } from '../src/types/TokenDatabase';

jest.mock('ethers');

const database = {
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
} as unknown as TokenDatabase;

class MockContract {
  public state = jest.fn();

  constructor(public address: string, public abi: ethers.ContractInterface, public provider: any) {
    this.state = jest.fn();
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

      // check contracts
      expect(Object.keys(instance['_contracts'])).toHaveLength(2);
      expect(Object.keys(instance['_contracts']).includes('network0')).toBeTruthy();
      expect(Object.keys(instance['_contracts']).includes('network1')).toBeTruthy();

      expect(instance['_contracts']['network0']).toBeInstanceOf(MockContract);
      expect(instance['_contracts']['network0'].abi).toEqual(abi);
      expect(instance['_contracts']['network0'].address).toEqual(0);
      expect(instance['_contracts']['network0'].provider).toBeInstanceOf(MockProvider);
      expect((instance['_contracts']['network0'].provider as MockProvider).network).toEqual('network0');
      expect(instance['_contracts']['network1']).toBeInstanceOf(MockContract);
      expect(instance['_contracts']['network1'].abi).toEqual(abi);
      expect(instance['_contracts']['network1'].address).toEqual(1);
      expect(instance['_contracts']['network1'].provider).toBeInstanceOf(MockProvider);
      expect((instance['_contracts']['network1'].provider as MockProvider).network).toEqual('network1');
    });
  });

  describe('state', () => {
    it('should get the state from the contract', async () => {
      const instance = new ContractService(database, config);

      (instance['_contracts']['network0'] as unknown as MockContract)
        .state
        .mockResolvedValueOnce(jest.requireActual('ethers').ethers.BigNumber.from(3))

      await expect(instance.state('network0', 0, 1)).resolves.toEqual(3);
      expect(instance['_stateMap']['network0'][1].value).toEqual(3);
    });

    it('should use the cached value, if cache did not yet expire', async () => {
      const configWithCache = {...config, stateCacheTTLSeconds: 10}

      const instance = new ContractService(database, configWithCache);

      (instance['_contracts']['network0'] as unknown as MockContract)
        .state
        .mockResolvedValueOnce(jest.requireActual('ethers').ethers.BigNumber.from(3))

      // from contract
      await expect(instance.state('network0', 1, 1)).resolves.toEqual(3);

      // from cache
      await expect(instance.state('network0', 1, 1)).resolves.toEqual(3);

      expect(instance['_contracts']['network0'].state).toHaveBeenCalledTimes(1);
    });

    it('should query the value from the contract again, after the cache expired', async () => {
      const configWithCache = {...config, stateCacheTTLSeconds: 1}

      const instance = new ContractService(database, configWithCache);

      (instance['_contracts']['network0'] as unknown as MockContract)
        .state
        .mockResolvedValueOnce(jest.requireActual('ethers').ethers.BigNumber.from(3))
        .mockResolvedValueOnce(jest.requireActual('ethers').ethers.BigNumber.from(4))

      // from contract
      await expect(instance.state('network0', 1, 1)).resolves.toEqual(3);

      // from cache
      await expect(instance.state('network0', 1, 1)).resolves.toEqual(3);

      // from contract again
      const state = await new Promise(resolve => setTimeout(() =>
        instance.state('network0', 1, 1).then(resolve), 1000))

      expect(state).toEqual(4);

      expect(instance['_contracts']['network0'].state).toHaveBeenCalledTimes(2);
    });

    it('should return last saved value, if state contract call fails', async () => {
      const instance = new ContractService(database, config);

      (instance['_contracts']['network0'] as unknown as MockContract)
        .state
        .mockResolvedValueOnce(jest.requireActual('ethers').ethers.BigNumber.from(3))
        .mockRejectedValueOnce(jest.requireActual('ethers').ethers.BigNumber.from(4))

      // from contract
      await expect(instance.state( 'network0', 1, 1)).resolves.toEqual(3);

      const timestamp = instance['_stateMap']['network0'][1].timestamp;

      // from cache
      await expect(instance.state( 'network0', 1, 1)).resolves.toEqual(3);

      expect(instance['_contracts']['network0'].state).toHaveBeenCalledTimes(2);
      expect(instance['_stateMap']['network0'][1].timestamp).toEqual(timestamp);
    });

    it('should return 0, if state contract call fails and there is no saved value', async () => {
      const instance = new ContractService(database, config);

      (instance['_contracts']['network0'] as unknown as MockContract)
        .state
        .mockRejectedValueOnce(jest.requireActual('ethers').ethers.BigNumber.from(4))

      await expect(instance.state( 'network0', 1, 1)).resolves.toEqual(0);
    });


    it('should throw intentional errors but swallow unintentional ones', async () => {
      const instance = new ContractService(database, config);

      const intentionalError = new Error('PixelBlossom: valami');
      const unintentionalError = new Error('Error Error Error');

      (instance['_contracts']['network0'] as unknown as MockContract)
        .state
        .mockRejectedValueOnce(intentionalError)
        .mockRejectedValueOnce(unintentionalError);

      await expect(instance.state( 'network0', 1, 1)).rejects.toEqual(intentionalError);
      await expect(instance.state( 'network0', 1, 1)).resolves.toEqual(0);
    });
  });
});
