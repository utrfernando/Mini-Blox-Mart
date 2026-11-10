import React, { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Select, Field } from '../ui/Input';
import { useToast } from '../../contexts/ToastContext';
import { readSheet, parseRows, runImport, type ImportOptions, type ParsedRow, type ImportResult } from '../../lib/bulkImport';

const DEFAULTS: ImportOptions = { exchangeRate: 0, markupPercent: 0, defaultStatus: 'draft', existing: 'update', createMissing: true };

const BulkUploadModal: React.FC<{ open: boolean; onClose: () => void; onDone: () => void }> = ({ open, onClose, onDone }) => {
  const { success, error } = useToast();
  const [opt, setOpt] = useState<ImportOptions>(DEFAULTS);
  const [grid, setGrid] = useState<unknown[][] | null>(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const parsed = useMemo(() => {
    if (!grid) return null;
    try { return { ...parseRows(grid, opt), failure: '' }; }
    catch (e: any) { return { rows: [] as ParsedRow[], recognised: [], headerLine: 0, failure: e.message as string }; }
  }, [grid, opt]);

  const okRows = parsed?.rows.filter(r => !r.errors.length) ?? [];
  const badRows = parsed?.rows.filter(r => r.errors.length) ?? [];

  const reset = () => { setGrid(null); setFileName(''); setResult(null); setProgress(null); };
  const close = () => { reset(); onClose(); };

  const onFile = async (f?: File) => {
    if (!f) return;
    setResult(null);
    try { setGrid(await readSheet(f)); setFileName(f.name); }
    catch { error('Could not read that file. Use .xlsx, .xls or .csv.'); }
  };

  const start = async () => {
    setBusy(true);
    try {
      const res = await runImport(okRows, opt, (d, t) => setProgress([d, t]));
      setResult(res);
      success(`Imported: ${res.created} new, ${res.updated} updated`);
      onDone();
    } catch (e: any) { error(e.message || 'Import failed'); }
    finally { setBusy(false); }
  };

  const set = <K extends keyof ImportOptions>(k: K, v: ImportOptions[K]) => setOpt(o => ({ ...o, [k]: v }));

  return (
    <Modal open={open} onClose={close} title="Bulk upload products" wide>
      {result ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-mint-700 font-bold"><CheckCircle2 /> Import finished</div>
          <ul className="text-sm text-ink-700 space-y-1">
            <li>{result.created} product(s) created</li>
            <li>{result.updated} product(s) updated</li>
            {result.skipped > 0 && <li>{result.skipped} skipped (SKU already exists)</li>}
            {result.newCategories.length > 0 && <li>New categories: {result.newCategories.join(', ')}</li>}
            {result.newSuppliers.length > 0 && <li>New suppliers: {result.newSuppliers.join(', ')}</li>}
          </ul>
          {result.failed.length > 0 && (
            <div className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">
              <p className="font-bold mb-1">{result.failed.length} failed</p>
              {result.failed.slice(0, 10).map((f, i) => <p key={i}>{f.sku || '—'}: {f.message}</p>)}
            </div>
          )}
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={reset}>Upload another</Button><Button onClick={close}>Done</Button></div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-mint-50 p-4 text-sm text-ink-700">
            <span>Use the template, or upload your supplier invoice directly — columns like <b>ITEM NO.</b>, <b>UNIT PRICE (US$)</b> and <b>QTY</b> are recognised.</span>
            <a href="/templates/miniblox-bulk-upload-template.xlsx" download><Button type="button" variant="outline" size="sm"><Download size={14} /> Download template</Button></a>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Exchange rate (1 USD = ?)"><Input type="number" min="0" step="0.01" value={opt.exchangeRate || ''} onChange={e => set('exchangeRate', Number(e.target.value))} placeholder="Needed for US$ costs" /></Field>
            <Field label="Markup % (when selling price is blank)"><Input type="number" min="0" step="1" value={opt.markupPercent || ''} onChange={e => set('markupPercent', Number(e.target.value))} placeholder="e.g. 80" /></Field>
            <Field label="Status for new products">
              <Select value={opt.defaultStatus} onChange={e => set('defaultStatus', e.target.value as any)}>
                <option value="draft">Draft (review before publishing)</option><option value="published">Published</option>
              </Select>
            </Field>
            <Field label="If SKU already exists">
              <Select value={opt.existing} onChange={e => set('existing', e.target.value as any)}>
                <option value="update">Update details, keep stock</option>
                <option value="update_add_stock">Update details and add quantity to stock</option>
                <option value="skip">Skip</option>
              </Select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" checked={opt.createMissing} onChange={e => set('createMissing', e.target.checked)} /> Create categories and suppliers that don't exist yet</label>

          <label className="flex flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-ink-200 p-8 cursor-pointer hover:border-mint-400 hover:bg-mint-50/40 transition">
            <FileSpreadsheet className="text-mint-500" size={32} />
            <span className="font-bold text-ink-800">{fileName || 'Choose a .xlsx, .xls or .csv file'}</span>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
          </label>

          {parsed?.failure && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{parsed.failure}</p>}

          {parsed && !parsed.failure && (
            <div className="space-y-3">
              <p className="text-sm text-ink-700"><b>{okRows.length}</b> ready{badRows.length > 0 && <>, <b className="text-red-600">{badRows.length}</b> with errors (they will be skipped)</>}. Header found on row {parsed.headerLine}.</p>
              <div className="max-h-64 overflow-auto rounded-2xl border border-ink-100">
                <table className="w-full text-xs">
                  <thead className="bg-ink-50 sticky top-0"><tr className="text-left text-ink-500"><th className="p-2">Row</th><th className="p-2">SKU</th><th className="p-2">Name</th><th className="p-2">Cost</th><th className="p-2">Price</th><th className="p-2">Qty</th><th className="p-2">Notes</th></tr></thead>
                  <tbody>
                    {parsed.rows.map(r => (
                      <tr key={r.line} className="border-t border-ink-100 align-top">
                        <td className="p-2">{r.line}</td><td className="p-2 font-mono">{r.sku || '—'}</td><td className="p-2">{r.name}</td>
                        <td className="p-2">{r.supplier_cost}</td><td className="p-2">{r.selling_price}</td><td className="p-2">{r.stock_quantity}</td>
                        <td className="p-2">
                          {r.errors.map((m, i) => <p key={i} className="text-red-600 flex gap-1"><AlertTriangle size={12} className="mt-0.5 shrink-0" />{m}</p>)}
                          {r.warnings.map((m, i) => <p key={i} className="text-amber-600">{m}</p>)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            {progress && busy && <span className="text-sm text-ink-500">{progress[0]} / {progress[1]}</span>}
            <Button variant="ghost" onClick={close}>Cancel</Button>
            <Button onClick={start} loading={busy} disabled={!okRows.length}>Import {okRows.length || ''} product(s)</Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default BulkUploadModal;
