# consolecheat free

Free PlayStation games and demos, every store region. One title opens PlayStation checkout. The cookie run adds the whole free list.

The site is meant to live at `free.consolecheat.com` later. Until that DNS record exists it is served from GitHub Pages.

## Cart worker

`worker/worker.js` is a Cloudflare Worker with no dependencies. Paste it under Workers → Edit code and deploy. Then put that URL into `WORKER_URL` in `src/cart.ts` and push again.

The worker only accepts SKUs that are in the published catalog, and it does not store the cookie.
