/** Reads the token from `Authorization: MediaBrowser …, Token="…"` or the ApiKey parameter. */
export function tokenOf(request: Request): string | null {
  const header = request.headers.get('Authorization') ?? '';
  const fromHeader = /Token="([^"]*)"/.exec(header)?.[1];
  if (fromHeader) return fromHeader;
  const params = new URL(request.url).searchParams;
  return params.get('ApiKey') ?? params.get('api_key');
}
