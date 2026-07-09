import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';

interface UnauthenticatedPageProps {
  title?: string;
  subtitle?: string;
  loginUrl?: string;
  buttonText?: string;
}

function useResolvedTitle(titleProp?: string) {
  const [title, setTitle] = useState(titleProp || 'Autonnel');

  useEffect(() => {
    if (titleProp) return;

    const configuredName = (window as any).__APP_NAME__;
    if (configuredName) setTitle(configuredName);
  }, [titleProp]);

  return title;
}

function LoginMark() {
  return (
    <div className="w-16 h-16 rounded-2xl bg-primary mx-auto mb-6 flex items-center justify-center">
      <Zap className="w-8 h-8 text-primary-foreground" strokeWidth={2} />
    </div>
  );
}

function LoginAction({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      className="inline-block px-8 py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold no-underline hover:opacity-90 transition-opacity"
    >
      {children}
    </a>
  );
}

export default function UnauthenticatedPage({
  title: titleProp,
  subtitle = 'AI-native offer generation platform',
  loginUrl = '/login',
  buttonText = 'Login to Continue',
}: UnauthenticatedPageProps) {
  const title = useResolvedTitle(titleProp);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
      <div className="text-center">
        <LoginMark />
        <h1 className="text-3xl font-bold text-foreground mb-3">{title}</h1>
        <p className="text-muted-foreground mb-8">{subtitle}</p>
        <LoginAction href={loginUrl}>{buttonText}</LoginAction>
      </div>
    </div>
  );
}
