import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Users, Crown, Heart, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';
import LoadingSpinner from '../components/ui/LoadingSpinner';

interface MemberWithMeta extends Profile {
  favorites_count: number;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'En ligne';
  if (minutes < 60) return `Actif il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Actif il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Actif il y a ${days}j`;
  const weeks = Math.floor(days / 7);
  return `Actif il y a ${weeks} sem`;
}

export default function Members() {
  const [members, setMembers] = useState<MemberWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const [profilesRes, favCountsRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('favorites').select('user_id'),
      ]);

      const favMap = new Map<string, number>();
      favCountsRes.data?.forEach((f: { user_id: string }) => {
        favMap.set(f.user_id, (favMap.get(f.user_id) ?? 0) + 1);
      });

      const enriched: MemberWithMeta[] = (profilesRes.data ?? []).map((p) => ({
        ...(p as Profile),
        favorites_count: favMap.get(p.id) ?? 0,
      }));

      setMembers(enriched);
      setLoading(false);
    };
    load();
  }, []);

  const displayName = (m: MemberWithMeta) => {
    if (m.prenom) {
      const initial = m.nom ? ` ${m.nom.charAt(0).toUpperCase()}.` : '';
      return `${m.prenom}${initial}`;
    }
    return m.username;
  };

  const filtered = members.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = displayName(m).toLowerCase();
    return name.includes(q) || m.username.toLowerCase().includes(q) || m.bio?.toLowerCase().includes(q);
  });

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Users size={22} className="text-primary" />
          Membres
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {filtered.length} membre{filtered.length !== 1 ? 's' : ''} inscrits
        </p>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un membre..."
          className="input-field pl-9 text-xs w-full"
          style={{ height: 36, paddingTop: 6, paddingBottom: 6 }}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Users size={48} className="mx-auto text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400">Aucun membre trouve</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((member) => (
            <button
              key={member.id}
              onClick={() => navigate(`/profile/${member.id}`)}
              className="group relative rounded-2xl border border-light-border dark:border-dark-border
                         bg-light-surface dark:bg-dark-surface p-4 text-center
                         hover:border-primary/40 hover:shadow-lg transition-all duration-200
                         flex flex-col items-center"
            >
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center overflow-hidden mb-3
                            group-hover:scale-105 transition-transform shrink-0
                            ${member.is_premium
                              ? 'ring-2 ring-amber-400 dark:ring-amber-500'
                              : 'ring-2 ring-gray-200 dark:ring-dark-border'
                            }
                            ${!member.avatar_url ? 'bg-primary/10' : ''}`}
              >
                {member.avatar_url ? (
                  <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-primary text-xl font-semibold">
                    {displayName(member).charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-center gap-1.5 w-full">
                <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                  {displayName(member)}
                </h3>
                {member.is_premium && (
                  <span className="flex items-center gap-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-400 shrink-0">
                    <Crown size={9} />
                    Premium
                  </span>
                )}
              </div>

              {member.bio && (
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 line-clamp-3 leading-relaxed px-1">
                  {member.bio}
                </p>
              )}

              {member.favorite_categories?.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1 mt-2.5">
                  {member.favorite_categories.slice(0, 3).map((cat) => (
                    <span
                      key={cat}
                      className="px-2 py-0.5 rounded-full text-[11px] font-medium"
                      style={{
                        backgroundColor: 'rgba(139, 92, 246, 0.12)',
                        color: 'rgb(124, 58, 237)',
                      }}
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-auto pt-3 w-full space-y-1 border-t border-light-border/50 dark:border-dark-border/50">
                {member.favorites_count > 0 && (
                  <p className="flex items-center justify-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 pt-2">
                    <Heart size={9} />
                    {member.favorites_count} lieu{member.favorites_count > 1 ? 'x' : ''} favori{member.favorites_count > 1 ? 's' : ''}
                  </p>
                )}
                {member.last_active_at && (
                  <p className="flex items-center justify-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
                    <Clock size={9} />
                    {timeAgo(member.last_active_at)}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
