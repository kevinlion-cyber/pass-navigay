// Redirection après connexion / inscription : uniquement vers une page DU SITE.
// « //exemple.com » ou « /\exemple.com » commencent par « / » mais mènent vers un
// autre site (redirection piège après connexion) : refusés.
export function safeRedirect(path: string | null | undefined, fallback = '/explorer'): string {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return fallback;
  return path;
}
