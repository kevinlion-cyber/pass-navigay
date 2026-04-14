import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { ConversationPreview } from '../lib/types';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import AuthGateModal from '../components/ui/AuthGateModal';

export default function Messages() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [authGateOpen, setAuthGateOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setAuthGateOpen(true);
      return;
    }
    loadConversations();
  }, [user]);

  const loadConversations = async () => {
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`)
      .order('created_at', { ascending: false });

    if (!messages) { setLoading(false); return; }

    const convMap = new Map<string, { lastMessage: string; lastMessageAt: string; unreadCount: number }>();
    messages.forEach((msg) => {
      const otherId = msg.sender_id === user!.id ? msg.receiver_id : msg.sender_id;
      if (!convMap.has(otherId)) {
        convMap.set(otherId, {
          lastMessage: msg.content,
          lastMessageAt: msg.created_at,
          unreadCount: 0,
        });
      }
      if (!msg.is_read && msg.receiver_id === user!.id) {
        const conv = convMap.get(otherId)!;
        conv.unreadCount++;
      }
    });

    const userIds = Array.from(convMap.keys());
    if (userIds.length === 0) { setLoading(false); return; }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);

    const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

    const result: ConversationPreview[] = userIds.map((uid) => {
      const conv = convMap.get(uid)!;
      const p = profileMap.get(uid);
      return {
        userId: uid,
        username: p?.username || 'Inconnu',
        avatar_url: p?.avatar_url || null,
        lastMessage: conv.lastMessage,
        lastMessageAt: conv.lastMessageAt,
        unreadCount: conv.unreadCount,
      };
    });

    result.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
    setConversations(result);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <AuthGateModal
          open={authGateOpen}
          onClose={() => { setAuthGateOpen(false); navigate('/explore'); }}
          message="Cree ton compte pour envoyer et recevoir des messages."
        />
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <MessageCircle size={20} className="text-primary" />
          Messages
        </h1>
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <MessageCircle size={48} className="mx-auto mb-4 opacity-30" />
          <p>Connecte-toi pour acceder a tes messages.</p>
          <button onClick={() => setAuthGateOpen(true)} className="btn-primary mt-4">
            Creer un compte
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <MessageCircle size={20} className="text-primary" />
        Messages
      </h1>

      {conversations.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <MessageCircle size={48} className="mx-auto mb-4 opacity-30" />
          <p>Aucune conversation.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <button
              key={conv.userId}
              onClick={() => navigate(`/messages/${conv.userId}`)}
              className="card-hover p-4 w-full flex items-center gap-3 text-left"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                {conv.avatar_url ? (
                  <img src={conv.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-primary text-sm font-medium">
                    {conv.username.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-white text-sm">{conv.username}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(conv.lastMessageAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{conv.lastMessage}</p>
              </div>
              {conv.unreadCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center shrink-0">
                  {conv.unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
