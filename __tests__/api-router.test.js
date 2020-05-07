const APIRouter = require("../routes/api/api-router");

const createContext = (routes) => {
    return {
        config: {
            api: routes
        }
    }
};
describe("Testing the configuration router", () => {
    it("should return a router for valid config", () => {
        const routes = [
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
        const router = new APIRouter(createContext(routes));
        expect(router.routes.length).toBe(5);
    });

    it("validate incorrect config", () => {

        expect(() => {
            new APIRouter(createContext([{
                "method": null,
                "handler": "message_queue",
                "queue_name": "test_q"
            }]));
        }).toThrow();

        expect(() => {
            new APIRouter(createContext([{
                "path": "/v1/test",
                "method": 324234,
                "handler": "message_queue",
                "queue_name": "test_q"
            }]));
        }).toThrow();

        expect(() => {
            new APIRouter(createContext([{
                "path": "/v1/test",
                "method": {},
                "handler": "message_queue",
                "queue_name": "test_q"
            }]));
        }).toThrow();

        expect(() => {
            new APIRouter(createContext([{
                "path": "/v1/test",
                "queue_name": "test_q"
            }]));
        }).toThrow();

        expect(() => {
            new APIRouter(createContext([{
                "path": "/v1/test",
                "handler": "message_queue",
            }]));
        }).toThrow();

        expect(() => {
            new APIRouter(createContext([{
                "path": "/v1/test",
                "handler": "reverse_proxy",
            }]));
        }).toThrow();
    });

    it("Should call the message queue handler.", () => {
        const context = {
            logger: { info: jest.fn() }
        };
        const mqHandler = jest.fn();
        const rpHandler = jest.fn();
        const next = jest.fn();
        const res = jest.fn();
        const router = new APIRouter(createContext([
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
        ]));
        router.on("message_queue", mqHandler);
        router.on("reverse_proxy", rpHandler);
        router.middleware({
            path: "/v1/test_1",
            method: "GET"
        }, res, next);
        expect(mqHandler).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining ({
            path: "/v1/test_1"
        }));
        expect(rpHandler).toHaveBeenCalledTimes(0);
        expect(next).toHaveBeenCalledTimes(0);
        router.middleware({
            path: "/v1/test_2",
            method: "GET"
        }, res, next);
        expect(mqHandler).toHaveBeenCalledTimes(1);
        expect(rpHandler).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining ({
            path: "/v1/test_2"
        }));
        expect(next).toHaveBeenCalledTimes(0);
        router.middleware({
            path: "/v1/asdfsd",
            method: "GET"
        }, res, next);
        expect(mqHandler).toHaveBeenCalledTimes(1);
        expect(rpHandler).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledTimes(1);
        router.middleware({
            path: "/v1/test_3_abc",
            method: "GET"
        }, {}, next);
        expect(mqHandler).toHaveBeenCalledTimes(1);
        expect(rpHandler).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining ({
            redirect_path: "http://www.example.com"
        }));
        expect(next).toHaveBeenCalledTimes(1);
    });
});