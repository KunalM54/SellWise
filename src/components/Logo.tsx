import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 44 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
    >
      {/* Sky Blue Rounded Container */}
      <rect width="64" height="64" rx="16" fill="#3B82F6" />
      
      {/* Shopping Bag Handle */}
      <path
        d="M22 24V19C22 13.4772 26.4772 9 32 9C37.5228 9 42 13.4772 42 19V24"
        stroke="white"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      
      {/* Shopping Bag Body */}
      <path
        d="M16 22H48L44.5 53C44.3 54.7 42.9 56 41.2 56H22.8C21.1 56 19.7 54.7 19.5 53L16 22Z"
        fill="#1D4ED8"
        stroke="white"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      
      {/* Leaf Green Profit Verified Badge */}
      <circle cx="44" cy="44" r="11" fill="#22C55E" stroke="white" strokeWidth="3" />
      <path
        d="M39.5 44L42.5 47L48.5 41"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
