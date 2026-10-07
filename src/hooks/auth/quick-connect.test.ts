import { describe, expect, it, vi } from 'vitest';
import { DEMO_SERVER, DEMO_USERS } from '@/mocks/fixtures';
import { resetMockServer, TEST_SERVER_URL } from '@/mocks/node';
import { runQuickConnect } from './quick-connect';

const server = {
  id: DEMO_SERVER.Id,
  name: DEMO_SERVER.ServerName,
  url: TEST_SERVER_URL,
  version: DEMO_SERVER.Version,
};

describe('runQuickConnect', () => {
  it('signs in once another device approves the code', async () => {
    const state = resetMockServer();
    const onCode = vi.fn((request: { code: string }) => {
      state.approveQuickConnect(request.code, DEMO_USERS[1]?.id ?? '');
    });
    const onAuthorized = vi.fn();

    const outcome = await runQuickConnect(server, {
      signal: new AbortController().signal,
      onCode,
      onAuthorized,
      remembered: () => false,
      pollMs: 5,
    });

    expect(onCode).toHaveBeenCalledWith(
      expect.objectContaining({ code: expect.stringMatching(/^\d{6}$/) as unknown }),
      expect.any(Number),
    );
    expect(onAuthorized).toHaveBeenCalledOnce();
    expect(outcome).toMatchObject({
      status: 'signedIn',
      session: { userName: 'Mika', remembered: false, serverId: DEMO_SERVER.Id },
    });
  });

  it('expires when nobody approves the code in time', async () => {
    resetMockServer();
    const outcome = await runQuickConnect(server, {
      signal: new AbortController().signal,
      onCode: vi.fn(),
      onAuthorized: vi.fn(),
      remembered: () => true,
      pollMs: 5,
      timeoutMs: 20,
    });
    expect(outcome).toEqual({ status: 'expired' });
  });

  it('stops polling when aborted', async () => {
    resetMockServer();
    const controller = new AbortController();
    const run = runQuickConnect(server, {
      signal: controller.signal,
      onCode: () => {
        controller.abort();
      },
      onAuthorized: vi.fn(),
      remembered: () => true,
      pollMs: 5,
    });
    await expect(run).rejects.toMatchObject({ name: 'AbortError' });
  });
});
