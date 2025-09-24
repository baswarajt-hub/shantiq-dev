
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

// A simple CSV parser
function parseCSV(csvText: string): Omit<FamilyMember, 'id' | 'avatar'>[] {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const entry: any = {};
        for (let j = 0; j < headers.length; j++) {
            const header = headers[j];
            let value: any = values[j];

            if (header === 'isPrimary') {
                value = value.toLowerCase() === 'true';
            } else if (!value) {
                // Assign empty string or undefined for optional fields
                value = (header === 'email' || header === 'location' || header === 'city' || header === 'clinicId') ? '' : value;
            }
            
            entry[header] = value;
        }
        data.push(entry);
    }
    return data as Omit<FamilyMember, 'id' | 'avatar'>[];
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
                    throw new Error("Invalid CSV format or empty file.");
                }

                startTransition(async () => {
                    const result = await patientImportAction(data);
                    if (result.error) {
                        toast({ title: 'Import Failed', description: result.error, variant: 'destructive' });
                    } else {
                        toast({ title: 'Import Successful', description: result.success });
                    }
                    setFile(null);
                });

            } catch (error) {
                console.error("CSV Parsing Error:", error);
                toast({ title: 'Parsing Error', description: 'Could not parse the CSV file. Please check the format and try again.', variant: 'destructive'});
            }
        };
        reader.readAsText(file);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Import Patient Data</CardTitle>
                <CardDescription>Upload a CSV file to bulk-add patient and family records.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Alert>
                    <Upload className="h-4 w-4" />
                    <AlertTitle>CSV File Format</AlertTitle>
                    <AlertDescription>
                        Ensure your file has the headers: `phone,isPrimary,name,dob,gender,email,location,city,clinicId`.
                        `dob` must be in YYYY-MM-DD format. `isPrimary` must be TRUE or FALSE.
                    </AlertDescription>
                </Alert>
                <div className="flex items-center gap-4">
                    <Input type="file" accept=".csv" onChange={handleFileChange} />
                    <Button onClick={handleImport} disabled={isPending || !file}>
                        {isPending ? 'Importing...' : 'Import'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
