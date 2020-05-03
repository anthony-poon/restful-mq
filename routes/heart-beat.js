const express = require('express');



module.exports = () => {
    const router = express.Router();
    router.get("/", (req, res, next) => {
        res.json({
            reply: "beep"
        });
    });
    return router;
};