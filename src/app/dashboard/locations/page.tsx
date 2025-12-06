/* src/app/dashboard/locations/page.tsx - REFACTORED */
'use client';

// Fix TypeScript errors for Google Maps API
declare const google: any;

import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
} from '@vis.gl/react-google-maps';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Bike, Radar } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { RouteIncidentChecker } from '@/components/RouteIncidentChecker';
import { buildRouteMetrics, projectPointToRoute, type LatLng } from '@/lib/route-utils';
import { useTrafficData } from '@/hooks/use-traffic-data';
import { TrafficEvent, UserProfile } from '@/lib/types';
import { GpsStatusToggle } from './components/GpsStatusTogle';
import { useUserProfile, type UserProfileWithAuth } from '@/hooks/use-user-profile';


type RouteOverlayData = {
  path: LatLng[];
  incidents: Array<TrafficEvent & { distanceToRouteMiles: number; routeDistanceMiles: number }>;
  totalMiles: number;
};

const hudPanelClass =
  'group relative flex items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-slate-900/80 via-slate-900/60 to-slate-800/80 px-2.5 py-2 text-sm shadow-lg shadow-primary/10 ring-1 ring-primary/20 backdrop-blur';

// -----------------------------------------------------------
// CORE UTILITY FUNCTIONS (Defined at top level to avoid scope errors)
// -----------------------------------------------------------

// Calculate distance in miles between two lat/lng points using Haversine formula
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in miles
};

// Determine event type based on category, subcategory, and description
const getEventType = (event: TrafficEvent): string => {
  const category = (event.category || '').toLowerCase();
  const subcategory = (event.subcategory || '').toLowerCase();
  const desc = event.description.toLowerCase();
  
  // 1. Check for XML Incident Source (most specific)
  if (event.source === 'xml') {
    // The subcategory for XML incidents now holds the DESCRIPTIVE VALUE (e.g., 'Disabled Vehicle')
    if (subcategory.includes('accident') || subcategory.includes('multi-vehicle') || subcategory.includes('crash')) {
      return 'crash'; // RED ICON (True accidents)
    }
    if (subcategory.includes('disabled') || subcategory.includes('stalled') || subcategory.includes('other traffic')) {
      return 'blocked'; // ORANGE ICON (Disabled or blocking vehicle)
    }
    if (subcategory.includes('security') || subcategory.includes('police')) {
        return 'police'; // BLUE ICON
    }
    if (subcategory.includes('weather') || subcategory.includes('advisory')) {
      return 'weather'; // GRAY ICON
    }
    // Default XML incidents to hazard/crash if type is unclear
    return 'hazard';
  }
  
  // 2. Check subcategory first (most specific for JSON events)
  if (subcategory && subcategory !== 'unknown') {
    // Added WZ check to target construction/work zone events
    if (subcategory.includes('wz') || subcategory.includes('construction') || subcategory.includes('work zone')) {
      return 'construction';
    }
    // Added explicit closure/blocked check for subcategory
    if (subcategory.includes('closure') || subcategory.includes('closed')) {
      return 'closure';
    }
    if (subcategory.includes('bridge') || subcategory.includes('inspection')) {
      return 'construction';
    }
    if (subcategory.includes('crash') || subcategory.includes('accident') || subcategory.includes('collision')) {
      return 'crash';
    }
    if (subcategory.includes('police') || subcategory.includes('law enforcement')) {
      return 'police';
    }
    if (subcategory.includes('weather') || subcategory.includes('rain') || subcategory.includes('snow')) {
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
  if (desc.includes('crash') || desc.includes('accident') || desc.includes('collision') || desc.includes('vehicle') && desc.includes('incident')) {
    return 'crash';
  }
  if (desc.includes('construction') || desc.includes('work zone') || desc.includes('roadwork')) {
    return 'construction';
  }
  if (desc.includes('bridge inspection') || desc.includes('bridge maintenance') || desc.includes('bridge work')) {
    return 'construction';
  }
  if (desc.includes('all') && desc.includes('closed') || desc.includes('closure') || desc.includes('road closed')) {
    return 'closure';
  }
  if (desc.includes('shoulder') && desc.includes('closed') || desc.includes('lane') && desc.includes('closed') || desc.includes('alternating')) {
    return 'blocked';
  }
  if (desc.includes('police') || desc.includes('law enforcement') || desc.includes('trooper')) {
    return 'police';
  }
  if (desc.includes('weather') || desc.includes('rain') || desc.includes('snow') || desc.includes('fog') || desc.includes('ice')) {
    return 'weather';
  }
  if (desc.includes('debris') || desc.includes('object') || desc.includes('hazard')) {
    return 'hazard';
  }
  
  // 4. Check category as final fallback
  if (category.includes('planned')) {
    return 'construction'; // Most planned events are construction
  }
  if (category.includes('unplanned') || category.includes('incident')) {
    return 'hazard'; // Unplanned incidents default to hazard
  }
  
  // Default based on common patterns
  return 'construction';
};


// -----------------------------------------------------------
// MEMBER STATUS CARD COMPONENT
// -----------------------------------------------------------

interface MemberStatusCardProps {
  member: UserProfile;
  nearbyIncidents: TrafficEvent[];
  onViewIncidents: () => void;
}

const MemberStatusCard = ({ member, nearbyIncidents, onViewIncidents }: MemberStatusCardProps) => {
  const criticalIncidents = nearbyIncidents.filter(incident => {
    const type = getEventType(incident);
    return type === 'crash' || type === 'closure';
  });
  
  const hasCritical = criticalIncidents.length > 0;
  
  return (
    <div className={`rounded-lg border-2 p-3 transition-all ${
      hasCritical 
        ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20' 
        : 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/20'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${hasCritical ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
          <Bike className={`h-4 w-4 ${hasCritical ? 'text-red-600' : 'text-green-600'}`} />
          <span className="font-bold text-sm">{member.roadName || `${member.firstName} ${member.lastName}`}</span>
        </div>
        <button
          onClick={onViewIncidents}
          className="text-xs font-semibold text-primary hover:underline"
        >
          View on Map
        </button>
      </div>
      
      <div className="flex items-center gap-3 text-xs">
        {hasCritical ? (
          <span className="flex items-center gap-1 text-red-700 dark:text-red-400 font-semibold">
            ⚠️ {criticalIncidents.length} critical
          </span>
        ) : (
          <span className="flex items-center gap-1 text-green-700 dark:text-green-400 font-semibold">
            ✅ All clear
          </span>
        )}
        <span className="text-muted-foreground">
          {nearbyIncidents.length} total incidents (10mi)
        </span>
      </div>
    </div>
  );
};

// -----------------------------------------------------------
// MARKERS AND MAP COMPONENTS 
// -----------------------------------------------------------

const ActiveMemberMarker = ({ member, routeStatus }: { member: UserProfile; routeStatus?: { isOnRoute: boolean; distanceToRouteMiles: number; routeDistanceMiles: number } }) => {
  const position = { lat: member.latitude!, lng: member.longitude! };
  const statusColor = routeStatus ? (routeStatus.isOnRoute ? 'bg-green-500' : 'bg-amber-500') : 'bg-primary';

  return (
    <AdvancedMarker
      position={position}
    >
        <div className="flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1 text-xs font-bold text-foreground backdrop-blur-sm border-2 border-primary">
          <span className={`h-2.5 w-2.5 rounded-full ${statusColor}`} />
          <Bike className="h-4 w-4 text-primary" />
          {member.roadName && <span>{member.roadName}</span>}
          {routeStatus && (
            <span className="text-[10px] font-semibold uppercase tracking-tight text-muted-foreground">
              {routeStatus.isOnRoute ? 'on route' : 'off route'}
            </span>
          )}
        </div>
    </AdvancedMarker>
  );
};

const TrafficEventMarker = ({ event }: { event: TrafficEvent }) => {
  const position = { lat: event.latitude, lng: event.longitude };
  const eventType = getEventType(event);
  const [isHovered, setIsHovered] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Define marker styles based on event type
  const markerConfig = {
    crash: {
      IconComponent: () => (
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
          <path d="M12 2L2 22h20L12 2z" fill="#DC2626" stroke="white" strokeWidth="1.5"/>
          <path d="M11 10h2v4h-2z M11 16h2v2h-2z" fill="white"/>
        </svg>
      ),
      bgColor: 'bg-red-600',
      borderColor: 'border-red-800',
      iconColor: 'text-white'
    },
    closure: {
      IconComponent: () => (
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
          <rect x="4" y="4" width="16" height="16" fill="#DC2626" stroke="white" strokeWidth="1.5" rx="2"/>
          <line x1="4" y1="4" x2="20" y2="20" stroke="white" strokeWidth="2"/>
          <line x1="20" y1="4" x2="4" y2="20" stroke="white" strokeWidth="2"/>
        </svg>
      ),
      bgColor: 'bg-red-600',
      borderColor: 'border-red-800',
      iconColor: 'text-white'
    },
    construction: {
      IconComponent: () => (
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
          <path d="M3 20h18v-2H3v2zm2-3h14l-7-14-7 14z" fill="#EA580C" stroke="white" strokeWidth="1.5"/>
          <rect x="10" y="11" width="4" height="6" fill="white"/>
        </svg>
      ),
      bgColor: 'bg-orange-600',
      borderColor: 'border-orange-800',
      iconColor: 'text-white'
    },
    blocked: {
      IconComponent: () => (
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
          <circle cx="12" cy="12" r="9" fill="#EA580C" stroke="white" strokeWidth="1.5"/>
          <rect x="8" y="6" width="2" height="6" fill="white" rx="1"/>
          <rect x="14" y="6" width="2" height="6" fill="white" rx="1"/>
          <rect x="8" y="14" width="8" height="4" fill="white" rx="1"/>
        </svg>
      ),
      bgColor: 'bg-orange-600',
      borderColor: 'border-orange-800',
      iconColor: 'text-white'
    },
    police: {
      IconComponent: () => (
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
          <path d="M12 2L4 6v4c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V6l-8-4z" fill="#2563EB" stroke="white" strokeWidth="1.5"/>
          <circle cx="12" cy="10" r="2" fill="white"/>
          <path d="M12 13v4" stroke="white" strokeWidth="2"/>
        </svg>
      ),
      bgColor: 'bg-blue-600',
      borderColor: 'border-blue-800',
      iconColor: 'text-white'
    },
    weather: {
      IconComponent: () => (
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
          <circle cx="12" cy="12" r="9" fill="#4B5563" stroke="white" strokeWidth="1.5"/>
          <path d="M12 6v3m0 6v3m6-6h-3m-6 0H6m11.5-5.5l-2 2m-7 7l-2 2m9 0l-2-2m-7-7l-2-2" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ),
      bgColor: 'bg-gray-600',
      borderColor: 'border-gray-800',
      iconColor: 'text-white'
    },
    hazard: {
      IconComponent: () => (
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
          <path d="M12 2L2 22h20L12 2z" fill="#CA8A04" stroke="white" strokeWidth="1.5"/>
          <path d="M12 9v5m0 2v1" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ),
      bgColor: 'bg-yellow-600',
      borderColor: 'border-yellow-800',
      iconColor: 'text-white'
    },
  };

  const config = markerConfig[eventType as keyof typeof markerConfig] || markerConfig.hazard;
  const IconComponent = config.IconComponent;

  const clearTooltipTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const showTooltip = () => {
    clearTooltipTimeout();
    setIsHovered(true);
  };

  const hideTooltip = () => {
    clearTooltipTimeout();
    timeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 100);
  };

  const handleClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (isHovered) {
      setIsHovered(false);
    } else {
      showTooltip();
      timeoutRef.current = setTimeout(() => {
        setIsHovered(false);
      }, 5000);
    }
  };

  useEffect(() => {
    return () => {
      clearTooltipTimeout();
    };
  }, []);

  return (
    <>
      <AdvancedMarker position={position}>
        <div 
          className="relative z-10" 
          onMouseEnter={showTooltip}
          onMouseLeave={hideTooltip}
          onClick={handleClick}
          onTouchStart={handleClick}
        >
          <div className={`flex items-center justify-center h-7 px-2 py-0.5 rounded-full ${config.bgColor} shadow-xl border-2 ${config.borderColor} cursor-pointer hover:scale-110 transition-transform whitespace-nowrap`}>
            <IconComponent />
            <span className={`ml-1 text-xs font-semibold ${config.iconColor} hidden md:inline`}>
              {eventType.toUpperCase()}
            </span>
          </div>
        </div>
      </AdvancedMarker>
      
      {isHovered && (
        <div className="absolute top-3 left-3 z-[999] pointer-events-none">
          <div className="bg-gray-900/90 text-white rounded-lg p-3 shadow-2xl backdrop-blur-sm border border-gray-700 max-w-sm">
            <p className="text-xs font-semibold mb-2 leading-relaxed opacity-100">{event.description}</p>
            <div className="text-[10px] text-gray-300 space-y-0.5 opacity-100">
              <p>📍 {event.latitude.toFixed(4)}, {event.longitude.toFixed(4)}</p>
              <p>🕐 {format(event.startDate, 'MMM dd, h:mm a')}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// -----------------------------------------------------------
// TRAFFIC OVERLAY
// -----------------------------------------------------------

const Traffic = () => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const trafficLayer = new google.maps.TrafficLayer();
    trafficLayer.setMap(map);
    return () => trafficLayer.setMap(null);
  }, [map]);

  return null;
};

const MemberMap = ({ showTraffic, smartroadsEvents, routeOverlay, currentUser }: { 
  showTraffic: boolean, 
  smartroadsEvents: TrafficEvent[],
  routeOverlay: RouteOverlayData | null,
  currentUser: UserProfileWithAuth,
}) => {
  const { firestore } = useFirebase();
  const map = useMap();
  const [zoom, setZoom] = useState(10);
  const routePolylineRef = useRef<google.maps.Polyline | null>(null);
  const routeMetrics = useMemo(() => {
    if (!routeOverlay) return null;
    return buildRouteMetrics(routeOverlay.path);
  }, [routeOverlay]);

  useEffect(() => {
    if (map && currentUser && currentUser.latitude && currentUser.longitude) {
      map.moveCamera({ center: { lat: currentUser.latitude, lng: currentUser.longitude }, zoom: 12 });
    }
  }, [map, currentUser]);
  
  useEffect(() => {
    if (!map) return;
    
    const zoomListener = map.addListener('zoom_changed', () => {
      const currentZoom = map.getZoom();
      if (currentZoom) {
        setZoom(currentZoom);
      }
    });

    return () => {
      if (window.google && window.google.maps) {
        window.google.maps.event.removeListener(zoomListener);
      }
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
      routePolylineRef.current = null;
    }
    if (!routeOverlay) return;

    const polyline = new google.maps.Polyline({
      path: routeOverlay.path,
      geodesic: true,
      strokeColor: '#2563eb',
      strokeOpacity: 0.9,
      strokeWeight: 4,
    });
    polyline.setMap(map);
    routePolylineRef.current = polyline;

    return () => {
      polyline.setMap(null);
    };
  }, [map, routeOverlay]);

  const activeMembersQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'users'), where('gpsActive', '==', true)) : null),
    [firestore]
  );

  const { data: activeMembers, isLoading } = useCollection<UserProfile>(
    activeMembersQuery
  );
  
  const mapCenter = activeMembers?.[0]?.latitude && activeMembers?.[0]?.longitude
    ? { lat: activeMembers[0].latitude, lng: activeMembers[0].longitude }
    : { lat: 38.9072, lng: -77.0369 }; // Default to Fairfax, VA

  if (isLoading) {
    return <Skeleton className="h-[600px] w-full rounded-lg" />;
  }

  if (!activeMembers || activeMembers.length === 0) {
    return (
        <Card>
            <CardContent className="flex h-[600px] items-center justify-center rounded-lg border-2 border-dashed">
                <div className="text-center">
                <h3 className="text-lg font-semibold">No Active Members</h3>
                <p className="text-muted-foreground">
                    No members have their GPS active right now.
                </p>
                </div>
            </CardContent>
        </Card>
    );
  }

  return (
    <div className="h-[600px] w-full overflow-hidden rounded-lg relative">
      <Map
        mapId={'a7f473062c274ales'}
        defaultCenter={mapCenter}
        defaultZoom={10}
        gestureHandling={'greedy'}
        disableDefaultUI={true}
      >
        {showTraffic && <Traffic />}
        {routeOverlay &&
          routeOverlay.incidents.map((incident) => {
            const typeLabel = getEventType(incident).toUpperCase();
            return (
              <AdvancedMarker
                key={`route-incident-${incident.id}`}
                position={{ lat: incident.latitude, lng: incident.longitude }}
              >
                <div className="rounded-full border border-blue-500 bg-blue-600 text-white text-[10px] px-2 py-1 shadow">
                  {typeLabel}
                </div>
              </AdvancedMarker>
            );
          })}
        {activeMembers.map((member) => {
          if (!member.latitude || !member.longitude) return null;
          let routeStatus: { isOnRoute: boolean; distanceToRouteMiles: number; routeDistanceMiles: number } | undefined;
          if (routeOverlay && routeMetrics) {
            const projection = projectPointToRoute(
              routeOverlay.path,
              routeMetrics.cumulativeMiles,
              { lat: member.latitude, lng: member.longitude }
            );
            const isOnRoute = projection.distanceToRouteMiles <= 0.15;
            routeStatus = {
              isOnRoute,
              distanceToRouteMiles: projection.distanceToRouteMiles,
              routeDistanceMiles: projection.routeDistanceMiles,
            };
          }
          return (
            <ActiveMemberMarker key={member.id} member={member} routeStatus={routeStatus} />
          );
        })}
        {showTraffic && zoom >= 13 && smartroadsEvents.map((event) => (
          <TrafficEventMarker key={event.id} event={event} />
        ))}
      </Map>
    </div>
  );
};


// -----------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------

export default function LocationsPage() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [showTraffic, setShowTraffic] = useState(true);
  const [routeOverlay, setRouteOverlay] = useState<RouteOverlayData | null>(null);

  const { allFilteredEvents, dataLoading, liveIncidents } = useTrafficData();
  
  const { firestore } = useFirebase();
  const { user: currentUser, isUserLoading: membersLoading } = useUserProfile();
  
  const activeMembersQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'users'), where('gpsActive', '==', true)) : null),
    [firestore]
  );
  const { data: activeMembers } = useCollection<UserProfile>(activeMembersQuery);

  if (!apiKey) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8">
        <Card><CardHeader><CardTitle className="font-headline text-destructive">Configuration Error</CardTitle></CardHeader><CardContent><p>Google Maps API key is missing. Please add it to your environment variables as <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>.</p></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-headline text-3xl font-bold tracking-tight md:text-4xl sm:self-start">
          Live Locations
        </h1>
        <div className="flex items-center gap-2 sm:justify-end flex-nowrap overflow-x-auto">
          <div className={hudPanelClass}>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/40">
                <Radar className="h-3 w-3 text-primary" />
              </div>
              <div className="leading-tight">
                <div className="text-[9px] uppercase tracking-[0.18em] text-primary/80">
                  Traffic
                </div>
                <div className="text-[11px] font-semibold text-foreground">
                  {showTraffic ? 'On' : 'Off'}
                </div>
              </div>
            </div>
            <Switch
              id="traffic-toggle"
              checked={showTraffic}
              onCheckedChange={setShowTraffic}
              className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted"
            />
          </div>
          <GpsStatusToggle className="min-w-[180px]" />
        </div>
      </header>

      <section className="mb-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bike className="h-5 w-5 text-primary" /> Who's Riding Now
            </CardTitle>
            <CardDescription>Active members and nearby hazards</CardDescription>
          </CardHeader>
          <CardContent>
            {membersLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /><p>Loading active members...</p></div>
            ) : !activeMembers || activeMembers.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground"><Bike className="h-12 w-12 mx-auto mb-2 opacity-50" /><p className="font-medium">No one is out riding right now</p><p className="text-sm">Member locations will appear here when they activate GPS</p></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeMembers.filter(m => m.latitude && m.longitude).map(member => {
                    const nearbyIncidents = liveIncidents.filter(incident => {
                      const distance = calculateDistance(member.latitude!, member.longitude!, incident.latitude, incident.longitude);
                      return distance <= 10;
                    });
                    return (<MemberStatusCard key={member.id} member={member} nearbyIncidents={nearbyIncidents} onViewIncidents={() => { document.querySelector('main')?.scrollIntoView({ behavior: 'smooth' }); }} />);
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ROUTE INCIDENT CHECKER */}
      <section className="mb-4">
        <RouteIncidentChecker 
          allEvents={allFilteredEvents} 
          isLoading={dataLoading}
          getEventType={getEventType}
          onRouteCalculated={setRouteOverlay}
        />
      </section>

      <main>
        <APIProvider apiKey={apiKey}>
          <MemberMap
            showTraffic={showTraffic}
            smartroadsEvents={allFilteredEvents}
            routeOverlay={routeOverlay}
            currentUser={currentUser}
          />
        </APIProvider>
      </main>
      

    </div>
  );
}
