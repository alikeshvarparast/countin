"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Reply, Send, SmilePlus } from "lucide-react";
import { markChatRead, sendChatMessage, toggleChatReaction } from "@/lib/actions/club";
import { Avatar } from "@/components/avatar";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/utils";

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
  replyTo?: { id: string; body: string; name: string } | null;
  reactions: { emoji: string; count: number; mine: boolean }[];
  user: { id: string; name: string; imageUrl?: string | null };
};

function isNearBottom(node: HTMLElement, slop = 80) {
  return node.scrollHeight - node.scrollTop - node.clientHeight < slop;
}

function scrollChildToTop(scroller: HTMLElement, target: HTMLElement) {
  scroller.scrollTop = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
}

export function ChatRoom({
  slug,
  currentUserId,
  messages,
  firstUnreadId,
}: {
  slug: string;
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
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [body, setBody] = useState("");

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
        void markChatRead(slug);
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
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-muted">
      <div ref={scroller} className="h-0 min-h-0 flex-1 space-y-2 overflow-y-auto bg-muted px-3 py-3">
        {messages.length === 0 && (
          <div className="flex min-h-full flex-col items-center justify-center px-6 py-16 text-center">
            <p className="font-display text-lg text-ink">Kick off the chat</p>
            <p className="mt-1 text-sm text-ink/50">Match talk, lift shares, and last-minute availability live here.</p>
          </div>
        )}
        {messages.map((m) => {
          const mine = m.user.id === currentUserId;
          return (
            <div key={m.id} id={`msg-${m.id}`}>
              {m.id === openUnreadId && (
                <div id="chat-unread-anchor" className="flex items-center gap-2 py-3">
                  <span className="h-px flex-1 bg-primary/40" />
                  <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-primary">New messages</span>
                  <span className="h-px flex-1 bg-primary/40" />
                </div>
              )}
              <div className={cn("flex w-full gap-2", mine ? "justify-end" : "justify-start")}>
              {!mine && <Avatar src={m.user.imageUrl} name={m.user.name} size="sm" />}
              <div className={cn("flex max-w-[75%] flex-col", mine ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "px-3 py-2 text-ink",
                    mine
                      ? "rounded-2xl rounded-br-md bg-primary"
                      : "rounded-2xl rounded-bl-md border border-line bg-card",
                  )}
                >
                  {!mine && <p className="text-[11px] font-medium text-ink/60">{m.user.name}</p>}
                  {m.replyTo && (
                    <p className="mb-1 border-l-2 border-ink/25 pl-2 text-[11px] text-ink/55">
                      <span className="font-medium">{m.replyTo.name}</span> · {m.replyTo.body}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
                </div>
                {m.reactions.length > 0 && (
                  <div className={cn("mt-1 flex flex-wrap gap-1", mine ? "justify-end" : "")}>
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
                          className={`rounded-full border px-1.5 py-0.5 text-xs ${
                            r.mine ? "border-primary/40 bg-primary/15" : "border-line bg-card"
                          }`}
                        >
                          {r.emoji} {r.count}
                        </button>
                      </form>
                    ))}
                  </div>
                )}
                <div className={cn("mt-1 flex items-center gap-1", mine ? "flex-row-reverse" : "")}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] text-ink/45 hover:text-ink"
                    onClick={() => setReplyTo(m)}
                  >
                    <Reply className="h-3 w-3" />
                    Reply
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] text-ink/45 hover:text-ink"
                      onClick={() => setPickerFor((id) => (id === m.id ? null : m.id))}
                    >
                      <SmilePlus className="h-3 w-3" />
                    </button>
                    {pickerFor === m.id && (
                      <div
                        className={cn(
                          "absolute bottom-6 z-10 flex gap-1 rounded-full border border-line bg-card p-1 shadow-md",
                          mine ? "right-0" : "left-0",
                        )}
                      >
                        {REACTION_EMOJIS.map((emoji) => (
                          <form
                            key={emoji}
                            action={async (formData) => {
                              await toggleChatReaction(formData);
                              setPickerFor(null);
                              router.refresh();
                            }}
                          >
                            <input type="hidden" name="slug" value={slug} />
                            <input type="hidden" name="messageId" value={m.id} />
                            <input type="hidden" name="emoji" value={emoji} />
                            <button type="submit" className="h-8 w-8 rounded-full text-sm hover:bg-muted">
                              {emoji}
                            </button>
                          </form>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              </div>
            </div>
          );
        })}
      </div>
      {!atBottom && (
        <button
          type="button"
          className="absolute bottom-[5.5rem] right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card text-ink shadow-[0_8px_24px_rgba(63,58,52,0.12)]"
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
        className="relative shrink-0 px-3 pb-3 pt-1"
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
            router.refresh();
          }
        }}
      >
        {composerOpen && (
          <div className="absolute inset-x-3 bottom-full z-20 mb-2 rounded-2xl border border-line bg-card p-2 shadow-[0_12px_32px_rgba(63,58,52,0.12)]">
            <div className="grid grid-cols-8 gap-1">
              {COMPOSER_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="flex h-9 items-center justify-center rounded-xl text-lg hover:bg-muted"
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
        <div className="rounded-3xl border border-line bg-card px-2 py-1.5 shadow-[0_8px_24px_rgba(63,58,52,0.08)]">
          {replyTo && (
            <div className="mb-1 flex items-center justify-between gap-2 rounded-2xl bg-muted px-3 py-2 text-xs text-ink/70">
              <p className="min-w-0 truncate">
                Replying to <span className="font-medium">{replyTo.user.name}</span> · {replyTo.body}
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
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink/55 hover:bg-muted hover:text-ink"
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
              placeholder="Message"
              className="max-h-32 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-ink outline-none placeholder:text-ink/40"
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
            <SubmitButton className="h-11 w-11 shrink-0 rounded-full px-0" disabled={!body.trim()}>
              <Send className="h-4 w-4" />
              <span className="sr-only">Send</span>
            </SubmitButton>
          </div>
        </div>
      </form>
    </div>
  );
}
