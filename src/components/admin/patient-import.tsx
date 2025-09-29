
'use client';

import { useState, useTransition } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Upload } from 'lucide-react';
import { patientImportAction } from '@/app/actions';

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
            toast({ title: 'No file selected', description: 'Please select an Excel file to import.', variant: 'destructive' });
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const arrayBuffer = e.target?.result;
            if (!arrayBuffer) {
                 toast({ title: 'Error reading file', description: 'Could not read the selected file.', variant: 'destructive'});
                 return;
            }

            try {
                const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(worksheet);

                if (data.length === 0 || !(data[0] as any)?.phone) {
                    throw new Error("Invalid Excel format or empty file. File must include at least a 'phone' header.");
                }

                startTransition(async () => {
                    const result = await patientImportAction(data);
                    if (result.error) {
                        toast({ title: 'Import Failed', description: result.error, variant: 'destructive' });
                    } else {
                        toast({ title: 'Import Successful', description: result.success });
                    }
                    setFile(null);
                    const fileInput = document.getElementById('excel-import') as HTMLInputElement;
                    if(fileInput) fileInput.value = '';
                });

            } catch (error: any) {
                console.error("Excel Parsing Error:", error);
                toast({ title: 'Parsing Error', description: error.message || 'Could not parse the Excel file.', variant: 'destructive'});
            }
        };
        reader.readAsArrayBuffer(file);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Import Patient Data</CardTitle>
                <CardDescription>Upload an Excel file (.xlsx) to bulk-add family and patient records.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Alert>
                    <Upload className="h-4 w-4" />
                    <AlertTitle>Excel File Format</AlertTitle>
                    <AlertDescription>
                        Required headers: `phone`, `name`. Optional headers: `fatherName`, `motherName`, `primaryContact`, `email`, `location`, `city`, `dob`, `gender`, `clinicId`. DOB must be `YYYY-MM-DD`.
                    </AlertDescription>
                </Alert>
                <div className="flex items-center gap-4">
                    <Input id="excel-import" type="file" accept=".xlsx, .xls" onChange={handleFileChange} />
                    <Button onClick={handleImport} disabled={isPending || !file}>
                        {isPending ? 'Importing...' : 'Import'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
