import { AGENT_NAMES, COMPANY_NAMES } from './names';

/** The coined word of a name: its first word ("Brinequoll" in "Brinequoll Shipping"). */
const coined = (name: string) => name.split(' ')[0].toLowerCase();

describe('AGENT_NAMES', () => {
  it('has at least 30 different names, enough for an agent in every region', () => {
    expect(AGENT_NAMES.length).toBeGreaterThanOrEqual(30);
    expect(new Set(AGENT_NAMES).size).toBe(AGENT_NAMES.length);
    expect(new Set(AGENT_NAMES.map(coined)).size).toBe(AGENT_NAMES.length);
  });

  it('shares no coined word with a customer company', () => {
    const companyWords = new Set(COMPANY_NAMES.flatMap((n) => n.toLowerCase().split(' ')));
    expect(AGENT_NAMES.filter((n) => companyWords.has(coined(n)))).toEqual([]);
  });
});
