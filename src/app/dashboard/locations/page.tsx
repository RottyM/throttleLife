/* src/app/dashboard/locations/page.tsx - CLEANED VERSION */
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
import { Bike, Construction, Clock, MapPin, AlertTriangle, ChevronDown, Dock, X, ChevronsDownUp } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { format, addDays, parseISO, differenceInMinutes, isBefore } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { RouteIncidentChecker } from '@/components/RouteIncidentChecker';
import { buildRouteMetrics, projectPointToRoute, type LatLng } from '@/lib/route-utils';

interface TrafficEvent {
  id: string;
  latitude: number;
  longitude: number;
  description: string;
  startDate: Date;
  endDate: Date;
  category?: string;
  subcategory?: string;
  source: 'json' | 'xml'; // Added source field
}

type RouteOverlayData = {
  path: LatLng[];
  incidents: Array<TrafficEvent & { distanceToRouteMiles: number; routeDistanceMiles: number }>;
  totalMiles: number;
};

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

const isEventActiveInWindow = (event: TrafficEvent, startFilterDate: Date, endFilterDate: Date): boolean => {
  // Show events that are active/ongoing during the time window
  return event.startDate < endFilterDate && event.endDate > startFilterDate;
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

interface UserProfile {
  id: string;
  userName: string;
  firstName: string;
  lastName:string;
  roadName?: string;
  profilePicture?: string;
  latitude?: number;
  longitude?: number;
  gpsActive?: boolean;
}

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

  // Clear any existing timeout
  const clearTooltipTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  // Show tooltip
  const showTooltip = () => {
    clearTooltipTimeout();
    setIsHovered(true);
  };

  // Hide tooltip with delay
  const hideTooltip = () => {
    clearTooltipTimeout();
    timeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 100);
  };

  // Handle click/touch for mobile
  const handleClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (isHovered) {
      setIsHovered(false);
    } else {
      showTooltip();
      // Auto-hide after 5 seconds on mobile
      timeoutRef.current = setTimeout(() => {
        setIsHovered(false);
      }, 5000);
    }
  };

  // Cleanup on unmount
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
          {/* Marker */}
          <div className={`flex items-center justify-center h-7 px-2 py-0.5 rounded-full ${config.bgColor} shadow-xl border-2 ${config.borderColor} cursor-pointer hover:scale-110 transition-transform whitespace-nowrap`}>
            <IconComponent />
            <span className={`ml-1 text-xs font-semibold ${config.iconColor} hidden md:inline`}>
              {eventType.toUpperCase()}
            </span>
          </div>
        </div>
      </AdvancedMarker>
      
      {/* Position tooltip relative to the map container */}
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

const MemberMap = ({ showTraffic, smartroadsEvents, routeOverlay }: { 
  showTraffic: boolean, 
  smartroadsEvents: TrafficEvent[],
  routeOverlay: RouteOverlayData | null,
}) => {
  const { firestore, user: currentUser } = useFirebase();
  const map = useMap();
  const [zoom, setZoom] = useState(10);
  const routePolylineRef = useRef<google.maps.Polyline | null>(null);
  const routeMetrics = useMemo(() => {
    if (!routeOverlay) return null;
    return buildRouteMetrics(routeOverlay.path);
  }, [routeOverlay]);
  

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
      if (window.google && window.google.maps) {
        window.google.maps.event.removeListener(zoomListener);
      }
    };
  }, [map]);

  // Draw planned route polyline
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
    () => (firestore && currentUser ? query(collection(firestore, 'users'), where('gpsActive', '==', true)) : null),
    [firestore, currentUser]
  );

  const { data: activeMembers, isLoading } = useCollection<UserProfile>(
    activeMembersQuery
  );
  


  // Define mapCenter BEFORE any returns
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
            const isOnRoute = projection.distanceToRouteMiles <= 0.15; // ~800 ft corridor for rider tracking
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
        {/* Only show traffic markers when zoomed in to level 13 or higher */}
        {showTraffic && zoom >= 13 && smartroadsEvents.map((event) => (
          <TrafficEventMarker key={event.id} event={event} />
        ))}
      </Map>
    </div>
  );
};

// -----------------------------------------------------------
// DATA FETCHING FUNCTIONS
// -----------------------------------------------------------

/**
 * Fetches and processes the JSON data for planned events (Road Closures).
 */
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

/**
 * Fetches and processes the XML data for live incidents.
 */
const fetchLiveIncidents = async (
  setIncidentLoading: (loading: boolean) => void,
  setIncidentError: (error: string | null) => void // New error setter for incidents
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
    
    // Parse XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    // Note: querySelectorAll('impactReport') works because this element is often considered local
    const impactReports = xmlDoc.querySelectorAll('impactReport');
    
    impactReports.forEach((report, index) => {
      // Use robust queries for nodes that might be namespaced (e.g., im:atisReport) or non-namespaced (e.g., latitude)
      const id = report.querySelector('im\\:senderIncidentID')?.textContent || `xml-id-${index}`;
      
      // Get the descriptive event node value
      const typeEventNode = report.querySelector('im\\:atisReport typeEvent');
      
      // Attempt to find coordinate nodes using both namespaced path and non-namespaced tag names
      const latNode = report.querySelector('im\\:atisReport location pointLocation geoLocationPoint latitude') || report.querySelector('latitude');
      const lonNode = report.querySelector('im\\:atisReport location pointLocation geoLocationPoint longitude') || report.querySelector('longitude');
      const five11MessageNode = report.querySelector('im\\:atisReport localEventInformation five11Message') || report.querySelector('five11Message');

      if (!latNode || !lonNode) {
        console.warn(`Skipping XML incident ${id}: Missing coordinates.`);
        return;
      }
      
      // Extract and convert coordinates (divide by 1,000,000)
      const rawLatitude = parseFloat(latNode.textContent!);
      const rawLongitude = parseFloat(lonNode.textContent!);
      
      const latitude = rawLatitude / 1000000; // FIX: Coordinate Scaling
      const longitude = rawLongitude / 1000000; // FIX: Coordinate Scaling
      
      if (isNaN(latitude) || isNaN(longitude)) {
          console.warn(`Skipping XML incident ${id}: Failed coordinate conversion.`);
          return;
      }
      
      // Set start and end times
      const now = new Date();
      const oneHourFromNow = addDays(now, 1 / 24); 
      
      // Extract description (prefer five11Message)
      const description = five11MessageNode?.textContent || report.querySelector('description text')?.textContent || 'Incident Reported';
      
      // Extract descriptive incident type
      let categoryName = 'Unspecified Incident';
      let categoryValue = 'Unknown';
      
      if (typeEventNode) {
        const typeChild = typeEventNode.children[0];
        if (typeChild) {
          categoryName = typeChild.tagName; // e.g., "accidentsAndIncidents" (for the breakdown box)
          categoryValue = typeChild.textContent?.trim() || 'Incident'; // e.g., "Disabled Vehicle" (for the mapping logic)
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
          subcategory: categoryValue, // *** FIXED: Using descriptive value for specific mapping ***
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


// -----------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------

export default function LocationsPage() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [showTraffic, setShowTraffic] = useState(true);
  const [routeOverlay, setRouteOverlay] = useState<RouteOverlayData | null>(null);

  // Effect to reset HUD visibility when traffic is toggled
  useEffect(() => {
    // no-op; HUD removed
  }, [showTraffic]);
  
  const { firestore, user: currentUser } = useFirebase();
  const activeMembersQuery = useMemoFirebase(
    () => (firestore && currentUser ? query(collection(firestore, 'users'), where('gpsActive', '==', true)) : null),
    [firestore, currentUser]
  );
  const { data: activeMembers, isLoading: membersLoading } = useCollection<UserProfile>(activeMembersQuery);
  const [plannedEvents, setPlannedEvents] = useState<TrafficEvent[]>([]);
  const [liveIncidents, setLiveIncidents] = useState<TrafficEvent[]>([]);
  
  const [plannedLoading, setPlannedLoading] = useState(true);
  const [plannedError, setPlannedError] = useState<string | null>(null);

  const [incidentLoading, setIncidentLoading] = useState(true);
  const [incidentError, setIncidentError] = useState<string | null>(null);
  
  const [incidentCategoryCounts, setIncidentCategoryCounts] = useState<Record<string, number>>({});
  
  const [lastIncidentUpdate, setLastIncidentUpdate] = useState<Date | null>(null);
  
  const [activeFilter, setActiveFilter] = useState<'critical' | 'live' | 'all'>('critical');
  
  const [filterDates, setFilterDates] = useState<{ start: Date | null, end: Date | null }>({ start: null, end: null });

  const sortedLiveIncidents = useMemo(() => {
    if (!filterDates.start || !filterDates.end) return [];
    
    const filtered = liveIncidents.filter(event => isEventActiveInWindow(event, filterDates.start!, filterDates.end!));
    
    return filtered.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
  }, [liveIncidents, filterDates]);

  useEffect(() => {
    const today = new Date();
    const endOfFilterDate = addDays(today, 2); // Changed from 3 to 2 days
    setFilterDates({ start: today, end: endOfFilterDate });
  }, []);
  
  const allFilteredEvents = useMemo(() => {
      if (!filterDates.start || !filterDates.end) return [];
      const filteredPlanned = plannedEvents.filter(event => isEventActiveInWindow(event, filterDates.start!, filterDates.end!));
      return [...sortedLiveIncidents, ...filteredPlanned];
  }, [plannedEvents, sortedLiveIncidents, filterDates]);
  
  const criticalIncidents = useMemo(() => {
    return allFilteredEvents.filter(event => {
      const type = getEventType(event);
      return type === 'crash' || type === 'closure';
    });
  }, [allFilteredEvents]);

  const liveEventsForDisplay = useMemo(() => {
    return allFilteredEvents.filter(event => event.source === 'xml');
  }, [allFilteredEvents]);
  
  const displayedEvents = useMemo(() => {
    if (activeFilter === 'critical') return criticalIncidents;
    if (activeFilter === 'live') return liveEventsForDisplay;
    return allFilteredEvents;
  }, [activeFilter, criticalIncidents, liveEventsForDisplay, allFilteredEvents]);


  useEffect(() => {
    const fetchPlanned = async () => {
        setPlannedLoading(true);
        const events = await fetchPlannedEvents(setPlannedError);
        setPlannedEvents(events);
        setPlannedLoading(false);
    };

    const fetchIncidents = async () => {
        const { incidents: xmlIncidents, counts: incidentCounts } = await fetchLiveIncidents(setIncidentLoading, setIncidentError);
        setLiveIncidents(xmlIncidents);
        setIncidentCategoryCounts(incidentCounts);
        setLastIncidentUpdate(new Date());
    };

    fetchPlanned();
    fetchIncidents();
    const incidentInterval = setInterval(fetchIncidents, 30000); 

    return () => {
      clearInterval(incidentInterval);
    };
  }, []);

  const dataLoading = plannedLoading || incidentLoading;

  if (!apiKey) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8">
        <Card><CardHeader><CardTitle className="font-headline text-destructive">Configuration Error</CardTitle></CardHeader><CardContent><p>Google Maps API key is missing. Please add it to your environment variables as <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>.</p></CardContent></Card>
      </div>
    );
  }

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
            <Switch id="traffic-toggle" checked={showTraffic} onCheckedChange={setShowTraffic} />
            <Label htmlFor="traffic-toggle">Show Traffic</Label>
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
                    const nearbyIncidents = sortedLiveIncidents.filter(incident => {
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
          />
        </APIProvider>
      </main>
      
      <section className="mt-6">
        <Collapsible defaultOpen={true}>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                         <div className="flex-1">
                            <CardTitle className="flex items-center gap-2 text-xl">
                            <Construction className="h-5 w-5 text-orange-500" />
                            VDOT Incidents and Road Closures
                            </CardTitle>
                            <CardDescription>
                                {filterDates.start && filterDates.end 
                                ? `Active events from ${format(filterDates.start, 'MMM dd')} to ${format(filterDates.end, 'MMM dd, yyyy')}`
                                : 'Loading event dates...'}
                            </CardDescription>
                         </div>
                        <CollapsibleTrigger asChild>
                             <Button variant="ghost" size="icon">
                                <ChevronDown className="h-5 w-5 transition-transform duration-300" />
                                <span className="sr-only">Toggle panel</span>
                            </Button>
                        </CollapsibleTrigger>
                    </div>
                </CardHeader>
                <CollapsibleContent>
                    <CardContent>
                        {dataLoading && (<div className="flex items-center gap-2 text-muted-foreground"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /><p>Loading traffic data...</p></div>)}
                        {plannedError && (<div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 mb-4"><p className='text-destructive font-semibold'>Error loading Planned Events</p><p className="text-sm text-muted-foreground">{plannedError}</p></div>)}
                        {!dataLoading && !plannedError && allFilteredEvents.length === 0 && (<div className="rounded-lg border-2 border-dashed p-8 text-center"><Construction className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" /><p className='text-muted-foreground font-medium'>No incidents or road closures in the next 2 days</p><p className="text-sm text-muted-foreground mt-1">The roads are clear! 🏍️</p></div>)}

                        {!dataLoading && (allFilteredEvents.length > 0 || incidentError) && (
                            <div>
                            <div className="mb-4 p-4 bg-muted/30 rounded-lg">
                                <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                     <Button size="sm" variant={activeFilter === 'critical' ? 'default' : 'outline'} onClick={() => setActiveFilter('critical')}>
                                        <div className="text-lg font-bold mr-2">{criticalIncidents.length}</div> Critical
                                    </Button>
                                    <Button size="sm" variant={activeFilter === 'live' ? 'default' : 'outline'} onClick={() => setActiveFilter('live')}>
                                        <div className="text-lg font-bold mr-2">{liveEventsForDisplay.length}</div> Live
                                    </Button>
                                    <Button size="sm" variant={activeFilter === 'all' ? 'default' : 'outline'} onClick={() => setActiveFilter('all')}>
                                        <div className="text-lg font-bold mr-2">{allFilteredEvents.length}</div> All
                                    </Button>
                                </div>
                                <div className="flex items-center gap-2">
                                    {showTraffic && ( <span className="text-xs font-normal bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded-md"> ✓ Showing on map </span>)}
                                    {!showTraffic && (<span className="text-xs font-normal bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-md">Hidden on map</span>)}
                                </div>
                                </div>
                            </div>
                            
                            <div className="mb-4">
                                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                                📍 {activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)} Events
                                {showTraffic && (<span className="text-xs font-normal text-green-600 dark:text-green-400">(Visible on map at zoom 13+)</span>)}
                                </h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                {displayedEvents.length} {displayedEvents.length === 1 ? 'event' : 'events'} displayed
                                </p>
                            </div>

                            {displayedEvents.length > 0 ? (
                                <div className='space-y-3 max-h-96 overflow-y-auto pr-2 mb-6'>
                                {displayedEvents.map(event => {
                                const eventType = getEventType(event);
                                const markerConfig = {
                                    crash: { icon: (<svg viewBox="0 0 24 24" fill="none" className="h-5 w-5"><path d="M12 2L2 22h20L12 2z" fill="#EF4444" stroke="#DC2626" strokeWidth="2"/><path d="M11 10h2v4h-2z M11 16h2v2h-2z" fill="white"/></svg>), color: 'border-red-200 bg-red-50/50 hover:border-red-300 hover:bg-red-50 dark:border-red-900/30 dark:bg-red-950/20' },
                                    closure: { icon: (<svg viewBox="0 0 24 24" fill="none" className="h-5 w-5"><rect x="4" y="4" width="16" height="16" fill="#EF4444" stroke="#DC2626" strokeWidth="2" rx="2"/><line x1="4" y1="4" x2="20" y2="20" stroke="white" strokeWidth="2"/><line x1="20" y1="4" x2="4" y2="20" stroke="white" strokeWidth="2"/></svg>), color: 'border-red-200 bg-red-50/50 hover:border-red-300 hover:bg-red-50 dark:border-red-900/30 dark:bg-red-950/20' },
                                    construction: { icon: (<svg viewBox="0 0 24 24" fill="none" className="h-5 w-5"><path d="M3 20h18v-2H3v2zm2-3h14l-7-14-7 14z" fill="#F97316" stroke="#EA580C" strokeWidth="1.5"/><rect x="10" y="11" width="4" height="6" fill="white"/></svg>), color: 'border-orange-200 bg-orange-50/50 hover:border-orange-300 hover:bg-orange-50 dark:border-orange-900/30 dark:bg-orange-950/20' },
                                    blocked: { icon: (<svg viewBox="0 0 24 24" fill="none" className="h-5 w-5"><circle cx="12" cy="12" r="9" fill="#F97316" stroke="#EA580C" strokeWidth="2"/><rect x="8" y="6" width="2" height="6" fill="white" rx="1"/><rect x="14" y="6" width="2" height="6" fill="white" rx="1"/><rect x="8" y="14" width="8" height="4" fill="white" rx="1"/></svg>), color: 'border-orange-200 bg-orange-50/50 hover:border-orange-300 hover:bg-orange-50 dark:border-orange-900/30 dark:bg-orange-950/20' },
                                    police: { icon: (<svg viewBox="0 0 24 24" fill="none" className="h-5 w-5"><path d="M12 2L4 6v4c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V6l-8-4z" fill="#3B82F6" stroke="#2563EB" strokeWidth="1.5"/><circle cx="12" cy="10" r="2" fill="white"/><path d="M12 13v4" stroke="white" strokeWidth="2"/></svg>), color: 'border-blue-200 bg-blue-50/50 hover:border-blue-300 hover:bg-blue-50 dark:border-blue-900/30 dark:bg-blue-950/20' },
                                    weather: { icon: (<svg viewBox="0 0 24 24" fill="none" className="h-5 w-5"><circle cx="12" cy="12" r="9" fill="#6B7280" stroke="#4B5563" strokeWidth="2"/><path d="M12 6v3m0 6v3m6-6h-3m-6 0H6m11.5-5.5l-2 2m-7 7l-2 2m9 0l-2-2m-7-7l-2-2" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>), color: 'border-gray-200 bg-gray-50/50 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-900/30 dark:bg-gray-950/20' },
                                    hazard: { icon: (<svg viewBox="0 0 24 24" fill="none" className="h-5 w-5"><path d="M12 2L2 22h20L12 2z" fill="#EAB308" stroke="#CA8A04" strokeWidth="2"/><path d="M12 9v5m0 2v1" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>), color: 'border-yellow-200 bg-yellow-50/50 hover:border-yellow-300 hover:bg-yellow-50 dark:border-yellow-900/30 dark:bg-yellow-950/20' },
                                };
                                const config = markerConfig[eventType as keyof typeof markerConfig] || markerConfig.hazard;
                                return (
                                    <div key={event.id} className={`group rounded-lg border p-4 transition-all ${config.color}`}>
                                        <div className="flex items-start gap-3">
                                        <div className="flex-shrink-0 mt-0.5">{config.icon}</div>
                                        <div className="flex-1 space-y-2">
                                            <p className='font-medium text-sm leading-relaxed text-foreground'>{event.description}<span className='ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-primary/20 text-primary'>{event.source === 'xml' ? 'Live Incident' : 'Planned'}</span></p>
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                            <div className="flex items-center gap-1"><MapPin className="h-3 w-3" /><span>{event.latitude.toFixed(4)}, {event.longitude.toFixed(4)}</span></div>
                                            <div className="flex items-center gap-1"><Clock className="h-3 w-3" /><span>{format(event.startDate, 'MMM dd, h:mm a')}</span>{event.source === 'xml' && <span>(Approx. 1hr duration)</span>}</div>
                                            </div>
                                        </div>
                                        </div>
                                    </div>
                                );
                                })}
                                </div>
                            ) : (
                                <p className="py-4 text-center text-sm text-muted-foreground">No {activeFilter} events to display.</p>
                            )}
                            </div>
                        )}
                    </CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
      </section>
    </div>
  );
}
