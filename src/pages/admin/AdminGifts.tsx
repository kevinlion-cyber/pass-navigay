import { useEffect, useState } from 'react';
import { Gift } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import MemberSidebar from './MemberSidebar';
import EstablishmentEditSidebar from './EstablishmentEditSidebar';

interface GiftRow {
  id: string;
  recipient_id: string;
  recipient_type: 'user' | 'establishment';
  gift_type: 'premium' | 'pro';
  days_added: number;
  new_expiry: string;
  note: string | null;
  created_at: string;
  recipient_name: string | null;
}

function formatDateFr(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateTimeFr(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function AdminGifts() {
  const [gifts, setGifts] = useState<GiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'premium' | 'pro'>('all');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedEstablishmentId, setSelectedEstablishmentId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('admin_gifts')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter === 'premium') query = query.eq('gift_type', 'premium');
      if (filter === 'pro') query = query.eq('gift_type', 'pro');

      const { data } = await query;
      if (!data) {
        setGifts([]);
        setLoading(false);
        return;
      }

      const userIds = data.filter((g) => g.recipient_type === 'user').map((g) => g.recipient_id);
      const estIds = data.filter((g) => g.recipient_type === 'establishment').map((g) => g.recipient_id);

      const [usersRes, estsRes] = await Promise.all([
        userIds.length > 0
          ? supabase.from('profiles').select('id, username, prenom').in('id', userIds)
          : Promise.resolve({ data: [] }),
        estIds.length > 0
          ? supabase.from('establishments').select('id, name').in('id', estIds)
          : Promise.resolve({ data: [] }),
      ]);

      const userMap = new Map<string, string>();
      (usersRes.data || []).forEach((u: any) => {
        userMap.set(u.id, u.prenom || u.username || u.id.substring(0, 8));
      });

      const estMap = new Map<string, string>();
      (estsRes.data || []).forEach((e: any) => {
        estMap.set(e.id, e.name || e.id.substring(0, 8));
      });

      const enriched: GiftRow[] = data.map((g) => ({
        ...g,
        recipient_name:
          g.recipient_type === 'user'
            ? userMap.get(g.recipient_id) || g.recipient_id.substring(0, 8)
            : estMap.get(g.recipient_id) || g.recipient_id.substring(0, 8),
      }));

      setGifts(enriched);
    } catch {
      setGifts([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [filter]);

  const now = new Date();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Gift size={22} className="text-[#c084f5]" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Cadeaux offerts</h1>
        <span className="text-sm text-gray-500">{gifts.length} au total</span>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          className="input-field bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm w-auto py-2"
        >
          <option value="all">Tous</option>
          <option value="premium">Premium utilisateur</option>
          <option value="pro">Pro etablissement</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size={32} />
        </div>
      ) : gifts.length === 0 ? (
        <p className="text-center text-gray-500 py-12">Aucun cadeau offert pour l'instant.</p>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-light-border dark:border-dark-border">
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Destinataire</th>
                  <th className="py-3 px-3">Duree offerte</th>
                  <th className="py-3 px-3">Valable jusqu'au</th>
                  <th className="py-3 px-3">Statut</th>
                  <th className="py-3 px-3">Note interne</th>
                  <th className="py-3 px-3">Offert le</th>
                </tr>
              </thead>
              <tbody>
                {gifts.map((g) => {
                  const isActive = new Date(g.new_expiry) > now;
                  return (
                    <tr key={g.id} className="border-b border-light-border dark:border-dark-border/50 hover:bg-light-surface dark:bg-dark-surface/50">
                      <td className="py-2.5 px-3">
                        {g.gift_type === 'premium' ? (
                          <span
                            className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                            style={{ background: 'rgba(192,132,245,0.15)', color: '#c084f5', border: '1px solid rgba(192,132,245,0.3)' }}
                          >
                            Premium
                          </span>
                        ) : (
                          <span
                            className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                            style={{ background: 'rgba(212,160,23,0.15)', color: '#d4a017', border: '1px solid rgba(212,160,23,0.3)' }}
                          >
                            Pro
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <button
                          onClick={() => {
                            if (g.recipient_type === 'user') setSelectedMemberId(g.recipient_id);
                            else setSelectedEstablishmentId(g.recipient_id);
                          }}
                          className="text-[#c084f5] hover:underline text-[13px] font-medium"
                        >
                          {g.recipient_name}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-gray-900 dark:text-white text-[13px]">{g.days_added} jours</td>
                      <td className="py-2.5 px-3 text-[13px] text-gray-300">{formatDateFr(g.new_expiry)}</td>
                      <td className="py-2.5 px-3">
                        {isActive ? (
                          <span
                            className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold"
                            style={{ background: 'rgba(39,174,96,0.15)', color: '#27ae60', border: '1px solid rgba(39,174,96,0.3)' }}
                          >
                            Actif
                          </span>
                        ) : (
                          <span
                            className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium text-gray-500"
                            style={{ background: '#1a1a24' }}
                          >
                            Expire
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-[12px] text-gray-500 max-w-[180px] truncate">
                        {g.note || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-[12px] text-gray-500">{formatDateTimeFr(g.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {gifts.map((g) => {
              const isActive = new Date(g.new_expiry) > now;
              return (
                <div key={g.id} className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {g.gift_type === 'premium' ? (
                        <span
                          className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                          style={{ background: 'rgba(192,132,245,0.15)', color: '#c084f5', border: '1px solid rgba(192,132,245,0.3)' }}
                        >
                          Premium
                        </span>
                      ) : (
                        <span
                          className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                          style={{ background: 'rgba(212,160,23,0.15)', color: '#d4a017', border: '1px solid rgba(212,160,23,0.3)' }}
                        >
                          Pro
                        </span>
                      )}
                      {isActive ? (
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold"
                          style={{ background: 'rgba(39,174,96,0.15)', color: '#27ae60', border: '1px solid rgba(39,174,96,0.3)' }}
                        >
                          Actif
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium text-gray-500" style={{ background: '#1a1a24' }}>
                          Expire
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-500">{formatDateTimeFr(g.created_at)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => {
                        if (g.recipient_type === 'user') setSelectedMemberId(g.recipient_id);
                        else setSelectedEstablishmentId(g.recipient_id);
                      }}
                      className="text-[#c084f5] hover:underline text-[13px] font-medium"
                    >
                      {g.recipient_name}
                    </button>
                    <span className="text-[13px] text-gray-900 dark:text-white">{g.days_added} jours</span>
                  </div>
                  <p className="text-[12px] text-gray-400">Valable jusqu'au {formatDateFr(g.new_expiry)}</p>
                  {g.note && <p className="text-[11px] text-gray-500 italic">{g.note}</p>}
                </div>
              );
            })}
          </div>
        </>
      )}

      <MemberSidebar
        memberId={selectedMemberId}
        onClose={() => setSelectedMemberId(null)}
        onRefresh={load}
      />

      <EstablishmentEditSidebar
        establishmentId={selectedEstablishmentId}
        onClose={() => setSelectedEstablishmentId(null)}
        onRefresh={load}
      />
    </div>
  );
}
