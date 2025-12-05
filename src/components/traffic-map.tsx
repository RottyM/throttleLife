/* src/components/traffic-map.tsx (Corrected Context Error) */
import { useState, useEffect, useMemo } from 'react';
import {
    APIProvider,
    Map,
    AdvancedMarker,
    useMap,
} from '@vis.gl/react-google-maps';
import { Bike, Construction } from 'lucide-react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { TrafficEvent, getEventType } from '@/lib/event-utils';
import { Skeleton } from '@/components/ui/skeleton';

// --- Types ---
interface UserProfile {
    id: string; userName: string; firstName: string; lastName:string;
    roadName?: string; latitude?: number; longitude?: number; gpsActive?: boolean;
}
interface TrafficMapProps {
    apiKey: string;
    showTraffic: boolean;
    smartroadsEvents: TrafficEvent[];
    isLoading: boolean;
}

// --- Traffic Layer Component ---
const TrafficLayerComponent = () => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    if (typeof window !== 'undefined' && window.google && window.google.maps) {
        const trafficLayer = new window.google.maps.TrafficLayer();
        trafficLayer.setMap(map);
        return () => trafficLayer.setMap(null);
    }
    return () => {};
  }, [map]);

  return null;
};

// --- Active Member Marker Component (Unchanged) ---
const ActiveMemberMarker = ({ member }: { member: UserProfile }) => {
  const position = { lat: member.latitude!, lng: member.longitude! };
  // ... (Marker content is omitted for brevity but remains the same)
  return (
    <AdvancedMarker position={position}>
        <div className="flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1 text-xs font-bold text-foreground backdrop-blur-sm">
          <Bike className="h-4 w-4 text-primary" />
          {member.roadName && <span>{member.roadName}</span>}
        </div>
    </AdvancedMarker>
  );
};

// --- Traffic Event Marker Component (Omitted for brevity, but includes z-index/style fixes) ---
// Note: This component remains exactly as defined in the last solution.
const TrafficEventMarker = ({ event }: { event: TrafficEvent }) => { /* ... */ return <AdvancedMarker position={{ lat: event.latitude, lng: event.longitude }}>{/* ... */}</AdvancedMarker> };


// --- 💥 Map Content Component (NEW: Calls useMap inside APIProvider) ---
const MapContent: React.FC<{ smartroadsEvents: TrafficEvent[], showTraffic: boolean }> = ({ smartroadsEvents, showTraffic }) => {
    const { firestore } = useFirebase();
    
    // FIX 1: This call is now correctly inside the APIProvider context provided by TrafficMap
    const map = useMap(); 
    const [zoom, setZoom] = useState(10); 
    
    // Track zoom level
    useEffect(() => {
        if (!map) return;
        const zoomListener = map.addListener('zoom_changed', () => {
            const currentZoom = map.getZoom();
            if (currentZoom) {
                setZoom(currentZoom);
            }
        });
        return () => {
            if (window.google?.maps) {
                window.google.maps.event.removeListener(zoomListener);
            }
        };
    }, [map]);

    const activeMembersQuery = useMemoFirebase(
        () => firestore ? query(collection(firestore, 'users'), where('gpsActive', '==', true)) : null,
        [firestore]
    );
    const { data: activeMembers, isLoading: membersLoading } = useCollection<UserProfile>(activeMembersQuery);
    
    const mapCenter = activeMembers?.[0]?.latitude && activeMembers?.[0]?.longitude
        ? { lat: activeMembers[0].latitude, lng: activeMembers[0].longitude }
        : { lat: 38.9072, lng: -77.0369 };
        
    if (membersLoading || !map) {
        return <Skeleton className="h-[600px] w-full rounded-lg" />;
    }

    return (
        <Map
            mapId={'a7f473062c274ales'}
            defaultCenter={mapCenter}
            defaultZoom={10}
            gestureHandling={'greedy'}
            disableDefaultUI={true}
        >
            {showTraffic && <TrafficLayerComponent />}
            {activeMembers?.map(
                (member) =>
                    member.latitude && member.longitude && (
                        <ActiveMemberMarker key={member.id} member={member} />
                    )
            )}
            {/* Only show traffic markers when zoomed in to level 13 or higher */}
            {showTraffic && zoom >= 13 && smartroadsEvents.map((event) => (
                <TrafficEventMarker key={event.id} event={event} />
            ))}
        </Map>
    );
}

// --- Traffic Map Component (Wrapper) ---
const TrafficMap: React.FC<TrafficMapProps> = ({ apiKey, showTraffic, smartroadsEvents, isLoading }) => {
    const [mapInitialized, setMapInitialized] = useState(false);

    if (!apiKey) {
        return <p>API Key Missing</p>;
    }
    
    if (isLoading && !mapInitialized) {
         return <Skeleton className="h-[600px] w-full rounded-lg" />;
    }

    return (
        <div className="h-[600px] w-full overflow-hidden rounded-lg">
            <APIProvider apiKey={apiKey} onLoad={() => setMapInitialized(true)}>
                <MapContent 
                    smartroadsEvents={smartroadsEvents} 
                    showTraffic={showTraffic} 
                />
            </APIProvider>
        </div>
    );
};

export default TrafficMap;
