import type { Ending, EndingId, Manifest, Rank } from '../types';

export function validateContent(ranks: Rank[], manifest: Manifest, endings?: Record<EndingId, Ending>): string[] {
  const errors: string[] = [];
  const assetIds = new Set(manifest.entries.map(e => e.id));
  const setFlags = new Set<string>();
  const seenIds = new Map<string, string>();

  const asset = (id: string, where: string) => {
    if (!assetIds.has(id)) errors.push(`${where}: asset "${id}" not in manifest`);
  };
  const unique = (id: string, where: string) => {
    const prev = seenIds.get(id);
    if (prev) errors.push(`${where}: duplicate id "${id}" (also in ${prev})`);
    else seenIds.set(id, where);
  };

  if (ranks.length === 0) errors.push('no ranks');
  ranks.forEach((rank, i) => {
    const last = i === ranks.length - 1;
    const where = `rank[${i}] ${rank.id}`;
    unique(rank.id, where);
    if (!rank.background) errors.push(`${where}: background is empty`);
    else asset(rank.background, where);
    if (last && rank.events.length !== 0) errors.push(`${where}: last rank must have 0 events`);
    if (!last && rank.events.length !== 2) errors.push(`${where}: expected 2 events, got ${rank.events.length}`);

    rank.events.forEach((ev, j) => {
      const ew = `${where} event[${j}] ${ev.id}`;
      unique(ev.id, ew);
      asset(ev.speaker.portrait, ew);
      if (ev.choices.length < 2 || ev.choices.length > 4) errors.push(`${ew}: choices must be 2..4`);
      if (ev.choices[0]?.requiresFlag) errors.push(`${ew}: first choice must not have requiresFlag`);
      // Check requiresFlag against flags set by *previous* events only — a flag set by a
      // choice in this same event is not yet in effect when the choice is being made.
      ev.choices.forEach((c, k) => {
        if (c.requiresFlag && !setFlags.has(c.requiresFlag)) {
          errors.push(`${ew} choice[${k}]: requiresFlag "${c.requiresFlag}" is never set before this event`);
        }
        if (c.reaction) asset(c.reaction.portrait, `${ew} choice[${k}] reaction`);
      });
      ev.choices.forEach(c => { if (c.setFlag) setFlags.add(c.setFlag); });
    });

    const b = rank.boss;
    const bw = `${where} boss ${b.id}`;
    unique(b.id, bw);
    if (b.weakness === b.immunity) errors.push(`${bw}: weakness equals immunity`);
    if (b.final !== last) errors.push(`${bw}: final=${b.final} but rank is ${last ? '' : 'not '}last`);
    for (const p of Object.values(b.sprites)) asset(p, bw);
    for (const p of Object.values(b.portraits)) asset(p, bw);
    for (const [k, arr] of Object.entries(b.lines)) if (arr.length === 0) errors.push(`${bw}: lines.${k} is empty`);
  });

  if (endings) {
    Object.entries(endings).forEach(([key, e]) => {
      const ew = `ending ${key}`;
      if (key !== e.id) errors.push(`${ew}: id is "${e.id}"`);
      asset(e.illustration, ew);
      if (e.epilogue) asset(e.epilogue.portrait, ew);
      e.variants?.forEach((v, i) => {
        const vw = `${ew} variant[${i}]`;
        if (v.epilogue) asset(v.epilogue.portrait, vw);
        if (!setFlags.has(v.requiresFlag)) {
          errors.push(`${vw}: requiresFlag "${v.requiresFlag}" is never set`);
        }
      });
    });
  }

  return errors;
}
