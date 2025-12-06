/* src/app/api/smartroads-proxy/route.ts */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const parseTokenInput = (raw?: string): { token: string; isFullUrl: boolean } | null => {
  if (!raw) return null;
  let value = raw.trim();

  // Strip surrounding quotes the shell/env might add.
  value = value.replace(/^['"](.+)['"]$/u, '$1');

  // Full URL case: use as-is to avoid any re-encoding
  if (value.startsWith('http')) {
    return { token: value, isFullUrl: true };
  }

  // Support tokens pasted as "token=XYZ"
  value = value.replace(/^token=/i, '');

  return { token: value, isFullUrl: false };
};

const maskToken = (token: string) => {
  if (!token) return '';
  const clean = token.replace(/['"]/g, '');
  if (clean.length <= 8) return `${clean}****`;
  return `${clean.slice(0, 4)}***${clean.slice(-4)}`;
};

export async function GET(request: Request) {
  try {
    // Allow a full URL env to bypass any token parsing entirely.
    const fullUrlEnv = process.env.SMARTROADS_ROADCLOSURES_URL;
    const parsed = fullUrlEnv
      ? { token: fullUrlEnv.trim().replace(/^['"](.+)['"]$/u, '$1'), isFullUrl: true }
      : parseTokenInput(process.env.SMARTROADS_ROADCLOSURES_TOKEN);
    if (!parsed) {
      return NextResponse.json({ message: 'SmartRoads API token/URL is not configured.' }, { status: 500 });
    }

    const baseUrl = 'https://data.511-atis-ttrip-prod.iteriscloud.com/smarterRoads/other/vDOTRoadClosures/current/RoadClosures_current.json';
    const buildUrl = (useDecodedToken: boolean) => {
      if (parsed.isFullUrl) return parsed.token;
      const token = useDecodedToken ? decodeURIComponent(parsed.token) : parsed.token;
      return `${baseUrl}?token=${token}`;
    };

    const tryFetch = async (useDecodedToken: boolean) => {
      const url = buildUrl(useDecodedToken);
      const masked = maskToken(parsed.token);
      console.log('Fetching URL:', url.replace(parsed.token, masked), `(token length: ${parsed.token.length})`);
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'curl/8.6.0',
          'Accept-Encoding': 'identity'
        },
        redirect: 'follow',
        cache: 'no-store',
      });
      return { res, url };
    };

    // First attempt with the raw token; if 403/400, retry once with decoded token
    let attempt = await tryFetch(false);
    if (!attempt.res.ok && !parsed.isFullUrl && /%[0-9a-fA-F]{2}/.test(parsed.token)) {
      console.warn(`First attempt failed (${attempt.res.status}); retrying with decoded token form.`);
      attempt = await tryFetch(true);
    }

    console.log('Response status:', attempt.res.status);

    if (!attempt.res.ok) {
      const errorText = await attempt.res.text();
      console.error('Error:', errorText);
      return NextResponse.json(
        { 
          message: `API error: ${attempt.res.statusText}`, 
          details: errorText.substring(0, 200),
          debug: { tokenPreview: maskToken(parsed.token) }
        },
        { status: attempt.res.status }
      );
    }

    const jsonData = await attempt.res.json();

    return NextResponse.json(jsonData, { status: 200 });

  } catch (error) {
    console.error('Proxy Error:', error);
    return NextResponse.json(
      { message: 'Error fetching data' },
      { status: 500 }
    );
  }
}
