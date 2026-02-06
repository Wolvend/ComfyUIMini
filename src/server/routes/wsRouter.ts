import WebSocket from 'ws';
import { IncomingMessage } from 'http';
import { Socket } from 'net';
import { generateImage } from '../utils/comfyAPIUtils';
import logger from '../utils/logger';
import { isWsRequestAuthenticated } from '../middleware/authMiddleware';

const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        try {
            const prompt = JSON.parse(message.toString());
            await generateImage(prompt, ws);
        } catch (error) {
            logger.warn(`Failed to handle WebSocket message: ${error}`);
            try {
                ws.send(JSON.stringify({ type: 'error', message: 'Invalid request or generation failed.' }));
            } catch {
                // ignore send failures
            }
        }
    });
});

const handleUpgrade = (request: IncomingMessage, socket: Socket, head: Buffer) => {
    if (!request.url) {
        logger.warn('No url property in WebSocket request.');
        socket.destroy();
        return;
    }
    
    const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

    if (pathname === '/ws') {
        if (!isWsRequestAuthenticated(request)) {
            socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
            socket.destroy();
            return;
        }

        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    } else {
        socket.destroy();
    }
};

export {
    wss,
    handleUpgrade,
};
