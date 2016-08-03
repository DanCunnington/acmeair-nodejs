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

module.exports = function (proxyUrl, dbtype, settings) {
    var module = {};
	var uuid = require('node-uuid');
	var log4js = require('log4js');
	var http = require('http')
	var flightCache = require('ttl-lru-cache')({maxLength:settings.flightDataCacheMaxSize});
	var flightSegmentCache = require('ttl-lru-cache')({maxLength:settings.flightDataCacheMaxSize});
	var flightDataCacheTTL = settings.flightDataCacheTTL == -1 ? null : settings.flightDataCacheTTL; 
	
	log4js.configure('log4js.json', {});
	var logger = log4js.getLogger('main/routes');
	logger.setLevel(settings.loggerLevel);

	module.toGMTString  = function(req, res) {
		logger.info('******* running eyecatcher function');
		var now = new Date().toGMTString();
		res.send(now);
	};
	
	module.getRuntimeInfo = function(req,res) {
		var runtimeInfo = [];
		runtimeInfo.push({"name":"Runtime","description":"NodeJS"});
		var versions = process.versions;
		for (var key in versions) {
			runtimeInfo.push({"name":key,"description":versions[key]});
		}
		res.contentType('application/json');
		res.send(JSON.stringify(runtimeInfo));
	};
	
	module.getDataServiceInfo = function(req,res) {
		var dataServices = [{"name":"cassandra","description":"Apache Cassandra NoSQL DB"},
		                    {"name":"cloudant","description":"IBM Distributed DBaaS"},
		                    {"name":"mongo","description":"MongoDB NoSQL DB"}];
		res.send(JSON.stringify(dataServices));
	};
	
	module.getActiveDataServiceInfo = function (req,res) {
		res.send(dbtype);
	};
			
		
	return module;
}

