
'use client';

import { useState, useTransition, useEffect } from 'react';
import type { SpecialClosure, DoctorSchedule } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { type DayContentProps } from 'react-day-picker';
import { format } from 'date-fns';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WeekView } from './week-view';

const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type SpecialClosuresProps = {
  schedule: DoctorSchedule;
  onSave: (closures: SpecialClosure[]) => Promise<void>;
}

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
        return <Skeleton className="h-[450px] w-full max-w-3xl mx-auto rounded-md" />;
    }

    const disabledDays = Object.entries(schedule.days)
      .filter(([, daySchedule]) => !daySchedule.morning.isOpen && !daySchedule.evening.isOpen)
      .map(([dayName]) => dayOfWeek.indexOf(dayName))
      .map(dayIndex => ({ dayOfWeek: [dayIndex] as any[] }));


    return (
        <Calendar
            mode="single"
            onDayClick={onDayClick}
            className="rounded-md border w-full max-w-3xl"
            components={{ DayContent: (props) => <CustomDayContent {...props} customProps={{ onSessionToggle, closures, schedule }} /> }}
            classNames={{
              day: "h-20 w-20",
              cell: "h-20 w-20 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
              head_cell: "text-amber-800 font-bold rounded-md w-20 text-center text-sm",
            }}
            disabled={disabledDays}
        />
    );
}


export function SpecialClosures({ schedule, onSave }: SpecialClosuresProps) {
  const [closures, setClosures] = useState<SpecialClosure[]>(schedule.specialClosures || []);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setClosures(schedule.specialClosures || []);
  }, [schedule.specialClosures]);

  const handleSave = (currentClosures: SpecialClosure[]) => {
    setClosures(currentClosures);
    startTransition(async () => {
        await onSave(currentClosures);
    });
  }

  const handleSessionToggle = (date: Date, session: 'morning' | 'evening') => {
    if (!date) return;

    const dateStr = format(date, 'yyyy-MM-dd');
    const existingClosureIndex = closures.findIndex(c => c.date === dateStr);

    let newClosures = [...closures];

    if (existingClosureIndex > -1) {
        const updatedClosure = { ...newClosures[existingClosureIndex] };
        if (session === 'morning') updatedClosure.isMorningClosed = !updatedClosure.isMorningClosed;
        if (session === 'evening') updatedClosure.isEveningClosed = !updatedClosure.isEveningClosed;

        if (!updatedClosure.isMorningClosed && !updatedClosure.isEveningClosed && !updatedClosure.morningOverride && !updatedClosure.eveningOverride) {
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
    handleSave(newClosures);
  };
  
  const handleOverrideSave = (override: SpecialClosure) => {
    const newClosures = [...closures];
    const index = newClosures.findIndex(c => c.date === override.date);
    if (index !== -1) {
        newClosures[index] = { ...newClosures[index], ...override };
    } else {
        newClosures.push(override);
    }
    handleSave(newClosures);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Closures & Overrides</CardTitle>
        <CardDescription>
          Manage one-off closures or override standard hours for specific dates.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <Tabs defaultValue="month" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="month">Month View</TabsTrigger>
                <TabsTrigger value="week">Week View</TabsTrigger>
            </TabsList>
            <TabsContent value="month" className="pt-6">
                 <p className="text-sm text-center text-muted-foreground mb-4">
                    Click "M" for morning or "E" for evening under any date to toggle its closure. Red indicates the session is closed. Regularly closed sessions are grayed out.
                </p>
                <ClientOnlyCalendar
                    closures={closures}
                    onDayClick={() => {}}
                    onSessionToggle={handleSessionToggle}
                    schedule={schedule}
                />
            </TabsContent>
            <TabsContent value="week" className="pt-6">
                <WeekView 
                    schedule={schedule} 
                    closures={closures}
                    onOverrideSave={handleOverrideSave}
                />
            </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
