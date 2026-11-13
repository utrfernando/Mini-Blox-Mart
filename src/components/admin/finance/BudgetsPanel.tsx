import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { EXPENSE_CATEGORIES, monthKey, type Budget, type Expense } from '../../../lib/finance';
import { useToast } from '../../../contexts/ToastContext';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';

/** Monthly spending limit per category with a progress bar for the current month. */
export const BudgetsPanel: React.FC<{ budgets: Budget[]; expenses: Expense[]; money: (n: number) => string; reload: () => void }> = ({ budgets, expenses, money, reload }) => {
  const { success, error } = useToast();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const month = monthKey();

  useEffect(() => { setDraft(Object.fromEntries(budgets.map(b => [b.category, String(b.monthly_limit)]))); }, [budgets]);

  const spent = useMemo(() => {
    const m: Record<string, number> = {};
    expenses.filter(e => e.expense_date.startsWith(month)).forEach(e => { m[e.category] = (m[e.category] || 0) + Number(e.amount); });
    return m;
  }, [expenses, month]);

  const save = async () => {
    setBusy(true);
    try {
      for (const c of EXPENSE_CATEGORIES) {
        const v = (draft[c] ?? '').trim();
        const had = budgets.find(b => b.category === c);
        if (v === '' || Number(v) <= 0) { if (had) await supabase.from('expense_budgets').delete().eq('category', c); continue; }
        if (!had || Number(had.monthly_limit) !== Number(v)) {
          const { error: e } = await supabase.from('expense_budgets').upsert({ category: c, monthly_limit: Number(v) }, { onConflict: 'category' });
          if (e) throw e;
        }
      }
      success('Budgets saved'); reload();
    } catch (e: any) { error(e.message || 'Could not save budgets'); }
    setBusy(false);
  };

  return (
    <div className="rounded-4xl border border-ink-100 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="font-display text-xl font-extrabold text-ink-900">Monthly budgets</h3>
          <p className="text-xs text-ink-400 font-semibold">Spending in {month}. Leave a limit empty for no budget.</p>
        </div>
        <Button size="sm" onClick={save} loading={busy}>Save budgets</Button>
      </div>
      <div className="space-y-4">
        {EXPENSE_CATEGORIES.map(c => {
          const limit = Number(draft[c] || 0);
          const used = spent[c] || 0;
          const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
          const over = limit > 0 && used > limit;
          const warn = limit > 0 && !over && used / limit >= 0.8;
          return (
            <div key={c} className="grid grid-cols-[1fr_120px] sm:grid-cols-[190px_1fr_130px] items-center gap-x-4 gap-y-1">
              <span className="text-sm font-bold text-ink-800">{c}</span>
              <Input type="number" min="0" placeholder="Limit" value={draft[c] ?? ''} onChange={e => setDraft({ ...draft, [c]: e.target.value })} className="!py-1.5 sm:order-3" />
              <div className="col-span-2 sm:col-span-1 sm:order-2">
                <div className="h-2.5 rounded-full bg-ink-100 overflow-hidden">
                  <div className={`h-full rounded-full ${over ? 'bg-red-500' : warn ? 'bg-sunshine-500' : 'bg-mint-500'}`} style={{ width: `${pct}%` }} />
                </div>
                <p className={`text-xs font-semibold mt-0.5 ${over ? 'text-red-500' : 'text-ink-400'}`}>
                  {money(used)}{limit > 0 && ` of ${money(limit)}`}{over && ` — over by ${money(used - limit)}`}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
