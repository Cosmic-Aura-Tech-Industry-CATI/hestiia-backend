class InMemoryCacheStore {
  private store: Map<string, { value: any; expiry: number }> = new Map();

  async get(key: string): Promise<any | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    this.store.set(key, { value, expiry: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async flush(): Promise<void> {
    this.store.clear();
  }
}

export const cache = new InMemoryCacheStore();
export default cache;
