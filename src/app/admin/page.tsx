
'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/header';
import { ScheduleForm } from '@/components/admin/schedule-form';
import { getDoctorScheduleAction } from '@/app/actions';
import { SpecialClosures } from '@/components/admin/special-closures';
import { Separator } from '@/components/ui/separator';
import type { ClinicDetails, DoctorSchedule, SpecialClosure, VisitPurpose, Notification } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { updateDoctorScheduleAction, updateSpecialClosuresAction, updateVisitPurposesAction, updateClinicDetailsAction, updateNotificationsAction } from '../actions';
import { useToast } from '@/hooks/use-toast';
import { VisitPurposeForm } from '@/components/admin/visit-purpose-form';
import { ClinicDetailsForm } from '@/components/admin/clinic-details-form';
import { NotificationForm } from '@/components/admin/notification-form';

export default function AdminPage() {
  const [schedule, setSchedule] = useState<DoctorSchedule | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function loadSchedule() {
      const scheduleData = await getDoctorScheduleAction();
      setSchedule(scheduleData);
    }
    loadSchedule();
  }, []);

  const handleClinicDetailsSave = async (updatedDetails: ClinicDetails) => {
    if (!schedule) return;
    // Optimistically update UI
    setSchedule(prev => prev ? { ...prev, clinicDetails: updatedDetails } : null);
    const result = await updateClinicDetailsAction(updatedDetails);
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
      // Revert on error
      const freshSchedule = await getDoctorScheduleAction();
      setSchedule(freshSchedule);
    } else {
      toast({ title: 'Success', description: result.success });
    }
  };

  const handleNotificationsSave = async (updatedNotifications: Notification[]) => {
    if (!schedule) return;
     setSchedule(prev => prev ? { ...prev, notifications: updatedNotifications } : null);
    const result = await updateNotificationsAction(updatedNotifications);
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
       const freshSchedule = await getDoctorScheduleAction();
       setSchedule(freshSchedule);
    } else {
      toast({ title: 'Success', description: result.success });
    }
  };

  const handleScheduleSave = async (updatedScheduleData: Partial<DoctorSchedule>) => {
    // Optimistically update the UI
    if (schedule) {
      setSchedule({ ...schedule, ...updatedScheduleData });
    }
    
    const result = await updateDoctorScheduleAction(updatedScheduleData);

    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
      // Revert on error
      const freshSchedule = await getDoctorScheduleAction();
      setSchedule(freshSchedule);
    } else {
      toast({ title: 'Success', description: result.success });
      if (result.schedule) {
        setSchedule(result.schedule);
      }
    }
  };

  const handleClosuresSave = async (updatedClosures: SpecialClosure[]) => {
     if (!schedule) return;
    setSchedule(prev => prev ? { ...prev, specialClosures: updatedClosures } : null);
    const result = await updateSpecialClosuresAction(updatedClosures);
     if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
        const freshSchedule = await getDoctorScheduleAction();
        setSchedule(freshSchedule);
    } else {
        toast({ title: 'Success', description: 'Closure updated successfully.' });
    }
  };

  const handleVisitPurposesSave = async (updatedPurposes: VisitPurpose[]) => {
    if (!schedule) return;
    setSchedule(prev => prev ? { ...prev, visitPurposes: updatedPurposes } : null);
    const result = await updateVisitPurposesAction(updatedPurposes);
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
       const freshSchedule = await getDoctorScheduleAction();
       setSchedule(freshSchedule);
    } else {
      toast({ title: 'Success', description: result.success });
    }
  };

  if (!schedule) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Header logoSrc={null} />
        <main className="flex-1 container mx-auto p-4 md:p-6 lg:p-8">
           <div className="space-y-8">
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
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header logoSrc={schedule.clinicDetails?.clinicLogo} clinicName={schedule.clinicDetails?.clinicName} />
      <main className="flex-1 container mx-auto p-4 md:p-6 lg:p-8">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Settings</h1>
            <p className="text-muted-foreground">Manage clinic details, doctor's schedule, and special closures.</p>
          </div>

          <div className="space-y-8">
            <ClinicDetailsForm
              initialDetails={schedule.clinicDetails}
              onSave={handleClinicDetailsSave}
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
    </div>
  );
}
    
