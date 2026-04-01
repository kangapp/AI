import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center font-medium rounded-none transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary';

  const variants = {
    primary: 'bg-primary text-[#383838] hover:shadow-hard hover:translate-x-[-3px] hover:translate-y-[3px] active:translate-x-0 active:translate-y-0',
    secondary: 'bg-surface text-[#383838] border border-border hover:bg-primary-50 hover:shadow-soft',
    ghost: 'text-[#818181] hover:bg-surface hover:text-[#383838]',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
}
