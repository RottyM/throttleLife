/* src/app/api/smartroads-incident-proxy/route.ts - REPLICATING WORKING STRUCTURE */

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
    const fullUrlEnv = process.env.SMARTROADS_INCIDENT_URL;
    const parsed = fullUrlEnv
      ? { token: fullUrlEnv.trim().replace(/^['"](.+)['"]$/u, '$1'), isFullUrl: true }
      : parseTokenInput(process.env.SMARTROADS_INCIDENT_TOKEN);
    if (!parsed) {
      return NextResponse.json({ message: 'SmartRoads Incident API token/URL is not configured.' }, { status: 500 });
    }

    const baseUrl = 'https://data.511-atis-ttrip-prod.iteriscloud.com/smarterRoads/incidentFiltered/incidentFilteredTMDD/current/incidentFiltered_tmdd.xml';
    const buildUrl = (useDecodedToken: boolean) => {
      if (parsed.isFullUrl) return parsed.token;
      const token = useDecodedToken ? decodeURIComponent(parsed.token) : parsed.token;
      return `${baseUrl}?token=${token}`;
    };

    const tryFetch = async (useDecodedToken: boolean) => {
      const url = buildUrl(useDecodedToken);
      console.log('Fetching live incident XML data from SmartRoads API...');
      const masked = maskToken(parsed.token);
      console.log('Using URL:', url.replace(parsed.token, masked), `(token length: ${parsed.token.length})`);
      const res = await fetch(url, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'curl/8.6.0',
          'Accept': 'application/xml',
          'Accept-Encoding': 'identity'
        },
        cache: 'no-store',
      });
      return { res, url };
    };

    let attempt = await tryFetch(false);
    if (!attempt.res.ok && !parsed.isFullUrl && /%[0-9a-fA-F]{2}/.test(parsed.token)) {
      console.warn(`First attempt failed (${attempt.res.status}); retrying with decoded token form.`);
      attempt = await tryFetch(true);
    }

    if (!attempt.res.ok) {
      const errorText = await attempt.res.text().catch(() => attempt.res.statusText);
      console.error('External API Response Status:', attempt.res.status, errorText);
      return NextResponse.json(
        { 
          message: `External API error: ${attempt.res.statusText}`, 
          details: (errorText || '').substring(0, 200),
          debug: { tokenPreview: maskToken(parsed.token) }
        },
        { status: attempt.res.status }
      );
    }

    const xmlData = await attempt.res.text();

    // Return the raw XML string with the correct Content-Type header
    return new NextResponse(xmlData, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
      },
    });

  } catch (error) {
    console.error('SmartRoads Incident Proxy Error:', error);
    return NextResponse.json(
      { message: 'Error fetching data from SmartRoads Incident API via proxy.' },
      { status: 500 }
    );
  }
}
