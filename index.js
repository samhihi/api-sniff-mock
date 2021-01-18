const fs = require('fs');
const url = require('url');
const request = require('request');

let config = {
    remote: '', // remote api base url arr,
    root: './apiMock', // local mock api root
    route: '/api',  // target api path. accepts string(only match the start), regular expression, function
    useVirtualRoute: false, // if set true, the request path exculde 'route' param value
    silence: false // if value is true, then no conolse log
};

/**
 *  verify path function factory
 * @path url path. accepts string, regular expression, function
 * @return a path verify function
 * */

function  verifyPathFactory(route){
    let fn;
    if( typeof route === 'string'){
        fn = function(){
            return function(path){ // match from the beginning
                return path.indexOf(route) === 0;
            };
        }(route);
    } else if (route instanceof RegExp) {
        fn =  function(){
            return function(path){
                return route.test(path);
            };
        }(route);
    }else if (typeof route === 'function') {
        fn =  route;
    }

    if (fn) {
        return fn;
    }

    throw new Error('>>> [api-sniff-mock] config error <<< ', ' invalid path params,  please check the configuration');
}

// parse url string
function parseUrl(urlStr) {
    if (!urlStr) return {pathname: '', path: ''};
    return url.parse(urlStr, true);
}

// derive the  actual path
function getUrlPath(urlStr, hasSearchVar) {
    const urlObj = parseUrl(urlStr);
    let path = (hasSearchVar ?  urlObj.path : urlObj.pathname) || '';

    if (config.useVirtualRoute) {
        path = path.replace(config.route, '');
    }
    return path;
}

// return mock file path
function getMockFilePath (url) {
    if (!url || !config.root) return '';

    return config.root + getUrlPath(url) + '.js';

}

// middleware handler
function handleLocalMock(req, res){

    logger('>>> [api-sniff-mock] local request accessed <<<',  ' request url: ' + req.url);

    const reqBody = [];
    let reqBodyLen = 0;

    req.on('data', function(chunk){
        reqBody.push(chunk);
        reqBodyLen += chunk.length;
    });

    req.on('end', function(){
        const bodyStr = Buffer.concat(reqBody, reqBodyLen).toString();

        try{
            req.bodyData = JSON.parse(bodyStr);
        } catch(err){
            req.bodyData = bodyStr;
        }
        req.queryData = parseUrl(req.url).query || {};

        res.setHeader('Content-Type', 'application/json');

        req.on('error', (err) => {
            handleErr (err, res)
        });

        localMock(req, res);
    });
}

// handle response data across the mock file
function localMock(req, res){

    const localMockFilePath = getMockFilePath(req.url);

    fs.readFile(localMockFilePath, function(err, file){
        if( err ){
            err.statusCode = 404;
            handleErr (err, res)
            return;
        }

        try{
            // create mock function with mock file
            var mockFn = new Function('req', 'res', 'callback', file.toString());

            // run mock function
            mockFn(req, res, function(ret){
                res.statusCode = 200;
                res.end(JSON.stringify(ret));
            });
        } catch(err){
            err.statusCode = 500;
            handleErr (err, res);
        }
    });
}


function handleErr (err, res) {
    logger('>>> [api-sniff-mock] catch error <<<',  '  code: ' +  err.code || '',  ' ; message: ' +  err.message || '');

    res.statusCode = err.statusCode || 500;

    res.end(JSON.stringify({
        code:  err.code || '',
        message: err.message || ''
    }));
}


function handleRemoteRequest(req, res) {
    const url = config.remote + getUrlPath(req.url, true);
    logger('>>> [api-sniff-mock] remote request accessed <<<',  ' request url: ' + url);

    req.pipe(request({
        method: req.method,
        url: url,
        rejectUnauthorized: false,
        requestCert: false,
        agent: false
    }).on('error', function (err) {
        handleErr(err, res);
    })).pipe(res);
}

function logger() {
    if (!config.silence)  console.log && console.log.apply(null, arguments);
}

module.exports = function(cusConfig){

    Object.assign(config,  cusConfig);

    const verifyPathFn = verifyPathFactory(config.route);

    logger('>>> [api-mock-sniffer] inited <<<');

    return function (req, res, next){
        const reqPath = parseUrl(req.url).path;

        if( !verifyPathFn(reqPath) ){// request url path match
            next();
            return;
        }

        let localMode = true; // flag mode

        const localMockFilePath = getMockFilePath(req.url);

        if (!localMockFilePath) {
            localMode = false;
        } else if(!fs.existsSync(localMockFilePath)) {
            localMode = false;
        }

        if (!localMode) {
            handleRemoteRequest(req, res);
            return;
        }

        handleLocalMock(req, res);

    };
};

