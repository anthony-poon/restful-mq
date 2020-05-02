
beforeEach(() => {
    jest.resetModules();
});

describe("Testing the configuration router", () => {
    it("should return a router for valid config", () => {
        const router = require("../lib/configurable-router");
        const config = [
            {
                "path": "/v1/test_1",
                "method": null,
                "handler": "message_queue",
                "queue_name": "test_q"
            },{
                "path": "/v1/test_2",
                "method": "GET",
                "handler": "message_queue",
                "queue_name": "test_q"
            },{
                "path": "/v1/test_3",
                "method": "put",
                "handler": "message_queue",
                "queue_name": "test_q"
            },{
                "path": "/v1/test_4",
                "method": ["POST", "DELETE"],
                "handler": "message_queue",
                "queue_name": "test_q"
            },{
                "path": "/v1/test_5",
                "method": ["POST", "DELETE"],
                "handler": "reverse_proxy",
                "redirect_path": "http://www.example.com"
            }
        ];
        router.setRoutes(config);
        expect(router.routes.length).toBe(5);
    });

    it("should have correct routes", () => {
        const router = require("../lib/configurable-router");
        router.setRoutes([{
            "path": "/v1/test",
            "method": null,
            "handler": "message_queue",
            "queue_name": "test_q"
        }]);
        expect(router.routes[0]).toMatchObject({
            "path": "/v1/test",
            "methods": ["all"],
            "handler": "message_queue",
            "queue_name": "test_q"
        });
        router.setRoutes([{
            "path": "/v1/test",
            "method": ["GET", "post"],
            "handler": "message_queue",
            "queue_name": "test_q"
        }]);
        expect(router.routes[0]).toMatchObject({
            "path": "/v1/test",
            "methods": ["get", "post"],
            "handler": "message_queue",
            "queue_name": "test_q"
        });
        router.setRoutes([{
            "path": "/v1/test",
            "method": "pUt",
            "handler": "message_queue",
            "queue_name": "test_q"
        }]);
        expect(router.routes[0]).toMatchObject({
            "path": "/v1/test",
            "methods": ["put"],
            "handler": "message_queue",
            "queue_name": "test_q"
        });
        router.setRoutes([{
            "path": "/v1/test",
            "method": "delete",
            "handler": "reverse_proxy",
            "redirect_path": "http://www.exmaple.com"
        }]);
        expect(router.routes[0]).toMatchObject({
            "path": "/v1/test",
            "methods": ["delete"],
            "handler": "reverse_proxy",
            "ignore_path": false,
            "redirect_path": "http://www.exmaple.com"
        });
        router.clearRoutes();
    });

    it("validate incorrect config", () => {
        const router = require("../lib/configurable-router");
        expect(() => {
            router.setRoutes([{
                "method": null,
                "handler": "message_queue",
                "queue_name": "test_q"
            }]);
        }).toThrow();

        expect(() => {
            router.setRoutes([{
                "path": "/v1/test",
                "method": 324234,
                "handler": "message_queue",
                "queue_name": "test_q"
            }]);
        }).toThrow();

        expect(() => {
            router.setRoutes([{
                "path": "/v1/test",
                "method": {},
                "handler": "message_queue",
                "queue_name": "test_q"
            }]);
        }).toThrow();

        expect(() => {
            router.setRoutes([{
                "path": "/v1/test",
                "queue_name": "test_q"
            }]);
        }).toThrow();

        expect(() => {
            router.setRoutes([{
                "path": "/v1/test",
                "handler": "message_queue",
            }]);
        }).toThrow();

        expect(() => {
            router.setRoutes([{
                "path": "/v1/test",
                "handler": "reverse_proxy",
            }]);
        }).toThrow();
    });

    it("Should call the message queue handler.", () => {
        const mqHandler = jest.fn();
        const rpHandler = jest.fn();
        const next = jest.fn();
        const res = jest.fn();
        const router = require("../lib/configurable-router");
        router.setRoutes([
            {
                "path": "/v1/test_1",
                "handler": "message_queue",
                "queue_name": "test_q"
            },{
                "path": "/v1/test_2",
                "handler": "reverse_proxy",
                "redirect_path": "http://www.example.com"
            },{
                "path": "\\/v1\\/test_3_[\\w]+",
                "match_type": "regex",
                "handler": "reverse_proxy",
                "redirect_path": "http://www.example.com"
            },
        ]);
        router.on("message_queue", mqHandler);
        router.on("reverse_proxy", rpHandler);
        router({
            path: "/v1/test_1"
        }, res, next);
        expect(mqHandler).toHaveBeenCalledTimes(1);
        expect(rpHandler).toHaveBeenCalledTimes(0);
        expect(next).toHaveBeenCalledTimes(0);
        router({
            path: "/v1/test_2"
        }, res, next);
        expect(mqHandler).toHaveBeenCalledTimes(1);
        expect(rpHandler).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledTimes(0);
        router({
            path: "/v1/asdfsd"
        }, res, next);
        expect(mqHandler).toHaveBeenCalledTimes(1);
        expect(rpHandler).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledTimes(1);
        router({
            path: "/v1/test_3_abc"
        }, {}, next);
        expect(mqHandler).toHaveBeenCalledTimes(1);
        expect(rpHandler).toHaveBeenCalledTimes(2);
        expect(next).toHaveBeenCalledTimes(1);
    });
});