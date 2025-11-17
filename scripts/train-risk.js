#!/usr/bin/env node
/**
 * Train Risk Model (Phase 2)
 * - Fetches historical entries from Supabase (controleacesso with exit)
 * - Builds simple features (cyclic time + top-K locals one-hot)
 * - Trains logistic regression with L2 using batch gradient descent
 * - Saves weights and feature schema to models/risk-weights.json
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('../services/supabaseCompat');

// ---- Config ----
// Using Firebase-backed compat client; Supabase env vars are not required here

const DAYS = parseInt(process.env.RISK_TRAIN_DAYS || '365', 10);
const LIMIT = parseInt(process.env.RISK_TRAIN_LIMIT || '5000', 10);
const TOPK_LOCALS = parseInt(process.env.RISK_TRAIN_TOPK_LOCALS || '10', 10);
const LR = parseFloat(process.env.RISK_TRAIN_LR || '0.05');
const L2 = parseFloat(process.env.RISK_TRAIN_L2 || '0.0005');
const MAX_ITERS = parseInt(process.env.RISK_TRAIN_MAX_ITERS || '800', 10);
const TOL = parseFloat(process.env.RISK_TRAIN_TOL || '1e-7');
const TZ_OFFSET_MINUTES = parseInt(process.env.RISK_TRAIN_TZ_OFFSET || '0', 10); // same definition as server: local = UTC - offset

const supabase = createClient('', '');

function sigmoid(z) { return 1 / (1 + Math.exp(-z)); }

function ensureDir(p){
  try { fs.mkdirSync(p, { recursive: true }); } catch(_){}
}

async function fetchDataset(){
  const sinceIso = new Date(Date.now() - DAYS*24*60*60*1000).toISOString();
  const { data, error } = await supabase
    .from('controleacesso')
    .select('id, local, data_hora_entrada, data_hora_saida')
    .gte('data_hora_entrada', sinceIso)
    .not('data_hora_saida', 'is', null)
    .order('data_hora_entrada', { ascending: false })
    .limit(LIMIT);
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  const items = rows.map(r => {
    const tIn = Date.parse(r.data_hora_entrada);
    const tOut = Date.parse(r.data_hora_saida);
    const durH = (Number.isFinite(tIn) && Number.isFinite(tOut)) ? (tOut - tIn)/3600000 : null;
    const localMs = Number.isFinite(tIn) ? (tIn - TZ_OFFSET_MINUTES*60000) : NaN;
    const d = Number.isFinite(localMs) ? new Date(localMs) : null;
    const day_of_week = d ? d.getUTCDay() : null; // 0..6
    const hour_of_day = d ? d.getUTCHours() : null; // 0..23
    return {
      id: r.id,
      local: r.local || null,
      entrada_iso: r.data_hora_entrada,
      saida_iso: r.data_hora_saida,
      duracao_horas: durH !== null ? durH : null,
      day_of_week,
      hour_of_day,
      estourou_72h: (durH !== null) ? (durH >= 72) : null
    };
  }).filter(x => x.duracao_horas !== null && x.day_of_week !== null && x.hour_of_day !== null && x.estourou_72h !== null);
  return items;
}

function buildLocalsVocab(items, k){
  const counts = new Map();
  for (const it of items){
    const loc = (it.local || '-').toString();
    counts.set(loc, (counts.get(loc)||0)+1);
  }
  const sorted = Array.from(counts.entries()).sort((a,b)=> b[1]-a[1]).slice(0, Math.max(1,k||10));
  const vocab = sorted.map(([loc]) => loc);
  return vocab; // "other" will be implicit as last bucket
}

function buildFeatureVector(it, localsVocab){
  // bias
  const feats = [1];
  // cyclic hour
  const hour = it.hour_of_day;
  const sinH = Math.sin(2*Math.PI*hour/24);
  const cosH = Math.cos(2*Math.PI*hour/24);
  feats.push(sinH, cosH);
  // cyclic day-of-week
  const dow = it.day_of_week;
  const sinD = Math.sin(2*Math.PI*dow/7);
  const cosD = Math.cos(2*Math.PI*dow/7);
  feats.push(sinD, cosD);
  // locals one-hot (topK + other)
  const K = localsVocab.length;
  const idx = localsVocab.indexOf((it.local || '-').toString());
  for (let i=0;i<K+1;i++) feats.push(0);
  const bucket = (idx === -1) ? K : idx; // last position = other
  feats[1+2+2 + 1 + bucket] = 1; // after bias(1), sinH(1), cosH(1), sinD(1), cosD(1) => base 5; but we'll do safer below
  // Safer: recompute base
  const base = 1 + 2 + 2; // bias + 2 + 2
  for (let i=0;i<K+1;i++) feats[base + i] = 0;
  feats[base + bucket] = 1;
  return feats;
}

function trainLogReg(X, y, lr, l2, maxIters, tol){
  const n = X.length;
  const d = X[0].length;
  let w = new Array(d).fill(0);
  let prevLoss = Infinity;
  for (let iter=0; iter<maxIters; iter++){
    // compute predictions and gradients
    const grad = new Array(d).fill(0);
    let loss = 0;
    for (let i=0;i<n;i++){
      const xi = X[i];
      let z = 0;
      for (let j=0;j<d;j++) z += w[j]*xi[j];
      const p = sigmoid(z);
      const err = (p - y[i]);
      loss += -(y[i]*Math.log(p + 1e-12) + (1-y[i])*Math.log(1-p + 1e-12));
      for (let j=0;j<d;j++) grad[j] += err * xi[j];
    }
    // average and add L2 (except bias)
    for (let j=0;j<d;j++){
      grad[j] = grad[j] / n + (j===0 ? 0 : l2 * w[j]);
    }
    loss = loss / n + 0.5*l2* w.slice(1).reduce((s,v)=>s+v*v,0);

    // update
    for (let j=0;j<d;j++) w[j] -= lr * grad[j];

    if (iter % 50 === 0) {
      const delta = Math.abs(prevLoss - loss);
      console.log(`[train-risk] iter=${iter} loss=${loss.toFixed(6)} delta=${delta.toExponential(2)}`);
      if (delta < tol) { console.log('[train-risk] early stop'); break; }
      prevLoss = loss;
    }
  }
  return w;
}

function evaluate(X, y, w){
  const n = X.length;
  let correct = 0;
  for (let i=0;i<n;i++){
    let z = 0; for (let j=0;j<w.length;j++) z += w[j]*X[i][j];
    const p = sigmoid(z);
    const pred = p >= 0.5 ? 1 : 0;
    if (pred === y[i]) correct++;
  }
  return { acc: correct/n };
}

(async function main(){
  try{
    console.log('[train-risk] fetching dataset...');
    const items = await fetchDataset();
    if (items.length < 100) {
      console.error('[train-risk] Not enough samples to train (need >=100). Found:', items.length);
      process.exit(2);
    }
    console.log('[train-risk] samples:', items.length);

    const localsVocab = buildLocalsVocab(items, TOPK_LOCALS);
    const X = []; const y = [];
    for (const it of items){
      const xi = buildFeatureVector(it, localsVocab);
      X.push(xi);
      y.push(it.estourou_72h ? 1 : 0);
    }
    console.log('[train-risk] feature dim:', X[0].length, 'locals vocab size:', localsVocab.length);

    const w = trainLogReg(X, y, LR, L2, MAX_ITERS, TOL);
    const evalRes = evaluate(X, y, w);
    console.log('[train-risk] train acc ~', (evalRes.acc*100).toFixed(2),'%');

    const model = {
      version: 1,
      trained_at: new Date().toISOString(),
      params: { days: DAYS, limit: LIMIT, topk_locals: TOPK_LOCALS, lr: LR, l2: L2, max_iters: MAX_ITERS, tol: TOL, tzOffsetMinutes: TZ_OFFSET_MINUTES },
      schema: { order: ['bias','sinHour','cosHour','sinDOW','cosDOW', 'locals_onehot', 'locals_other_bucket_last'] },
      locals_vocab: localsVocab,
      weights: w
    };

    const outDir = path.join(process.cwd(), 'models');
    ensureDir(outDir);
    const outPath = path.join(outDir, 'risk-weights.json');
    fs.writeFileSync(outPath, JSON.stringify(model, null, 2));
    console.log('[train-risk] saved model to', outPath);
  } catch (err){
    console.error('[train-risk] failed:', err?.message || err);
    process.exit(1);
  }
})();
