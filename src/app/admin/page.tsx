'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/header';
import { ScheduleForm } from '@/components/admin/schedule-form';
import { getDoctorSchedule } from '@/lib/data';
import { SpecialClosures } from '@/components/admin/special-closures';
import { Separator } from '@/components/ui/separator';
import type { DoctorSchedule, SpecialClosure } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { updateDoctorScheduleAction, updateSpecialClosuresAction } from '../actions';
import { useToast } from '@/hooks/use-toast';

export default function AdminPage() {
  const [schedule, setSchedule] = useState<DoctorSchedule | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function loadSchedule() {
      const scheduleData = await getDoctorSchedule();
      setSchedule(scheduleData);
    }
    loadSchedule();
  }, []);

  const handleScheduleSave = async (updatedSchedule: Omit<DoctorSchedule, 'specialClosures'>) => {
    if (!schedule) return;
    const result = await updateDoctorScheduleAction(updatedSchedule);
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: result.success });
      setSchedule(prev => prev ? { ...prev, ...updatedSchedule } : null);
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

  if (!schedule) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Header />
        <main className="flex-1 container mx-auto p-4 md:p-6 lg:p-8">
           <div className="space-y-8">
            <Skeleton className="h-12 w-1/3" />
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 container mx-auto p-4 md:p-6 lg:p-8">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Settings</h1>
            <p className="text-muted-foreground">Manage doctor's schedule and special closures.</p>
          </div>

          <div className="space-y-8">
            <ScheduleForm 
                initialSchedule={schedule} 
                onSave={handleScheduleSave} 
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
