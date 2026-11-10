import React, { useRef, useState } from 'react';
import { Paperclip, FileText, Trash2, Replace } from 'lucide-react';
import { supabase, uploadInvoice, openInvoice } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';

/** View / attach / replace / remove the invoice on one row of `table` ('expenses' or 'purchases'). */
export const InvoiceControl: React.FC<{
  table: 'expenses' | 'purchases'; id: string; path: string | null | undefined; name: string | null | undefined; onChanged: () => void;
}> = ({ table, id, path, name, onChanged }) => {
  const { success, error } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const up = await uploadInvoice(file, table);
      const { error: e } = await supabase.from(table).update({ invoice_path: up.path, invoice_name: up.name }).eq('id', id);
      if (e) throw e;
      if (path) await supabase.storage.from('invoices').remove([path]);
      success(path ? 'Invoice replaced' : 'Invoice attached'); onChanged();
    } catch (e: any) { error(e.message || 'Upload failed'); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  };

  const remove = async () => {
    if (!path || !confirm('Remove this invoice file?')) return;
    await supabase.from(table).update({ invoice_path: null, invoice_name: null }).eq('id', id);
    await supabase.storage.from('invoices').remove([path]);
    onChanged();
  };

  return (
    <div className="flex items-center gap-1 text-xs">
      <input ref={input} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.doc,.docx" className="hidden" onChange={e => pick(e.target.files?.[0])} />
      {path ? (
        <>
          <button onClick={() => openInvoice(path)} className="inline-flex items-center gap-1 rounded-full bg-mint-50 text-mint-700 font-bold px-2.5 py-1 hover:bg-mint-100 max-w-[150px]" title={name || 'Invoice'}>
            <FileText size={13} /><span className="truncate">{name || 'Invoice'}</span>
          </button>
          <button disabled={busy} onClick={() => input.current?.click()} className="p-1.5 rounded-full hover:bg-ink-100 text-ink-500" aria-label="Replace invoice"><Replace size={13} /></button>
          <button onClick={remove} className="p-1.5 rounded-full hover:bg-red-50 text-red-500" aria-label="Remove invoice"><Trash2 size={13} /></button>
        </>
      ) : (
        <button disabled={busy} onClick={() => input.current?.click()} className="inline-flex items-center gap-1 rounded-full border border-dashed border-ink-300 text-ink-600 font-bold px-2.5 py-1 hover:border-mint-400 hover:text-mint-700">
          <Paperclip size={13} />{busy ? 'Uploading…' : 'Attach'}
        </button>
      )}
    </div>
  );
};
