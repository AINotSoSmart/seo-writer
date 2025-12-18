import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  children,
  className = '',
  icon,
  ...props
}) => {

  const baseStyles = "inline-flex items-center justify-center font-display font-bold border-2 border-black transition-all duration-200 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-brand-yellow text-black shadow-neo hover:-translate-y-0.5 hover:translate-x-0.5 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]",
    secondary: "bg-white text-black shadow-neo hover:-translate-y-0.5 hover:translate-x-0.5 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]",
    outline: "bg-transparent text-black border-black hover:bg-gray-50",
    ghost: "bg-transparent border-transparent shadow-none hover:bg-gray-100/50 font-medium font-sans",
  };

  const sizes = {
    sm: "text-sm px-3 py-1.5",
    md: "text-base px-6 py-3",
    lg: "text-lg px-8 py-4",
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthClass} ${className}`}
      {...props}
    >
      {children}
      {icon && <span className="ml-2">{icon}</span>}
    </button>
  );
};