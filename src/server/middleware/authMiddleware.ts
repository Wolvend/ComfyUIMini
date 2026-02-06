import config from 'config';
import type { Request, Response, NextFunction } from 'express';
import type { IncomingHttpHeaders, IncomingMessage } from 'http';

export const AUTH_COOKIE_NAME = 'comfyui_mini_token';

export function getRequiredAccessToken(): string | null {
    if (!config.has('access_token')) {
        return null;
    }

    const token = config.get<string>('access_token');

    if (!token || typeof token !== 'string' || token.trim() === '') {
        return null;
    }

    return token.trim();
}

function getTokenFromAuthorizationHeader(authHeader: string | undefined): string | null {
    if (!authHeader) {
        return null;
    }

    const lower = authHeader.toLowerCase();
    if (!lower.startsWith('bearer ')) {
        return null;
    }

    return authHeader.slice('bearer '.length).trim() || null;
}

function getCookieFromHeader(cookieHeader: string | undefined, cookieName: string): string | null {
    if (!cookieHeader) {
        return null;
    }

    const parts = cookieHeader.split(';');
    for (const part of parts) {
        const [rawName, ...rest] = part.trim().split('=');
        if (!rawName || rest.length === 0) {
            continue;
        }

        if (rawName !== cookieName) {
            continue;
        }

        const rawValue = rest.join('=');
        try {
            return decodeURIComponent(rawValue);
        } catch {
            return rawValue;
        }
    }

    return null;
}

function getTokenFromHeaders(headers: IncomingHttpHeaders): string | null {
    // Prefer explicit headers over cookies.
    const fromAuth = getTokenFromAuthorizationHeader(headers['authorization']);
    if (fromAuth) {
        return fromAuth;
    }

    const fromCustom = typeof headers['x-comfyuimini-token'] === 'string' ? headers['x-comfyuimini-token'] : null;
    if (fromCustom && fromCustom.trim() !== '') {
        return fromCustom.trim();
    }

    const cookieHeader = typeof headers['cookie'] === 'string' ? headers['cookie'] : undefined;
    return getCookieFromHeader(cookieHeader, AUTH_COOKIE_NAME);
}

export function isRequestAuthenticated(req: Request): boolean {
    const required = getRequiredAccessToken();

    if (!required) {
        return true;
    }

    const provided = getTokenFromHeaders(req.headers);
    return provided === required;
}

export function isWsRequestAuthenticated(request: IncomingMessage): boolean {
    const required = getRequiredAccessToken();

    if (!required) {
        return true;
    }

    // Allow query token for non-browser WS clients.
    if (request.url) {
        try {
            const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
            const token = url.searchParams.get('token');
            if (token && token.trim() !== '') {
                return token.trim() === required;
            }
        } catch {
            // ignore and fall back to header/cookie parsing
        }
    }

    const provided = getTokenFromHeaders(request.headers);
    return provided === required;
}

export default function requireAuth(req: Request, res: Response, next: NextFunction) {
    if (isRequestAuthenticated(req)) {
        next();
        return;
    }

    res.status(401).json({ error: 'Unauthorized' });
}
