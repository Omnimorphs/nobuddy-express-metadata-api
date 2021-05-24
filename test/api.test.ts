import {
  ensureCollectionExists,
  ensureTokenExists,
  isCollectionRevealed,
  isTokenReserved,
} from '../src/api/api';
import { TokenDatabase } from '../src/types/TokenDatabase';
import { HttpError } from '../src/errors';

afterEach(() => jest.clearAllMocks());

const database = {
  collection: {
    reservedTokens: [1, 2],
    revealTime: new Date(0).getTime(),
    tokens: {
      0: {
        name: 'name0',
      },
    },
  },
  collectionNoReserved: {
    tokens: {
      0: {
        name: 'name0',
      },
    },
  },
  collectionFutureReveal: {
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
