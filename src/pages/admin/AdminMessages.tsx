import React, { useEffect, useState } from 'react';
import { MailOpen, Mail } from 'lucide-react';
import { supabase, formatDate, type ContactMessage } from '../../lib/supabase';
import { AdminHeader, Table, Td } from '../../components/admin/ui';
import { Badge } from '../../components/ui/Badge';

const AdminMessages: React.FC = () => {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => supabase.from('contact_messages').select('*').order('created_at', { ascending: false }).then(({ data }) => { setMessages((data || []) as ContactMessage[]); setLoading(false); });
  useEffect(() => { load(); }, []);

  const toggleRead = async (m: ContactMessage) => {
    await supabase.from('contact_messages').update({ is_read: !m.is_read }).eq('id', m.id);
    load();
  };

  return (
    <div>
      <AdminHeader title="Contact Messages" subtitle={`${messages.filter(m => !m.is_read).length} unread`} />
      <Table head={['From', 'Subject', 'Message', 'Received', 'Status', '']}>
        {loading ? <tr><Td className="text-center py-8 text-ink-400">Loading…</Td></tr> :
        messages.length === 0 ? <tr><Td className="text-center py-8 text-ink-400">No messages yet</Td></tr> :
        messages.map(m => (
          <tr key={m.id} className={m.is_read ? '' : 'bg-sunshine-50/50'}>
            <Td>
              <p className="font-bold text-ink-900">{m.name}</p>
              <p className="text-xs text-ink-400">{m.email}{m.phone ? ` · ${m.phone}` : ''}</p>
            </Td>
            <Td className="font-semibold text-ink-800">{m.subject || '—'}</Td>
            <Td className="text-ink-600 max-w-[280px]"><p className="line-clamp-2">{m.message}</p></Td>
            <Td className="text-xs text-ink-500 whitespace-nowrap">{formatDate(m.created_at)}</Td>
            <Td><Badge color={m.is_read ? 'ink' : 'sunshine'}>{m.is_read ? 'Read' : 'New'}</Badge></Td>
            <Td>
              <div className="flex gap-1">
                <a href={`mailto:${m.email}?subject=Re: ${m.subject || 'Your message'}`} className="p-2 rounded-xl hover:bg-mint-50 text-mint-600" title="Reply"><Mail size={16} /></a>
                <button onClick={() => toggleRead(m)} className="p-2 rounded-xl hover:bg-ink-100 text-ink-500" title={m.is_read ? 'Mark unread' : 'Mark read'}><MailOpen size={16} /></button>
              </div>
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  );
};

export default AdminMessages;
