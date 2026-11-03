function cache({ ttlMs, maxEntries }) {
  let store = new Map();
  return (req, res, next) => {
    // Cache only GET requests
    if (req.method !== "GET") {
      return next();
    }

    // Create a unique key for the request
    const key = req.originalUrl;

    if (store.has(key)) {
      let cache = store.get(key);

      if (Date.now() < cache.expiresAt) {
        store.delete(key);
        store.set(key, cache);

        return res
          .set("X-Cache", "HIT")
          .status(cache.statusCode)
          .json(cache.body);
      }

      // Remove expiry entry
      store.delete(key);
    }

    // Intercept response
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        if (!store.has(key) && store.size >= maxEntries) {
          store.delete(store.keys().next().value);
        }
        store.set(key, {
          body,
          statusCode: res.statusCode,
          expiresAt: Date.now() + ttlMs,
        });
      } // ← store.set এখন এর ভেতরে
      res.set("X-Cache", "MISS"); // ← ২ নম্বর
      return originalJson(body);
    };
    next();
  };
}

app.get(
  "/api/doctors",
  cache({ ttlMs: 30_000, maxEntries: 100 }),
  (req, res) => {
    res.json(getDoctorsFromDb()); // ধরুন এটা ধীর
  },
);
