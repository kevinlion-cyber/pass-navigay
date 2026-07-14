// Traduction FR des erreurs d'authentification Supabase/GoTrue (jamais de message anglais brut à l'écran).
// On mappe d'abord par code (supabase-js v2), puis par contenu du message ; fallback FR générique.
type MaybeAuthError = { message?: string; code?: string; name?: string } | null | undefined;

export function translateAuthError(error: MaybeAuthError): string {
  if (!error) return 'Une erreur est survenue. Réessayez.';
  const msg = (error.message || '').toLowerCase();
  const code = (error.code || '').toString().toLowerCase();

  if (code === 'user_already_exists' || msg.includes('already registered') || msg.includes('already been registered'))
    return 'Cette adresse e-mail est déjà utilisée.';
  if (code === 'invalid_credentials' || msg.includes('invalid login credentials') || msg.includes('invalid credentials'))
    return 'E-mail ou mot de passe incorrect.';
  if (code === 'email_not_confirmed' || msg.includes('email not confirmed'))
    return "Votre e-mail n'a pas encore été confirmé. Vérifiez votre boîte de réception.";
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || msg.includes('rate limit') || msg.includes('too many requests'))
    return 'Trop de tentatives. Réessayez dans quelques minutes.';
  if (msg.includes('for security purposes'))
    return 'Merci de patienter quelques secondes avant de réessayer.';
  if (code === 'otp_expired' || msg.includes('otp_expired') || msg.includes('token has expired') || msg.includes('is invalid or has expired') || msg.includes('email link is invalid'))
    return 'Ce lien (ou ce code) est invalide ou a expiré. Demandez-en un nouveau.';
  if (code === 'otp_disabled' || msg.includes('signups not allowed') || msg.includes('signup is disabled'))
    return "L'inscription est temporairement désactivée.";
  if (code === 'weak_password' || (msg.includes('password') && (msg.includes('least') || msg.includes('should be') || msg.includes('weak'))))
    return 'Mot de passe trop faible (au moins 8 caractères).';
  if (code === 'same_password' || msg.includes('should be different'))
    return "Le nouveau mot de passe doit être différent de l'ancien.";
  if (code === 'validation_failed' || msg.includes('invalid email') || msg.includes('invalid format') || msg.includes('unable to validate email'))
    return "L'adresse e-mail n'est pas valide.";
  if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('fetch'))
    return 'Erreur de connexion. Vérifiez votre connexion internet.';

  return 'Une erreur est survenue. Réessayez.';
}
