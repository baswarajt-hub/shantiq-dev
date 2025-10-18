'use client';

import { useState, useTransition, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { getDoctorScheduleAction, getFamilyByPhoneAction, addNewPatientAction, joinQueueAction, registerUserAction, getDoctorStatusAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { StethoscopeIcon } from '@/components/icons';
import Image from 'next/image';
import type { FamilyMember, VisitPurpose, DoctorSchedule, DoctorStatus } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO } from 'date-fns';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Info, QrCode } from 'lucide-react';

function WalkInPageContent() {
  const [step, setStep] = useState<'validate' | 'phone' | 'selectOrCreate' | 'create' | 'registerParent'>('validate');
  const [phone, setPhone] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [schedule, setSchedule] = useState<DoctorSchedule | null>(null);
  const [logo, setLogo] = useState<string | null | undefined>(null);
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);

  // State for patient selection/creation
  const [foundFamily, setFoundFamily] = useState<FamilyMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [purpose, setPurpose] = useState('Consultation');

  // State for new member/parent form
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other' | ''>('');
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('');
  const [city, setCity] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [primaryContact, setPrimaryContact] = useState<'Father' | 'Mother'>('Father');

  const activeVisitPurposes = schedule?.visitPurposes.filter(p => p.enabled) || [];

  // --- Hard-coded clinic coordinates (Shanti Children’s Clinic, Gowliguda Chaman, Hyderabad) ---
  const clinicCoords = { lat: 17.3784598, lng: 78.4788769 };
  const allowedRadiusMeters = 300;

  useEffect(() => {
    async function validateTokenAndLocation() {
      const token = searchParams.get('token');
      const [scheduleData, statusData] = await Promise.all([
        getDoctorScheduleAction(),
        getDoctorStatusAction(),
      ]);

      setSchedule(scheduleData);
      setLogo(scheduleData?.clinicDetails?.clinicLogo);

      // Validate QR token
      if (!statusData.isQrCodeActive || !token || statusData.walkInSessionToken !== token) {
        setIsValidToken(false);
        setStep('validate');
        return;
      }

      // Check geolocation (if available)
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userLat = position.coords.latitude;
            const userLng = position.coords.longitude;

            const R = 6371e3; // Earth radius in meters
            const φ1 = (userLat * Math.PI) / 180;
            const φ2 = (clinicCoords.lat * Math.PI) / 180;
            const Δφ = ((clinicCoords.lat - userLat) * Math.PI) / 180;
            const Δλ = ((clinicCoords.lng - userLng) * Math.PI) / 180;

            const a =
              Math.sin(Δφ / 2) ** 2 +
              Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const dist = R * c;

            console.log(`📍 User location: (${userLat.toFixed(6)}, ${userLng.toFixed(6)}) | 🏥 Clinic: (${clinicCoords.lat}, ${clinicCoords.lng}) | Distance: ${dist.toFixed(2)} m`);

            if (dist <= allowedRadiusMeters) {
              setIsValidToken(true);
              setStep('phone');
            } else {
              toast({
                title: 'Outside Clinic Range',
                description: `You are ${Math.round(dist)} m away. Please be within ${allowedRadiusMeters} m of the clinic.`,
                variant: 'destructive',
              });
              setIsValidToken(false);
              setStep('validate');
            }
          },
          (error) => {
            console.error('Geolocation error:', error);
            toast({
              title: 'Location Access Required',
              description: 'Please allow location access to verify proximity to the clinic.',
              variant: 'destructive',
            });
            setIsValidToken(false);
            setStep('validate');
          }
        );
      } else {
        setIsValidToken(true); // fallback for browsers without geolocation
        setStep('phone');
      }
    }

    validateTokenAndLocation();
  }, [searchParams]);

  const handlePhoneSubmit = () => {
    if (phone.length < 10) {
      toast({
        title: "Invalid Phone Number",
        description: "Please enter a valid 10-digit phone number.",
        variant: "destructive",
      });
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
      if ("error" in result) {
        toast({
          title: "Error Joining Queue",
          description: result.error,
          variant: 'destructive'
        });
      } else {
        toast({
          title: "Added to Queue!",
          description: `You have been assigned Token #${result.patient.tokenNo}. Redirecting...`
        });
        localStorage.setItem('userPhone', member.phone);
        router.push(`/queue-status?id=${result.patient.id}`);
      }
    });
  };

  const handleCreateAndJoinQueue = () => {
    if (!name || !dob || !gender) {
      toast({
        title: "Missing Information",
        description: "Please fill out all patient details.",
        variant: 'destructive'
      });
      return;
    }
    startTransition(async () => {
      const newMemberData: Omit<FamilyMember, 'id' | 'avatar' | 'clinicId'> = { phone, name, dob, gender, isPrimary: false };
      const result = await addNewPatientAction(newMemberData);
      if ("error" in result) {
        toast({
          title: "Registration Failed",
          description: result.error,
          variant: 'destructive'
        });
      } else {
        handleJoinQueue(result.patient);
      }
    });
  };

  const handleRegisterParent = () => {
    if (!fatherName || !motherName || !location || !city || !phone) {
      toast({
        title: 'Missing Information',
        description: 'Please fill out all required fields.',
        variant: 'destructive',
      });
      return;
    }
    startTransition(async () => {
      const result = await registerUserAction({
        phone,
        fatherName,
        motherName,
        primaryContact,
        location,
        city,
        email
      });
      if ("error" in result) {
        toast({
          title: 'Registration Failed',
          description: result.error,
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Registration Successful',
          description: 'Your family account has been created. Now, please add the patient.'
        });
        const family = await getFamilyByPhoneAction(phone);
        setFoundFamily(family);
        setStep('create');
      }
    });
  };

  const selectedPurposeDetails = activeVisitPurposes.find(p => p.name === purpose);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return format(parseISO(dateString + 'T00:00:00'), 'dd-MM-yyyy');
    } catch (e) {
      return dateString;
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 font-body" style={{ backgroundColor: '#e0e1ee' }}>
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

        {step === 'validate' && (
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">QR Code Session</CardTitle>
            </CardHeader>
            <CardContent>
              {isValidToken === null && <p className="text-center">Validating session...</p>}
              {isValidToken === false && (
                <Alert variant="destructive">
                  <QrCode className="h-4 w-4" />
                  <AlertTitle>Invalid or Expired QR Code</AlertTitle>
                  <AlertDescription>
                    This QR code is no longer valid. Please scan the latest QR code from the clinic's TV display to join the queue.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {step === 'phone' && (
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Walk-in Registration</CardTitle>
              <CardDescription>
                Enter your 10-digit mobile number to begin.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="Enter your mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isPending}
                style={{ backgroundColor: '#e0e1ee' }}
              />
            </CardContent>
            <CardFooter>
              <Button
                onClick={handlePhoneSubmit}
                disabled={isPending || phone.length < 10}
                className="w-full"
                style={{ backgroundColor: '#9d4edd' }}
              >
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
              <CardDescription className="text-center">This phone number is new to us. Please enter the parents' details to create a family account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Attention!</AlertTitle>
                <AlertDescription>
                  If you have registered with the doctor before, please contact the receptionist for assistance.
                </AlertDescription>
              </Alert>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fatherName">Father's Name</Label>
                  <Input id="fatherName" value={fatherName} onChange={(e) => setFatherName(e.target.value)} placeholder="Father's Name" style={{ backgroundColor: '#e0e1ee' }} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="motherName">Mother's Name</Label>
                  <Input id="motherName" value={motherName} onChange={(e) => setMotherName(e.target.value)} placeholder="Mother's Name" style={{ backgroundColor: '#e0e1ee' }} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Primary Contact</Label>
                <RadioGroup value={primaryContact} onValueChange={(value: 'Father' | 'Mother') => setPrimaryContact(value)} className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Father" id="father" />
                    <Label htmlFor="father">Father</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Mother" id="mother" />
                    <Label htmlFor="mother">Mother</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email (Optional)</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. parent@example.com" style={{ backgroundColor: '#e0e1ee' }} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Location Area</Label>
                  <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g., Ameerpet" style={{ backgroundColor: '#e0e1ee' }} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g., Hyderabad" style={{ backgroundColor: '#e0e1ee' }} />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleRegisterParent} disabled={isPending} className="w-full" style={{ backgroundColor: '#9d4edd' }}>
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
                      <AvatarImage src={member.avatar || ''} alt={member.name} data-ai-hint="person" />
                      <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.gender}, Born {formatDate(member.dob)}</p>
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
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Important</AlertTitle>
                <AlertDescription>
                  <p>1. Select this option only if your child is with you now, otherwise book through reception.</p>
                  <p>2. Please get your child’s temperature and weight checked at reception before your turn.</p>
                </AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter>
              <Button onClick={() => selectedMember && handleJoinQueue(selectedMember)} disabled={isPending || !selectedMember} className="w-full" style={{ backgroundColor: '#9d4edd' }}>
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
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Jane Doe" required style={{ backgroundColor: '#e0e1ee' }} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dob">Date of Birth</Label>
                  <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} max={format(new Date(), 'yyyy-MM-dd')} required style={{ backgroundColor: '#e0e1ee' }} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Select value={gender} onValueChange={(value) => setGender(value as 'Male' | 'Female' | 'Other')}>
                    <SelectTrigger style={{ backgroundColor: '#e0e1ee' }}><SelectValue placeholder="Select gender" /></SelectTrigger>
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
                  <SelectTrigger id="purpose-create" style={{ backgroundColor: '#e0e1ee' }}><SelectValue placeholder="Select a reason" /></SelectTrigger>
                  <SelectContent>
                    {activeVisitPurposes.map(p => (
                      <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Important</AlertTitle>
                <AlertDescription>
                  <p>1. Select this option only if your child is with you now, otherwise book through reception.</p>
                  <p>2. Please get your child’s temperature and weight checked at reception before your turn.</p>
                </AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter>
              <Button onClick={handleCreateAndJoinQueue} disabled={isPending || !name || !dob || !gender} className="w-full" style={{ backgroundColor: '#9d4edd' }}>
                {isPending ? 'Saving and Joining...' : 'Save & Check-in'}
              </Button>
            </CardFooter>
          </Card>
        )}
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
