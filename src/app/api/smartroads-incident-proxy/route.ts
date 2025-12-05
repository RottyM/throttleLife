/* src/app/api/smartroads-incident-proxy/route.ts - REPLICATING WORKING STRUCTURE */

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    
  try {
    const token = process.env.SMARTROADS_INCIDENT_TOKEN;
    if (!token) {
      return NextResponse.json({ message: 'SmartRoads Incident API token is not configured.' }, { status: 500 });
    }
    const externalApiUrl = `https://data.511-atis-ttrip-prod.iteriscloud.com/smarterRoads/incidentFiltered/incidentFilteredTMDD/current/incidentFiltered_tmdd.xml?token=${token}`;

    console.log('Fetching live incident XML data from SmartRoads API...');

    const externalResponse = await fetch(externalApiUrl, {
      // Use redirect: 'follow' and set a User-Agent, matching robust proxy practices.
      redirect: 'follow',
      headers: {
        'User-Agent': 'ThrottleLife/1.0 (Next.js Proxy)',
        'Accept': 'application/xml'
      }
    });

    if (!externalResponse.ok) {
      const errorText = await externalResponse.text().catch(() => externalResponse.statusText);
      console.error('External API Response Status:', externalResponse.status, errorText);
      return NextResponse.json(
        { 
          message: `External API error: ${externalResponse.statusText}`, 
          details: errorText.substring(0, 100) 
        },
        { status: externalResponse.status }
      );
    }

    const xmlData = await externalResponse.text();

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