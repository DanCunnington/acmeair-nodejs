/*******************************************************************************
* Copyright (c) 2016 IBM Corp.
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
  , log4js = require('log4js');
var settings = JSON.parse(fs.readFileSync('settings.json', 'utf8'));

log4js.configure('log4js.json', {});
var logger = log4js.getLogger('monolithic_app');
logger.setLevel(settings.loggerLevel);

// disable process.env.PORT for now as it cause problem on mesos slave
var port = (process.env.VMC_APP_PORT || process.env.VCAP_APP_PORT || settings.supportservice_port);
var host = (process.env.VCAP_APP_HOST || 'localhost');

logger.info("host:port=="+host+":"+port);

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

// Setup express with 4.0.0
var app = express();
var expressWs = require('express-ws')(app); 
var morgan         = require('morgan');
var bodyParser     = require('body-parser');
var methodOverride = require('method-override');
var cookieParser = require('cookie-parser');

app.use(settings.supportContextRoot,express.static(__dirname + '/public'));     	// set the static files location /public/img will be /img for users
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

var websocket = new require('./websocketservice/index.js')();

// connect to websocket (may be a better way?)
app.ws(settings.supportContextRoot + '/supportrequest', function(ws, req) {
	websocket.chat(ws);
});


// Only initialize DB after initialization of the authService is done
var serverStarted = false;


startServer();


function checkStatus(req, res){
	res.sendStatus(200);
}


function startServer() {
	if (serverStarted ) return;
	serverStarted = true;
	app.listen(port);   
	console.log('Application started port ' + port);
}
