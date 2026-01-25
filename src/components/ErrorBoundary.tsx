/**
 * Error Boundary React pour capturer les erreurs non gérées
 * 
 * Ce composant capture les erreurs React et les logge pour le diagnostic.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { logger, LogLevel } from '@/lib/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Logger l'erreur
    logger.fatal(
      'React Error Boundary caught an error',
      error,
      'ErrorBoundary',
      {
        componentStack: errorInfo.componentStack,
        errorBoundary: true,
      }
    );

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    
    // Recharger la page pour un reset complet
    window.location.href = '/';
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Si un fallback personnalisé est fourni, l'utiliser
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Sinon, afficher l'interface d'erreur par défaut
      return (
        <div className="min-h-screen flex items-center justify-center bg-muted p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-destructive" />
                <CardTitle className="text-2xl">Une erreur est survenue</CardTitle>
              </div>
              <CardDescription>
                L'application a rencontré une erreur inattendue. Les détails ont été enregistrés pour diagnostic.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {import.meta.env.DEV && this.state.error && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm font-mono text-destructive mb-2">
                    {this.state.error.name}: {this.state.error.message}
                  </p>
                  {this.state.error.stack && (
                    <pre className="text-xs overflow-auto max-h-48 p-2 bg-background rounded border">
                      {this.state.error.stack}
                    </pre>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={this.handleReload} variant="default" className="flex-1">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Recharger la page
                </Button>
                <Button onClick={this.handleReset} variant="outline" className="flex-1">
                  <Home className="w-4 h-4 mr-2" />
                  Retour à l'accueil
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Si le problème persiste, contactez le support technique avec les informations d'erreur.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
