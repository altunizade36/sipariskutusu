import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const DEFAULT_APP_REDIRECT_URI = 'sipariskutusu://instagram-auth';
const DEFAULT_WEB_FALLBACK_URI = 'http://localhost:8082/instagram-auth';

function htmlEscape(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function decodeStateReturnTo(rawState: string | null) {
  if (!rawState) return '';

  try {
    const normalized = rawState.replaceAll('-', '+').replaceAll('_', '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const state = JSON.parse(atob(padded));
    return typeof state?.returnTo === 'string' ? state.returnTo : '';
  } catch {
    return '';
  }
}

function appendAuthParams(target: string, source: URL) {
  const targetUrl = new URL(target);
  for (const key of ['code', 'state', 'error', 'error_reason', 'error_description']) {
    const value = source.searchParams.get(key);
    if (value) targetUrl.searchParams.set(key, value);
  }
  return targetUrl.toString();
}

serve((req: Request) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed.', { status: 405 });
  }

  const requestUrl = new URL(req.url);
  const stateReturnTo = decodeStateReturnTo(requestUrl.searchParams.get('state'));
  const appRedirect =
    stateReturnTo || Deno.env.get('META_APP_DEEP_LINK_REDIRECT') || DEFAULT_APP_REDIRECT_URI;
  const webFallback =
    Deno.env.get('META_APP_WEB_FALLBACK_REDIRECT') || DEFAULT_WEB_FALLBACK_URI;

  const appTarget = appendAuthParams(appRedirect, requestUrl);
  const webTarget = appendAuthParams(webFallback, requestUrl);
  const safeAppTarget = htmlEscape(appTarget);
  const safeWebTarget = htmlEscape(webTarget);
  const appTargetJson = JSON.stringify(appTarget);

  const html = `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Sipari&#351;kutusu</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f8fafc;
        color: #0f172a;
      }
      main {
        width: min(92vw, 420px);
        text-align: center;
      }
      h1 {
        margin: 0 0 12px;
        font-size: 24px;
      }
      p {
        margin: 0 0 20px;
        color: #475569;
        line-height: 1.5;
      }
      a {
        display: inline-flex;
        width: 100%;
        min-height: 48px;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        background: #0a66ff;
        color: #fff;
        font-weight: 700;
        padding: 0 18px;
        text-decoration: none;
        box-sizing: border-box;
      }
      a.secondary {
        margin-top: 10px;
        background: #e2e8f0;
        color: #0f172a;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Instagram ba&#287;lant&#305;s&#305; tamamlan&#305;yor</h1>
      <p>Uygulamaya d&#246;nmeye &#231;al&#305;&#351;&#305;yoruz. Otomatik a&#231;&#305;lmazsa a&#351;a&#287;&#305;daki butona dokun.</p>
      <a id="open-app" href="${safeAppTarget}">Sipari&#351;kutusu'na d&#246;n</a>
      <a class="secondary" href="${safeWebTarget}">Web test ekran&#305;nda devam et</a>
    </main>
    <script>
      const target = ${appTargetJson};
      const openApp = () => {
        window.location.href = target;
      };
      document.getElementById('open-app')?.addEventListener('click', openApp);
      setTimeout(openApp, 250);
      setTimeout(openApp, 1200);
    </script>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
});
