import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BrandMark } from '../components/ui/BrandMark';
import { api, ApiError } from '../lib/api';

type Invite = {
  creatorName: string;
  title: string;
  message?: string;
  retentionDays: number;
  expiresAt?: string;
};

type Question = {
  id: string;
  prompt: string;
  helpText?: string;
  type: string;
  options: string[] | null;
  round: 'ABOUT_ME' | 'HOW_I_SEE_YOU';
  category: string;
  isOptional: boolean;
  answer: { visibility: string; value: unknown } | null;
};

type Visibility = 'SHARE' | 'PRIVATE' | 'SKIPPED' | 'DECLINED';

const RECEIPT_KEY = 'detsbee_receipt';
const SESSION_KEY = 'detsbee_session';

export function PlayPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<'intro' | 'consent' | 'play' | 'review' | 'done'>('intro');
  const [sessionId, setSessionId] = useState(localStorage.getItem(SESSION_KEY) || '');
  const [receiptToken, setReceiptToken] = useState(localStorage.getItem(RECEIPT_KEY) || '');
  const [consentText, setConsentText] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [draftValue, setDraftValue] = useState<unknown>('');
  const [visibility, setVisibility] = useState<Visibility>('SHARE');
  const [streak, setStreak] = useState(0);
  const [busy, setBusy] = useState(false);
  const [creatorName, setCreatorName] = useState('');

  useEffect(() => {
    api<Invite>(`/api/play/invite/${token}`)
      .then(setInvite)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Invitation unavailable'));
  }, [token]);

  const current = questions[index];
  const aboutCount = questions.filter((q) => q.round === 'ABOUT_ME').length;
  const progress = questions.length ? ((index + (phase === 'review' || phase === 'done' ? 1 : 0)) / questions.length) * 100 : 0;
  const nectar = useMemo(() => Math.min(12, streak + questions.filter((q) => q.answer).length), [streak, questions]);

  async function begin() {
    setBusy(true);
    setError('');
    try {
      const started = await api<{
        sessionId: string;
        receiptToken: string;
        consent: { text: string };
        creatorName: string;
      }>('/api/play/sessions', {
        method: 'POST',
        body: JSON.stringify({ inviteToken: token, displayName }),
      });
      setSessionId(started.sessionId);
      setReceiptToken(started.receiptToken);
      setConsentText(started.consent.text);
      setCreatorName(started.creatorName);
      localStorage.setItem(SESSION_KEY, started.sessionId);
      localStorage.setItem(RECEIPT_KEY, started.receiptToken);
      setPhase('consent');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start');
    } finally {
      setBusy(false);
    }
  }

  async function acceptConsent() {
    setBusy(true);
    try {
      await api(`/api/play/sessions/${sessionId}/consent`, {
        method: 'POST',
        body: JSON.stringify({ receiptToken }),
      });
      const play = await api<{ questions: Question[]; creatorName: string }>(
        `/api/play/sessions/${sessionId}`,
        { receiptToken },
      );
      setQuestions(play.questions);
      setCreatorName(play.creatorName);
      hydrateDraft(play.questions[0]);
      setPhase('play');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Consent failed');
    } finally {
      setBusy(false);
    }
  }

  function hydrateDraft(q?: Question) {
    if (!q) return;
    if (q.answer) {
      setDraftValue(typeof q.answer.value === 'string' ? q.answer.value : q.answer.value == null ? '' : String(q.answer.value));
      setVisibility((q.answer.visibility as Visibility) || 'SHARE');
    } else {
      setDraftValue('');
      setVisibility('SHARE');
    }
  }

  async function saveCurrent(nextVisibility: Visibility, value: unknown) {
    if (!current) return;
    await api(`/api/play/sessions/${sessionId}/answers`, {
      method: 'PUT',
      body: JSON.stringify({
        receiptToken,
        answers: [{ questionId: current.id, visibility: nextVisibility, value }],
      }),
    });
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === index
          ? {
              ...q,
              answer: {
                visibility: nextVisibility,
                value: nextVisibility === 'SHARE' || nextVisibility === 'PRIVATE' ? value : null,
              },
            }
          : q,
      ),
    );
    if (nextVisibility === 'SHARE' || nextVisibility === 'PRIVATE' || nextVisibility === 'SKIPPED' || nextVisibility === 'DECLINED') {
      setStreak((s) => s + 1);
    }
  }

  async function goNext(nextVisibility: Visibility, value: unknown = draftValue) {
    setBusy(true);
    setError('');
    try {
      await saveCurrent(nextVisibility, value);
      if (index >= questions.length - 1) {
        setPhase('review');
      } else {
        const nextIndex = index + 1;
        setIndex(nextIndex);
        hydrateDraft(questions[nextIndex]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save answer');
    } finally {
      setBusy(false);
    }
  }

  async function submitAll() {
    setBusy(true);
    try {
      await api(`/api/play/sessions/${sessionId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ receiptToken }),
      });
      setPhase('done');
      localStorage.removeItem(SESSION_KEY);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Submit failed');
    } finally {
      setBusy(false);
    }
  }

  if (error && !invite) {
    return (
      <PlayChrome>
        <div className="rounded-[1.75rem] bg-white/10 p-6 text-cream">
          <h1 className="db-display text-3xl">Invitation unavailable</h1>
          <p className="mt-3 text-ink-300">{error}</p>
          <Link to="/" className="db-btn db-btn-primary mt-6 inline-flex">
            Back to Detsbee
          </Link>
        </div>
      </PlayChrome>
    );
  }

  if (!invite) {
    return (
      <PlayChrome>
        <p className="text-cream/80">Opening invitation…</p>
      </PlayChrome>
    );
  }

  return (
    <PlayChrome nectar={nectar}>
      <div className="mb-6">
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-honey-300 to-honey-500"
            animate={{ width: `${Math.max(phase === 'intro' ? 8 : progress, 8)}%` }}
          />
        </div>
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-honey-300">
          Discovery trail · {phase}
        </p>
      </div>

      {error && <p className="mb-4 rounded-2xl bg-red-500/20 px-4 py-3 text-sm text-red-100">{error}</p>}

      <AnimatePresence mode="wait">
        {phase === 'intro' && (
          <motion.section
            key="intro"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-5"
          >
            <p className="db-chip !bg-honey-400/20 !text-honey-100">Invitation from {invite.creatorName}</p>
            <h1 className="db-display text-4xl text-cream sm:text-5xl">{invite.title}</h1>
            <p className="text-lg text-ink-200">
              {invite.message || `${invite.creatorName} invited you to a gentle discovery game.`}
            </p>
            <ul className="space-y-2 rounded-[1.5rem] bg-white/5 p-4 text-sm text-ink-200">
              <li>You’ll answer optional questions about yourself and about {invite.creatorName}.</li>
              <li>You choose Share, Private, Skip, or “I don’t want to share” for every question.</li>
              <li>Responses are retained for about {invite.retentionDays} days, then expire.</li>
              <li>No account required. You’ll get a private receipt after submitting.</li>
            </ul>
            <label className="block text-sm font-semibold text-honey-100">
              What should we call you? <span className="font-normal text-ink-400">(optional)</span>
              <input
                className="db-input mt-2 !bg-white/10 !text-cream"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="A name or nickname"
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <button className="db-btn db-btn-primary" disabled={busy} onClick={() => void begin()}>
                Continue to privacy
              </button>
              <Link to="/" className="db-btn db-btn-ghost !border-white/20 !text-cream">
                Leave
              </Link>
            </div>
          </motion.section>
        )}

        {phase === 'consent' && (
          <motion.section
            key="consent"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-5"
          >
            <h2 className="db-display text-3xl text-cream">Before we begin</h2>
            <p className="rounded-[1.5rem] bg-white/5 p-4 leading-relaxed text-ink-200">{consentText}</p>
            <button className="db-btn db-btn-primary" disabled={busy} onClick={() => void acceptConsent()}>
              I understand — start discovery
            </button>
          </motion.section>
        )}

        {phase === 'play' && current && (
          <motion.section
            key={current.id}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            className="space-y-5"
          >
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="rounded-full bg-honey-400/15 px-3 py-1 text-honey-100">
                {current.round === 'ABOUT_ME' ? `About you · ${index + 1}/${aboutCount}` : `How you see ${creatorName}`}
              </span>
              <span className="text-ink-400">{index + 1}/{questions.length}</span>
            </div>
            <h2 className="db-display text-3xl leading-tight text-cream sm:text-4xl">{current.prompt}</h2>
            {current.helpText && <p className="text-ink-300">{current.helpText}</p>}

            <textarea
              className="db-input min-h-36 !bg-white/10 !text-cream"
              value={typeof draftValue === 'string' ? draftValue : ''}
              onChange={(e) => setDraftValue(e.target.value)}
              placeholder="Write your own answer"
            />

            <div className="rounded-[1.25rem] bg-white/5 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-honey-300">
                Who can see this?
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['SHARE', 'Share'],
                    ['PRIVATE', 'Private'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                      visibility === value ? 'bg-honey-400 text-ink-950' : 'bg-white/10 text-cream'
                    }`}
                    onClick={() => setVisibility(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <button
                className="db-btn db-btn-primary"
                disabled={busy}
                onClick={() => void goNext(visibility, draftValue)}
              >
                Save & continue
              </button>
              <button
                className="db-btn db-btn-ghost !border-white/20 !text-cream"
                disabled={busy}
                onClick={() => void goNext('SKIPPED', null)}
              >
                Skip
              </button>
              <button
                className="db-btn db-btn-ghost !border-white/20 !text-cream"
                disabled={busy}
                onClick={() => void goNext('DECLINED', null)}
              >
                I don’t want to share
              </button>
            </div>
          </motion.section>
        )}

        {phase === 'review' && (
          <motion.section
            key="review"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            <h2 className="db-display text-3xl text-cream">Review before send</h2>
            <p className="text-ink-300">Check visibility one last time. Nothing is submitted until you confirm.</p>
            <div className="space-y-3">
              {questions.map((q, i) => (
                <button
                  key={q.id}
                  type="button"
                  className="w-full rounded-2xl bg-white/5 p-4 text-left"
                  onClick={() => {
                    setIndex(i);
                    hydrateDraft(q);
                    setPhase('play');
                  }}
                >
                  <p className="text-xs uppercase tracking-wider text-honey-300">{q.answer?.visibility || 'UNANSWERED'}</p>
                  <p className="mt-1 font-semibold text-cream">{q.prompt}</p>
                  <p className="mt-1 text-sm text-ink-300">
                    {q.answer?.visibility === 'SHARE' || q.answer?.visibility === 'PRIVATE'
                      ? Array.isArray(q.answer.value)
                        ? q.answer.value.join(', ')
                        : String(q.answer.value)
                      : 'No answer'}
                  </p>
                </button>
              ))}
            </div>
            <button className="db-btn db-btn-primary" disabled={busy} onClick={() => void submitAll()}>
              Submit discovery
            </button>
          </motion.section>
        )}

        {phase === 'done' && (
          <motion.section
            key="done"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-5 text-center"
          >
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-honey-400 text-3xl text-ink-950">
              ✦
            </div>
            <h2 className="db-display text-4xl text-cream">Discovery complete</h2>
            <p className="text-ink-300">
              Your private receipt is ready. Shared answers go to {creatorName}. Private ones stay with you.
            </p>
            <button
              className="db-btn db-btn-primary"
              onClick={() => navigate(`/receipt/${receiptToken}`)}
            >
              Open private receipt
            </button>
          </motion.section>
        )}
      </AnimatePresence>
    </PlayChrome>
  );
}

function PlayChrome({ children, nectar = 0 }: { children: ReactNode; nectar?: number }) {
  return (
    <div className="min-h-screen bg-ink-950 text-cream">
      <div className="pointer-events-none absolute inset-0 honeycomb opacity-30" />
      <div className="relative mx-auto min-h-screen w-full max-w-lg px-4 py-6 sm:px-6">
        <div className="mb-8 flex items-center justify-between">
          <BrandMark light size={32} />
          <span className="rounded-full bg-honey-400/15 px-3 py-1 text-xs font-semibold text-honey-200">
            Nectar {nectar}
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
