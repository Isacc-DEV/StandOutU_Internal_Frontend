/**
 * Global error handler utility
 * Shows alerts for errors instead of displaying them on the page
 */

export function showErrorAlert(message?: string) {
  const errorMessage = message || 'An error occurred. Please contact the administrator.';
  alert(errorMessage);
}

export function handleError(error: unknown, defaultMessage?: string): void {
  let message = defaultMessage || 'An error occurred. Please contact the administrator.';
  
  if (error instanceof Error) {
    // Try to parse JSON error messages
    try {
      const parsed = JSON.parse(error.message);
      if (parsed?.message) {
        message = parsed.message;
      } else {
        message = error.message;
      }
    } catch {
      // If not JSON, use the error message directly
      message = error.message || message;
    }
  } else if (typeof error === 'string') {
    message = error;
  }
  
  showErrorAlert(message);
}
