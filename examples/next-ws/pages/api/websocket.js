import { CHANNEL_NAME, serveGrip } from "../../lib/grip";

export default async (req, res) => {

    if (!(await serveGrip.run(req, res))) {
        return;
    }

    const { method } = req;
    if (method === 'POST') {
        // Websocket-over-HTTP is translated to HTTP POST

        const { wsContext } = req.grip;
        if (wsContext == null) {
            res.statusCode = 400;
            res.end('[not a websocket request]\n');
            return;
        }

        // If this is a new connection, accept it and subscribe it to a channel
        if (wsContext.isOpening()) {
            wsContext.accept();
            wsContext.subscribe(CHANNEL_NAME);
        }

        while (wsContext.canRecv()) {
            const message = wsContext.recv();

            if (message == null) {
                // If return value is undefined then connection is closed
                wsContext.close();
                break;
            }

            // Echo the message
            wsContext.send(message);
        }

        res.end();

    } else {

        console.log("Unknown method", method);
        res.statusCode = 405;
        res.end();

    }

};
