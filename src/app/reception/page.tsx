
'use client';
import { useState, useEffect } from 'react';
import Header from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { Appointment, DoctorSchedule, FamilyMember } from '@/lib/types';
import { format, set } from 'date-fns';
import { BookWalkInDialog } from '@/components/reception/book-walk-in-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChevronDown, Sun, Moon } from 'lucide-react';

// Mock data, in a real app this would come from an API
const mockFamily: FamilyMember[] = [
  { id: 1, name: 'John Doe', dob: '1985-05-20', gender: 'Male', avatar: 'https://picsum.photos/id/237/200/200', clinicId: 'C101' },
  { id: 2, name: 'Jane Doe', dob: '1988-10-15', gender: 'Female', avatar: 'https://picsum.photos/id/238/200/200' },
  { id: 3, name: 'Jimmy Doe', dob: '2015-02-25', gender: 'Male', avatar: 'https://picsum.photos/id/239/200/200', clinicId: 'C101' },
];

const mockAppointments: Appointment[] = [
  { id: 1, familyMemberId: 3, familyMemberName: 'Jimmy Doe', date: new Date().toISOString(), time: '10:30 AM', status: 'Confirmed' },
  { id: 2, familyMemberId: 1, familyMemberName: 'John Doe', date: new Date().toISOString(), time: '04:00 PM', status: 'Confirmed' },
];

const mockSchedule: DoctorSchedule = {
    slotDuration: 15,
    days: {
      Monday: { morning: { start: '09:00', end: '13:00', isOpen: true }, evening: { start: '16:00', end: '19:00', isOpen: true } },
      Tuesday: { morning: { start: '09:00', end: '13:00', isOpen: true }, evening: { start: '16:00', end: '19:00', isOpen: true } },
      Wednesday: { morning: { start: '09:00', end: '13:00', isOpen: true }, evening: { start: '16:00', end: '19:00', isOpen: true } },
      Thursday: { morning: { start: '09:00', end: '13:00', isOpen: true }, evening: { start: '16:00', end: '19:00', isOpen: true } },
      Friday: { morning: { start: '09:00', end: '13:00', isOpen: true }, evening: { start: '16:00', end: '19:00', isOpen: true } },
      Saturday: { morning: { start: '10:00', end: '14:00', isOpen: true }, evening: { start: '', end: '', isOpen: false } },
      Sunday: { morning: { start: '', end: '', isOpen: false }, evening: { start: '', end: '', isOpen: false } },
    },
    specialClosures: [],
};


type TimeSlot = {
  time: string;
  isBooked: boolean;
  patientName?: string;
}

export default function ReceptionPage() {
    const [schedule, setSchedule] = useState<DoctorSchedule | null>(mockSchedule);
    const [appointments, setAppointments] = useState<Appointment[]>(mockAppointments);
    const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [isBookWalkInOpen, setBookWalkInOpen] = useState(false);
    const [selectedSession, setSelectedSession] = useState<'morning' | 'evening'>('morning');
    const [currentDate, setCurrentDate] = useState('');

    useEffect(() => {
        const currentHour = new Date().getHours();
        if (currentHour >= 14) { // 2 PM
            setSelectedSession('evening');
        }
        setCurrentDate(format(new Date(), 'EEEE, MMMM d, yyyy'));
    }, []);

    useEffect(() => {
        if (!schedule) return;

        const today = new Date();
        const dayOfWeek = format(today, 'EEEE') as keyof DoctorSchedule['days'];
        const daySchedule = schedule.days[dayOfWeek];
        const generatedSlots: TimeSlot[] = [];

        const generateSessionSlots = (session: {start: string, end: string, isOpen: boolean}) => {
            if (!session.isOpen || !session.start || !session.end) return;

            const [startHour, startMinute] = session.start.split(':').map(Number);
            const [endHour, endMinute] = session.end.split(':').map(Number);
            
            let currentTime = set(today, { hours: startHour, minutes: startMinute, seconds: 0, milliseconds: 0 });
            const endTime = set(today, { hours: endHour, minutes: endMinute, seconds: 0, milliseconds: 0 });

            while (currentTime < endTime) {
                const timeString = format(currentTime, 'hh:mm a');
                const existingAppointment = appointments.find(a => a.time === timeString && new Date(a.date).toDateString() === today.toDateString());
                
                generatedSlots.push({
                    time: timeString,
                    isBooked: !!existingAppointment,
                    patientName: existingAppointment?.familyMemberName,
                });
                currentTime.setMinutes(currentTime.getMinutes() + schedule.slotDuration);
            }
        }
        
        if (selectedSession === 'morning') {
            generateSessionSlots(daySchedule.morning);
        } else {
            generateSessionSlots(daySchedule.evening);
        }
        setTimeSlots(generatedSlots);

    }, [schedule, appointments, selectedSession]);
    
    const handleSlotClick = (time: string) => {
        const slot = timeSlots.find(s => s.time === time);
        if (slot && !slot.isBooked) {
          setSelectedSlot(time);
          setBookWalkInOpen(true);
        }
    };

    const handleBookAppointment = (familyMember: FamilyMember, time: string) => {
        const newAppointment: Appointment = {
            id: Date.now(),
            familyMemberId: familyMember.id,
            familyMemberName: familyMember.name,
            date: new Date().toISOString(),
            time: time,
            status: 'Confirmed'
        };
        setAppointments(prev => [...prev, newAppointment]);
    };

  return (
    <div className="flex flex-col min-h-screen bg-muted/40">
      <Header />
      <main className="flex-1 container mx-auto p-4 md:p-6 lg:p-8">
        <Card>
            <CardHeader className="flex flex-row items-start justify-between">
                <div>
                    <CardTitle className="text-2xl">Reception Desk - Today's Schedule</CardTitle>
                    <CardDescription>{currentDate}</CardDescription>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline">
                            {selectedSession === 'morning' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                            {selectedSession.charAt(0).toUpperCase() + selectedSession.slice(1)} Session
                            <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedSession('morning')}>
                            <Sun className="mr-2 h-4 w-4" />
                            Morning
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSelectedSession('evening')}>
                            <Moon className="mr-2 h-4 w-4" />
                            Evening
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </CardHeader>
            <CardContent>
                {timeSlots.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {timeSlots.map(slot => (
                            <Button 
                                key={slot.time}
                                variant={slot.isBooked ? 'secondary' : 'outline'}
                                className="h-auto py-3 flex flex-col items-center justify-center relative"
                                disabled={slot.isBooked}
                                onClick={() => handleSlotClick(slot.time)}
                            >
                                <span className="text-lg font-semibold">{slot.time}</span>
                                {slot.isBooked ? (
                                    <span className="text-xs text-muted-foreground">{slot.patientName}</span>
                                ) : (
                                    <span className="text-xs text-primary/80">Available</span>
                                )}
                            </Button>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 text-muted-foreground">
                        <p>This session is closed or has no available slots.</p>
                    </div>
                )}
            </CardContent>
        </Card>
        {selectedSlot && (
            <BookWalkInDialog
                isOpen={isBookWalkInOpen}
                onOpenChange={setBookWalkInOpen}
                timeSlot={selectedSlot}
                onSave={handleBookAppointment}
                mockFamily={mockFamily}
            />
        )}
      </main>
    </div>
  );
}
