
'use client';

import * as React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button, type ButtonProps } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SplitButtonProps extends ButtonProps {
  mainAction: {
    label: React.ReactNode;
    onClick: () => void;
  };
  dropdownActions: {
    label: React.ReactNode;
    onClick: () => void;
  }[];
  disabled?: boolean;
}

export function SplitButton({
  mainAction,
  dropdownActions,
  disabled,
  className,
  ...props
}: SplitButtonProps) {
  return (
    <div className={cn('inline-flex rounded-md shadow-sm', className)}>
      <Button
        onClick={mainAction.onClick}
        disabled={disabled}
        className="rounded-r-none"
        {...props}
      >
        {mainAction.label}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={props.variant || 'default'}
            size="icon"
            disabled={disabled}
            className="rounded-l-none border-l h-full w-8 px-2"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {dropdownActions.map((action, index) => (
            <DropdownMenuItem key={index} onSelect={action.onClick}>
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
