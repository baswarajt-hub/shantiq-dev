
'use client';

import { useState, useTransition, useEffect } from 'react';
import type { SpecialClosure } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Calendar } from '../ui/calendar';
import { format, parseISO } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import { updateSpecialClosuresAction } from '@/app/actions';
import { Skeleton } from '../ui/skeleton';

function ClientOnlyCalendar({ selected, onDayClick, modifiers, modifiersClassNames }: { selected: Date | undefined, onDayClick: (day: Date) => void, modifiers: any, modifiersClassNames: any }) {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient) {
        return <Skeleton className="h-[298px] w-[350px] rounded-md" />;
    }

    return (
        <Calendar
            mode="single"
            selected={selected}
            onDayClick={onDayClick}
            className="rounded-md border"
            modifiers={modifiers}
            modifiersClassNames={modifiersClassNames}
        />
    );
}


export function SpecialClosures({ initialClosures }: { initialClosures: SpecialClosure[] }) {
  const [closures, setClosures] = useState<SpecialClosure[]>(initialClosures);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
  };

  const handleClosureChange = (session: 'morning' | 'evening', isOpen: boolean) => {
    if (!selectedDate) return;

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const existingClosureIndex = closures.findIndex(c => c.date === dateStr);

    let newClosures = [...closures];

    if (existingClosureIndex > -1) {
      const updatedClosure = { ...newClosures[existingClosureIndex] };
      if (session === 'morning') updatedClosure.isMorningClosed = !isOpen;
      if (session === 'evening') updatedClosure.isEveningClosed = !isOpen;
      
      if (!updatedClosure.isMorningClosed && !updatedClosure.isEveningClosed) {
        newClosures.splice(existingClosureIndex, 1);
      } else {
        newClosures[existingClosureIndex] = updatedClosure;
      }
    } else if (!isOpen) {
      newClosures.push({
        date: dateStr,
        isMorningClosed: session === 'morning' ? !isOpen : false,
        isEveningClosed: session === 'evening' ? !isOpen : false,
      });
    }
    setClosures(newClosures);
  };
  
  const handleSave = () => {
    startTransition(async () => {
        const result = await updateSpecialClosuresAction(closures);
        if (result.error) {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        } else {
            toast({ title: 'Success', description: result.success });
            setSelectedDate(undefined);
        }
    });
  }

  const selectedClosure = selectedDate ? closures.find(c => c.date === format(selectedDate, 'yyyy-MM-dd')) : undefined;
  const isMorningOpen = !(selectedClosure?.isMorningClosed ?? false);
  const isEveningOpen = !(selectedClosure?.isEveningClosed ?? false);
  
  const modifiers = {
    fullyClosed: closures
      .filter(c => c.isMorningClosed && c.isEveningClosed)
      .map(c => parseISO(c.date)),
    morningClosed: closures
      .filter(c => c.isMorningClosed && !c.isEveningClosed)
      .map(c => parseISO(c.date)),
    eveningClosed: closures
      .filter(c => !c.isMorningClosed && c.isEveningClosed)
      .map(c => parseISO(c.date)),
  };

  const modifiersClassNames = {
    morningClosed: 'day-morning-closed',
    eveningClosed: 'day-evening-closed',
    fullyClosed: 'day-fully-closed',
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle>Special Closures</CardTitle>
        <CardDescription>
          Select a date to mark it as closed for either morning, evening, or the entire day.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <Popover open={!!selectedDate} onOpenChange={(open) => !open && setSelectedDate(undefined)}>
            <PopoverTrigger asChild>
                <div>
                    <ClientOnlyCalendar
                        selected={selectedDate}
                        onDayClick={handleDayClick}
                        modifiers={modifiers}
                        modifiersClassNames={modifiersClassNames}
                    />
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="center">
                {selectedDate && (
                    <div className="space-y-4">
                        <h4 className="font-medium text-center">{format(selectedDate, 'PPP')}</h4>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between space-x-4">
                                <Label htmlFor="morning-session" className="font-semibold">Morning</Label>
                                <div className="flex items-center space-x-2">
                                    <Switch id="morning-session" checked={isMorningOpen} onCheckedChange={(checked) => handleClosureChange('morning', checked)} />
                                    <Label htmlFor="morning-session">{isMorningOpen ? 'Open' : 'Closed'}</Label>
                                </div>
                            </div>
                            <div className="flex items-center justify-between space-x-4">
                                <Label htmlFor="evening-session" className="font-semibold">Evening</Label>
                                 <div className="flex items-center space-x-2">
                                    <Switch id="evening-session" checked={isEveningOpen} onCheckedChange={(checked) => handleClosureChange('evening', checked)} />
                                    <Label htmlFor="evening-session">{isEveningOpen ? 'Open' : 'Closed'}</Label>
                                </div>
                            </div>
                        </div>
                         <Button onClick={handleSave} disabled={isPending} className="w-full">
                            {isPending ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
      </CardContent>
    </Card>
  );
}
