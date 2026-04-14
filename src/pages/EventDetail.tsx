import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Clock, ChevronLeft, Tag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Event } from '../lib/types';
import LoadingSpinner from '../components/ui/LoadingSpinner';

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
        .select('*, establishment:establishments(id, name, logo_url, city, address)')
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
        <p>Evenement non trouve.</p>
        <button onClick={() => navigate('/events')} className="btn-primary mt-4">
          Retour aux evenements
        </button>
      </div>
    );
  }

  const est = event.establishment as any;

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
        <img
          src={event.image_url}
          alt={event.title}
          className="w-full h-48 md:h-64 object-cover"
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
            <span>{formatDate(event.event_date)} a {formatTime(event.event_date)}</span>
          </div>

          {event.end_date && (
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
              <Clock size={16} className="shrink-0 text-primary" />
              <span>Fin : {formatDate(event.end_date)} a {formatTime(event.end_date)}</span>
            </div>
          )}

          {event.address && (
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
              <MapPin size={16} className="shrink-0 text-primary" />
              <span>{event.address}</span>
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
