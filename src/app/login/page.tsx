
'use client';

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
import { parseISO, isWithinInterval, parse } from 'date-fns';
import { useState, useEffect, useCallback } from 'react';

function TodayScheduleCard({ schedule, status, currentTime }: { schedule: DoctorSchedule | null; status: DoctorStatus | null, currentTime: Date }) {
  const getTodayScheduleDetails = () => {
    if (!schedule || !status) return null;
    const today = currentTime;
    const dayOfWeek = format(today, 'EEEE') as keyof DoctorSchedule['days'];
    const dateStr = format(today, 'yyyy-MM-dd');
    let todaySch = schedule.days[dayOfWeek];

    const todayOverride = schedule.specialClosures.find(c => c.date === dateStr);
    if(todayOverride) {
        todaySch = {
            morning: todayOverride.morningOverride ?? todaySch.morning,
            evening: todayOverride.eveningOverride ?? todaySch.evening,
        };
    }
    
    const formatTime = (t: string) => parse(t, 'HH:mm', new Date()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const make = (s: any, sessionName: 'morning' | 'evening') => {
      const isClosedByOverride = sessionName === 'morning' ? todayOverride?.isMorningClosed : todayOverride?.isEveningClosed;

      if (!s?.isOpen || isClosedByOverride) return { time: 'Closed', status: 'Closed', color: 'text-red-600', icon: LogOut };
      
      const start = parse(s.start, 'HH:mm', today);
      const end = parse(s.end, 'HH:mm', today);
      let sessionStatus = 'Upcoming', color = 'text-gray-500', icon = Clock;
      
      if (today > end) { 
        sessionStatus = 'Completed'; 
        color = 'text-green-600'; 
        icon = CheckCircle; 
      }
      else if (today >= start && status.isOnline) {
            sessionStatus = `Online`;
            color = 'text-green-600';
            icon = LogIn;
       }
      else if (today >= start && !status.isOnline) { 
        sessionStatus = 'Offline'; 
        color = 'text-red-600'; 
        icon = LogOut; 
      }
      return { time: `${formatTime(s.start)} - ${formatTime(s.end)}`, status: sessionStatus, color, icon };
    };
    return { morning: make(todaySch.morning, 'morning'), evening: make(todaySch.evening, 'evening') };
  };

  const currentDaySchedule = getTodayScheduleDetails();
  
  if (!schedule || !status || !currentDaySchedule) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>🗓️ Today's Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Loading schedule...</p>
        </CardContent>
      </Card>
    );
  }

  const today = toZonedTime(new Date(), 'Asia/Kolkata');

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
                <p>{currentDaySchedule.morning.time}</p>
                <p className={cn("font-bold text-xs flex items-center justify-end gap-1", currentDaySchedule.morning.color)}>
                    <currentDaySchedule.morning.icon className="h-3 w-3" /> {currentDaySchedule.morning.status}
                </p>
            </div>
        </div>
        <div className="flex justify-between items-center text-sm">
            <span className="font-semibold">Evening:</span>
            <div className="text-right">
                <p>{currentDaySchedule.evening.time}</p>
                 <p className={cn("font-bold text-xs flex items-center justify-end gap-1", currentDaySchedule.evening.color)}>
                    <currentDaySchedule.evening.icon className="h-3 w-3" /> {currentDaySchedule.evening.status}
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

function ImportantNotifications({ schedule }: { schedule: DoctorSchedule | null }) {
    if (!schedule) return null;
    const today = new Date();
    const activeNotifications = schedule.notifications.filter(n => {
        if (!n.enabled || !n.startTime || !n.endTime) return false;
        return isWithinInterval(today, { start: parseISO(n.startTime), end: parseISO(n.endTime) });
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

export default function LoginPage() {
  const [schedule, setSchedule] = useState<DoctorSchedule | null>(null);
  const [status, setStatus] = useState<DoctorStatus | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const loadData = useCallback(async () => {
    try {
      const [scheduleData, statusData] = await Promise.all([
        getDoctorScheduleAction(),
        getDoctorStatusAction(),
      ]);
      setSchedule(scheduleData);
      setStatus(statusData);
    } catch (error) {
      console.error("Failed to load login page data", error);
    }
  }, []);

  useEffect(() => {
    loadData();
    const refresh = setInterval(loadData, 30000);
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => {
      clearInterval(refresh);
      clearInterval(timer);
    };
  }, [loadData]);
  
  const logo = schedule?.clinicDetails?.clinicLogo;
  const clinicName = schedule?.clinicDetails?.clinicName;
  const doctorName = schedule?.clinicDetails?.doctorName;
  const mapsLink = schedule?.clinicDetails?.googleMapsLink;

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

        <TodayScheduleCard schedule={schedule} status={status} currentTime={currentTime} />
        
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
