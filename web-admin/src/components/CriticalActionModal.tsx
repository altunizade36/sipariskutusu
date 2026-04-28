import { ReactNode, useMemo, useState } from 'react';

interface CriticalActionModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmClassName?: string;
  requirePhrase?: string;
  extra?: ReactNode;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
  busy?: boolean;
}

export default function CriticalActionModal({
  open,
  title,
  description,
  confirmLabel,
  confirmClassName = 'btn-danger',
  requirePhrase,
  extra,
  onCancel,
  onConfirm,
  busy = false,
}: CriticalActionModalProps) {
  const [phrase, setPhrase] = useState('');

  const canConfirm = useMemo(() => {
    if (!requirePhrase) return true;
    return phrase.trim() === requirePhrase;
  }, [phrase, requirePhrase]);

  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>{title}</h3>
        <p style={{ marginTop: 0, color: '#64748b', fontSize: 13 }}>{description}</p>

        {requirePhrase && (
          <div className="form-group" style={{ marginTop: 10 }}>
            <label>Onaylamak icin su metni yaz: {requirePhrase}</label>
            <input value={phrase} onChange={e => setPhrase(e.target.value)} placeholder={requirePhrase} />
          </div>
        )}

        {extra}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>Iptal</button>
          <button className={`btn ${confirmClassName}`} onClick={() => void onConfirm()} disabled={busy || !canConfirm}>
            {busy ? 'Isleniyor...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
