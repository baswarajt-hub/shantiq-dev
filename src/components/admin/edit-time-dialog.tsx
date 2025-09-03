'use client';

import { useState, useEffect, useTransition } from 'react';
import type { Session, SpecialClosure } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { Switch } from '../ui/switch';

type EditTimeDialogProps = {
  children: React.ReactNode;
  sessionInfo: {
    session: Session;
    sessionName: 'morning' | 'evening';
    date: Date;
  } | null;
  onSave: (override: SpecialClosure) => void;
};

export function EditTimeDialog({ children, sessionInfo, onSave }: EditTimeDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSessionOpen, setSessionOpen] = useState(true);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  
  useEffect(() => {
    if (sessionInfo) {
      setStartTime(sessionInfo.session.start);
      setEndTime(sessionInfo.session.end);
      setSessionOpen(sessionInfo.session.isOpen);
    }
  }, [sessionInfo, isOpen]);

  if (!sessionInfo) {
    return <>{children}</>;
  }

  const handleSave = () => {
    const dateStr = format(sessionInfo.date, 'yyyy-MM-dd');
    const closure: SpecialClosure = {
      date: dateStr,
    };

    const overrideSession = {
        start: startTime,
        end: endTime,
        isOpen: isSessionOpen
    };

    if (sessionInfo.sessionName === 'morning') {
        closure.morningOverride = overrideSession;
    } else {
        closure.eveningOverride = overrideSession;
    }

    onSave(closure);
    setIsOpen(false);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Hours for {format(sessionInfo.date, 'MMMM d, yyyy')}</DialogTitle>
          <DialogDescription>
            Override the standard {sessionInfo.sessionName} session hours for this specific day.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
           <div className="flex items-center space-x-2">
                <Switch id="is-session-open" checked={isSessionOpen} onCheckedChange={setSessionOpen} />
                <Label htmlFor="is-session-open">Session is {isSessionOpen ? "Open" : "Closed"}</Label>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="start-time">Start Time</Label>
                    <Input id="start-time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} disabled={!isSessionOpen} />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="end-time">End Time</Label>
                    <Input id="end-time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={!isSessionOpen}/>
                </div>
            </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
