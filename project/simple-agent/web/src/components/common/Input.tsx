import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function Input({ className = '', error = false, ...props }: InputProps) {
  return (
    <input
      className={`w-full px-4 py-2 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
        error ? 'border-red-500 focus:ring-red-500' : 'border-gray-200'
      } ${className}`}
      {...props}
    />
  );
}
