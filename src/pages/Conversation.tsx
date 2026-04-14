import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Message, Profile } from '../lib/types';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import AuthGateModal from '../components/ui/AuthGateModal';

export default function Conversation() {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setAuthGateOpen(true);
      return;
    }
    loadConversation();
    markAsRead();

    const channel = supabase
      .channel(`messages-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, (payload) => {
        const msg = payload.new as Message;
        if (
          (msg.sender_id === user.id && msg.receiver_id === userId) ||
          (msg.sender_id === userId && msg.receiver_id === user.id)
        ) {
          setMessages((prev) => [...prev, msg]);
          if (msg.sender_id === userId) {
            supabase.from('messages').update({ is_read: true }).eq('id', msg.id).then();
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversation = async () => {
    const [profileRes, messagesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId!).maybeSingle(),
      supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user!.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user!.id})`)
        .order('created_at'),
    ]);

    if (profileRes.data) setOtherUser(profileRes.data as Profile);
    if (messagesRes.data) setMessages(messagesRes.data as Message[]);
    setLoading(false);
  };

  const markAsRead = async () => {
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('sender_id', userId!)
      .eq('receiver_id', user!.id)
      .eq('is_read', false);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return;
    setSending(true);

    await supabase.from('messages').insert({
      sender_id: user!.id,
      receiver_id: userId,
      content: newMessage.trim(),
    });

    setNewMessage('');
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!user) {
    return (
      <AuthGateModal
        open={authGateOpen}
        onClose={() => { setAuthGateOpen(false); navigate('/explore'); }}
        message="Cree ton compte pour envoyer des messages."
      />
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-7.5rem)] md:h-[calc(100vh-3.5rem)]">
      <div className="p-4 border-b border-light-border dark:border-dark-border flex items-center gap-3">
        <button onClick={() => navigate('/messages')} aria-label="Retour" className="btn-ghost p-2">
          <ChevronLeft size={20} />
        </button>
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
          {otherUser?.avatar_url ? (
            <img src={otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-primary text-sm font-medium">
              {otherUser?.username?.charAt(0).toUpperCase() || '?'}
            </span>
          )}
        </div>
        <span className="font-medium text-gray-900 dark:text-white">{otherUser?.username}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => {
          const isMe = msg.sender_id === user!.id;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${
                isMe
                  ? 'bg-primary text-white rounded-br-sm'
                  : 'bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border text-gray-900 dark:text-gray-100 rounded-bl-sm'
              }`}>
                <p>{msg.content}</p>
                <span className={`text-[10px] mt-1 block ${isMe ? 'text-white/60' : 'text-gray-400'}`}>
                  {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-light-border dark:border-dark-border flex gap-2">
        <input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ton message..."
          className="input-field flex-1"
        />
        <button
          onClick={sendMessage}
          disabled={sending || !newMessage.trim()}
          aria-label="Envoyer"
          className="btn-primary px-4"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
