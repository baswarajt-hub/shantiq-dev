
'use client';
import { useState, useEffect } from "react";
import { getSessionFeesAction, getFamilyAction, editFeeAction, deleteFeeAction, getDoctorScheduleAction } from "@/app/actions";
import type { Fee, FamilyMember, DoctorSchedule } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Banknote, Landmark, Calendar as CalendarIcon, Search, Edit, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DoctorEditFeeDialog } from "@/components/doctor/edit-fee-dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

function FeeSummaryCard({ title, fees }: { title: string, fees: Fee[] }) {
    const summary = fees.reduce(
        (acc, fee) => {
            if (fee.status === 'Paid' || fee.status === 'Locked') {
                acc.total += fee.amount;
                if (fee.mode === 'Cash') {
                    acc.cash += fee.amount;
                } else if (fee.mode === 'Online') {
                    acc.online += fee.amount;
                    if (fee.onlineType) {
                        acc.onlineBreakdown[fee.onlineType] = (acc.onlineBreakdown[fee.onlineType] || 0) + fee.amount;
                    }
                }
            }
            return acc;
        },
        { total: 0, cash: 0, online: 0, onlineBreakdown: {} as Record<string, number> }
    );
    
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">{title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <p className="text-sm text-muted-foreground">Total Collection</p>
                    <p className="text-3xl font-bold">{formatCurrency(summary.total)}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                        <Banknote className="h-5 w-5 text-green-600"/>
                        <div>
                            <p className="text-muted-foreground">Cash</p>
                            <p className="font-semibold">{formatCurrency(summary.cash)}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Landmark className="h-5 w-5 text-blue-600"/>
                        <div>
                            <p className="text-muted-foreground">Online</p>
                            <p className="font-semibold">{formatCurrency(summary.online)}</p>
                        </div>
                    </div>
                </div>
                 {Object.keys(summary.onlineBreakdown).length > 0 && (
                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    <p className="font-semibold mb-1">Online Breakup:</p>
                    <div className="flex flex-wrap gap-x-4">
                      {Object.entries(summary.onlineBreakdown).map(([type, amount]) => (
                        <span key={type}>{type}: {formatCurrency(amount)}</span>
                      ))}
                    </div>
                  </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function DoctorFinancePage() {
    const [selectedDate, setSelectedDate] = useState<Date | undefined>();
    const [morningFees, setMorningFees] = useState<Fee[]>([]);
    const [eveningFees, setEveningFees] = useState<Fee[]>([]);
    const [allFamily, setAllFamily] = useState<FamilyMember[]>([]);
    const [schedule, setSchedule] = useState<DoctorSchedule | null>(null);
    const [loading, setLoading] = useState(true);
    const [sessionFilter, setSessionFilter] = useState<'all' | 'morning' | 'evening'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [feeToEdit, setFeeToEdit] = useState<Fee | null>(null);
    const [isEditOpen, setEditOpen] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        setSelectedDate(new Date());
    }, []);

    const loadData = (date: Date) => {
        setLoading(true);
        const dateStr = format(date, 'yyyy-MM-dd');
        Promise.all([
            getSessionFeesAction(dateStr, 'morning'),
            getSessionFeesAction(dateStr, 'evening'),
            getFamilyAction(),
            getDoctorScheduleAction()
        ]).then(([morning, evening, familyData, scheduleData]) => {
            setMorningFees(morning);
            setEveningFees(evening);
            setAllFamily(familyData);
            setSchedule(scheduleData);
        }).finally(() => setLoading(false));
    };

    useEffect(() => {
        if(selectedDate) {
            loadData(selectedDate);
        }
    }, [selectedDate]);

    const familyMap = new Map(allFamily.map(f => [f.name, f]));

    const handleEditFee = async (feeId: string, updates: Partial<Omit<Fee, 'id'>>) => {
        const result = await editFeeAction(feeId, updates);
        if ('error' in result) {
            toast({ title: "Update Failed", description: result.error, variant: 'destructive' });
        } else {
            toast({ title: "Success", description: "Payment record updated."});
            if (selectedDate) loadData(selectedDate);
        }
    };

    const handleDeleteFee = async (feeId: string) => {
        const result = await deleteFeeAction(feeId);
        if ('error' in result) {
            toast({ title: "Delete Failed", description: result.error, variant: 'destructive' });
        } else {
            toast({ title: "Success", description: "Payment record deleted."});
            if (selectedDate) loadData(selectedDate);
        }
    };

    const filteredFees = [ ...morningFees, ...eveningFees].filter(fee => {
        if (sessionFilter !== 'all' && fee.session !== sessionFilter) {
            return false;
        }
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            const member = familyMap.get(fee.patientName);
            return (
                member?.clinicId?.toLowerCase().includes(lowerSearch) ||
                fee.patientName.toLowerCase().includes(lowerSearch) ||
                fee.purpose.toLowerCase().includes(lowerSearch) ||
                fee.mode.toLowerCase().includes(lowerSearch)
            );
        }
        return true;
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Financial Summary</h1>
                <div className="flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5 text-muted-foreground"/>
                    <DatePicker date={selectedDate} setDate={setSelectedDate} />
                </div>
            </div>

            {loading ? (
                <p>Loading summary...</p>
            ) : (
                <>
                <div className="grid md:grid-cols-2 gap-6">
                    <FeeSummaryCard title="Morning Session" fees={morningFees} />
                    <FeeSummaryCard title="Evening Session" fees={eveningFees} />
                </div>

                <Card>
                    <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between">
                        <div>
                            <CardTitle>Detailed Transactions</CardTitle>
                            <p className="text-sm text-muted-foreground">A log of all financial records for the selected day.</p>
                        </div>
                         <div className="flex items-center gap-2 pt-4 md:pt-0">
                             <div className="relative w-full max-w-sm">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Search by ID, name, purpose..."
                                    className="pl-8"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Select value={sessionFilter} onValueChange={(value: any) => setSessionFilter(value)}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Filter by session" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Sessions</SelectItem>
                                    <SelectItem value="morning">Morning</SelectItem>
                                    <SelectItem value="evening">Evening</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Clinic ID</TableHead>
                                    <TableHead>Patient</TableHead>
                                    <TableHead>Purpose</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Mode</TableHead>
                                    <TableHead>Session</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredFees.length > 0 ? filteredFees.map(fee => {
                                    const member = familyMap.get(fee.patientName);
                                    return (
                                        <TableRow key={fee.id}>
                                            <TableCell>{member?.clinicId || 'N/A'}</TableCell>
                                            <TableCell>{fee.patientName}</TableCell>
                                            <TableCell>{fee.purpose}</TableCell>
                                            <TableCell>{formatCurrency(fee.amount)}</TableCell>
                                            <TableCell>{fee.mode}{fee.onlineType ? ` (${fee.onlineType})` : ''}</TableCell>
                                            <TableCell>{fee.session}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => { setFeeToEdit(fee); setEditOpen(true); }}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="text-destructive">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                            <AlertDialogDescription>This will permanently delete the payment record for {fee.patientName}. This action cannot be undone.</AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteFee(fee.id)}>Delete</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </TableCell>
                                        </TableRow>
                                    )
                                }) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center">No transactions found for the selected filters.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                </>
            )}
            {feeToEdit && schedule && (
                <DoctorEditFeeDialog 
                    isOpen={isEditOpen}
                    onOpenChange={setEditOpen}
                    fee={feeToEdit}
                    onSave={handleEditFee}
                    clinicDetails={schedule.clinicDetails}
                />
            )}
        </div>
    );
}
    