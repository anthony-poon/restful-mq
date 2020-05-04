const ApplicationContext = require("./application-context");
const httpProxy = require("http-proxy");
class ReverseProxyHandler extends ApplicationContext {
    constructor(context = {}) {
        super(context);
        const proxy = httpProxy.createProxyServer()
        this.middleware = (req, res, context) => {
            proxy.web(req, res, {
                target: context.redirect_path,
                ignorePath: context.ignore_path
            });
        };
        this.middleware.bind(this);
    }
}

module.exports = ReverseProxyHandler;