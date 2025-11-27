'use client';

import { useState, useTransition } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label'; 
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Upload } from 'lucide-react';
import { patientImportAction } from '@/app/actions';

export function PatientImport() {
  const [familyFile, setFamilyFile] = useState<File | null>(null);
  const [childFile, setChildFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, startTransition] = useTransition();
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, type: 'family' | 'child') => {
    if (event.target.files && event.target.files[0]) {
      if (type === 'family') setFamilyFile(event.target.files[0]);
      else setChildFile(event.target.files[0]);
    }
  };

  const parseExcelFile = (file: File): Promise<any[]> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const workbook = XLSX.read(event.target?.result, { type: 'binary' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(sheet);
          resolve(jsonData);
        } catch (err: any) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsBinaryString(file);
    });

  const handleImport = async () => {
    if (!familyFile || !childFile) {
      toast({
        title: 'Missing files',
        description: 'Please select both Family and Child Excel files to import.',
        variant: 'destructive',
      });
      return;
    }

    setIsParsing(true);
    toast({
      title: 'Processing files...',
      description: 'Reading and validating Excel data. Please wait.',
    });

    try {
      const [familyData, childData] = await Promise.all([
        parseExcelFile(familyFile),
        parseExcelFile(childFile),
      ]);

      if (familyData.length === 0 || !(familyData[0] as any)?.phone) {
        toast({
          title: 'Invalid Family Excel',
          description: "Family file must include at least a 'phone' column.",
          variant: 'destructive',
        });
        setIsParsing(false);
        return;
      }

      if (childData.length === 0 || !(childData[0] as any)?.name) {
        toast({
          title: 'Invalid Child Excel',
          description: "Child file must include at least a 'name' column.",
          variant: 'destructive',
        });
        setIsParsing(false);
        return;
      }

      // Prepare FormData for both files
      // Convert parsed Excel JSON to strings for the server action
      const familyJson = JSON.stringify(familyData);
      const childJson = JSON.stringify(childData);

      setIsParsing(false);
      startTransition(async () => {
        const result = await patientImportAction(familyJson, childJson);

        if ("error" in result) {
          toast({ title: "Import Failed", description: result.error, variant: "destructive" });
        } else {
          toast({
            title: "Import Successful",
            description: result.success || "Data imported successfully.",
          });
        }

        // Reset
        setFamilyFile(null);
        setChildFile(null);
        const familyInput = document.getElementById("family-excel") as HTMLInputElement;
        const childInput = document.getElementById("child-excel") as HTMLInputElement;
        if (familyInput) familyInput.value = "";
        if (childInput) childInput.value = "";
      });

    } catch (err: any) {
      console.error(err);
      setIsParsing(false);
      toast({
        title: 'Parsing Error',
        description: err.message || 'Error reading one of the Excel files.',
        variant: 'destructive',
      });
    }
  };

  const isProcessing = isParsing || isUploading;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import Patient Data</CardTitle>
        <CardDescription>
          Upload two Excel files — one for Family records and one for Child records — to bulk import data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Upload className="h-4 w-4" />
          <AlertTitle>Excel File Format</AlertTitle>
          <AlertDescription>
            <strong>Family File:</strong> Columns: <code>phone</code>, <code>fatherName</code>,{' '}
            <code>motherName</code>, <code>primaryContact</code>, <code>email</code>,{' '}
            <code>location</code>, <code>city</code>, <code>clinicId</code>. <br />
            <strong>Child File:</strong> Columns: <code>name</code>, <code>phone</code>,{' '}
            <code>dob</code>, <code>gender</code>, <code>clinicId</code>. DOB must be in{' '}
            <code>YYYY-MM-DD</code> format.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="family-excel">Upload Family Excel</Label>
          <Input
            id="family-excel"
            type="file"
            accept=".xlsx, .xls"
            onChange={(e) => handleFileChange(e, 'family')}
            disabled={isProcessing}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="child-excel">Upload Child Excel</Label>
          <Input
            id="child-excel"
            type="file"
            accept=".xlsx, .xls"
            onChange={(e) => handleFileChange(e, 'child')}
            disabled={isProcessing}
          />
        </div>

        <div className="flex items-center gap-4 pt-4">
          <Button onClick={handleImport} disabled={isProcessing || !familyFile || !childFile}>
            {isParsing ? 'Processing...' : isUploading ? 'Importing...' : 'Import'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
