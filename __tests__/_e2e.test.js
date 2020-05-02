const request = require("supertest");
let app = null;
let server = null;
beforeAll(async () => {
    app = await require("../bootstrap")({
        "__APP__": {
            log_level: "error",
            jwt_secret: "secret"
        },
        "tickets": {
            queue_name: ""
        },
        "api": [
            {
                path: "/v1/test_1",
                handler: "message_queue",
                queue_name: "test_1_q"
            }
        ]
    });
    server = app.listen()
});
describe("End to End Test", () => {
    it("should start the web server", (done) => {
        request(app)
            .get("/heart-beat")
            .expect(200, done);
        request(app)
            .get("/asdf")
            .expect(404, done);
    })
});

afterAll(async (done) => {
    setTimeout(async () => {
        const channel = app.get("amqp_channel");
        const conn = app.get("amqp_connection");
        await channel.close();
        await conn.close();
        await server.close();
        done();
    }, 2000)

});