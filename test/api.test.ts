import {
  createWithEthers,
  createWithoutEthers,
  ensureCollectionExists,
  ensureDeploymentNetwork,
  ensureTokenExists,
  isCollectionRevealed,
  isTokenReserved,
} from '../src/api/api';
import { TokenDatabase } from '../src/types/TokenDatabase';
import { HttpError } from '../src/errors';
import express from 'express';
import ContractService from '../src/ContractService';
import { mocked } from 'ts-jest';

afterEach(() => jest.clearAllMocks());

const database: TokenDatabase = {
  collection: {
    contract: {
      deployments: {
        lol: {
          address: 'dadsdas',
        },
        lel: {
          address: 'adasdjsadsajd',
        },
      },
    },
    reservedTokens: [1, 2],
    revealTime: new Date(0).getTime(),
    tokens: {
      0: {
        name: 'name0',
      },
      2: {
        name: 'name2',
      },
      placeholder: {
        name: 'placeholder',
      },
    },
  },
  collectionReservedNoPlaceholder: {
    contract: {
      deployments: {
        lol: {
          address: 'dadsdas',
        },
      },
    },
    reservedTokens: [1, 2],
    revealTime: new Date(0).getTime(),
    tokens: {
      0: {
        name: 'name0',
      },
      2: {
        name: 'name1',
      },
    },
  },
  collectionNoReserved: {
    contract: {
      deployments: {
        lol: {
          address: 'dadsdas',
        },
      },
    },
    tokens: {
      0: {
        name: 'name0',
      },
    },
  },
  collectionFutureReveal: {
    contract: {
      deployments: {
        lol: {
          address: 'dadsdas',
        },
      },
    },
    revealTime: new Date(3000, 1, 1).getTime(),
    tokens: {
      0: {
        name: 'name0',
      },
    },
  },
};

describe('ensureTokenExists', () => {
  it('should do nothing if token exists in the collection', () => {
    expect(() => ensureTokenExists(database, 'collection', 0)).not.toThrow();
  });
  it('should throw if no tokens property is found on collection', () => {
    expect(() =>
      ensureTokenExists(
        { collection: {} } as unknown as TokenDatabase,
        'collection',
        0
      )
    ).toThrow(HttpError);
  });
  it('should throw if token is not found', () => {
    expect(() => ensureTokenExists(database, 'collection', 1)).toThrow(
      HttpError
    );
  });
});

describe('ensureCollectionExists', () => {
  it('should not throw if collection exists', () => {
    expect(() => ensureCollectionExists(database, 'collection')).not.toThrow();
  });
  it('should throw is collection doesnt exist', () => {
    expect(() => ensureCollectionExists(database, 'collection0')).toThrow(
      HttpError
    );
  });
});

describe('isTokenReserved', () => {
  it('should return true if tokenId is contained in the reservedTokens array of the collection', () => {
    expect(isTokenReserved(database, 'collection', 1)).toEqual(true);
  });
  it('should return false if tokenId is not contained in the reservedTokens array of the collection', () => {
    expect(isTokenReserved(database, 'collection', 0)).toEqual(false);
  });
  it('should return false if there is no reservedTokens array on the collection', () => {
    expect(isTokenReserved(database, 'collectionNoReserved', 0)).toEqual(false);
  });
});

describe('isCollectionRevealed', () => {
  it('should return true if current time is greater then the revealTime of the collection', () => {
    expect(isCollectionRevealed(database, 'collection')).toEqual(true);
  });
  it('should return true if there is no revealTime property on the collection', () => {
    expect(isCollectionRevealed(database, 'collectionNoReserved')).toEqual(
      true
    );
  });
  it('should return false if the revealTime value of the collection is greater then the current time', () => {
    expect(isCollectionRevealed(database, 'collectionFutureReveal')).toEqual(
      false
    );
  });
});

describe('ensureDeploymentNetwork', () => {
  it('should not throw if deployment network exists for the collection', () => {
    expect(() =>
      ensureDeploymentNetwork(database, 'collection', 'lol')
    ).not.toThrow();
  });
  it('should throw if deployment network does not exist', () => {
    expect(() =>
      ensureDeploymentNetwork(database, 'collection', 'lal')
    ).toThrow(HttpError);
  });
});

const res = {
  json: jest.fn(),
  status: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
} as unknown as express.Response;

describe('api handler without ethers', () => {
  afterEach(() => jest.clearAllMocks());

  it('should return the token if it exists', async () => {
    const req = {
      params: {
        collectionName: 'collection',
        tokenId: 0,
      },
    } as unknown as express.Request;
    const handler = createWithoutEthers(database);

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(database.collection.tokens[0]);
  });

  it('it should return placeholder if token is reserved', async () => {
    const req = {
      params: {
        collectionName: 'collection',
        tokenId: 2,
      },
    } as unknown as express.Request;
    const handler = createWithoutEthers(database);

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(
      database.collection.tokens.placeholder
    );
  });

  it('it should throw is collection does not exist', async () => {
    const req = {
      params: {
        collectionName: 'collectionLol',
        tokenId: 0,
      },
    } as unknown as express.Request;
    const handler = createWithoutEthers(database);

    await handler(req, res);

    expect(res.status).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('it should throw is token does not exist', async () => {
    const req = {
      params: {
        collectionName: 'collection',
        tokenId: 5,
      },
    } as unknown as express.Request;
    const handler = createWithoutEthers(database);

    await handler(req, res);

    expect(res.status).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('it should throw if querying reserved token and there is no placeholder', async () => {
    const req = {
      params: {
        collectionName: 'collectionReservedNoPlaceholder',
        tokenId: 2,
      },
    } as unknown as express.Request;
    const handler = createWithoutEthers(database);

    await handler(req, res);

    expect(res.status).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('api handler with ethers', () => {
  afterEach(() => jest.clearAllMocks());

  it('should throw if collection does not exist', async () => {
    const req = {
      params: {
        collectionName: 'kfddksdakds',
        tokenId: 2,
        networkName: 'lol',
      },
    } as unknown as express.Request;
    const contractService = {} as unknown as ContractService;

    const handler = createWithEthers(database, contractService);

    await handler(req, res);

    expect(res.status).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should throw if contract is not deployed to the network', async () => {
    const req = {
      params: {
        collectionName: 'collection',
        tokenId: 2,
        networkName: 'lal',
      },
    } as unknown as express.Request;
    const contractService = {} as unknown as ContractService;

    const handler = createWithEthers(database, contractService);

    await handler(req, res);

    expect(res.status).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  const contractService = {
    exists: jest.fn(),
  } as unknown as ContractService;

  it('should return the placeholder token, if tokenId doesnt exist', async () => {
    const req = {
      params: {
        collectionName: 'collection',
        tokenId: 2,
        networkName: 'lol',
      },
    } as unknown as express.Request;

    mocked(contractService.exists).mockResolvedValueOnce(false);

    const handler = createWithEthers(database, contractService);

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(
      database.collection.tokens.placeholder
    );
  });

  it('should return the placeholder token, if tokenId is reserved', async () => {
    const req = {
      params: {
        collectionName: 'collection',
        tokenId: 1,
        networkName: 'lol',
      },
    } as unknown as express.Request;

    mocked(contractService.exists).mockResolvedValueOnce(true);

    const handler = createWithEthers(database, contractService);

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(
      database.collection.tokens.placeholder
    );
  });

  it('should return the token, if tokenId exists', async () => {
    const req = {
      params: {
        collectionName: 'collection',
        tokenId: 0,
        networkName: 'lol',
      },
    } as unknown as express.Request;

    mocked(contractService.exists).mockResolvedValueOnce(true);

    const handler = createWithEthers(database, contractService);

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(database.collection.tokens[0]);
  });

  it('should throw if tokenId is not found', async () => {
    const req = {
      params: {
        collectionName: 'collection',
        tokenId: 4,
        networkName: 'lol',
      },
    } as unknown as express.Request;

    mocked(contractService.exists).mockResolvedValueOnce(true);

    const handler = createWithEthers(database, contractService);

    await handler(req, res);

    expect(res.status).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should throw if placeholder is not found', async () => {
    const req = {
      params: {
        collectionName: 'collectionReservedNoPlaceholder',
        tokenId: 1,
        networkName: 'lol',
      },
    } as unknown as express.Request;

    mocked(contractService.exists).mockResolvedValueOnce(true);

    const handler = createWithEthers(database, contractService);

    await handler(req, res);

    expect(res.status).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
