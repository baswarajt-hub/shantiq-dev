
'use client';

import { useState, useEffect, useMemo, useCallback, useTransition } from 'react';
import type {
  DoctorSchedule,
  DoctorStatus,
  Patient,
  Session,
  Notification,
  SpecialClosure,
  FamilyMember,
} from '@/lib/types';
import {
  updateNotificationsAction,
  updateSpecialClosuresAction,
  getDoctorScheduleAction,
  getPatientsAction,
  getDoctorStatusAction,
  setDoctorStatusAction,
  getFamilyAction,
  rescheduleAppointmentAction,
  consultNextAction,
} from '@/app/actions';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';
import { parse } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { DoctorHeader } from '@/components/doctor/doctor-header';
import { DoctorStatusControls } from '@/components/doctor/doctor-status-controls';
import { InfoCards } from '@/components/doctor/info-cards';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { DoctorNotificationForm } from '@/components/doctor/doctor-notification-form';
import { SpecialClosures } from '@/components/admin/special-closures';
import { useToast } from '@/hooks/use-toast';
import { Settings, SlidersHorizontal, QrCode, RefreshCw, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DoctorQueue } from '@/components/doctor/doctor-queue';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const timeZone = 'Asia/Kolkata';

// 🔐 Helper to generate random secure tokens
function generateSecureToken(prefix = 'walkin') {
  const randomPart = Math.random().toString(36).substring(2, 10);
  const timePart = Date.now().toString(36);
  return `${prefix}_${randomPart}${timePart}`;
}

export default function DoctorPage() {
  const [schedule, setSchedule] = useState<DoctorSchedule | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctorStatus, setDoctorStatus] = useState<DoctorStatus | null>(null);
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const getSessionForTime = useCallback((appointmentUtcDate: Date, localSchedule: DoctorSchedule) => {
    if (!localSchedule.days) return null;
    const zonedAppt = toZonedTime(appointmentUtcDate, timeZone);
    const dayOfWeek = format(zonedAppt, 'EEEE') as keyof DoctorSchedule['days'];
    const dateStr = format(zonedAppt, 'yyyy-MM-dd');

    let daySchedule = localSchedule.days[dayOfWeek];
    if (!daySchedule) return null;

    const todayOverride = localSchedule.specialClosures?.find((c) => c.date === dateStr);
    if (todayOverride) {
      daySchedule = {
        morning: todayOverride.morningOverride ?? daySchedule.morning,
        evening: todayOverride.eveningOverride ?? daySchedule.evening,
      };
    }

    const checkSession = (session: Session) => {
      if (!session.isOpen || !session.start || !session.end) return false;

      const startUtc = fromZonedTime(
        parse(`${dateStr} ${session.start}`, 'yyyy-MM-dd HH:mm', new Date()),
        timeZone
      );
      const endUtc = fromZonedTime(
        parse(`${dateStr} ${session.end}`, 'yyyy-MM-dd HH:mm', new Date()),
        timeZone
      );

      const apptMs = appointmentUtcDate.getTime();
      return apptMs >= startUtc.getTime() && apptMs < endUtc.getTime();
    };

    if (checkSession(daySchedule.morning)) return 'morning';
    if (checkSession(daySchedule.evening)) return 'evening';
    return null;
  }, []);

  const loadData = useCallback(() => {
    if (initialLoad) setIsLoading(true);
    else setIsRefreshing(true);

    Promise.all([
      getDoctorScheduleAction(),
      getPatientsAction(),
      getDoctorStatusAction(),
      getFamilyAction(),
    ])
      .then(([scheduleData, patientData, statusData, familyData]) => {
        setSchedule(scheduleData);
        setPatients(patientData);
        setDoctorStatus(statusData);
        setFamily(familyData);
      })
      .catch((error) => {
        console.error('Failed to load data for Doctor page', error);
        toast({
          title: 'Error',
          description: 'Failed to load clinic data.',
          variant: 'destructive',
        });
      })
      .finally(() => {
        if (initialLoad) setIsLoading(false);
        setInitialLoad(false);
        setIsRefreshing(false);
      });
  }, [initialLoad, toast]);

  useEffect(() => {
    loadData();
    const intervalId = setInterval(loadData, 15000);
    return () => clearInterval(intervalId);
  }, [loadData]);
  
  const handleAction = (action: () => Promise<any>, successMessage: string) => {
    startTransition(async () => {
      const result = await action();
      if ("success" in result) {
        toast({ title: 'Success', description: successMessage });
        loadData();
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    });
  };

  const handleToggleQrCode = () => {
    if (!doctorStatus) return;
    const isActivating = !doctorStatus.isQrCodeActive;
    handleAction(
      () => setDoctorStatusAction({ 
        isQrCodeActive: isActivating, 
        walkInSessionToken: isActivating ? generateSecureToken() : null,
        qrSessionStartTime: isActivating ? new Date().toISOString() : null,
      }),
      isActivating ? 'QR Code activated successfully.' : 'QR Code deactivated successfully.'
    );
  };

  const handleNotificationsSave = (updatedNotifications: Notification[]) => handleAction(() => updateNotificationsAction(updatedNotifications), 'Notifications updated successfully.');
  const handleClosuresSave = (updatedClosures: SpecialClosure[]) => handleAction(() => updateSpecialClosuresAction(updatedClosures), 'Closures updated successfully.');
  const handleConsultNext = () => handleAction(consultNextAction, 'Queue advanced.');


  const { currentSession, sessionPatients, averageConsultationTime, nowServing, upNext } = useMemo(() => {
    if (!schedule || !schedule.days) {
      return { currentSession: null, sessionPatients: [], averageConsultationTime: 0, nowServing: undefined, upNext: undefined };
    }

    const now = new Date();
    const todayStr = format(toZonedTime(now, timeZone), 'yyyy-MM-dd');
    const dayOfWeek = format(toZonedTime(now, timeZone), 'EEEE') as keyof DoctorSchedule['days'];

    let daySchedule = schedule.days[dayOfWeek];
    if (!daySchedule)
      return { currentSession: null, sessionPatients: [], averageConsultationTime: 0, nowServing: undefined, upNext: undefined };

    const todayOverride = schedule.specialClosures?.find((c) => c.date === todayStr);
    if (todayOverride) {
      daySchedule = {
        morning: todayOverride.morningOverride ?? daySchedule.morning,
        evening: todayOverride.eveningOverride ?? daySchedule.evening,
      };
    }

    let session: 'morning' | 'evening' = 'morning';
    if (daySchedule.morning.isOpen) {
      const morningEndTime = parse(daySchedule.morning.end, 'HH:mm', now);
      if (now > morningEndTime && daySchedule.evening.isOpen) session = 'evening';
    } else {
      session = 'evening';
    }

    const filteredPatients = patients.filter((p) => {
      const apptDate = new Date(p.appointmentTime);
      return (
        format(toZonedTime(apptDate, timeZone), 'yyyy-MM-dd') ===
          format(toZonedTime(now, timeZone), 'yyyy-MM-dd') &&
        getSessionForTime(apptDate, schedule) === session
      );
    });

    const completedWithTime = filteredPatients.filter(
      (p) => p.status === 'Completed' && typeof p.consultationTime === 'number'
    );
    let avgTime = schedule.slotDuration || 10;
    if (completedWithTime.length > 0) {
      const totalTime = completedWithTime.reduce((acc, p) => acc + p.consultationTime!, 0);
      avgTime = Math.round(totalTime / completedWithTime.length);
    }

    return {
      currentSession: session,
      sessionPatients: filteredPatients,
      averageConsultationTime: avgTime,
      nowServing: filteredPatients.find(p => p.status === 'In-Consultation'),
      upNext: filteredPatients.find(p => p.status === 'Up-Next'),
    };
  }, [schedule, patients, getSessionForTime]);

  if (isLoading || !schedule || !doctorStatus) {
    return (
      <div className="flex flex-col min-h-screen">
        <DoctorHeader
          logoSrc={schedule?.clinicDetails?.clinicLogo}
          clinicName={schedule?.clinicDetails?.clinicName}
        />
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
      </div>
    );
  }

  return (
    <>
      <DoctorHeader
        logoSrc={schedule.clinicDetails?.clinicLogo}
        clinicName={schedule.clinicDetails?.clinicName}
      />
      <main className="flex-1 p-4 space-y-6">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              Doctor&apos;s Panel
              {isRefreshing && (
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              )}
            </h1>
            <p className="text-muted-foreground text-lg">
              {format(new Date(), 'EEEE, MMMM d')} -
              <span
                className={cn(
                  'font-semibold',
                  currentSession === 'morning' ? 'text-amber-600' : 'text-blue-600'
                )}
              >
                {currentSession === 'morning' ? ' Morning Session' : ' Evening Session'}
              </span>
            </p>
          </div>

          <DoctorStats
            patients={sessionPatients}
            averageConsultationTime={averageConsultationTime}
          />
          
          {upNext && doctorStatus.isOnline && (
            <Card className="bg-blue-100 border-blue-300">
              <CardContent className="p-4 flex items-center justify-between">
                <div className='flex items-center gap-3'>
                  <span className='font-bold text-lg text-blue-800'>Up Next:</span>
                  <span className='font-semibold text-lg'>#{upNext.tokenNo} - {upNext.name}</span>
                </div>
                <Button onClick={handleConsultNext} disabled={isPending}>
                  <ChevronsRight className="mr-2 h-4 w-4" /> Consult Next
                </Button>
              </CardContent>
            </Card>
          )}

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
                      <div className="flex items-center space-x-2 p-3 rounded-lg bg-background">
                        <Label
                          htmlFor="qr-code-status"
                          className="flex items-center text-sm font-medium"
                        >
                          <QrCode
                            className={cn(
                              'mr-2 h-5 w-5',
                              doctorStatus.isQrCodeActive
                                ? 'text-green-500'
                                : 'text-red-500'
                            )}
                          />
                          Walk-in QR Code
                        </Label>
                        <Switch
                          id="qr-code-status"
                          checked={!!doctorStatus.isQrCodeActive}
                          onCheckedChange={handleToggleQrCode}
                          disabled={isPending}
                        />
                      </div>

                      <DoctorNotificationForm
                        initialNotifications={schedule.notifications}
                        onSave={handleNotificationsSave}
                      />
                      <SpecialClosures schedule={schedule} onSave={handleClosuresSave} />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          <DoctorQueue patients={sessionPatients} schedule={schedule} family={family} onUpdate={loadData} />
        </div>
      </main>
    </>
  );
}
