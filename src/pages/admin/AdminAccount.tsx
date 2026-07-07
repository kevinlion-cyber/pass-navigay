import { useState } from 'react';
import { Save, Loader2, User, Mail, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const card = 'bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-5 space-y-3';
const field = 'input-field bg-light-surface dark:bg-dark-bg border-light-border dark:border-dark-border text-gray-900 dark:text-white';
const title = 'text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2';

export default function AdminAccount() {
  const { user, profile, refreshProfile } = useAuth();
  const [username, setUsername] = useState(profile?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [savingU, setSavingU] = useState(false);
  const [savingE, setSavingE] = useState(false);
  const [savingP, setSavingP] = useState(false);

  const saveUsername = async () => {
    if (!user || !username.trim()) return;
    setSavingU(true);
    const trimmed = username.trim().toLowerCase();
    const { data: existing } = await supabase.from('public_profiles').select('id').eq('username', trimmed).neq('id', user.id).maybeSingle();
    if (existing) { toast.error('Ce pseudo est déjà pris.'); setSavingU(false); return; }
    const { error } = await supabase.from('profiles').update({ username: trimmed }).eq('id', user.id);
    setSavingU(false);
    if (error) { toast.error(error.message); return; }
    await refreshProfile();
    toast.success('Pseudo mis à jour');
  };

  const saveEmail = async () => {
    if (!email.trim()) return;
    setSavingE(true);
    const { error } = await supabase.auth.updateUser({ email: email.trim() });
    setSavingE(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Un email de confirmation a été envoyé à la nouvelle adresse. Le changement sera effectif après validation.");
  };

  const savePassword = async () => {
    if (password.length < 6) { toast.error('Le mot de passe doit contenir au moins 6 caractères.'); return; }
    setSavingP(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSavingP(false);
    if (error) { toast.error(error.message); return; }
    setPassword('');
    toast.success('Mot de passe mis à jour');
  };

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">Mon compte</h1>

      <div className={card}>
        <p className={title}><User size={16} className="text-primary" /> Pseudo</p>
        <div className="flex gap-2">
          <input className={field} value={username} onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))} />
          <button onClick={saveUsername} disabled={savingU} className="btn-primary flex items-center gap-2 text-sm shrink-0">
            {savingU ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer
          </button>
        </div>
      </div>

      <div className={card}>
        <p className={title}><Mail size={16} className="text-primary" /> Adresse email</p>
        <div className="flex gap-2">
          <input type="email" className={field} value={email} onChange={(e) => setEmail(e.target.value)} />
          <button onClick={saveEmail} disabled={savingE} className="btn-primary flex items-center gap-2 text-sm shrink-0">
            {savingE ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Changer
          </button>
        </div>
        <p className="text-xs text-gray-500">Un email de confirmation sera envoyé à la nouvelle adresse.</p>
      </div>

      <div className={card}>
        <p className={title}><Lock size={16} className="text-primary" /> Mot de passe</p>
        <div className="flex gap-2">
          <input type="password" className={field} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nouveau mot de passe (6 caractères min.)" autoComplete="new-password" />
          <button onClick={savePassword} disabled={savingP} className="btn-primary flex items-center gap-2 text-sm shrink-0">
            {savingP ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Changer
          </button>
        </div>
      </div>
    </div>
  );
}
