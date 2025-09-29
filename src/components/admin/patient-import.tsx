
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
    const [isParsing, setIsParsing] = useState(false);
    const [isUploading, startTransition] = useTransition();
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

        setIsParsing(true);
        toast({ title: 'Processing file...', description: 'Please wait, this may take a moment for large files.' });

        const workerCode = `
            self.importScripts("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
            self.onmessage = function(e) {
                const file = e.data;
                const reader = new FileReader();
                reader.onload = function(event) {
                    const arrayBuffer = event.target.result;
                    try {
                        const workbook = self.XLSX.read(arrayBuffer, { type: 'buffer' });
                        const sheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[sheetName];
                        const data = self.XLSX.utils.sheet_to_json(worksheet);
                        self.postMessage({ success: true, data: data });
                    } catch (error) {
                        self.postMessage({ success: false, error: error.message });
                    }
                };
                reader.readAsArrayBuffer(file);
            };
        `;
        
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const worker = new Worker(URL.createObjectURL(blob));

        worker.onmessage = (e) => {
            setIsParsing(false);
            worker.terminate();

            if (!e.data.success) {
                toast({ title: 'Parsing Error', description: e.data.error || 'Could not parse the Excel file.', variant: 'destructive'});
                return;
            }

            const data = e.data.data;

            if (data.length === 0 || !(data[0] as any)?.phone) {
                toast({ title: 'Invalid Excel Format', description: "File must include at least a 'phone' header.", variant: 'destructive'});
                return;
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
        };

        worker.onerror = (e) => {
            setIsParsing(false);
            worker.terminate();
            toast({ title: 'Worker Error', description: 'An unexpected error occurred during file processing.', variant: 'destructive' });
            console.error('Worker error:', e);
        };

        worker.postMessage(file);
    };

    const isProcessing = isParsing || isUploading;

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
                    <Input id="excel-import" type="file" accept=".xlsx, .xls" onChange={handleFileChange} disabled={isProcessing} />
                    <Button onClick={handleImport} disabled={isProcessing || !file}>
                        {isParsing ? 'Processing...' : isUploading ? 'Importing...' : 'Import'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
