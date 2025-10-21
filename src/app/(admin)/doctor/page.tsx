'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type {
  DoctorSchedule,
  DoctorStatus,
  Patient,
  Session,
  Notification,
  SpecialClosure,
} from '@/lib/types';
import {
  updateNotificationsAction,
  updateSpecialClosuresAction,
  getDoctorScheduleAction,
  getPatientsAction,
  getDoctorStatusAction,
  setDoctorStatusAction,
} from '@/app/actions';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import { Skeleton } from '@/components/ui/skeleton';
import { DoctorHeader } from '@/components/doctor/doctor-header';
import { DoctorStatusControls } from '@/components/doctor/doctor-status-controls';
import { InfoCards } from '@/components/doctor/info-cards';
import { DoctorStats } from '@/components/doctor/doctor-stats';
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
import { Settings, SlidersHorizontal, QrCode, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DoctorQueue } from '@/components/doctor/doctor-queue';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

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
  const [isLoading, setIsLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  // ✅ Helper to determine which session a time belongs to
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

  // ✅ Load schedule, patients, status
  const loadData = useCallback(() => {
    if (initialLoad) setIsLoading(true);
    else setIsRefreshing(true);

    Promise.all([getDoctorScheduleAction(), getPatientsAction(), getDoctorStatusAction()])
      .then(([scheduleData, patientData, statusData]) => {
        setSchedule(scheduleData);
        setPatients(patientData);
        setDoctorStatus(statusData);
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
    const intervalId = setInterval(loadData, 15000); // safer interval
    return () => clearInterval(intervalId);
  }, [loadData]);

  // ✅ QR Code toggle handler
  const handleToggleQrCode = async () => {
    if (!doctorStatus) return;

    const isActivating = !doctorStatus.isQrCodeActive;
    const newToken = isActivating ? generateSecureToken() : null;

    const payload = {
      isQrCodeActive: isActivating,
      walkInSessionToken: newToken,
      qrActivatedAt: isActivating ? new Date().toISOString() : null,
    };

    const result = await setDoctorStatusAction(payload);

    if ('error' in result) {
      toast({
        title: 'Error',
        description: 'Failed to update QR code status.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: isActivating
          ? 'QR Code activated successfully. A new token has been generated.'
          : 'QR Code deactivated successfully.',
      });
      loadData();
    }
  };

  // ✅ Notification save handler
  const handleNotificationsSave = async (updatedNotifications: Notification[]) => {
    const result = await updateNotificationsAction(updatedNotifications);
    if ('error' in result) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: result.success });
      setSchedule((prev) =>
        prev ? { ...prev, notifications: updatedNotifications } : null
      );
    }
  };

  // ✅ Special closures save handler
  const handleClosuresSave = async (updatedClosures: SpecialClosure[]) => {
    if (!schedule) return;
    const result = await updateSpecialClosuresAction(updatedClosures);
    if ('error' in result) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Closure updated successfully.' });
      setSchedule((prev) =>
        prev ? { ...prev, specialClosures: updatedClosures } : null
      );
    }
  };

  // ✅ Memoized session & patient data
  const { currentSession, sessionPatients, averageConsultationTime } = useMemo(() => {
    if (!schedule || !schedule.days) {
      return { currentSession: null, sessionPatients: [], averageConsultationTime: 0 };
    }

    const now = new Date();
    const todayStr = format(toZonedTime(now, timeZone), 'yyyy-MM-dd');
    const dayOfWeek = format(toZonedTime(now, timeZone), 'EEEE') as keyof DoctorSchedule['days'];

    let daySchedule = schedule.days[dayOfWeek];
    if (!daySchedule)
      return { currentSession: null, sessionPatients: [], averageConsultationTime: 0 };

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
      if (now > morningEndTime) session = 'evening';
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
    };
  }, [schedule, patients, getSessionForTime]);

  // ✅ Loading skeleton
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

  // ✅ Final render
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

          <div className="grid gap-6 md:grid-cols-2">
            <DoctorStatusControls initialStatus={doctorStatus} onUpdate={loadData} />
            <InfoCards schedule={schedule} />
          </div>

          {/* ⚙️ Advanced Settings */}
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
                      {/* ✅ QR Code Toggle */}
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

          <DoctorQueue patients={sessionPatients} onUpdate={loadData} />
        </div>
      </main>
    </>
  );
}
