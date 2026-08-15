import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'glass';
  hasShortcut?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  hasShortcut = false,
  className = '',
  ...props
}) => {

  if (variant === 'primary') {
    return (
      <button
        id="primary-cta-btn"
        className={`
          cursor-pointer group relative inline-flex items-center gap-3 px-8 py-3.5 
          bg-gradient-to-b from-brand-300 to-brand-400 
          text-brand-900 font-normal text-lg rounded-lg
          transition-all duration-200 ease-in-out
          shadow-hero hover:-translate-y-0.5
          active:translate-y-[1px] active:shadow-hero-active
          border border-brand-400
          ${className}
        `}
        style={{ WebkitTextStrokeWidth: '0.2px' }}
        {...props}
      >
        <span>{children}</span>
        {hasShortcut && (
          <div className="hidden sm:flex items-center justify-center w-6 h-6 bg-brand-200/50 rounded border border-brand-600/20 text-xs font-bold uppercase text-brand-900/70">
            B
          </div>
        )}
      </button>
    );
  }

  if (variant === 'glass') {
    return (
      <button
        className={`
          px-4 py-2 rounded-full text-sm font-medium
          text-brand-600 hover:text-stone-900
          hover:bg-stone-100/50 transition-colors
          ${className}
        `}
        {...props}
      >
        {children}
      </button>
    )
  }

  return (
    <button
      className={`px-6 py-3 rounded-lg font-medium transition-colors ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;