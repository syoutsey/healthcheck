var http = require("http");
var express = require("express");
var async = require('async');
var fs = require('fs');

var _healthprog;
var _endpointsFile = __dirname + '/endpoints.json';
var _port = 8000;
var _timeout = 15000 // timeout, in milliseconds

var server = express();
server.use(express.bodyParser()); // allow us to parse POST body
server.use(express.static(__dirname + '/public'));

server.get('/endpoints', function(req, res) {
    var endpoints = JSON.parse(fs.readFileSync(_endpointsFile, {'encoding' : 'utf8' }));
    res.send(JSON.stringify(endpoints));
    res.end();
});

server.post('/endpoints', function(req, res) {
    var post = req.body;
    var endpoints = JSON.parse(fs.readFileSync(_endpointsFile, {'encoding' : 'utf8' }));
    var newURL = true;
    async.each(endpoints, function(endp, callback) {
        if (endp.endpoint == post.name)
        {
            // delete value
            if (post.value == '')
            {
                var index = endpoints.indexOf(endp);
                if (index > -1) {
                    endpoints.splice(index, 1);
                }
            }
            else
                endp.endpoint = post.value; // trade in new value from client

            newURL = false;
        }
    });
    // create new URL and add it to file
    if (newURL == true)
    {
        var obj = {};
        obj.endpoint = post.value;
        endpoints.push(obj);
    }

    fs.writeFileSync(_endpointsFile, JSON.stringify(endpoints));

    res.send(200);
    res.end();
});

server.get("/healthcheck", function(req, res) {
	_healthprog = 0;
	var urlarr = [];
    var endpoints = JSON.parse(fs.readFileSync(_endpointsFile, {'encoding' : 'utf8' }));	

	var total_urls = endpoints.length;
	console.log('Total URLS in health check: ' + total_urls);

	async.each(endpoints, function(health_url, callback) { //The second argument (callback) is the "task callback" for a specific messageId
		// don't need to 'bundle up' the http request here because we only care about status code
        var request = http.request(health_url.endpoint, function(resp) { }
        	).on('response', function(resp) {
        	var obj = {};
        	obj.status = resp.statusCode.toString();
        	obj.url = health_url.endpoint;
        	urlarr.push(obj);
        	_healthprog += 1/total_urls;
        	request.abort();
        }).on('error', function(err) {
        	if (err.code !== 'ECONNRESET' && err.code !== 'ECONNREFUSED')
        		console.log('ERROR: ' + err);
            if (err.code === 'ECONNREFUSED')
            {
                var obj = {};
                obj.status = 404;
                obj.url = health_url.endpoint;
                urlarr.push(obj);
                _healthprog += 1/total_urls;
            }
        	request.abort();
    	}).on('close', function(err) {
	        callback();
    	});
    	request.setTimeout(_timeout, function() {
    		var obj = {};
        	obj.status = 'TIMEOUT';
        	obj.url = health_url.endpoint;
        	urlarr.push(obj);

    		request.abort();
    	});
	    request.setMaxListeners(0);
        request.setHeader('Connection', 'close');
       	request.end();
    }, function(err) {
        if (err) return next(err);
        console.log('Completed health check');
        var msg = {};
        msg.arr = urlarr;

        // Uncomment the following line to test locally
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(JSON.stringify(msg));
        res.end();
    });
});

server.get("/healthprog", function(req, res) {
    var msg = {};
    msg.prog = _healthprog;
    // Uncomment the following line to test locally
    // res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(msg);
    res.end();
});

server.listen(_port);