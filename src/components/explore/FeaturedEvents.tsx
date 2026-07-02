import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Event } from '../../lib/types';

export default function FeaturedEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    const load = async () => {
      const now = new Date().toISOString();
      // Tous les événements à venir (les « featured » d'abord), pour le roulement.
      const { data } = await supabase
        .from('events')
        .select('*, establishment:establishments(name)')
        .or(`event_date.gte.${now},end_date.gte.${now}`)
        .order('is_featured', { ascending: false })
        .order('event_date', { ascending: true })
        .limit(40);
      if (data) setEvents(data as unknown as Event[]);
    };
    load();
  }, []);

  // Roulement automatique sur grand écran (PC) ; aucun impact sur mobile.
  useEffect(() => {
    if (events.length === 0) return;
    if (!window.matchMedia('(min-width: 1024px)').matches) return;
    const el = scrollRef.current;
    if (!el) return;
    const id = setInterval(() => {
      if (pausedRef.current || !el) return;
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 8) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: 240, behavior: 'smooth' });
      }
    }, 3000);
    return () => clearInterval(id);
  }, [events]);

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
        ref={scrollRef}
        className="flex gap-3 px-4 pb-3 overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
        onMouseEnter={() => { pausedRef.current = true; }}
        onMouseLeave={() => { pausedRef.current = false; }}
      >
        {events.map((event) => (
          <div
            key={event.id}
            onClick={() => navigate(`/events/${event.id}`)}
            className="shrink-0 cursor-pointer relative overflow-hidden rounded-xl group w-[200px] lg:w-[230px]"
            style={{ height: 120 }}
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
