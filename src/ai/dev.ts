import { config } from 'dotenv';
config();

import '@/ai/flows/estimate-consultation-time.ts';
import '@/ai/flows/send-appointment-reminders.ts';
import '@/ai/flows/translate-text.ts';
