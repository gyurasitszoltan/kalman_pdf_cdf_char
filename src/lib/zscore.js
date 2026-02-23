import { CircularBuffer } from './circularBuffer.js';

export class ZScoreNormalizer {
  constructor(windowSize = 120) {
    this.buffer = new CircularBuffer(windowSize);
  }

  update(rawClose) {
    this.buffer.push(rawClose);
    const z = (rawClose - this.buffer.mean) / this.buffer.std;
    return { z, isReady: this.buffer.isFull };
  }

  get stats() {
    return {
      mean: this.buffer.mean,
      std: this.buffer.std,
      count: this.buffer.count,
    };
  }

  reset() {
    this.buffer = new CircularBuffer(this.buffer.capacity);
  }
}
