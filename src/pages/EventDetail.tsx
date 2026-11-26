import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Clock, ChevronLeft, Tag, Ticket, ExternalLink, Map as MapIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Event } from '../lib/types';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import VisuelEntier from '../components/ui/VisuelEntier';

export default function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('events')
        .select('*, establishment:establishments(id, name, logo_url, city, address, latitude, longitude)')
        .eq('id', eventId)
        .maybeSingle();
      if (data) setEvent(data as unknown as Event);
      setLoading(false);
    };
    load();
  }, [eventId]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p>Événement non trouvé.</p>
        <button onClick={() => navigate('/agenda')} className="btn-primary mt-4">
          Retour aux événements
        </button>
      </div>
    );
  }

  const est = event.establishment;

  // « Voir sur la carte » (demande de Kévin, 26/11/2026) : ouvre Google Maps sur le lieu
  // (l'application Maps sur téléphone). Simple lien : aucun appel facturé à Google.
  // Coordonnées de l'événement, sinon celles de l'établissement, sinon l'adresse en texte.
  const adresse = event.address || est?.address || '';
  const lat = event.latitude ?? est?.latitude ?? null;
  const lng = event.longitude ?? est?.longitude ?? null;
  const lienCarte = lat != null && lng != null
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : adresse
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`
      : null;

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="max-w-3xl mx-auto pb-8">
      {event.image_url && (
        <VisuelEntier
          src={event.image_url}
          alt={event.title}
          className="w-full"
          style={{ aspectRatio: '3 / 2', maxHeight: 420 }}
        />
      )}

      <div className="p-4 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {event.title}
          </h1>

          {event.theme && (
            <span className="inline-block mt-2 badge bg-primary/10 text-primary">
              {event.theme}
            </span>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
            <Calendar size={16} className="shrink-0 text-primary" />
            <span>{formatDate(event.event_date)} à {formatTime(event.event_date)}</span>
          </div>

          {event.end_date && (
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
              <Clock size={16} className="shrink-0 text-primary" />
              <span>Fin : {formatDate(event.end_date)} à {formatTime(event.end_date)}</span>
            </div>
          )}

          {adresse && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-gray-600 dark:text-gray-400">
              <MapPin size={16} className="shrink-0 text-primary" />
              <span className="flex-1 min-w-0">{adresse}</span>
              {lienCarte && (
                <a
                  href={lienCarte}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  <MapIcon size={14} /> Voir sur la carte
                </a>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 text-sm">
            <Tag size={16} className="shrink-0 text-primary" />
            {event.is_free ? (
              <span className="badge-free">Gratuit</span>
            ) : (
              <span className="font-medium text-gray-900 dark:text-white">{event.price} EUR</span>
            )}
          </div>
        </div>

        {(event.ticket_url || event.source_url) && (
          <div className="flex flex-wrap gap-3">
            {event.ticket_url && (
              <a href={event.ticket_url} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm inline-flex items-center gap-2">
                <Ticket size={16} /> Billetterie
              </a>
            )}
            {event.source_url && (
              <a href={event.source_url} target="_blank" rel="noopener noreferrer" className="text-sm inline-flex items-center gap-1.5 text-primary hover:underline self-center">
                <ExternalLink size={14} /> Voir l'annonce{event.source_name ? ` (source : ${event.source_name})` : ''}
              </a>
            )}
          </div>
        )}

        {event.description && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Description</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
              {event.description}
            </p>
          </div>
        )}

        {est && (
          <div
            onClick={() => navigate(`/establishment/${est.id}`)}
            className="card p-4 flex items-center gap-4 cursor-pointer hover:ring-1 hover:ring-primary/30 transition-shadow"
          >
            <div className="w-12 h-12 rounded-card bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
              {est.logo_url ? (
                <img src={est.logo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-primary font-semibold">{est.name?.charAt(0)}</span>
              )}
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{est.name}</p>
              {(est.city || est.address) && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {est.address ? `${est.address}, ` : ''}{est.city || ''}
                </p>
              )}
            </div>
            <ChevronLeft size={16} className="ml-auto rotate-180 text-gray-400" />
          </div>
        )}

        <button onClick={() => navigate(-1)} className="btn-ghost flex items-center gap-2">
          <ChevronLeft size={16} />
          Retour
        </button>
      </div>
    </div>
  );
}
