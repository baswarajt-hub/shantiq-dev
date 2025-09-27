
'use client';

import { useState, useTransition, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Edit, User, Users, Search, Phone, Mail } from 'lucide-react';
import type { FamilyMember } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { updateFamilyMemberAction, searchFamilyMembersAction } from '@/app/actions';
import { Input } from '@/components/ui/input';
import { AdminEditFamilyMemberDialog } from '@/components/admin/edit-family-member-dialog';

export default function FamilyAdminPage() {
  const [families, setFamilies] = useState<Record<string, FamilyMember[]>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditMemberOpen, setEditMemberOpen] = useState(false);
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
      // Group members by phone number
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
            handleSearch(); // Refresh search results
        } else {
            toast({ title: "Error", description: "Could not update member", variant: 'destructive'});
        }
    });
  }, [handleSearch, toast]);


  const handleOpenEditMember = (member: FamilyMember) => {
    setSelectedMember(member);
    setEditMemberOpen(true);
  }

  return (
    <main className="flex-1 p-4 md:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="space-y-2">
            <h1 className="text-3xl font-bold">Family Management</h1>
            <p className="text-muted-foreground">Search for families and edit member details.</p>
        </div>
        <Card>
          <CardHeader>
            <div className="flex gap-2">
              <Input 
                placeholder="Search by name, phone, or clinic ID..."
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
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                       <span className="flex items-center gap-2 text-primary">
                         <Users /> Family Account
                       </span>
                       <span className="text-sm font-mono flex items-center gap-2"><Phone className="h-4 w-4" />{phone}</span>
                    </CardTitle>
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
                             <Button variant="outline" size="sm" onClick={() => handleOpenEditMember(primary)}>
                                <Edit className="mr-2 h-4 w-4" /> Edit
                            </Button>
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
                            <Button variant="ghost" size="sm" onClick={() => handleOpenEditMember(member)}>
                                <Edit className="mr-2 h-4 w-4" /> Edit
                            </Button>
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
    </main>
  );
}
