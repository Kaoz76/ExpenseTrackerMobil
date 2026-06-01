import React from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError() {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidMount() {
    // Clear chunk reload flag on successful mount
    sessionStorage.removeItem('chunk_load_failed_reload');
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("ErrorBoundary caught an error", error, errorInfo);

    // Check if the error is a failed dynamic import/chunk loading
    const isChunkLoadFailed = error && (
      error.message?.includes('Failed to fetch dynamically imported module') ||
      error.message?.includes('Loading chunk') ||
      error.name === 'ChunkLoadError'
    );

    if (isChunkLoadFailed) {
      const chunkReloadKey = 'chunk_load_failed_reload';
      const hasReloaded = sessionStorage.getItem(chunkReloadKey);
      if (!hasReloaded) {
        sessionStorage.setItem(chunkReloadKey, 'true');
        window.location.reload();
        return;
      }
    }

    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      const isTr = (navigator.language || '').startsWith('tr')
        || document.documentElement.getAttribute('lang') === 'tr';
      return (
        <div className="d-flex flex-column justify-content-center align-items-center vh-100 bg-body-tertiary p-4 text-center">
          <div className="text-danger mb-4">
            <FaExclamationTriangle style={{ fontSize: '4rem' }} />
          </div>
          <h1 className="h3 fw-bold mb-3">
            {isTr ? 'Oops! Bir şeyler ters gitti.' : 'Oops! Something went wrong.'}
          </h1>
          <p className="text-muted mb-4 max-w-md">
            {isTr
              ? 'Uygulamada beklenmeyen bir hata oluştu. Lütfen sayfayı yenilemeyi deneyin.'
              : 'An unexpected error occurred. Please try refreshing the page.'}
          </p>
          <button
            className="btn btn-primary rounded-pill px-4"
            onClick={() => window.location.reload()}
          >
            {isTr ? 'Sayfayı Yenile' : 'Refresh Page'}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
