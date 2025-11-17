// Minimal Supabase-like adapter backed by Firestore (Firebase Admin)
// Supports: from().select().eq().gte().lt().lte().gt().in().is().not().ilike().order().limit().single().or()
// and basic insert/update/delete. Joins: proprietarios(...), bicicletas(...)

const { db } = require('./firebaseAdmin');

function createClient(_url, _key, _opts) {
  function from(table) {
    return new QueryBuilder(table);
  }
  return { from };
}

class QueryBuilder {
  constructor(table) {
    this._table = table;
    this._action = 'select';
    this._select = '*';
    this._count = null; // 'exact' | null
    this._head = false;
    this._filters = []; // {op, field, value}
    this._or = null; // parsed OR groups
    this._order = null; // { field, ascending }
    this._limit = null;
    this._single = false;
    this._insertRows = null;
    this._updatePatch = null;
    this._returning = false; // whether to return rows for write ops when .select() is chained
  }

  select(sel = '*', options) {
    // If chained after insert/update/delete, mark returning and keep action
    if (this._action === 'insert' || this._action === 'update' || this._action === 'delete') {
      this._returning = true;
    } else {
      this._action = 'select';
    }
    this._select = sel || '*';
    if (options && typeof options === 'object') {
      this._count = options.count || null;
      this._head = !!options.head;
    }
    return this;
  }

  insert(rows) {
    this._action = 'insert';
    this._insertRows = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  update(patch) {
    this._action = 'update';
    this._updatePatch = patch || {};
    return this;
  }

  delete() {
    this._action = 'delete';
    return this;
  }

  eq(field, value) { this._filters.push({ op: 'eq', field, value }); return this; }
  gte(field, value) { this._filters.push({ op: 'gte', field, value }); return this; }
  gt(field, value) { this._filters.push({ op: 'gt', field, value }); return this; }
  lt(field, value) { this._filters.push({ op: 'lt', field, value }); return this; }
  lte(field, value) { this._filters.push({ op: 'lte', field, value }); return this; }
  in(field, arr) { this._filters.push({ op: 'in', field, value: Array.isArray(arr) ? arr : [arr] }); return this; }
  is(field, value) { this._filters.push({ op: 'is', field, value }); return this; }
  not(field, oper, value) { this._filters.push({ op: `not:${oper}`, field, value }); return this; }

  ilike(field, pattern) {
    this._filters.push({ op: 'ilike', field, value: String(pattern || '') });
    return this;
  }

  order(field, opts) {
    this._order = { field, ascending: opts?.ascending !== false };
    return this;
  }

  limit(n) { this._limit = Number(n) || null; return this; }
  single() { this._single = true; return this; }

  or(expr) {
    // Supports forms like:
    // - "nome.ilike.%term%,cpf.ilike.%term%"
    // - "and(a.gte.A,a.lt.B),and(b.gte.A,b.lt.B)"
    this._or = parseOrExpression(expr);
    return this;
  }

  then(resolve, reject) { return this._execute().then(resolve, reject); }

  async _execute() {
    try {
      if (this._action === 'insert') return await this._execInsert();
      if (this._action === 'update') return await this._execUpdate();
      if (this._action === 'delete') return await this._execDelete();
      return await this._execSelect();
    } catch (err) {
      return { data: null, error: toCompatError(err) };
    }
  }

  async _execInsert() {
    try {
      const col = db.collection(this._table);
      const out = [];
      for (const row of this._insertRows) {
        const nowId = Date.now() + Math.floor(Math.random() * 1000);
        const newRow = { ...row };
        if (newRow.id == null) newRow.id = nowId;
        await col.add(newRow);
        out.push(newRow);
      }
      let data = this._returning ? out : null;
      if (this._returning && this._single) data = out[0] || null;
      return { data, error: null };
    } catch (e) {
      return { data: null, error: toCompatError(e) };
    }
  }

  async _execUpdate() {
    try {
      const col = db.collection(this._table);
      const idEq = this._filters.find(f => f.op === 'eq' && f.field === 'id');
      if (!idEq) return { data: null, error: toCompatError(new Error('PGRST116: missing id eq filter')) };
      const snap = await col.where('id', '==', idEq.value).get();
      const results = [];
      for (const doc of snap.docs) {
        await doc.ref.set({ ...doc.data(), ...this._updatePatch }, { merge: true });
        results.push({ ...doc.data(), ...this._updatePatch });
      }
      let data = this._returning ? results : null;
      if (this._returning && this._single) data = results[0] || null;
      return { data, error: null };
    } catch (e) {
      return { data: null, error: toCompatError(e) };
    }
  }

  async _execDelete() {
    try {
      const col = db.collection(this._table);
      const idEq = this._filters.find(f => f.op === 'eq' && f.field === 'id');
      if (!idEq) return { data: null, error: toCompatError(new Error('PGRST116: missing id eq filter')) };
      const snap = await col.where('id', '==', idEq.value).get();
      let deleted = null;
      for (const doc of snap.docs) {
        deleted = doc.data();
        await doc.ref.delete();
      }
      const data = this._returning ? (this._single ? deleted : (deleted ? [deleted] : [])) : null;
      return { data, error: null };
    } catch (e) {
      return { data: null, error: toCompatError(e) };
    }
  }

  async _execSelect() {
    const baseSel = this._select;
    const parsedSel = parseSelect(baseSel);

    let rows = await runQueryWithBestEffort(this._table, this._filters, this._or);

    // Apply in-memory filters not pushed to Firestore
    rows = rows.filter(r => matchAllFilters(r, this._filters) && matchOrGroups(r, this._or));

    // Sort
    if (this._order?.field) {
      const f = this._order.field;
      const asc = this._order.ascending !== false;
      rows.sort((a, b) => compareValues(a[f], b[f], asc));
    }

    // Joins (basic)
    rows = await enrichJoins(rows, parsedSel);

    // Projection (fields)
    rows = projectRows(rows, parsedSel);

    // Count/head
    if (this._head && this._count === 'exact') {
      return { data: null, count: rows.length, error: null };
    }

    // Limit
    if (typeof this._limit === 'number') rows = rows.slice(0, this._limit);

    if (this._single) {
      const one = rows[0] || null;
      if (!one) return { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } };
      return { data: one, error: null };
    }

    return { data: rows, error: null };
  }
}

function toCompatError(e) {
  return { message: e?.message || String(e) };
}

function isIsoLike(v) {
  return typeof v === 'string' && /\d{4}-\d{2}-\d{2}T/.test(v);
}

function asComp(a) {
  if (a == null) return a;
  if (isIsoLike(a)) return new Date(a).getTime();
  return a;
}

function compareValues(a, b, asc) {
  const av = asComp(a);
  const bv = asComp(b);
  if (av == null && bv == null) return 0;
  if (av == null) return asc ? 1 : -1;
  if (bv == null) return asc ? -1 : 1;
  if (av < bv) return asc ? -1 : 1;
  if (av > bv) return asc ? 1 : -1;
  return 0;
}

async function runQueryWithBestEffort(table, filters, orGroups) {
  // Try to push simple filters to Firestore; fallback to full scan
  const col = db.collection(table);
  try {
    let q = col;
    const simple = filters.filter(f => ['eq', 'gte', 'gt', 'lt', 'lte', 'in', 'is', 'not:is'].includes(f.op));
    for (const f of simple) {
      if (f.op === 'eq') q = q.where(f.field, '==', f.value);
      else if (f.op === 'gte') q = q.where(f.field, '>=', f.value);
      else if (f.op === 'gt') q = q.where(f.field, '>', f.value);
      else if (f.op === 'lt') q = q.where(f.field, '<', f.value);
      else if (f.op === 'lte') q = q.where(f.field, '<=', f.value);
      else if (f.op === 'in') q = q.where(f.field, 'in', Array.isArray(f.value) && f.value.length ? f.value : ['__none__']);
      else if (f.op === 'is') {
        if (f.value === null) q = q.where(f.field, '==', null);
      } else if (f.op === 'not:is') {
        if (f.value === null) q = q.where(f.field, '!=', null);
      }
    }
    const snap = await q.get();
    return snap.docs.map(d => d.data());
  } catch (_) {
    const snap = await col.get();
    return snap.docs.map(d => d.data());
  }
}

function matchAllFilters(row, filters) {
  for (const f of filters) {
    const v = getPath(row, f.field);
    switch (f.op) {
      case 'eq': if (!isEqual(v, f.value)) return false; break;
      case 'gte': if (!(asComp(v) >= asComp(f.value))) return false; break;
      case 'gt': if (!(asComp(v) > asComp(f.value))) return false; break;
      case 'lt': if (!(asComp(v) < asComp(f.value))) return false; break;
      case 'lte': if (!(asComp(v) <= asComp(f.value))) return false; break;
      case 'in': if (!Array.isArray(f.value) || !f.value.some(x => isEqual(x, v))) return false; break;
      case 'is': if (!(f.value === null ? v == null : isEqual(v, f.value))) return false; break;
      case 'not:is': if (!(f.value === null ? v != null : !isEqual(v, f.value))) return false; break;
      case 'ilike': if (!ilikeMatch(String(v || ''), f.value)) return false; break;
      default: break;
    }
  }
  return true;
}

function ilikeMatch(text, pattern) {
  const t = String(text).toLowerCase();
  const p = String(pattern || '').toLowerCase();
  // Convert ILIKE pattern (with %) to regex
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, r => `\\${r}`);
  const reSrc = '^' + p.split('%').map(esc).join('.*') + '$';
  const re = new RegExp(reSrc, 'i');
  return re.test(t);
}

function matchOrGroups(row, orGroups) {
  if (!orGroups) return true;
  // orGroups = [ [cond, cond], [cond] ... ], cond = { field, op, value }
  for (const group of orGroups) {
    let ok = true;
    for (const c of group) {
      const v = getPath(row, c.field);
      if (!evalCond(v, c.op, c.value)) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

function evalCond(v, op, value) {
  switch (op) {
    case 'eq': return isEqual(v, value);
    case 'gte': return asComp(v) >= asComp(value);
    case 'gt': return asComp(v) > asComp(value);
    case 'lt': return asComp(v) < asComp(value);
    case 'lte': return asComp(v) <= asComp(value);
    case 'is': return value === null ? v == null : isEqual(v, value);
    case 'ilike': return ilikeMatch(String(v || ''), String(value || ''));
    default: return false;
  }
}

function isEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a == b;
  if (typeof a === 'number' && typeof b === 'string' && String(a) === b) return true;
  if (typeof b === 'number' && typeof a === 'string' && String(b) === a) return true;
  return false;
}

function getPath(obj, path) {
  if (!obj) return undefined;
  if (!path || typeof path !== 'string') return undefined;
  if (path.includes('(')) return undefined; // not a simple field
  return path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
}

function parseOrExpression(expr) {
  if (!expr) return null;
  const s = String(expr);
  // Split by top-level commas respecting parentheses in and(...)
  const parts = [];
  let buf = '';
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') { depth++; buf += ch; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); buf += ch; continue; }
    if (ch === ',' && depth === 0) { parts.push(buf.trim()); buf = ''; continue; }
    buf += ch;
  }
  if (buf) parts.push(buf.trim());

  const groups = [];
  for (const p of parts) {
    if (p.startsWith('and(') && p.endsWith(')')) {
      const inner = p.slice(4, -1);
      const andConds = inner.split(',').map(x => x.trim()).filter(Boolean).map(parseSimpleCond);
      groups.push(andConds);
    } else {
      groups.push([parseSimpleCond(p)]);
    }
  }
  return groups;
}

function parseSimpleCond(token) {
  // Supported shapes: field.op.value ; field.is.null ; field.ilike.%term% ; field.gte.2024-01-01T...
  const t = token.trim();
  const firstDot = t.indexOf('.');
  if (firstDot === -1) return { field: t, op: 'eq', value: true };
  const field = t.slice(0, firstDot);
  const rest = t.slice(firstDot + 1);
  const secondDot = rest.indexOf('.');
  if (secondDot === -1) return { field, op: rest, value: true };
  const op = rest.slice(0, secondDot);
  const raw = rest.slice(secondDot + 1);
  const value = parseTokenValue(raw);
  return { field, op, value };
}

function parseTokenValue(v) {
  if (v === 'null') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  // number?
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

function parseSelect(sel) {
  // Very small parser: returns { fields: [...], joins: { proprietarios: ['x','y'], bicicletas: ['x'] } }
  const out = { fields: [], joins: {} };
  if (!sel || sel === '*') return out;
  let s = String(sel);
  let i = 0;
  let buf = '';
  while (i < s.length) {
    const ch = s[i];
    if (ch === ',') { pushToken(buf); buf = ''; i++; continue; }
    if (ch === '(') {
      // token so far is table name
      const table = buf.trim();
      const [inner, endIdx] = readUntilClosingParen(s, i);
      const list = inner.split(',').map(x => x.trim()).filter(Boolean);
      out.joins[table] = list;
      buf = '';
      i = endIdx + 1;
      if (i < s.length && s[i] === ',') i++;
      continue;
    }
    buf += ch; i++;
  }
  pushToken(buf);
  function pushToken(t) {
    const tt = t.trim();
    if (!tt) return;
    out.fields.push(tt);
  }
  return out;
}

function readUntilClosingParen(s, startIdx) {
  let depth = 0;
  let i = startIdx;
  let inner = '';
  while (i < s.length) {
    const ch = s[i];
    if (ch === '(') { depth++; if (depth > 1) inner += ch; i++; continue; }
    if (ch === ')') { depth--; if (depth === 0) break; inner += ch; i++; continue; }
    inner += ch; i++;
  }
  return [inner, i];
}

async function enrichJoins(rows, parsedSel) {
  const joins = parsedSel.joins || {};
  const out = rows.slice();
  const joinNames = Object.keys(joins);
  if (!joinNames.length) return out;

  // First pass: handle explicit names without alias (proprietarios/bicicletas default semantics)
  if (joins.proprietarios) {
    // Many base tables reference proprietario_id (e.g., controleacesso)
    const ids = Array.from(new Set(out.map(r => r.proprietario_id).filter(Boolean)));
    const pmap = await getByIdsAsMap('proprietarios', ids);
    for (const r of out) r.proprietarios = projectObject(pmap.get(r.proprietario_id) || null, joins.proprietarios);
  }
  if (joins.bicicletas) {
    // Case A: base has bicicleta_id -> embed single
    if (out.some(r => r.bicicleta_id != null)) {
      const ids = Array.from(new Set(out.map(r => r.bicicleta_id).filter(Boolean)));
      const bmap = await getByIdsAsMap('bicicletas', ids);
      for (const r of out) r.bicicletas = projectObject(bmap.get(r.bicicleta_id) || null, joins.bicicletas);
    } else {
      // Case B: base likely proprietarios -> embed list of bicicletas for each proprietario
      const ownerIds = Array.from(new Set(out.map(r => r.id).filter(Boolean)));
      const byOwner = await groupByField('bicicletas', 'proprietario_id', ownerIds);
      for (const r of out) {
        const arr = (byOwner.get(r.id) || []).map(b => projectObject(b, joins.bicicletas));
        r.bicicletas = arr;
      }
    }
  }

  // Second pass: alias joins like "alias:fieldRef (...)"
  for (const jn of joinNames) {
    if (!jn.includes(':')) continue;
    const [alias, fieldRefRaw] = jn.split(':');
    const fieldRef = (fieldRefRaw || '').trim();
    const spec = guessAliasJoinSpec(fieldRef, parsedSel, rows);
    if (!spec) continue;
    const ids = Array.from(new Set(out.map(r => r[fieldRef]).filter(Boolean)));
    const tmap = await getByIdsAsMap(spec.table, ids);
    for (const r of out) {
      const sub = tmap.get(r[fieldRef]) || null;
      r[alias] = projectObject(sub, joins[jn]);
    }
  }

  return out;
}

function guessAliasJoinSpec(fieldRef) {
  const f = String(fieldRef || '').toLowerCase();
  if (!f) return null;
  if (f.includes('proprietario')) return { table: 'proprietarios' };
  if (f.includes('bicicleta')) return { table: 'bicicletas' };
  if (f.includes('funcionario')) return { table: 'funcionarios' };
  return null;
}

function projectRows(rows, parsedSel) {
  if (!parsedSel.fields.length && !Object.keys(parsedSel.joins || {}).length) return rows;
  return rows.map(r => {
    const obj = {};
    for (const f of parsedSel.fields) {
      if (f === '*') return r; // bail out
      if (!f) continue;
      obj[f] = r[f];
    }
    for (const [jt, fl] of Object.entries(parsedSel.joins || {})) {
      obj[jt] = projectObject(r[jt], fl);
    }
    return obj;
  });
}

function projectObject(src, fields) {
  if (!src) return null;
  const o = {};
  for (const f of fields) o[f] = src[f];
  return o;
}

async function getByIdsAsMap(table, ids) {
  const map = new Map();
  if (!ids || !ids.length) return map;
  const col = db.collection(table);
  const BATCH = 10;
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    const snap = await col.where('id', 'in', chunk).get();
    for (const d of snap.docs) map.set(d.data().id, d.data());
  }
  return map;
}

async function groupByField(table, field, keys) {
  const map = new Map();
  if (!keys || !keys.length) return map;
  const col = db.collection(table);
  const BATCH = 10;
  for (let i = 0; i < keys.length; i += BATCH) {
    const chunk = keys.slice(i, i + BATCH);
    const snap = await col.where(field, 'in', chunk).get();
    for (const d of snap.docs) {
      const row = d.data();
      const k = row[field];
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(row);
    }
  }
  return map;
}

module.exports = { createClient };
