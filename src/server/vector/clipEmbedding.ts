import { RawImage, pipeline, CLIPTextModelWithProjection, CLIPTokenizer, env } from '@xenova/transformers';
import fs from 'fs';
import path from 'path';
import os from 'os';

const DEFAULT_MODEL_NAME = 'Xenova/clip-vit-base-patch32';
const DEFAULT_VECTOR_SIZE = 512;

// 配置 transformers 环境
// 设置模型缓存目录
const MODEL_CACHE_DIR = process.env.TRANSFORMERS_CACHE || path.join(process.cwd(), 'models', 'transformers');
env.cacheDir = MODEL_CACHE_DIR;

// 如果使用本地模型，设置本地模型路径
if (process.env.TRANSFORMERS_OFFLINE === 'true') {
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
}

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
let modelLoadError: Error | null = null;

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

export function getModelCacheDir() {
  return MODEL_CACHE_DIR;
}

export function isModelLoaded() {
  return imageExtractorPromise !== null && modelLoadError === null;
}

export function getModelLoadError() {
  return modelLoadError;
}

async function getImageExtractor() {
  if (modelLoadError) {
    throw new Error(`模型加载失败: ${modelLoadError.message}`);
  }
  
  if (!imageExtractorPromise) {
    const modelName = getEmbeddingModelName();
    console.log(`[CLIP] 正在加载图像特征提取模型: ${modelName}`);
    console.log(`[CLIP] 模型缓存目录: ${MODEL_CACHE_DIR}`);
    
    imageExtractorPromise = pipeline('image-feature-extraction', modelName, {
      cache_dir: MODEL_CACHE_DIR,
    })
      .then((extractor) => {
        console.log(`[CLIP] 图像特征提取模型加载成功`);
        modelLoadError = null;
        return extractor as ExtractorFunc;
      })
      .catch((error) => {
        console.error(`[CLIP] 图像特征提取模型加载失败:`, error);
        modelLoadError = error;
        imageExtractorPromise = null;
        
        // 提供更友好的错误信息
        if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED')) {
          throw new Error(
            `模型下载失败: 无法连接到 Hugging Face 服务器。` +
            `请检查网络连接，或设置 TRANSFORMERS_OFFLINE=true 使用本地模型。` +
            `原始错误: ${error.message}`
          );
        }
        throw error;
      });
  }
  return imageExtractorPromise;
}

async function getTextModel() {
  if (modelLoadError) {
    throw new Error(`模型加载失败: ${modelLoadError.message}`);
  }
  
  if (!textModelPromise) {
    const modelName = getEmbeddingModelName();
    console.log(`[CLIP] 正在加载文本模型: ${modelName}`);
    
    textModelPromise = CLIPTextModelWithProjection.from_pretrained(modelName, {
      cache_dir: MODEL_CACHE_DIR,
    })
      .then((model) => {
        console.log(`[CLIP] 文本模型加载成功`);
        return model;
      })
      .catch((error) => {
        console.error(`[CLIP] 文本模型加载失败:`, error);
        modelLoadError = error;
        textModelPromise = null;
        throw error;
      });
  }
  return textModelPromise;
}

async function getTextTokenizer() {
  if (modelLoadError) {
    throw new Error(`模型加载失败: ${modelLoadError.message}`);
  }
  
  if (!textTokenizerPromise) {
    const modelName = getEmbeddingModelName();
    console.log(`[CLIP] 正在加载文本分词器: ${modelName}`);
    
    textTokenizerPromise = CLIPTokenizer.from_pretrained(modelName, {
      cache_dir: MODEL_CACHE_DIR,
    })
      .then((tokenizer) => {
        console.log(`[CLIP] 文本分词器加载成功`);
        return tokenizer;
      })
      .catch((error) => {
        console.error(`[CLIP] 文本分词器加载失败:`, error);
        modelLoadError = error;
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
