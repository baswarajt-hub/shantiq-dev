
'use client';
import { useState, useEffect } from "react";
import { getSessionFeesAction } from "@/app/actions";
import type { Fee } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Banknote, Landmark, Calendar as CalendarIcon, Sun, Moon } from "lucide-react";

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

export default function FinancePage() {
    const [selectedDate, setSelectedDate] = useState<Date | undefined>();
    const [morningFees, setMorningFees] = useState<Fee[]>([]);
    const [eveningFees, setEveningFees] = useState<Fee[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Set initial date on the client to avoid hydration mismatch
        setSelectedDate(new Date());
    }, []);

    useEffect(() => {
        if(selectedDate) {
            setLoading(true);
            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            Promise.all([
                getSessionFeesAction(dateStr, 'morning'),
                getSessionFeesAction(dateStr, 'evening')
            ]).then(([morning, evening]) => {
                setMorningFees(morning);
                setEveningFees(evening);
            }).finally(() => setLoading(false));
        }
    }, [selectedDate]);

    const allFees = [...morningFees, ...eveningFees];

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
                    <CardHeader>
                        <CardTitle>Detailed Transactions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Patient</TableHead>
                                    <TableHead>Purpose</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Mode</TableHead>
                                    <TableHead>Session</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {allFees.length > 0 ? allFees.map(fee => (
                                    <TableRow key={fee.id}>
                                        <TableCell>{fee.patientName}</TableCell>
                                        <TableCell>{fee.purpose}</TableCell>
                                        <TableCell>{formatCurrency(fee.amount)}</TableCell>
                                        <TableCell>{fee.mode}{fee.onlineType ? ` (${fee.onlineType})` : ''}</TableCell>
                                        <TableCell>{fee.session}</TableCell>
                                        <TableCell>{fee.status}</TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center">No transactions for this day.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                </>
            )}
        </div>
    );
}
