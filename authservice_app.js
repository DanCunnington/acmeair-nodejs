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
var fs = require('fs');
var settings = JSON.parse(fs.readFileSync('settings.json', 'utf8'));
var util = require('./util/util');

var log4js = require('log4js');

log4js.configure('log4js.json', {});
var logger = log4js.getLogger('authservice_app');
logger.setLevel(settings.loggerLevel);

var port = (process.env.VMC_APP_PORT || process.env.VCAP_APP_PORT || settings.authservice_port);
var host = (process.env.VCAP_APP_HOST || 'localhost');

util.registerService(process.env.SERVICE_NAME, port);

logger.info("host:port=="+host+":"+port);

var dbtype = process.env.dbtype || "mongo";

//Calculate the backend datastore type if run inside BLuemix or cloud foundry
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

// call the packages we need
var express    = require('express'); 		
var app        = express(); 				
var morgan         = require('morgan');
var bodyParser     = require('body-parser');
var cookieParser = require('cookie-parser');

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
app.use(cookieParser()); 

var router = express.Router(); 	
var routes;
var loader;
var initialized = false;
var serverStarted = false;


util.getServiceProxy(function(proxyUrl){
		
	proxy =  (proxyUrl || process.env.PROXY);
	routes = new require('./authservice/routes/index.js')(false,null,proxy,dbtype,settings); 
	loader = new require('./loader/loader.js')(routes, settings);

	router.post('/login', routes.login);
	router.get('/login/logout', routes.logout);
	router.get('/login/authcheck/:tokenid', routes.authcheck);
	router.get('/login/config/countSessions', routes.countCustomerSessions);
	router.get('/login/loader/load', clearSessionDatabase);

	// REGISTER OUR ROUTES so that all of routes will have prefix 
	app.use(settings.authContextRoot, router);


	initDB();
});

function initDB(){
    if (initialized ) return;
	routes.initializeDatabaseConnections(function(error) {
			if (error) {
				logger.error('Error connecting to database - exiting process: '+ error);
				// Do not stop the process for debug in container service
				//process.exit(1); 
			}else
			{
				initialized =true;
				logger.info("Initialized database connections");
			}
			startServer();
	});
}

function clearSessionDatabase(req, res){
	if (!initialized)
     	{
		logger.info("please wait for db connection initialized then trigger again.");
		initDB();
		res.sendStatus(400);
	}else {
		loader.clearSessionDatabase(req, res);
	}
}


function startServer() {
	if (serverStarted ) return;
	serverStarted = true;
	app.listen(port);
	console.log('Application started port ' + port);
}