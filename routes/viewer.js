const express = require('express');
const { getViewerToken, translateObject, getManifest, urnify } = require('../services/apsService');

let router = express.Router();

/**
 * Get viewer token for client-side operations
 */
router.get('/token', async function (req, res, next) {
    try {
        res.json(await getViewerToken());
    } catch (err) {
        next(err);
    }
});

/**
 * Get translation status for a model
 */
router.get('/:urn/status', async function (req, res, next) {
    try {
        const manifest = await getManifest(req.params.urn);
        if (manifest) {
            let messages = [];
            if (manifest.derivatives) {
                for (const derivative of manifest.derivatives) {
                    messages = messages.concat(derivative.messages || []);
                    if (derivative.children) {
                        for (const child of derivative.children) {
                            messages.concat(child.messages || []);
                        }
                    }
                }
            }
            res.json({ status: manifest.status, progress: manifest.progress, messages });
        } else {
            res.json({ status: 'n/a' });
        }
    } catch (err) {
        next(err);
    }
});

/**
 * Start translation for a model
 */
router.post('/:urn/translate', async function (req, res, next) {
    try {
        const result = await translateObject(req.params.urn, req.body.rootFilename);
        res.json(result);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
