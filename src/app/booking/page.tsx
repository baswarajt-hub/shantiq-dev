
'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, Clock, Eye, Ticket, User, Users, CheckCircle, Wifi, WifiOff, Bell, AlertTriangle, Megaphone, PlusCircle, List } from 'lucide-react';
import type { FamilyMember, Appointment, DoctorSchedule, Patient, DoctorStatus, Notification, TranslatedMessage } from '@/lib/types';
import { BookAppointmentDialog } from '@/components/booking/book-appointment-dialog';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { addAppointmentAction, getFamilyByPhoneAction, getPatientsAction, getDoctorScheduleAction, addNewPatientAction } from '@/app/actions';
import { format, parseISO, isToday, parse as parseDate, isWithinInterval } from 'date-fns';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AddFamilyMemberDialog } from '@/components/booking/add-family-member-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';


const getStatusBadgeClass = (status: string) => {
    switch (status) {
        case 'Booked': return 'bg-blue-100 text-blue-800';
        case 'Completed': return 'bg-green-100 text-green-800';
        case 'Cancelled': return 'bg-red-100 text-red-800';
        case 'Missed': return 'bg-yellow-100 text-yellow-800';
        case 'Waiting': return 'bg-indigo-100 text-indigo-800';
        case 'Late': return 'bg-orange-100 text-orange-800';
        default: return 'bg-gray-100 text-gray-800';
    }
}

function NotificationCard({ notifications }: { notifications?: Notification[] }) {
  const [visibleNotifications, setVisibleNotifications] = useState<Notification[]>([]);
  const [lang, setLang] = useState<'en' | 'hi' | 'te'>('en');

  useEffect(() => {
    if (notifications) {
      const checkVisibility = () => {
        const now = new Date();
        const active = notifications.filter(notification => {
          if (!notification.enabled || !notification.startTime || !notification.endTime) {
            return false;
          }
          const start = parseISO(notification.startTime);
          const end = parseISO(notification.endTime);
          return isWithinInterval(now, { start, end });
        });
        setVisibleNotifications(active);
      };

      checkVisibility();
      const interval = setInterval(checkVisibility, 60000); // Check every minute
      return () => clearInterval(interval);
    } else {
      setVisibleNotifications([]);
    }
  }, [notifications]);

  if (visibleNotifications.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {visibleNotifications.map(notification => {
          const message = typeof notification.message === 'string' 
            ? { en: notification.message } 
            : notification.message;

          return (
            <Card key={notification.id} style={{ backgroundColor: '#ffffff' }}>
              <CardHeader className="flex flex-row items-start gap-4 space-y-0 p-4 pb-2">
                <Megaphone className="h-6 w-6 text-blue-800 mt-1" />
                <div className="flex-1">
                  <CardTitle className="text-lg text-blue-800">Important Announcement</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                 <Tabs value={lang} onValueChange={(value) => setLang(value as any)} className="w-full">
                    <TabsContent value="en" className="mt-2">
                        <p className="text-base text-blue-800/90">{message.en}</p>
                    </TabsContent>
                    <TabsContent value="hi" className="mt-2">
                        <p className="text-base text-blue-800/90">{message.hi || 'Translation not available.'}</p>
                    </TabsContent>
                    <TabsContent value="te" className="mt-2">
                        <p className="text-base text-blue-800/90">{message.te || 'Translation not available.'}</p>
                    </TabsContent>
                    <TabsList className="grid w-full grid-cols-3 h-8 mt-2">
                        <TabsTrigger value="en" className="text-xs">English</TabsTrigger>
                        <TabsTrigger value="hi" className="text-xs">हिन्दी</TabsTrigger>
                        <TabsTrigger value="te" className="text-xs">తెలుగు</TabsTrigger>
                    </TabsList>
                </Tabs>
              </CardContent>
            </Card>
          )
      })}
    </div>
  );
}


export default function BookingPage() {
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [schedule, setSchedule] = useState<DoctorSchedule | null>(null);
  const [doctorStatus, setDoctorStatus] = useState<DoctorStatus | null>(null);
  const [isBookingOpen, setBookingOpen] = useState(false);
  const [isAddMemberOpen, setAddMemberOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [phone, setPhone] = useState<string|null>(null);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();


  useEffect(() => {
    const userPhone = localStorage.getItem('userPhone');
    if (!userPhone) {
      router.push('/login');
    } else {
        setPhone(userPhone);
    }
  }, [router]);
  
  const loadData = useCallback(async () => {
    const userPhone = localStorage.getItem('userPhone');
    if (!userPhone) return;

    const [familyData, patientData, scheduleData, statusRes] = await Promise.all([
      getFamilyByPhoneAction(userPhone),
      getPatientsAction(),
      getDoctorScheduleAction(),
      fetch('/api/status'),
    ]);
    
    const statusData = await statusRes.json();

    setFamily(familyData);
    setPatients(patientData);
    setSchedule(scheduleData);
    setDoctorStatus(statusData);
  }, []);

  useEffect(() => {
    if (phone) {
        startTransition(() => {
            loadData();
        });
        
        const dataPoll = setInterval(() => loadData(), 30000); // Poll every 30 seconds
        const timer = setInterval(() => setCurrentTime(new Date()), 60000); // Update time every minute
        
        return () => {
            clearInterval(dataPoll);
            clearInterval(timer);
        };
    }
  }, [phone, loadData]);

  useEffect(() => {
     if (!family.length || !patients.length) return;

    const appointmentsFromPatients = patients
        .filter(p => family.some(f => f.phone === p.phone))
        .map(p => {
            const famMember = family.find(f => f.phone === p.phone && f.name === p.name);
            const appointmentDate = parseISO(p.appointmentTime);
            return {
                id: p.id,
                familyMemberId: famMember?.id || '0',
                familyMemberName: p.name,
                date: p.appointmentTime,
                time: format(appointmentDate, 'hh:mm a'),
                status: p.status, 
                type: p.type,
                purpose: p.purpose,
                rescheduleCount: p.rescheduleCount,
                tokenNo: p.tokenNo,
            }
        });
    setAppointments(appointmentsFromPatients as Appointment[]);
  }, [patients, family]);
  
  const getTodayScheduleDetails = () => {
    if (!schedule || !doctorStatus) return null;

    const today = currentTime;
    const dayOfWeek = format(today, 'EEEE') as keyof DoctorSchedule['days'];
    const dateStr = format(today, 'yyyy-MM-dd');
    let todaySch = schedule.days[dayOfWeek];
    const todayOverride = schedule.specialClosures.find(c => c.date === dateStr);
    
    if (todayOverride) {
      todaySch = {
        morning: todayOverride.morningOverride ?? todaySch.morning,
        evening: todayOverride.eveningOverride ?? todaySch.evening,
      };
    }
    
    const formatTime = (time: string) => {
        try {
            return format(parseDate(time, 'HH:mm', new Date()), 'hh:mm a');
        } catch { return 'Invalid'; }
    };

    const processSession = (sessionName: 'morning' | 'evening') => {
      const session = todaySch[sessionName];
      const isClosedByOverride = sessionName === 'morning' ? todayOverride?.isMorningClosed : todayOverride?.isEveningClosed;

      if (!session.isOpen || isClosedByOverride) {
        return { time: 'Doctor Not Available', status: 'Closed', statusColor: 'text-red-600', isOver: true };
      }

      const timeStr = `${formatTime(session.start)} - ${formatTime(session.end)}`;
      const startTime = parseDate(session.start, 'HH:mm', today);
      const endTime = parseDate(session.end, 'HH:mm', today);
      const isOver = today > endTime;
      
      let status = 'Upcoming';
      let statusColor = 'text-gray-500';

      if (isOver) {
          status = 'Completed';
          statusColor = 'text-green-600';
      } else if (today >= startTime && doctorStatus?.isOnline) {
           status = `Online (since ${format(parseISO(doctorStatus.onlineTime!), 'hh:mm a')})`;
           statusColor = 'text-green-600';
      } else if (today >= startTime && !doctorStatus?.isOnline) {
            status = 'Offline';
            statusColor = 'text-red-600';
      }

      return { time: timeStr, status, statusColor, isOver };
    };

    return {
      morning: processSession('morning'),
      evening: processSession('evening'),
    };
  };

  const handleBookAppointment = (familyMember: FamilyMember, date: string, time: string, purpose: string) => {
     startTransition(async () => {
        const dateObj = parseDate(date, 'yyyy-MM-dd', new Date());
        const timeObj = parseDate(time, 'hh:mm a', dateObj);
        const appointmentTime = timeObj.toISOString();

        const result = await addAppointmentAction(familyMember, appointmentTime, purpose, false);
        if ("success" in result) {
            toast({ title: "Success", description: "Appointment booked."});
            if (phone) await loadData();
        } else {
            toast({ title: "Error", description: result.error, variant: 'destructive'});
        }
    });
  };

  const handleAddFamilyMember = useCallback((member: Omit<FamilyMember, 'id' | 'avatar' | 'phone'>) => {
    if (!phone) return;
    startTransition(async () => {
        const result = await addNewPatientAction({ ...member, phone });
        if("success" in result){
            toast({ title: "Success", description: "Family member added."});
            await loadData(); // Reload data to get new member
            setBookingOpen(true); // Re-open booking dialog
        } else {
            toast({ title: "Error", description: result.error || "Could not add member", variant: 'destructive'});
        }
    });
  }, [phone, toast, loadData]);
  
  const activeAppointments = appointments.filter(appt => !['Completed', 'Cancelled', 'Missed'].includes(appt.status as string));
  const todaysAppointments = activeAppointments.filter(appt => isToday(parseISO(appt.date)));

  const currentDaySchedule = getTodayScheduleDetails();
  const familyPatients = family.filter(member => !member.isPrimary);
  
  const relevantSession = (() => {
    if (!currentDaySchedule) return null;
    const now = new Date();
    const morningEndTime = currentDaySchedule.morning.time.includes('-') ? parseDate(currentDaySchedule.morning.time.split(' - ')[1], 'hh:mm a', now) : null;
    
    // If it's past morning session or morning session is closed, default to evening
    if ( (morningEndTime && now > morningEndTime) || currentDaySchedule.morning.status === 'Closed' ) {
        return 'evening';
    }
    return 'morning';
  })();
  
  const relevantSessionDetails = relevantSession === 'evening' ? currentDaySchedule?.evening : currentDaySchedule?.morning;

  // Calculate live queue for today's appointments
  const upNextPatient = patients.find(p => p.status === 'Up-Next' && isToday(parseISO(p.appointmentTime)));
  const waitingQueue = patients
    .filter(p => ['Waiting', 'Late', 'Priority'].includes(p.status) && isToday(parseISO(p.appointmentTime)) && p.id !== upNextPatient?.id)
    .sort((a, b) => {
      const timeA = a.bestCaseETC ? parseISO(a.bestCaseETC).getTime() : Infinity;
      const timeB = b.bestCaseETC ? parseISO(b.bestCaseETC).getTime() : Infinity;
      if (timeA === Infinity && timeB === Infinity) {
          return (a.tokenNo || 0) - (b.tokenNo || 0);
      }
      return timeA - timeB;
  });
  
  const liveQueue = [...waitingQueue];
  if(upNextPatient) liveQueue.unshift(upNextPatient);


  if (!phone || isPending) {
      return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <main className="flex-1 p-4 md:p-6 lg:p-8">
    <div className="mx-auto w-full max-w-6xl grid gap-8 md:grid-cols-3">
      {/* Left Column */}
      <div className="md:col-span-1 space-y-8">
        <Card style={{ backgroundColor: '#ffffff' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calendar /> Today's Schedule</CardTitle>
            <CardDescription className="font-bold text-lg text-blue-800">{format(currentTime, 'EEEE, MMMM d')}</CardDescription>
          </CardHeader>
          <CardContent>
            {currentDaySchedule ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-bold text-base">Morning:</span>
                  <div className="text-right">
                    <span className="font-semibold text-base">{currentDaySchedule.morning.time}</span>
                    <p className={cn("font-bold text-xs", currentDaySchedule.morning.statusColor)}>
                        {currentDaySchedule.morning.status.startsWith('Online') ? <span className="flex items-center justify-end gap-1"><Wifi /> Online</span> : currentDaySchedule.morning.status === 'Offline' ? <span className="flex items-center justify-end gap-1"><WifiOff /> Offline</span> : currentDaySchedule.morning.status}
                    </p>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-bold text-base">Evening:</span>
                   <div className="text-right">
                    <span className="font-semibold text-base">{currentDaySchedule.evening.time}</span>
                    <p className={cn("font-bold text-xs", currentDaySchedule.evening.statusColor)}>
                        {currentDaySchedule.evening.status.startsWith('Online') ? <span className="flex items-center justify-end gap-1"><Wifi /> Online</span> : currentDaySchedule.evening.status === 'Offline' ? <span className="flex items-center justify-end gap-1"><WifiOff /> Offline</span> : currentDaySchedule.evening.status}
                    </p>
                  </div>
                </div>
                 {doctorStatus && !doctorStatus.isOnline && doctorStatus.startDelay > 0 && relevantSessionDetails && !relevantSessionDetails.isOver && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Heads Up!</AlertTitle>
                    <AlertDescription>
                      The doctor is running late and will start the session approximately {doctorStatus.startDelay} minutes behind schedule.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ) : (
              <p>Loading schedule...</p>
            )}
          </CardContent>
        </Card>
        
        <NotificationCard notifications={schedule?.notifications} />

        <Card style={{ backgroundColor: '#ffffff' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl"><PlusCircle /> Book Your Next Visit</CardTitle>
              <CardDescription>Select a family member and find a time that works for you.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Button size="lg" onClick={() => setBookingOpen(true)} style={{ backgroundColor: '#9d4edd' }}>
                Book an Appointment
              </Button>
            </CardContent>
        </Card>
      </div>

      {/* Right Column */}
      <div className="md:col-span-2 space-y-8">
        <Card style={{ backgroundColor: '#ffffff' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><List /> Today's Appointments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {todaysAppointments.length > 0 ? todaysAppointments.map(appt => {
              let queuePosition: number | null = null;
              if (appt.status === 'Waiting') {
                const position = waitingQueue.findIndex(p => p.id === appt.id);
                // Position is 0-indexed, add 1 for display. upNext adds 1 more.
                if (position !== -1) {
                  queuePosition = position + (upNextPatient ? 2 : 1);
                }
              }

              return (
              <div key={appt.id} className="p-4 rounded-lg border bg-background flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                   <Avatar>
                      <AvatarImage src={family.find(f=> f.id === String(appt.familyMemberId))?.avatar} alt={appt.familyMemberName} data-ai-hint="person" />
                      <AvatarFallback>{appt.familyMemberName.charAt(0)}</AvatarFallback>
                    </Avatar>
                  <div>
                     <p className="font-bold text-lg">{appt.familyMemberName}</p>
                     <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                        <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {format(parseISO(appt.date), 'EEE, MMM d, yyyy')}</span>
                        <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {appt.time}</span>
                        {appt.tokenNo && <span className="flex items-center gap-1.5"><Ticket className="h-4 w-4" /> #{appt.tokenNo}</span>}
                     </div>
                     {appt.purpose && <p className="text-sm text-primary font-medium mt-1">{appt.purpose}</p>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 self-stretch justify-between">
                   <div className="flex items-center gap-2">
                     {appt.status === 'Waiting' && queuePosition !== null && (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500 text-white text-xs font-bold">
                        {queuePosition}
                      </span>
                     )}
                     <p className={`font-semibold text-sm px-2 py-1 rounded-full ${getStatusBadgeClass(appt.status as string)}`}>{appt.status}</p>
                   </div>
                   <Button asChild variant="default" size="sm" className="h-8">
                      <Link href={`/queue-status?id=${appt.id}`}><Bell className="h-3.5 w-3.5 mr-1.5" />View Queue</Link>
                   </Button>
                </div>
              </div>
              )
            }) : (
              <p className="text-muted-foreground text-center py-8">No appointments for today.</p>
            )}
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <Card asChild className="cursor-pointer hover:border-primary/50 transition-colors" style={{ backgroundColor: '#ffffff' }}>
                <Link href="/booking/family">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Users /> My Family</CardTitle>
                        <CardDescription>Manage family members and their profiles.</CardDescription>
                    </CardHeader>
                </Link>
            </Card>
            <Card asChild className="cursor-pointer hover:border-primary/50 transition-colors" style={{ backgroundColor: '#ffffff' }}>
                <Link href="/booking/my-appointments">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Calendar /> My Appointments</CardTitle>
                        <CardDescription>View and manage all your past and upcoming appointments.</CardDescription>
                    </CardHeader>
                </Link>
            </Card>
        </div>
      </div>
    </div>
    
    <BookAppointmentDialog
      isOpen={isBookingOpen}
      onOpenChange={setBookingOpen}
      familyMembers={familyPatients}
      schedule={schedule}
      onSave={handleBookAppointment}
      bookedPatients={patients}
      initialMemberId={selectedMember?.id}
      onAddNewMember={() => {
        setBookingOpen(false);
        setAddMemberOpen(true);
      }}
      onDialogClose={() => setSelectedMember(null)}
    />
     <AddFamilyMemberDialog 
        isOpen={isAddMemberOpen} 
        onOpenChange={setAddMemberOpen}
        onSave={handleAddFamilyMember} 
      />
  </main>
  );
}
