/* src/app/dashboard/locations/page.tsx (Final Clean Entry Point) */
'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import TrafficMap from '@/components/traffic-map';
import TrafficDashboard from '@/components/traffic-dashboard';
import { useSmartRoadsData } from '@/hooks/use-smartroads-data';

export default function LocationsPage() {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const [showTraffic, setShowTraffic] = useState(true);

    const {
        filteredSmartroadsEvents,
        sortedLiveIncidents,
        categoryCounts,
        incidentCategoryCounts,
        filterDates,
        now,
        plannedError,
        incidentError,
        dataLoading,
    } = useSmartRoadsData();

    if (!apiKey) {
        return (
          <div className="flex-1 space-y-4 p-4 md:p-8">
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <h2 className="text-xl font-bold text-destructive">Configuration Error</h2>
                <p className="mt-2 text-sm text-muted-foreground">Google Maps API key is missing. Please add it to your environment variables as <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>.</p>
            </div>
          </div>
        );
    }
    
    // FIX: Pass the filtered list to the dashboard component as a prop
    const plannedEventsFiltered = filteredSmartroadsEvents.filter(e => e.source === 'json');

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="font-headline text-3xl font-bold tracking-tight md:text-4xl">
                Live Locations
              </h1>
              <p className="text-muted-foreground">
                See who's out on the road right now.
              </p>
            </div>
            <div className="flex items-center space-x-2">
                <Switch
                    id="traffic-toggle"
                    checked={showTraffic}
                    onCheckedChange={setShowTraffic}
                />
                <Label htmlFor="traffic-toggle">Show Traffic</Label>
            </div>
          </header>
    
          <main>
            <TrafficMap
                apiKey={apiKey}
                showTraffic={showTraffic}
                smartroadsEvents={filteredSmartroadsEvents}
                isLoading={dataLoading}
            />
          </main>
          
          <TrafficDashboard
            totalEventsInFilter={filteredSmartroadsEvents.length}
            filterDates={filterDates}
            dataLoading={dataLoading}
            plannedError={plannedError}
            incidentError={incidentError}
            showTraffic={showTraffic}
            
            sortedLiveIncidents={sortedLiveIncidents}
            incidentCategoryCounts={incidentCategoryCounts}
            now={now}

            plannedEvents={plannedEventsFiltered}
            categoryCounts={categoryCounts}
            filteredSmartroadsEvents={filteredSmartroadsEvents} // <-- Passed here to fix error
          />
        </div>
      );
}
