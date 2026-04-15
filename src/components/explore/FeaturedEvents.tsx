import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Sparkles } from 'lucide-react';
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
    <div className="shrink-0">
      <div className="flex items-center gap-1.5 px-4 pt-2 pb-1.5">
        <Sparkles size={13} className="text-primary" />
        <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          A ne pas manquer
        </span>
      </div>
      <div
        className="flex gap-3 px-4 pb-3 overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {events.map((event) => (
          <div
            key={event.id}
            onClick={() => navigate(`/establishment/${event.establishment_id}`)}
            className="shrink-0 cursor-pointer relative overflow-hidden rounded-xl group"
            style={{ width: 200, height: 120 }}
          >
            {event.image_url ? (
              <img
                src={event.image_url}
                alt=""
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                <Calendar size={32} className="text-primary/40" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <h4 className="text-[13px] font-semibold text-white leading-tight truncate">
                {event.title}
              </h4>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] text-white/70 flex items-center gap-1">
                  <Calendar size={10} />
                  {new Date(event.event_date).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
                {event.is_free ? (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                    Gratuit
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/15 text-white/80">
                    {event.price}&nbsp;EUR
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
