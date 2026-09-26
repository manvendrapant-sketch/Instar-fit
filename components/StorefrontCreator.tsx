'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Icon } from '@/lib/icons';
import { useAppState } from '@/lib/store';
import { FieldError, TextField } from '@/components/AuthFields';
import { OfferCard } from '@/components/OfferCard';
import { OFFERS_PATH } from '@/lib/offers';
import { isPayoutsReady, PAYOUTS_PATH } from '@/lib/payouts';
import {
  addSpecialty,
  AVATAR_MAX_BYTES,
  BIO_MAX,
  COACHING_MODES,
  DEFAULT_TIME_ZONE,
  detectTimeZone,
  handleStatus,
  locationLine,
  LOCATION_MAX,
  normalizeHandle,
  saveProfile,
  setStorefrontPublished,
  SPECIALTIES,
  SPECIALTIES_MAX,
  SPECIALTY_MAX_LEN,
  timeZoneLabel,
  toUpdateProfileRequest,
  validateStorefront,
  withStorefrontDefaults,
  type CoachingMode,
  type StorefrontDraft,
  type StorefrontField,
} from '@/lib/storefront';

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '');
}

export function StorefrontCreator({ defaults }: { defaults: Pick<StorefrontDraft, 'handle' | 'displayName'> }) {
  const { storefront, refreshStorefront, storefrontStatus, refreshStorefrontStatus, hydrated, toast, offers, payouts } = useAppState();
  const shownOffers = offers.filter((o) => o.active);
  const hasOffer = offers.length > 0;
  const payoutsReady = isPayoutsReady(payouts);
  // Time zone starts as a fixed default so server and client render the same markup; the
  // browser's own zone replaces it after mount.
  const [draft, setDraft] = useState<StorefrontDraft>(() => withStorefrontDefaults({ ...defaults, timeZone: DEFAULT_TIME_ZONE }));
  const [zones, setZones] = useState<string[]>([]);
  const [customSpecialty, setCustomSpecialty] = useState('');
  const [errors, setErrors] = useState<Partial<Record<StorefrontField, string>>>({});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Prefill from the loaded profile once it's completed (so "Edit details" starts from what's
  // saved); otherwise use this device's time zone.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (storefront?.completed) setDraft(storefront);
    else setDraft((d) => ({ ...d, timeZone: detectTimeZone() }));
  }, [storefront]);

  // The zone list comes from the browser, after mount, so it can't differ between server and client.
  useEffect(() => {
    let list: string[] = [];
    try {
      list = Intl.supportedValuesOf('timeZone');
    } catch {
      list = [];
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setZones(list);
  }, []);

  if (!hydrated) return null;

  // `hydrated` only means the load attempt finished — `storefront` staying null means
  // GET /api/coach/profile itself failed (auth hiccup, transient DB error, ...). Show that
  // plainly with a retry instead of silently rendering nothing, which just looks like the page
  // is broken.
  if (!storefront) {
    return (
      <section className="ins-panel ins-offers-missing ins-in" aria-live="polite">
        <h2>Couldn’t load your storefront</h2>
        <p>Something went wrong loading your profile. Check your connection and try again.</p>
        <button type="button" className="ins-btn go" onClick={() => refreshStorefront()}>
          Try again
        </button>
      </section>
    );
  }

  // Only the fields the form itself edits — never `completed`, which the server derives.
  const set = <K extends Exclude<keyof StorefrontDraft, 'completed'>>(key: K, value: StorefrontDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    // Editing a field clears its error; the next submit re-checks everything.
    const field: StorefrontField = key === 'avatarUrl' ? 'avatar' : key === 'coachingMode' ? 'location' : key;
    setErrors((x) => (x[field] ? { ...x, [field]: undefined } : x));
  };

  function onPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrors((x) => ({ ...x, avatar: 'Choose an image file (JPG, PNG or WebP).' }));
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setErrors((x) => ({ ...x, avatar: 'Choose a photo under 2 MB.' }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      set('avatarUrl', String(reader.result));
      setErrors((x) => ({ ...x, avatar: undefined }));
    };
    reader.readAsDataURL(file);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const clean = {
      ...draft,
      displayName: draft.displayName.trim(),
      bio: draft.bio?.trim() || null,
      location: draft.location?.trim() || null,
    };
    const next = validateStorefront(clean);
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    const result = await saveProfile(toUpdateProfileRequest(clean));
    setSaving(false);

    if (!result.ok) {
      setErrors(result.fieldErrors);
      if (Object.keys(result.fieldErrors).length === 0) toast(result.message);
      return;
    }

    await Promise.all([refreshStorefront(), refreshStorefrontStatus()]);
    setEditing(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function onPublishToggle(published: boolean) {
    setPublishing(true);
    const result = await setStorefrontPublished(published);
    setPublishing(false);
    if (!result.ok) {
      toast(result.message);
      return;
    }
    await refreshStorefrontStatus();
    toast(published ? "You're live." : 'Storefront hidden.');
  }

  const toggleSpecialty = (s: string) =>
    set('specialties', draft.specialties.includes(s) ? draft.specialties.filter((x) => x !== s) : addSpecialty(draft.specialties, s));
  const addCustom = () => {
    set('specialties', addSpecialty(draft.specialties, customSpecialty));
    setCustomSpecialty('');
  };
  const full = draft.specialties.length >= SPECIALTIES_MAX;
  const customs = draft.specialties.filter((s) => !(SPECIALTIES as readonly string[]).includes(s));
  const zoneOptions = zones.includes(draft.timeZone) ? zones : [draft.timeZone, ...zones];

  const status = handleStatus(draft.handle);
  const bioLen = (draft.bio ?? '').length;
  const showForm = !storefront.completed || editing;
  const shown = showForm ? draft : storefront;

  return (
    <>
      <section className="ins-space-hero ins-sf-hero">
        <div>
          <div className="ins-label ins-in" style={{ marginBottom: 18 }}>
            Business · Storefront
          </div>
          <h1 className="ins-in d1">{showForm && !storefront ? 'Create your storefront' : 'Your storefront'}</h1>
          <p className="ins-in d2">
            {showForm && !storefront
              ? 'One link for your Instagram bio. Clients see who you are, pick an offer and pay you, all on their phone.'
              : 'This is what clients see when they open your link.'}
          </p>
        </div>
      </section>

      <div className="ins-sf-grid">
        {showForm ? (
          <form className="ins-panel ins-sf-form ins-in d2" onSubmit={onSubmit} noValidate aria-labelledby="sf-form-title">
            <div className="ins-panel-h">
              <h2 id="sf-form-title">{storefront ? 'Edit details' : 'Your details'}</h2>
              <span className="ins-label">You can change these later</span>
            </div>

            <div className="ins-sf-fields">
              <TextField
                name="handle"
                label="Storefront link"
                icon="storefront"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="maya"
                value={draft.handle}
                onChange={(e) => set('handle', normalizeHandle(e.target.value))}
                error={errors.handle}
                hint={
                  status === 'available' ? (
                    <span className="ins-sf-ok">
                      <Icon name="check" className="ins-i sm" />
                      {draft.handle}.instar.co is available
                    </span>
                  ) : status === 'taken' ? (
                    <span className="ins-sf-taken">{draft.handle}.instar.co is taken. Try another.</span>
                  ) : (
                    'Lowercase letters, numbers and hyphens. This goes in your Instagram bio.'
                  )
                }
                required
              />

              <TextField
                name="displayName"
                label="Name clients see"
                icon="user"
                autoComplete="name"
                placeholder="Maya Reyes Coaching"
                value={draft.displayName}
                onChange={(e) => set('displayName', e.target.value)}
                error={errors.displayName}
                required
              />

              <div className="ins-field">
                <span className="ins-field-l" id="photo-l">
                  Profile photo <span className="ins-sf-opt">Optional</span>
                </span>
                <div className="ins-sf-photo">
                  <span className="ins-sf-avatar lg" aria-hidden="true">
                    {draft.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={draft.avatarUrl} alt="" />
                    ) : (
                      initials(draft.displayName) || <Icon name="user" />
                    )}
                  </span>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={onPhoto}
                    aria-labelledby="photo-l"
                  />
                  <button type="button" className="ins-btn" onClick={() => fileRef.current?.click()}>
                    {draft.avatarUrl ? 'Change photo' : 'Upload photo'}
                  </button>
                  {draft.avatarUrl && (
                    <button type="button" className="ins-btn quiet" onClick={() => set('avatarUrl', null)}>
                      Remove
                    </button>
                  )}
                </div>
                <FieldError id="avatar-err" message={errors.avatar} />
              </div>

              <label className="ins-field">
                <span className="ins-field-l">
                  Short bio <span className="ins-sf-opt">Optional</span>
                </span>
                <span className={`ins-textarea ${errors.bio || bioLen > BIO_MAX ? 'bad' : ''}`}>
                  <textarea
                    name="bio"
                    rows={3}
                    placeholder="Strength coach for busy parents. Three sessions a week, real food, no burnout."
                    value={draft.bio ?? ''}
                    onChange={(e) => set('bio', e.target.value)}
                    aria-invalid={!!errors.bio}
                    aria-describedby="bio-count"
                  />
                </span>
                <span className={`ins-field-hint ins-sf-count ${bioLen > BIO_MAX ? 'over' : ''}`} id="bio-count">
                  <span className="ins-num">
                    {bioLen}/{BIO_MAX}
                  </span>
                </span>
                <FieldError id="bio-err" message={errors.bio} />
              </label>

              <fieldset className="ins-field ins-sf-fieldset" aria-describedby="spec-hint">
                <legend className="ins-field-l">
                  Coaching specialty <span className="ins-sf-opt">Pick up to {SPECIALTIES_MAX}</span>
                </legend>
                <div className="ins-sf-chips">
                  {[...SPECIALTIES, ...customs].map((s) => {
                    const on = draft.specialties.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        className={`ins-sf-chip ${on ? 'on' : ''}`}
                        aria-pressed={on}
                        disabled={!on && full}
                        onClick={() => toggleSpecialty(s)}
                      >
                        {on && <Icon name="check" className="ins-i sm" />}
                        {s}
                      </button>
                    );
                  })}
                </div>
                <div className="ins-sf-custom">
                  <span className="ins-input">
                    <Icon name="plus" />
                    <input
                      aria-label="Add your own specialty"
                      placeholder={full ? `You’ve picked ${SPECIALTIES_MAX}` : 'Add your own, e.g. Kettlebell sport'}
                      value={customSpecialty}
                      maxLength={SPECIALTY_MAX_LEN}
                      disabled={full}
                      onChange={(e) => setCustomSpecialty(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addCustom();
                        }
                      }}
                    />
                    <button type="button" className="ins-btn quiet ins-sf-custom-add" onClick={addCustom} disabled={full || !customSpecialty.trim()}>
                      Add
                    </button>
                  </span>
                </div>
                {errors.specialties ? (
                  <FieldError id="specialties-err" message={errors.specialties} />
                ) : (
                  <span className="ins-field-hint" id="spec-hint">
                    Shown under your name, so clients know straight away if you’re for them.
                  </span>
                )}
              </fieldset>

              <fieldset className="ins-field ins-sf-fieldset">
                <legend className="ins-field-l">How you coach</legend>
                <div className="ins-sf-seg" role="radiogroup" aria-label="How you coach">
                  {(Object.keys(COACHING_MODES) as CoachingMode[]).map((m) => (
                    <label key={m} className={`ins-sf-seg-it ${draft.coachingMode === m ? 'on' : ''}`}>
                      <input
                        type="radio"
                        name="coachingMode"
                        value={m}
                        checked={draft.coachingMode === m}
                        onChange={() => set('coachingMode', m)}
                      />
                      {COACHING_MODES[m]}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="ins-sf-two">
                <TextField
                  name="location"
                  label={draft.coachingMode === 'online' ? 'Where you’re based (optional)' : 'Where you coach'}
                  icon="network"
                  autoComplete="address-level2"
                  placeholder="Austin, TX"
                  maxLength={LOCATION_MAX + 20}
                  value={draft.location ?? ''}
                  onChange={(e) => set('location', e.target.value)}
                  error={errors.location}
                />
                <label className="ins-field">
                  <span className="ins-field-l">Time zone</span>
                  <span className={`ins-input ins-select ${errors.timeZone ? 'bad' : ''}`}>
                    <Icon name="today" />
                    <select
                      name="timeZone"
                      value={draft.timeZone}
                      onChange={(e) => set('timeZone', e.target.value)}
                      aria-describedby="tz-hint"
                    >
                      {zoneOptions.map((z) => (
                        <option key={z} value={z}>
                          {timeZoneLabel(z)}
                        </option>
                      ))}
                    </select>
                  </span>
                  {errors.timeZone ? (
                    <FieldError id="timeZone-err" message={errors.timeZone} />
                  ) : (
                    <span className="ins-field-hint" id="tz-hint">
                      Set from this device. Sessions and check-ins use it.
                    </span>
                  )}
                </label>
              </div>
            </div>

            <div className="ins-sf-foot">
              <button type="submit" className="ins-btn go" disabled={saving}>
                {storefront.completed ? 'Save changes' : 'Create storefront'}
                <Icon name="arrow" />
              </button>
              {storefront.completed && (
                <button type="button" className="ins-btn quiet" onClick={() => {
                    setDraft(storefront);
                    setErrors({});
                    setEditing(false);
                  }}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        ) : (
          <section className="ins-panel ins-sf-done ins-in d2" aria-live="polite">
            <span className="ins-sf-tick" aria-hidden="true">
              <Icon name="check" />
            </span>
            <span className="ins-label">Storefront created</span>
            <h2>
              <span className="ins-num">{storefront.handle}.instar.co</span> is yours.
            </h2>
            <p>
              {storefrontStatus?.published
                ? 'It’s live. Clients can open your link, pick an offer and pay you.'
                : !hasOffer
                  ? 'It isn’t public yet. Add an offer and connect payouts, then publish it and put the link in your Instagram bio.'
                  : !payoutsReady
                    ? 'It isn’t public yet. Connect payouts, then publish it and put the link in your Instagram bio.'
                    : 'You’re ready to publish.'}
            </p>
            <ol className="ins-sf-steps">
              <li className="done">
                <Icon name="check" className="ins-i sm" />
                Create your storefront
              </li>
              {hasOffer ? (
                <li className="done">
                  <Icon name="check" className="ins-i sm" />
                  Add your first offer
                </li>
              ) : (
                <li>
                  <span className="ins-sf-step-n">2</span>
                  Add your first offer
                </li>
              )}
              {payoutsReady ? (
                <li className="done">
                  <Icon name="check" className="ins-i sm" />
                  Connect payouts
                </li>
              ) : (
                <li>
                  <span className="ins-sf-step-n">3</span>
                  <Link href={PAYOUTS_PATH}>Connect payouts to publish</Link>
                </li>
              )}
              {storefrontStatus?.published ? (
                <li className="done">
                  <Icon name="check" className="ins-i sm" />
                  Publish
                </li>
              ) : (
                <li>
                  <span className="ins-sf-step-n">4</span>
                  Publish
                </li>
              )}
            </ol>
            <div className="ins-actions">
              {storefrontStatus?.published ? (
                <button type="button" className="ins-btn" onClick={() => onPublishToggle(false)} disabled={publishing}>
                  Unpublish
                </button>
              ) : (
                <button
                  type="button"
                  className="ins-btn go"
                  onClick={() => onPublishToggle(true)}
                  disabled={publishing || !storefrontStatus?.canPublish}
                >
                  Publish
                  <Icon name="arrow" />
                </button>
              )}
              <Link href={hasOffer ? OFFERS_PATH : `${OFFERS_PATH}/new`} className="ins-btn">
                {hasOffer ? 'Manage offers' : 'Add your first offer'}
              </Link>
              <button type="button" className="ins-btn" onClick={() => setEditing(true)}>
                Edit details
              </button>
              <button
                type="button"
                className="ins-btn quiet"
                onClick={() => {
                  navigator.clipboard?.writeText(`${storefront.handle}.instar.co`).catch(() => {});
                  toast(`Copied ${storefront.handle}.instar.co`);
                }}
              >
                Copy link
              </button>
            </div>
          </section>
        )}

        <aside className="ins-sf-preview ins-in d3" aria-label="Preview of your storefront">
          <span className="ins-label">Preview · what clients see</span>
          <div className="ins-sf-phone">
            <div className="ins-sf-url">
              <Icon name="lock" className="ins-i sm" />
              <span className="ins-num">{shown.handle || 'yourname'}.instar.co</span>
            </div>
            <div className="ins-sf-page">
              <span className="ins-sf-avatar" aria-hidden="true">
                {shown.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shown.avatarUrl} alt="" />
                ) : (
                  initials(shown.displayName) || <Icon name="user" />
                )}
              </span>
              <b className={`ins-sf-name ${shown.displayName ? '' : 'ph'}`}>{shown.displayName || 'Your name'}</b>
              {shown.specialties.length > 0 && (
                <div className="ins-sf-tags">
                  {shown.specialties.map((s) => (
                    <span key={s}>{s}</span>
                  ))}
                </div>
              )}
              <span className="ins-sf-where">
                <Icon name="network" className="ins-i sm" />
                {locationLine(shown)}
              </span>
              <p className={`ins-sf-bio ${shown.bio ? '' : 'ph'}`}>{shown.bio || 'A line about who you coach and how.'}</p>
              <span className="ins-label ins-sf-offers-l">Offers</span>
              {shownOffers.length > 0 ? (
                <div className="ins-sf-offers">
                  {shownOffers.map((o) => (
                    <OfferCard key={o.id} offer={o} compact />
                  ))}
                </div>
              ) : (
                <div className="ins-sf-empty">
                  <Icon name="offers" />
                  <span>Your offers will show here once you add them.</span>
                </div>
              )}
            </div>
          </div>
          {shownOffers.length > 0 && (
            <p className="ins-sf-preview-note">
              Preview only. On your live storefront, each offer’s button opens checkout, where clients see the service fee and
              pay by card, Apple Pay or Google Pay.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
