'use server';

/**
 * @fileOverview Estimates consultation times dynamically using patient flow data, late arrivals, and doctor delays.
 *
 * - estimateConsultationTime - A function that estimates the consultation time.
 * - EstimateConsultationTimeInput - The input type for the estimateConsultationTime function.
 * - EstimateConsultationTimeOutput - The return type for the estimateConsultationTime function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EstimateConsultationTimeInputSchema = z.object({
  patientFlowData: z
    .string()
    .describe(
      'Historical data about patient flow, including average consultation times for different appointment types.'
    ),
  lateArrivals: z
    .string()
    .describe(
      'Information about patients arriving late for their appointments, including the amount of delay.'
    ),
  doctorDelays: z
    .string()
    .describe(
      'Information about doctor delays, including the amount of delay and the reasons for the delay.'
    ),
  currentQueueLength: z
    .number()
    .describe('The number of patients currently waiting in the queue.'),
  appointmentType: z
    .string()
    .describe(
      'The type of appointment (e.g., routine checkup, follow-up, emergency).'
    ),
});
export type EstimateConsultationTimeInput = z.infer<
  typeof EstimateConsultationTimeInputSchema
>;

const EstimateConsultationTimeOutputSchema = z.object({
  estimatedConsultationTime: z
    .number()
    .describe(
      'The estimated consultation time in minutes, taking into account patient flow data, late arrivals, doctor delays, and current queue length.'
    ),
  confidenceLevel: z
    .string()
    .describe(
      'A qualitative assessment of the confidence level in the estimated consultation time (e.g., high, medium, low).'
    ),
  reasoning: z
    .string()
    .describe(
      'A brief explanation of the factors that influenced the estimated consultation time.'
    ),
});

export type EstimateConsultationTimeOutput = z.infer<
  typeof EstimateConsultationTimeOutputSchema
>;

export async function estimateConsultationTime(
  input: EstimateConsultationTimeInput
): Promise<EstimateConsultationTimeOutput> {
  return estimateConsultationTimeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'estimateConsultationTimePrompt',
  input: {schema: EstimateConsultationTimeInputSchema},
  output: {schema: EstimateConsultationTimeOutputSchema},
  prompt: `You are an expert in predicting consultation times in a clinic.

  Based on the following information, estimate the consultation time in minutes:

  Patient Flow Data: {{{patientFlowData}}}
  Late Arrivals: {{{lateArrivals}}}
  Doctor Delays: {{{doctorDelays}}}
  Current Queue Length: {{{currentQueueLength}}}
  Appointment Type: {{{appointmentType}}}

  Consider all these factors and provide a reasonable estimate. Also, provide a confidence level (high, medium, low) for your estimate and a brief explanation of your reasoning.

  Format your response as a JSON object with the following keys:
  - estimatedConsultationTime (number): The estimated consultation time in minutes.
  - confidenceLevel (string): A qualitative assessment of the confidence level.
  - reasoning (string): A brief explanation of the factors influencing the estimate.
  `,
});

const estimateConsultationTimeFlow = ai.defineFlow(
  {
    name: 'estimateConsultationTimeFlow',
    inputSchema: EstimateConsultationTimeInputSchema,
    outputSchema: EstimateConsultationTimeOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
