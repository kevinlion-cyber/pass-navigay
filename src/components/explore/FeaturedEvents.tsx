import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Event } from '../../lib/types';

export default function FeaturedEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('events')
        .select('*, establishment:establishments(name)')
        .eq('is_featured', true)
        .gte('event_date', new Date().toISOString())
        .order('event_date')
        .limit(10);
      if (data) setEvents(data as unknown as Event[]);
    };
    load();
  }, []);

  if (events.length === 0) return null;

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
        {events.map((event) => (
          <div
            key={event.id}
            onClick={() => navigate(`/establishment/${event.establishment_id}`)}
            className="card-hover w-56 shrink-0 cursor-pointer"
          >
            {event.image_url ? (
              <img src={event.image_url} alt="" className="w-full h-28 object-cover" />
            ) : (
              <div className="w-full h-28 bg-primary/10 flex items-center justify-center">
                <Calendar size={32} className="text-primary/50" />
              </div>
            )}
            <div className="p-3 space-y-1">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {event.title}
              </h4>
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Calendar size={12} />
                {new Date(event.event_date).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                })}
              </div>
              {event.is_free ? (
                <span className="badge-free">Gratuit</span>
              ) : (
                <span className="badge text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-dark-border">
                  {event.price} EUR
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
