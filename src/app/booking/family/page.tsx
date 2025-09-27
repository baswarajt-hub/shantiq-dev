
'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Edit, PlusCircle, Trash2, User } from 'lucide-react';
import type { FamilyMember } from '@/lib/types';
import { AddFamilyMemberDialog } from '@/components/booking/add-family-member-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { EditFamilyMemberDialog } from '@/components/booking/edit-family-member-dialog';
import { EditProfileDialog } from '@/components/booking/edit-profile-dialog';
import { addNewPatientAction, updateFamilyMemberAction, getFamilyByPhoneAction, deleteFamilyMemberAction } from '@/app/actions';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';

export default function FamilyPage() {
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [isAddMemberOpen, setAddMemberOpen] = useState(false);
  const [isEditMemberOpen, setEditMemberOpen] = useState(false);
  const [isEditProfileOpen, setEditProfileOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [phone, setPhone] = useState<string|null>(null);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    const userPhone = localStorage.getItem('userPhone');
    if (!userPhone) {
      router.push('/login');
    } else {
        setPhone(userPhone);
    }
  }, [router]);

  const loadData = useCallback(async (userPhone: string) => {
    startTransition(async () => {
      const familyData = await getFamilyByPhoneAction(userPhone);
      setFamily(familyData);
    });
  }, []);

  useEffect(() => {
    if (phone) {
        loadData(phone);
    }
  }, [phone, loadData]);

  const handleAddFamilyMember = useCallback((member: Omit<FamilyMember, 'id' | 'avatar' | 'phone'>) => {
    if (!phone) return;
    startTransition(async () => {
        const result = await addNewPatientAction({ ...member, phone });
        if(result.success){
            toast({ title: "Success", description: "Family member added."});
            loadData(phone);
        } else {
            toast({ title: "Error", description: result.error || "Could not add member", variant: 'destructive'});
        }
    });
  }, [phone, toast, loadData]);
  
  const handleEditFamilyMember = useCallback((updatedMember: FamilyMember) => {
     if (!phone) return;
     startTransition(async () => {
        const result = await updateFamilyMemberAction(updatedMember);
         if(result.success){
            toast({ title: "Success", description: "Family member details updated."});
            loadData(phone);
        } else {
            toast({ title: "Error", description: "Could not update member", variant: 'destructive'});
        }
    });
  }, [phone, toast, loadData]);

  const handleDeleteFamilyMember = useCallback((memberId: string) => {
      if (!phone) return;
      startTransition(async () => {
          const result = await deleteFamilyMemberAction(memberId);
          if(result.success) {
              toast({ title: "Success", description: "Family member removed."});
              loadData(phone);
          } else {
              toast({ title: "Error", description: "Could not remove member", variant: 'destructive'});
          }
      });
  }, [phone, toast, loadData]);

  const handleOpenEditMember = (member: FamilyMember) => {
    setSelectedMember(member);
    setEditMemberOpen(true);
  }

  const primaryMember = family.find(member => member.isPrimary);
  const familyPatients = family.filter(member => !member.isPrimary);

  const formatDate = (dateString: string) => {
    try {
      // The input is expected to be YYYY-MM-DD from the date input
      return format(parseISO(dateString + 'T00:00:00'), 'dd-MM-yyyy');
    } catch (e) {
      return dateString; // Fallback to original string if parsing fails
    }
  }

  if (!phone || isPending) {
      return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <main className="flex-1 p-4 md:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        {primaryMember && (
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2"><User />My Profile</CardTitle>
                    <Button variant="ghost" size="icon" onClick={() => setEditProfileOpen(true)}>
                        <Edit className="h-5 w-5" />
                    </Button>
                </CardHeader>
                <CardContent>
                     <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16">
                            <AvatarImage src={primaryMember.avatar} alt={primaryMember.name} data-ai-hint="person" />
                            <AvatarFallback>{primaryMember.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="text-xl font-semibold">{primaryMember.name}</p>
                            <p className="text-sm text-muted-foreground">{primaryMember.phone}</p>
                            <p className="text-sm text-muted-foreground">{primaryMember.email}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        )}
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Family Members</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setAddMemberOpen(true)}>
                <PlusCircle className="h-5 w-5" />
            </Button>
            </CardHeader>
            <CardContent className="space-y-4">
            {familyPatients.map(member => (
                <div key={member.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted">
                <div className="flex items-center gap-3">
                    <Avatar>
                    <AvatarImage src={member.avatar} alt={member.name} data-ai-hint="person" />
                    <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                    <p className="font-semibold">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.gender}, Born {formatDate(member.dob)}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEditMember(member)}><Edit className="h-4 w-4" /></Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                            This action is permanent and will remove this family member.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteFamilyMember(member.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
                </div>
            ))}
            {familyPatients.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No family members added yet.</p>
            )}
            </CardContent>
        </Card>
      </div>
      
      <AddFamilyMemberDialog 
        isOpen={isAddMemberOpen} 
        onOpenChange={setAddMemberOpen}
        onSave={handleAddFamilyMember} 
      />
      {selectedMember && (
          <EditFamilyMemberDialog
              isOpen={isEditMemberOpen}
              onOpenChange={setEditMemberOpen}
              member={selectedMember}
              onSave={handleEditFamilyMember}
          />
      )}
      {primaryMember && (
          <EditProfileDialog
              isOpen={isEditProfileOpen}
              onOpenChange={setEditProfileOpen}
              member={primaryMember}
              onSave={handleEditFamilyMember}
          />
      )}
    </main>
  );
}
