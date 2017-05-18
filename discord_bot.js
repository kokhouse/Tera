// Init Requirements
var env = require('dotenv').config();
var fs = require('fs');
var Promise = require('promise');
var request = require('request-promise');

try {
	var Discord = require("discord.js");
} catch (e){
	console.log(e.stack);
	console.log(process.version);
	console.log("hmm surely u didn't do something correct pallo!");
	process.exit();
}
console.log("Starting DiscordBot\nNode version: " + process.version + "\nDiscord.js version: " + Discord.version);


// Init AWS S3
var AWS = require('aws-sdk');
var s3 = new AWS.S3();

function downloadConfig(config){
	return new Promise(function (fulfill, reject){
		s3.getObject({
			Bucket: process.env.S3_BUCKET_NAME,
			Key: config + '.json'
		}, function(err, data){
			if(err){
				console.log(err);
				reject(err);
			} else {
				console.log('Downloaded ' + config + '.json, size: ' + data.Body.length);
				fulfill(JSON.parse(data.Body.toString()));
			}
		});
	})
}

function uploadConfig(config){
	var filename = './' + config + '.json';
	var fileBuffer = require('fs').readFileSync(filename);
	//var metaData = getContentTypeByFile(filename);

	s3.putObject({
		Bucket: process.env.S3_BUCKET_NAME,
		Key: config + '.json',
		Body: fileBuffer
	}, function(err, data){
		if(err){
			console.log('File upload failed for ' + filename);
			console.log(err);
		} else {
			console.log('Uploaded file ' + filename + ' to the cloud.');
		}
	});
}
