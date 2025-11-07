
'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Calendar, Clock, Users, Wifi, WifiOff, Bell, AlertTriangle,
  Megaphone, PlusCircle, List, MapPin, Phone, Mail, Globe, LogIn, LogOut, CheckCircle
} from 'lucide-react';
import type { FamilyMember, Appointment, DoctorSchedule, Patient, DoctorStatus, Notification } from '@/lib/types';
import { BookAppointmentDialog } from '@/components/booking/book-appointment-dialog';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import {
  addAppointmentAction, getFamilyByPhoneAction, getPatientsAction,
  addNewPatientAction, getDoctorStatusAction, getDoctorScheduleAction
} from '@/app/actions';
import { format, parseISO, parse, isToday, isWithinInterval } from 'date-fns';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AddFamilyMemberDialog } from '@/components/booking/add-family-member-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AppointmentActions } from '@/components/booking/appointment-actions';
import { Skeleton } from '@/components/ui/skeleton';


// ---------- Utility: status badge color ----------
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
};

// ---------- Notification Card ----------
function NotificationCard({ notifications }: { notifications?: Notification[] }) {
  const [visibleNotifications, setVisibleNotifications] = useState<Notification[]>([]);
  const [lang, setLang] = useState<'en' | 'hi' | 'te'>('en');

  useEffect(() => {
    if (!notifications) return;
    const checkVisibility = () => {
      const now = new Date();
      const active = notifications.filter(n => {
        if (!n.enabled || !n.startTime || !n.endTime) return false;
        const start = parseISO(n.startTime);
        const end = parseISO(n.endTime);
        return isWithinInterval(now, { start, end });
      });
      setVisibleNotifications(active);
    };
    checkVisibility();
    const timer = setInterval(checkVisibility, 60000);
    return () => clearInterval(timer);
  }, [notifications]);

  if (visibleNotifications.length === 0) return null;

  return (
    <div className="space-y-4">
      {visibleNotifications.map(n => (
        <Card key={n.id} className="bg-white">
          <CardHeader className="flex flex-row items-start gap-4 space-y-0 p-4 pb-2">
            <Megaphone className="h-6 w-6 text-blue-800 mt-1" />
            <div className="flex-1">
              <CardTitle className="text-lg text-blue-800">Important Announcement</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <Tabs value={lang} onValueChange={(v) => setLang(v as any)} className="w-full">
              <TabsContent value="en"><p>{(n.message as any)?.en || n.message}</p></TabsContent>
              <TabsContent value="hi"><p>{(n.message as any)?.hi || 'Translation not available.'}</p></TabsContent>
              <TabsContent value="te"><p>{(n.message as any)?.te || 'Translation not available.'}</p></TabsContent>
              <TabsList className="grid w-full grid-cols-3 h-8 mt-2">
                <TabsTrigger value="en" className="text-xs">English</TabsTrigger>
                <TabsTrigger value="hi" className="text-xs">हिन्दी</TabsTrigger>
                <TabsTrigger value="te" className="text-xs">తెలుగు</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------- Main Booking Page ----------
export default function BookingPage() {
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctorStatus, setDoctorStatus] = useState<DoctorStatus | null>(null);
  const [schedule, setSchedule] = useState<DoctorSchedule | null>(null);
  const [isBookingOpen, setBookingOpen] = useState(false);
  const [isAddMemberOpen, setAddMemberOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [phone, setPhone] = useState<string | null>(null);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Load login phone
  useEffect(() => {
    const userPhone = localStorage.getItem('userPhone');
    if (!userPhone) router.push('/login');
    else setPhone(userPhone);
  }, [router]);

  // Load data
  const loadData = useCallback(async () => {
    const userPhone = localStorage.getItem('userPhone');
    if (!userPhone) return;
    const [familyData, patientData, statusData, scheduleData] = await Promise.all([
      getFamilyByPhoneAction(userPhone),
      getPatientsAction(),
      getDoctorStatusAction(),
      getDoctorScheduleAction(),
    ]);
    setFamily(familyData);
    setPatients(patientData);
    setDoctorStatus(statusData);
    setSchedule(scheduleData);
  }, []);

  useEffect(() => {
    if (phone) {
      startTransition(() => loadData());
      const refresh = setInterval(loadData, 30000);
      const timer = setInterval(() => setCurrentTime(new Date()), 60000);
      return () => { clearInterval(refresh); clearInterval(timer); };
    }
  }, [phone, loadData]);

  // Add family member — must come before any return
  const handleAddFamilyMember = useCallback(
    (member: Omit<FamilyMember, 'id' | 'avatar' | 'phone'>) => {
      if (!phone) return;
      startTransition(async () => {
        const result = await addNewPatientAction({ ...member, phone });
        if ('error' in result) {
          toast({ title: 'Error', description: result.error || 'Could not add member', variant: 'destructive' });
        } else {
          toast({ title: 'Success', description: 'Family member added.' });
          await loadData();
          setBookingOpen(true);
        }
      });
    },
    [phone, toast, loadData]
  );

  const isLoading = !phone || isPending || !schedule;


  // Map appointments
  useEffect(() => {
    if (!family.length || !patients.length) return;
    const appts = patients
      .filter(p => family.some(f => f.phone === p.phone))
      .map(p => {
        const fam = family.find(f => f.phone === p.phone && f.name === p.name);
        const apptDate = parseISO(p.appointmentTime);
        return {
          id: p.id,
          familyMemberId: Number(fam?.id || '0'),
          familyMemberName: p.name,
          date: p.appointmentTime,
          time: format(apptDate, 'hh:mm a'),
          status: p.status,
          purpose: p.purpose,
          tokenNo: p.tokenNo,
        };
      });
    setAppointments(appts);
  }, [patients, family]);

  const getTodayScheduleDetails = () => {
    if (!schedule || !doctorStatus) return null;
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
      let status = 'Upcoming', color = 'text-gray-500', icon = Clock;
      if (today > end) { status = 'Completed'; color = 'text-green-600'; icon = CheckCircle; }
      else if (today >= start && doctorStatus?.isOnline) {
            status = `Online`;
            color = 'text-green-600';
            icon = LogIn;
       }
      else if (today >= start && !doctorStatus?.isOnline) { status = 'Offline'; color = 'text-red-600'; icon = LogOut; }
      return { time: `${formatTime(s.start)} - ${formatTime(s.end)}`, status, color, icon };
    };
    return { morning: make(todaySch.morning, 'morning'), evening: make(todaySch.evening, 'evening') };
  };

  const currentDaySchedule = getTodayScheduleDetails();
  const todaysAppointments = appointments.filter(a => isToday(parseISO(a.date)) && !['Cancelled', 'Completed'].includes(a.status));
  const familyPatients = family.filter(f => !f.isPrimary);

  const handleBookAppointment = (member: FamilyMember, date: string, time: string, purpose: string) => {
    startTransition(async () => {
      const dateObj = parse(date, 'yyyy-MM-dd', new Date());
      const timeObj = parse(time, 'hh:mm a', dateObj);
      const apptTime = timeObj.toISOString();
      const result = await addAppointmentAction(member, apptTime, purpose, false);
      if ('error' in result) toast({ title: 'Error', description: result.error, variant: 'destructive' });
      else { toast({ title: 'Success', description: 'Appointment booked.' }); if (phone) await loadData(); }
    });
  };
  
  const todaysLiveQueue = patients
    .filter(p => isToday(parseISO(p.appointmentTime)) && ['Waiting', 'Up-Next', 'Priority', 'Late'].includes(p.status))
    .sort((a, b) => (a.bestCaseETC ? parseISO(a.bestCaseETC).getTime() : Infinity) - (b.bestCaseETC ? parseISO(b.bestCaseETC).getTime() : Infinity));

  const getQueuePosition = (patientId: string) => {
    const index = todaysLiveQueue.findIndex(p => p.id === patientId);
    return index !== -1 ? index + 1 : 0;
  }

  if (isLoading) {
    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-2xl space-y-8">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        </main>
    );
  }

  return (
    <main className="flex-1 p-4 md:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        {/* 🏥 Clinic Info Card */}
        {schedule?.clinicDetails && (
          <Card className="bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-black-800 text-xl font-bold leading-snug">
                {schedule.clinicDetails.doctorName || 'Dr Baswaraj Tandur'}
              </CardTitle>
              <CardDescription className="text-blue-800 font-semibold text-base">
                {schedule.clinicDetails.clinicName || "Shanti Children's Clinic"}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-gray-700 space-y-3">
              {schedule.clinicDetails.address && (
                <p className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-1 text-blue-600" />
                  <span>{schedule.clinicDetails.address}</span>
                </p>
              )}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 text-sm">
                {schedule.clinicDetails.contactNumber && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-blue-600" />
                    <a href={`tel:${schedule.clinicDetails.contactNumber}`} className="text-blue-800 font-medium hover:underline">
                      {schedule.clinicDetails.contactNumber}
                    </a>
                  </div>
                )}
                <div className="flex flex-col sm:items-end text-sm space-y-0.5">
                  {schedule.clinicDetails.website && (
                    <p className="flex items-center gap-1.5">
                      <Globe className="h-4 w-4 text-blue-600" />
                      <a href={schedule.clinicDetails.website} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">
                        {schedule.clinicDetails.website}
                      </a>
                    </p>
                  )}
                  {schedule.clinicDetails.email && (
                    <p className="flex items-center gap-1.5">
                      <Mail className="h-4 w-4 text-blue-600" />
                      <a href={`mailto:${schedule.clinicDetails.email}`} className="text-blue-700 hover:underline">
                        {schedule.clinicDetails.email}
                      </a>
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="w-full mt-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold flex items-center justify-center gap-2"
                asChild
              >
                <a
                  href={
                    schedule.clinicDetails.googleMapsLink ||
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      schedule.clinicDetails.address || "Shanti Children's Clinic, Hyderabad"
                    )}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  🚗 Get directions
                </a>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 🕒 Today's Schedule */}
        {currentDaySchedule && (
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Calendar /> Today's Schedule</CardTitle>
              <CardDescription className="font-bold text-lg text-blue-800">{format(currentTime, 'EEEE, MMMM d')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <span className="font-bold">Morning:</span>
                <div className="text-right">
                  <p className="font-semibold">{currentDaySchedule.morning.time}</p>
                  <p className={cn("font-bold text-xs flex items-center justify-end gap-1", currentDaySchedule.morning.color)}>
                     <currentDaySchedule.morning.icon className="h-3 w-3"/> {currentDaySchedule.morning.status}
                  </p>
                </div>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="font-bold">Evening:</span>
                <div className="text-right">
                  <p className="font-semibold">{currentDaySchedule.evening.time}</p>
                   <p className={cn("font-bold text-xs flex items-center justify-end gap-1", currentDaySchedule.evening.color)}>
                     <currentDaySchedule.evening.icon className="h-3 w-3"/> {currentDaySchedule.evening.status}
                  </p>
                </div>
              </div>
              {/* ✅ DOCTOR DELAY STATUS */}
                {doctorStatus && !doctorStatus.isOnline && doctorStatus.startDelay > 0 && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Doctor is Running Late</AlertTitle>
                    <AlertDescription>
                      The session will begin with a delay of approximately{' '}
                      <strong>{doctorStatus.startDelay} minutes.</strong>
                    </AlertDescription>
                  </Alert>
      )}
      {/* ✅ END INSERT */}
            </CardContent>
          </Card>
        )}

        <NotificationCard notifications={schedule?.notifications} />

        {/* 👨‍👩‍👧 Book Next Visit */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl"><PlusCircle /> Book Your Next Visit</CardTitle>
            <CardDescription>Select a family member and find a time that works for you.</CardDescription>
          </CardHeader>
          <CardContent>
            {familyPatients.length > 0 ? familyPatients.map(m => (
              <div key={m.id} onClick={() => { setSelectedMember(m); setBookingOpen(true); }}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted cursor-pointer">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={m.avatar || ''} alt={m.name} />
                    <AvatarFallback>{m.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.gender}</p>
                  </div>
                </div>
                <Button variant="secondary" size="sm">Book</Button>
              </div>
            )) : <p className="text-center text-muted-foreground py-4">No family members added.</p>}
            <Button variant="outline" className="w-full mt-3" asChild>
              <Link href="/booking/family"><Users className="mr-2 h-4 w-4" /> Manage Family</Link>
            </Button>
          </CardContent>
        </Card>

        {/* 📅 Today's Appointments */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><List /> Today's Appointments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {todaysAppointments.length > 0 ? todaysAppointments.map(a => {
              const queuePosition = getQueuePosition(a.id);
              return (
              <div key={a.id} className="p-4 rounded-lg border flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Avatar>
                    <AvatarImage src={(family.find(f => Number(f.id) === a.familyMemberId)?.avatar || '')} alt={a.familyMemberName} />
                    <AvatarFallback>{a.familyMemberName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-bold text-lg">{a.familyMemberName}</p>
                    <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                      <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {format(parseISO(a.date), 'EEE, MMM d')}</span>
                      <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {a.time}</span>
                    </div>
                    {a.purpose && <p className="text-sm text-primary mt-1">{a.purpose}</p>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                   {['Waiting', 'Up-Next', 'Priority', 'Late'].includes(a.status) && queuePosition > 0 ? (
                      <div className="flex items-center gap-2">
                          <p className="text-sm text-muted-foreground">Queue Position</p>
                          <div className="h-8 w-8 bg-blue-100 border-2 border-blue-300 rounded-full flex items-center justify-center">
                              <span className="text-lg font-bold text-blue-800">{queuePosition}</span>
                          </div>
                      </div>
                  ) : (
                      <p className={`font-semibold text-sm px-2 py-1 rounded-full ${getStatusBadgeClass(a.status)}`}>{a.status}</p>
                  )}
                  <AppointmentActions
                    appointment={a}
                    schedule={schedule}
                    onReschedule={(x) => router.push(`/booking/my-appointments?id=${x.id}&action=reschedule`)}
                    onCancel={(id) => console.log("Cancel appointment", id)}
                  />
                </div>
              </div>
            )}) : <p className="text-center text-muted-foreground py-8">No appointments for today.</p>}
          </CardContent>
        </Card>

        {/* 🔗 My Appointments link */}
        <Link href="/booking/my-appointments" className="block">
          <Card className="cursor-pointer hover:border-primary/50 hover:bg-blue-50 transition-all bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5 text-blue-600" /> My Appointments
              </CardTitle>
              <CardDescription className="text-gray-600">
                View and manage all your past and upcoming appointments.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* ✅ Booking Dialog */}
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

      {/* ✅ Add Family Member Dialog */}
      <AddFamilyMemberDialog
        isOpen={isAddMemberOpen}
        onOpenChange={setAddMemberOpen}
        onSave={(member) => handleAddFamilyMember(member)}
      />
    </main>
  );
}
