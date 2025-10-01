/// <reference types="@fastly/js-compute" />
import { createFanoutHandoff } from 'fastly:fanout';
import { createMiddleware } from 'hono/factory';

import { Variables } from '../ServeGrip.js';

type Env = {
    Variables: Variables,
};

export const fanoutSelfHandoffMiddleware =
    (backend: string = 'self') => createMiddleware<Env>(async (c, next) => {
        if (!c.var.grip.isProxied) {
            c.res = undefined;
            c.res = createFanoutHandoff(c.req.raw, backend);
            return;
        }
        await next();
    });
