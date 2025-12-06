
import { useState, useEffect, useMemo } from 'react';
import { addDays, parseISO } from 'date-fns';
import { TrafficEvent } from '@/lib/types';

const fetchPlannedEvents = async (
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
      } catch {
        // Not a JSON response, use generic error message
      }
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
            } else {
               console.warn("Skipping JSON event due to missing data:", { eventId, rawEvent });
            }
        }
    }
  } catch (e: any) {
    console.error('Smartroads JSON Data Fetch Error:', e);
    setDataError(`Failed to load planned events: ${e.message}.`);
  }
  
  return jsonEvents;
};

const fetchLiveIncidents = async (
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

    const ns = {
      senderId: 'im\\:senderIncidentID',
      atisReport: 'im\\:atisReport',
      five11: 'im\\:atisReport localEventInformation five11Message',
      typeEvent: 'im\\:atisReport typeEvent',
      latitude: 'im\\:atisReport location pointLocation geoLocationPoint latitude',
      longitude: 'im\\:atisReport location pointLocation geoLocationPoint longitude',
    };
    
    impactReports.forEach((report, index) => {
      const id = report.querySelector(ns.senderId)?.textContent || `xml-id-${index}`;
      
      const typeEventNode = report.querySelector(ns.typeEvent);
      
      const latNode = report.querySelector(ns.latitude) || report.querySelector('latitude');
      const lonNode = report.querySelector(ns.longitude) || report.querySelector('longitude');
      const five11MessageNode = report.querySelector(ns.five11) || report.querySelector('five11Message');

      if (!latNode || !lonNode) {
        console.warn(`Skipping XML incident ${id}: Missing coordinates.`);
        return;
      }
      
      const rawLatitude = parseFloat(latNode.textContent!);
      const rawLongitude = parseFloat(lonNode.textContent!);
      
      const latitude = rawLatitude / 1000000;
      const longitude = rawLongitude / 1000000;
      
      if (isNaN(latitude) || isNaN(longitude)) {
          console.warn(`Skipping XML incident ${id}: Failed coordinate conversion.`);
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

export const useTrafficData = () => {
  const [plannedEvents, setPlannedEvents] = useState<TrafficEvent[]>([]);
  const [liveIncidents, setLiveIncidents] = useState<TrafficEvent[]>([]);
  const [plannedLoading, setPlannedLoading] = useState(true);
  const [plannedError, setPlannedError] = useState<string | null>(null);
  const [incidentLoading, setIncidentLoading] = useState(true);
  const [incidentError, setIncidentError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllData = async () => {
      const planned = await fetchPlannedEvents(setPlannedError);
      setPlannedEvents(planned);
      setPlannedLoading(false);
      
      const { incidents } = await fetchLiveIncidents(setIncidentLoading, setIncidentError);
      setLiveIncidents(incidents);
    };

    fetchAllData();
    const intervalId = setInterval(async () => {
      const { incidents } = await fetchLiveIncidents(setIncidentLoading, setIncidentError);
      setLiveIncidents(incidents);
    }, 30000);

    return () => clearInterval(intervalId);
  }, []);

  const allFilteredEvents = useMemo(() => [...liveIncidents, ...plannedEvents], [liveIncidents, plannedEvents]);
  const dataLoading = useMemo(() => plannedLoading || incidentLoading, [plannedLoading, incidentLoading]);

  return { allFilteredEvents, dataLoading, plannedError, incidentError, liveIncidents };
};
