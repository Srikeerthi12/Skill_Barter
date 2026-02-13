import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiArrowLeft, FiMessageSquare, FiX } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';
import {
  listExchangeMessagesApi,
  listChatConversationsApi,
  markExchangeReadApi,
  sendExchangeMessageApi,
  sendExchangeMessageUploadApi,
  toggleMessageReactionApi,
} from '../api/exchange.api';
import { useAuth } from '../hooks/useAuth';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = String(API_BASE).replace(/\/api\/?$/, '');

function formatTime(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function ChatPopup({ variant = 'fab' }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [open, setOpen] = useState(variant === 'page');
  const [selectedExchangeId, setSelectedExchangeId] = useState(null);
  const [chatBody, setChatBody] = useState('');
  const [file, setFile] = useState(null);
  const [typingFromOther, setTypingFromOther] = useState(false);
  const [reactionPickerForMessageId, setReactionPickerForMessageId] = useState(null);

  const socketRef = useRef(null);
  const selectedExchangeIdRef = useRef(null);

  useEffect(() => {
    selectedExchangeIdRef.current = selectedExchangeId;
  }, [selectedExchangeId]);

  const messagesEndRef = useRef(null);

  const { data: convData, isLoading: isConversationsLoading, isError: isConversationsError } = useQuery({
    queryKey: ['chatConversations'],
    enabled: Boolean(open && user?.id),
    queryFn: async () => {
      const res = await listChatConversationsApi();
      return res.data;
    },
  });

  const conversations = useMemo(() => {
    const meId = String(user?.id || '');
    const list = (convData?.conversations || []).map((ex) => {
      const requesterId = String(ex.requester_id ?? ex.requesterId ?? '');
      const iAmRequester = requesterId === meId;
      const otherPartyName = ex.other_user_name || (iAmRequester ? (ex.owner_name || 'Unknown') : (ex.requester_name || 'Unknown'));

      const requestedTitle = ex.requested_title || '—';
      const offeredTitle = ex.offered_title || '—';
      const youTeachTitle = iAmRequester ? offeredTitle : requestedTitle;
      const youLearnTitle = iAmRequester ? requestedTitle : offeredTitle;

      return {
        ...ex,
        iAmRequester,
        otherPartyName,
        youTeachTitle,
        youLearnTitle,
      };
    });

    list.sort((a, b) => {
      const ad = new Date(a.last_at || a.created_at || 0).valueOf();
      const bd = new Date(b.last_at || b.created_at || 0).valueOf();
      return bd - ad;
    });

    return list;
  }, [convData?.conversations, user?.id]);

  const selected = useMemo(
    () => conversations.find((c) => String(c.id) === String(selectedExchangeId)) || null,
    [conversations, selectedExchangeId]
  );

  const { data: messagesData, isLoading: isMessagesLoading, isError: isMessagesError } = useQuery({
    queryKey: ['exchangeMessages', selectedExchangeId],
    enabled: Boolean(open && selectedExchangeId),
    queryFn: async () => {
      const res = await listExchangeMessagesApi(selectedExchangeId);
      return res.data;
    },
  });

  const { mutate: sendMessage, isPending: isSending } = useMutation({
    mutationFn: async () => {
      if (!selectedExchangeId) throw new Error('Missing exchange');
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('body', chatBody);
        const res = await sendExchangeMessageUploadApi(selectedExchangeId, fd);
        return res.data;
      }
      const res = await sendExchangeMessageApi(selectedExchangeId, { body: chatBody });
      return res.data;
    },
    onSuccess: () => {
      setChatBody('');
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ['exchangeMessages', selectedExchangeId] });
      queryClient.invalidateQueries({ queryKey: ['chatConversations'] });
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to send message'),
  });

  const { mutate: reactToMessage } = useMutation({
    mutationFn: async ({ messageId, emoji }) => {
      if (!selectedExchangeId) throw new Error('Missing exchange');
      const res = await toggleMessageReactionApi(selectedExchangeId, messageId, emoji);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchangeMessages', selectedExchangeId] });
    },
    onError: () => toast.error('Failed to react'),
  });

  useEffect(() => {
    if (!open) {
      setSelectedExchangeId(null);
      setChatBody('');
      setFile(null);
    }
  }, [open]);

  useEffect(() => {
    setChatBody('');
    setFile(null);
    setTypingFromOther(false);
    setReactionPickerForMessageId(null);
  }, [selectedExchangeId]);

  useEffect(() => {
    if (isConversationsError) toast.error('Failed to load chats');
  }, [isConversationsError]);

  useEffect(() => {
    if (isMessagesError) toast.error('Failed to load messages');
  }, [isMessagesError]);

  useEffect(() => {
    if (!open || !selectedExchangeId) return;
    if (!messagesEndRef.current) return;
    messagesEndRef.current.scrollIntoView({ block: 'end' });
  }, [open, selectedExchangeId, messagesData?.messages?.length]);

  // Socket connection for realtime updates
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!open || !token) return;
    if (socketRef.current) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('new_message', ({ exchangeId }) => {
      queryClient.invalidateQueries({ queryKey: ['chatConversations'] });
      const current = selectedExchangeIdRef.current;
      if (current && String(exchangeId) === String(current)) {
        queryClient.invalidateQueries({ queryKey: ['exchangeMessages', current] });
      }
    });

    socket.on('typing', ({ exchangeId, fromUserId, isTyping }) => {
      const current = selectedExchangeIdRef.current;
      if (!current || String(exchangeId) !== String(current)) return;
      if (String(fromUserId) === String(user.id)) return;
      setTypingFromOther(Boolean(isTyping));
      if (isTyping) {
        setTimeout(() => setTypingFromOther(false), 1500);
      }
    });

    socket.on('read', ({ exchangeId }) => {
      const current = selectedExchangeIdRef.current;
      if (current && String(exchangeId) === String(current)) {
        queryClient.invalidateQueries({ queryKey: ['exchangeMessages', current] });
      }
      queryClient.invalidateQueries({ queryKey: ['chatConversations'] });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [open, user?.id, queryClient]);

  useEffect(() => {
    if (!open || !selectedExchangeId) return;
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit('join_exchange', { exchangeId: selectedExchangeId });
  }, [open, selectedExchangeId]);

  useEffect(() => {
    if (!open || !selectedExchangeId) return;
    // mark read when opening thread
    markExchangeReadApi(selectedExchangeId).then(() => {
      queryClient.invalidateQueries({ queryKey: ['chatConversations'] });
    }).catch(() => {});

    const socket = socketRef.current;
    if (socket) socket.emit('mark_read', { exchangeId: selectedExchangeId });
  }, [open, selectedExchangeId, queryClient]);

  const count = conversations.length;
  const title = count ? `Chat (${count})` : 'Chat';

  const selectedStatus = String(selected?.status || '').toLowerCase();
  const canView = Boolean(selected && (selectedStatus === 'accepted' || selectedStatus === 'completed'));
  const canChat = Boolean(selected && selectedStatus === 'accepted');

  return (
    <div className={variant === 'page' ? 'chatPageWrap' : 'chatFabWrap'}>
      {(!open && variant !== 'page') ? (
        <button className="button chatFab" type="button" onClick={() => setOpen(true)}>
          <FiMessageSquare /> {title}
        </button>
      ) : (
        <div className={variant === 'page' ? 'chatPanel chatPanelPage' : 'chatPanel'}>
          <div className="chatHeader">
            {selected ? (
              <button className="iconButton" type="button" onClick={() => setSelectedExchangeId(null)} aria-label="Back">
                <FiArrowLeft />
              </button>
            ) : (
              <div style={{ width: 36 }} />
            )}

            <div style={{ minWidth: 0 }}>
              <div className="chatTitle">{selected ? selected.otherPartyName : title}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {selected
                  ? `You teach: ${selected.youTeachTitle || '—'} • You learn: ${selected.youLearnTitle || '—'}${selected.status ? ` • ${selected.status}` : ''}`
                  : 'Accepted: chat • Completed: read-only'}
              </div>
            </div>

            {variant !== 'page' ? (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  className="iconButton"
                  type="button"
                  aria-label="Open full chat"
                  onClick={() => {
                    navigate('/chat');
                    setOpen(false);
                  }}
                >
                  <FiMessageSquare />
                </button>
                <button className="iconButton" type="button" onClick={() => setOpen(false)} aria-label="Close">
                  <FiX />
                </button>
              </div>
            ) : (
              <div style={{ width: 36 }} />
            )}

          </div>

          <div className="chatBody">
            {!selected ? (
              <>
                {isConversationsLoading ? <div className="muted">Loading…</div> : null}

                {!isConversationsLoading && !conversations.length ? (
                  <div className="muted">No accepted/completed exchanges yet.</div>
                ) : null}

                {conversations.length ? (
                  <div className="chatList">
                    {conversations.map((ex) => (
                      <button
                        key={ex.id}
                        type="button"
                        className="miniRow chatListItem"
                        style={{ textAlign: 'left' }}
                        onClick={() => setSelectedExchangeId(ex.id)}
                      >
                        <div className="chatListContent">
                          <div className="chatListTop">
                            <div className="chatListName" title={ex.otherPartyName || ''}>
                              {ex.otherPartyName}
                            </div>
                            <div className="chatListRight">
                              {ex.unread_count ? (
                                <span className="pill" style={{ fontSize: 12 }}>{ex.unread_count}</span>
                              ) : null}
                              <span className="chatListTime">{formatTime(ex.last_at) || ex.status}</span>
                            </div>
                          </div>

                          <div className="chatListSub" title={`Teach: ${ex.youTeachTitle || '—'} • Learn: ${ex.youLearnTitle || '—'}`}>
                            Teach: {ex.youTeachTitle || '—'} • Learn: {ex.youLearnTitle || '—'}
                          </div>

                          <div className="chatListPreview" title={ex.last_body || ''}>
                            {ex.last_body || 'No messages yet.'}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <>
                {!canView ? <div className="muted">Chat is unavailable for this exchange.</div> : null}
                <div className="chatMessages">
                  {isMessagesLoading ? <div className="muted">Loading…</div> : null}

                  {typingFromOther ? (
                    <div className="muted" style={{ fontSize: 12 }}>Typing…</div>
                  ) : null}

                  {!isMessagesLoading && (messagesData?.messages || []).length ? (
                    (messagesData?.messages || []).map((m) => {
                      const mine = String(m.from_user_id) === String(user?.id);
                      const hasAttachments = (m.attachments || []).length;
                      const reactions = m.reactions || [];
                      const byEmoji = new Map();
                      for (const r of reactions) {
                        const k = r.emoji;
                        byEmoji.set(k, (byEmoji.get(k) || 0) + 1);
                      }
                      const reactionEntries = Array.from(byEmoji.entries());
                      const pickerOpen = String(reactionPickerForMessageId || '') === String(m.id);
                      return (
                        <div
                          key={m.id}
                          style={{
                            display: 'flex',
                            justifyContent: mine ? 'flex-end' : 'flex-start',
                          }}
                        >
                          <div className="card" style={{ padding: 10, maxWidth: '82%', width: 'fit-content' }}>
                            <div
                              className="muted"
                              style={{
                                fontSize: 12,
                                marginBottom: 4,
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: 10,
                              }}
                            >
                              <span>{mine ? 'You' : (m.from_name || `User ${m.from_user_id}`)}</span>
                              <span style={{ flex: '0 0 auto' }}>{formatTime(m.created_at)}</span>
                            </div>
                            {m.body ? <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div> : null}

                            {hasAttachments ? (
                              <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                                {(m.attachments || []).map((a) => (
                                  <a key={a.id} className="button secondary" href={a.url} target="_blank" rel="noreferrer">
                                    {a.original_name || 'Attachment'}
                                  </a>
                                ))}
                              </div>
                            ) : null}

                            {reactionEntries.length ? (
                              <div
                                style={{
                                  display: 'flex',
                                  gap: 6,
                                  marginTop: 8,
                                  flexWrap: 'wrap',
                                  justifyContent: mine ? 'flex-end' : 'flex-start',
                                }}
                              >
                                {reactionEntries.map(([emoji, cnt]) => (
                                  <span
                                    key={emoji}
                                    className="pill"
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      padding: '2px 8px',
                                      fontSize: 12,
                                    }}
                                  >
                                    <span style={{ fontSize: 14, lineHeight: 1 }}>{emoji}</span>
                                    <span style={{ lineHeight: 1 }}>{cnt}</span>
                                  </span>
                                ))}
                              </div>
                            ) : null}

                            {canChat ? (
                              <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                                <button
                                  type="button"
                                  className="iconButton"
                                  style={{ width: 28, height: 28, borderRadius: 10, fontSize: 14 }}
                                  onClick={() => setReactionPickerForMessageId(pickerOpen ? null : m.id)}
                                  aria-label="Open reactions"
                                >
                                  😊
                                </button>

                                {pickerOpen ? (
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((e) => (
                                      <button
                                        key={e}
                                        type="button"
                                        className="iconButton"
                                        style={{ width: 28, height: 28, borderRadius: 10, fontSize: 14 }}
                                        onClick={() => {
                                          reactToMessage({ messageId: m.id, emoji: e });
                                          setReactionPickerForMessageId(null);
                                        }}
                                        aria-label={`React ${e}`}
                                      >
                                        {e}
                                      </button>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}

                            {mine ? (
                              <div className="muted" style={{ marginTop: 8, fontSize: 12, textAlign: 'right' }}>
                                {m.read_at ? 'Seen' : (m.delivered_at ? 'Delivered' : 'Sent')}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })
                  ) : null}

                  {!isMessagesLoading && !(messagesData?.messages || []).length ? (
                    <div className="muted">No messages yet.</div>
                  ) : null}

                  <div ref={messagesEndRef} />
                </div>

                <div className="chatComposer">
                  <input
                    className="input"
                    placeholder={canChat ? 'Type a message…' : 'Read-only'}
                    value={chatBody}
                    onChange={(e) => setChatBody(e.target.value)}
                    disabled={!canChat}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (!canChat) return;
                        if (chatBody.trim() && !isSending) sendMessage();
                      }
                    }}
                    onInput={() => {
                      const socket = socketRef.current;
                      if (socket && selectedExchangeId) socket.emit('typing', { exchangeId: selectedExchangeId, isTyping: true });
                    }}
                  />
                  {canChat ? (
                    <label className="button secondary" style={{ margin: 0 }}>
                      File
                      <input
                        type="file"
                        style={{ display: 'none' }}
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  ) : null}
                  <button
                    className="button"
                    type="button"
                    disabled={!canChat || isSending || (!chatBody.trim() && !file)}
                    onClick={() => sendMessage()}
                  >
                    {isSending ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
