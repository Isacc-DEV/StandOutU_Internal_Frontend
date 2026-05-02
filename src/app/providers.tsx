'use client';

import { useEffect } from 'react';
import { isApiNetworkError, isApiUnauthorizedError } from '../lib/api';
import { handleError } from '../lib/errorHandler';

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Handle unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      if (isApiUnauthorizedError(event.reason)) return;
      handleError(event.reason, 'An error occurred. Please contact the administrator.');
    };

    // Handle uncaught errors
    const handleErrorEvent = (event: ErrorEvent) => {
      event.preventDefault();
      const error = event.error || event.message;
      if (isApiUnauthorizedError(error)) return;
      handleError(error, 'An error occurred. Please contact the administrator.');
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleErrorEvent);

    const original = console.error;
    console.error = (...args: unknown[]) => {
      if (args.some(isApiUnauthorizedError)) return;
      if (args.some(isApiNetworkError)) return;
      if (
        args.some(
          (arg) =>
            typeof arg === 'string' &&
            (arg === 'Unauthorized' ||
              arg === 'u need to login' ||
              arg.startsWith('Network error contacting API')),
        )
      ) {
        return;
      }
      original(...args);
    };
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleErrorEvent);
      console.error = original;
    };
  }, []);

  return <>{children}</>;
}
