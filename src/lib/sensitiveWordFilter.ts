import fs from 'fs';
import path from 'path';

interface SensitiveWordNode {
  isEnd: boolean;
  children: Map<string, SensitiveWordNode>;
}

let rootNode: SensitiveWordNode | null = null;
let initialized = false;

function createNode(): SensitiveWordNode {
  return {
    isEnd: false,
    children: new Map(),
  };
}

export async function initSensitiveWords(): Promise<void> {
  if (initialized) return;

  const filePath = path.join(process.cwd(), 'public', 'sensitive-words', 'words.txt');

  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const words = content.split('\n').map((w) => w.trim().toLowerCase()).filter(Boolean);

    rootNode = createNode();

    for (const word of words) {
      if (!word) continue;
      let current = rootNode;
      for (const char of word) {
        if (!current.children.has(char)) {
          current.children.set(char, createNode());
        }
        current = current.children.get(char)!;
      }
      current.isEnd = true;
    }

    initialized = true;
    console.log(`[SensitiveWord] Loaded ${words.length} sensitive words`);
  } catch (error) {
    console.error('[SensitiveWord] Failed to load sensitive words:', error);
    rootNode = createNode();
    initialized = true;
  }
}

export function containsSensitive(text: string): string[] {
  if (!initialized || !rootNode) {
    console.warn('[SensitiveWord] Sensitive words not initialized');
    return [];
  }

  const found: string[] = [];
  const normalizedText = text.toLowerCase();

  for (let i = 0; i < normalizedText.length; i++) {
    const result = searchFromPosition(normalizedText, i);
    if (result) {
      found.push(result);
    }
  }

  return [...new Set(found)];
}

function searchFromPosition(text: string, startPos: number): string | null {
  let current = rootNode!;
  let matchEnd = -1;

  for (let i = startPos; i < text.length; i++) {
    const char = text[i];
    const nextNode = current.children.get(char);

    if (!nextNode) {
      break;
    }

    current = nextNode;
    if (current.isEnd) {
      matchEnd = i;
    }
  }

  if (matchEnd >= startPos) {
    return text.slice(startPos, matchEnd + 1);
  }

  return null;
}

export function isSensitiveWord(keyword: string): boolean {
  if (!initialized || !rootNode) {
    return false;
  }

  const normalized = keyword.toLowerCase();
  let current = rootNode;
  let isEnd = true;

  for (const char of normalized) {
    if (!current.children.has(char)) {
      isEnd = false;
      break;
    }
    current = current.children.get(char)!;
  }

  return isEnd && current.isEnd;
}
