'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import type { OfferType } from '@/lib/commerce/types';
import { Icon } from '@/lib/icons';
import { useAppState } from '@/lib/store';
import { FieldError, TextField } from '@/components/AuthFields';
import { OfferCard } from '@/components/OfferCard';
import {
  blankOffer,
  centsToInput,
  changeOfferType,
  DESCRIPTION_MAX,
  finalizeOffer,
  INCLUDES_MAX,
  INTERVALS,
  OFFER_TYPES,
  OFFERS_PATH,
  parsePriceToCents,
  SESSION_LENGTHS,
  validateOffer,
  type OfferDraft,
  type OfferErrors,
  type OfferField,
} from '@/lib/offers';

const TYPE_ORDER: OfferType[] = ['subscription', 'one_time', 'session'];
const TYPE_ICON = { subscription: 'today', one_time: 'programs', session: 'checkins' } as const;
const INTERVAL_LABEL = { week: 'Every week', month: 'Every month', year: 'Every year' } as const;

function newId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `offer-${Date.now().toString(36)}`;
}

type Props = { mode: 'new'; initialType: OfferType } | { mode: 'edit'; id: string };

export function OfferEditor(props: Props) {
  const router = useRouter();
  const { offers, saveOffer, deleteOffer, hydrated, toast } = useAppState();
  const existing = props.mode === 'edit' ? offers.find((o) => o.id === props.id) : undefined;

  const [draft, setDraft] = useState<OfferDraft>(() => blankOffer(props.mode === 'new' ? props.initialType : 'subscription', newId()));
  const [priceInput, setPriceInput] = useState('');
  const [errors, setErrors] = useState<OfferErrors>({});
  const [loaded, setLoaded] = useState(props.mode === 'new');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Editing: load the saved offer once the store has hydrated from localStorage.
  useEffect(() => {
    if (props.mode !== 'edit' || loaded || !existing) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(existing);
    setPriceInput(centsToInput(existing.price.unitAmountCents));
    setLoaded(true);
  }, [props.mode, loaded, existing]);

  const clear = (f: OfferField) => setErrors((x) => (x[f] ? { ...x, [f]: undefined } : x));
  const update = (patch: Partial<OfferDraft>, field?: OfferField) => {
    setDraft((d) => ({ ...d, ...patch }));
    if (field) clear(field);
  };

  if (props.mode === 'edit' && hydrated && !existing) {
    return (
      <section className="ins-panel ins-offers-missing ins-in">
        <h2>This offer doesn’t exist anymore</h2>
        <p>It may have been deleted.</p>
        <Link href={OFFERS_PATH} className="ins-btn go">
          Back to offers
        </Link>
      </section>
    );
  }
  if (!loaded) return null;

  function onPrice(v: string) {
    setPriceInput(v);
    clear('price');
    const cents = parsePriceToCents(v);
    setDraft((d) => ({ ...d, price: { ...d.price, unitAmountCents: cents ?? 0 } }));
  }

  function setInclude(i: number, v: string) {
    update({ includes: draft.includes.map((x, j) => (j === i ? v : x)) }, 'includes');
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next = validateOffer(draft, priceInput);
    setErrors(next);
    if (Object.keys(next).length > 0) {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    saveOffer(finalizeOffer(draft, priceInput));
    toast(props.mode === 'new' ? `Added ${draft.name.trim()}` : 'Offer saved');
    router.push(OFFERS_PATH);
  }

  function onDelete() {
    deleteOffer(draft.id);
    toast(`Deleted ${draft.name || 'offer'}`);
    router.push(OFFERS_PATH);
  }

  const descLen = (draft.description ?? '').length;

  return (
    <>
      <section className="ins-space-hero ins-sf-hero">
        <div>
          <Link href={OFFERS_PATH} className="ins-label ins-offers-back ins-in">
            ← Offers
          </Link>
          <h1 className="ins-in d1">{props.mode === 'new' ? 'New offer' : 'Edit offer'}</h1>
          <p className="ins-in d2">Set what you sell and what it costs. Clients see it on your storefront exactly as previewed.</p>
        </div>
      </section>

      <div className="ins-sf-grid">
        <form className="ins-panel ins-sf-form ins-in d2" onSubmit={onSubmit} noValidate aria-label="Offer details">
          <fieldset className="ins-offer-section">
            <legend className="ins-offer-legend">What kind of offer?</legend>
            <div className="ins-offer-types" role="radiogroup" aria-label="Offer type">
              {TYPE_ORDER.map((t) => (
                <label key={t} className={`ins-offer-type ${draft.type === t ? 'on' : ''}`}>
                  <input
                    type="radio"
                    name="type"
                    value={t}
                    checked={draft.type === t}
                    onChange={() => setDraft((d) => changeOfferType(d, t))}
                  />
                  <Icon name={TYPE_ICON[t]} />
                  <b>{OFFER_TYPES[t].label}</b>
                  <span>{OFFER_TYPES[t].blurb}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="ins-offer-section">
            <legend className="ins-offer-legend">Details</legend>
            <TextField
              name="name"
              label="Offer name"
              icon="offers"
              placeholder={OFFER_TYPES[draft.type].example.split(',')[0]}
              value={draft.name}
              onChange={(e) => update({ name: e.target.value }, 'name')}
              error={errors.name}
              required
            />
            <label className="ins-field">
              <span className="ins-field-l">
                Description <span className="ins-sf-opt">Optional</span>
              </span>
              <span className={`ins-textarea ${errors.description || descLen > DESCRIPTION_MAX ? 'bad' : ''}`}>
                <textarea
                  name="description"
                  rows={3}
                  placeholder="Who it’s for and what changes for them."
                  value={draft.description ?? ''}
                  onChange={(e) => update({ description: e.target.value }, 'description')}
                  aria-invalid={!!errors.description}
                  aria-describedby="description-count"
                />
              </span>
              <span className={`ins-field-hint ins-sf-count ${descLen > DESCRIPTION_MAX ? 'over' : ''}`} id="description-count">
                <span className="ins-num">
                  {descLen}/{DESCRIPTION_MAX}
                </span>
              </span>
              <FieldError id="description-err" message={errors.description} />
            </label>
          </fieldset>

          <fieldset className="ins-offer-section">
            <legend className="ins-offer-legend">Price</legend>
            <div className="ins-offer-price-row">
              <label className="ins-field">
                <span className="ins-field-l">{draft.type === 'subscription' ? 'Price per payment' : 'Price'}</span>
                <span className={`ins-input ${errors.price ? 'bad' : ''}`}>
                  <span className="ins-offer-cur" aria-hidden="true">
                    $
                  </span>
                  <input
                    name="price"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="199"
                    value={priceInput}
                    onChange={(e) => onPrice(e.target.value)}
                    aria-invalid={!!errors.price}
                    aria-describedby={errors.price ? 'price-err' : 'price-hint'}
                    required
                  />
                  <span className="ins-offer-cur-code">USD</span>
                </span>
                {errors.price ? (
                  <FieldError id="price-err" message={errors.price} />
                ) : (
                  <span className="ins-field-hint" id="price-hint">
                    What you charge. Whole dollars or cents, like 199 or 199.50.
                  </span>
                )}
              </label>

              {draft.type === 'subscription' && (
                <label className="ins-field">
                  <span className="ins-field-l">Billed</span>
                  <span className="ins-input ins-select">
                    <select
                      name="interval"
                      value={draft.price.interval ?? 'month'}
                      onChange={(e) =>
                        update({ price: { ...draft.price, interval: e.target.value as OfferDraft['price']['interval'], intervalCount: 1 } })
                      }
                    >
                      {INTERVALS.map((i) => (
                        <option key={i} value={i}>
                          {INTERVAL_LABEL[i]}
                        </option>
                      ))}
                    </select>
                  </span>
                </label>
              )}

              {draft.type === 'session' && (
                <label className="ins-field">
                  <span className="ins-field-l">Length</span>
                  <span className="ins-input ins-select">
                    <select
                      name="sessionMinutes"
                      value={draft.sessionMinutes ?? 60}
                      onChange={(e) => update({ sessionMinutes: Number(e.target.value) })}
                    >
                      {SESSION_LENGTHS.map((m) => (
                        <option key={m} value={m}>
                          {m} minutes
                        </option>
                      ))}
                    </select>
                  </span>
                </label>
              )}

              {draft.type === 'one_time' && (
                <TextField
                  name="lengthWeeks"
                  label="Length in weeks (optional)"
                  icon="today"
                  inputMode="numeric"
                  placeholder="12"
                  value={draft.lengthWeeks ?? ''}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '');
                    update({ lengthWeeks: v ? Number(v) : null }, 'lengthWeeks');
                  }}
                  error={errors.lengthWeeks}
                />
              )}
            </div>

            <div className="ins-offer-fee" role="note">
              <Icon name="payouts" />
              <p>
                Clients see your price plus a separate <b>service fee</b> at checkout. Instar keeps <b>2%</b> of your price.
                Your exact payout per sale will show here once payouts are connected.
              </p>
            </div>
          </fieldset>

          <fieldset className="ins-offer-section">
            <legend className="ins-offer-legend">
              What’s included <span className="ins-sf-opt">Optional</span>
            </legend>
            <ul className="ins-offer-inc-edit">
              {draft.includes.map((item, i) => (
                <li key={i}>
                  <span className="ins-input">
                    <Icon name="check" />
                    <input
                      aria-label={`Included item ${i + 1}`}
                      placeholder={['Custom training plan', 'Weekly check-in', 'Messaging with your coach'][i] ?? 'Something they get'}
                      value={item}
                      onChange={(e) => setInclude(i, e.target.value)}
                    />
                    <button
                      type="button"
                      className="ins-input-btn"
                      aria-label={`Remove item ${i + 1}`}
                      onClick={() => update({ includes: draft.includes.filter((_, j) => j !== i) }, 'includes')}
                    >
                      <Icon name="trash" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            {draft.includes.length < INCLUDES_MAX && (
              <button type="button" className="ins-btn quiet ins-offer-add" onClick={() => update({ includes: [...draft.includes, ''] })}>
                <Icon name="plus" />
                Add a line
              </button>
            )}
            <FieldError id="includes-err" message={errors.includes} />
          </fieldset>

          <fieldset className="ins-offer-section">
            <legend className="ins-offer-legend">Visibility</legend>
            <label className="ins-check">
              <input type="checkbox" checked={draft.visible} onChange={(e) => update({ visible: e.target.checked })} />
              <span>
                Show on my storefront. Untick to keep it saved but hidden from clients.
              </span>
            </label>
          </fieldset>

          <div className="ins-sf-foot">
            <button type="submit" className="ins-btn go">
              {props.mode === 'new' ? 'Add offer' : 'Save changes'}
              <Icon name="arrow" />
            </button>
            <Link href={OFFERS_PATH} className="ins-btn quiet">
              Cancel
            </Link>
            {props.mode === 'edit' &&
              (confirmDelete ? (
                <span className="ins-offer-confirm" role="group" aria-label="Confirm delete">
                  <span>Delete this offer?</span>
                  <button type="button" className="ins-btn ins-btn-bad" onClick={onDelete}>
                    Delete
                  </button>
                  <button type="button" className="ins-btn quiet" onClick={() => setConfirmDelete(false)}>
                    Keep
                  </button>
                </span>
              ) : (
                <button type="button" className="ins-btn quiet ins-offer-del" onClick={() => setConfirmDelete(true)}>
                  <Icon name="trash" />
                  Delete
                </button>
              ))}
          </div>
        </form>

        <aside className="ins-sf-preview ins-in d3" aria-label="Preview of this offer">
          <span className="ins-label">Preview · on your storefront</span>
          <div className="ins-sf-phone">
            <div className="ins-sf-page ins-offer-preview">
              <OfferCard offer={draft} />
              {!draft.visible && <span className="ins-offer-hidden">Hidden from clients</span>}
            </div>
          </div>
          <p className="ins-sf-preview-note">
            Preview only. On your live storefront, this button opens checkout: clients see your price and the service fee,
            then pay by card, Apple Pay or Google Pay.
          </p>
        </aside>
      </div>
    </>
  );
}
