export function hexToBits(hex) {
  const bits = [];
  for (const c of hex) {
    const n = parseInt(c, 16);
    for (let i = 3; i >= 0; i--) bits.push((n >> i) & 1);
  }
  return bits;
}

export function frequencyTest(bits) {
  const n = bits.length;
  if (n === 0) return null;
  const ones = bits.filter(b => b === 1).length;
  const s = Math.abs(2 * ones - n) / Math.sqrt(n);
  const erfc = x => {
    const t = 1 / (1 + 0.3275911 * x);
    const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
    return poly * Math.exp(-x * x);
  };
  const p = erfc(s / Math.sqrt(2));
  return { ones, zeros: n - ones, ratio: ones / n, s: s.toFixed(4), p: p.toFixed(4), pass: p >= 0.01 };
}

export function blockFrequencyTest(bits, M = 8) {
  const n = bits.length;
  const N = Math.floor(n / M);
  if (N < 1) return { N: 0, chi2: '0.0000', p: '0.0000', pass: false };

  function logGamma(z) {
    const c = [76.18009172947146,-86.50532032941677,24.01409824083091,-1.231739572450155,0.1208650973866179e-2,-0.5395239384953e-5];
    let y = z, tmp = z + 5.5;
    tmp -= (z + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) { y += 1; ser += c[j] / y; }
    return -tmp + Math.log(2.5066282746310005 * ser / z);
  }
  function gammainc(a, x) {
    if (x < 0) return 0;
    if (x === 0) return 0;
    let sum = 1 / a, term = 1 / a;
    for (let i = 1; i < 300; i++) {
      term *= x / (a + i);
      sum += term;
      if (Math.abs(term) < 1e-12) break;
    }
    return Math.min(1, Math.exp(-x + a * Math.log(x) - logGamma(a)) * sum);
  }

  let chi2 = 0;
  for (let i = 0; i < N; i++) {
    const block = bits.slice(i * M, (i + 1) * M);
    const pi_i = block.filter(b => b === 1).length / M;
    chi2 += (pi_i - 0.5) ** 2;
  }
  chi2 *= 4 * M;
  const p = 1 - gammainc(N / 2, chi2 / 2);
  return { N, M, chi2: chi2.toFixed(4), p: p.toFixed(4), pass: p >= 0.01 };
}

export function runsTest(bits) {
  const n = bits.length;
  if (n === 0) return null;
  const ones = bits.filter(b => b === 1).length;
  const pi = ones / n;
  if (Math.abs(pi - 0.5) >= 2 / Math.sqrt(n)) {
    return { runs: 0, expected: 0, z: 'N/A', p: '0.0000', pass: false, blocked: true };
  }
  let runs = 1;
  for (let i = 1; i < n; i++) { if (bits[i] !== bits[i - 1]) runs++; }
  const expected = 2 * n * pi * (1 - pi);
  const z = Math.abs(runs - expected) / Math.sqrt(2 * n * pi * (1 - pi));
  const erfc = x => {
    const t = 1 / (1 + 0.3275911 * x);
    const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
    return poly * Math.exp(-x * x);
  };
  const p = erfc(z / Math.sqrt(2));
  return { runs, expected: Math.round(expected), z: z.toFixed(4), p: p.toFixed(4), pass: p >= 0.01 };
}

export function serialTest(bits) {
  const n = bits.length;
  if (n < 8) return { p1: '0.0000', p2: '0.0000', pass: false };
  const m = 2;

  function countPatterns(bits, m) {
    const counts = {};
    for (let i = 0; i < n - m + 1; i++) {
      let key = '';
      for (let j = 0; j < m; j++) key += bits[(i + j) % n];
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }

  const vm = Object.values(countPatterns(bits, m)).reduce((a, c) => a + c * c, 0);
  const vm1 = Object.values(countPatterns(bits, m - 1)).reduce((a, c) => a + c * c, 0);
  const vm2 = m >= 2 ? Object.values(countPatterns(bits, m - 2)).reduce((a, c) => a + c * c, 0) : n;

  const psi2m = (Math.pow(2, m) / n) * vm - n;
  const psi2m1 = (Math.pow(2, m - 1) / n) * vm1 - n;
  const psi2m2 = m >= 2 ? (Math.pow(2, m - 2) / n) * vm2 - n : 0;

  const del1 = psi2m - psi2m1;
  const del2 = psi2m - 2 * psi2m1 + psi2m2;

  function chiSqP(chi2, df) {
    if (chi2 <= 0) return 1;
    const k = df / 2;
    const x = chi2 / 2;
    function logGamma(z) {
      const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
      let x = z, y = z, tmp = x + 5.5;
      tmp -= (x + 0.5) * Math.log(tmp);
      let ser = 1.000000000190015;
      for (let j = 0; j < 6; j++) { y += 1; ser += c[j] / y; }
      return -tmp + Math.log(2.5066282746310005 * ser / x);
    }
    let s = Math.exp(-x + k * Math.log(x) - logGamma(k));
    let sum = 1 / k;
    let term = 1 / k;
    for (let i = 1; i < 100; i++) {
      term *= x / (k + i);
      sum += term;
      if (term < 1e-10) break;
    }
    return Math.max(0, Math.min(1, 1 - s * sum));
  }

  const df1 = Math.pow(2, m - 1);
  const df2 = Math.pow(2, m - 2);
  const p1 = chiSqP(del1, df1).toFixed(4);
  const p2 = chiSqP(del2, df2).toFixed(4);

  return { del1: del1.toFixed(4), del2: del2.toFixed(4), p1, p2, pass: parseFloat(p1) >= 0.01 && parseFloat(p2) >= 0.01 };
}
