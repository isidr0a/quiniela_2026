# Cloudflare Worker para resultados

Proxy CORS para consultar Football-Data sin exponer el token en GitHub Pages.

## Despliegue

Desde `worker/`:

```bash
npx wrangler login
npx wrangler secret put FOOTBALL_DATA_TOKEN
npx wrangler deploy
```

El rate limit queda configurado en `wrangler.toml`:

```text
60 requests por minuto por IP para /results
```

Requiere Wrangler `4.36.0` o superior para el binding nativo de rate limiting. Si `namespace_id = "2026001"` ya existe en otro Worker de tu cuenta, cambialo por otro entero unico.

Cloudflare imprimira una URL similar a:

```text
https://quiniela-2026-results.<tu-subdominio>.workers.dev
```

Configura el frontend en `src/config.js`:

```js
footballDataWorkerUrl: "https://quiniela-2026-results.<tu-subdominio>.workers.dev/results",
```

No subas el token a `src/config.js`; ese archivo es publico en GitHub Pages.

## Endpoints

- `GET /health`
- `GET /results`

`/results` devuelve:

```json
{
  "source": "Football-Data Worker",
  "competition": "WC",
  "updatedAt": "2026-06-14T00:00:00.000Z",
  "matches": [
    {
      "homeTeam": "Germany",
      "awayTeam": "Curaçao",
      "home": 7,
      "away": 1,
      "status": "finished",
      "updatedAt": "2026-06-14T19:03:57Z"
    }
  ]
}
```
