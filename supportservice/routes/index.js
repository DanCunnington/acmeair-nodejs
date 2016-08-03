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

module.exports = function (loadUtil, dbtype, settings) {
    var module = {};
    var debug = require('debug')('support');
	var uuid = require('node-uuid');
	var log4js = require('log4js');
	var watson = require('watson-developer-cloud');

	//initialize for Watson services
	var vcapUrl = null;
	var vcapUsername = null;
	var vcapPassword = null;
	
	if (process.env.VCAP_SERVICES) {
        var services = JSON.parse(process.env.VCAP_SERVICES);
        for (var service_name in services) {
            if (service_name.indexOf('dialog') === 0) {
                var service = services[service_name][0];
                vcapUrl = service.credentials.url;
                vcapUsername = service.credentials.username;
                vcapPassword = service.credentials.password;
            }
        }
    }
	
	var dialog = watson.dialog({
		url: vcapUrl || settings.watsontUrl,
		username : vcapUsername || settings.watsonUsername,
		password : vcapPassword || settings.watsonPassword,
		version : settings.watsonVersion
	});
	
	//logging configurations
	log4js.configure('log4js.json', {});
	var logger = log4js.getLogger('support');
	logger.setLevel(settings.loggerLevel);


	module.getSupportWSPort = function(req,res) {
		var port = settings.websocketPort.toString();
		res.send(port);
	};
	
	module.getSupportInitInfo = function(req,res) {
		
		var dialog_id = null;
		res.clearCookie('dialogID');
		res.clearCookie('conversationID');
		res.clearCookie('clientID');
		
		
		dialog.getDialogs({}, function (err, dialogs) {
		
			if (err)
				logger.debug('error:', err);
			else {
				logger.debug ('Dialogs : ', dialogs );
				
				var doesDialogExist = false;
				dialogs.dialogs.filter(function(item) {
					if(item.name == settings.watsonDialogName){
						logger.debug ('Item : ', item );
						logger.debug ('dialog_id : ', item.dialog_id );
						dialog_id = item.dialog_id;
						res.cookie('dialogID', dialog_id);
						doesDialogExist = true;
						//To update the dialog, set watsonUpdateDialog true, and update watsonDialogFile.
						if (settings.watsonUpdateDialog){
							var fs = require('fs');
							var params = {
									dialog_id: dialog_id,
									file: fs.createReadStream('./websocket/' + settings.watsonDialogFile)
							};
							dialog.updateDialog(params, function(err, update){
								logger.debug ('Update Message : ',update);
								logger.debug ('Error : ',err);
							});
						}else {
							logger.debug ("NO DIALOG UPDATE");
						}
					}
				});
				/*If the Dialog does not exist, create the dialog.
				 * Set the Dialog name & file name in settings.json
				 */
				if (!doesDialogExist){
					var fs = require('fs');
					var params = {
						  name: settings.watsonDialogName,
						  file: fs.createReadStream('./websocket/' + settings.watsonDialogFile)
					};
					dialog.createDialog(params, function(err, newDialog){
						logger.debug ('dialog name : ',settings.watsonDialogName);
						logger.debug ('Error : ',err);
						logger.debug ('dialog_id : ', newDialog.dialog_id );
						dialog_id = newDialog.dialog_id;
						res.cookie('dialogID', dialog_id);
					});
				}
			}
			res.send(JSON.stringify({"agent" : "Server Message", "message":"Please wait for a moment. Agent will be with you shortly."}));
		});
		
	};
	
	module.getSupportService = function(req,res) {
		
		var dialog_id = req.cookies.dialogID;
		var conversation_id = req.cookies.conversationID;
		var client_id = req.cookies.clientID;
				
		
		//if the dialog have been initialized
		if(dialog_id){
			
			//if the conversation haven't been started
			if(!conversation_id){
				var params = { dialog_id: dialog_id};

				dialog.conversation(params, function(err, results) {
					res.cookie('conversationID', results.conversation_id);
					res.cookie('clientID', results.client_id);
					if (err)
						return JSON.stringify(err, null, 2);
					else if (!results){
						return "Result is null";
					} else {
						logger.debug ('Results : ' , results);
						logger.debug ('conversation_id : ' , results.conversation_id);
						logger.debug ('client_id : ' , results.client_id);
						res.send(JSON.stringify({"agent" : "Watson", "message":results.response[0]}));
					}
				});
			} else {
				var message = req.body.message;
				params = { dialog_id: dialog_id, conversation_id: conversation_id, input: message};
				
				dialog.conversation(params, function message(err, results) {
						var returnMessage = "";
						
						if (err)
							return JSON.stringify(err, null, 2);
						
						logger.debug ('Results : ' , results);
						logger.debug ('conversation_id : ' , conversation_id);
						logger.debug ('client_id : ' , client_id);

						if (results && results.response[0] && results.response[0].indexOf('Itinerary') > -1 ){
							logger.debug ('End of conversation');
							params = { dialog_id: dialog_id, client_id: results.client_id};
							dialog.getProfile(params, function(err, profile) {
								if (err)
									return JSON.stringify(err, null, 2);
								else
									loadUtil.searchFlights(profile.name_values[0].value, profile.name_values[1].value, profile.name_values[2].value=='true', new Date(), new Date(), function(values){
										values.tripFlights.forEach(function(entries, index) {
										  entry = entries.flightsOptions[0];
										  logger.debug({"agent" : "Watson", "message": 
											  results.response[0] +
											  (index == 0 ? "\nOUTBOUND - " : "\nINBOUND - " ) +
											  " Airplane : " + entry['airplaneTypeId'] + 
											  " Flight : " + entry['flightSegmentId'] + 
											  "\nDeparture : " + (index == 0 ? profile.name_values[0].value : profile.name_values[1].value ) + " " + entry['scheduledDepartureTime'] +
											  "\nArrival : " + (index == 0 ? profile.name_values[1].value : profile.name_values[0].value ) + " " + entry['scheduledArrivalTime'] +
											  "\n\nPlease login and reserve flights for reservation in the flights tab.\nIs there anything else that I can help you with?"});
										  res.send(JSON.stringify({"agent" : "Watson", "message": 
											  results.response[0] +
											  (index == 0 ? "\nOUTBOUND - " : "\nINBOUND - " ) +
											  " Airplane : " + entry['airplaneTypeId'] + 
											  " Flight : " + entry['flightSegmentId'] + 
											  "\nDeparture : " + (index == 0 ? profile.name_values[0].value : profile.name_values[1].value ) + " " + entry['scheduledDepartureTime'] +
											  "\nArrival : " + (index == 0 ? profile.name_values[1].value : profile.name_values[0].value ) + " " + entry['scheduledArrivalTime'] +
											  "\n\nPlease login and reserve flights for reservation in the flights tab.\nIs there anything else that I can help you with?"}));
										});
									});
							});
						} else {
							res.send(JSON.stringify({"agent" : "Watson", "message":results.response[0]}));
						}
				});
			}
		}	
		
	};

	return module;
}

