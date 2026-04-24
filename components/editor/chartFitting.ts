import { levenbergMarquardt, type LevenbergMarquardtOptions, type ParameterizedFunction } from 'ml-levenberg-marquardt';

export type ChartModel =
  | 'linear'
  | 'exponential'
  | 'logarithmic'
  | 'sine'
  | 'cosine'
  | 'tangent'
  | 'power'
  | 'logistic'
  | 'polynomial'
  | 'gaussian';

export type DataPoint = {
  x: number;
  y: number;
};

export type FitResult =
  | {
      ok: true;
      equation: string;
      r2: number;
      curve: DataPoint[];
      params: number[];
      points: DataPoint[];
    }
  | {
      ok: false;
      error: string;
      equation: string;
      r2: null;
      curve: DataPoint[];
      params: number[];
      points: DataPoint[];
    };

const POLYNOMIAL_DEGREE = 3;
const CURVE_POINTS = 120;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const safeExp = (value: number) => Math.exp(clamp(value, -60, 60));
const fmt = (value: number) => (Number.isFinite(value) ? value.toFixed(4) : 'NaN');

const isFinitePoint = (point: DataPoint) => Number.isFinite(point.x) && Number.isFinite(point.y);

const evaluateModel = (model: ChartModel, params: number[], x: number): number => {
  switch (model) {
    case 'linear':
      return params[0] * x + params[1];
    case 'exponential':
      return params[0] * safeExp(params[1] * x);
    case 'logarithmic':
      if (x <= 0) return Number.NaN;
      return params[0] * Math.log(x) + params[1];
    case 'sine':
      return params[0] * Math.sin(params[1] * x + params[2]) + params[3];
    case 'cosine':
      return params[0] * Math.cos(params[1] * x + params[2]) + params[3];
    case 'tangent':
      return params[0] * Math.tan(params[1] * x + params[2]) + params[3];
    case 'power':
      if (x <= 0) return Number.NaN;
      return params[0] * x ** params[1];
    case 'logistic':
      return params[0] / (1 + safeExp(-params[1] * (x - params[2]))) + params[3];
    case 'polynomial':
      return params.reduce((sum, coefficient, index) => sum + coefficient * x ** index, 0);
    case 'gaussian': {
      const sigma = Math.abs(params[2]) || 1e-6;
      return params[0] * safeExp(-((x - params[1]) ** 2) / (2 * sigma ** 2)) + params[3];
    }
    default:
      return Number.NaN;
  }
};

const makeModelFunction = (model: ChartModel): ParameterizedFunction => {
  return (params: number[]) => (x: number) => evaluateModel(model, params, x);
};

const computeInitialValues = (points: DataPoint[], model: ChartModel): number[] => {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeX = Math.max(maxX - minX, 1);
  const meanX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  const amplitude = Math.max((maxY - minY) / 2, 1e-3);

  switch (model) {
    case 'linear':
      return [1, meanY];
    case 'exponential':
      return [Math.max(amplitude, 1e-3), 0.01];
    case 'logarithmic':
      return [1, meanY];
    case 'sine':
    case 'cosine':
      return [amplitude, (2 * Math.PI) / rangeX, 0, meanY];
    case 'tangent':
      return [Math.max(amplitude / 2, 1e-3), Math.PI / rangeX, 0, meanY];
    case 'power':
      return [Math.max(amplitude, 1e-3), 1];
    case 'logistic':
      return [Math.max(maxY - minY, 1e-3), 1 / rangeX, meanX, minY];
    case 'polynomial':
      return Array.from({ length: POLYNOMIAL_DEGREE + 1 }, (_, index) => (index === 0 ? meanY : 0));
    case 'gaussian':
      return [Math.max(maxY - minY, 1e-3), meanX, Math.max(rangeX / 4, 1e-3), minY];
    default:
      return [1, 0];
  }
};

const computeBounds = (model: ChartModel, initialValues: number[]) => {
  if (model === 'gaussian') {
    return {
      minValues: initialValues.map((_, index) => (index === 2 ? 1e-6 : Number.NEGATIVE_INFINITY)),
      maxValues: initialValues.map(() => Number.POSITIVE_INFINITY),
    };
  }
  return undefined;
};

const normalizePoints = (points: DataPoint[], model: ChartModel): DataPoint[] => {
  const finite = points.filter(isFinitePoint);
  if (model === 'logarithmic' || model === 'power') {
    return finite.filter((point) => point.x > 0);
  }
  return finite;
};

const buildEquation = (model: ChartModel, params: number[]): string => {
  switch (model) {
    case 'linear':
      return `y = ${fmt(params[0])}x + ${fmt(params[1])}`;
    case 'exponential':
      return `y = ${fmt(params[0])}e^(${fmt(params[1])}x)`;
    case 'logarithmic':
      return `y = ${fmt(params[0])}ln(x) + ${fmt(params[1])}`;
    case 'sine':
      return `y = ${fmt(params[0])}sin(${fmt(params[1])}x + ${fmt(params[2])}) + ${fmt(params[3])}`;
    case 'cosine':
      return `y = ${fmt(params[0])}cos(${fmt(params[1])}x + ${fmt(params[2])}) + ${fmt(params[3])}`;
    case 'tangent':
      return `y = ${fmt(params[0])}tan(${fmt(params[1])}x + ${fmt(params[2])}) + ${fmt(params[3])}`;
    case 'power':
      return `y = ${fmt(params[0])}x^${fmt(params[1])}`;
    case 'logistic':
      return `y = ${fmt(params[0])}/(1 + e^(-${fmt(params[1])}(x-${fmt(params[2])}))) + ${fmt(params[3])}`;
    case 'polynomial': {
      const terms = params
        .map((coefficient, index) => {
          if (index === 0) return fmt(coefficient);
          if (index === 1) return `${fmt(coefficient)}x`;
          return `${fmt(coefficient)}x^${index}`;
        })
        .join(' + ');
      return `y = ${terms}`;
    }
    case 'gaussian':
      return `y = ${fmt(params[0])}e^{-((x-${fmt(params[1])})^2)/(2${fmt(params[2])}^2)} + ${fmt(params[3])}`;
    default:
      return 'y = f(x)';
  }
};

const computeR2 = (actual: number[], predicted: number[]) => {
  if (actual.length < 2 || predicted.length !== actual.length) return 0;
  const mean = actual.reduce((sum, value) => sum + value, 0) / actual.length;
  const ssTot = actual.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  const ssRes = actual.reduce((sum, value, index) => sum + (value - predicted[index]) ** 2, 0);
  if (ssTot === 0) return 1;
  return 1 - ssRes / ssTot;
};

const makeCurve = (points: DataPoint[], model: ChartModel, params: number[]) => {
  const xs = points.map((point) => point.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const safeMinX = minX === maxX ? minX - 1 : minX;
  const safeMaxX = minX === maxX ? maxX + 1 : maxX;
  const step = (safeMaxX - safeMinX) / (CURVE_POINTS - 1);

  const curve: DataPoint[] = [];
  for (let index = 0; index < CURVE_POINTS; index += 1) {
    const x = safeMinX + index * step;
    const y = evaluateModel(model, params, x);
    if (!Number.isFinite(y) || Math.abs(y) > 1e8) continue;
    curve.push({ x, y });
  }
  return curve;
};

export const fitLeastSquares = (points: DataPoint[], model: ChartModel): FitResult => {
  const normalized = normalizePoints(points, model);
  if (normalized.length < 2) {
    return {
      ok: false,
      error: 'At least 2 valid points are required for fitting.',
      equation: 'y = f(x)',
      r2: null,
      curve: [],
      params: [],
      points: normalized,
    };
  }

  const initialValues = computeInitialValues(normalized, model);
  const bounds = computeBounds(model, initialValues);

  try {
    const options: LevenbergMarquardtOptions = {
      damping: 1.5,
      gradientDifference: 1e-2,
      maxIterations: 250,
      errorTolerance: 1e-4,
      initialValues,
      ...bounds,
    };

    const fitted = levenbergMarquardt(
      {
        x: normalized.map((point) => point.x),
        y: normalized.map((point) => point.y),
      },
      makeModelFunction(model),
      options,
    );

    const params = fitted.parameterValues;
    const predictions = normalized.map((point) => evaluateModel(model, params, point.x));
    if (predictions.some((value) => !Number.isFinite(value))) {
      return {
        ok: false,
        error: 'Could not converge to a stable fit for this model and dataset.',
        equation: buildEquation(model, params),
        r2: null,
        curve: [],
        params,
        points: normalized,
      };
    }

    const curve = makeCurve(normalized, model, params);
    const r2 = computeR2(
      normalized.map((point) => point.y),
      predictions,
    );

    return {
      ok: true,
      equation: buildEquation(model, params),
      r2,
      curve,
      params,
      points: normalized,
    };
  } catch {
    return {
      ok: false,
      error: 'Curve fitting failed for this model with the current data.',
      equation: 'y = f(x)',
      r2: null,
      curve: [],
      params: [],
      points: normalized,
    };
  }
};

export const chartModelOptions: Array<{ value: ChartModel; label: string }> = [
  { value: 'linear', label: 'Linear' },
  { value: 'exponential', label: 'Exponential' },
  { value: 'logarithmic', label: 'Logarithmic' },
  { value: 'sine', label: 'Sine' },
  { value: 'cosine', label: 'Cosine' },
  { value: 'tangent', label: 'Tangent' },
  { value: 'power', label: 'Power law' },
  { value: 'logistic', label: 'Logistic' },
  { value: 'polynomial', label: 'Polynomial (deg 3)' },
  { value: 'gaussian', label: 'Gaussian' },
];

