exports.applyMiddlewares = async function applyMiddlewares(msg, cfg, middlewares) {
    if (!middlewares.length) {
        return {
            msg,
            cfg
        }
    }

    let newMsg = msg;
    let newCfg = cfg;

    for (const middleware of middlewares) {
        let {newMsg: msg, newCfg: cfg} = await middleware(newMsg, newCfg);
    }

    return {
        msg: newMsg,
        cfg: newCfg
    }
}
