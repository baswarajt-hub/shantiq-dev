
'use client';

import { useState, useTransition, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Edit, User, Users, Search, Phone, Mail, PlusCircle, Trash2 } from 'lucide-react';
import type { FamilyMember } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { updateFamilyMemberAction, getFamilyByPhoneAction, addNewPatientAction } from '@/app/actions';
import { AdminEditFamilyMemberDialog } from '@/components/admin/edit-family-member-dialog';
import { AdminAddFamilyMemberDialog } from '@/components/admin/add-family-member-dialog';
import { format, parseISO } from 'date-fns';
import { Skeleton } from '../ui/skeleton';

type FamilyDetailsDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  phone: string;
  onUpdate: () => void;
};

export function FamilyDetailsDialog({ isOpen, onOpenChange, phone, onUpdate }: FamilyDetailsDialogProps) {
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMemberOpen, setEditMemberOpen] = useState(false);
  const [isAddMemberOpen, setAddMemberOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const loadFamily = useCallback(async () => {
    setIsLoading(true);
    const familyData = await getFamilyByPhoneAction(phone);
    setFamily(familyData);
    setIsLoading(false);
  }, [phone]);

  useEffect(() => {
    if (isOpen) {
      loadFamily();
    }
  }, [isOpen, loadFamily]);

  const handleEditFamilyMember = useCallback((updatedMember: FamilyMember) => {
    startTransition(async () => {
      const result = await updateFamilyMemberAction(updatedMember);
      if ("error" in result) {
        toast({ title: "Error", description: result.error, variant: 'destructive' });
      } else {
        toast({ title: "Success", description: "Family member details updated." });
        loadFamily();
        onUpdate();
      }
    });
  }, [toast, loadFamily, onUpdate]);

  const handleSaveNewMember = (memberData: Omit<FamilyMember, 'id' | 'avatar' | 'phone'>) => {
    startTransition(async () => {
      const result = await addNewPatientAction({ ...memberData, phone });
      if ("error" in result) {
        toast({ title: "Error", description: result.error, variant: 'destructive' });
      } else {
        toast({ title: "Success", description: "New family member has been added." });
        loadFamily();
        onUpdate();
      }
    });
  };

  const handleOpenEditMember = (member: FamilyMember) => {
    setSelectedMember(member);
    setEditMemberOpen(true);
  }

  const handleOpenEditFamily = () => {
    const primary = family.find(m => m.isPrimary);
    if (primary) {
      handleOpenEditMember(primary);
    }
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '';
    try {
      return format(parseISO(dateString), 'dd-MM-yyyy');
    } catch (e) {
      return dateString;
    }
  }

  const primary = family.find(m => m.isPrimary);
  const others = family.filter(m => !m.isPrimary);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Family Account Details</DialogTitle>
            <DialogDescription>Manage the members and contact information for this family.</DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-[70vh] overflow-y-auto">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
            ) : (
              <Card className="bg-muted/30 border-0 shadow-none">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-2 text-primary text-xl">
                      <Users /> Family Account
                    </span>
                    <span className="text-sm font-mono flex items-center gap-2"><Phone className="h-4 w-4" />{phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleOpenEditFamily}>
                      <Edit className="mr-2 h-4 w-4" /> Edit Family
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setAddMemberOpen(true)}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Member
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {primary && (
                    <div className="p-3 border rounded-md bg-background flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={primary.avatar || ''} alt={primary.name} />
                          <AvatarFallback>{(primary.name || 'P').charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-bold flex items-center gap-2">
                            {primary.primaryContact === 'Father' ? primary.fatherName : primary.motherName}
                            <span className="text-xs font-semibold text-white bg-primary px-1.5 py-0.5 rounded-full">PRIMARY</span>
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Father: {primary.fatherName}, Mother: {primary.motherName}
                          </p>
                          <p className="text-sm text-muted-foreground flex items-center gap-2"><Mail className="h-3 w-3" />{primary.email || 'No email'}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="grid md:grid-cols-2 gap-4">
                    {others.map(member => (
                      <div key={member.id} className="p-3 border rounded-md bg-background flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={member.avatar || ''} alt={member.name} data-ai-hint="person" />
                            <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold">{member.name}</p>
                            <p className="text-xs text-muted-foreground">{member.gender}, Born {member.dob ? formatDate(member.dob) : ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEditMember(member)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                     {others.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center md:col-span-2">No child members in this family.</p>
                     )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          <DialogFooter>
             <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {selectedMember && (
        <AdminEditFamilyMemberDialog
          isOpen={isEditMemberOpen}
          onOpenChange={setEditMemberOpen}
          member={selectedMember}
          onSave={handleEditFamilyMember}
        />
      )}
      <AdminAddFamilyMemberDialog
        isOpen={isAddMemberOpen}
        onOpenChange={setAddMemberOpen}
        onSave={handleSaveNewMember}
      />
    </>
  );
}

    