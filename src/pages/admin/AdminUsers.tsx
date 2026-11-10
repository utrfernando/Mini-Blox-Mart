import React, { useEffect, useMemo, useState } from 'react';
import { Search, ShieldCheck, ShieldOff } from 'lucide-react';
import { supabase, formatDate, type Profile } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { AdminHeader, Table, Td, StatCard } from '../../components/admin/ui';
import { PasswordActions } from '../../components/admin/PasswordActions';
import { Input, Select } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

const AdminUsers: React.FC = () => {
  const { user: me } = useAuth();
  const { success, error } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');

  const load = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setUsers((data || []) as Profile[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const changeRole = async (u: Profile, next: 'admin' | 'customer') => {
    if (u.id === me?.id) return error("You can't change your own role.");
    if (!confirm(`${next === 'admin' ? 'Give admin access to' : 'Remove admin access from'} ${u.email}?`)) return;
    const { error: e } = await supabase.from('profiles').update({ role: next }).eq('id', u.id);
    if (e) return error(e.message);
    await supabase.from('user_roles').delete().eq('user_id', u.id);
    await supabase.from('user_roles').insert({ user_id: u.id, role: next });
    await supabase.from('audit_logs').insert({ user_id: me?.id, action: 'role_change', entity: 'profile', entity_id: u.id, details: { email: u.email, role: next } });
    success(`${u.email} is now ${next}`); load();
  };

  const filtered = useMemo(() => users.filter(u =>
    (!role || u.role === role) &&
    (!q || (u.full_name || '').toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase()) || (u.phone || '').includes(q))
  ), [users, q, role]);

  const admins = users.filter(u => u.role === 'admin').length;

  return (
    <div>
      <AdminHeader title="Users & Access" subtitle="Manage who can sign in, who is an admin, and reset passwords" />
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="All users" value={String(users.length)} tone="mint" />
        <StatCard label="Admins" value={String(admins)} tone="lavender" />
        <StatCard label="Customers" value={String(users.length - admins)} tone="sunshine" />
      </div>
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, email, phone…" className="!pl-10" />
        </div>
        <Select value={role} onChange={e => setRole(e.target.value)} className="max-w-[180px]">
          <option value="">All roles</option><option value="admin">Admins</option><option value="customer">Customers</option>
        </Select>
      </div>
      <Table head={['User', 'Phone', 'Role', 'Joined', 'Password', 'Access']}>
        {loading ? <tr><Td className="text-center py-8 text-ink-400">Loading…</Td></tr> :
        filtered.map(u => (
          <tr key={u.id} className="hover:bg-ink-50/50">
            <Td><p className="font-bold text-ink-900">{u.full_name || '—'}{u.id === me?.id && <span className="ml-2 text-xs text-mint-600">(you)</span>}</p><p className="text-xs text-ink-400">{u.email}</p></Td>
            <Td className="text-xs text-ink-600">{u.phone || '—'}</Td>
            <Td><Badge color={u.role === 'admin' ? 'lavender' : 'mint'}>{u.role}</Badge></Td>
            <Td className="text-xs text-ink-500">{formatDate(u.created_at)}</Td>
            <Td><PasswordActions userId={u.id} email={u.email} /></Td>
            <Td>
              {u.id === me?.id ? <span className="text-xs text-ink-400">—</span> : u.role === 'admin'
                ? <Button size="sm" variant="ghost" onClick={() => changeRole(u, 'customer')}><ShieldOff size={14} />Remove admin</Button>
                : <Button size="sm" variant="ghost" onClick={() => changeRole(u, 'admin')}><ShieldCheck size={14} />Make admin</Button>}
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  );
};

export default AdminUsers;
