import type { VercelRequest, VercelResponse } from '@vercel/node';

const TARGET = 'https://generativelanguage.googleapis.com';

async function readBody(req: VercelRequest): Promise<Buffer | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const key = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!key) {
      res.status(500).send('Missing GEMINI_API_KEY/API_KEY');
      return;
    }

    const upstreamUrl = `${TARGET}${req.url?.replace(/^\/api\/imagen/, '')}?key=${key}`;
    const body = await readBody(req);

    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json'
      },
      body
    });

    const buffer = Buffer.from(await upstream.arrayBuffer());
    upstream.headers.forEach((value, key) => res.setHeader(key, value));
    res.status(upstream.status).send(buffer);
  } catch (e: any) {
    res.status(500).send(e?.message || 'Proxy error');
  }
}
