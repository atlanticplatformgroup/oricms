import fs from 'fs/promises';
import path from 'path';

export async function readJsonFiles<T>(directory: string): Promise<T[]> {
  try {
    const files = await fs.readdir(directory);
    const loaded = await Promise.all(
      files
        .filter((file) => file.endsWith('.json'))
        .map(async (file) => {
          const content = await fs.readFile(path.join(directory, file), 'utf-8');
          return JSON.parse(content) as T;
        }),
    );
    return loaded;
  } catch {
    return [];
  }
}
