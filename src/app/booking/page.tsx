
'use client';

import { useState } from 'react';
import Header from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, Clock, Edit, PlusCircle, Trash2, User as UserIcon } from 'lucide-react';
import type { FamilyMember, Appointment } from '@/lib/types';
import { AddFamilyMemberDialog } from '@/components/booking/add-family-member-dialog';
import { BookAppointmentDialog } from '@/components/booking/book-appointment-dialog';
import { Separator } from '@/components/ui/separator';

const mockFamily: FamilyMember[] = [
  { id: 1, name: 'John Doe', dob: '1985-05-20', gender: 'Male', avatar: 'https://picsum.photos/id/237/200/200' },
  { id: 2, name: 'Jane Doe', dob: '1988-10-15', gender: 'Female', avatar: 'https://picsum.photos/id/238/200/200' },
  { id: 3, name: 'Jimmy Doe', dob: '2015-02-25', gender: 'Male', avatar: 'https://picsum.photos/id/239/200/200' },
];

const mockAppointments: Appointment[] = [
  { id: 1, familyMemberId: 3, familyMemberName: 'Jimmy Doe', date: '2024-08-15', time: '10:30 AM', status: 'Confirmed' },
  { id: 2, familyMemberId: 1, familyMemberName: 'John Doe', date: '2024-08-20', time: '04:00 PM', status: 'Confirmed' },
];

const weeklySchedule = {
  Monday: '09:00 AM - 01:00 PM, 04:00 PM - 07:00 PM',
  Tuesday: '09:00 AM - 01:00 PM, 04:00 PM - 07:00 PM',
  Wednesday: '09:00 AM - 01:00 PM, 04:00 PM - 07:00 PM',
  Thursday: '09:00 AM - 01:00 PM, 04:00 PM - 07:00 PM',
  Friday: '09:00 AM - 01:00 PM, 04:00 PM - 07:00 PM',
  Saturday: '10:00 AM - 02:00 PM',
  Sunday: 'Closed',
};

export default function BookingPage() {
  const [family, setFamily] = useState<FamilyMember[]>(mockFamily);
  const [appointments, setAppointments] = useState<Appointment[]>(mockAppointments);
  const [isAddMemberOpen, setAddMemberOpen] = useState(false);
  const [isBookingOpen, setBookingOpen] = useState(false);

  const handleAddFamilyMember = (member: Omit<FamilyMember, 'id' | 'avatar'>) => {
    const newMember = { ...member, id: Date.now(), avatar: `https://picsum.photos/seed/${Date.now()}/200/200` };
    setFamily(prev => [...prev, newMember]);
  };

  const handleBookAppointment = (appointment: Omit<Appointment, 'id' | 'status' | 'familyMemberName'>) => {
    const familyMember = family.find(f => f.id === appointment.familyMemberId);
    if (familyMember) {
      const newAppointment = { ...appointment, id: Date.now(), status: 'Confirmed' as const, familyMemberName: familyMember.name };
      setAppointments(prev => [...prev, newAppointment]);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-muted/40">
      <Header />
      <main className="flex-1 container mx-auto p-4 md:p-6 lg:p-8">
        <div className="grid gap-8 md:grid-cols-3">
          {/* Left Column */}
          <div className="md:col-span-1 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Doctor's Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {Object.entries(weeklySchedule).map(([day, hours]) => (
                    <li key={day} className="flex justify-between">
                      <span className="font-medium">{day}</span>
                      <span>{hours}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Family Members</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setAddMemberOpen(true)}>
                  <PlusCircle className="h-5 w-5" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {family.map(member => (
                  <div key={member.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={member.avatar} alt={member.name} data-ai-hint="person" />
                        <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.gender}, Born {member.dob}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                       <Button variant="ghost" size="icon" className="h-8 w-8"><Edit className="h-4 w-4" /></Button>
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="md:col-span-2 space-y-8">
             <Card className="bg-gradient-to-br from-primary/20 to-background">
                <CardHeader>
                  <CardTitle className="text-2xl">Book Your Next Visit</CardTitle>
                  <CardDescription>Select a family member and find a time that works for you.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button size="lg" onClick={() => setBookingOpen(true)}>Book an Appointment</Button>
                </CardContent>
              </Card>

            <Card>
              <CardHeader>
                <CardTitle>Upcoming Appointments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {appointments.length > 0 ? appointments.map(appt => (
                  <div key={appt.id} className="p-4 rounded-lg border bg-background flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                       <Avatar>
                          <AvatarImage src={family.find(f=>f.id === appt.familyMemberId)?.avatar} alt={appt.familyMemberName} data-ai-hint="person" />
                          <AvatarFallback>{appt.familyMemberName.charAt(0)}</AvatarFallback>
                        </Avatar>
                      <div>
                         <p className="font-bold text-lg">{appt.familyMemberName}</p>
                         <p className="text-sm text-muted-foreground">Token for {new Date(appt.date).toDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                       <p className="font-semibold text-lg">{appt.time}</p>
                       <p className="text-sm text-primary font-medium">{appt.status}</p>
                    </div>
                  </div>
                )) : (
                  <p className="text-muted-foreground text-center py-8">No upcoming appointments.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        
        <AddFamilyMemberDialog 
          isOpen={isAddMemberOpen} 
          onOpenChange={setAddMemberOpen}
          onSave={handleAddFamilyMember} 
        />
        <BookAppointmentDialog
          isOpen={isBookingOpen}
          onOpenChange={setBookingOpen}
          familyMembers={family}
          onSave={handleBookAppointment}
        />

      </main>
    </div>
  );
}
