import { ServeGrip } from '@fanoutio/serve-grip';

export const CHANNEL_NAME = 'test';
const PUSHPIN_URL = 'http://localhost:5561/';

export const serveGripMiddleware = new ServeGrip({
    grip: {
        control_uri: PUSHPIN_URL,
    },
});
