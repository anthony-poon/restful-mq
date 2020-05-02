"use strict";
const _ = require('lodash');

const middleware = (req, res, next) => {
    const match = _.find(middleware.routes, (routeProps) => {
        const isMethodMatch = routeProps.methods[0] === "all" || routeProps.methods.includes(req.method.toLowerCase());
        if (!isMethodMatch) {
            return false;
        }
        switch (routeProps.match_type) {
            case "exact":
                return routeProps.path === req.path;
            case "regex":
                const regex = new RegExp(routeProps.path);
                return regex.exec(req.path)
        }
    });
    if (match) {
        const handler = middleware.listener[match.handler];
        if (handler) {
            handler(req, res, match);
        }
    } else {
        next();
    }
};

middleware.routes = [];

middleware.setRoutes = (routes) => {
    middleware.routes = [];
    _.forEach(routes, (routeProps, index) => {
        const rtn = {};

        if (!routeProps.path && typeof routeProps.path !== "string") {
            throw new Error("Invalid path in route #" + index.toString());
        }
        rtn.path = routeProps.path;

        rtn.match_type = !!routeProps.match_type && ["exact", "regex"].includes(routeProps.match_type.toLowerCase()) ?
            routeProps.match_type.toLowerCase() : "exact";

        // Method props in the config can be an array, string or falsy. Convert all to array and lower case
        if (Array.isArray(routeProps.method)) {
            rtn.methods = _.map(routeProps.method, m => m.toLowerCase());
        } else {
            rtn.methods = [ !routeProps.method ? "all" : routeProps.method.toLowerCase() ];
        }
        // If somehow the array contain multiple element and include "all", convert to a single element array
        rtn.methods = rtn.methods.includes("all") ? ["all"] : rtn.methods;
        if (!routeProps.handler || !["message_queue", "reverse_proxy"].includes(routeProps.handler.toLowerCase())) {
            throw new Error("Invalid route handler at route " + routeProps.path);
        }
        rtn.handler = routeProps.handler.toLowerCase();
        if (rtn.handler === "message_queue") {
            if (!routeProps["queue_name"]) {
                throw new Error("Must specify queue_name when using message_queue handler.");
            }
            rtn["queue_name"] = routeProps["queue_name"]
        }
        if (rtn.handler === "reverse_proxy") {
            if (!routeProps["redirect_path"]) {
                throw new Error("Must specify redirect_path when using reverse_proxy handler.");
            }
            rtn["redirect_path"] = routeProps["redirect_path"];
            rtn["ignore_path"] = !!routeProps["ignore_path"];
        }
        middleware.routes.push(rtn);
    });
    return middleware;
};

middleware.clearRoutes = () => {
    middleware.routes = []
};

middleware.listener = [];

middleware.on = (handlerName, handler) => {
    middleware.listener[handlerName] = handler
};

module.exports = middleware;