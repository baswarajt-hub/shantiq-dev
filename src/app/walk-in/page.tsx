

'use client';

import { useState, useTransition, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { getDoctorScheduleAction, getFamilyByPhoneAction, addNewPatientAction, joinQueueAction, registerUserAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { StethoscopeIcon } from '@/components/icons';
import Image from 'next/image';
import type { FamilyMember, VisitPurpose, DoctorSchedule } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Info } from 'lucide-react';

function WalkInPageContent() {
  const [step, setStep] = useState<'phone' | 'selectOrCreate' | 'create' | 'registerParent'>('phone');
  const [phone, setPhone] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const [schedule, setSchedule] = useState<DoctorSchedule | null>(null);
  const [logo, setLogo] = useState<string | null | undefined>(null);

  // State for patient selection/creation
  const [foundFamily, setFoundFamily] = useState<FamilyMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [purpose, setPurpose] = useState('Consultation');

  // State for new member/parent form
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('');
  const [city, setCity] = useState('');

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
      if (family.length > 0) {
        setFoundFamily(family);
        setStep('selectOrCreate');
      } else {
        setStep('registerParent');
      }
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
          const newMemberData: Omit<FamilyMember, 'id' | 'avatar'> = { phone, name, dob, gender, isPrimary: false };
          const result = await addNewPatientAction(newMemberData);
          if (result.success && result.patient) {
              handleJoinQueue(result.patient);
          } else {
              toast({ title: "Registration Failed", description: result.error, variant: 'destructive' });
          }
      });
  }

  const handleRegisterParent = () => {
    if (!name || !gender || !location || !city || !phone) {
      toast({
        title: 'Missing Information',
        description: 'Please fill out all required fields.',
        variant: 'destructive',
      });
      return;
    }
    startTransition(async () => {
      const result = await registerUserAction({ phone, name, dob, gender, location, city, email });
      if (result.success) {
        toast({ title: 'Registration Successful', description: 'Your family account has been created. Now, please add the patient.' });
        const family = await getFamilyByPhoneAction(phone);
        setFoundFamily(family);
        setName(''); setDob(''); setGender(''); setEmail(''); setLocation(''); setCity('');
        setStep('create'); // Go to add patient step
      } else {
        toast({ title: 'Registration Failed', description: 'Something went wrong.', variant: 'destructive' });
      }
    });
  };

  const resetFlow = () => {
    setStep('phone');
    setPhone('');
    setFoundFamily([]);
    setSelectedMember(null);
    setName(''); setDob(''); setGender(''); setEmail(''); setLocation(''); setCity('');
    setPurpose('Consultation');
    router.replace('/walk-in');
  }
  
  const selectedPurposeDetails = activeVisitPurposes.find(p => p.name === purpose);

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

        {step === 'registerParent' && (
          <Card>
            <CardHeader>
               <Button variant="ghost" size="sm" onClick={() => setStep('phone')} className="absolute top-3 left-3">Back</Button>
               <CardTitle className="text-center pt-8">Register Your Family</CardTitle>
               <CardDescription className="text-center">This phone number is new to us. Please enter the parent's details to create a family account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
               <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Attention!</AlertTitle>
                  <AlertDescription>
                    If you have registered with the doctor before, please contact the receptionist for assistance.
                  </AlertDescription>
              </Alert>
               <div className="space-y-2">
                  <Label htmlFor="name">Full Name (Parent's)</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Parent's Name" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                      <Label htmlFor="dob">Date of Birth (Optional)</Label>
                      <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} max={format(new Date(), 'yyyy-MM-dd')} />
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
                  <Label htmlFor="email">Email (Optional)</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. parent@example.com" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                      <Label htmlFor="location">Location Area</Label>
                      <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g., Ameerpet" />
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g., Hyderabad" />
                  </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleRegisterParent} disabled={isPending} className="w-full">
                {isPending ? 'Registering...' : 'Register & Add Patient'}
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
                    {foundFamily.filter(m => !m.isPrimary).map(member => (
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
                     {selectedPurposeDetails?.description && (
                        <div className="text-xs text-muted-foreground p-2 flex gap-2 items-start">
                            <Info className="h-3 w-3 mt-0.5 shrink-0"/>
                            <span>{selectedPurposeDetails.description}</span>
                        </div>
                    )}
                </div>
                 <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Important</AlertTitle>
                    <AlertDescription>
                        <p>1. Select this option only if your child is with you now, otherwise book through reception.</p>
                        <p>2. Please get your child’s temperature and weight checked at reception before your turn. If you miss your turn, the appointment will be moved to the next available slot.</p>
                    </AlertDescription>
                </Alert>
            </CardContent>
            <CardFooter>
                 <Button onClick={() => selectedMember && handleJoinQueue(selectedMember)} disabled={isPending || !selectedMember} className="w-full">
                    {isPending ? 'Joining Queue...' : 'Book & Check-in'}
                 </Button>
            </CardFooter>
          </Card>
        )}

        {step === 'create' && (
            <Card>
                <CardHeader>
                  <Button variant="ghost" size="sm" onClick={() => setStep(foundFamily.length > 0 ? 'selectOrCreate' : 'phone')} className="absolute top-3 left-3">Back</Button>
                  <CardTitle className="text-center pt-8">Add New Patient</CardTitle>
                  <CardDescription className="text-center">Enter the new patient's details.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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
                        {selectedPurposeDetails?.description && (
                            <div className="text-xs text-muted-foreground p-2 flex gap-2 items-start">
                                <Info className="h-3 w-3 mt-0.5 shrink-0"/>
                                <span>{selectedPurposeDetails.description}</span>
                            </div>
                        )}
                    </div>
                     <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Important</AlertTitle>
                        <AlertDescription>
                            <p>1. Select this option only if your child is with you now, otherwise book through reception.</p>
                            <p>2. Please get your child’s temperature and weight checked at reception before your turn. If you miss your turn, the appointment will be moved to the next available slot.</p>
                        </AlertDescription>
                    </Alert>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleCreateAndJoinQueue} disabled={isPending || !name || !dob || !gender} className="w-full">
                        {isPending ? 'Saving and Joining...' : 'Save & Check-in'}
                    </Button>
                </CardFooter>
            </Card>
        )}
         <Button variant="link" size="sm" onClick={resetFlow} className="w-full mt-4">Start Over</Button>
      </div>
    </div>
  );
}

export default function WalkInPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <WalkInPageContent />
        </Suspense>
    );
}

    