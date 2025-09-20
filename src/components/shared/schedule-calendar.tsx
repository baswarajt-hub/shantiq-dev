
'use client';

import { Calendar, type CalendarProps } from "@/components/ui/calendar";
import type { DoctorSchedule } from "@/lib/types";

type ScheduleCalendarProps = CalendarProps & {
    schedule: DoctorSchedule;
};

const dayOfWeekMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function ScheduleCalendar({ schedule, ...props }: ScheduleCalendarProps) {
    const disabledDays = [{ before: new Date(new Date().setDate(new Date().getDate())) }];

    if (schedule && schedule.days) {
        Object.entries(schedule.days).forEach(([dayName, daySchedule]) => {
            if (!daySchedule.morning.isOpen && !daySchedule.evening.isOpen) {
                const dayIndex = dayOfWeekMap.indexOf(dayName);
                if(dayIndex !== -1) {
                    disabledDays.push({ dayOfWeek: [dayIndex] });
                }
            }
        });

         schedule.specialClosures.forEach(closure => {
            if(closure.isMorningClosed && closure.isEveningClosed) {
                disabledDays.push(new Date(closure.date + 'T00:00:00'));
            }
             if(closure.morningOverride && !closure.morningOverride.isOpen && closure.eveningOverride && !closure.eveningOverride.isOpen) {
                 disabledDays.push(new Date(closure.date + 'T00:00:00'));
            }
        });
    }

    return (
        <Calendar
            disabled={disabledDays}
            {...props}
        />
    );
}
