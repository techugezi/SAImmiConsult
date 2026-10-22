// src/components/client/EditableProfile.tsx
'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { siteConfig } from '@/config/siteConfig';
import styles from './EditableProfile.module.css';

type Profile = {
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  citizenship_country: string | null;
  city_country: string | null;
  marital_status: string | null;
  phone_country_code: string | null;
  phone_number: string | null;
  whatsapp_country_code: string | null;
  whatsapp_number: string | null;
  preferred_contact_method: string | null;
  preferred_contact_time: string | null;
  income_over_2000: string | null;
  income_source: string | null;
  been_to_sa: string | null;
  first_entry_sa: string | null;
  current_location: string | null;
  current_visa_status: string | null;
  visa_refusals: string | null;
  visa_refusals_details: string | null;
  passport_expiry: string | null;
  visit_purpose: string | null;
  immigration_goal: string | null;
  english_level: string | null;
  need_language_school: string | null;
};

type Props = {
  initialData: Profile | null;
  userId: string;
};

export default function EditableProfile({ initialData, userId }: Props) {
  const t = useTranslations('ClientProfile');
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(!initialData);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState<Profile>({
    first_name: initialData?.first_name || '',
    middle_name: initialData?.middle_name || '',
    last_name: initialData?.last_name || '',
    date_of_birth: initialData?.date_of_birth || '',
    citizenship_country: initialData?.citizenship_country || '',
    city_country: initialData?.city_country || '',
    marital_status: initialData?.marital_status || 'other',
    phone_country_code: initialData?.phone_country_code || '+7',
    phone_number: initialData?.phone_number || '',
    whatsapp_country_code: initialData?.whatsapp_country_code || '+7',
    whatsapp_number: initialData?.whatsapp_number || '',
    preferred_contact_method: initialData?.preferred_contact_method || 'whatsapp',
    preferred_contact_time: initialData?.preferred_contact_time || 'any',
    income_over_2000: initialData?.income_over_2000 || 'unspecified',
    income_source: initialData?.income_source || '',
    been_to_sa: initialData?.been_to_sa || 'unspecified',
    first_entry_sa: initialData?.first_entry_sa || '',
    current_location: initialData?.current_location || '',
    current_visa_status: initialData?.current_visa_status || '',
    visa_refusals: initialData?.visa_refusals || 'unspecified',
    visa_refusals_details: initialData?.visa_refusals_details || '',
    passport_expiry: initialData?.passport_expiry || '',
    visit_purpose: initialData?.visit_purpose || '',
    immigration_goal: initialData?.immigration_goal || '',
    english_level: initialData?.english_level || 'basic',
    need_language_school: initialData?.need_language_school || 'unspecified',
  });

  // Client-side auth verification to ensure secure session
  useEffect(() => {
    const verifyUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user || user.id !== userId) {
        console.warn('Client-side auth mismatch or failure:', error);
        router.push(siteConfig.loginPath);
      }
    };
    verifyUser();
  }, [router, userId]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    let res: { data: Profile[] | null; error: any };
    if (!initialData) {
      // Insert for new profile
      res = await supabase
        .from('client_profiles')
        .insert({ user_id: userId, ...formData })
        .select();
    } else {
      // Update for existing profile
      res = await supabase
        .from('client_profiles')
        .update(formData)
        .eq('user_id', userId)
        .select();
    }

    setIsSaving(false);

    const { data, error: supabaseError } = res;

    if (supabaseError) {
      console.error('Profile save error:', supabaseError);
      setError(t('errors.saveFailed'));
    } else if (!data || data.length === 0) {
      console.error('Profile save failed: No rows affected (likely RLS or auth issue)');
      setError(t('errors.noRowsAffected')); // Add this key to your i18n files, e.g., "No profile updated - check permissions"
    } else {
      setSuccess(true);
      setIsEditing(false);
      router.refresh();
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('yourDetails')}</h2>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className={styles.editButton}
          disabled={isSaving}
        >
          {isEditing ? t('actions.cancel') : t('actions.edit')}
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {success && <p className={styles.success}>{t('messages.saved')}</p>}

      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className={styles.form}>
        {/* Personal Info */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('sections.personal')}</h3>
          <div className={styles.grid}>
            <Input label={t('fields.first_name')} value={formData.first_name} onChange={(v) => setFormData({ ...formData, first_name: v })} disabled={!isEditing} required />
            <Input label={t('fields.middle_name')} value={formData.middle_name || ''} onChange={(v) => setFormData({ ...formData, middle_name: v })} disabled={!isEditing} />
            <Input label={t('fields.last_name')} value={formData.last_name} onChange={(v) => setFormData({ ...formData, last_name: v })} disabled={!isEditing} required />
            <Input type="date" label={t('fields.date_of_birth')} value={formData.date_of_birth || ''} onChange={(v) => setFormData({ ...formData, date_of_birth: v })} disabled={!isEditing} />
          </div>
        </section>

        {/* Contact */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('sections.contact')}</h3>
          <div className={styles.grid}>
            <Input label={t('fields.citizenship_country')} value={formData.citizenship_country || ''} onChange={(v) => setFormData({ ...formData, citizenship_country: v })} disabled={!isEditing} />
            <Input label={t('fields.city_country')} value={formData.city_country || ''} onChange={(v) => setFormData({ ...formData, city_country: v })} disabled={!isEditing} />
            <PhoneInput
              countryCode={formData.phone_country_code || '+7'}
              number={formData.phone_number || ''}
              onCountryChange={(v) => setFormData({ ...formData, phone_country_code: v })}
              onNumberChange={(v) => setFormData({ ...formData, phone_number: v })}
              disabled={!isEditing}
              label={t('fields.phone')}
            />
            <Select
              label={t('fields.preferred_contact_method')}
              value={formData.preferred_contact_method || 'whatsapp'}
              onChange={(v) => setFormData({ ...formData, preferred_contact_method: v })}
              options={[
                { value: 'whatsapp', label: 'WhatsApp' },
                { value: 'phone', label: t('options.phone') },
                { value: 'email', label: 'Email' },
              ]}
              disabled={!isEditing}
            />
          </div>
        </section>

        {/* Immigration Goals */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('sections.immigration')}</h3>
          <div className={styles.grid}>
            <Select
              label={t('fields.immigration_goal')}
              value={formData.immigration_goal || ''}
              onChange={(v) => setFormData({ ...formData, immigration_goal: v })}
              options={[
                { value: '', label: t('placeholders.select') },
                { value: 'work', label: t('options.work') },
                { value: 'study', label: t('options.study') },
                { value: 'family', label: t('options.family') },
                { value: 'retirement', label: t('options.retirement') },
                { value: 'investment', label: t('options.investment') },
              ]}
              disabled={!isEditing}
            />
            <Select
              label={t('fields.english_level')}
              value={formData.english_level || 'basic'}
              onChange={(v) => setFormData({ ...formData, english_level: v })}
              options={[
                { value: 'basic', label: t('options.english.basic') },
                { value: 'intermediate', label: t('options.english.intermediate') },
                { value: 'fluent', label: t('options.english.fluent') },
              ]}
              disabled={!isEditing}
            />
          </div>
        </section>

        {isEditing && (
          <div className={styles.actions}>
            <button type="submit" disabled={isSaving} className={styles.saveButton}>
              {isSaving ? t('actions.saving') : t('actions.save')}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}


	// Small reusable form components
	type InputProps = {
		label: string;
		value: string | null | undefined;
		onChange: (v: string) => void;
		disabled?: boolean;
		type?: string;
		required?: boolean;
	};
	
	const Input = ({ label, value, onChange, disabled, type = 'text', required }: InputProps) => (
		<div className={styles.field}>
			<label className={styles.label}>{label} {required && <span className={styles.required}>*</span>}</label>
			<input
			type={type}
			value={value || ''}
			onChange={(e) => onChange(e.target.value)}
			disabled={disabled}
			className={styles.input}
			required={required}
			/>
		</div>
	);


	type SelectOption = { value: string; label: string };
	type SelectProps = {
		label: string;
		value: string;
		onChange: (v: string) => void;
		options: SelectOption[];
		disabled?: boolean;
	};
	
	const Select = ({ label, value, onChange, options, disabled }: SelectProps) => (
		<div className={styles.field}>
			<label className={styles.label}>{label}</label>
			<select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={styles.select}>
			{options.map((opt) => (
				<option key={opt.value} value={opt.value}>{opt.label}</option>
			))}
			</select>
		</div>
	);


	type PhoneInputProps = {
		label: string;
		countryCode: string;
		number: string;
		onCountryChange: (v: string) => void;
		onNumberChange: (v: string) => void;
		disabled?: boolean;
	};
	
	const PhoneInput = ({ label, countryCode, number, onCountryChange, onNumberChange, disabled }: PhoneInputProps) => (
		<div className={styles.field}>
			<label className={styles.label}>{label}</label>
			<div className={styles.phoneRow}>
			<input type="text" value={countryCode} onChange={(e) => onCountryChange(e.target.value)} disabled={disabled} className={styles.phoneCode} />
			<input type="text" value={number} onChange={(e) => onNumberChange(e.target.value.replace(/\D/g, ''))} disabled={disabled} className={styles.phoneNumber} placeholder="9123456789" />
			</div>
		</div>
	);