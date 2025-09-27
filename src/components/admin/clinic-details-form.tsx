
'use client';

import { useTransition, useState, useEffect } from 'react';
import type { ClinicDetails } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '../ui/textarea';
import Image from 'next/image';

const EMPTY_DETAILS: ClinicDetails = {
  doctorName: '',
  qualifications: '',
  clinicName: '',
  tagLine: '',
  address: '',
  contactNumber: '',
  email: '',
  website: '',
  consultationFee: 0,
  paymentQRCode: '',
  clinicLogo: '',
  googleMapsLink: ''
};

type ClinicDetailsFormProps = {
  initialDetails?: ClinicDetails | null;
  onSave: (details: ClinicDetails) => Promise<void>;
};

export function ClinicDetailsForm({ initialDetails, onSave }: ClinicDetailsFormProps) {
  const [details, setDetails] = useState<ClinicDetails>(initialDetails || EMPTY_DETAILS);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setDetails(initialDetails || EMPTY_DETAILS);
  }, [initialDetails]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setDetails(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value, 10) || 0 : value
    }));
  };
  
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'paymentQRCode' | 'clinicLogo') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setDetails(prev => ({...prev, [field]: reader.result as string}));
      }
      reader.readAsDataURL(file);
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await onSave(details);
    });
  };

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Doctor and Clinic Details</CardTitle>
          <CardDescription>Set up general information about the doctor and the clinic.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
             <div className="space-y-2">
                <Label htmlFor="doctorName">Doctor's Name</Label>
                <Input id="doctorName" name="doctorName" value={details.doctorName} onChange={handleInputChange} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="qualifications">Qualifications</Label>
                <Input id="qualifications" name="qualifications" value={details.qualifications} onChange={handleInputChange} />
            </div>
          </div>
           <div className="space-y-2">
                <Label htmlFor="clinicName">Clinic Name</Label>
                <Input id="clinicName" name="clinicName" value={details.clinicName} onChange={handleInputChange} />
            </div>
           <div className="space-y-2">
                <Label htmlFor="tagLine">Clinic Tag Line</Label>
                <Input id="tagLine" name="tagLine" value={details.tagLine} onChange={handleInputChange} />
            </div>
           <div className="space-y-2">
                <Label htmlFor="address">Clinic Address</Label>
                <Textarea id="address" name="address" value={details.address} onChange={handleInputChange} />
            </div>
            <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="contactNumber">Contact Number</Label>
                    <Input id="contactNumber" name="contactNumber" value={details.contactNumber} onChange={handleInputChange} />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="consultationFee">Consultation Fee</Label>
                    <Input id="consultationFee" name="consultationFee" type="number" value={details.consultationFee} onChange={handleInputChange} />
                </div>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" value={details.email} onChange={handleInputChange} />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input id="website" name="website" value={details.website} onChange={handleInputChange} />
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="googleMapsLink">Google Maps Link</Label>
                <Input id="googleMapsLink" name="googleMapsLink" value={details.googleMapsLink || ''} onChange={handleInputChange} placeholder="Paste Google Maps URL here" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clinicLogo">Clinic Logo</Label>
              <div className="flex items-center gap-4">
                <Input id="clinicLogo" type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'clinicLogo')} className="max-w-xs" />
                {details.clinicLogo && (
                  <div className="w-16 h-16 relative border rounded-md p-1">
                    <Image src={details.clinicLogo} alt="Clinic Logo Preview" layout="fill" objectFit="contain" />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Recommended: Square image (e.g., 100x100 pixels)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentQRCode">Payment QR Code</Label>
              <div className="flex items-center gap-4">
                <Input id="paymentQRCode" type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'paymentQRCode')} className="max-w-xs" />
                {details.paymentQRCode && (
                  <div className="w-24 h-24 relative border rounded-md">
                    <Image src={details.paymentQRCode} alt="Payment QR Code Preview" layout="fill" objectFit="contain" />
                  </div>
                )}
              </div>
            </div>
        </CardContent>
        <CardFooter>
            <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : 'Save Clinic Details'}
            </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
