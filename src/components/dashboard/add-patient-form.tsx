'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRef } from "react";

type AddPatientFormProps = {
  onSubmit: (formData: FormData) => void;
  isPending: boolean;
};

export function AddPatientForm({ onSubmit, isPending }: AddPatientFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onSubmit(formData);
    formRef.current?.reset();
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Patient Name</Label>
        <Input
          id="name"
          name="name"
          placeholder="e.g. John Doe"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone Number</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          placeholder="e.g. 555-123-4567"
          required
        />
      </div>
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Adding...' : 'Add to Queue'}
      </Button>
    </form>
  );
}
