import { Navigate, useLocation, useParams } from 'react-router-dom';

/**
 * Redirige une ancienne adresse anglaise vers sa nouvelle adresse française.
 *
 * Les adresses publiques du site étaient en anglais (« explore », « events »,
 * « promos »…) alors que tout le contenu est en français. Elles sont passées en
 * français, mais les anciennes doivent continuer de fonctionner : liens déjà
 * partagés, favoris des visiteurs, publications sur les réseaux, et ce que Google
 * a éventuellement déjà vu.
 *
 * On conserve le paramètre de l'adresse (`:eventId`, `:userId`…), la partie après
 * le `?` et celle après le `#` : un lien de partage qui porte des paramètres doit
 * arriver entier sur la nouvelle adresse.
 */
export default function LegacyRedirect({ to }: { to: string }) {
  const params = useParams();
  const { search, hash } = useLocation();

  let target = to;
  for (const [key, value] of Object.entries(params)) {
    if (value) target = target.replace(`:${key}`, value);
  }

  return <Navigate to={`${target}${search}${hash}`} replace />;
}
