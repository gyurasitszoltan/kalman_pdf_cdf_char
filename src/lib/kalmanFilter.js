export class KalmanFilter1D {
  constructor(Q = 0.1, R = 2.0) {
    this.Q = Q;
    this.R = R;
    this.dt = 1;
    this.x_est = null;
    this.P = null;
    this.initialized = false;
    this.history = [];
  }

  init(z0) {
    this.x_est = [z0, 0];
    this.P = [[this.R, 0], [0, 1]];
    this.history = [{
      mu: z0,
      sigma: Math.sqrt(this.R),
      measurement: z0,
      filtered: z0,
    }];
    this.initialized = true;
  }

  update(z) {
    if (!this.initialized) {
      this.init(z);
      return this.history[0];
    }

    const { Q, R, dt } = this;
    const F = [[1, dt], [0, 1]];
    const Qmat = [
      [Q * dt * dt * dt / 3, Q * dt * dt / 2],
      [Q * dt * dt / 2, Q * dt],
    ];

    // Predict: x_pred = F * x_est
    const x_pred = [
      F[0][0] * this.x_est[0] + F[0][1] * this.x_est[1],
      F[1][0] * this.x_est[0] + F[1][1] * this.x_est[1],
    ];

    // Predict: P_pred = F * P * F^T + Q
    const P = this.P;
    const FPFt = [
      [
        F[0][0] * (P[0][0] * F[0][0] + P[0][1] * F[1][0]) + F[0][1] * (P[1][0] * F[0][0] + P[1][1] * F[1][0]),
        F[0][0] * (P[0][0] * F[0][1] + P[0][1] * F[1][1]) + F[0][1] * (P[1][0] * F[0][1] + P[1][1] * F[1][1]),
      ],
      [
        F[1][0] * (P[0][0] * F[0][0] + P[0][1] * F[1][0]) + F[1][1] * (P[1][0] * F[0][0] + P[1][1] * F[1][0]),
        F[1][0] * (P[0][0] * F[0][1] + P[0][1] * F[1][1]) + F[1][1] * (P[1][0] * F[0][1] + P[1][1] * F[1][1]),
      ],
    ];
    const Pp = [
      [FPFt[0][0] + Qmat[0][0], FPFt[0][1] + Qmat[0][1]],
      [FPFt[1][0] + Qmat[1][0], FPFt[1][1] + Qmat[1][1]],
    ];

    // Update
    const S = Pp[0][0] + R;
    const K = [Pp[0][0] / S, Pp[1][0] / S];
    const y_innov = z - x_pred[0];

    this.x_est = [
      x_pred[0] + K[0] * y_innov,
      x_pred[1] + K[1] * y_innov,
    ];
    this.P = [
      [(1 - K[0]) * Pp[0][0], (1 - K[0]) * Pp[0][1]],
      [Pp[1][0] - K[1] * Pp[0][0], Pp[1][1] - K[1] * Pp[0][1]],
    ];

    const result = {
      mu: this.x_est[0],
      sigma: Math.sqrt(Math.max(this.P[0][0], 0.001)),
      measurement: z,
      filtered: this.x_est[0],
    };
    this.history.push(result);
    return result;
  }

  setParams(Q, R) {
    this.Q = Q;
    this.R = R;
  }

  reset() {
    this.x_est = null;
    this.P = null;
    this.initialized = false;
    this.history = [];
  }

  rerunAll(measurements) {
    this.reset();
    if (measurements.length === 0) return;
    for (let i = 0; i < measurements.length; i++) {
      this.update(measurements[i]);
    }
  }
}
