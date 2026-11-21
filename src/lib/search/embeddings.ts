// import { pipeline, env } from '@huggingface/transformers';

// // Skip local check for now to allow downloading from HF
// env.allowLocalModels = false;

// let extractor: any = null;

export async function initEmbeddings() {
  // if (extractor) return extractor;
  // 
  // extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
  //   device: 'webgpu',
  // });
  // return extractor;
  return null;
}

export async function getEmbedding(_text: string): Promise<number[]> {
  // const pipe = await initEmbeddings();
  // const output = await pipe(text, { pooling: 'mean', normalize: true });
  // return Array.from(output.data);
  return [];
}

export function cosineSimilarity(_vecA: number[], _vecB: number[]): number {
  // let dotProduct = 0;
  // let mA = 0;
  // let mB = 0;
  // for (let i = 0; i < vecA.length; i++) {
  //   dotProduct += vecA[i] * vecB[i];
  //   mA += vecA[i] * vecA[i];
  //   mB += vecB[i] * vecB[i];
  // }
  // return dotProduct / (Math.sqrt(mA) * Math.sqrt(mB));
  return 0;
}
