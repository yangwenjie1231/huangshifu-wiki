import { RawImage, pipeline, CLIPTextModelWithProjection, CLIPTokenizer } from '@xenova/transformers';
import fs from 'fs';
import path from 'path';
import os from 'os';

const DEFAULT_MODEL_NAME = 'Xenova/clip-vit-base-patch32';
const DEFAULT_VECTOR_SIZE = 512;

type TensorLike = {
  data?: ArrayLike<number>;
};

type ExtractorFunc = (
  input: unknown,
  options?: {
    pooling?: 'mean';
    normalize?: boolean;
  },
) => Promise<TensorLike>;

let imageExtractorPromise: Promise<ExtractorFunc> | null = null;
let textModelPromise: Promise<CLIPTextModelWithProjection> | null = null;
let textTokenizerPromise: Promise<CLIPTokenizer> | null = null;

function parseInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function normalizeVector(vector: number[]) {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(magnitude) || magnitude <= 0) {
    return vector;
  }
  return vector.map((value) => value / magnitude);
}

export function getEmbeddingModelName() {
  return process.env.IMAGE_EMBEDDING_MODEL || DEFAULT_MODEL_NAME;
}

export function getEmbeddingVectorSize() {
  return parseInteger(process.env.IMAGE_EMBEDDING_VECTOR_SIZE, DEFAULT_VECTOR_SIZE);
}

async function getImageExtractor() {
  if (!imageExtractorPromise) {
    imageExtractorPromise = pipeline('image-feature-extraction', getEmbeddingModelName())
      .then((extractor) => extractor as ExtractorFunc)
      .catch((error) => {
        imageExtractorPromise = null;
        throw error;
      });
  }
  return imageExtractorPromise;
}

async function getTextModel() {
  if (!textModelPromise) {
    textModelPromise = CLIPTextModelWithProjection.from_pretrained(getEmbeddingModelName())
      .catch((error) => {
        textModelPromise = null;
        throw error;
      });
  }
  return textModelPromise;
}

async function getTextTokenizer() {
  if (!textTokenizerPromise) {
    textTokenizerPromise = CLIPTokenizer.from_pretrained(getEmbeddingModelName())
      .catch((error) => {
        textTokenizerPromise = null;
        throw error;
      });
  }
  return textTokenizerPromise;
}

export async function generateImageEmbedding(imageBuffer: Buffer) {
  if (!imageBuffer || imageBuffer.byteLength === 0) {
    throw new Error('图片内容为空，无法生成向量');
  }

  const extractor = await getImageExtractor();
  const tmpPath = path.join(os.tmpdir(), `embedding_${Date.now()}_${Math.random().toString(36).slice(2)}.tmp`);
  try {
    await fs.promises.writeFile(tmpPath, imageBuffer);
    const image = await RawImage.read(tmpPath);
    const output = await extractor(image, {
      pooling: 'mean',
      normalize: true,
    });

    const vectorData = output.data;
    if (!vectorData) {
      throw new Error('未获取到图像向量数据');
    }

    const vector = normalizeVector(Array.from(vectorData));
    const expectedSize = getEmbeddingVectorSize();
    if (vector.length !== expectedSize) {
      throw new Error(`向量维度异常: expected=${expectedSize}, actual=${vector.length}`);
    }

    return vector;
  } finally {
    await fs.promises.unlink(tmpPath).catch(() => {});
  }
}

export async function generateTextEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error('文本内容为空，无法生成向量');
  }

  const model = await getTextModel();
  const tokenizer = await getTextTokenizer();

  const outputs = await model.forward(tokenizer(text));
  const vectorData = outputs.text_embeds.data;

  if (!vectorData) {
    throw new Error('未获取到文本向量数据');
  }

  const vector = normalizeVector(Array.from(vectorData));
  const expectedSize = getEmbeddingVectorSize();
  if (vector.length !== expectedSize) {
    throw new Error(`向量维度异常: expected=${expectedSize}, actual=${vector.length}`);
  }

  return vector;
}