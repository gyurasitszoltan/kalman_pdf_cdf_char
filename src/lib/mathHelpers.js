export function normalPDF(x, mu = 0, sigma = 1) {
  const s2 = sigma * sigma;
  return (1 / Math.sqrt(2 * Math.PI * s2)) * Math.exp(-0.5 * ((x - mu) ** 2) / s2);
}

export function normalCDF(x, mu = 0, sigma = 1) {
  const z = (x - mu) / sigma;
  const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
  const sign = z < 0 ? -1 : 1;
  const t = 1/(1+p*Math.abs(z));
  const y = 1-(((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-z*z/2);
  return 0.5*(1+sign*y);
}

export function charReal(t, mu = 0, sigma = 1) {
  return Math.exp(-0.5*sigma*sigma*t*t)*Math.cos(mu*t);
}

export function charImag(t, mu = 0, sigma = 1) {
  return Math.exp(-0.5*sigma*sigma*t*t)*Math.sin(mu*t);
}

export function charAbs(t, mu = 0, sigma = 1) {
  return Math.exp(-0.5*sigma*sigma*t*t);
}
