

'use client';

import { useState, useTransition, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import type { DoctorStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { LogIn, LogOut, Pause, Play, AlertTriangle } from 'lucide-react';
import { setDoctorStatusAction, updateDoctorStartDelayAction } from '@/app/actions';

interface DoctorStatusControlsProps {
  initialStatus: DoctorStatus;
  onUpdate: () => void;
}

export function DoctorStatusControls({ initialStatus, onUpdate }: DoctorStatusControlsProps) {
  const [status, setStatus] = useState<DoctorStatus>(initialStatus);
  const [delay, setDelay] = useState(initialStatus.startDelay || 0);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    setStatus(initialStatus);
     // Only update the delay from props if the user is not currently editing it.
    if (!isPending) {
      setDelay(initialStatus.startDelay || 0);
    }
  }, [initialStatus]);


  const handleToggleOnline = () => {
    startTransition(async () => {
      const isGoingOnline = !status.isOnline;
      const newStatus = { 
        isOnline: isGoingOnline,
        onlineTime: isGoingOnline ? new Date().toISOString() : undefined,
        startDelay: isGoingOnline ? 0 : delay, // Reset delay when going online
      };
      const result = await setDoctorStatusAction(newStatus);
      if (result.success) {
        toast({ title: 'Success', description: `Doctor is now ${isGoingOnline ? 'Online' : 'Offline'}.` });
        onUpdate();
      } else {
        toast({ title: 'Error', variant: 'destructive', description: "Could not update status." });
      }
    });
  };

  const handleTogglePause = () => {
    startTransition(async () => {
      const newStatus = { isPaused: !status.isPaused };
      const result = await setDoctorStatusAction(newStatus);
      if (result.success) {
        toast({ title: 'Success', description: `Queue is now ${newStatus.isPaused ? 'paused' : 'resumed'}.` });
        onUpdate();
      } else {
        toast({ title: 'Error', variant: 'destructive', description: "Could not update status." });
      }
    });
  };

  const handleUpdateDelay = () => {
    startTransition(async () => {
      const result = await updateDoctorStartDelayAction(delay);
      if (result.success) {
        toast({ title: 'Success', description: result.success });
        onUpdate();
      } else {
        toast({ title: 'Error', variant: 'destructive', description: result.error });
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status Controls</CardTitle>
        <CardDescription>Manage your availability and queue status.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
          <Label htmlFor="doctor-status" className="flex items-center text-base font-medium">
            {status.isOnline ? <LogIn className="mr-2 h-5 w-5 text-green-500" /> : <LogOut className="mr-2 h-5 w-5 text-red-500" />}
            {status.isOnline ? 'Online' : 'Offline'}
          </Label>
          <Switch id="doctor-status" checked={status.isOnline} onCheckedChange={handleToggleOnline} disabled={isPending} />
        </div>

        <div className={cn("flex items-center justify-between p-3 rounded-lg bg-muted transition-opacity", !status.isOnline && "opacity-50")}>
          <Label htmlFor="pause-queue" className="flex items-center text-base font-medium">
            {status.isPaused ? <Pause className="mr-2 h-5 w-5 text-orange-500" /> : <Play className="mr-2 h-5 w-5 text-green-500" />}
            {status.isPaused ? 'Queue Paused' : 'Queue Active'}
          </Label>
          <Switch id="pause-queue" checked={status.isPaused} onCheckedChange={handleTogglePause} disabled={isPending || !status.isOnline} />
        </div>

        <div className={cn("p-4 border rounded-lg space-y-3 transition-opacity", status.isOnline && "opacity-50")}>
          <Label htmlFor="doctor-delay" className="flex items-center text-base font-medium">
            <AlertTriangle className="mr-2 h-5 w-5 text-amber-500" />
            Announce Start Delay
          </Label>
          <p className="text-sm text-muted-foreground">Set a delay in minutes. This is only active when you are offline.</p>
          <div className="flex items-center gap-2">
            <Input
              id="doctor-delay"
              type="number"
              value={delay}
              onChange={e => setDelay(parseInt(e.target.value) || 0)}
              className="w-24"
              disabled={isPending || status.isOnline}
            />
            <Button onClick={handleUpdateDelay} disabled={isPending || status.isOnline}>Update Delay</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
