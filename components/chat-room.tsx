"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Pencil, Reply, Send, SmilePlus, Trash2 } from "lucide-react";
import { deleteChatMessage, editChatMessage, markChatRead, sendChatMessage, toggleChatReaction } from "@/lib/actions/club";
import { Avatar } from "@/components/avatar";
import { SubmitButton } from "@/components/submit-button";
import { syncAppBadge } from "@/lib/pwa-client";
import { chatDayKey, cn, formatChatDayLabel, formatTime } from "@/lib/utils";

const REACTION_EMOJIS = ["👍", "❤️", "😂", "🔥", "⚽", "👏"];

const COMPOSER_EMOJIS = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "🤩", "😎",
  "😢", "😭", "😡", "🤔", "😴", "🙌", "👏", "👍",
  "👎", "❤️", "🔥", "⭐", "🎉", "⚽", "🏆", "💪",
  "✅", "❌", "🙏", "😅", "🤝", "👋", "💯", "⏰",
];

type ChatMessage = {
  id: string;
  body: string;
  createdAt: number;
  editedAt?: number | null;
  deletedAt?: number | null;
  replyTo?: { id: string; body: string; name: string; deleted?: boolean } | null;
  reactions: { emoji: string; count: number; mine: boolean }[];
  user: { id: string; name: string; imageUrl?: string | null };
};

function isNearBottom(node: HTMLElement, slop = 80) {
  return node.scrollHeight - node.scrollTop - node.clientHeight < slop;
}

function scrollChildToTop(scroller: HTMLElement, target: HTMLElement) {
  scroller.scrollTop = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
}

function MessageMeta({
  createdAt,
  editedAt,
  timeZone,
  mine,
}: {
  createdAt: number;
  editedAt?: number | null;
  timeZone: string;
  mine?: boolean;
}) {
  return (
    <span
      className={cn(
        "float-right ml-2 mt-1 inline-flex items-center gap-1 whitespace-nowrap text-[11px] leading-none",
        mine ? "text-[#5a7a6a]" : "text-[#667781]",
      )}
    >
      {editedAt ? <span className="italic">edited</span> : null}
      <span>{formatTime(createdAt, timeZone)}</span>
    </span>
  );
}

export function ChatRoom({
  slug,
  timezone,
  currentUserId,
  messages,
  firstUnreadId,
}: {
  slug: string;
  timezone: string;
  currentUserId: string;
  messages: ChatMessage[];
  firstUnreadId?: string | null;
}) {
  const router = useRouter();
  const scroller = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [openUnreadId] = useState(firstUnreadId ?? null);
  const followLatest = useRef(!firstUnreadId);
  const didInitialPin = useRef(false);
  const [atBottom, setAtBottom] = useState(!firstUnreadId);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [menuOpenUp, setMenuOpenUp] = useState(false);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const longPressTimer = useRef<number | null>(null);

  function clearLongPress() {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function openMessageMenu(id: string, anchor?: HTMLElement | null) {
    const scrollerNode = scroller.current;
    let openUp = false;
    if (anchor && scrollerNode) {
      const spaceBelow = scrollerNode.getBoundingClientRect().bottom - anchor.getBoundingClientRect().bottom;
      openUp = spaceBelow < 230;
    } else if (scrollerNode) {
      // Long-press fallback: prefer upward near the bottom of the thread.
      openUp = scrollerNode.scrollHeight - scrollerNode.scrollTop - scrollerNode.clientHeight < 160;
    }
    setMenuOpenUp(openUp);
    setMenuFor(id);
    setPickerFor(null);
    setConfirmDeleteId(null);
  }

  function closeMessageMenu() {
    setMenuFor(null);
    setMenuOpenUp(false);
    setPickerFor(null);
    setConfirmDeleteId(null);
  }

  function unreadTarget() {
    const node = scroller.current;
    if (!node || !openUnreadId) return null;
    return (
      node.querySelector<HTMLElement>("#chat-unread-anchor") ??
      node.querySelector<HTMLElement>(`[id="msg-${openUnreadId}"]`)
    );
  }

  function pinToLatest() {
    const node = scroller.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }

  function pinOpenPosition() {
    const node = scroller.current;
    if (!node) return;
    const unread = unreadTarget();
    if (unread) scrollChildToTop(node, unread);
    else pinToLatest();
  }

  useLayoutEffect(() => {
    const node = scroller.current;
    if (!node) return;
    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      pinOpenPosition();
    };

    run();
    const frame = requestAnimationFrame(() => {
      run();
      requestAnimationFrame(() => {
        run();
        if (cancelled) return;
        didInitialPin.current = true;
        followLatest.current = !unreadTarget();
        setAtBottom(isNearBottom(node));
        void markChatRead(slug).then(() => {
          void syncAppBadge();
        });
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [slug, openUnreadId]);

  useLayoutEffect(() => {
    if (!didInitialPin.current || !followLatest.current) return;
    pinToLatest();
  }, [messages.length]);

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const onScroll = () => {
      const bottom = isNearBottom(node);
      followLatest.current = bottom;
      setAtBottom(bottom);
    };
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => node.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => router.refresh(), 4000);
    return () => window.clearInterval(t);
  }, [router]);

  useEffect(() => {
    if (!menuFor) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("[data-chat-msg-menu]")) return;
      closeMessageMenu();
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [menuFor]);

  useLayoutEffect(() => {
    if (!menuFor) return;
    const menu = document.querySelector<HTMLElement>("[data-chat-menu-panel]");
    menu?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [menuFor, menuOpenUp, pickerFor, confirmDeleteId]);

  function insertEmoji(emoji: string) {
    const el = inputRef.current;
    if (!el) {
      setBody((value) => value + emoji);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + emoji + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      const pos = start + emoji.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div ref={scroller} className="chat-wa-bg h-0 min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-3 sm:px-3">
        {messages.length === 0 && (
          <div className="flex min-h-full flex-col items-center justify-center px-6 py-16 text-center">
            <div className="chat-wa-day rounded-lg px-3 py-1.5 text-xs font-medium">
              No messages yet — say hello
            </div>
          </div>
        )}
        {messages.map((m, index) => {
          const mine = m.user.id === currentUserId;
          const deleted = Boolean(m.deletedAt);
          const editing = editingId === m.id;
          const menuOpen = menuFor === m.id;
          const prev = index > 0 ? messages[index - 1] : null;
          const showDay = !prev || chatDayKey(prev.createdAt, timezone) !== chatDayKey(m.createdAt, timezone);
          const showAvatar = !mine && (!prev || prev.user.id !== m.user.id || showDay);
          const clustered = Boolean(prev && prev.user.id === m.user.id && !showDay);

          return (
            <div key={m.id} id={`msg-${m.id}`} className={cn(clustered ? "mt-0.5" : "mt-2")}>
              {showDay && (
                <div className="mb-3 flex justify-center pt-1">
                  <span className="chat-wa-day rounded-lg px-3 py-1 text-[12px] font-medium">
                    {formatChatDayLabel(m.createdAt, timezone)}
                  </span>
                </div>
              )}
              {m.id === openUnreadId && (
                <div id="chat-unread-anchor" className="mb-2 flex items-center gap-2 py-2">
                  <span className="h-px flex-1 bg-[#25d366]/50" />
                  <span className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[#128c7e]">
                    New messages
                  </span>
                  <span className="h-px flex-1 bg-[#25d366]/50" />
                </div>
              )}
              <div className={cn("flex w-full gap-1.5", mine ? "justify-end" : "justify-start")}>
                {!mine && (
                  <div className="w-8 shrink-0">
                    {showAvatar ? <Avatar src={m.user.imageUrl} name={m.user.name} size="sm" /> : null}
                  </div>
                )}
                <div
                  className={cn(
                    "group relative flex max-w-[82%] flex-col sm:max-w-[72%]",
                    mine ? "items-end" : "items-start",
                  )}
                  data-chat-msg-menu={menuOpen ? "" : undefined}
                  onPointerDown={(event) => {
                    if (deleted || editing || event.button !== 0) return;
                    // Desktop uses hover + click; long-press is for touch.
                    if (event.pointerType === "mouse") return;
                    clearLongPress();
                    const anchor = event.currentTarget as HTMLElement;
                    longPressTimer.current = window.setTimeout(() => {
                      openMessageMenu(m.id, anchor);
                    }, 450);
                  }}
                  onPointerUp={clearLongPress}
                  onPointerCancel={clearLongPress}
                  onPointerLeave={clearLongPress}
                  onContextMenu={(event) => {
                    if (deleted || editing) return;
                    event.preventDefault();
                    openMessageMenu(m.id, event.currentTarget as HTMLElement);
                  }}
                >
                  <div
                    className={cn(
                      "relative px-2.5 pb-1.5 pt-1.5 text-[14.2px] leading-[1.35]",
                      deleted
                        ? "chat-wa-bubble-deleted rounded-lg"
                        : mine
                          ? "chat-wa-bubble-mine rounded-lg rounded-tr-sm"
                          : "chat-wa-bubble-theirs rounded-lg rounded-tl-sm",
                    )}
                  >
                    {!deleted && !editing && (
                      <button
                        type="button"
                        className={cn(
                          "absolute top-0 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/10 text-[#54656f] shadow-sm backdrop-blur-[1px] transition-opacity",
                          mine ? "-left-1" : "-right-1",
                          menuOpen ? "opacity-100" : "opacity-0 md:group-hover:opacity-100",
                        )}
                        aria-label="Message actions"
                        aria-expanded={menuOpen}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (menuOpen) closeMessageMenu();
                          else openMessageMenu(m.id, event.currentTarget);
                        }}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    )}
                    {!mine && !deleted && showAvatar && (
                      <p className="mb-0.5 text-[12.5px] font-semibold text-[#128c7e]">{m.user.name}</p>
                    )}
                    {deleted ? (
                      <>
                        <p className="inline text-[14px] italic">Deleted message</p>
                        <MessageMeta createdAt={m.createdAt} timeZone={timezone} mine={mine} />
                      </>
                    ) : editing ? (
                      <form
                        className="min-w-[14rem] space-y-2"
                        action={async (formData) => {
                          const result = await editChatMessage(formData);
                          if (!result?.error) {
                            setEditingId(null);
                            setEditBody("");
                            router.refresh();
                          }
                        }}
                      >
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="messageId" value={m.id} />
                        <textarea
                          name="body"
                          required
                          maxLength={2000}
                          rows={3}
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          className="w-full resize-none rounded-lg border border-[#d1d7db] bg-white px-2 py-1.5 text-sm text-[#111b21] outline-none"
                        />
                        <div className="flex gap-2">
                          <SubmitButton size="sm" disabled={!editBody.trim()}>
                            Save
                          </SubmitButton>
                          <button
                            type="button"
                            className="text-xs text-[#667781]"
                            onClick={() => {
                              setEditingId(null);
                              setEditBody("");
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        {m.replyTo && (
                          <div className="mb-1 rounded-md border-l-4 border-[#25d366] bg-black/5 px-2 py-1 text-[12px] text-[#54656f]">
                            <p className="font-semibold text-[#128c7e]">{m.replyTo.name}</p>
                            <p className={cn("line-clamp-2", m.replyTo.deleted && "italic")}>{m.replyTo.body}</p>
                          </div>
                        )}
                        <p className="whitespace-pre-wrap break-words">
                          {m.body}
                          <MessageMeta
                            createdAt={m.createdAt}
                            editedAt={m.editedAt}
                            timeZone={timezone}
                            mine={mine}
                          />
                        </p>
                      </>
                    )}

                    {menuOpen && !deleted && !editing && (
                      <div
                        className={cn(
                          "absolute z-30 min-w-[10.5rem] overflow-hidden rounded-xl border border-[#e9edef] bg-white py-1 text-sm text-[#111b21] shadow-[0_8px_24px_rgba(11,20,26,0.18)]",
                          menuOpenUp ? "bottom-8" : "top-8",
                          mine ? "left-0" : "right-0",
                        )}
                        data-chat-msg-menu=""
                        data-chat-menu-panel=""
                      >
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-[#f0f2f5]"
                          onClick={() => {
                            setReplyTo(m);
                            closeMessageMenu();
                          }}
                        >
                          <Reply className="h-4 w-4 text-[#54656f]" />
                          Reply
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-[#f0f2f5]"
                          onClick={() => setPickerFor((id) => (id === m.id ? null : m.id))}
                        >
                          <SmilePlus className="h-4 w-4 text-[#54656f]" />
                          React
                        </button>
                        {pickerFor === m.id && (
                          <div className="flex flex-wrap gap-1 border-t border-[#e9edef] px-2 py-2">
                            {REACTION_EMOJIS.map((emoji) => (
                              <form
                                key={emoji}
                                action={async (formData) => {
                                  await toggleChatReaction(formData);
                                  closeMessageMenu();
                                  router.refresh();
                                }}
                              >
                                <input type="hidden" name="slug" value={slug} />
                                <input type="hidden" name="messageId" value={m.id} />
                                <input type="hidden" name="emoji" value={emoji} />
                                <button type="submit" className="h-9 w-9 rounded-full text-base hover:bg-[#f0f2f5]">
                                  {emoji}
                                </button>
                              </form>
                            ))}
                          </div>
                        )}
                        {mine && (
                          <>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-[#f0f2f5]"
                              onClick={() => {
                                setEditingId(m.id);
                                setEditBody(m.body);
                                closeMessageMenu();
                              }}
                            >
                              <Pencil className="h-4 w-4 text-[#54656f]" />
                              Edit
                            </button>
                            {confirmDeleteId === m.id ? (
                              <form
                                className="flex items-center gap-2 border-t border-[#e9edef] px-3 py-2"
                                action={async (formData) => {
                                  await deleteChatMessage(formData);
                                  if (replyTo?.id === m.id) setReplyTo(null);
                                  closeMessageMenu();
                                  router.refresh();
                                }}
                              >
                                <input type="hidden" name="slug" value={slug} />
                                <input type="hidden" name="messageId" value={m.id} />
                                <SubmitButton variant="danger" size="sm" className="h-7 px-2 text-[11px]">
                                  Confirm
                                </SubmitButton>
                                <button
                                  type="button"
                                  className="text-[11px] text-[#667781]"
                                  onClick={() => setConfirmDeleteId(null)}
                                >
                                  Cancel
                                </button>
                              </form>
                            ) : (
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[#c62828] hover:bg-[#f0f2f5]"
                                onClick={() => setConfirmDeleteId(m.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {!deleted && m.reactions.length > 0 && (
                    <div className={cn("-mt-1 flex flex-wrap gap-1 px-1", mine ? "justify-end" : "")}>
                      {m.reactions.map((r) => (
                        <form
                          key={r.emoji}
                          action={async (formData) => {
                            await toggleChatReaction(formData);
                            router.refresh();
                          }}
                        >
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="messageId" value={m.id} />
                          <input type="hidden" name="emoji" value={r.emoji} />
                          <button
                            type="submit"
                            className={cn(
                              "rounded-full border bg-white px-1.5 py-0.5 text-xs shadow-sm",
                              r.mine ? "border-[#25d366]/50" : "border-[#e9edef]",
                            )}
                          >
                            {r.emoji} {r.count}
                          </button>
                        </form>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {!atBottom && (
        <button
          type="button"
          className="chat-jump-latest absolute bottom-[5.5rem] right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-[#e9edef] bg-white text-[#54656f] shadow-[0_8px_24px_rgba(11,20,26,0.16)]"
          aria-label="Jump to latest message"
          onClick={() => {
            followLatest.current = true;
            pinToLatest();
            setAtBottom(true);
          }}
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      )}
      <form
        ref={formRef}
        className="chat-composer chat-wa-composer relative shrink-0 px-2 pb-2 pt-2 transition-[padding] duration-200 sm:px-3"
        action={async (formData) => {
          const result = await sendChatMessage(formData);
          if (!result?.error) {
            formRef.current?.reset();
            setBody("");
            setReplyTo(null);
            setComposerOpen(false);
            followLatest.current = true;
            pinToLatest();
            setAtBottom(true);
            inputRef.current?.blur();
            router.refresh();
          }
        }}
      >
        {composerOpen && (
          <div className="absolute inset-x-3 bottom-full z-20 mb-2 rounded-2xl border border-[#e9edef] bg-white p-2 shadow-[0_12px_32px_rgba(11,20,26,0.16)]">
            <div className="grid grid-cols-8 gap-1">
              {COMPOSER_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="flex h-9 items-center justify-center rounded-xl text-lg hover:bg-[#f0f2f5]"
                  onClick={() => {
                    insertEmoji(emoji);
                    setComposerOpen(false);
                    inputRef.current?.focus();
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1 rounded-[1.5rem] bg-white px-2 py-1 shadow-sm">
            {replyTo && (
              <div className="mb-1 flex items-center justify-between gap-2 rounded-xl border-l-4 border-[#25d366] bg-[#f0f2f5] px-3 py-2 text-xs text-[#54656f]">
                <p className="min-w-0 truncate">
                  Replying to <span className="font-semibold text-[#128c7e]">{replyTo.user.name}</span> ·{" "}
                  {replyTo.deletedAt ? "Deleted message" : replyTo.body}
                </p>
                <button type="button" className="shrink-0" onClick={() => setReplyTo(null)}>
                  Cancel
                </button>
              </div>
            )}
            <div className="flex items-end gap-1">
              <input type="hidden" name="slug" value={slug} />
              {replyTo && <input type="hidden" name="replyToId" value={replyTo.id} />}
              <button
                type="button"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#54656f] hover:bg-[#f0f2f5]"
                aria-label="Insert emoji"
                onClick={() => setComposerOpen((open) => !open)}
              >
                <SmilePlus className="h-5 w-5" />
              </button>
              <textarea
                ref={inputRef}
                name="body"
                required
                maxLength={2000}
                rows={1}
                value={body}
                placeholder="Type a message"
                className="max-h-32 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-[15px] text-[#111b21] outline-none placeholder:text-[#667781]"
                autoComplete="off"
                onChange={(event) => {
                  setBody(event.target.value);
                  event.target.style.height = "auto";
                  event.target.style.height = `${Math.min(event.target.scrollHeight, 128)}px`;
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    formRef.current?.requestSubmit();
                  }
                }}
              />
            </div>
          </div>
          <SubmitButton
            className="h-12 w-12 shrink-0 rounded-full bg-[#25d366] px-0 text-white shadow-sm hover:bg-[#20bd5a]"
            disabled={!body.trim()}
          >
            <Send className="h-5 w-5" />
            <span className="sr-only">Send</span>
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
