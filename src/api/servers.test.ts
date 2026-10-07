import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { DEMO_SERVER } from '@/mocks/fixtures';
import { server as mockServer } from '@/mocks/node';
import { checkServerAddress } from './servers';

const ADDRESS = 'http://jellyfin.test:8096';

describe('checkServerAddress', () => {
  it('accepts a supported Jellyfin server', async () => {
    const result = await checkServerAddress(ADDRESS);
    expect(result).toEqual({
      ok: true,
      server: {
        id: DEMO_SERVER.Id,
        name: DEMO_SERVER.ServerName,
        url: ADDRESS,
        version: DEMO_SERVER.Version,
      },
    });
  });

  it('rejects servers older than 10.10', async () => {
    mockServer.use(
      http.get('*/System/Info/Public', () =>
        HttpResponse.json({ ...DEMO_SERVER, Version: '10.9.11' }),
      ),
    );
    expect(await checkServerAddress(ADDRESS)).toEqual({
      ok: false,
      reason: 'unsupportedVersion',
      version: '10.9.11',
    });
  });

  it('accepts the new 12.x version scheme', async () => {
    mockServer.use(
      http.get('*/System/Info/Public', () =>
        HttpResponse.json({ ...DEMO_SERVER, Version: '12.0.1' }),
      ),
    );
    expect(await checkServerAddress(ADDRESS)).toMatchObject({ ok: true });
  });

  it('recognizes other software answering on the address', async () => {
    mockServer.use(
      http.get('*/System/Info/Public', () =>
        HttpResponse.json({ ...DEMO_SERVER, ProductName: 'Something else' }),
      ),
    );
    expect(await checkServerAddress(ADDRESS)).toEqual({ ok: false, reason: 'notJellyfin' });
  });

  it('reports unreachable servers', async () => {
    mockServer.use(http.get('*/System/Info/Public', () => HttpResponse.error()));
    expect(await checkServerAddress(ADDRESS)).toEqual({ ok: false, reason: 'unreachable' });
  });

  it('reports servers that still need the setup wizard', async () => {
    mockServer.use(
      http.get('*/System/Info/Public', () =>
        HttpResponse.json({ ...DEMO_SERVER, StartupWizardCompleted: false }),
      ),
    );
    expect(await checkServerAddress(ADDRESS)).toEqual({ ok: false, reason: 'setupIncomplete' });
  });

  it('rejects empty input without a request', async () => {
    expect(await checkServerAddress('   ')).toEqual({ ok: false, reason: 'invalidAddress' });
  });
});
