import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';

const app = createApp(loadConfig({ NODE_ENV: 'test' }));

describe('health', () => {
  it('returns ok without exposing configuration', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', service: 'reliefmesh-api', network: 'devnet' });
  });

  it('returns the contract error shape for unknown routes', async () => {
    const res = await request(app).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.request_id).toMatch(/^req_/);
  });

  it('rejects malformed JSON with INVALID_INPUT', async () => {
    const res = await request(app)
      .post('/api/v1/health')
      .set('content-type', 'application/json')
      .send('{bad');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_INPUT');
  });
});

describe('config', () => {
  it('refuses production mode', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/out of scope/);
  });
});
