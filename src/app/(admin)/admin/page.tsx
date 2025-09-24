
'use client';

import { useState, useEffect } from 'react';
import { ScheduleForm } from '@/components/admin/schedule-form';
import { getDoctorScheduleAction, updateDoctorScheduleAction, updatePaymentGatewaySettingsAction } from '@/app/actions';
import { SpecialClosures } from '@/components/admin/special-closures';
import { Separator } from '@/components/ui/separator';
import type { ClinicDetails, DoctorSchedule, SpecialClosure, VisitPurpose, Notification, SmsSettings, PaymentGatewaySettings } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { updateSpecialClosuresAction, updateVisitPurposesAction, updateClinicDetailsAction, updateNotificationsAction, updateSmsSettingsAction } from '../../actions';
import { useToast } from '@/hooks/use-toast';
import { VisitPurposeForm } from '@/components/admin/visit-purpose-form';
import { ClinicDetailsForm } from '@/components/admin/clinic-details-form';
import { NotificationForm } from '@/components/admin/notification-form';
import { SmsSettingsForm } from '@/components/admin/sms-settings-form';
import { PaymentGatewaySettingsForm } from '@/components/admin/payment-gateway-settings-form';
import { PatientImport } from '@/components/admin/patient-import';
import Header from '@/components/header';

export default function AdminPage() {
  const [schedule, setSchedule] = useState<DoctorSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function loadSchedule() {
      try {
        const scheduleData = await getDoctorScheduleAction();
        setSchedule(scheduleData);
      } catch (error) {
        console.error("Failed to load schedule", error);
        toast({ title: 'Error', description: 'Failed to load schedule data.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    }
    loadSchedule();
  }, [toast]);

  const handleClinicDetailsSave = async (updatedDetails: ClinicDetails) => {
    if (!schedule) return;
    const result = await updateClinicDetailsAction(updatedDetails);
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: result.success });
      setSchedule(prev => prev ? { ...prev, clinicDetails: updatedDetails } : null);
    }
  };

  const handleSmsSettingsSave = async (updatedSmsSettings: SmsSettings) => {
    if (!schedule) return;
    const result = await updateSmsSettingsAction(updatedSmsSettings);
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: result.success });
      setSchedule(prev => prev ? { ...prev, smsSettings: updatedSmsSettings } : null);
    }
  };

  const handlePaymentGatewaySettingsSave = async (updatedPaymentGatewaySettings: PaymentGatewaySettings) => {
    if (!schedule) return;
    const result = await updatePaymentGatewaySettingsAction(updatedPaymentGatewaySettings);
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: result.success });
      setSchedule(prev => prev ? { ...prev, paymentGatewaySettings: updatedPaymentGatewaySettings } : null);
    }
  };

  const handleNotificationsSave = async (updatedNotifications: Notification[]) => {
    if (!schedule) return;
    const result = await updateNotificationsAction(updatedNotifications);
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: result.success });
       setSchedule(prev => prev ? { ...prev, notifications: updatedNotifications } : null);
    }
  };

  const handleScheduleSave = async (updatedScheduleData: Partial<DoctorSchedule>) => {
    const result = await updateDoctorScheduleAction(updatedScheduleData);

    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: result.success });
      if (result.schedule) {
        setSchedule(result.schedule);
      }
    }
  };

  const handleClosuresSave = async (updatedClosures: SpecialClosure[]) => {
    if (!schedule) return;
    const result = await updateSpecialClosuresAction(updatedClosures);
     if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
        toast({ title: 'Success', description: 'Closure updated successfully.' });
        setSchedule(prev => prev ? { ...prev, specialClosures: updatedClosures } : null);
    }
  };

  const handleVisitPurposesSave = async (updatedPurposes: VisitPurpose[]) => {
    if (!schedule) return;
    const result = await updateVisitPurposesAction(updatedPurposes);
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: result.success });
      setSchedule(prev => prev ? { ...prev, visitPurposes: updatedPurposes } : null);
    }
  };

  if (loading) {
    return (
      <main className="flex-1 p-4 md:p-6 lg:p-8">
         <div className="mx-auto w-full max-w-4xl space-y-8">
          <div>
              <Skeleton className="h-12 w-1/3" />
              <Skeleton className="h-8 w-2/3 mt-2" />
          </div>
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </main>
    );
  }

  if (!schedule) {
    return (
      <main className="flex-1 p-4 md:p-6 lg:p-8">
         <p className="text-center">Could not load schedule. Please try again later.</p>
      </main>
    );
  }

  return (
    <>
      <Header logoSrc={schedule.clinicDetails?.clinicLogo} clinicName={schedule.clinicDetails?.clinicName} />
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="mx-auto w-full max-w-4xl space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Settings</h1>
            <p className="text-muted-foreground">Manage clinic details, doctor's schedule, and special closures.</p>
          </div>

          <div className="space-y-8">
            <PatientImport />
            <Separator />
            <ClinicDetailsForm
              initialDetails={schedule.clinicDetails}
              onSave={handleClinicDetailsSave}
            />
            <Separator />
            <SmsSettingsForm
              initialSettings={schedule.smsSettings}
              onSave={handleSmsSettingsSave}
            />
            <Separator />
            <PaymentGatewaySettingsForm
              initialSettings={schedule.paymentGatewaySettings}
              onSave={handlePaymentGatewaySettingsSave}
            />
            <Separator />
            <NotificationForm 
              initialNotifications={schedule.notifications}
              onSave={handleNotificationsSave}
            />
            <Separator />
            <ScheduleForm 
                initialSchedule={schedule} 
                onSave={handleScheduleSave} 
            />
            <Separator />
             <VisitPurposeForm 
              initialPurposes={schedule.visitPurposes}
              onSave={handleVisitPurposesSave}
            />
            <Separator />
            <SpecialClosures 
                schedule={schedule}
                onSave={handleClosuresSave}
            />
          </div>
        </div>
      </main>
    </>
  );
}
    
