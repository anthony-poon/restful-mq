const request = require("supertest");
const RestMQ = require("../index");
let server = null;
let worker = null;
let express = null;
beforeAll((done) => {
    const config =
        {
            "__APP__": {
                log_level: "DEBUG",
                jwt_secret: "secret",
                reply_queue: "e2e_test_reply_queue"
            },
            "api": [
                {
                    path: "/v1/e2e_test",
                    handler: "message_queue",
                    queue_name: "e2e_test_input_queue"
                }
            ]
        };
    process.env.INPUT_QUEUE = "e2e_test_input_queue";
    process.env.LOG_LEVEL = "debug";
    process.env.MOCK_DELAY = 1000;
    (async () => {
        server = new RestMQ(config);
        await server.start();
        express = server._app;
        worker = require("../bin/basic_message_worker");
        await worker.start();
        done();
    })();
});

describe("End to End Test", () => {
    it("should start the web server", (done) => {
        request(express)
            .get("/heart-beat")
            .expect(200, done);
        request(express)
            .get("/asdf")
            .expect(404, done);
    });

    it("should reject unauthorized request", async (done) => {
        const moment = require("moment");
        const MockDate = require("mockdate");
        await request(express)
            .get(`/tickets/abc`)
            .expect(401);
        await request(express)
            .get(`/tickets/abc`)
            .set("Authorization", `Bearer sdfds`)
            .expect(403);
        done()
    });

    it("should be able to do a async round trip", async (done) => {
        jest.setTimeout(10000);
        const response = await request(express)
            .get("/api/v1/e2e_test?async=true")
            .expect(200);
        const ticketId = response.body.ticket_id;
        const token = response.body.jwt_token;
        await request(express)
            .get(`/tickets/${ticketId}`)
            .set("Authorization", `Bearer ${token}`)
            .expect(200);
        done()
    });

    it("should reject expired async request", async (done) => {
        const moment = require("moment");
        const MockDate = require("mockdate");
        const response = await request(express)
            .get("/api/v1/e2e_test?async=true")
            .expect(200);
        const ticketId = response.body.ticket_id;
        const token = response.body.jwt_token;
        MockDate.set(moment().add(2, "days"));
        await request(express)
            .get(`/tickets/${ticketId}`)
            .set("Authorization", `Bearer ${token}`)
            .expect(404);
        done()
    });

    it("should be able to do a sync round trip", async (done) => {
        let response = await request(express)
            .get("/api/v1/e2e_test")
            .expect(200);
        expect(response).toBeTruthy();
        response = await request(express)
            .post("/api/v1/e2e_test")
            .send({
                'lorem': "ipsum",
            })
            .set('Content-Type', 'application/json')
            .set('Accept', 'application/json')
            .expect(200);
        expect(response).toBeTruthy();
        response = await request(express)
            .post("/api/v1/e2e_test")
            .send("lorem ipsum")
            .set('Content-Type', 'text/plain')
            .set('Accept', 'text/plain')
            .expect(200);
        expect(response).toBeTruthy();
        response = await request(express)
            .post("/api/v1/e2e_test")
            .send("<p>lorem ipsum</p>")
            .set('Content-Type', 'text/html')
            .set('Accept', 'text/plain')
            .expect(200);
        expect(response).toBeTruthy();
        done();
    });
});

afterAll((done) => {
    (async () => {
        await server.stop();
        await worker.stop();
        done()
    })();
});