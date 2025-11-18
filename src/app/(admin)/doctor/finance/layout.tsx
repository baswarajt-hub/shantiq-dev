
'use client';

import Header from "@/components/header";
import { getDoctorScheduleAction } from "@/app/actions";
import { type DoctorSchedule } from "@/lib/types";
import { useEffect, useState } from "react";

export default function DoctorFinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [schedule, setSchedule] = useState<DoctorSchedule | null>(null);

  useEffect(() => {
    async function load() {
      const data = await getDoctorScheduleAction();
      setSchedule(data);
    }
    load();
  }, []);

  return (
    <>
      <Header logoSrc={schedule?.clinicDetails.clinicLogo} clinicName={schedule?.clinicDetails.clinicName} />
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="mx-auto w-full max-w-6xl space-y-6">
            {children}
        </div>
      </main>
    </>
  );
}

    