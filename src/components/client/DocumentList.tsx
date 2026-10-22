// src/components/client/DocumentList.tsx
'use client';

import { useTranslations } from 'next-intl';
import { getDocumentUiMeta, type DocumentStatusId, DOCUMENT_STATUS } from '@/config/statuses';

type ClientDoc = {
  id: string;
  status: DocumentStatusId;
  file_name: string | null;
  drive_link: string | null;
};

type Props = {
  documents: ClientDoc[];
};

export default function DocumentList({ documents }: Props) {
  const t = useTranslations('ClientDocuments');

  return (
    <ul className="space-y-4">
    {documents.map((doc) => {
      // 1) uploaded? (use the field that actually indicates the file exists)
      const hasUpload = Boolean(doc?.drive_link || doc?.file_name);
    
      // 2) if not uploaded, force "missing" (this is your “required/outstanding” state)
      const effectiveStatus = hasUpload ? doc.status : 'missing';
    
      // 3) use shared UI meta (badge tone + row class if you later want it)
      const ui = getDocumentUiMeta(effectiveStatus as DocumentStatusId | 'missing');
    
      return (
        <li key={doc.id} className="bg-white p-4 rounded-lg shadow">
          {hasUpload && doc.drive_link ? (
            <a href={doc.drive_link} target="_blank" rel="noopener noreferrer">
              {doc.file_name}
            </a>
          ) : (
            <span>{doc.file_name}</span>
          )}
    
          <span className={`ml-4 badge ${ui.badgeTone}`}>
            
            {t(`statuses.${ui.id}`)}
          </span>
        </li>
      );
    })}

    </ul>
  );
}