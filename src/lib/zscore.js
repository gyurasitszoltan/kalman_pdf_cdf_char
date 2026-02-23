export class ZScoreNormalizer {
  constructor() {
    this._count = 0;
    this._sum = 0;
    this._sumSq = 0;
    this._frozen = false;
    this._mean = 0;
    this._std = 1e-8;
  }

  // Kalibrációs fázis: gyűjti az adatokat és frissíti mean/std-t
  calibrate(rawClose) {
    this._count++;
    this._sum += rawClose;
    this._sumSq += rawClose * rawClose;
    this._mean = this._sum / this._count;
    const variance = this._count > 1 ? this._sumSq / this._count - this._mean * this._mean : 0;
    this._std = Math.sqrt(Math.max(variance, 0)) || 1e-8;

    const z = (rawClose - this._mean) / this._std;
    return { z, isReady: this._count >= 2 };
  }

  // Befagyasztja a mean/std-t — innentől nem változik
  freeze() {
    this._frozen = true;
  }

  // Élő fázis: fix mean/std-vel normalizál
  update(rawClose) {
    if (!this._frozen) {
      return this.calibrate(rawClose);
    }
    const z = (rawClose - this._mean) / this._std;
    return { z, isReady: true };
  }

  get stats() {
    return {
      mean: this._mean,
      std: this._std,
      count: this._count,
      frozen: this._frozen,
    };
  }

  reset() {
    this._count = 0;
    this._sum = 0;
    this._sumSq = 0;
    this._frozen = false;
    this._mean = 0;
    this._std = 1e-8;
  }
}
