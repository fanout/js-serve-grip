import { ConnectGrip } from "@fanoutio/connect-grip";

export const CHANNEL_NAME = 'test';
const PUSHPIN_URL = "http://localhost:5561/";

export const connectGrip = new ConnectGrip({
    gripProxies: [{
        control_uri: PUSHPIN_URL,
    }],
});
