export interface SpatialEntry<T> {
  id: number;
  x: number;
  z: number;
  item: T;
}

export class SpatialHashGrid<T> {
  private cellSize: number;
  private buckets: Map<string, SpatialEntry<T>[]>;

  constructor(cellSize: number = 25) {
    this.cellSize = cellSize;
    this.buckets = new Map();
  }

  private getKey(x: number, z: number): string {
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    return `${cx}:${cz}`;
  }

  public clear(): void {
    this.buckets.clear();
  }

  public insert(id: number, x: number, z: number, item: T): void {
    const key = this.getKey(x, z);
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = [];
      this.buckets.set(key, bucket);
    }
    bucket.push({ id, x, z, item });
  }

  public queryRadius(x: number, z: number, radius: number): SpatialEntry<T>[] {
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCz = Math.floor((z - radius) / this.cellSize);
    const maxCz = Math.floor((z + radius) / this.cellSize);

    const radiusSq = radius * radius;
    const results: SpatialEntry<T>[] = [];

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const key = `${cx}:${cz}`;
        const bucket = this.buckets.get(key);
        if (bucket) {
          for (let i = 0; i < bucket.length; i++) {
            const entry = bucket[i];
            const dx = entry.x - x;
            const dz = entry.z - z;
            if (dx * dx + dz * dz <= radiusSq) {
              results.push(entry);
            }
          }
        }
      }
    }
    return results;
  }

  public queryNearest(x: number, z: number, maxRadius: number): SpatialEntry<T> | null {
    const candidates = this.queryRadius(x, z, maxRadius);
    if (candidates.length === 0) return null;

    let nearest: SpatialEntry<T> | null = null;
    let nearestDistSq = Infinity;

    for (let i = 0; i < candidates.length; i++) {
      const entry = candidates[i];
      const dx = entry.x - x;
      const dz = entry.z - z;
      const distSq = dx * dx + dz * dz;
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearest = entry;
      }
    }

    return nearest;
  }
}
