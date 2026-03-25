import { RawImage, pipeline } from '@xenova/transformers';

const DEFAULT_MODEL_NAME = 'Xenova/clip-vit-base-patch32';
const DEFAULT_VECTOR_SIZE = 512;

type TensorLike = {
  data?: ArrayLike<number>;
};

type ImageFeatureExtractor = (
  input: unknown,
  options?: {
    pooling?: 'mean';
    normalize?: boolean;
  },
) => Promise<TensorLike>;

let extractorPromise: Promise<ImageFeatureExtractor> | null = null;

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

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline('image-feature-extraction', getEmbeddingModelName())
      .then((extractor) => extractor as unknown as ImageFeatureExtractor)
      .catch((error) => {
        extractorPromise = null;
        throw error;
      });
  }
  return extractorPromise;
}

export async function generateImageEmbedding(imageBuffer: Buffer) {
  if (!imageBuffer || imageBuffer.byteLength === 0) {
    throw new Error('图片内容为空，无法生成向量');
  }

  const extractor = await getExtractor();
  const imageInput = imageBuffer as unknown as Parameters<typeof RawImage.read>[0];
  const image = await RawImage.read(imageInput);
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
}
