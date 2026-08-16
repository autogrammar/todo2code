import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { T2CConfig } from '../config/env.js';
import type { IntentAction } from '../core/types.js';
import { classifyActionHeuristically, normalizeToken } from '../core/text.js';

interface TfTensor {
  data(): PromiseLike<ArrayLike<number>>;
  dispose?(): void;
}

interface TfModel {
  predict(input: unknown): TfTensor | TfTensor[];
}

interface TfModule {
  loadLayersModel(url: string): Promise<TfModel>;
  tensor2d(values: number[][], shape: [number, number]): unknown;
}

interface ModelAssets {
  vocabulary: Record<string, number>;
  labels: IntentAction[];
}

let cache: { modelPath: string; modulePath: string; model: TfModel; tf: TfModule; assets: ModelAssets } | null = null;

async function dynamicImport(specifier: string): Promise<unknown> {
  const importer = new Function('specifier', 'return import(specifier)') as (value: string) => Promise<unknown>;
  return importer(specifier);
}

async function loadAssets(modelPath: string, configuredLabels: string[]): Promise<ModelAssets> {
  const directory = path.dirname(modelPath);
  const vocabularyPath = path.join(directory, 'vocabulary.json');
  let vocabulary: Record<string, number> = {};
  try {
    vocabulary = JSON.parse(await fs.readFile(vocabularyPath, 'utf8')) as Record<string, number>;
  } catch {
    throw new Error(`TensorFlow classifier requires ${vocabularyPath}`);
  }
  const labels = configuredLabels.map((label) => label as IntentAction);
  return { vocabulary, labels };
}

async function loadClassifier(config: T2CConfig): Promise<typeof cache> {
  const modelPath = config.tensorflowModelPath;
  if (!config.enableTensorFlow || !modelPath) return null;
  const modulePath = path.resolve(config.root, config.tensorflowModulePath);
  if (cache?.modelPath === modelPath && cache.modulePath === modulePath) return cache;
  const moduleValue = await dynamicImport(pathToFileURL(modulePath).href) as TfModule;
  const absolute = path.resolve(modelPath);
  const model = await moduleValue.loadLayersModel(`file://${absolute}`);
  const assets = await loadAssets(absolute, config.tensorflowLabels);
  cache = { modelPath, modulePath, model, tf: moduleValue, assets };
  return cache;
}

function vectorize(text: string, vocabulary: Record<string, number>): number[] {
  const values = new Array<number>(Object.keys(vocabulary).length).fill(0);
  for (const token of normalizeToken(text).split(' ').filter(Boolean)) {
    const index = vocabulary[token];
    if (index !== undefined && index >= 0 && index < values.length) values[index] = (values[index] ?? 0) + 1;
  }
  return values;
}

async function classifyWithModel(
  text: string,
  loaded: NonNullable<typeof cache>,
  fallback: IntentAction,
): Promise<{ action: IntentAction; basis: string; confidence: number }> {
  const vector = vectorize(text, loaded.assets.vocabulary);
  const input = loaded.tf.tensor2d([vector], [1, vector.length]);
  const predictionValue = loaded.model.predict(input);
  const prediction = Array.isArray(predictionValue) ? predictionValue[0] : predictionValue;
  if (!prediction) throw new Error('TensorFlow model returned no prediction');
  const probabilities = Array.from(await prediction.data());
  prediction.dispose?.();
  let bestIndex = 0;
  for (let index = 1; index < probabilities.length; index += 1) {
    if ((probabilities[index] ?? 0) > (probabilities[bestIndex] ?? 0)) bestIndex = index;
  }
  const action = loaded.assets.labels[bestIndex] ?? fallback;
  const confidence = Math.max(0, Math.min(1, probabilities[bestIndex] ?? 0));
  return confidence >= 0.55
    ? { action, basis: 'tensorflow_action_classifier', confidence }
    : { action: fallback, basis: 'heuristic_fallback_after_tensorflow', confidence: Math.max(0.55, confidence) };
}

export async function classifyAction(text: string, config: T2CConfig): Promise<{ action: IntentAction; basis: string; confidence: number }> {
  const fallback = classifyActionHeuristically(text);
  if (!config.enableTensorFlow || !config.tensorflowModelPath) {
    return { action: fallback, basis: 'heuristic_action_dictionary', confidence: fallback === 'unknown' ? 0.45 : 0.78 };
  }
  try {
    const loaded = await loadClassifier(config);
    if (!loaded) return { action: fallback, basis: 'heuristic_action_dictionary', confidence: 0.7 };
    return await classifyWithModel(text, loaded, fallback);
  } catch (error) {
    return { action: fallback, basis: `heuristic_fallback:${error instanceof Error ? error.message : String(error)}`, confidence: 0.6 };
  }
}
