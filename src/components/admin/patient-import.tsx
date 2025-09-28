
'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Upload } from 'lucide-react';
import type { FamilyMember } from '@/lib/types';
import { patientImportAction } from '@/app/actions';

function parseCSV(csvText: string): any[] {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        // Handle potential commas within quoted fields
        const values = lines[i].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || [];
        if (values.length !== headers.length) continue; // Skip malformed rows
        
        const entry: any = {};
        for (let j = 0; j < headers.length; j++) {
            entry[headers[j]] = values[j] || '';
        }
        data.push(entry);
    }
    return data;
}


export function PatientImport() {
    const [file, setFile] = useState<File | null>(null);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setFile(event.target.files[0]);
        }
    };

    const handleImport = () => {
        if (!file) {
            toast({ title: 'No file selected', description: 'Please select a CSV file to import.', variant: 'destructive' });
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            try {
                const data = parseCSV(text);
                
                // Basic validation
                if (data.length === 0 || !data[0].phone || !data[0].name) {
                    throw new Error("Invalid CSV format or empty file. CSV must include at least 'phone' and 'name' headers.");
                }

                startTransition(async () => {
                    const result = await patientImportAction(data);
                    if (result.error) {
                        toast({ title: 'Import Failed', description: result.error, variant: 'destructive' });
                    } else {
                        toast({ title: 'Import Successful', description: result.success });
                    }
                    setFile(null);
                    // Clear the file input visually
                    const fileInput = document.getElementById('csv-import') as HTMLInputElement;
                    if(fileInput) fileInput.value = '';
                });

            } catch (error: any) {
                console.error("CSV Parsing Error:", error);
                toast({ title: 'Parsing Error', description: error.message || 'Could not parse the CSV file.', variant: 'destructive'});
            }
        };
        reader.readAsText(file);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Import Patient Data</CardTitle>
                <CardDescription>Upload a CSV file to bulk-add family and patient records.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Alert>
                    <Upload className="h-4 w-4" />
                    <AlertTitle>CSV File Format</AlertTitle>
                    <AlertDescription>
                        Headers must be: `phone,fatherName,motherName,primaryContact,email,location,city,name,dob,gender,clinicId`.
                        `dob` must be `YYYY-MM-DD`. `primaryContact` must be `Father` or `Mother`. `name` is the patient's name.
                    </AlertDescription>
                </Alert>
                <div className="flex items-center gap-4">
                    <Input id="csv-import" type="file" accept=".csv" onChange={handleFileChange} />
                    <Button onClick={handleImport} disabled={isPending || !file}>
                        {isPending ? 'Importing...' : 'Import'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
