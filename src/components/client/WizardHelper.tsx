'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

export default function WizardHelper() {
  const t = useTranslations('ClientWizard.helper');
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-8 right-8 z-50">
      
      {/* The Popup */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-72 bg-white rounded-xl shadow-2xl p-5 border border-gray-100 animate-fade-in-up">
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-semibold text-gray-900">{t('title')}</h4>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            {t('body')}
          </p>
        </div>
      )}

      {/* The Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105"
        aria-label="Help Guide"
      >
        <span className="text-2xl font-bold">?</span>
      </button>
    </div>
  );
}