import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function Input({ className = '', error = false, ...props }: InputProps) {
  return (
    <input
      className={`w-full px-4 py-2 border rounded-none transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
        error ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 bg-background text-[#383838]'
      } ${className}`}
      {...props}
    />
  );
}
