
'use client';

import { useState, useTransition, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Edit, User, Users, Search, Phone, Mail, Trash2, PlusCircle } from 'lucide-react';
import type { FamilyMember } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { updateFamilyMemberAction, searchFamilyMembersAction, deleteFamilyMemberAction, deleteFamilyByPhoneAction, addNewPatientAction } from '@/app/actions';
import { Input } from '@/components/ui/input';
import { AdminEditFamilyMemberDialog } from '@/components/admin/edit-family-member-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { AddFamilyMemberDialog } from '@/components/booking/add-family-member-dialog';

export default function FamilyAdminPage() {
  const [families, setFamilies] = useState<Record<string, FamilyMember[]>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditMemberOpen, setEditMemberOpen] = useState(false);
  const [isAddMemberOpen, setAddMemberOpen] = useState(false);
  const [phoneForNewMember, setPhoneForNewMember] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleSearch = useCallback(() => {
    if (!searchTerm.trim()) {
      setFamilies({});
      return;
    }
    startTransition(async () => {
      const results = await searchFamilyMembersAction(searchTerm);
      if (results.length === 0) {
        toast({ title: "Not Found", description: "No families found for the given search term."});
      }
      const groupedByPhone = results.reduce((acc, member) => {
        const phone = member.phone;
        if (!acc[phone]) {
          acc[phone] = [];
        }
        acc[phone].push(member);
        return acc;
      }, {} as Record<string, FamilyMember[]>);
      setFamilies(groupedByPhone);
    });
  }, [searchTerm, toast]);

  const handleEditFamilyMember = useCallback((updatedMember: FamilyMember) => {
     startTransition(async () => {
        const result = await updateFamilyMemberAction(updatedMember);
         if(result.success){
            toast({ title: "Success", description: "Family member details updated."});
            handleSearch();
        } else {
            toast({ title: "Error", description: "Could not update member", variant: 'destructive'});
        }
    });
  }, [handleSearch, toast]);

  const handleDeleteMember = (memberId: string) => {
    startTransition(async () => {
      const result = await deleteFamilyMemberAction(memberId);
      if (result.success) {
        toast({ title: "Success", description: "Family member has been deleted." });
        handleSearch(); // Refresh results
      } else {
        toast({ title: "Error", description: "Could not delete member.", variant: 'destructive' });
      }
    });
  };

  const handleDeleteFamily = (phone: string) => {
    startTransition(async () => {
      const result = await deleteFamilyByPhoneAction(phone);
      if (result.success) {
        toast({ title: "Success", description: "The entire family has been deleted." });
        setFamilies(prev => {
          const newFamilies = { ...prev };
          delete newFamilies[phone];
          return newFamilies;
        });
      } else {
        toast({ title: "Error", description: "Could not delete family.", variant: 'destructive' });
      }
    });
  };

  const handleAddMember = (phone: string) => {
    setPhoneForNewMember(phone);
    setAddMemberOpen(true);
  };

  const handleSaveNewMember = (memberData: Omit<FamilyMember, 'id' | 'avatar' | 'phone'>) => {
    if (!phoneForNewMember) return;
    startTransition(async () => {
      const result = await addNewPatientAction({ ...memberData, phone: phoneForNewMember });
      if (result.success) {
        toast({ title: "Success", description: "New family member has been added." });
        handleSearch();
      } else {
        toast({ title: "Error", description: result.error, variant: 'destructive' });
      }
    });
  };

  const handleOpenEditMember = (member: FamilyMember) => {
    setSelectedMember(member);
    setEditMemberOpen(true);
  }

  return (
    <main className="flex-1 p-4 md:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="space-y-2">
            <h1 className="text-3xl font-bold">Family Management</h1>
            <p className="text-muted-foreground">Search for families and manage member details.</p>
        </div>
        <Card>
          <CardHeader>
            <div className="flex gap-2">
              <Input 
                placeholder="Search by name, phone, clinic ID, or DOB (YYYY-MM-DD)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={isPending}>
                <Search className="mr-2 h-4 w-4" />
                {isPending ? 'Searching...' : 'Search'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            {Object.keys(families).length === 0 ? (
              <p className="text-center text-muted-foreground py-16">
                Enter a search term to find a family.
              </p>
            ) : Object.entries(families).map(([phone, members]) => {
              const primary = members.find(m => m.isPrimary);
              const others = members.filter(m => !m.isPrimary);
              return (
                <Card key={phone} className="bg-muted/30">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-4">
                       <span className="flex items-center gap-2 text-primary text-xl">
                         <Users /> Family Account
                       </span>
                       <span className="text-sm font-mono flex items-center gap-2"><Phone className="h-4 w-4" />{phone}</span>
                    </div>
                     <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleAddMember(phone)}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Member
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete Family
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action will permanently delete the entire family and all associated members. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteFamily(phone)}>Confirm Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {primary && (
                        <div className="p-3 border rounded-md bg-background flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Avatar className="h-12 w-12">
                                    <AvatarImage src={primary.avatar} alt={primary.name} />
                                    <AvatarFallback>{primary.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-bold flex items-center gap-2">{primary.name} <span className="text-xs font-semibold text-white bg-primary px-1.5 py-0.5 rounded-full">PRIMARY</span></p>
                                    <p className="text-sm text-muted-foreground flex items-center gap-2"><Mail className="h-3 w-3"/>{primary.email || 'No email'}</p>
                                </div>
                            </div>
                             <div className="flex items-center gap-1">
                                <Button variant="outline" size="sm" onClick={() => handleOpenEditMember(primary)}>
                                  <Edit className="mr-2 h-4 w-4" /> Edit
                                </Button>
                             </div>
                        </div>
                    )}
                    <div className="grid md:grid-cols-2 gap-4">
                      {others.map(member => (
                        <div key={member.id} className="p-3 border rounded-md bg-background flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Avatar>
                                <AvatarImage src={member.avatar} alt={member.name} data-ai-hint="person" />
                                <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                <p className="font-semibold">{member.name}</p>
                                <p className="text-xs text-muted-foreground">{member.gender}, Born {member.dob}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEditMember(member)}>
                                  <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete {member.name}?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This action will permanently delete this family member.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteMember(member.id)}>Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {selectedMember && (
          <AdminEditFamilyMemberDialog
              isOpen={isEditMemberOpen}
              onOpenChange={setEditMemberOpen}
              member={selectedMember}
              onSave={handleEditFamilyMember}
          />
      )}
      <AddFamilyMemberDialog
        isOpen={isAddMemberOpen}
        onOpenChange={setAddMemberOpen}
        onSave={handleSaveNewMember}
      />
    </main>
  );
}
