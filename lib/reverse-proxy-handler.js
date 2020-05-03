module.exports = (context) => {
    const proxy = context.proxy;
    const handler = (req, res, context) => {
        proxy.web(req, res, {
            target: context.redirect_path,
            ignorePath: context.ignore_path
        });
    };
    return handler;
};