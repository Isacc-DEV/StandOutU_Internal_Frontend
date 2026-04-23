# StandOutU Internal Frontend

## Development

1. Copy `.env.local.example` to `.env.local`.
2. Set the frontend URL and API settings for your environment.
3. Run `npm run dev`.

The dev server now binds to `0.0.0.0`, so if the machine's public IP is `89.117.21.252` and `PORT=3000`, you can open:

- `http://89.117.21.252:3000`

## Same-host backend setup

If the frontend and backend run on the same machine:

- frontend: `PORT=3000`
- backend: `PORT=4000`
- leave `NEXT_PUBLIC_API_BASE` commented out
- set `NEXT_PUBLIC_API_PORT=4000`

The frontend will automatically call `http://<current-host>:4000`.

## Explicit remote API setup

If the API lives on a different host, set:

```env
NEXT_PUBLIC_API_BASE=http://your-api-host:4000
```

## Example for `89.117.21.252`

Frontend `.env.local`:

```env
PORT=3000
NEXT_PUBLIC_API_PORT=4000
NEXTAUTH_URL=http://89.117.21.252:3000
# Optional if you want to be explicit for Next dev asset access:
# ALLOWED_DEV_ORIGINS=89.117.21.252
```

Backend `.env`:

```env
HOST=0.0.0.0
PORT=4000
PUBLIC_API_URL=http://89.117.21.252:4000
FRONTEND_URL=http://89.117.21.252:3000
CORS_ORIGINS=http://89.117.21.252:3000
```
