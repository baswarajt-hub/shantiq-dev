
import { getDoctorScheduleAction, getDoctorStatusAction } from '@/app/actions';
import { StethoscopeIcon } from '@/components/icons';
import Image from 'next/image';
import { LoginForm } from './login-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { format, isToday } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { cn } from '@/lib/utils';
import { AlertTriangle, CalendarOff, CheckCircle, Clock, Info, LogIn, LogOut, Megaphone, Pause } from 'lucide-react';
import type { DoctorSchedule, DoctorStatus, Notification, Session } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { parseISO } from 'date-fns';

function TodayScheduleCard({ schedule, status }: { schedule: DoctorSchedule; status: DoctorStatus }) {
  const timeZone = "Asia/Kolkata";
  const today = toZonedTime(new Date(), timeZone);
  const dayOfWeek = format(today, 'EEEE') as keyof DoctorSchedule['days'];
  const dateStr = format(today, 'yyyy-MM-dd');
  
  let daySchedule = schedule.days[dayOfWeek];
  const todayOverride = schedule.specialClosures.find(c => c.date === dateStr);

  if (todayOverride) {
      daySchedule = {
          morning: todayOverride.morningOverride ?? daySchedule.morning,
          evening: todayOverride.eveningOverride ?? daySchedule.evening,
      };
  }

  const formatSession = (session: Session, sessionName: 'morning' | 'evening') => {
      const isClosedByOverride = sessionName === 'morning' ? todayOverride?.isMorningClosed : todayOverride?.isEveningClosed;

      if (!session.isOpen || isClosedByOverride) {
          return { time: 'Closed', status: 'Closed', color: 'text-red-600', icon: CalendarOff };
      }
      
      const formatTime = (t: string) => new Date(`1970-01-01T${t}`).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      
      let sessionStatus = 'Upcoming';
      let color = 'text-gray-500';
      let icon = Clock;

      const start = new Date(today.toDateString() + ' ' + session.start);
      const end = new Date(today.toDateString() + ' ' + session.end);
      
      if (today > end) {
        sessionStatus = 'Completed';
        color = 'text-green-800';
        icon = CheckCircle;
      } else if (status.isOnline && today >= start && today <= end) {
          sessionStatus = 'Online';
          color = 'text-green-600';
          icon = LogIn;
      } else if (!status.isOnline) {
          sessionStatus = 'Offline';
          color = 'text-red-600';
          icon = LogOut;
      }
      
      return { time: `${formatTime(session.start)} - ${formatTime(session.end)}`, status: sessionStatus, color, icon };
  };

  const morning = formatSession(daySchedule.morning, 'morning');
  const evening = formatSession(daySchedule.evening, 'evening');

  return (
    <Card>
      <CardHeader>
        <CardTitle>🗓️ Today's Schedule</CardTitle>
        <CardDescription>{format(today, 'EEEE, MMMM d')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between items-center text-sm">
            <span className="font-semibold">Morning:</span>
            <div className="text-right">
                <p>{morning.time}</p>
                <p className={cn("font-bold text-xs flex items-center justify-end gap-1", morning.color)}>
                    <morning.icon className="h-3 w-3" /> {morning.status}
                </p>
            </div>
        </div>
        <div className="flex justify-between items-center text-sm">
            <span className="font-semibold">Evening:</span>
            <div className="text-right">
                <p>{evening.time}</p>
                 <p className={cn("font-bold text-xs flex items-center justify-end gap-1", evening.color)}>
                    <evening.icon className="h-3 w-3" /> {evening.status}
                </p>
            </div>
        </div>
        {!status.isOnline && status.startDelay > 0 && (
          <Alert variant="destructive" className="mt-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Heads up!</AlertTitle>
            <AlertDescription>
              The doctor is running late by approximately <strong>{status.startDelay} minutes</strong>.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function ImportantNotifications({ schedule }: { schedule: DoctorSchedule }) {
    const today = new Date();
    const activeNotifications = schedule.notifications.filter(n => {
        if (!n.enabled || !n.startTime || !n.endTime) return false;
        return isToday(today) && new Date(n.startTime) <= today && new Date(n.endTime) >= today;
    });

    if (activeNotifications.length === 0) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle>📢 Important Updates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                {activeNotifications.map(n => (
                    <Alert key={n.id}>
                        <Megaphone className="h-4 w-4" />
                        <AlertTitle>Announcement</AlertTitle>
                        <AlertDescription>{typeof n.message === 'string' ? n.message : n.message.en}</AlertDescription>
                    </Alert>
                ))}
            </CardContent>
        </Card>
    );
}


export default async function LoginPage() {
  const schedule = await getDoctorScheduleAction();
  const status = await getDoctorStatusAction();
  const logo = schedule?.clinicDetails?.clinicLogo;
  const clinicName = schedule?.clinicDetails?.clinicName;
  const doctorName = schedule?.clinicDetails?.doctorName;
  const mapsLink = schedule?.clinicDetails?.googleMapsLink;
  const address = schedule?.clinicDetails?.address;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4" style={{ backgroundColor: '#e0e1ee' }}>
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          {logo && (
            <div className="flex justify-center mb-2">
              <div className="relative h-20 w-20">
                <Image src={logo} alt="Clinic Logo" fill className="object-contain" />
              </div>
            </div>
          )}
          <h1 className="text-2xl font-bold">{clinicName}</h1>
          {doctorName && <p className="text-lg font-semibold text-primary">{doctorName}</p>}
           {mapsLink && (
              <Button variant="link" asChild className="text-xs h-auto p-0 mt-1 text-red-600">
                <a href={mapsLink} target="_blank" rel="noopener noreferrer">
                  Get directions
                </a>
              </Button>
            )}
        </div>

        <TodayScheduleCard schedule={schedule} status={status} />
        
        <ImportantNotifications schedule={schedule} />

        <Card style={{ backgroundColor: 'white' }}>
            <CardHeader className="text-center">
                <CardTitle className="text-xl">Patient Portal</CardTitle>
                <CardDescription>Login with your registered phone number to book appointments & track the live queue.</CardDescription>
            </CardHeader>
          <LoginForm clinicName={clinicName} />
        </Card>
      </div>
    </div>
  );
}
