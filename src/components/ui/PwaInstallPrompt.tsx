import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('pwa-install-dismissed');
    if (stored) setDismissed(true);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
    setDismissed(true);
    sessionStorage.setItem('pwa-install-dismissed', '1');
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('pwa-install-dismissed', '1');
  };

  if (!deferredPrompt || dismissed) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 z-50 max-w-sm mx-auto animate-in slide-in-from-bottom-4">
      <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-2xl shadow-2xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#7B2D8B' }}>
          <Download size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white">Installer Pass Navigay</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Acces rapide depuis ton ecran d'accueil</p>
        </div>
        <button
          onClick={handleInstall}
          className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: '#7B2D8B' }}
        >
          Installer
        </button>
        <button
          onClick={handleDismiss}
          className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label="Fermer"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
