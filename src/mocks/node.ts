import { setupServer } from 'msw/node';
import { createHandlers } from './handlers';
import { MockState } from './state';

/** Base URL of the mock server in unit and integration tests. */
export const TEST_SERVER_URL = 'http://jellyfin.test';

export let mockState = new MockState();

export const server = setupServer(...createHandlers(mockState));

/** Fresh state and handlers for every test. */
export function resetMockServer(options?: ConstructorParameters<typeof MockState>[0]): MockState {
  mockState = new MockState(options);
  server.resetHandlers(...createHandlers(mockState));
  return mockState;
}
