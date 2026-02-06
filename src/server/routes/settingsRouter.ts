import express from 'express';
import cookieParser from 'cookie-parser';
import { AUTH_COOKIE_NAME, getRequiredAccessToken, isRequestAuthenticated } from '../middleware/authMiddleware';

const router = express.Router();

router.use(express.json());
router.use(cookieParser());

router.get('/theme', async (req, res) => {
    const requestTheme = req.query.theme;

    if (!requestTheme || typeof requestTheme !== 'string') {
        res.status(400).send({ error: 'Theme name not set or invalid.' });
        return;
    }

    const themesList = ['dark', 'light', 'midnight', 'whiteout', 'aurora', 'nord', 'conifer'];

    if (themesList.includes(requestTheme)) {
        res.cookie('theme', requestTheme, {
            maxAge: 1000 * 60 * 60 * 24 * 365,
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
        });

        res.status(200).send(`Theme set to ${requestTheme}.`);
    } else {
        res.status(400).send('Invalid theme name.');
    }
});

router.get('/galleryitemsperpage', async (req, res): Promise<void> => {
    const requestCount = Number(req.query.count);

    if (isNaN(requestCount) || requestCount < 1) {
        res.status(400).send({ error: 'Invalid number, must be a valid integer greater than 0.' });
        return;
    }

    res.cookie('galleryItemsPerPage', requestCount.toString(), {
        maxAge: 1000 * 60 * 60 * 24 * 365,
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
    });

    res.json({ message: `Set gallery items per page to ${requestCount}` });
});

router.get('/auth', (req, res) => {
    const required = getRequiredAccessToken();

    res.json({
        enabled: Boolean(required),
        authenticated: isRequestAuthenticated(req),
    });
});

router.post('/auth', (req, res) => {
    const required = getRequiredAccessToken();

    if (!required) {
        res.status(400).json({ error: 'Access token is not enabled on the server.' });
        return;
    }

    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';

    if (!token) {
        res.status(400).json({ error: 'Token is required.' });
        return;
    }

    if (token !== required) {
        res.status(401).json({ error: 'Invalid token.' });
        return;
    }

    // Store token in httpOnly cookie so images and WebSocket can authenticate without JS headers.
    res.cookie(AUTH_COOKIE_NAME, token, {
        maxAge: 1000 * 60 * 60 * 24 * 30,
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
    });

    res.json({ message: 'Authenticated.' });
});

router.delete('/auth', (req, res) => {
    res.clearCookie(AUTH_COOKIE_NAME);
    res.json({ message: 'Logged out.' });
});

export default router;
