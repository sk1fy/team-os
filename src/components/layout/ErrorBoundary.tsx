import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui';

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message?: string }
> {
  state = { hasError: false, message: undefined };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface-muted p-6">
        <div className="w-full max-w-md rounded-lg border border-danger-100 bg-surface p-6 text-center shadow-card">
          <AlertTriangle className="mx-auto size-10 text-danger-600" />
          <h1 className="mt-4 text-xl font-semibold text-slate-950">Что-то пошло не так</h1>
          <p className="mt-2 text-sm text-slate-500">
            Интерфейс поймал ошибку и остановил этот экран, чтобы не потерять состояние приложения.
          </p>
          {this.state.message && (
            <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
              {this.state.message}
            </p>
          )}
          <Button className="mt-5" onClick={() => this.setState({ hasError: false, message: undefined })}>
            Вернуться
          </Button>
        </div>
      </div>
    );
  }
}
