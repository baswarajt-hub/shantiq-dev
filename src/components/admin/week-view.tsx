
'use client';
import { useState } from 'react';
import {
  addDays,
  eachDayOfInterval,
  endOfWeek,
  format,
  startOfWeek,
  isPast,
  set
} from 'date-fns';
import { Button } from '../ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DoctorSchedule, SpecialClosure, Session } from '@/lib/types';
import { EditTimeDialog } from './edit-time-dialog';

type WeekViewProps = {
  schedule: DoctorSchedule;
  closures: SpecialClosure[];
  onOverrideSave: (override: SpecialClosure) => void;
};

const hours = Array.from({ length: 24 }, (_, i) => i);

export function WeekView({ schedule, closures, onOverrideSave }: WeekViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
  const end = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start, end });

  const goToPreviousWeek = () => setCurrentDate(addDays(currentDate, -7));
  const goToNextWeek = () => setCurrentDate(addDays(currentDate, 7));
  
  const getSessionForHour = (date: Date, hour: number) => {
    const dayName = format(date, 'EEEE') as keyof DoctorSchedule['days'];
    const dateStr = format(date, 'yyyy-MM-dd');

    const closure = closures.find(c => c.date === dateStr);
    const daySchedule = schedule.days[dayName];
    
    const sessions: { name: 'morning' | 'evening'; session: Session, override?: Session }[] = [
        { name: 'morning', session: daySchedule.morning, override: closure?.morningOverride },
        { name: 'evening', session: daySchedule.evening, override: closure?.eveningOverride },
    ];

    for (const { name, session, override } of sessions) {
        const isClosedBySpecial = closure?.[name === 'morning' ? 'isMorningClosed' : 'isEveningClosed'];
        const effectiveSession = override || session;

        if (effectiveSession.isOpen) {
            const startHour = parseInt(effectiveSession.start.split(':')[0], 10);
            const endHour = parseInt(effectiveSession.end.split(':')[0], 10);
            if (hour >= startHour && hour < endHour) {
                return { session: effectiveSession, sessionName: name, date, isClosed: isClosedBySpecial };
            }
        }
    }
    return null;
  }

  return (
    <div className="border rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold">
          {format(start, 'MMMM d')} - {format(end, 'MMMM d, yyyy')}
        </h2>
        <Button variant="outline" size="icon" onClick={goToNextWeek}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-[auto_1fr] overflow-auto">
        {/* Time column */}
        <div className="col-start-1 row-start-2">
          {hours.map(hour => (
            <div key={hour} className="h-12 flex items-center justify-end pr-2 text-xs text-muted-foreground">
              {format(new Date(0, 0, 0, hour), 'ha')}
            </div>
          ))}
        </div>

        {/* Schedule grid */}
        <div className="col-start-2 row-start-2 grid grid-cols-7">
          {weekDays.map((day, dayIndex) => (
            <div key={day.toString()} className={cn("border-r", dayIndex === 6 && "border-r-0")}>
              {hours.map(hour => {
                const sessionInfo = getSessionForHour(day, hour);
                const isTopCell = sessionInfo && hour === parseInt(sessionInfo.session.start.split(':')[0], 10);
                const hourDate = set(day, { hours: hour, minutes: 0 });
                const isPastHour = isPast(hourDate);

                return (
                  <EditTimeDialog 
                    key={hour}
                    sessionInfo={sessionInfo}
                    onSave={onOverrideSave}
                    disabled={isPastHour}
                  >
                    <div
                      className={cn(
                        "h-12 border-t",
                        isPastHour ? "bg-gray-100 cursor-not-allowed" : "cursor-pointer",
                        sessionInfo?.isClosed && !isPastHour && "bg-destructive/20 hover:bg-destructive/30",
                        sessionInfo && !sessionInfo.isClosed && !isPastHour && "bg-primary/20 hover:bg-primary/30",
                        !sessionInfo && !isPastHour && "hover:bg-muted/50"
                      )}
                    >
                        {isTopCell && (
                            <div className={cn("text-xs p-1 text-primary-foreground rounded-t-sm", sessionInfo?.isClosed ? 'bg-destructive' : 'bg-primary', isPastHour && 'bg-gray-400')}>
                                {sessionInfo.session.start} - {sessionInfo.session.end}
                            </div>
                        )}
                    </div>
                  </EditTimeDialog>
                );
              })}
            </div>
          ))}
        </div>

        {/* Header row */}
        <div className="col-start-2 row-start-1 grid grid-cols-7 sticky top-0 bg-background z-10">
          {weekDays.map(day => (
            <div key={day.toString()} className="text-center font-semibold py-2 border-b">
              <div>{format(day, 'EEE')}</div>
              <div className="text-2xl">{format(day, 'd')}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
