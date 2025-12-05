/* src/components/RouteIncidentChecker.tsx */
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MapPin, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { buildRouteMetrics, projectPointToRoute, type LatLng } from '@/lib/route-utils';

// Declare google for TypeScript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const google: any;

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

interface RouteIncidentCheckerProps {
  allEvents: TrafficEvent[];
  isLoading: boolean;
  getEventType: (event: TrafficEvent) => string;
  onRouteCalculated?: (routeData: {
    path: LatLng[];
    incidents: Array<TrafficEvent & { distanceToRouteMiles: number; routeDistanceMiles: number }>;
    totalMiles: number;
  } | null) => void;
}

type RouteIncident = TrafficEvent & { distanceToRouteMiles: number; routeDistanceMiles: number };

export const RouteIncidentChecker = ({
  allEvents,
  isLoading,
  getEventType,
  onRouteCalculated,
}: RouteIncidentCheckerProps) => {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [routeIncidents, setRouteIncidents] = useState<RouteIncident[]>([]);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeDistance, setRouteDistance] = useState<string | null>(null);
  const [routeDuration, setRouteDuration] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  const checkRouteIncidents = async () => {
    if (!origin.trim() || !destination.trim()) {
      setRouteError('Please enter both origin and destination');
      return;
    }

    setIsChecking(true);
    setRouteError(null);
    setRouteIncidents([]);
    setHasSearched(false);

    if (onRouteCalculated) {
      onRouteCalculated(null);
    }

    try {
      const directionsService = new google.maps.DirectionsService();

      directionsService.route(
        {
          origin,
          destination,
          travelMode: google.maps.TravelMode.DRIVING,
          optimizeWaypoints: false,
        },
        (result: any, status: any) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            const route = result.routes[0];
            const leg = route.legs[0];

            setRouteDistance(leg.distance.text);
            setRouteDuration(leg.duration.text);

            const path = route.overview_path;
            const routePath: LatLng[] = path.map((point: any) => ({
              lat: point.lat(),
              lng: point.lng(),
            }));
            const { cumulativeMiles, totalMiles } = buildRouteMetrics(routePath);

            // Deduplicate events by ID first
            const uniqueEvents = Array.from(new Map(allEvents.map((event) => [event.id, event])).values());

            const incidentsNearRoute: RouteIncident[] = [];
            const CORRIDOR_MILES = 0.3; // tighten corridor to reduce false positives

            uniqueEvents.forEach((event) => {
              const projection = projectPointToRoute(routePath, cumulativeMiles, {
                lat: event.latitude,
                lng: event.longitude,
              });

              if (projection.distanceToRouteMiles <= CORRIDOR_MILES) {
                incidentsNearRoute.push({
                  ...event,
                  distanceToRouteMiles: projection.distanceToRouteMiles,
                  routeDistanceMiles: projection.routeDistanceMiles,
                });
              }
            });

            incidentsNearRoute.sort((a, b) => a.routeDistanceMiles - b.routeDistanceMiles);

            setRouteIncidents(incidentsNearRoute);
            setHasSearched(true);

            if (onRouteCalculated) {
              onRouteCalculated({ path: routePath, incidents: incidentsNearRoute, totalMiles });
            }
          } else {
            setRouteError(`Could not find route: ${status}. Please check your addresses and try again.`);
            if (onRouteCalculated) {
              onRouteCalculated(null);
            }
          }
          setIsChecking(false);
        }
      );
    } catch (error: any) {
      setRouteError(`Error checking route: ${error.message}`);
      setIsChecking(false);
      if (onRouteCalculated) {
        onRouteCalculated(null);
      }
    }
  };

  const criticalCount = routeIncidents.filter((incident) => {
    const type = getEventType(incident);
    return type === 'crash' || type === 'closure';
  }).length;

  const clearRoute = () => {
    setOrigin('');
    setDestination('');
    setRouteIncidents([]);
    setRouteError(null);
    setRouteDistance(null);
    setRouteDuration(null);
    setHasSearched(false);
    if (onRouteCalculated) {
      onRouteCalculated(null);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2 text-xl">
                <MapPin className="h-5 w-5 text-primary" />
                Route Incident Checker
              </CardTitle>
              <CardDescription>
                Check for hazards and road closures along your planned route
              </CardDescription>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon">
                <ChevronDown
                  className={cn(
                    'h-5 w-5 transition-transform duration-300',
                    isOpen && 'transform rotate-180'
                  )}
                />
                <span className="sr-only">Toggle section</span>
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="origin">Starting Point</Label>
                <input
                  id="origin"
                  type="text"
                  placeholder="Enter address or location"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && checkRouteIncidents()}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  disabled={isChecking}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="destination">Destination</Label>
                <input
                  id="destination"
                  type="text"
                  placeholder="Enter address or location"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && checkRouteIncidents()}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  disabled={isChecking}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                onClick={checkRouteIncidents}
                disabled={isChecking || isLoading || !origin.trim() || !destination.trim()}
                className="w-full"
              >
                {isChecking ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent mr-2" />
                    Checking Route...
                  </>
                ) : (
                  <>
                    <MapPin className="h-4 w-4 mr-2" />
                    Check Route for Incidents
                  </>
                )}
              </Button>

              {hasSearched && (
                <Button onClick={clearRoute} variant="outline" className="w-full">
                  Clear Route
                </Button>
              )}
            </div>

            {routeError && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <p className="text-sm text-destructive font-semibold">{routeError}</p>
              </div>
            )}

            {hasSearched && !routeError && (
              <div className="space-y-4">
                <div
                  className={`rounded-lg border-2 p-4 ${
                    criticalCount > 0
                      ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20'
                      : routeIncidents.length > 0
                      ? 'border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20'
                      : 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      {criticalCount > 0 ? '!' : routeIncidents.length > 0 ? '~' : 'OK'}
                      Route Analysis
                    </h3>
                    <div className="text-xs text-muted-foreground">
                      {routeDistance} | {routeDuration}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                    <div className="text-center p-3 rounded-lg bg-background/50">
                      <div className={`text-2xl font-bold ${criticalCount > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                        {criticalCount}
                      </div>
                      <div className="text-xs text-muted-foreground">Critical</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-background/50">
                      <div className="text-2xl font-bold text-muted-foreground">
                        {routeIncidents.length - criticalCount}
                      </div>
                      <div className="text-xs text-muted-foreground">Minor</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-background/50">
                      <div className="text-2xl font-bold text-muted-foreground">
                        {routeIncidents.length}
                      </div>
                      <div className="text-xs text-muted-foreground">Total</div>
                    </div>
                  </div>

                  {criticalCount > 0 && (
                    <div className="text-sm font-semibold text-red-700 dark:text-red-400">
                      Critical incidents detected along this route. Consider alternate routes.
                    </div>
                  )}
                  {routeIncidents.length === 0 && (
                    <div className="text-sm font-semibold text-green-700 dark:text-green-400">
                      No incidents detected along this route. Safe travels!
                    </div>
                  )}
                </div>

                {routeIncidents.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-bold text-sm text-foreground">
                      Incidents Along Your Route ({routeIncidents.length})
                    </h4>
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                      {routeIncidents.map((incident) => {
                        const eventType = getEventType(incident);
                        const markerConfig = {
                          crash: { label: 'CRASH', color: 'border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/20' },
                          closure: { label: 'CLOSED', color: 'border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/20' },
                          construction: { label: 'WORK', color: 'border-orange-200 bg-orange-50/50 dark:border-orange-900/30 dark:bg-orange-950/20' },
                          blocked: { label: 'BLOCKED', color: 'border-orange-200 bg-orange-50/50 dark:border-orange-900/30 dark:bg-orange-950/20' },
                          police: { label: 'POLICE', color: 'border-blue-200 bg-blue-50/50 dark:border-blue-900/30 dark:bg-blue-950/20' },
                          weather: { label: 'WEATHER', color: 'border-gray-200 bg-gray-50/50 dark:border-gray-900/30 dark:bg-gray-950/20' },
                          hazard: { label: 'HAZARD', color: 'border-yellow-200 bg-yellow-50/50 dark:border-yellow-900/30 dark:bg-yellow-950/20' },
                        } as const;
                        const config = markerConfig[eventType as keyof typeof markerConfig] || markerConfig.hazard;

                        return (
                          <div key={incident.id} className={cn('rounded-lg border p-3 transition-all', config.color)}>
                            <div className="flex items-start gap-3">
                              <span className="text-[10px] font-semibold px-2 py-1 rounded bg-background/70 border border-muted-foreground/20">
                                {config.label}
                              </span>
                              <div className="flex-1 space-y-1">
                                <p className="font-medium text-sm leading-relaxed">{incident.description}</p>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                  <span>Ahead: {incident.routeDistanceMiles.toFixed(1)} mi</span>
                                  <span>Offset: {incident.distanceToRouteMiles.toFixed(2)} mi</span>
                                  <span>When: {format(incident.startDate, 'MMM dd, h:mm a')}</span>
                                  {incident.source === 'xml' && (
                                    <span className="font-semibold text-amber-600 dark:text-amber-400">LIVE</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
