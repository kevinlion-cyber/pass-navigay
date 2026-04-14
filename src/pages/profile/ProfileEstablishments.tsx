import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Plus, Settings } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Establishment } from '../../lib/types';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

interface ProfileEstablishmentsProps {
  userId: string;
}

export default function ProfileEstablishments({ userId }: ProfileEstablishmentsProps) {
  const navigate = useNavigate();
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('establishments')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });
      setEstablishments((data as Establishment[]) || []);
      setLoading(false);
    };
    load();
  }, [userId]);

  return (
    <section>
      <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Store size={18} className="text-primary" />
        Mon etablissement
      </h2>

      {loading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner size={24} />
        </div>
      ) : establishments.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Tu n'as pas encore reference ton etablissement
          </p>
          <button
            onClick={() => navigate('/establishment/new')}
            className="btn-secondary text-sm py-2.5 px-5 inline-flex items-center gap-2"
          >
            <Plus size={16} />
            Referencer mon etablissement
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {establishments.map((est) => (
            <div
              key={est.id}
              className="card p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-card bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                  {est.logo_url ? (
                    <img src={est.logo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-primary font-semibold text-sm">
                      {est.name.charAt(0)}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {est.name}
                  </p>
                  <span className={est.is_pro ? 'badge-pro text-[10px] py-0 px-1.5' : 'text-xs text-gray-400'}>
                    {est.is_pro ? 'PRO' : 'Gratuit'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => navigate(`/establishment/${est.id}/edit`)}
                className="btn-secondary text-sm py-1.5 px-3 flex items-center gap-1.5 shrink-0"
              >
                <Settings size={14} />
                Gerer
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
