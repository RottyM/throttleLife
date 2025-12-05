/* src/app/api/smartroads-proxy/route.ts */
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const token = process.env.SMARTROADS_ROADCLOSURES_TOKEN;
    if (!token) {
      return NextResponse.json({ message: 'SmartRoads API token is not configured.' }, { status: 500 });
    }
    const externalApiUrl = `https://data.511-atis-ttrip-prod.iteriscloud.com/smarterRoads/other/vDOTRoadClosures/current/RoadClosures_current.json?token=${token}`;

    console.log('Fetching URL:', externalApiUrl);

    const externalResponse = await fetch(externalApiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    console.log('Response status:', externalResponse.status);

    if (!externalResponse.ok) {
      const errorText = await externalResponse.text();
      console.error('Error:', errorText);
      return NextResponse.json(
        { message: `API error: ${externalResponse.statusText}` },
        { status: externalResponse.status }
      );
    }

    const jsonData = await externalResponse.json();

    return NextResponse.json(jsonData, { status: 200 });

  } catch (error) {
    console.error('Proxy Error:', error);
    return NextResponse.json(
      { message: 'Error fetching data' },
      { status: 500 }
    );
  }
}