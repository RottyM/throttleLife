/* src/components/traffic-dashboard.tsx (Corrected to fix Runtime Error) */
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Construction, MapPin, Clock, AlertTriangle, Bike } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import { TrafficEvent, getEventType } from '@/lib/event-utils';
import { FilterDates } from '@/hooks/use-smartroads-data';
import { Skeleton } from '@/components/ui/skeleton';

interface TrafficDashboardProps {
    totalEventsInFilter: number;
    filterDates: FilterDates;
    dataLoading: boolean;
    plannedError: string | null;
    incidentError: string | null;
    showTraffic: boolean;
    
    // Live Incidents (XML)
    sortedLiveIncidents: TrafficEvent[];
    incidentCategoryCounts: Record<string, number>;
    now: Date;

    // Planned Events (JSON)
    plannedEvents: TrafficEvent[];
    categoryCounts: Record<string, Record<string, number>>;

    // CORE FIX: Ensure filteredSmartroadsEvents is defined in props
    filteredSmartroadsEvents: TrafficEvent[]; 
}

const getEventIconDetails = (event: TrafficEvent) => {
    const eventType = getEventType(event);
    const details = {
        crash: { icon: <AlertTriangle className="h-4 w-4 text-red-600" />, color: 'border-red-200 bg-red-50/50 hover:border-red-300 hover:bg-red-50 dark:border-red-900/30 dark:bg-red-950/20' },
        closure: { icon: <AlertTriangle className="h-4 w-4 text-red-600" />, color: 'border-red-200 bg-red-50/50 hover:border-red-300 hover:bg-red-50 dark:border-red-900/30 dark:bg-red-950/20' },
        construction: { icon: <Construction className="h-4 w-4 text-orange-600" />, color: 'border-orange-200 bg-orange-50/50 hover:border-orange-300 hover:bg-orange-50 dark:border-orange-900/30 dark:bg-orange-950/20' },
        blocked: { icon: <Construction className="h-4 w-4 text-orange-600" />, color: 'border-orange-200 bg-orange-50/50 hover:border-orange-300 hover:bg-orange-50 dark:border-orange-900/30 dark:bg-orange-950/20' },
        police: { icon: <Bike className="h-4 w-4 text-blue-600" />, color: 'border-blue-200 bg-blue-50/50 hover:border-blue-300 hover:bg-blue-50 dark:border-blue-900/30 dark:bg-blue-950/20' },
        weather: { icon: <AlertTriangle className="h-4 w-4 text-gray-600" />, color: 'border-gray-200 bg-gray-50/50 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-900/30 dark:bg-gray-950/20' },
        hazard: { icon: <AlertTriangle className="h-4 w-4 text-yellow-600" />, color: 'border-yellow-200 bg-yellow-50/50 hover:border-yellow-300 hover:bg-yellow-50 dark:border-yellow-900/30 dark:bg-yellow-950/20' },
    };
    return details[eventType as keyof typeof details] || details.hazard;
};


const TrafficDashboard: React.FC<TrafficDashboardProps> = ({
    totalEventsInFilter, filterDates, dataLoading, plannedError, incidentError, showTraffic,
    sortedLiveIncidents, incidentCategoryCounts, now,
    plannedEvents, categoryCounts, filteredSmartroadsEvents // <-- Received Here
}) => {
    
    // The main component content is wrapped in a single JSX element (a React Fragment or a div)
    return (
        <section className="mt-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Construction className="h-5 w-5 text-orange-500" />
                      Road Hazards & Construction
                      {showTraffic && (
                        <span className="ml-auto text-xs font-normal bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded-md">
                          ✓ Showing on map
                        </span>
                      )}
                      {!showTraffic && (
                        <span className="ml-auto text-xs font-normal bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-md">
                          Hidden on map
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription>
                        {filterDates.start && filterDates.end 
                          ? `Active events from ${format(filterDates.start, 'MMM dd')} to ${format(filterDates.end, 'MMM dd, yyyy')} • Same filter as map`
                          : 'Loading event dates...'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {dataLoading && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <p>Loading traffic data...</p>
                      </div>
                    )}
                    
                    {plannedError && (
                      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 mb-4">
                        <p className='text-destructive font-semibold'>Error loading Planned Events (Road Closures)</p>
                        <p className="text-sm text-muted-foreground">{plannedError}</p>
                      </div>
                    )}

                    {!dataLoading && totalEventsInFilter === 0 && !plannedError && (
                        <div className="rounded-lg border-2 border-dashed p-8 text-center">
                          <Construction className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
                          <p className='text-muted-foreground font-medium'>No road hazards or construction in the next 3 days</p>
                          <p className="text-sm text-muted-foreground mt-1">The roads are clear! 🏍️</p>
                        </div>
                    )}

                    {!dataLoading && (totalEventsInFilter > 0 || incidentError || plannedError) && (
                        <div>
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-muted-foreground">
                                  {totalEventsInFilter} {totalEventsInFilter === 1 ? 'event' : 'events'} found
                                </p>
                                {filterDates.start && filterDates.end && (
                                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-md font-medium">
                                    {format(filterDates.start, 'MMM dd')} - {format(filterDates.end, 'MMM dd')}
                                  </span>
                                )}
                              </div>
                              {showTraffic ? (
                                <p className="text-xs text-muted-foreground">
                                  Zoom to level 13+ to see {totalEventsInFilter} markers on map
                                </p>
                              ) : (
                                <p className="text-xs text-amber-600 dark:text-amber-500 font-medium">
                                  Traffic display OFF - Toggle to see events on map
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                                Matches map filter
                              </span>
                              <span>•</span>
                              <span>Events shown below are the same as map markers</span>
                            </div>
                          </div>

                          {/* --- LIVE INCIDENT SECTION (DETAILED LIST) --- */}
                          <details className="mb-4 rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 p-3" open>
                              <summary className="text-xs font-semibold text-amber-900 dark:text-amber-300 uppercase tracking-wide cursor-pointer hover:text-amber-700 dark:hover:text-amber-200 transition-colors flex items-center justify-between">
                                🚨 Live VDOT Incidents (XML)
                                {dataLoading && <div className="h-3 w-3 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />}
                                {!dataLoading && !incidentError && (
                                    <span className="text-[10px] font-bold bg-amber-200 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded">
                                        {sortedLiveIncidents.length} Incidents Found
                                    </span>
                                )}
                              </summary>
                              
                              {incidentError && (
                                <div className="mt-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                                    <p className='text-destructive font-semibold text-sm'>Error loading Live Incident Data</p>
                                    <p className="text-xs text-muted-foreground">{incidentError}</p>
                                </div>
                              )}

                              {!dataLoading && !incidentError && sortedLiveIncidents.length > 0 && (
                                <div className="mt-3 space-y-3 max-h-72 overflow-y-auto pr-2">
                                  
                                  {/* Descriptive Category Counts */}
                                  <details>
                                    <summary className="text-xs font-semibold text-amber-800 dark:text-amber-300 cursor-pointer">
                                      Category Analysis (Click to show counts)
                                    </summary>
                                    <div className="mt-1 space-y-1">
                                      {Object.entries(incidentCategoryCounts)
                                        .sort((a, b) => b[1] - a[1])
                                        .map(([category, count]) => (
                                          <div key={category} className="flex items-center justify-between text-xs bg-white dark:bg-amber-950/40 rounded px-2 py-1 border border-amber-200 dark:border-amber-900/50">
                                            <span className="font-medium text-amber-900 dark:text-amber-200">{category}</span>
                                            <span className="font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded text-[10px]">
                                              {count}
                                            </span>
                                          </div>
                                        ))}
                                        <div className="flex items-center justify-between text-xs font-bold pt-2 border-t border-amber-200 dark:border-amber-900">
                                          <span className="text-amber-900 dark:text-amber-200">Total Incidents</span>
                                          <span className="font-mono bg-amber-200 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded">
                                            {Object.values(incidentCategoryCounts).reduce((sum, count) => sum + count, 0)}
                                          </span>
                                        </div>
                                    </div>
                                  </details>

                                  <div className="pt-2 border-t border-amber-200 dark:border-amber-900 space-y-2">
                                    <p className="text-[10px] text-amber-700 dark:text-amber-400 italic">
                                      Sorted by recency (latest on top). Events older than 30 minutes fade out.
                                    </p>
                                    {sortedLiveIncidents.map(event => {
                                      const minutesOld = differenceInMinutes(now, event.startDate);
                                      // Fade out events older than 30 minutes
                                      const fadeClass = minutesOld > 30 ? 'opacity-50' : '';
                                      const IconComponent = ({ className }: { className: string }) => {
                                        const type = getEventType(event);
                                        if (type === 'crash') return <AlertTriangle className={className + ' text-red-600'} />;
                                        if (type === 'blocked') return <Construction className={className + ' text-orange-600'} />;
                                        if (type === 'police') return <Bike className={className + ' text-blue-600'} />;
                                        return <AlertTriangle className={className + ' text-amber-600'} />;
                                      };

                                      return (
                                        <div key={event.id} className={`flex items-start gap-2 text-sm transition-opacity duration-500 ${fadeClass}`}>
                                          <IconComponent className="h-4 w-4 flex-shrink-0 mt-1" />
                                          <div className="flex-1">
                                            <p className='font-medium leading-tight text-amber-900 dark:text-amber-200'>
                                              {event.description}
                                            </p>
                                            <p className="text-[10px] text-amber-700 dark:text-amber-400">
                                              {format(event.startDate, 'h:mm:ss a')} ({minutesOld} min ago)
                                            </p>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                               {!dataLoading && !incidentError && sortedLiveIncidents.length === 0 && (
                                  <p className="mt-3 text-sm text-amber-700 dark:text-amber-400 italic">No live incidents reported right now.</p>
                              )}
                          </details>
                          {/* --- END LIVE INCIDENT SECTION --- */}


                          {/* Detailed Category Breakdown for Planned Events (JSON) */}
                          <details className="mb-4 rounded-lg border bg-muted/30 p-3" open>
                            <summary className="text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground transition-colors">
                              📊 Planned Event Categories Breakdown (JSON)
                            </summary>
                            <div className="mt-2 mb-3 text-[10px] text-muted-foreground italic border-l-2 border-primary pl-2">
                              Shows category distribution for the **{plannedEvents.length} Planned Events** (JSON feed).
                            </div>
                            <div className="mt-3 space-y-3">
                              {Object.entries(categoryCounts)
                                .sort((a, b) => {
                                  const aTotal = Object.values(a[1]).reduce((sum, count) => sum + count, 0);
                                  const bTotal = Object.values(b[1]).reduce((sum, count) => sum + count, 0);
                                  return bTotal - aTotal;
                                })
                                .map(([category, subcategories]) => {
                                  const totalInCategory = Object.values(subcategories).reduce((sum, count) => sum + count, 0);
                                  return (
                                    <div key={category} className="rounded-md bg-background/50 p-2.5 border">
                                      <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-bold text-foreground">{category}</p>
                                        <span className="text-xs font-mono font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">
                                          Total: {totalInCategory}
                                        </span>
                                      </div>
                                      <div className="ml-2 space-y-1.5 border-l-2 border-muted pl-3">
                                        {Object.entries(subcategories)
                                          .sort((a, b) => b[1] - a[1])
                                          .map(([subcategory, count]) => (
                                            <div key={subcategory} className="flex items-center justify-between text-xs group">
                                              <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                                                {subcategory}
                                              </span>
                                              <span className="font-mono font-semibold text-foreground bg-muted px-1.5 py-0.5 rounded text-[10px]">
                                                {count}
                                              </span>
                                            </div>
                                          ))}
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                            
                            {/* Icon Mapping Suggestions */}
                            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md border border-blue-200 dark:border-blue-900">
                              <p className="text-xs font-semibold text-blue-900 dark:text-blue-300 mb-2">
                                💡 Icon Mapping Suggestions
                              </p>
                              <div className="text-[10px] text-blue-800 dark:text-blue-400 space-y-1">
                                <p>• <strong>WZ / Planned Event - </strong> categories → 🛠️ Construction/Orange icons</p>
                                <p>• <strong>Incident / accidentsAndIncidents</strong> (XML) → 💥 Crash/Red icons</p>
                                <p>• <strong>Closure</strong> → 🚧 Barrier/Red icons</p>
                                <p>• <strong>Police</strong> / <strong>Law Enforcement</strong> → 👮 Shield/Blue icons</p>
                                <p>• <strong>Weather</strong> → ⛈️ Weather/Gray icons</p>
                                <p>• <strong>Hazard</strong> / <strong>Debris</strong> → ⚠️ Warning/Yellow icons</p>
                              </div>
                            </div>
                          </details>

                          <div className="mb-3 pb-2 border-b-2 border-primary/20">
                            <h4 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
                              📍 Event Details
                              {showTraffic && (
                                <span className="text-xs font-normal text-green-600 dark:text-green-400">(Visible on map at zoom 13+)</span>
                              )}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              All events listed below match the map filter • {totalEventsInFilter} total events
                            </p>
                          </div>

                          <div className='space-y-3 max-h-96 overflow-y-auto pr-2'>
                            {totalEventsInFilter > 0 && filteredSmartroadsEvents.map(event => {
                              const config = getEventIconDetails(event);
                              
                              return (
                                <div key={event.id} className={`group rounded-lg border p-4 transition-all ${config.color}`}>
                                    <div className="flex items-start gap-3">
                                      <div className="flex-shrink-0 mt-0.5">
                                        {config.icon}
                                      </div>
                                      <div className="flex-1 space-y-2">
                                        <p className='font-medium text-sm leading-relaxed text-foreground'>
                                            {event.description}
                                            <span className='ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-primary/20 text-primary'>
                                                {event.source === 'xml' ? 'Live Incident' : 'Planned'}
                                            </span>
                                        </p>
                                        
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                          <div className="flex items-center gap-1">
                                            <MapPin className="h-3 w-3" />
                                            <span>{event.latitude.toFixed(4)}, {event.longitude.toFixed(4)}</span>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            <span>{format(event.startDate, 'MMM dd, h:mm a')}</span>
                                            {event.source === 'xml' && <span>(Approx. 1hr duration)</span>}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </section>
    );
};

export default TrafficDashboard;
