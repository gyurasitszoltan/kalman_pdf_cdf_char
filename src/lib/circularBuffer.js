export class CircularBuffer {
  constructor(capacity = 120) {
    this.capacity = capacity;
    this._data = new Array(capacity);
    this._head = 0;
    this._count = 0;
    this._sum = 0;
    this._sumSq = 0;
  }

  push(value) {
    let evicted = null;
    if (this._count === this.capacity) {
      evicted = this._data[this._head];
      this._sum -= evicted;
      this._sumSq -= evicted * evicted;
    }
    const idx = (this._head + this._count) % this.capacity;
    if (this._count < this.capacity) {
      this._data[idx] = value;
      this._count++;
    } else {
      this._data[this._head] = value;
      this._head = (this._head + 1) % this.capacity;
    }
    this._sum += value;
    this._sumSq += value * value;
    return { evicted };
  }

  get mean() {
    if (this._count === 0) return 0;
    return this._sum / this._count;
  }

  get std() {
    if (this._count < 2) return 1e-8;
    const m = this.mean;
    const variance = this._sumSq / this._count - m * m;
    return Math.sqrt(Math.max(variance, 0)) || 1e-8;
  }

  get count() {
    return this._count;
  }

  get isFull() {
    return this._count === this.capacity;
  }

  toArray() {
    const arr = [];
    for (let i = 0; i < this._count; i++) {
      arr.push(this._data[(this._head + i) % this.capacity]);
    }
    return arr;
  }
}
