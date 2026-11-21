import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom';
import { AlertTriangle, Home, RefreshCcw } from 'lucide-react';

export function ErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();

  let errorMessage: string;
  let errorTitle: string;

  if (isRouteErrorResponse(error)) {
    // page not found, 401, 500, etc.
    errorTitle = `${error.status} ${error.statusText}`;
    errorMessage = error.data?.message || 'Something went wrong.';
  } else if (error instanceof Error) {
    // JS errors (like failed imports)
    errorTitle = 'Application Error';
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorTitle = 'Error';
    errorMessage = error;
  } else {
    errorTitle = 'Unknown Error';
    errorMessage = 'An unexpected error occurred.';
  }

  // Check for dynamic import errors specifically
  const isImportError = errorMessage.includes('Failed to fetch dynamically imported module');

  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-bg-app p-6 text-center animate-in fade-in duration-300">
      <div className="bg-red-500/10 p-6 rounded-full mb-6">
        <AlertTriangle className="w-16 h-16 text-red-500" />
      </div>
      
      <h1 className="text-3xl font-black text-text-primary mb-2">
        {errorTitle}
      </h1>
      
      <p className="text-text-secondary max-w-md mb-8 leading-relaxed">
        {errorMessage}
      </p>

      {isImportError && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 max-w-md mb-8 text-left">
          <p className="text-sm text-text-primary font-bold mb-1">💡 Developer Tip:</p>
          <p className="text-xs text-text-secondary">
            This often happens when a new dependency was added while the development server was running. 
            Try restarting the terminal/server.
          </p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={() => window.location.reload()}
          className="flex items-center space-x-2 px-6 py-3 bg-accent-primary hover:bg-accent-hover text-white rounded-xl font-bold transition-all shadow-lg active:scale-95"
        >
          <RefreshCcw className="w-4 h-4" />
          <span>Reload Page</span>
        </button>
        
        <button
          onClick={() => navigate('/')}
          className="flex items-center space-x-2 px-6 py-3 bg-bg-element hover:bg-bg-panel-hover text-text-primary rounded-xl font-bold transition-all border border-border"
        >
          <Home className="w-4 h-4" />
          <span>Go Home</span>
        </button>
      </div>
      
      <div className="mt-12 p-4 bg-bg-element rounded-lg border border-border max-w-xl w-full overflow-auto max-h-48 text-left">
        <p className="text-[10px] font-mono text-text-muted font-bold mb-2 uppercase tracking-wider">stack trace / details</p>
        <pre className="text-xs font-mono text-red-400 whitespace-pre-wrap">
          {error instanceof Error ? error.stack : JSON.stringify(error, null, 2)}
        </pre>
      </div>
    </div>
  );
}
