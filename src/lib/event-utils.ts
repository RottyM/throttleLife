/* src/lib/event-utils.ts */

import { addDays, parseISO } from 'date-fns';

// -----------------------------------------------------------
// DATA STRUCTURE
// -----------------------------------------------------------

export interface TrafficEvent {
  id: string;
  latitude: number;
  longitude: number;
  description: string;
  startDate: Date;
  endDate: Date;
  category?: string;
  subcategory?: string;
  source: 'json' | 'xml';
}

// -----------------------------------------------------------
// UTILITY FUNCTIONS
// -----------------------------------------------------------

export const isEventActiveInWindow = (event: TrafficEvent, startFilterDate: Date, endFilterDate: Date): boolean => {
  return event.startDate < endFilterDate && event.endDate > startFilterDate;
};

export const getEventType = (event: TrafficEvent): string => {
  const category = (event.category || '').toLowerCase();
  const subcategory = (event.subcategory || '').toLowerCase();
  const desc = event.description.toLowerCase();
  
  // 1. Check for XML Incident Source (most specific)
  if (event.source === 'xml') {
    // The subcategory now holds the DESCRIPTIVE VALUE (e.g., 'Disabled Vehicle')
    if (subcategory.includes('accident') || subcategory.includes('multi-vehicle') || subcategory.includes('crash')) {
      return 'crash';
    }
    if (subcategory.includes('disabled') || subcategory.includes('stalled') || subcategory.includes('other traffic')) {
      return 'blocked';
    }
    if (subcategory.includes('security') || subcategory.includes('police')) {
        return 'police';
    }
    if (subcategory.includes('weather') || subcategory.includes('advisory')) {
      return 'weather';
    }
    return 'hazard';
  }
  
  // 2. Check subcategory first (most specific for JSON events)
  if (subcategory && subcategory !== 'unknown') {
    if (subcategory.includes('wz') || subcategory.includes('construction') || subcategory.includes('work zone')) {
      return 'construction';
    }
    if (subcategory.includes('closure') || subcategory.includes('closed')) {
      return 'closure';
    }
    if (subcategory.includes('crash') || subcategory.includes('accident') || subcategory.includes('collision')) {
      return 'crash';
    }
    if (subcategory.includes('police') || subcategory.includes('law enforcement')) {
      return 'police';
    }
    if (subcategory.includes('weather')) {
      return 'weather';
    }
    if (subcategory.includes('hazard') || subcategory.includes('debris')) {
      return 'hazard';
    }
    if (subcategory.includes('lane') || subcategory.includes('shoulder') || subcategory.includes('blocked')) {
      return 'blocked';
    }
  }
  
  // 3. Check description for specific keywords (most reliable since subcategories are unknown for many JSON events)
  if (desc.includes('crash') || desc.includes('accident') || desc.includes('collision') || desc.includes('incident')) {
    return 'crash';
  }
  if (desc.includes('construction') || desc.includes('roadwork')) {
    return 'construction';
  }
  if (desc.includes('closed') || desc.includes('closure')) {
    return 'closure';
  }
  if (desc.includes('police') || desc.includes('law enforcement') || desc.includes('trooper')) {
    return 'police';
  }
  if (desc.includes('weather') || desc.includes('rain') || desc.includes('snow') || desc.includes('fog')) {
    return 'weather';
  }
  if (desc.includes('debris') || desc.includes('hazard')) {
    return 'hazard';
  }
  
  // 4. Default to construction for planned events
  if (category.includes('planned')) {
    return 'construction';
  }
  
  return 'construction';
};

// -----------------------------------------------------------
// FETCHING FUNCTIONS (Moved from page.tsx)
// -----------------------------------------------------------

export const fetchPlannedEvents = async (
  setDataError: (error: string | null) => void
): Promise<TrafficEvent[]> => {
  setDataError(null); 
  let jsonEvents: TrafficEvent[] = [];
  
  try {
    const jsonUrl = '/api/smartroads-proxy';
    const response = await fetch(jsonUrl);

    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage = `Planned Events Proxy error: ${response.status} - ${response.statusText || 'Unknown error'}`;
      try {
        const errorJson = JSON.parse(errorBody);
        if (errorJson.message) {
            errorMessage = `Planned Events Proxy error: ${errorJson.message} (Status: ${response.status})`;
        }
      } catch { /* ignore */ }
      throw new Error(errorMessage);
    }
    
    const rawData = await response.json();
    
    for (const eventId in rawData) {
        if (Object.prototype.hasOwnProperty.call(rawData, eventId)) {
            const rawEvent = rawData[eventId];

            const id = eventId;
            const description = rawEvent['orci:template_511_text'] || rawEvent['orci:type_event'] || 'No description available';
            const scheduledStartTime = rawEvent['orci:scheduled_start_time'];
            const scheduledStopTime = rawEvent['orci:scheduled_stop_time'];
            const category = rawEvent['orci:event_category'] || 'Unknown';
            const subcategory = rawEvent['orci:event_subcategory'] || 'Unknown';

            const startPointPos = rawEvent['orci:start_point']?.['gml:Point']?.['gml:pos'];
            let latitude: number | undefined;
            let longitude: number | undefined;

            if (startPointPos) {
              const coords = String(startPointPos).split(' ');
              if (coords.length === 2) {
                latitude = parseFloat(coords[0]);
                longitude = parseFloat(coords[1]);
              }
            }
            
            if (id && latitude !== undefined && longitude !== undefined && scheduledStartTime && scheduledStopTime) {
              jsonEvents.push({
                id: String(id), 
                description: String(description), 
                latitude: latitude,
                longitude: longitude,
                startDate: parseISO(scheduledStartTime),
                endDate: parseISO(scheduledStopTime),
                category: String(category),
                subcategory: String(subcategory),
                source: 'json'
              });
            }
        }
    }
  } catch (e: any) {
    console.error('Smartroads JSON Data Fetch Error:', e);
    setDataError(`Failed to load planned events: ${e.message}.`);
  }
  
  return jsonEvents;
};

export const fetchLiveIncidents = async (
  setIncidentLoading: (loading: boolean) => void,
  setIncidentError: (error: string | null) => void
): Promise<{ incidents: TrafficEvent[], counts: Record<string, number> }> => {
  setIncidentLoading(true);
  setIncidentError(null);
  let xmlIncidents: TrafficEvent[] = [];
  let categoryCounts: Record<string, number> = {};
  
  try {
    const response = await fetch('/api/smartroads-incident-proxy');
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Live Incident Proxy error: ${response.status} - ${response.statusText || 'Unknown error'}`;
      if (errorText.length > 0) {
          errorMessage += ` Body starts: ${errorText.substring(0, 50)}...`;
      }
      throw new Error(errorMessage);
    }

    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    const impactReports = xmlDoc.querySelectorAll('impactReport');
    
    impactReports.forEach((report, index) => {
      const id = report.querySelector('im\\:senderIncidentID')?.textContent || `xml-id-${index}`;
      const typeEventNode = report.querySelector('im\\:atisReport typeEvent');
      const latNode = report.querySelector('im\\:atisReport location pointLocation geoLocationPoint latitude') || report.querySelector('latitude');
      const lonNode = report.querySelector('im\\:atisReport location pointLocation geoLocationPoint longitude') || report.querySelector('longitude');
      const five11MessageNode = report.querySelector('im\\:atisReport localEventInformation five11Message') || report.querySelector('five11Message');

      if (!latNode || !lonNode) {
        return;
      }
      
      const rawLatitude = parseFloat(latNode.textContent!);
      const rawLongitude = parseFloat(lonNode.textContent!);
      
      const latitude = rawLatitude / 1000000; // CRITICAL FIX: Coordinate Scaling
      const longitude = rawLongitude / 1000000; 
      
      if (isNaN(latitude) || isNaN(longitude)) {
          return;
      }
      
      const now = new Date();
      const oneHourFromNow = addDays(now, 1 / 24); 
      
      const description = five11MessageNode?.textContent || report.querySelector('description text')?.textContent || 'Incident Reported';
      
      let categoryName = 'Unspecified Incident';
      let categoryValue = 'Unknown';
      
      if (typeEventNode) {
        const typeChild = typeEventNode.children[0];
        if (typeChild) {
          categoryName = typeChild.tagName;
          categoryValue = typeChild.textContent?.trim() || 'Incident';
        }
      }
      
      const fullCategory = `${categoryName}: ${categoryValue}`;
      categoryCounts[fullCategory] = (categoryCounts[fullCategory] || 0) + 1;
      
      xmlIncidents.push({
          id: String(id), 
          description: String(description), 
          latitude: latitude,
          longitude: longitude,
          startDate: now, 
          endDate: oneHourFromNow, 
          category: 'Unplanned Incident', 
          subcategory: categoryValue,
          source: 'xml'
      });
    });
    
  } catch (e: any) {
    console.error('Error fetching incident data:', e);
    setIncidentError(`Failed to load live incidents: ${e.message}.`);
  } finally {
    setIncidentLoading(false);
  }
  
  return { incidents: xmlIncidents, counts: categoryCounts };
};