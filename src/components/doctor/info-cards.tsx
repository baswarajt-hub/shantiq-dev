
'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import type { DoctorSchedule, SpecialClosure, Notification, TranslatedMessage } from "@/lib/types";
import { format, isWithinInterval, parseISO, parse } from "date-fns";
import { Bell, Megaphone, Clock } from "lucide-react";

interface InfoCardsProps {
  schedule: DoctorSchedule;
}

function TodayOverrides({ schedule }: { schedule: DoctorSchedule }) {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todayClosure = schedule.specialClosures.find(c => c.date === todayStr);

    if (!todayClosure) {
        return <p className="text-sm text-muted-foreground">Standard hours are in effect today.</p>;
    }
    
    const formatTime = (timeStr: string) => parse(timeStr, 'HH:mm', new Date()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'});

    return (
        <div className="space-y-2 text-sm">
            {todayClosure.isMorningClosed && <p className="font-semibold text-destructive">Morning session is CLOSED.</p>}
            {todayClosure.morningOverride && (
                <p><span className="font-semibold">Morning:</span> {formatTime(todayClosure.morningOverride.start)} - {formatTime(todayClosure.morningOverride.end)} (Overridden)</p>
            )}

            {todayClosure.isEveningClosed && <p className="font-semibold text-destructive">Evening session is CLOSED.</p>}
            {todayClosure.eveningOverride && (
                <p><span className="font-semibold">Evening:</span> {formatTime(todayClosure.eveningOverride.start)} - {formatTime(todayClosure.eveningOverride.end)} (Overridden)</p>
            )}
        </div>
    )
}

function ActiveNotifications({ notifications }: { notifications: Notification[] }) {
    const now = new Date();
    const active = notifications.filter(n => {
        if (!n.enabled || !n.startTime || !n.endTime) return false;
        return isWithinInterval(now, { start: parseISO(n.startTime), end: parseISO(n.endTime) });
    });

    if (active.length === 0) {
        return <p className="text-sm text-muted-foreground">No active announcements.</p>;
    }

    return (
        <div className="space-y-4">
            {active.map(n => {
                const messageText = typeof n.message === 'string' ? n.message : n.message.en;
                return (
                    <div key={n.id} className="p-3 rounded-md bg-blue-50 border border-blue-200 text-blue-800">
                        <p className="font-medium">{messageText}</p>
                        <p className="text-xs text-blue-600 mt-1">
                            Active until {format(parseISO(n.endTime!), 'h:mm a')}
                        </p>
                    </div>
                )
            })}
        </div>
    )
}

export function InfoCards({ schedule }: InfoCardsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Information</CardTitle>
        <CardDescription>View today's special settings and announcements.</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
          <AccordionItem value="item-1">
            <AccordionTrigger className="text-base">
                <div className="flex items-center gap-2">
                    <Megaphone className="h-5 w-5" />
                    Active Notifications
                </div>
            </AccordionTrigger>
            <AccordionContent>
              <ActiveNotifications notifications={schedule.notifications} />
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger className="text-base">
                 <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Today's Schedule Overrides
                </div>
            </AccordionTrigger>
            <AccordionContent>
              <TodayOverrides schedule={schedule} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
