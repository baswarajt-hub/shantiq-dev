'use client';

import { PatientPortalHeader } from "@/components/patient-portal-header";
import { getDoctorScheduleAction } from "../actions";
import { type DoctorSchedule } from "@/lib/types";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function PatientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [schedule, setSchedule] = useState<DoctorSchedule | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSchedule() {
      try {
        const scheduleData = await getDoctorScheduleAction();
        setSchedule(scheduleData);
      } catch (error) {
        console.error("Failed to load schedule", error);
      } finally {
        setLoading(false);
      }
    }
    loadSchedule();
  }, []);

  const childrenWithProps = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, { schedule } as any);
    }
    return child;
  });

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#e0e1ee' }}>
      <PatientPortalHeader
        logoSrc={schedule?.clinicDetails?.clinicLogo}
        clinicName={schedule?.clinicDetails?.clinicName}
        googleMapsLink={schedule?.clinicDetails?.googleMapsLink}
      />
      {loading ? (
         <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-2xl space-y-8">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
         </main>
      ) : childrenWithProps}
    </div>
  );
}
