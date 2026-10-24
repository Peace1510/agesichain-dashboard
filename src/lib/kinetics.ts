/**
 * @file lib/kinetics.ts
 * @description Core mathematical library for Cold Chain Monitoring & Kinetic
 *              Viability calculations for vaccine potency tracking.
 *
 * Units convention (used throughout this file):
 *   Temperature  → Kelvin (K) internally, Celsius (°C) at I/O boundaries
 *   Energy       → Joules per mole (J/mol)
 *   Time         → Hours (hr) for kinetic calculations, Unix seconds at I/O
 *   Rate         → hr⁻¹
 *   Viability    → dimensionless fraction [0.0 – 1.0]  (1.0 = 100 % potency)
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1.  PHYSICAL & DOMAIN CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Universal gas constant  [J / (mol · K)] */
export const R_GAS: number = 8.314;

/** Standard activation energy for vaccine degradation  [J / mol] */
export const EA_VACCINE: number = 83_140;

/**
 * Pre-exponential / frequency factor  [hr⁻¹]
 * Calibrated so that k is expressed in hours⁻¹ – consistent with
 * delta_t values also expressed in hours.
 */
export const A_FACTOR: number = 1.0e13;

/** Enthalpy parameter used for MKT calculation  [J / mol] */
export const DH_MKT: number = 83_144;

/**
 * Baseline potency at time zero  (dimensionless fraction)
 * Represents 100 % viable product.
 */
export const V_BASELINE: number = 1.0;

/**
 * Critical viability threshold below which the vaccine is considered spoiled
 * (dimensionless fraction – represents 80 % potency).
 */
export const V_THRESHOLD: number = 0.8;

// ─────────────────────────────────────────────────────────────────────────────
// 2.  SHARED TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

/** A reading from one physical temperature sensor at a point in time. */
export interface TemperatureReading {
  /** Unix timestamp in whole seconds [s] */
  timestamp_unix_s: number;
  /** Temperature measured by the sensor  [°C] */
  temperature_celsius: number;
}

/** Shipment / route status returned by the viability buffer evaluator. */
export type ShipmentStatus = "NOMINAL" | "WARNING" | "CRITICAL";

/** Full result produced by evaluating one viability snapshot. */
export interface ViabilityEvaluation {
  /** Current viability fraction  [0.0 – 1.0] */
  viability: number;
  /** Estimated hours remaining before viability drops to V_THRESHOLD  [hr] */
  time_to_spoil_hours: number;
  /** Surplus time beyond the ETA (negative means already too late)  [hr] */
  viability_buffer_hours: number;
  /** Traffic-light status of the shipment */
  status: ShipmentStatus;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3.  TEMPERATURE CONVERSION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a temperature from Celsius to Kelvin.
 *
 * Formula:  T_K = T_°C + 273.15
 *
 * @param celsius  Temperature  [°C]
 * @returns        Temperature  [K]
 */
export function celsiusToKelvin(celsius: number): number {
  return celsius + 273.15; // [K]
}

/**
 * Convert a temperature from Kelvin to Celsius.
 *
 * Formula:  T_°C = T_K - 273.15
 *
 * @param kelvin  Temperature  [K]
 * @returns       Temperature  [°C]
 */
export function kelvinToCelsius(kelvin: number): number {
  return kelvin - 273.15; // [°C]
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.  ARRHENIUS RATE CONSTANT
// ─────────────────────────────────────────────────────────────────────────────

/** Inputs accepted by {@link arrheniusRateConstant}. */
export interface ArrheniusInput {
  /** Temperature at which to evaluate k  [°C] */
  temperature_celsius: number;
  /** Pre-exponential factor  [hr⁻¹]  (default: A_FACTOR = 1.0 × 10¹³ hr⁻¹) */
  A?: number;
  /** Activation energy  [J / mol]  (default: EA_VACCINE = 83 140 J/mol) */
  Ea?: number;
}

/** Output of {@link arrheniusRateConstant}. */
export interface ArrheniusResult {
  /** Temperature converted internally  [K] */
  temperature_kelvin: number;
  /** First-order degradation rate constant  [hr⁻¹] */
  rate_constant_per_hour: number;
}

/**
 * Compute the Arrhenius first-order degradation rate constant **k**.
 *
 * Formula:  k = A · exp(−Ea / (R · T_K))
 *
 * @param input  See {@link ArrheniusInput}
 * @returns      See {@link ArrheniusResult}
 *
 * @throws {RangeError} if temperature_celsius produces an absolute zero or
 *         negative Kelvin value.
 */
export function arrheniusRateConstant(input: ArrheniusInput): ArrheniusResult {
  const A  = input.A  ?? A_FACTOR;     // [hr⁻¹]
  const Ea = input.Ea ?? EA_VACCINE;   // [J / mol]

  const T_K = celsiusToKelvin(input.temperature_celsius); // [K]

  if (T_K <= 0) {
    throw new RangeError(
      `Temperature must be above absolute zero. Got ${T_K} K (${input.temperature_celsius} °C).`
    );
  }

  // k  [hr⁻¹]  =  A [hr⁻¹] × exp( −Ea [J/mol] / ( R [J/(mol·K)] × T [K] ) )
  const k = A * Math.exp(-Ea / (R_GAS * T_K)); // [hr⁻¹]

  return {
    temperature_kelvin: T_K,       // [K]
    rate_constant_per_hour: k,     // [hr⁻¹]
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.  FIRST-ORDER VIABILITY DECAY  (single step)
// ─────────────────────────────────────────────────────────────────────────────

/** Inputs for one decay time-step calculation. */
export interface ViabilityDecayInput {
  /** Viability at the start of the interval  [0.0 – 1.0] */
  viability_prev: number;
  /** Unix timestamp at the start of the interval  [s] */
  timestamp_prev_unix_s: number;
  /** Unix timestamp at the end of the interval  [s] */
  timestamp_current_unix_s: number;
  /** Temperature held constant over this interval  [°C] */
  temperature_celsius: number;
}

/** Output of one decay step. */
export interface ViabilityDecayResult {
  /** Duration of this interval  [hr] */
  delta_t_hours: number;
  /** Rate constant used for this interval  [hr⁻¹] */
  rate_constant_per_hour: number;
  /** Viability at the end of the interval  [0.0 – 1.0] */
  viability_new: number;
}

/**
 * Apply one step of first-order viability decay.
 *
 * Formula:  V_new = V_prev · exp(−k · Δt)
 *
 * where Δt [hr] = (t_current [s] − t_prev [s]) / 3 600
 *
 * @param input  See {@link ViabilityDecayInput}
 * @returns      See {@link ViabilityDecayResult}
 *
 * @throws {RangeError} if timestamps are out of order or viability is outside
 *         [0, 1].
 */
export function computeViabilityDecay(
  input: ViabilityDecayInput
): ViabilityDecayResult {
  if (input.viability_prev < 0 || input.viability_prev > 1) {
    throw new RangeError(
      `viability_prev must be in [0, 1]. Got ${input.viability_prev}.`
    );
  }
  if (input.timestamp_current_unix_s < input.timestamp_prev_unix_s) {
    throw new RangeError(
      "timestamp_current_unix_s must be >= timestamp_prev_unix_s."
    );
  }

  // Dt  [hr]  =  Dt [s] / 3 600
  const delta_t_hours =
    (input.timestamp_current_unix_s - input.timestamp_prev_unix_s) / 3_600; // [hr]

  const { rate_constant_per_hour: k } = arrheniusRateConstant({
    temperature_celsius: input.temperature_celsius,
  });

  // V_new  =  V_prev · exp(−k [hr⁻¹] · Dt [hr])
  const viability_new = input.viability_prev * Math.exp(-k * delta_t_hours); // [dimensionless]

  return {
    delta_t_hours,              // [hr]
    rate_constant_per_hour: k,  // [hr⁻¹]
    viability_new,              // [0.0 – 1.0]
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6.  CUMULATIVE VIABILITY  (multi-step walk)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Walk through an array of temperature readings and accumulate total viability
 * loss starting from {@link V_BASELINE} (1.0).
 *
 * Readings must be sorted in ascending timestamp order.  Each consecutive pair
 * forms one decay interval; the temperature of the **earlier** reading is
 * assumed constant over that interval (left-endpoint rule / zero-order hold).
 *
 * @param readings  Chronologically ordered sensor readings  (>= 1 entry)
 * @returns         Final viability fraction  [0.0 – 1.0]
 *
 * @throws {Error} if readings array is empty.
 */
export function computeCumulativeViability(
  readings: TemperatureReading[]
): number {
  if (readings.length === 0) {
    throw new Error("readings array must contain at least one entry.");
  }

  let viability = V_BASELINE; // start at 1.0

  for (let i = 1; i < readings.length; i++) {
    const prev    = readings[i - 1]!;
    const current = readings[i]!;

    const result = computeViabilityDecay({
      viability_prev:           viability,
      timestamp_prev_unix_s:    prev.timestamp_unix_s,
      timestamp_current_unix_s: current.timestamp_unix_s,
      temperature_celsius:      prev.temperature_celsius,
    });

    viability = result.viability_new;
  }

  return viability; // [0.0 – 1.0]
}

// ─────────────────────────────────────────────────────────────────────────────
// 7.  TIME-TO-SPOIL
// ─────────────────────────────────────────────────────────────────────────────

/** Inputs for the time-to-spoil calculation. */
export interface TimeToSpoilInput {
  /** Current viability fraction  [0.0 – 1.0] */
  viability_current: number;
  /** Current temperature (used to derive k)  [°C] */
  temperature_celsius: number;
  /** Viability fraction that marks the spoilage boundary  (default: V_THRESHOLD = 0.8) */
  v_threshold?: number;
}

/** Output of the time-to-spoil calculation. */
export interface TimeToSpoilResult {
  /** Rate constant at the current temperature  [hr⁻¹] */
  rate_constant_per_hour: number;
  /**
   * Estimated hours remaining before viability falls to v_threshold.
   * Returns 0.0 when viability is already at or below the threshold.  [hr]
   */
  time_to_spoil_hours: number;
  /** Whether the vaccine has already crossed the spoilage threshold */
  is_spoiled: boolean;
}

/**
 * Estimate how many hours remain before viability drops to the spoilage
 * threshold, **assuming the current temperature remains constant**.
 *
 * Formula:  t_spoil = (ln V_current - ln V_threshold) / k
 *                   = ln(V_current / V_threshold) / k
 *
 * Returns 0.0 when V_current <= V_threshold.
 *
 * @param input  See {@link TimeToSpoilInput}
 * @returns      See {@link TimeToSpoilResult}
 */
export function computeTimeToSpoil(
  input: TimeToSpoilInput
): TimeToSpoilResult {
  const v_threshold = input.v_threshold ?? V_THRESHOLD; // [dimensionless]

  const { rate_constant_per_hour: k } = arrheniusRateConstant({
    temperature_celsius: input.temperature_celsius,
  });

  // Already spoiled?
  if (input.viability_current <= v_threshold) {
    return {
      rate_constant_per_hour: k,  // [hr⁻¹]
      time_to_spoil_hours: 0.0,   // [hr]
      is_spoiled: true,
    };
  }

  // t_spoil  [hr]  =  ( ln(V_current) - ln(V_threshold) ) / k
  //                 =  ln(V_current / V_threshold) / k
  const time_to_spoil_hours =
    (Math.log(input.viability_current) - Math.log(v_threshold)) / k; // [hr]

  return {
    rate_constant_per_hour: k,    // [hr⁻¹]
    time_to_spoil_hours,          // [hr]
    is_spoiled: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 8.  MEAN KINETIC TEMPERATURE (MKT)
// ─────────────────────────────────────────────────────────────────────────────

/** Inputs for the MKT calculation. */
export interface MKTInput {
  /**
   * Array of temperature readings.  Each element represents one equal-weight
   * measurement interval.  Must contain >= 1 value.  [°C]
   */
  temperatures_celsius: number[];
  /** Activation enthalpy  [J / mol]  (default: DH_MKT = 83 144 J/mol) */
  dH?: number;
}

/** Output of the MKT calculation. */
export interface MKTResult {
  /** Mean Kinetic Temperature  [K] */
  mkt_kelvin: number;
  /** Mean Kinetic Temperature  [°C] – ready to display */
  mkt_celsius: number;
}

/**
 * Compute the **Mean Kinetic Temperature** (MKT) per ICH Q1A / USP <1198>.
 *
 * Formula:
 *   T_MKT_K = (dH / R) / ( -ln( (1/n) * sum( exp(-dH / (R * T_i)) ) ) )
 *
 * All T_i values are converted to Kelvin internally.
 *
 * @param input  See {@link MKTInput}
 * @returns      See {@link MKTResult}
 *
 * @throws {Error}      if temperatures_celsius is empty.
 * @throws {RangeError} if a temperature produces a non-positive Kelvin value.
 */
export function computeMKT(input: MKTInput): MKTResult {
  const { temperatures_celsius, dH = DH_MKT } = input;

  if (temperatures_celsius.length === 0) {
    throw new Error("temperatures_celsius must contain at least one reading.");
  }

  const n = temperatures_celsius.length;

  // Convert every reading to Kelvin and validate
  const temps_K: number[] = temperatures_celsius.map((tc, idx) => {
    const tk = celsiusToKelvin(tc);
    if (tk <= 0) {
      throw new RangeError(
        `temperatures_celsius[${idx}] = ${tc} °C yields ${tk} K (must be > 0 K).`
      );
    }
    return tk;
  });

  // sum( exp( -dH / (R * T_i) ) )  for each reading
  const sum_exp = temps_K.reduce(
    (acc, T_i) => acc + Math.exp(-dH / (R_GAS * T_i)), // dimensionless terms
    0
  );

  // Mean of the Boltzmann factors
  const mean_exp = sum_exp / n; // dimensionless

  // T_MKT_K  [K]  =  (dH / R) / ( -ln( mean_exp ) )
  const mkt_kelvin = (dH / R_GAS) / (-Math.log(mean_exp)); // [K]

  return {
    mkt_kelvin,                               // [K]
    mkt_celsius: kelvinToCelsius(mkt_kelvin), // [°C]
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 9.  VIABILITY BUFFER & SHIPMENT STATUS EVALUATION
// ─────────────────────────────────────────────────────────────────────────────

/** Thresholds that define shipment status boundaries. */
export interface StatusThresholds {
  /** Buffer <= this value → CRITICAL  [hr]  (default 0.5) */
  critical_hours: number;
  /** Buffer <= this value → WARNING   [hr]  (default 1.0) */
  warning_hours: number;
}

/** Inputs for the full viability evaluation. */
export interface ViabilityEvaluationInput {
  /** Current viability fraction  [0.0 – 1.0] */
  viability_current: number;
  /** Current ambient temperature  [°C] */
  temperature_celsius: number;
  /** Remaining transit time to delivery destination  [hr] */
  destination_eta_hours: number;
  /** Optional custom spoilage threshold  (default: V_THRESHOLD = 0.8) */
  v_threshold?: number;
  /** Optional custom status thresholds */
  status_thresholds?: Partial<StatusThresholds>;
  /** Optional minimum allowable temperature for the active vaccine tier (default: 2.0°C) */
  min_temp_celsius?: number;
  /** Optional maximum allowable temperature for the active vaccine tier (default: 8.0°C) */
  max_temp_celsius?: number;
  /** Optional freeze breach threshold (e.g. 0.0°C for refrigerated vaccines) */
  freeze_limit_celsius?: number;
}

/**
 * Evaluate shipment viability against the remaining ETA and assign a
 * traffic-light status based on Arrhenius degradation and active tier envelope.
 */
export function evaluateViability(
  input: ViabilityEvaluationInput
): ViabilityEvaluation {
  const {
    viability_current,
    temperature_celsius,
    destination_eta_hours,
    v_threshold = V_THRESHOLD,
    status_thresholds = {},
    min_temp_celsius = 2.0,
    max_temp_celsius = 8.0,
    freeze_limit_celsius = 0.0,
  } = input;

  const thresholds: StatusThresholds = {
    critical_hours: status_thresholds.critical_hours ?? 0.5, // [hr]
    warning_hours:  status_thresholds.warning_hours  ?? 1.0, // [hr]
  };

  // Step 1 – time to spoil at current conditions
  const { time_to_spoil_hours } = computeTimeToSpoil({
    viability_current,
    temperature_celsius,
    v_threshold,
  });

  // Step 2 – viability buffer  [hr]
  const viability_buffer_hours =
    time_to_spoil_hours - destination_eta_hours; // [hr]

  // Step 3 – assign status based on active tier envelope:
  // For standard refrigerated (+2 to +8°C): freeze <= 0.0°C is irreversible destruction
  const isFreezingBreach =
    typeof freeze_limit_celsius === "number" && temperature_celsius <= freeze_limit_celsius;
  const isThermalExcursion =
    temperature_celsius > max_temp_celsius || temperature_celsius < min_temp_celsius;
  const isActualPotencyBreached = viability_current <= v_threshold;
  const isSpoilBeforeArrival = time_to_spoil_hours <= destination_eta_hours;

  let status: ShipmentStatus;
  if (isActualPotencyBreached || isSpoilBeforeArrival || isFreezingBreach) {
    status = "CRITICAL";
  } else if (
    isThermalExcursion ||
    viability_current < 0.90 ||
    viability_buffer_hours <= thresholds.warning_hours
  ) {
    status = "WARNING";
  } else {
    status = "NOMINAL";
  }

  return {
    viability: viability_current,
    time_to_spoil_hours,
    viability_buffer_hours,
    status,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. CONVENIENCE: END-TO-END SNAPSHOT CALCULATOR
// ─────────────────────────────────────────────────────────────────────────────

/** All-in-one output for a complete cold chain snapshot. */
export interface ColdChainSnapshot {
  cumulative_viability: number;
  time_to_spoil_hours: number;
  mkt_celsius: number;
  evaluation: ViabilityEvaluation;
}

export interface ColdChainSnapshotOptions {
  min_temp_celsius?: number;
  max_temp_celsius?: number;
  freeze_limit_celsius?: number;
}

export function computeColdChainSnapshot(
  readings: TemperatureReading[],
  destination_eta_hours: number,
  options?: ColdChainSnapshotOptions
): ColdChainSnapshot {
  const cumulative_viability = computeCumulativeViability(readings);
  const latestReading = readings[readings.length - 1]!;

  const { time_to_spoil_hours } = computeTimeToSpoil({
    viability_current:   cumulative_viability,
    temperature_celsius: latestReading.temperature_celsius,
  });

  const { mkt_celsius } = computeMKT({
    temperatures_celsius: readings.map((r) => r.temperature_celsius),
  });

  const evaluation = evaluateViability({
    viability_current:    cumulative_viability,
    temperature_celsius:  latestReading.temperature_celsius,
    destination_eta_hours,
    min_temp_celsius:     options?.min_temp_celsius,
    max_temp_celsius:     options?.max_temp_celsius,
    freeze_limit_celsius: options?.freeze_limit_celsius,
  });

  return {
    cumulative_viability,
    time_to_spoil_hours,
    mkt_celsius,
    evaluation,
  };
}
