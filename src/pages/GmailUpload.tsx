import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGmailStore, useToastStore, useImportStore, useSettingsStore } from '@/lib/store';
import { Button, Card, PageHeader } from '@/components/ui';
import { Mail, Search, AlertCircle, LogIn, LogOut, CheckSquare, Square, Inbox, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDateTime } from '@/lib/utils';
import type { NormalizedMessage } from '@/types';

export default function GmailUpload() {
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  const { isConnected, connect, disconnect, messages, isLoading, error, fetchMessages } = useGmailStore();
  const { addMessages } = useImportStore();
  const gmailClientId = useSettingsStore((s) => s.settings.gmailClientId) || import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleConnect = async () => {
    try {
      await connect();
      await fetchMessages();
      addToast('Connected to mailbox successfully', 'success');
    } catch (e: any) {
      addToast(e?.message || 'Failed to connect to Gmail', 'error');
    }
  };

  const handleDisconnect = () => {
    disconnect();
    addToast('Disconnected from Gmail', 'info');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMessages(query);
  };

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (selectedIds.size === messages.length && messages.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(messages.map((m) => m.id)));
    }
  };

  const handleImport = () => {
    const selectedMessages = messages.filter((m) => selectedIds.has(m.id));
    const normalizedList: NormalizedMessage[] = selectedMessages.map((m) => ({
      id: m.id,
      sourceType: 'gmail',
      sourceFilename: `Gmail: ${m.subject}`,
      sourceIdentifier: `gmail#${m.id}`,
      sender: m.from,
      recipient: m.to,
      timestamp: m.date ? new Date(m.date) : new Date(),
      subject: m.subject,
      originalText: m.body || m.snippet,
      messageIndex: 1,
    }));

    addMessages(normalizedList);
    addToast(`Imported ${selectedMessages.length} email${selectedMessages.length === 1 ? '' : 's'} for analysis`, 'success');
    navigate('/analysis');
  };

  return (
    <div className="container mx-auto p-4 max-w-5xl space-y-6 pb-16">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader title="Gmail Integration" icon={Mail} />

        {isConnected ? (
          <Button variant="outline" size="sm" onClick={handleDisconnect} icon={<LogOut className="w-4 h-4" />}>
            Disconnect
          </Button>
        ) : (
          <Button size="sm" onClick={handleConnect} icon={<LogIn className="w-4 h-4" />}>
            Connect Gmail
          </Button>
        )}
      </div>

      {!gmailClientId && !isConnected && (
        <Card className="border-amber-500/30 bg-amber-500/5 p-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h2 className="text-base font-semibold">Google OAuth Client ID Not Set</h2>
              <p className="text-xs text-secondary leading-relaxed">
                To connect a live Google account, configure your Google Client ID in <strong>Settings</strong> or{' '}
                <code>.env</code> as <code>VITE_GOOGLE_CLIENT_ID</code>. You can also click <strong>Connect Gmail</strong>{' '}
                to use the built-in local sample mailbox to test email intelligence extraction.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4 bg-blue-500/5 border-blue-500/20">
        <div className="flex gap-3 items-start text-xs text-secondary">
          <Inbox className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-current mb-0.5">Privacy First Processing</p>
            <p>
              Emails are fetched directly to your browser session. Intelligence extraction runs 100% locally on your
              machine without sending email contents to third-party AI endpoints.
            </p>
          </div>
        </div>
      </Card>

      {isConnected && (
        <div className="space-y-4">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search emails (e.g. from:dean, subject:deadline, fees)..."
                className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm border focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Searching...' : 'Search'}
            </Button>
          </form>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
              {error}
            </div>
          )}

          <div className="rounded-xl border overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between bg-black/5">
              <div className="flex items-center gap-3">
                <button onClick={selectAll} className="text-secondary hover:text-current transition-colors cursor-pointer">
                  {selectedIds.size === messages.length && messages.length > 0 ? (
                    <CheckSquare className="w-5 h-5 text-accent" />
                  ) : (
                    <Square className="w-5 h-5" />
                  )}
                </button>
                <span className="text-sm font-medium">
                  {selectedIds.size} of {messages.length} selected
                </span>
              </div>

              <Button onClick={handleImport} disabled={selectedIds.size === 0} size="sm">
                Import for Analysis
              </Button>
            </div>

            <div className="divide-y max-h-[500px] overflow-y-auto">
              {messages.length === 0 ? (
                <div className="p-12 text-center text-secondary">
                  <Mail className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No emails found matching query.</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-4 flex gap-4 transition-colors cursor-pointer hover:bg-black/5 ${
                      selectedIds.has(msg.id) ? 'bg-accent/5' : ''
                    }`}
                    onClick={() => toggleSelection(msg.id)}
                  >
                    <div className="mt-1">
                      {selectedIds.has(msg.id) ? (
                        <CheckSquare className="w-5 h-5 text-accent" />
                      ) : (
                        <Square className="w-5 h-5 text-secondary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1 gap-2">
                        <span className="font-semibold text-sm truncate">{msg.from}</span>
                        <span className="text-xs text-secondary whitespace-nowrap">
                          {formatDateTime(msg.date)}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-current truncate mb-0.5">{msg.subject}</p>
                      <p className="text-xs text-secondary line-clamp-2">{msg.snippet || msg.body}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
