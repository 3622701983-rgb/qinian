/* 祈念物语 · 离线缓存
   策略：
   - 导航请求（打开页面）：网络优先，成功后写入缓存；断网时回落到缓存
   - 其余同源静态资源：缓存优先，缺失再走网络
   注意：install 阶段不预缓存 index.html —— 页面本身有 ~44MB，
   预缓存会让首次访问重复下载一遍。首次由浏览器正常加载（HTTP 缓存生效），
   之后由 SW 接管并在响应时顺手缓存，实现「打开过一次就能离线用」。
*/
var CACHE = 'qinian-v12-20261026';
var PRECACHE = [
  './manifest.webmanifest',
  './icon-192.png',
  './icon-180.png'
];

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.all(PRECACHE.map(function (u) {
        return cache.add(u).catch(function () {});
      }));
    }).catch(function () {})
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.map(function (n) {
        return n === CACHE ? null : caches.delete(n);
      }));
    }).then(function () {
      return self.clients.claim();
    }).catch(function () {})
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  /* 导航：网络优先 + 缓存兜底 */
  if (req.mode === 'navigate') {
    event.respondWith((async function () {
      try {
        var fresh = await fetch(req);
        try {
          var cache = await caches.open(CACHE);
          cache.put('./index.html', fresh.clone()).catch(function () {});
        } catch (e) {}
        return fresh;
      } catch (err) {
        var cache2 = await caches.open(CACHE);
        var hit = (await cache2.match('./index.html')) || (await cache2.match('./'));
        if (hit) return hit;
        throw err;
      }
    })());
    return;
  }

  /* 其它同源资源：缓存优先 */
  event.respondWith((async function () {
    var cache = await caches.open(CACHE);
    var hit = await cache.match(req);
    if (hit) return hit;
    try {
      var res = await fetch(req);
      if (res && res.ok) cache.put(req, res.clone()).catch(function () {});
      return res;
    } catch (err) {
      if (hit) return hit;
      throw err;
    }
  })());
});
