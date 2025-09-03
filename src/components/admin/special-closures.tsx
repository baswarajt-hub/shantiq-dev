
'use client';

import { useState, useTransition, useEffect } from 'react';
import type { SpecialClosure } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { type DayContentProps } from 'react-day-picker';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { updateSpecialClosuresAction } from '@/app/actions';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';

function CustomDayContent(props: DayContentProps) {
    const { onSessionToggle, closures } = (props.customProps || {}) as { onSessionToggle: Function, closures: SpecialClosure[] };

    const dateStr = format(props.date, 'yyyy-MM-dd');
    const closure = closures.find(c => c.date === dateStr);
    const isMorningClosed = closure?.isMorningClosed ?? false;
    const isEveningClosed = closure?.isEveningClosed ?? false;

    return (
        <div className="relative w-full h-full flex flex-col items-center justify-center">
            <div>{props.date.getDate()}</div>
            <div className="flex gap-0.5 absolute bottom-0">
                <div 
                    onClick={(e) => { e.stopPropagation(); onSessionToggle(props.date, 'morning'); }}
                    className={cn(
                        "h-3 w-3 text-[8px] leading-3 text-center font-bold rounded-sm cursor-pointer",
                        isMorningClosed ? 'bg-destructive text-destructive-foreground' : 'bg-muted/50'
                    )}
                >
                    M
                </div>
                <div 
                    onClick={(e) => { e.stopPropagation(); onSessionToggle(props.date, 'evening'); }}
                    className={cn(
                        "h-3 w-3 text-[8px] leading-3 text-center font-bold rounded-sm cursor-pointer",
                        isEveningClosed ? 'bg-destructive text-destructive-foreground' : 'bg-muted/50'
                    )}
                >
                    E
                </div>
            </div>
        </div>
    );
}

function ClientOnlyCalendar({ onDayClick, closures, onSessionToggle }: { onDayClick: (day: Date) => void, closures: SpecialClosure[], onSessionToggle: Function }) {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient) {
        return <Skeleton className="h-[298px] w-full rounded-md" />;
    }

    return (
        <Calendar
            mode="single"
            onDayClick={onDayClick}
            className="rounded-md border w-full"
            components={{ DayContent: (props) => <CustomDayContent {...props} customProps={{ onSessionToggle, closures }} /> }}
            classNames={{
              day: "h-12 w-12",
              cell: "h-12 w-12 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
            }}
        />
    );
}


export function SpecialClosures({ initialClosures }: { initialClosures: SpecialClosure[] }) {
  const [closures, setClosures] = useState<SpecialClosure[]>(initialClosures);
  const [isPending, startTransition] = useTransition();
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
          Click "M" for morning or "E" for evening under any date to toggle its closure. Red indicates the session is closed.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <ClientOnlyCalendar
            closures={closures}
            onDayClick={() => {}}
            onSessionToggle={handleSessionToggle}
        />
      </CardContent>
    </Card>
  );
}
