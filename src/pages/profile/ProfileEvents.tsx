import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Event } from '../../lib/types';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

interface ProfileEventsProps {
  userId: string;
}

export default function ProfileEvents({ userId }: ProfileEventsProps) {
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: favData } = await supabase
        .from('favorites')
        .select('establishment_id')
        .eq('user_id', userId);

      const estIds = favData?.map((f) => f.establishment_id) || [];

      if (estIds.length === 0) {
        setEvents([]);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('events')
        .select('*, establishment:establishments(name, logo_url)')
        .in('establishment_id', estIds)
        .or(`event_date.gte.${new Date().toISOString()},end_date.gte.${new Date().toISOString()}`)
        .order('event_date', { ascending: true })
        .limit(10);

      setEvents((data as Event[]) || []);
      setLoading(false);
    };
    load();
  }, [userId]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <section>
      <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Calendar size={18} className="text-primary" />
        Mes evenements a venir
      </h2>

      {loading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner size={24} />
        </div>
      ) : events.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Aucun evenement a venir pour le moment. Decouvre ce qui se passe !
          </p>
          <button
            onClick={() => navigate('/events')}
            className="text-sm text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1.5"
          >
            Voir les evenements
            <ArrowRight size={14} />
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((evt) => (
            <div
              key={evt.id}
              onClick={() => navigate(`/establishment/${evt.establishment_id}`)}
              className="card-hover p-3 flex gap-3 cursor-pointer"
            >
              <div className="w-12 h-12 rounded-card bg-gray-100 dark:bg-dark-border flex items-center justify-center shrink-0 overflow-hidden">
                {evt.image_url ? (
                  <img src={evt.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Calendar size={18} className="text-primary" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {evt.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {formatDate(evt.event_date)}
                  {evt.is_free ? (
                    <span className="ml-2 text-success font-medium">Gratuit</span>
                  ) : evt.price ? (
                    <span className="ml-2">{evt.price} EUR</span>
                  ) : null}
                </p>
                {evt.establishment && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                    {(evt.establishment as any).name}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
