
'use client';

import { useState, useEffect, useTransition } from 'react';
import type { DoctorSchedule, Session, SpecialClosure } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';

type AdjustTimingDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  schedule: DoctorSchedule;
  onSave: (override: SpecialClosure) => void;
};

export function AdjustTimingDialog({ isOpen, onOpenChange, schedule, onSave }: AdjustTimingDialogProps) {
  const [morningSession, setMorningSession] = useState<Session>({ start: '', end: '', isOpen: false });
  const [eveningSession, setEveningSession] = useState<Session>({ start: '', end: '', isOpen: false });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    // Only set the state when the dialog is opened, not on every re-render caused by prop changes.
    if (isOpen && schedule) {
      const today = new Date();
      const dayName = format(today, 'EEEE') as keyof DoctorSchedule['days'];
      const todayStr = format(today, 'yyyy-MM-dd');
      
      const todayOverride = schedule.specialClosures.find(c => c.date === todayStr);
      
      setMorningSession(todayOverride?.morningOverride ?? schedule.days[dayName].morning);
      setEveningSession(todayOverride?.eveningOverride ?? schedule.days[dayName].evening);
    }
  }, [isOpen, schedule]); // Depend only on `isOpen` to prevent overwriting user input.

  const handleSave = () => {
    startTransition(() => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const override: SpecialClosure = {
            date: todayStr,
            morningOverride: morningSession,
            eveningOverride: eveningSession
        };
        onSave(override);
        onOpenChange(false);
    })
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Timings for Today</DialogTitle>
          <DialogDescription>
            Override the standard clinic hours for today. These changes will only apply to {format(new Date(), 'MMMM d, yyyy')}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
            <div className="space-y-4 p-4 border rounded-md">
                <h3 className="font-semibold text-lg">Morning Session</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="morning-start">Start Time</Label>
                        <Input id="morning-start" type="time" value={morningSession.start} onChange={(e) => setMorningSession(p => ({...p, start: e.target.value}))} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="morning-end">End Time</Label>
                        <Input id="morning-end" type="time" value={morningSession.end} onChange={(e) => setMorningSession(p => ({...p, end: e.target.value}))} />
                    </div>
                </div>
            </div>
             <div className="space-y-4 p-4 border rounded-md">
                <h3 className="font-semibold text-lg">Evening Session</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="evening-start">Start Time</Label>
                        <Input id="evening-start" type="time" value={eveningSession.start} onChange={(e) => setEveningSession(p => ({...p, start: e.target.value}))} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="evening-end">End Time</Label>
                        <Input id="evening-end" type="time" value={eveningSession.end} onChange={(e) => setEveningSession(p => ({...p, end: e.target.value}))} />
                    </div>
                </div>
            </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending}>{isPending ? 'Saving...' : 'Save Changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
