
'use client';

import { useState, useTransition, useEffect } from 'react';
import type { SpecialClosure, DoctorSchedule } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { type DayContentProps } from 'react-day-picker';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { updateSpecialClosuresAction } from '@/app/actions';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';

const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function CustomDayContent(props: DayContentProps) {
    const { onSessionToggle, closures, schedule } = (props.customProps || {}) as { onSessionToggle: Function, closures: SpecialClosure[], schedule: DoctorSchedule };
    const dateStr = format(props.date, 'yyyy-MM-dd');
    const closure = closures.find(c => c.date === dateStr);
    const dayName = dayOfWeek[props.date.getDay()] as keyof DoctorSchedule['days'];
    const daySchedule = schedule.days[dayName];

    const isMorningClosedBySpecial = closure?.isMorningClosed ?? false;
    const isEveningClosedBySpecial = closure?.isEveningClosed ?? false;

    const isMorningClosedByWeekly = !daySchedule.morning.isOpen;
    const isEveningClosedByWeekly = !daySchedule.evening.isOpen;

    return (
        <div className="relative w-full h-full flex flex-col items-center justify-center">
            <div className="text-lg">{props.date.getDate()}</div>
            <div className="flex gap-1 absolute bottom-1">
                <div 
                    onClick={(e) => { 
                        if (isMorningClosedByWeekly) return;
                        e.stopPropagation(); 
                        onSessionToggle(props.date, 'morning'); 
                    }}
                    className={cn(
                        "h-5 w-5 text-xs flex items-center justify-center font-bold rounded-sm",
                        isMorningClosedByWeekly ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'cursor-pointer',
                        !isMorningClosedByWeekly && (isMorningClosedBySpecial ? 'bg-destructive text-destructive-foreground' : 'bg-muted hover:bg-muted-foreground/20')
                    )}
                >
                    M
                </div>
                <div 
                    onClick={(e) => { 
                        if (isEveningClosedByWeekly) return;
                        e.stopPropagation(); 
                        onSessionToggle(props.date, 'evening'); 
                    }}
                     className={cn(
                        "h-5 w-5 text-xs flex items-center justify-center font-bold rounded-sm",
                        isEveningClosedByWeekly ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'cursor-pointer',
                        !isEveningClosedByWeekly && (isEveningClosedBySpecial ? 'bg-destructive text-destructive-foreground' : 'bg-muted hover:bg-muted-foreground/20')
                    )}
                >
                    E
                </div>
            </div>
        </div>
    );
}

function ClientOnlyCalendar({ onDayClick, closures, onSessionToggle, schedule }: { onDayClick: (day: Date) => void, closures: SpecialClosure[], onSessionToggle: Function, schedule: DoctorSchedule }) {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient) {
        return <Skeleton className="h-[350px] w-full max-w-2xl mx-auto rounded-md" />;
    }

    const disabledDays = Object.entries(schedule.days)
      .filter(([, daySchedule]) => !daySchedule.morning.isOpen && !daySchedule.evening.isOpen)
      .map(([dayName]) => dayOfWeek.indexOf(dayName))
      .map(dayIndex => ({ dayOfWeek: [dayIndex] }));


    return (
        <Calendar
            mode="single"
            onDayClick={onDayClick}
            className="rounded-md border w-full max-w-2xl"
            components={{ DayContent: (props) => <CustomDayContent {...props} customProps={{ onSessionToggle, closures, schedule }} /> }}
            classNames={{
              day: "h-16 w-16",
              cell: "h-16 w-16 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
            }}
            disabled={disabledDays}
        />
    );
}


export function SpecialClosures({ initialSchedule }: { initialSchedule: DoctorSchedule }) {
  const [closures, setClosures] = useState<SpecialClosure[]>(initialSchedule.specialClosures || []);
  const [, startTransition] = useTransition();
  const { toast } = useToast();

  const handleSessionToggle = (date: Date, session: 'morning' | 'evening') => {
    if (!date) return;

    const dateStr = format(date, 'yyyy-MM-dd');
    const existingClosureIndex = closures.findIndex(c => c.date === dateStr);

    let newClosures = [...closures];

    if (existingClosureIndex > -1) {
        const updatedClosure = { ...newClosures[existingClosureIndex] };
        if (session === 'morning') updatedClosure.isMorningClosed = !updatedClosure.isMorningClosed;
        if (session === 'evening') updatedClosure.isEveningClosed = !updatedClosure.isEveningClosed;

        if (!updatedClosure.isMorningClosed && !updatedClosure.isEveningClosed) {
            newClosures.splice(existingClosureIndex, 1);
        } else {
            newClosures[existingClosureIndex] = updatedClosure;
        }
    } else {
        newClosures.push({
            date: dateStr,
            isMorningClosed: session === 'morning',
            isEveningClosed: session === 'evening',
        });
    }
    setClosures(newClosures);
    handleSave(newClosures);
  };
  
  const handleSave = (currentClosures: SpecialClosure[]) => {
    startTransition(async () => {
        const result = await updateSpecialClosuresAction(currentClosures);
        if (result.error) {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        } else {
            toast({ title: 'Success', description: result.success });
        }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Special Closures</CardTitle>
        <CardDescription>
          Click "M" for morning or "E" for evening under any date to toggle its closure. Red indicates the session is closed. Regularly closed sessions are grayed out.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <ClientOnlyCalendar
            closures={closures}
            onDayClick={() => {}}
            onSessionToggle={handleSessionToggle}
            schedule={initialSchedule}
        />
      </CardContent>
    </Card>
  );
}
