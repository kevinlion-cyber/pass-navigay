import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCategories } from '../contexts/CategoriesContext';
import type { CategoryKey, Establishment } from '../lib/types';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import AuthGateModal from '../components/ui/AuthGateModal';

export default function EstablishmentForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { categories, categoryKeys } = useCategories();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [latitude, setLatitude] = useState('48.8566');
  const [longitude, setLongitude] = useState('2.3522');
  const [category, setCategory] = useState<CategoryKey>('manger');
  const [subcategory, setSubcategory] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [authGateOpen, setAuthGateOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setAuthGateOpen(true);
      return;
    }
    if (isEdit) {
      loadEstablishment();
    }
  }, [id, user]);

  const loadEstablishment = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('establishments')
      .select('*')
      .eq('id', id!)
      .maybeSingle();

    if (data) {
      const est = data as Establishment;
      if (est.owner_id !== user?.id) {
        toast.error('Acces refuse.');
        navigate('/explore');
        return;
      }
      setName(est.name);
      setAddress(est.address);
      setCity(est.city);
      setPostalCode(est.postal_code);
      setLatitude(String(est.latitude));
      setLongitude(String(est.longitude));
      setCategory(est.category);
      setSubcategory(est.subcategory);
      setDescription(est.description);
      setPhone(est.phone);
      setWebsite(est.website);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    let logo_url: string | undefined;

    if (logoFile) {
      const ext = logoFile.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('establishment-logos')
        .upload(path, logoFile);

      if (uploadError) {
        toast.error('Erreur upload logo');
        setSaving(false);
        return;
      }

      const { data: urlData } = supabase.storage.from('establishment-logos').getPublicUrl(path);
      logo_url = urlData.publicUrl;
    }

    const payload = {
      name,
      address,
      city,
      postal_code: postalCode,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      category,
      subcategory,
      description,
      phone,
      website,
      ...(logo_url && { logo_url }),
      ...(!isEdit && { owner_id: user.id }),
    };

    let error;
    if (isEdit) {
      ({ error } = await supabase.from('establishments').update(payload).eq('id', id!));
    } else {
      ({ error } = await supabase.from('establishments').insert(payload));
    }

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(isEdit ? 'Etablissement modifie !' : 'Etablissement cree !');
      navigate('/explore');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <AuthGateModal
        open={authGateOpen}
        onClose={() => { setAuthGateOpen(false); navigate('/explore'); }}
        message="Cree ton compte pour ajouter ton etablissement."
      />

      <button onClick={() => navigate(-1)} className="btn-ghost flex items-center gap-2">
        <ChevronLeft size={16} />
        Retour
      </button>

      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
        {isEdit ? 'Modifier' : 'Creer'} un etablissement
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required className="input-field" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Adresse</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} required className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ville</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} required className="input-field" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Code postal</label>
            <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Latitude</label>
            <input type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} required className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Longitude</label>
            <input type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} required className="input-field" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categorie</label>
            <select value={category} onChange={(e) => { setCategory(e.target.value as CategoryKey); setSubcategory(''); }} className="input-field">
              {categoryKeys.map((key) => (
                <option key={key} value={key}>{categories[key].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sous-categorie</label>
            <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)} required className="input-field">
              <option value="">Choisir</option>
              {categories[category].subcategories.map((sub) => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="input-field resize-none" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Telephone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Site web</label>
            <input value={website} onChange={(e) => setWebsite(e.target.value)} className="input-field" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Logo</label>
          <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} className="input-field" />
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
          {saving && <LoadingSpinner size={18} />}
          {isEdit ? 'Enregistrer' : 'Creer'}
        </button>
      </form>
    </div>
  );
}
