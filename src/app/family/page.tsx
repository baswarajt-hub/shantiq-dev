

'use client';

import { useState, useTransition, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Edit, User, Users, Search, Phone, Mail, Trash2, PlusCircle, X } from 'lucide-react';
import type { FamilyMember } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { updateFamilyMemberAction, searchFamilyMembersAction, deleteFamilyMemberAction, deleteFamilyByPhoneAction, addNewPatientAction, deleteAllFamiliesAction } from '@/app/actions';
import { Input } from '@/components/ui/input';
import { AdminEditFamilyMemberDialog } from '@/components/admin/edit-family-member-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { AdminAddFamilyMemberDialog } from '@/components/admin/add-family-member-dialog';
import { format, parseISO } from 'date-fns';
import Header from '@/components/header';
import { getDoctorScheduleAction } from '@/app/actions';
import { DoctorSchedule } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type SearchByType = 'phone' | 'clinicId' | 'dob' | 'fatherName' | 'motherName' | 'name';


export default function FamilyAdminPage() {
  const [families, setFamilies] = useState<Record<string, FamilyMember[]>>({});
  const [searchBy, setSearchBy] = useState<SearchByType>('phone');
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditMemberOpen, setEditMemberOpen] = useState(false);
  const [isAddMemberOpen, setAddMemberOpen] = useState(false);
  const [phoneForNewMember, setPhoneForNewMember] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [schedule, setSchedule] = useState<DoctorSchedule | null>(null);

   useEffect(() => {
    async function loadSchedule() {
      try {
        const scheduleData = await getDoctorScheduleAction();
        setSchedule(scheduleData);
      } catch (error) {
        console.error("Failed to load schedule", error);
      }
    }
    loadSchedule();
  }, []);


  const handleSearch = useCallback(() => {
    if (!searchTerm.trim()) {
      setFamilies({});
      return;
    }
    startTransition(async () => {
      const results = await searchFamilyMembersAction(searchTerm, searchBy);
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
  }, [searchTerm, searchBy, toast]);
  
  const handleSearchByChange = (value: SearchByType) => {
    setSearchBy(value);
    setSearchTerm('');
    setFamilies({});
  };

  const handleReset = () => {
    setSearchTerm('');
    setSearchBy('phone');
    setFamilies({});
  };

  const handleEditFamilyMember = useCallback((updatedMember: FamilyMember) => {
     startTransition(async () => {
        const result = await updateFamilyMemberAction(updatedMember);
         if("error" in result){
            toast({ title: "Error", description: result.error, variant: 'destructive'});
        } else {
            toast({ title: "Success", description: result.success});
            handleSearch();
        }
    });
  }, [handleSearch, toast]);

  const handleDeleteMember = (memberId: string) => {
    startTransition(async () => {
      const result = await deleteFamilyMemberAction(memberId);
      if ("error" in result) {
        toast({ title: "Error", description: result.error, variant: 'destructive' });
      } else {
        toast({ title: "Success", description: "Family member has been deleted." });
        handleSearch(); // Refresh results
      }
    });
  };

  const handleDeleteFamily = (phone: string) => {
    startTransition(async () => {
      const result = await deleteFamilyByPhoneAction(phone);
      if ("error" in result) {
        toast({ title: "Error", description: result.error, variant: 'destructive' });
      } else {
        toast({ title: "Success", description: "The entire family has been deleted." });
        setFamilies(prev => {
          const newFamilies = { ...prev };
          delete newFamilies[phone];
          return newFamilies;
        });
      }
    });
  };
  
  const handleDeleteAllFamilies = () => {
    startTransition(async () => {
      const result = await deleteAllFamiliesAction();
      if ("error" in result) {
        toast({ title: "Error", description: result.error, variant: 'destructive' });
      } else {
        toast({ title: "Success", description: "All family records have been deleted." });
        handleReset();
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
      if ("error" in result) {
        toast({ title: "Error", description: result.error, variant: 'destructive' });
      } else {
        toast({ title: "Success", description: "New family member has been added." });
        handleSearch();
      }
    });
  };

  const handleOpenEditMember = (member: FamilyMember) => {
    setSelectedMember(member);
    setEditMemberOpen(true);
  }

  const handleOpenEditFamily = (phone: string, members: FamilyMember[]) => {
    const primary = members.find(m => m.isPrimary);
    if (primary) {
        handleOpenEditMember(primary);
    } else {
        // If no primary member, create a dummy one to open the dialog with the family's phone
        const dummyPrimary: FamilyMember = {
            id: `new_${phone}`, // Temporary ID
            phone: phone,
            isPrimary: true,
            name: '',
            fatherName: members[0]?.fatherName || '',
            motherName: members[0]?.motherName || '',
            email: members[0]?.email || '',
            location: members[0]?.location || '',
            city: members[0]?.city || '',
            primaryContact: members[0]?.primaryContact || 'Father',
            dob: null,
            gender: null,
        };
        handleOpenEditMember(dummyPrimary);
    }
};
  
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '';
    try {
      // The input is expected to be YYYY-MM-DD from the data
      return format(parseISO(dateString), 'dd-MM-yyyy');
    } catch (e) {
      console.error("Date formatting error:", e);
      return dateString; // Fallback to original string if parsing fails
    }
  }

  const searchPlaceholders: Record<SearchByType, string> = {
    phone: 'Enter 10-digit phone number...',
    clinicId: 'Enter Clinic ID...',
    dob: '',
    fatherName: "Enter father's name...",
    motherName: "Enter mother's name...",
    name: 'Enter patient name...',
  };

  return (
    <>
    <Header logoSrc={schedule?.clinicDetails?.clinicLogo} clinicName={schedule?.clinicDetails?.clinicName} />
    <main className="flex-1 p-4 md:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="flex justify-between items-start">
            <div>
                <h1 className="text-3xl font-bold">Family Management</h1>
                <p className="text-muted-foreground">Search for families and manage member details.</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete All Families
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete ALL family and patient records from the database. This action cannot be undone and is intended for starting with fresh data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAllFamilies}>Confirm Deletion</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </div>
        <Card>
          <CardHeader>
             <div className="flex gap-2">
                <Select value={searchBy} onValueChange={handleSearchByChange}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Search by..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="phone">Phone Number</SelectItem>
                        <SelectItem value="clinicId">Clinic ID</SelectItem>
                        <SelectItem value="dob">Date of Birth</SelectItem>
                        <SelectItem value="fatherName">Father's Name</SelectItem>
                        <SelectItem value="motherName">Mother's Name</SelectItem>
                        <SelectItem value="name">Patient Name</SelectItem>
                    </SelectContent>
                </Select>
                <Input 
                    type={searchBy === 'dob' ? 'date' : 'search'}
                    placeholder={searchPlaceholders[searchBy]}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={isPending}>
                    <Search className="mr-2 h-4 w-4" />
                    {isPending ? 'Searching...' : 'Search'}
                </Button>
                <Button onClick={handleReset} variant="outline">
                    <X className="mr-2 h-4 w-4" />
                    Reset
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
                      <Button variant="outline" size="sm" onClick={() => handleOpenEditFamily(phone, members)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit Family
                      </Button>
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
                                    <p className="text-sm text-muted-foreground flex items-center gap-2"><Mail className="h-3 w-3"/>{primary.email || 'No email'}</p>
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
      <AdminAddFamilyMemberDialog
        isOpen={isAddMemberOpen}
        onOpenChange={setAddMemberOpen}
        onSave={handleSaveNewMember}
      />
    </main>
    </>
  );
}
