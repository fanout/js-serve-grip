/// <reference types="@fastly/js-compute" />
import { createFanoutHandoff } from 'fastly:fanout';
import { createMiddleware } from 'hono/factory';

export const fanoutSelfHandoffMiddleware =
    (backend: string = 'self') => createMiddleware(async (c, next) => {
        if (!c.req.raw.headers.has('Grip-Sig')) {
            c.res = undefined;
            c.res = createFanoutHandoff(c.req.raw, backend);
            return;
        }
        await next();
    });
