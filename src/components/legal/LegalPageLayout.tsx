import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import kippyLogo from '@/assets/kippy-logo.png';

interface LegalPageLayoutProps {
  children: React.ReactNode;
  title: string;
}

export function LegalPageLayout({ children, title }: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={kippyLogo} alt="Kippy" className="h-8 w-auto" />
            <span className="text-xl font-bold text-primary">Kippy</span>
          </Link>
          <Button variant="ghost" asChild>
            <Link to="/" className="flex items-center gap-2">
              <ArrowRight className="w-4 h-4" />
              חזרה לדף הבית
            </Link>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-3xl md:text-4xl font-bold text-primary mb-8">{title}</h1>
        <div className="prose prose-lg max-w-none">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 mt-12">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p className="mb-2">לשאלות ובירורים:</p>
          <p>
            דואר אלקטרוני:{' '}
            <a href="mailto:support@kippyai.com" className="text-primary hover:underline">
              support@kippyai.com
            </a>
          </p>
          <p>
            וואטסאפ:{' '}
            <a href="https://wa.me/972548383340" className="text-primary hover:underline">
              054-838-3340
            </a>
          </p>
          <p className="mt-4 text-sm">© {new Date().getFullYear()} KippyAI. כל הזכויות שמורות.</p>
        </div>
      </footer>
    </div>
  );
}
