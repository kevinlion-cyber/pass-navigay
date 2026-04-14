import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { CATEGORIES, CATEGORY_KEYS } from '../../lib/constants';
import type { CategoryKey } from '../../lib/types';
import AdminEditSidebar, {
  SidebarField,
  SidebarInput,
  SidebarTextarea,
  SidebarSelect,
  SidebarToggle,
} from '../../components/admin/AdminEditSidebar';

interface Props {
  establishmentId: string | null;
  onClose: () => void;
  onRefresh: () => void;
}

interface FormData {
  name: string;
  description: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  postal_code: string;
  category: string;
  subcategory: string;
  is_pro: boolean;
  is_sponsor: boolean;
  is_verified: boolean;
}

const initialForm: FormData = {
  name: '',
  description: '',
  phone: '',
  website: '',
  address: '',
  city: '',
  postal_code: '',
  category: 'manger',
  subcategory: '',
  is_pro: false,
  is_sponsor: false,
  is_verified: false,
};

const categoryOptions = CATEGORY_KEYS.map((k) => ({
  value: k,
  label: CATEGORIES[k as CategoryKey].label,
}));

export default function EstablishmentEditSidebar({ establishmentId, onClose, onRefresh }: Props) {
  const [form, setForm] = useState<FormData>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const loadData = useCallback(async () => {
    if (!establishmentId) return;
    setLoading(true);
    setErrors({});
    try {
      const { data, error } = await supabase
        .from('establishments')
        .select('*')
        .eq('id', establishmentId)
        .single();
      if (error) throw error;
      setForm({
        name: data.name || '',
        description: data.description || '',
        phone: data.phone || '',
        website: data.website || '',
        address: data.address || '',
        city: data.city || '',
        postal_code: data.postal_code || '',
        category: data.category || 'manger',
        subcategory: data.subcategory || '',
        is_pro: data.is_pro || false,
        is_sponsor: data.is_sponsor || false,
        is_verified: data.is_verified || false,
      });
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du chargement');
    }
    setLoading(false);
  }, [establishmentId]);

  useEffect(() => {
    if (establishmentId) loadData();
  }, [establishmentId, loadData]);

  const set = (key: keyof FormData, val: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.name.trim()) e.name = 'Le nom est requis';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !establishmentId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('establishments')
        .update({
          name: form.name,
          description: form.description,
          phone: form.phone,
          website: form.website,
          address: form.address,
          city: form.city,
          postal_code: form.postal_code,
          category: form.category,
          subcategory: form.subcategory,
          is_pro: form.is_pro,
          is_sponsor: form.is_sponsor,
          is_verified: form.is_verified,
        })
        .eq('id', establishmentId);
      if (error) throw error;
      toast.success('Etablissement mis a jour !');
      onClose();
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    }
    setSaving(false);
  };

  return (
    <AdminEditSidebar
      open={!!establishmentId}
      title="Modifier l'etablissement"
      loading={loading}
      saving={saving}
      onClose={onClose}
      onSave={handleSave}
    >
      <SidebarField label="Nom" error={errors.name}>
        <SidebarInput value={form.name} onChange={(v) => set('name', v)} required error={!!errors.name} />
      </SidebarField>

      <SidebarField label="Description">
        <SidebarTextarea value={form.description} onChange={(v) => set('description', v)} />
      </SidebarField>

      <SidebarField label="Telephone">
        <SidebarInput value={form.phone} onChange={(v) => set('phone', v)} type="tel" />
      </SidebarField>

      <SidebarField label="Site web">
        <SidebarInput value={form.website} onChange={(v) => set('website', v)} type="url" placeholder="https://..." />
      </SidebarField>

      <div className="mb-2 mt-6">
        <p className="text-[12px] uppercase tracking-[0.5px] text-[#606070] font-medium">Localisation</p>
      </div>

      <SidebarField label="Adresse">
        <SidebarInput value={form.address} onChange={(v) => set('address', v)} />
      </SidebarField>

      <SidebarField label="Ville">
        <SidebarInput value={form.city} onChange={(v) => set('city', v)} />
      </SidebarField>

      <SidebarField label="Code postal">
        <SidebarInput value={form.postal_code} onChange={(v) => set('postal_code', v)} />
      </SidebarField>

      <p className="text-[11px] text-[#606070] italic mb-5">Les coordonnees GPS seront recalculees automatiquement.</p>

      <div className="mb-2 mt-6">
        <p className="text-[12px] uppercase tracking-[0.5px] text-[#606070] font-medium">Categorisation</p>
      </div>

      <SidebarField label="Categorie">
        <SidebarSelect value={form.category} onChange={(v) => set('category', v)} options={categoryOptions} />
      </SidebarField>

      <SidebarField label="Sous-categorie">
        <SidebarInput value={form.subcategory} onChange={(v) => set('subcategory', v)} />
      </SidebarField>

      <div className="mb-2 mt-6">
        <p className="text-[12px] uppercase tracking-[0.5px] text-[#606070] font-medium">Statuts</p>
      </div>

      <SidebarToggle checked={form.is_pro} onChange={(v) => set('is_pro', v)} label="Profil Pro" />
      <SidebarToggle checked={form.is_sponsor} onChange={(v) => set('is_sponsor', v)} label="Etablissement sponsor" />
      <SidebarToggle checked={form.is_verified} onChange={(v) => set('is_verified', v)} label="Etablissement verifie" />
    </AdminEditSidebar>
  );
}
