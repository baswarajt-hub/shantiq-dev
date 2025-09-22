

'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { getDoctorScheduleAction, getFamilyByPhoneAction, addNewPatientAction, joinQueueAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { StethoscopeIcon } from '@/components/icons';
import Image from 'next/image';
import type { FamilyMember, VisitPurpose, DoctorSchedule } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';


export default function WalkInPage() {
  const [step, setStep] = useState<'phone' | 'selectOrCreate' | 'create'>('phone');
  const [phone, setPhone] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const [schedule, setSchedule] = useState<DoctorSchedule | null>(null);
  const [logo, setLogo] = useState<string | null | undefined>(null);

  // State for patient selection/creation
  const [foundFamily, setFoundFamily] = useState<FamilyMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);

  // State for new member form
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [purpose, setPurpose] = useState('Consultation');

  const activeVisitPurposes = schedule?.visitPurposes.filter(p => p.enabled) || [];

  useEffect(() => {
    async function fetchSchedule() {
      const scheduleData = await getDoctorScheduleAction();
      setSchedule(scheduleData);
      setLogo(scheduleData?.clinicDetails?.clinicLogo);
    }
    fetchSchedule();
  }, []);

  const handlePhoneSubmit = () => {
    if (phone.length < 10) {
      toast({ title: "Invalid Phone Number", description: "Please enter a valid 10-digit phone number.", variant: "destructive" });
      return;
    }
    startTransition(async () => {
      const family = await getFamilyByPhoneAction(phone);
      setFoundFamily(family);
      setStep('selectOrCreate');
    });
  };

  const handleJoinQueue = (member: FamilyMember) => {
    startTransition(async () => {
        const result = await joinQueueAction(member, purpose);
        if (result.success && result.patient) {
            toast({ title: "Added to Queue!", description: `You have been assigned Token #${result.patient.tokenNo}.`});
            router.push(`/queue-status?id=${result.patient.id}`);
        } else {
            toast({ title: "Error Joining Queue", description: result.error, variant: 'destructive'});
        }
    });
  }

  const handleCreateAndJoinQueue = () => {
      if (!name || !dob || !gender) {
          toast({ title: "Missing Information", description: "Please fill out all patient details.", variant: 'destructive' });
          return;
      }
      startTransition(async () => {
          const newMemberData: Omit<FamilyMember, 'id' | 'avatar'> = { phone, name, dob, gender };
          const result = await addNewPatientAction(newMemberData);
          if (result.success && result.patient) {
              handleJoinQueue(result.patient);
          } else {
              toast({ title: "Registration Failed", description: result.error, variant: 'destructive' });
          }
      });
  }

  const resetFlow = () => {
    setStep('phone');
    setPhone('');
    setFoundFamily([]);
    setSelectedMember(null);
    setName('');
    setDob('');
    setGender('');
    setPurpose('Consultation');
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4 font-body">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
            {logo ? (
              <div className="relative h-16 w-16">
                <Image src={logo} alt="Clinic Logo" fill className="object-contain" />
              </div>
            ) : (
              <StethoscopeIcon className="h-12 w-12 text-primary" />
            )}
        </div>
        
        {step === 'phone' && (
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Walk-in Registration</CardTitle>
              <CardDescription>
                Enter your 10-digit mobile number to begin.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Enter your mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isPending}
                  autoFocus
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handlePhoneSubmit} disabled={isPending || phone.length < 10} className="w-full">
                {isPending ? 'Searching...' : 'Next'}
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 'selectOrCreate' && (
          <Card>
            <CardHeader>
              <Button variant="ghost" size="sm" onClick={() => setStep('phone')} className="absolute top-3 left-3">Back</Button>
              <CardTitle className="text-center pt-8">Select Patient</CardTitle>
              <CardDescription className="text-center">Who is this appointment for?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <RadioGroup onValueChange={(id) => setSelectedMember(foundFamily.find(m => m.id === id) || null)}>
                    {foundFamily.map(member => (
                        <Label key={member.id} htmlFor={member.id} className="flex items-center gap-3 p-3 border rounded-md cursor-pointer hover:bg-muted has-[input:checked]:bg-primary/20 has-[input:checked]:border-primary">
                            <RadioGroupItem value={member.id} id={member.id} />
                            <Avatar>
                                <AvatarImage src={member.avatar} alt={member.name} data-ai-hint="person" />
                                <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-semibold">{member.name}</p>
                                <p className="text-xs text-muted-foreground">{member.gender}, Born {member.dob}</p>
                            </div>
                        </Label>
                    ))}
                </RadioGroup>

                <Button variant="outline" className="w-full" onClick={() => setStep('create')}>
                  Add New Patient
                </Button>

                 <div className="space-y-2 pt-4">
                    <Label htmlFor="purpose">Purpose of Visit</Label>
                    <Select onValueChange={setPurpose} value={purpose}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a reason for your visit" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeVisitPurposes.map(p => (
                          <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                </div>
            </CardContent>
            <CardFooter>
                 <Button onClick={() => selectedMember && handleJoinQueue(selectedMember)} disabled={isPending || !selectedMember} className="w-full">
                    {isPending ? 'Joining Queue...' : 'Join Queue & Get Token'}
                 </Button>
            </CardFooter>
          </Card>
        )}

        {step === 'create' && (
            <Card>
                <CardHeader>
                  <Button variant="ghost" size="sm" onClick={() => setStep('selectOrCreate')} className="absolute top-3 left-3">Back</Button>
                  <CardTitle className="text-center pt-8">Add New Patient</CardTitle>
                  <CardDescription className="text-center">Enter the new patient's details.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {foundFamily.length === 0 && (
                        <Alert>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>New Family</AlertTitle>
                            <AlertDescription>
                                This phone number is not registered. The first person added will become the primary contact.
                            </AlertDescription>
                        </Alert>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="name">Patient's Full Name</Label>
                        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Jane Doe" required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <Label htmlFor="dob">Date of Birth</Label>
                            <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} max={format(new Date(), 'yyyy-MM-dd')} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="gender">Gender</Label>
                            <Select value={gender} onValueChange={setGender}>
                                <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Male">Male</SelectItem>
                                    <SelectItem value="Female">Female</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="purpose-create">Purpose of Visit</Label>
                        <Select onValueChange={setPurpose} value={purpose}>
                            <SelectTrigger id="purpose-create"><SelectValue placeholder="Select a reason" /></SelectTrigger>
                            <SelectContent>
                                {activeVisitPurposes.map(p => (
                                <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleCreateAndJoinQueue} disabled={isPending || !name || !dob || !gender} className="w-full">
                        {isPending ? 'Saving and Joining...' : 'Save & Join Queue'}
                    </Button>
                </CardFooter>
            </Card>
        )}
         <Button variant="link" size="sm" onClick={resetFlow} className="w-full mt-4">Start Over</Button>
      </div>
    </div>
  );
}
