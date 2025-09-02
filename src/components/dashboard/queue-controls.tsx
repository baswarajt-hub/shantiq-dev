'use client';

import {
  addWalkInPatientAction,
  emergencyCancelAction,
  runTimeEstimationAction,
  toggleDoctorStatusAction,
} from '@/app/actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Plus, Sparkles, LogIn, LogOut } from 'lucide-react';
import { useState, useTransition } from 'react';
import { AddPatientForm } from './add-patient-form';
import type { AIPatientData, DoctorStatus } from '@/lib/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';

export function QueueControls({ aipatients, initialDoctorStatus }: { aipatients: AIPatientData, initialDoctorStatus: DoctorStatus }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [doctorStatus, setDoctorStatus] = useState(initialDoctorStatus);

  const handleRunEstimation = () => {
    startTransition(async () => {
      const result = await runTimeEstimationAction(aipatients);
      if (result?.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: result.success });
      }
    });
  };

  const handleEmergencyCancel = () => {
    startTransition(async () => {
      const result = await emergencyCancelAction();
      if (result?.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: result.success });
      }
    });
  };
  
  const handleAddPatient = (formData: FormData) => {
    startTransition(async () => {
        const result = await addWalkInPatientAction(formData);
        if (result?.error) {
          toast({ title: 'Error', description: result.error, variant: 'destructive' });
        } else {
          toast({ title: 'Success', description: result.success });
          setDialogOpen(false);
        }
      });
  }

  const handleToggleDoctorStatus = () => {
    startTransition(async () => {
      const result = await toggleDoctorStatusAction();
      if (result?.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive'});
      } else {
        toast({ title: 'Success', description: result.success});
        setDoctorStatus(prev => ({...prev, isOnline: !prev.isOnline}));
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center space-x-2">
        <Switch id="doctor-status" checked={doctorStatus.isOnline} onCheckedChange={handleToggleDoctorStatus} disabled={isPending}/>
        <Label htmlFor="doctor-status" className='flex items-center'>
            {doctorStatus.isOnline ? <LogIn className="mr-2 h-4 w-4 text-green-500" /> : <LogOut className="mr-2 h-4 w-4 text-red-500" />}
            Doctor {doctorStatus.isOnline ? 'Online' : 'Offline'}
        </Label>
      </div>
      <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Walk-in
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Walk-in Patient</DialogTitle>
            <DialogDescription>
              Enter the patient's details to add them to the queue.
            </DialogDescription>
          </DialogHeader>
          <AddPatientForm
            onSubmit={handleAddPatient}
            isPending={isPending}
          />
        </DialogContent>
      </Dialog>
      <Button
        variant="outline"
        onClick={handleRunEstimation}
        disabled={isPending}
      >
        <Sparkles className="mr-2 h-4 w-4" />
        {isPending ? 'Estimating...' : 'Re-Estimate Times'}
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" className="ml-auto">
            <AlertTriangle className="mr-2 h-4 w-4" />
            Emergency
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will cancel all active appointments and notify patients of an emergency. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleEmergencyCancel} disabled={isPending}>
              {isPending ? 'Cancelling...' : 'Confirm Emergency'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
