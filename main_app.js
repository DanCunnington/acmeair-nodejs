/*******************************************************************************
* Copyright (c) 2015 IBM Corp.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*    http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*******************************************************************************/

var express = require('express')
  , http = require('http')
  , fs = require('fs')
  , log4js = require('log4js')
  , request = require('request')
  , debug = require('debug')('main');

var settings = JSON.parse(fs.readFileSync('settings.json', 'utf8'));
var util = require('./util/util');


log4js.configure('log4js.json', {});
var logger = log4js.getLogger('main_app');
logger.setLevel(settings.loggerLevel);

// disable process.env.PORT for now as it cause problem on mesos slave
var port = (process.env.VMC_APP_PORT || process.env.VCAP_APP_PORT || settings.main_port);
var host = (process.env.VCAP_APP_HOST || 'localhost');

util.registerService(process.env.SERVICE_NAME, port);

logger.info("host:port=="+host+":"+port);

var dbtype = process.env.dbtype || "mongo";

// Calculate the backend datastore type if run inside BLuemix or cloud foundry
if(process.env.VCAP_SERVICES){
	var env = JSON.parse(process.env.VCAP_SERVICES);
      	logger.info("env: %j",env);
	var serviceKey = Object.keys(env)[0];
	if (serviceKey && serviceKey.indexOf('cloudant')>-1)
		dbtype="cloudant";
	else if (serviceKey && serviceKey.indexOf('redis')>-1)
		dbtype="redis";
}
logger.info("db type=="+dbtype);

var routes;
//var loader = new require('./loader/loader.js')(routes, settings);

// Setup express with 4.0.0

var app = express();
var morgan         = require('morgan');
var bodyParser     = require('body-parser');
var methodOverride = require('method-override');
var cookieParser = require('cookie-parser');
var restCtxRoot = settings.mainContextRoot;
var ctxRoot = restCtxRoot.substring(0,restCtxRoot.indexOf("/",restCtxRoot.indexOf("/")+1));

app.use(ctxRoot,express.static(__dirname + '/public'));     	// set the static files location /public/img will be /img for users

if (settings.useDevLogger)
	app.use(morgan('dev'));                     		// log every request to the console

//create application/json parser
var jsonParser = bodyParser.json();
// create application/x-www-form-urlencoded parser
var urlencodedParser = bodyParser.urlencoded({ extended: false });

app.use(jsonParser);
app.use(urlencodedParser);
//parse an HTML body into a string
app.use(bodyParser.text({ type: 'text/html' }));

app.use(methodOverride());                  			// simulate DELETE and PUT
app.use(cookieParser());                  				// parse cookie

var router = express.Router(); 		
//Only initialize DB after initialization of the authService is done
var serverStarted = false;

// config/load
util.getServiceProxy(function(proxyUrl){
	routes = new require('./main/routes/index.js')(proxyUrl,dbtype, settings);
	router.get('/config/runtime', routes.getRuntimeInfo);
	router.get('/config/dataServices', routes.getDataServiceInfo);
	router.get('/config/activeDataService', routes.getActiveDataServiceInfo);
	
	// ?
	router.get('/checkstatus', checkStatus);

	//REGISTER OUR ROUTES so that all of routes will have prefix 
	app.use(settings.mainContextRoot, router);
	
	startServer();
	
});





function checkStatus(req, res){
	res.sendStatus(200);
}

function startServer() {
	if (serverStarted ) return;
	serverStarted = true;
	app.listen(port);   
	console.log("Express server listening on port " + port);
}
