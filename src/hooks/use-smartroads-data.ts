/* src/hooks/use-smartroads-data.ts */
import { useState, useMemo, useEffect } from 'react';
import { addDays, differenceInMinutes } from 'date-fns';
import { 
    TrafficEvent, 
    fetchPlannedEvents, 
    fetchLiveIncidents, 
    isEventActiveInWindow 
} from '@/lib/event-utils';

export interface FilterDates {
    start: Date | null;
    end: Date | null;
}

export const useSmartRoadsData = () => {
    const [plannedEvents, setPlannedEvents] = useState<TrafficEvent[]>([]);
    const [liveIncidents, setLiveIncidents] = useState<TrafficEvent[]>([]);
    
    const [plannedLoading, setPlannedLoading] = useState(true);
    const [plannedError, setPlannedError] = useState<string | null>(null);

    const [incidentLoading, setIncidentLoading] = useState(true);
    const [incidentError, setIncidentError] = useState<string | null>(null);
    const [incidentCategoryCounts, setIncidentCategoryCounts] = useState<Record<string, number>>({});
    
    const [filterDates, setFilterDates] = useState<FilterDates>({ start: null, end: null });
    const now = useMemo(() => new Date(), []); 

    // Initialize filter dates
    useEffect(() => {
        const today = new Date();
        const endOfFilterDate = addDays(today, 3);
        setFilterDates({ start: today, end: endOfFilterDate });
    }, []);

    // 1. SORTED AND FILTERED LIVE INCIDENTS (Recency sorting)
    const sortedLiveIncidents = useMemo(() => {
        if (!filterDates.start || !filterDates.end) return [];
        
        const filtered = liveIncidents.filter(event => 
            isEventActiveInWindow(event, filterDates.start!, filterDates.end!)
        );
        
        // Sort by start date (latest first / descending)
        return filtered.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
    }, [liveIncidents, filterDates]);

    // 2. COMBINED EVENTS FOR MAP DISPLAY
    const filteredSmartroadsEvents = useMemo(() => {
        if (!filterDates.start || !filterDates.end) return [];
        
        const filteredPlanned = plannedEvents.filter(event => 
            isEventActiveInWindow(event, filterDates.start!, filterDates.end!)
        );
        
        // Combine sorted live incidents with filtered planned events
        return [...sortedLiveIncidents, ...filteredPlanned];
    }, [plannedEvents, sortedLiveIncidents, filterDates]);

    // Calculate category counts (Only for Planned Events breakdown)
    const categoryCounts = useMemo(() => {
        const counts: Record<string, Record<string, number>> = {};
        plannedEvents.forEach(event => {
            const cat = event.category || 'Unknown';
            const subcat = event.subcategory || 'Unknown';
            if (!counts[cat]) counts[cat] = {};
            if (!counts[cat][subcat]) counts[cat][subcat] = 0;
            counts[cat][subcat]++;
        });
        return counts;
    }, [plannedEvents]);

    // 3. POLLING EFFECT (Live Update)
    useEffect(() => {
        const runPlannedFetch = async () => {
            setPlannedLoading(true);
            const events = await fetchPlannedEvents(setPlannedError);
            setPlannedEvents(events);
            setPlannedLoading(false);
        };

        const runIncidentFetch = async () => {
            setIncidentLoading(true);
            const { incidents: xmlIncidents, counts: incidentCounts } = await fetchLiveIncidents(setIncidentLoading, setIncidentError);
            setLiveIncidents(xmlIncidents);
            setIncidentCategoryCounts(incidentCounts);
            setIncidentLoading(false);
        };

        // Run planned fetch once
        runPlannedFetch();

        // Run incidents fetch immediately and set up the 30s polling interval
        runIncidentFetch();
        const incidentInterval = setInterval(runIncidentFetch, 30000); 

        return () => {
          clearInterval(incidentInterval);
        };
    }, []);


    return {
        // Data
        filteredSmartroadsEvents,
        sortedLiveIncidents,
        categoryCounts,
        incidentCategoryCounts,
        filterDates,
        now,

        // Status
        plannedError,
        incidentError,
        dataLoading: plannedLoading || incidentLoading,
    };
};