

'use client';

import { useState, useTransition, useEffect } from 'react';
import type { SpecialClosure, DoctorSchedule } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { type DayContentProps } from 'react-day-picker';
import { format, isPast } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
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
    
    if (!schedule || !schedule.days) {
        // Render nothing if schedule or schedule.days is not available
        return <div className="relative w-full h-full flex flex-col items-center justify-center">{props.date.getDate()}</div>;
    }

    const dateStr = format(props.date, 'yyyy-MM-dd');
    const closure = closures.find(c => c.date === dateStr);
    const dayName = dayOfWeek[props.date.getDay()] as keyof DoctorSchedule['days'];
    const daySchedule = schedule.days[dayName];
    
    const isPastDate = isPast(props.date) && !format(props.date, 'yyyy-MM-dd').includes(format(new Date(), 'yyyy-MM-dd'));

    const isMorningClosedBySpecial = closure?.isMorningClosed ?? false;
    const isEveningClosedBySpecial = closure?.isEveningClosed ?? false;

    const isMorningClosedByWeekly = !daySchedule.morning.isOpen;
    const isEveningClosedByWeekly = !daySchedule.evening.isOpen;

    return (
        <div className="relative w-full h-full flex flex-col items-center justify-center">
            <div className="text-sm">{props.date.getDate()}</div>
            <div className="flex gap-0.5 absolute bottom-1">
                <div 
                    onClick={(e) => { 
                        if (isMorningClosedByWeekly || isPastDate) return;
                        e.stopPropagation(); 
                        onSessionToggle(props.date, 'morning'); 
                    }}
                    className={cn(
                        "h-4 w-4 text-[10px] flex items-center justify-center font-bold rounded-sm",
                        (isMorningClosedByWeekly || isPastDate) ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'cursor-pointer',
                        !isMorningClosedByWeekly && !isPastDate && (isMorningClosedBySpecial ? 'bg-destructive text-destructive-foreground' : 'bg-muted hover:bg-muted-foreground/20')
                    )}
                >
                    M
                </div>
                <div 
                    onClick={(e) => { 
                        if (isEveningClosedByWeekly || isPastDate) return;
                        e.stopPropagation(); 
                        onSessionToggle(props.date, 'evening'); 
                    }}
                     className={cn(
                        "h-4 w-4 text-[10px] flex items-center justify-center font-bold rounded-sm",
                        (isEveningClosedByWeekly || isPastDate) ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'cursor-pointer',
                        !isEveningClosedByWeekly && !isPastDate && (isEveningClosedBySpecial ? 'bg-destructive text-destructive-foreground' : 'bg-muted hover:bg-muted-foreground/20')
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

    if (!isClient || !schedule.days) {
        return <Skeleton className="h-[350px] w-full max-w-sm mx-auto rounded-md" />;
    }

    const disabledDays: any[] = [{ before: new Date(new Date().setDate(new Date().getDate())) }];
    
    if (schedule.days) {
        Object.entries(schedule.days)
          .filter(([, daySchedule]) => !daySchedule.morning.isOpen && !daySchedule.evening.isOpen)
          .forEach(([dayName]) => {
              const dayIndex = dayOfWeek.indexOf(dayName);
              if (dayIndex !== -1) {
                  disabledDays.push({ dayOfWeek: [dayIndex] });
              }
          });

        schedule.specialClosures.forEach(closure => {
            if (closure.isMorningClosed && closure.isEveningClosed) {
                disabledDays.push(new Date(closure.date + 'T00:00:00'));
            }
             if(closure.morningOverride && !closure.morningOverride.isOpen && closure.eveningOverride && !closure.eveningOverride.isOpen) {
                 disabledDays.push(new Date(closure.date + 'T00:00:00'));
            }
        });
    }

    return (
        <div className="flex justify-center">
            <Calendar
                mode="single"
                onDayClick={onDayClick}
                className="rounded-md border p-0"
                components={{ DayContent: (props) => <CustomDayContent {...props} customProps={{ onSessionToggle, closures, schedule }} /> }}
                classNames={{
                    months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
                    month: 'space-y-4',
                    caption: 'flex justify-center pt-1 relative items-center text-sm',
                    caption_label: 'text-sm font-medium',
                    nav: 'space-x-1 flex items-center',
                    nav_button: 'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100',
                    nav_button_previous: 'absolute left-1',
                    nav_button_next: 'absolute right-1',
                    table: 'w-full border-collapse space-y-1',
                    head_row: 'flex',
                    head_cell: 'text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]',
                    row: 'flex w-full mt-2',
                    cell: 'h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20',
                    day: 'h-9 w-9 p-0 font-normal aria-selected:opacity-100',
                    day_selected: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
                    day_today: 'bg-accent text-accent-foreground',
                    day_outside: 'text-muted-foreground opacity-50',
                    day_disabled: 'text-muted-foreground opacity-50',
                    day_range_middle: 'aria-selected:bg-accent aria-selected:text-accent-foreground',
                    day_hidden: 'invisible',
                }}
                disabled={disabledDays}
            />
        </div>
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
          Manage one-off closures or override standard hours for specific dates. Past dates cannot be edited.
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

    