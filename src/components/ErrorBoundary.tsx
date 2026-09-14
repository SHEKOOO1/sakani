import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-black p-8" dir="rtl">
          <div className="bg-white dark:bg-card-dark rounded-[2.5rem] p-10 max-w-lg w-full shadow-xl border border-slate-100 dark:border-white/5 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
              <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3">عذراً، حدث خطأ غير متوقع</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 font-medium">
              حدث خطأ أثناء تحميل هذه الصفحة. لو سمحت حاول تعيد التحميل.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => window.location.reload()}
                className="px-8 py-3.5 rounded-2xl bg-blue-600 text-white font-black text-sm hover:bg-blue-700 transition-all shadow-lg">
                إعادة تحميل الصفحة
              </button>
              <button onClick={this.handleReset}
                className="px-8 py-3.5 rounded-2xl bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 font-black text-sm hover:bg-slate-200 dark:hover:bg-white/20 transition-all">
                محاولة مرة أخرى
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
