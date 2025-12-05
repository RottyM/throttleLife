import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch'; // Import the Switch component
import { MapPin, LoaderCircle } from 'lucide-react';

interface GpsStatusCardProps {
  isGpsActive: boolean;
  onToggleGps: () => void;
  isLoading: boolean;
}

export function GpsStatusCard({ isGpsActive, onToggleGps, isLoading }: GpsStatusCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">GPS Status</CardTitle>
        <MapPin className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold">
            {isGpsActive ? 'Active' : 'Inactive'}
          </div>
          <Switch
            checked={isGpsActive}
            onCheckedChange={onToggleGps}
            disabled={isLoading}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {isGpsActive ? 'Your location is being tracked.' : 'Location tracking is currently off.'}
        </p>
        {isLoading && (
          <div className="flex items-center text-sm text-muted-foreground mt-2">
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            Updating GPS status...
          </div>
        )}
      </CardContent>
    </Card>
  );
}