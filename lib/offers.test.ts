import {
  blankOffer,
  centsToInput,
  changeOfferType,
  finalizeOffer,
  formatMoney,
  formatOfferPrice,
  isOfferType,
  moveOffer,
  parsePriceToCents,
  upsertOffer,
  validateOffer,
  type OfferDraft,
} from './offers';

const coaching = (): OfferDraft => ({ ...blankOffer('subscription', 'a'), name: '1:1 coaching' });

describe('parsePriceToCents', () => {
  it.each([
    ['199', 19900],
    ['199.5', 19950],
    ['199.50', 19950],
    ['0.99', 99],
    ['$49', 4900],
    ['1,999.99', 199999],
    [' 25 ', 2500],
  ])('parses %p to %p cents', (input, cents) => {
    expect(parsePriceToCents(input)).toBe(cents);
  });

  it.each(['', 'abc', '19.999', '-5', '1e3', '12.', '.5', '1234567'])('rejects %p', (input) => {
    expect(parsePriceToCents(input)).toBeNull();
  });

  it('keeps cents exact where float math would drift', () => {
    // 0.1 + 0.2 style drift: 1.15 * 100 is 114.99999999999999 as a float.
    expect(parsePriceToCents('1.15')).toBe(115);
    expect(parsePriceToCents('4.35')).toBe(435);
  });
});

describe('centsToInput / formatMoney', () => {
  it('round-trips with parsePriceToCents', () => {
    for (const c of [100, 115, 19900, 19950, 199999]) expect(parsePriceToCents(centsToInput(c))).toBe(c);
  });

  it('writes an empty box for no price', () => {
    expect(centsToInput(null)).toBe('');
  });

  it('formats money in full, cents only when present', () => {
    expect(formatMoney(864000)).toBe('$8,640');
    expect(formatMoney(19950)).toBe('$199.50');
    expect(formatMoney(5)).toBe('$0.05');
  });
});

describe('formatOfferPrice', () => {
  it('adds the billing interval for subscriptions', () => {
    const o = coaching();
    o.price.unitAmountCents = 19900;
    expect(formatOfferPrice(o)).toBe('$199/mo');
    expect(formatOfferPrice({ ...o, price: { ...o.price, interval: 'week' } })).toBe('$199/wk');
    expect(formatOfferPrice({ ...o, price: { ...o.price, interval: 'year' } })).toBe('$199/yr');
  });

  it('adds length for sessions and programs', () => {
    const s = { ...blankOffer('session', 's'), sessionMinutes: 30 };
    s.price.unitAmountCents = 4900;
    expect(formatOfferPrice(s)).toBe('$49 · 30 min');
    const p = { ...blankOffer('one_time', 'p'), lengthWeeks: 12 };
    p.price.unitAmountCents = 49900;
    expect(formatOfferPrice(p)).toBe('$499 · 12 weeks');
    expect(formatOfferPrice({ ...p, lengthWeeks: 1 })).toBe('$499 · 1 week');
    expect(formatOfferPrice({ ...p, lengthWeeks: null })).toBe('$499');
  });
});

describe('blankOffer / changeOfferType', () => {
  it('gives subscriptions a monthly interval and other types none', () => {
    expect(blankOffer('subscription', 'x').price).toMatchObject({ interval: 'month', intervalCount: 1, currency: 'usd' });
    expect(blankOffer('one_time', 'x').price).toMatchObject({ interval: null, intervalCount: null });
    expect(blankOffer('session', 'x').sessionMinutes).toBe(60);
  });

  it('keeps shared fields and resets type-specific ones when switching type', () => {
    const o = { ...coaching(), description: 'Weekly check-ins', includes: ['Custom plan'] };
    o.price.unitAmountCents = 19900;
    const program = changeOfferType(o, 'one_time');
    expect(program).toMatchObject({ id: 'a', type: 'one_time', name: '1:1 coaching', description: 'Weekly check-ins', includes: ['Custom plan'] });
    expect(program.price).toMatchObject({ unitAmountCents: 19900, interval: null });
    expect(changeOfferType(program, 'session').sessionMinutes).toBe(60);
  });

  it('recognises offer types', () => {
    expect(isOfferType('session')).toBe(true);
    expect(isOfferType('bundle')).toBe(false);
    expect(isOfferType(undefined)).toBe(false);
  });
});

describe('validateOffer', () => {
  it('passes a complete offer', () => {
    expect(validateOffer(coaching(), '199')).toEqual({});
  });

  it('requires a name and a price', () => {
    const e = validateOffer({ ...coaching(), name: '  ' }, '');
    expect(e.name).toBeDefined();
    expect(e.price).toBe('Set a price.');
  });

  it('checks the price text the coach typed', () => {
    expect(validateOffer(coaching(), 'abc').price).toMatch(/like 199/);
    expect(validateOffer(coaching(), '0.50').price).toMatch(/lowest/);
    expect(validateOffer(coaching(), '100001').price).toMatch(/highest/);
    expect(validateOffer(coaching(), '100000')).toEqual({});
  });

  it('limits name and description length', () => {
    expect(validateOffer({ ...coaching(), name: 'a'.repeat(61) }, '1').name).toBeDefined();
    expect(validateOffer({ ...coaching(), description: 'a'.repeat(281) }, '1').description).toBeDefined();
  });

  it('checks program length only for programs', () => {
    const p = { ...blankOffer('one_time', 'p'), name: 'Block' };
    expect(validateOffer({ ...p, lengthWeeks: 0 }, '1').lengthWeeks).toBeDefined();
    expect(validateOffer({ ...p, lengthWeeks: 53 }, '1').lengthWeeks).toBeDefined();
    expect(validateOffer({ ...p, lengthWeeks: 12 }, '1')).toEqual({});
    expect(validateOffer({ ...p, lengthWeeks: null }, '1')).toEqual({});
  });

  it('limits what is included, ignoring blank lines', () => {
    const many = Array.from({ length: 9 }, (_, i) => `Item ${i}`);
    expect(validateOffer({ ...coaching(), includes: many }, '1').includes).toBeDefined();
    expect(validateOffer({ ...coaching(), includes: [...many.slice(0, 8), '  '] }, '1')).toEqual({});
    expect(validateOffer({ ...coaching(), includes: ['a'.repeat(81)] }, '1').includes).toBeDefined();
  });
});

describe('finalizeOffer', () => {
  it('trims text, drops empty lines and applies the typed price', () => {
    const o = { ...coaching(), name: '  1:1 coaching ', description: '  ', includes: [' Plan ', '', '  '] };
    expect(finalizeOffer(o, '199.50')).toMatchObject({
      name: '1:1 coaching',
      description: null,
      includes: ['Plan'],
      price: { unitAmountCents: 19950 },
    });
  });
});

describe('upsertOffer / moveOffer', () => {
  const a = { ...coaching(), id: 'a' };
  const b = { ...coaching(), id: 'b' };
  const c = { ...coaching(), id: 'c' };

  it('appends new offers and replaces existing ones in place', () => {
    expect(upsertOffer([a], b).map((o) => o.id)).toEqual(['a', 'b']);
    const renamed = { ...a, name: 'Renamed' };
    const list = upsertOffer([a, b], renamed);
    expect(list.map((o) => o.id)).toEqual(['a', 'b']);
    expect(list[0].name).toBe('Renamed');
  });

  it('moves offers up and down and ignores moves past either end', () => {
    const ids = (l: OfferDraft[]) => l.map((o) => o.id);
    expect(ids(moveOffer([a, b, c], 'b', -1))).toEqual(['b', 'a', 'c']);
    expect(ids(moveOffer([a, b, c], 'b', 1))).toEqual(['a', 'c', 'b']);
    const list = [a, b, c];
    expect(moveOffer(list, 'a', -1)).toBe(list);
    expect(moveOffer(list, 'c', 1)).toBe(list);
    expect(moveOffer(list, 'zzz', 1)).toBe(list);
  });
});
