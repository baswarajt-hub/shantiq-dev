

'use client';

import { useState, useEffect, useMemo, useCallback, useTransition } from 'react';
import type { DoctorSchedule, DoctorStatus, Patient, Session, Notification, SpecialClosure } from '@/lib/types';
import { getDoctorScheduleAction, getDoctorStatusAction, getPatientsAction, recalculateQueueWithETC, updateNotificationsAction, updateSpecialClosuresAction } from '@/app/actions';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { format, parse } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { DoctorHeader } from '@/components/doctor/doctor-header';
import { DoctorStatusControls } from '@/components/doctor/doctor-status-controls';
import { InfoCards } from '@/components/doctor/info-cards';
import { DoctorStats } from '@/components/doctor/doctor-stats';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { DoctorNotificationForm } from '@/components/doctor/doctor-notification-form';
import { SpecialClosures } from '@/components/admin/special-closures';
import { useToast } from '@/hooks/use-toast';
import { Settings, SlidersHorizontal, QrCode } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DoctorQueue } from '@/components/doctor/doctor-queue';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { setDoctorStatusAction } from '@/app/actions';

const timeZone = 'Asia/Kolkata';

export default function DoctorPage() {
  const [schedule, setSchedule] = useState<DoctorSchedule | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctorStatus, setDoctorStatus] = useState<DoctorStatus | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const getSessionForTime = useCallback((appointmentUtcDate: Date, localSchedule: DoctorSchedule) => {
    if (!localSchedule.days) return null;
    const zonedAppt = toZonedTime(appointmentUtcDate, timeZone);
    const dayOfWeek = format(zonedAppt, 'EEEE') as keyof DoctorSchedule['days'];
    const dateStr = format(zonedAppt, 'yyyy-MM-dd');
    let daySchedule = localSchedule.days[dayOfWeek];
    if (!daySchedule) return null;
    const todayOverride = localSchedule.specialClosures.find(c => c.date === dateStr);
    if (todayOverride) {
      daySchedule = {
        morning: todayOverride.morningOverride ?? daySchedule.morning,
        evening: todayOverride.eveningOverride ?? daySchedule.evening,
      };
    }

    const checkSession = (session: Session) => {
      if (!session.isOpen) return false;
      const startUtc = fromZonedTime(parse(`${dateStr} ${session.start}`, 'yyyy-MM-dd HH:mm', new Date()), timeZone);
      const endUtc = fromZonedTime(parse(`${dateStr} ${session.end}`, 'yyyy-MM-dd HH:mm', new Date()), timeZone);
      const apptMs = appointmentUtcDate.getTime();
      return apptMs >= startUtc.getTime() && apptMs < endUtc.getTime();
    };

    if (checkSession(daySchedule.morning)) return 'morning';
    if (checkSession(daySchedule.evening)) return 'evening';
    return null;
  }, []);

  const loadData = useCallback(() => {
    startTransition(async () => {
      const [scheduleData, patientData, statusData] = await Promise.all([
        getDoctorScheduleAction(),
        getPatientsAction(),
        getDoctorStatusAction(),
      ]);
      setSchedule(scheduleData);
      setPatients(patientData);
      setDoctorStatus(statusData);
    });
  }, []);
  
  useEffect(() => {
    loadData();
    const intervalId = setInterval(loadData, 5000); // Poll every 5 seconds for faster updates
    return () => clearInterval(intervalId);
  }, [loadData]);

   const handleToggleQrCode = () => {
    if (!doctorStatus) return;
    startTransition(async () => {
        const result = await setDoctorStatusAction({ isQrCodeActive: !doctorStatus.isQrCodeActive });
        if (result.error) {
            toast({ title: 'Error', description: `Failed to update QR code status.`, variant: 'destructive' });
        } else {
            toast({ title: 'Success', description: `QR Code is now ${!doctorStatus.isQrCodeActive ? 'active' : 'inactive'}.` });
        }
    });
  };
  
  const handleNotificationsSave = async (updatedNotifications: Notification[]) => {
    const result = await updateNotificationsAction(updatedNotifications);
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: result.success });
      setSchedule(prev => prev ? { ...prev, notifications: updatedNotifications } : null);
    }
  };

  const handleClosuresSave = async (updatedClosures: SpecialClosure[]) => {
     if (!schedule) return;
    const result = await updateSpecialClosuresAction(updatedClosures);
     if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
        toast({ title: 'Success', description: 'Closure updated successfully.' });
        setSchedule(prev => prev ? { ...prev, specialClosures: updatedClosures } : null);
    }
  };

  const { currentSession, sessionPatients, averageConsultationTime } = useMemo(() => {
    if (!schedule || !schedule.days) {
      return { currentSession: null, sessionPatients: [], averageConsultationTime: 0 };
    }
    const now = new Date();
    const todayStr = format(toZonedTime(now, timeZone), 'yyyy-MM-dd');
    const dayOfWeek = format(toZonedTime(now, timeZone), 'EEEE') as keyof DoctorSchedule['days'];

    let daySchedule = schedule.days[dayOfWeek];
    if (!daySchedule) return { currentSession: null, sessionPatients: [], averageConsultationTime: 0 };

    const todayOverride = schedule.specialClosures.find(c => c.date === todayStr);
    if (todayOverride) {
      daySchedule = {
        morning: todayOverride.morningOverride ?? daySchedule.morning,
        evening: todayOverride.eveningOverride ?? daySchedule.evening,
      };
    }
    
    let session: 'morning' | 'evening' = 'morning';

    if (daySchedule.morning.isOpen) {
        const morningEndTime = parse(daySchedule.morning.end, 'HH:mm', now);
        // If current time is past morning session end time, switch to evening
        if (now > morningEndTime) {
            session = 'evening';
        }
    } else {
        // If morning is not open, default to evening
        session = 'evening';
    }


    const filteredPatients = patients.filter(p => {
      const apptDate = new Date(p.appointmentTime);
      return format(toZonedTime(apptDate, timeZone), 'yyyy-MM-dd') === format(toZonedTime(now, timeZone), 'yyyy-MM-dd') &&
             getSessionForTime(apptDate, schedule) === session;
    });

    const completedWithTime = filteredPatients.filter(p => p.status === 'Completed' && typeof p.consultationTime === 'number');
    let avgTime = schedule.slotDuration || 10;
    if (completedWithTime.length > 0) {
      const totalTime = completedWithTime.reduce((acc, p) => acc + p.consultationTime!, 0);
      avgTime = Math.round(totalTime / completedWithTime.length);
    }
    
    return { currentSession: session, sessionPatients: filteredPatients, averageConsultationTime: avgTime };

  }, [schedule, patients, getSessionForTime]);

  if (!schedule || !doctorStatus || (isPending && !patients.length)) {
    return (
      <main className="flex-1 p-4 space-y-6">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <Skeleton className="h-12 w-1/3" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </main>
    );
  }

  return (
    <>
      <DoctorHeader logoSrc={schedule.clinicDetails?.clinicLogo} clinicName={schedule.clinicDetails?.clinicName} />
      <main className="flex-1 p-4 space-y-6">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Doctor's Panel</h1>
            <p className="text-muted-foreground text-lg">
              {format(new Date(), 'EEEE, MMMM d')} - 
              <span className={cn("font-semibold", currentSession === 'morning' ? 'text-amber-600' : 'text-blue-600')}>
                {currentSession === 'morning' ? ' Morning Session' : ' Evening Session'}
              </span>
            </p>
          </div>
          
          <DoctorStats patients={sessionPatients} averageConsultationTime={averageConsultationTime} />

          <div className="grid gap-6 md:grid-cols-2">
              <DoctorStatusControls initialStatus={doctorStatus} onUpdate={loadData} />
              <InfoCards schedule={schedule} />
          </div>
          
          <Card>
              <CardContent className="p-0">
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1">
                      <AccordionTrigger className="px-6 text-lg font-semibold">
                          <div className="flex items-center gap-2">
                              <SlidersHorizontal className="h-5 w-5" />
                              Advanced Settings
                          </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-4 md:p-6 pt-2 bg-muted/50">
                          <div className="space-y-6">
                              <div className='flex items-center space-x-2 p-3 rounded-lg bg-background'>
                                 <Label htmlFor="qr-code-status" className={cn('flex items-center text-base font-medium')}>
                                    <QrCode className={cn("mr-2 h-5 w-5", doctorStatus.isQrCodeActive ? "text-green-500" : "text-red-500")} />
                                     Walk-in QR Code
                                  </Label>
                                  <Switch id="qr-code-status" checked={!!doctorStatus.isQrCodeActive} onCheckedChange={handleToggleQrCode} />
                              </div>
                             <DoctorNotificationForm 
                                initialNotifications={schedule.notifications}
                                onSave={handleNotificationsSave}
                              />
                              <SpecialClosures 
                                  schedule={schedule}
                                  onSave={handleClosuresSave}
                              />
                          </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
              </CardContent>
          </Card>
          
          <DoctorQueue patients={sessionPatients} onUpdate={loadData} />
        </div>
      </main>
    </>
  );
}

    