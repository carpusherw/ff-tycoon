import { COUNTRIES, HOME_PORTS, PORTS, REGIONS, route, transitDays, type PortId } from './world';

const PORT_IDS = Object.keys(PORTS) as PortId[];

describe('world', () => {
  it('every pair of ports is connected', () => {
    for (const a of PORT_IDS) {
      for (const b of PORT_IDS) {
        if (a === b) continue;
        const r = route(a, b);
        expect(Number.isFinite(r.distanceKm)).toBe(true);
        expect(r.distanceKm).toBeGreaterThan(0);
        expect(r.nodeIds[0]).toBe(a);
        expect(r.nodeIds[r.nodeIds.length - 1]).toBe(b);
      }
    }
  });

  it('routes are symmetric', () => {
    for (const a of PORT_IDS) {
      for (const b of PORT_IDS) {
        if (a === b) continue;
        expect(route(a, b).distanceKm).toBe(route(b, a).distanceKm);
      }
    }
  });

  it('trans-Pacific stays in the Pacific', () => {
    const ids = route('SHA', 'LAX').nodeIds;
    expect(ids).toContain('northPacificMid');
    expect(ids).not.toContain('malacca');
    expect(ids).not.toContain('suezNorth');
  });

  it('Asia to Europe goes through Malacca, Suez and Gibraltar', () => {
    const ids = route('SZX', 'RTM').nodeIds;
    expect(ids).toContain('malacca');
    expect(ids).toContain('suezNorth');
    expect(ids).toContain('gibraltar');
  });

  it('Korea to New York uses Panama', () => {
    const ids = route('PUS', 'NYC').nodeIds;
    expect(ids).toContain('panamaW');
    expect(ids).toContain('panamaE');
  });

  it('Europe to New York crosses the Atlantic', () => {
    const ids = route('RTM', 'NYC').nodeIds;
    expect(ids).toContain('atlanticMid');
    expect(ids).not.toContain('panamaE');
  });

  it('transit days are plausible', () => {
    const pacific = transitDays('SHA', 'LAX');
    expect(pacific).toBeGreaterThanOrEqual(10);
    expect(pacific).toBeLessThanOrEqual(18);
    const asiaEurope = transitDays('SZX', 'RTM');
    expect(asiaEurope).toBeGreaterThanOrEqual(22);
    expect(asiaEurope).toBeLessThanOrEqual(36);
  });

  it('Houston to Rotterdam leaves the Gulf through Florida', () => {
    const ids = route('HOU', 'RTM').nodeIds;
    expect(ids).toContain('floridaStraits');
    expect(ids).toContain('atlanticMid');
    expect(ids).not.toContain('panamaE');
  });

  it('Houston to Shanghai uses Panama', () => {
    const ids = route('HOU', 'SHA').nodeIds;
    expect(ids).toContain('yucatanChannel');
    expect(ids).toContain('panamaW');
  });

  it('Vancouver to Shanghai crosses the North Pacific', () => {
    const ids = route('VAN', 'SHA').nodeIds;
    expect(ids).toContain('northPacificMid');
    expect(ids).not.toContain('panamaW');
  });

  it('Manzanillo to Shanghai crosses the Pacific', () => {
    const ids = route('ZLO', 'SHA').nodeIds;
    expect(ids).toContain('northPacificMid');
    expect(ids).not.toContain('panamaE');
  });

  it('Santos to Rotterdam stays in the Atlantic', () => {
    const ids = route('SSZ', 'RTM').nodeIds;
    expect(ids).toContain('capeVerdeOff');
    expect(ids).not.toContain('panamaE');
  });

  it('Santos to New York goes up the Brazilian coast', () => {
    const ids = route('SSZ', 'NYC').nodeIds;
    expect(ids).toContain('amazonOff');
    expect(ids).not.toContain('capeVerdeOff');
  });

  it('Genoa reaches Asia through Suez', () => {
    const ids = route('GOA', 'SHA').nodeIds;
    expect(ids).toContain('suezNorth');
    expect(ids).toContain('malacca');
    expect(ids).not.toContain('gibraltar');
  });

  it('Durban to Shanghai goes round through the Indian Ocean', () => {
    const ids = route('DUR', 'SHA').nodeIds;
    expect(ids).toContain('sriLankaSouth');
    expect(ids).toContain('malacca');
    expect(ids).not.toContain('suezNorth');
    expect(ids).not.toContain('capeAgulhas');
  });

  it('Durban to Rotterdam goes round the Cape', () => {
    const ids = route('DUR', 'RTM').nodeIds;
    expect(ids).toContain('capeAgulhas');
    expect(ids).toContain('capeVerdeOff');
    expect(ids).not.toContain('suezNorth');
  });

  it('Felixstowe to New York crosses the Atlantic', () => {
    const ids = route('FXT', 'NYC').nodeIds;
    expect(ids).toContain('doverStrait');
    expect(ids).toContain('atlanticMid');
  });

  it('Santos to Shanghai goes round the Cape of Good Hope', () => {
    const ids = route('SSZ', 'SHA').nodeIds;
    expect(ids).toContain('capeAgulhas');
    expect(ids).not.toContain('panamaW');
  });

  it('every region has a country with a hiring pool and rent', () => {
    for (const { country } of Object.values(REGIONS)) {
      expect(COUNTRIES[country].pool.salaryMult).toBeGreaterThan(0);
      expect(COUNTRIES[country].rentMult).toBeGreaterThan(0);
    }
  });
});
