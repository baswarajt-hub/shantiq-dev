
'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Fee } from "@/lib/types";
import { DollarSign, Banknote, Landmark } from "lucide-react";
import { Separator } from "../ui/separator";

type FeeSummaryProps = {
  fees: Fee[];
};

export default function FeeSummary({ fees }: FeeSummaryProps) {
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

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

  return (
    <Card className="col-span-2 sm:col-span-2 lg:col-span-2 bg-white/70 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            Session Fee Collection
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-3xl font-bold">{formatCurrency(summary.total)}</p>
        <Separator />
        <div className="text-sm text-muted-foreground grid grid-cols-2 gap-x-4">
           <div className="flex items-center gap-2">
             <Banknote className="h-4 w-4"/>
             <span>Cash:</span>
             <span className="font-semibold text-foreground">{formatCurrency(summary.cash)}</span>
           </div>
           <div className="flex items-center gap-2">
             <Landmark className="h-4 w-4"/>
             <span>Online:</span>
             <span className="font-semibold text-foreground">{formatCurrency(summary.online)}</span>
           </div>
        </div>
        {Object.keys(summary.onlineBreakdown).length > 0 && (
          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 pl-6">
            {Object.entries(summary.onlineBreakdown).map(([type, amount]) => (
              <span key={type}>
                {type}: {formatCurrency(amount)}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
