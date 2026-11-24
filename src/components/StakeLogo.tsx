import React from 'react';
import { CryptoCurrency } from '../types/dice';

export const StakeLogo: React.FC<{ className?: string }> = ({ className = 'h-7 w-auto' }) => (
  <svg
    viewBox="0 0 112 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="Stake"
  >
    <text
      x="2"
      y="27"
      fill="#FFFFFF"
      fontFamily="'Brush Script MT', 'Segoe Script', 'Snell Roundhand', cursive"
      fontStyle="italic"
      fontWeight="700"
      fontSize="31"
      letterSpacing="-0.5"
    >
      Stake
    </text>
  </svg>
);

export const TokenIcon: React.FC<{
  currency?: CryptoCurrency;
  className?: string;
}> = ({ currency = 'USDT', className = 'w-4 h-4' }) => {
  switch (currency) {
    case 'BTC':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="11" fill="#F7931A" />
          <path
            d="M15.8 10.75C16.05 9.1 14.8 8.2 13.1 7.62L13.65 5.4L12.3 5.06L11.77 7.22C11.42 7.13 11.06 7.05 10.7 6.97L11.24 4.8L9.89 4.46L9.34 6.68C9.05 6.61 8.76 6.55 8.48 6.48L6.62 6.01L6.26 7.45C6.26 7.45 7.26 7.68 7.24 7.69C7.79 7.83 7.89 8.19 7.87 8.48L7.24 11.01L6.35 14.57C6.28 14.74 6.11 15 5.72 14.9C5.73 14.92 4.74 14.66 4.74 14.66L4.07 16.21L5.83 16.65C6.16 16.73 6.48 16.82 6.8 16.9L6.24 19.15L7.59 19.49L8.14 17.27C8.51 17.37 8.87 17.46 9.22 17.55L8.67 19.76L10.02 20.1L10.58 17.85C12.88 18.28 14.61 18.11 15.34 16.03C15.92 14.36 15.31 13.4 14.11 12.77C14.99 12.57 15.65 11.99 15.8 10.75ZM12.82 14.93C12.41 16.6 9.6 15.7 8.69 15.47L9.43 12.5C10.34 12.73 13.25 13.19 12.82 14.93ZM13.23 10.72C12.85 12.24 10.51 11.47 9.75 11.28L10.42 8.59C11.18 8.78 13.62 9.13 13.23 10.72Z"
            fill="#FFFFFF"
          />
        </svg>
      );
    case 'ETH':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="11" fill="#627EEA" />
          <path d="M12 4.5L7.4 12.1L12 14.8L16.6 12.1L12 4.5Z" fill="#FFFFFF" fillOpacity="0.95" />
          <path d="M12 4.5V14.8L16.6 12.1L12 4.5Z" fill="#FFFFFF" fillOpacity="0.65" />
          <path d="M12 15.8L7.4 13.1L12 19.5L16.6 13.1L12 15.8Z" fill="#FFFFFF" fillOpacity="0.95" />
          <path d="M12 15.8V19.5L16.6 13.1L12 15.8Z" fill="#FFFFFF" fillOpacity="0.65" />
        </svg>
      );
    case 'SOL':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="solGrad" x1="6" y1="18" x2="18" y2="6" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#9945FF" />
              <stop offset="55%" stopColor="#00D1FF" />
              <stop offset="100%" stopColor="#14F195" />
            </linearGradient>
          </defs>
          <circle cx="12" cy="12" r="11" fill="#131B26" stroke="#2F4553" strokeWidth="1" />
          <path d="M7.3 15.2H15.6L17.1 17H8.8L7.3 15.2Z" fill="url(#solGrad)" />
          <path d="M7.3 7H15.6L17.1 8.8H8.8L7.3 7Z" fill="url(#solGrad)" />
          <path d="M8.8 11.1H17.1L15.6 12.9H7.3L8.8 11.1Z" fill="url(#solGrad)" />
        </svg>
      );
    case 'POL':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="11" fill="#8247E5" />
          <path
            d="M15.4 9.5C15.1 9.35 14.75 9.35 14.45 9.5L12.3 10.75L10.85 11.58L8.7 12.83C8.4 12.98 8.05 12.98 7.75 12.83L6.08 11.86C5.78 11.7 5.6 11.38 5.6 11.04V9.13C5.6 8.79 5.78 8.47 6.08 8.31L7.75 7.35C8.05 7.19 8.4 7.19 8.7 7.35L10.36 8.31C10.66 8.47 10.84 8.79 10.84 9.13V10.35L12.3 9.51V8.27C12.3 7.93 12.12 7.61 11.82 7.45L8.7 5.65C8.4 5.49 8.05 5.49 7.75 5.65L4.62 7.45C4.32 7.61 4.14 7.93 4.14 8.27V11.88C4.14 12.22 4.32 12.54 4.62 12.7L7.75 14.5C8.05 14.66 8.4 14.66 8.7 14.5L10.85 13.27L12.3 12.43L14.45 11.19C14.75 11.03 15.1 11.03 15.4 11.19L17.07 12.15C17.37 12.31 17.55 12.63 17.55 12.97V14.88C17.55 15.22 17.37 15.54 17.07 15.7L15.4 16.66C15.1 16.82 14.75 16.82 14.45 16.66L12.78 15.7C12.48 15.54 12.3 15.22 12.3 14.88V13.66L10.85 14.5V15.73C10.85 16.07 11.03 16.39 11.33 16.55L14.45 18.35C14.75 18.51 15.1 18.51 15.4 18.35L18.52 16.55C18.82 16.39 19 16.07 19 15.73V12.12C19 11.78 18.82 11.46 18.52 11.3L15.4 9.5Z"
            fill="#FFFFFF"
          />
        </svg>
      );
    case 'BNB':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="11" fill="#F3BA2F" />
          <path
            d="M12 5.2L9.2 8L10.65 9.45L12 8.1L13.35 9.45L14.8 8L12 5.2ZM6.6 10.6L5.2 12L6.6 13.4L8 12L6.6 10.6ZM12 10.55L10.55 12L12 13.45L13.45 12L12 10.55ZM17.4 10.6L16 12L17.4 13.4L18.8 12L17.4 10.6ZM12 15.9L10.65 14.55L9.2 16L12 18.8L14.8 16L13.35 14.55L12 15.9Z"
            fill="#FFFFFF"
          />
        </svg>
      );
    case 'USDT':
    default:
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="11" fill="#26A17B" />
          <path
            d="M13.2 10.6V8.5H16.8V6.2H7.2V8.5H10.8V10.6C7.9 10.75 5.8 11.4 5.8 12.15C5.8 12.9 7.9 13.55 10.8 13.7V18.2H13.2V13.7C16.1 13.55 18.2 12.9 18.2 12.15C18.2 11.4 16.1 10.75 13.2 10.6ZM12 13.1C9.5 13.1 7.5 12.65 7.5 12.15C7.5 11.65 9.5 11.2 12 11.2C14.5 11.2 16.5 11.65 16.5 12.15C16.5 12.65 14.5 13.1 12 13.1Z"
            fill="#FFFFFF"
          />
        </svg>
      );
  }
};

