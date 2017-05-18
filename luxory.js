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
// Load configuration and other assets
var Config = downloadConfig('config');
var aliases = downloadConfig('alias');
var Permissions = downloadConfig('permissions');
var twitch = downloadConfig('twitch');

Promise.all([Config, aliases, Permissions, twitch]).then(values=>{
	Config = values[0];
	aliases = values[1];
	Permissions = values[2];
	twitch = values[3];
	run();
});


function run(){
// Load permissions
var dangerousCommands = ["eval","pullanddeploy","setUsername", "permit", "gpermit", "setkey", "getkey"];

for( var i=0; i<dangerousCommands.length;i++ ){
	var cmd = dangerousCommands[i];
	if(!Permissions.global.hasOwnProperty(cmd)){
		Permissions.global[cmd] = false;
	}
}
Permissions.checkPermission = function (user,permission){
	try {
		var allowed = true;
		try{
			if(Permissions.global.hasOwnProperty(permission)){
				allowed = Permissions.global[permission] === true;
			}
		} catch(e){}
		try{
			if(Permissions.users[user.id].hasOwnProperty(permission)){
				allowed = Permissions.users[user.id][permission] === true;
			}
		} catch(e){}
		return allowed;
	} catch(e){}
	return false;
}


// Load config data
// TODO: Use Config data and update Config.json when changing values
if(Config.length <= 0){
	Config.debug = false;
	Config.commandPrefix = '!';
	Config.maxFrakons = 15;
	Config.admin = "";
}
if(!Config.hasOwnProperty("commandPrefix")){
	Config.commandPrefix = '!';
}

var messagebox;
var Quote = {};
Quote = require("./quote.json");

var keys = Object.keys(Quote);
var swears = require("./swearwords.json");


var commands = {
	"alias": {
		usage: "<name> <actual command>",
		description: "Creates command aliases. Useful for making simple commands on the fly",
		process: function(bot,msg,suffix) {
			var args = suffix.split(" ");
			var name = args.shift();
			if(!name){
				msg.channel.sendMessage(Config.commandPrefix + "alias " + this.usage + "\n" + this.description);
			} else if(commands[name] || name === "help"){
				msg.channel.sendMessage("overwriting commands with aliases is not allowed!");
			} else {
				var command = args.shift();
				aliases[name] = [command, args.join(" ")];
				//now save the new alias
				require("fs").writeFile("./alias.json",JSON.stringify(aliases,null,2), function(){
					uploadConfig('alias');
				});
				msg.channel.sendMessage("created alias " + name);
			}
		}
	},
	"ralias": {
		usage: "<alias>",
		description: "Removes an alias command.",
		process: function(bot, msg, suffix){
			var name = suffix.split(" ")[0];
			if(aliases[suffix]){
				delete aliases[suffix];
				require("fs").writeFile("./alias.json",JSON.stringify(aliases,null,2), function(){
					uploadConfig('alias');
				});
				msg.channel.sendMessage("Deleted alias " + name + ".");
			} else {
				msg.channel.sendMessage("No alias " + name + " found.");
			}
		}
	},
	"aliases": {
		description: "lists all recorded aliases",
		process: function(bot, msg, suffix) {
			var text = "Current aliases:\n";
			for(var a in aliases){
				if(typeof a === 'string')
					text += a + " ";
			}
			msg.channel.sendMessage(text);
		}
	},
	"getkey": {
		usage: "<key>",
		description: "Get the value of a configuration key if it exists",
		process: function(bot, msg, suffix){
			var text = "Current keys:\n";
			var args = suffix.split(' ');
			switch(args[0].length){
				case 0:
					for(var c in Config){
						var cmd = c + ": " + Config[c] + "\n";
						if (text.length + cmd.length > 2000){
							msg.channel.sendMessage(text);
							text = "";
						} else 
							text += cmd;
					}
					break;
				default:
					if(Config[args[0]]){
						text += args[0] + ": " + Config[args[0]];
					} else 
						text = "No key found";
					break;
			}
			// Send out message
			if(text.length > 0)
				msg.channel.sendMessage(text);
		}
	},
	"setkey": {
		usage: "<key> <value>",
		description: "Add or update the value of a configuration entry",
		process: function(bot, msg, suffix) {
			var args = suffix.split(' ');
			switch(args.length){
				case 0:
				case 1:
					msg.channel.sendMessage("Not enough arguments.");
					return;
				case 2:
					var key = args[0];
					var val = args[1];
					if(Config[key]){
						if(val.length > 0){
							Config[key] = val;
							require("fs").writeFile("./Config.json",JSON.stringify(Config,null,2), function(){
								uploadConfig('config');
							});
							msg.channel.sendMessage("Set " + key + " to " + val);
						}
					}
					break;
				default:
					msg.channel.sendMessage("Too many arguments.");
					return;
			}
		}
	},
	"permit": {
		usage: "<command> <user> <0||1>",
		description: "Grant or remove command permission to user",
		process: function(bot, msg, suffix){
			var args = suffix.split(' ');
			if(args.length != 3){
				msg.channel.sendMessage("Insufficient arguments my dude.");
				return;
			}
			var cmd = args[0];
			var user = args[1];
			var flag = args[2];

			if(flag != 0 && flag != 1){
				msg.channel.sendMessage("Flag should be 0 or 1");
				return;
			}

			//Check for Command
			if(!commands[cmd]){
				msg.channel.sendMessage("Command " + cmd + " does not exist.");
				return;
			} 
			
			//Check for User
			var userId = "";
			if(user.startsWith('<@')){
				userId = user.substr(2,user.length-3);
				console.log(userId);
				var ids = msg.channel.guild.members.filter((member) => member.user.id == userId).array();
				if(ids.length != 1){
					msg.channel.sendMessage(id.length + " users found for " + user);
					return;
				}
			} else {
				var users = msg.channel.guild.members.filter((member) => member.user.username == user).array();
				if(users.length != 1){
					msg.channel.sendMessage(users.length + " users found for " + user);
					return;
				}
				userId = users[0].user.id;
			}


			if(userId == ""){
				msg.channel.sendMessage("No id found for " + user);
				return;
			}
			if(userId == Config.admin && msg.author.id != Config.admin){
				msg.channel.sendMessage("Can't let you do that, " + msg.author);
				return;
			}

			//Check flag
			var verb;
			if(flag == 1){
				verb = "Granted";
				flag = true;
			} else {
				verb = "Removed";
				flag = false;
			}

			//Update permission
			var perms = Permissions.users[userId];
			Permissions.users[userId] = {};
			if(perms){
				Permissions.users[userId] = perms;
			}
			Permissions.users[userId][cmd] = flag;
			fs.writeFile("./permissions.json",JSON.stringify(Permissions,null,2), function(){
				uploadConfig('permissions');
			});
			msg.channel.sendMessage(verb + " permission for " + cmd + " to " + user);
		}
	},
	"gpermit": {
		usage: "<command> <0||1>",
		description: "Grant or remove command permission to global",
		process: function(bot,msg,suffix){
			if(msg.author.id != Config.admin){
				msg.channel.sendMessage("Can't let you do that, " + msg.author);
				return;
			}
			var args = suffix.split(' ');
			if(args.length != 2){
				msg.channel.sendMessage("Insufficient arguments my dude.");
				return;
			}
			var cmd = args[0];
			var flag = args[1];

			if(flag != 0 && flag != 1){
				msg.channel.sendMessage("Flag should be 0 or 1 plz");
				return;
			}

			//Check for Command
			if(!commands[cmd]){
				msg.channel.sendMessage("Command " + cmd + " does not exist.");
				return;
			} 

			//Check flag
			var verb;
			if(flag == 1){
				verb = "Granted";
				flag = true;
			} else {
				verb = "Removed";
				flag = false;
			}

			//Update permission
			Permissions.global[cmd] = flag;
			fs.writeFile("./permissions.json",JSON.stringify(Permissions,null,2), function(){
				uploadConfig('permissions');
			});
			msg.channel.sendMessage(verb + " permission for " + cmd + " to _all_");
		}
	},
	"ping": {
		description: "responds pong, useful for checking if bot is alive",
		process: function(bot, msg, suffix) {
			msg.channel.sendMessage( msg.author+" pong!");
			if(suffix){
				msg.channel.sendMessage( "note that !ping takes no arguments!");
			}
		}
	},
	"idle": {
		usage: "[status]",
		description: "sets bot status to idle",
		process: function(bot,msg,suffix){ 
			bot.user.setStatus("idle");
			bot.user.setGame(suffix);
		}
	},
	"online": {
		usage: "[status]",
		description: "sets bot status to online",
		process: function(bot,msg,suffix){ 
			bot.user.setStatus("online");
			bot.user.setGame(suffix);
		}
	},
	"say": {
		usage: "<message>",
		description: "bot says message",
		process: function(bot,msg,suffix){ msg.channel.sendMessage(suffix);}
	},
	"announce": {
		usage: "<message>",
		description: "bot says message with text to speech",
		process: function(bot,msg,suffix){ msg.channel.sendMessage(suffix,{tts:true});}
	},
	"msg": {
		usage: "<user> <message to leave user>",
		description: "leaves a message for a user the next time they come online",
		process: function(bot,msg,suffix) {
			var args = suffix.split(' ');
			var user = args.shift();
			var message = args.join(' ');
			if(user.startsWith('<@')){
				user = user.substr(2,user.length-3);
			}
			var target = msg.channel.guild.members.find("id",user);
			if(!target){
				target = msg.channel.guild.members.find("username",user);
			}
			messagebox[target.id] = {
				channel: msg.channel.id,
				content: target + ", " + msg.author + " said: " + message
			};
			updateMessagebox();
			msg.channel.sendMessage("message saved.")
		}
	},
	"eval": {
		usage: "<command>",
		description: 'Executes arbitrary javascript in the bot process. User must have "eval" permission',
		process: function(bot,msg,suffix) {
			if(Permissions.checkPermission(msg.author,"eval")){
				msg.channel.sendMessage( eval(suffix,bot));
			} else {
				msg.channel.sendMessage( msg.author + " is too much of a weenie to run eval()");
			}
		}
	},
	"luxpls": {
		usage: "Luxory pls",
		description: "Message a plz to Luxory",
		process: function(bot,msg,suffix){
			msg.channel.sendMessage(Config.plz + " __***Luxory pls***__");
			if(suffix){
				msg.channel.sendMessage( "*No args required, dumbass*");
			}
		}
	},
	"frakon": {
		usage: "Frakon <number> <number>",
		description: "Summon a squad, tower or matrix of up to maxFrakons Frakons",
		process: function(bot,msg,suffix){
			var args = suffix.split(' ');
			var fraks = "";
			var maxFrakons = Config.maxFrakons;
			//var count = 0;
			switch(args.length){
				case 1:
				//Frakon
				var count = parseInt(suffix,10);
				count = (count > maxFrakons ? maxFrakons : count);

				for(var i = 0; i<count; i++){
					if(fraks.length + Config.frakon.length < 2000){
						fraks += Config.frakon;
					} else {
						msg.channel.sendMessage(fraks);
						continue;
					}
				}
				msg.channel.sendMessage(fraks);
				break;

				case 2:
				//Matrix
				var x = parseInt(args[0], 10); var y = parseInt(args[1], 10);
				if(x > maxFrakons || y > maxFrakons){
					msg.channel.sendMessage("_Too many Frakons. Only "+ maxFrakons+ " allowed._");
				}
				x = (x > maxFrakons ? maxFrakons : x);
				y = (y > maxFrakons ? maxFrakons : y);

				for(var i = 0; i<x; i++){
					if(fraks.length + Config.frakon.length < 2000){
						fraks += Config.frakon;
					}
					else
					{
					 fraks += Config.frakon+"\n";
					}
				}
				for(var i = 0; i<y; i++){
					msg.channel.sendMessage(fraks);
				}
				break;

				default:
				msg.channel.sendMessage("I don't even. Use -help you dingus.")
			}
		}
	},
	"owpatch": {
		usage: "owpatch",
		description: "Link to the latest Overwatch patch notes",
		process: function(bot, msg, suffix){
			var url = "https://playoverwatch.com/en-us/game/patch-notes/pc/";
			msg.channel.sendMessage(url);
		}
	},
	"owstats": {
		usage: "owstats <BlizzID>",
		description: "Generates MasterOverwatch URL for Blizard ID",
		process: function(bot, msg, suffix){
			const regex = /^\w+[#]\d+$/g;
			if(regex.test(suffix)){
				var bID = suffix.replace("#", "-");
				msg.channel.sendMessage("https://masteroverwatch.com/profile/pc/us/" + bID);
			} else {
				msg.channel.sendMessage("I need the whole ID with the #, weenie.");
			}
		}
	},
	"sailormode": {
		usage: "sailormode",
		description: "Toggle sailor mode on or off",
		process: function(bot, msg, suffix){
			Config["sailorMode"] = !Config["sailorMode"];
			require("fs").writeFile("./Config.json",JSON.stringify(Config,null,2), function(){
				uploadConfig('config');
			});
			msg.channel.sendMessage("Sailor mode is now " + Config.sailorMode);
		}
	},
	"weather" : {
		usage: "weather <city> <country code>",
    	description: "Get the weather of a city",
    	process: function(bot, msg, suffix){
		var params = suffix.split(" ");
		var query = "";
		if(params.length == 1){
			query = params[0];
		} else {
			query = params[0]+","+params[1];
		}
		// query = CITY,COUNTRYCODE
		// units = IMPERIAL||METRIC
		var req = "http://api.openweathermap.org/data/2.5/weather?q="+query+"&units="+Config.weatherUnits+"&APPID="+
			process.env.OPENWEATHERMAP_KEY;
		console.log(req);
		request(req, function(err, res, body) {
			if(err){
				console.log(err);
			}

			var data;
			try {
				data = JSON.parse(body.toString());
			} catch (e) {
				console.log(e)
				return;
			}
			if(!data){
				console.log(err);
				msg.channel.sendMessage( "Error getting weather");
				return;
			}
			else if (!data["name"] || !data["weather"]){
				console.log(data);
				msg.channel.sendMessage( "No result for '" + query + "'");
				return;
			}
			var emoji = "";
			console.log(data);
			switch(data["weather"][0]["main"].toLowerCase()){
				case "clear":
					emoji = " :sunny:";
					break;
				case "rain":
				case "drizzle":
					emoji = " :cloud_rain:";
					break;
				case "clouds":
					emoji = " :cloud: ";
					break;
				case "snow":
					emoji = " :cloud_snow: ";
					break;
			    case "extreme":
					emoji = " :thunder_cloud_rain: ";
					break;
				default:
					emoji = " :shrug:";
			}
			var weather = "Weather for " + data["name"] + ":\n" +
				data["weather"][0]["description"] + emoji + "\n" +
				"Temperature: " + data["main"]["temp"] + "°C";
			msg.channel.sendMessage(weather);
		});
    	}
	}
};

if(process.env.CLIENT_ID){
	commands["invite"] = {
		description: "generates an invite link you can use to invite the bot to your server",
		process: function(bot,msg,suffix){
			msg.channel.sendMessage("invite link: https://discordapp.com/oauth2/authorize?&client_id=" + process.env.CLIENT_ID + "&scope=bot&permissions=8");
		}
	}
}

if(keys.length > 0){
	keys.forEach(function(element){
		commands[element] = {
			usage: element,
			description: "Return random entry from " + element,
			process: function(bot,msg,suffix){
				var quotes = Quote[element];
				var quote = quotes[Math.floor(Math.random() * (quotes.length))];
				msg.channel.sendMessage(quote);
			}
		}
	});
}

try{
	messagebox = require("./messagebox.json");
} catch(e) {
	//no stored messages
	messagebox = {};
}

function updateMessagebox(){
	require("fs").writeFile("./messagebox.json",JSON.stringify(messagebox,null,2), null);
}

function checkTwitch(){
	var urls = [];
	var usernames = [];
	for(var username in twitch){
		var req = "https://api.twitch.tv/kraken/streams/"+username+"?client_id="+process.env.TWITCH_CLIENT_ID;
		urls.push(req);
		usernames.push(username);
	}
	
	var promises = urls.map(url => request(url));

	Promise.all(promises).then(data => {
		for(var i=0; i < data.length; i++){
			var stream = JSON.parse(data[i]);
			if(stream.stream){
				if(twitch[usernames[i]]) continue;
				hook.sendMessage( stream.stream.channel.display_name
					+" is online, playing "
					+stream.stream.game
					+"\n"+stream.stream.channel.url)
				twitch[usernames[i]] = true;
			} else {
				//console.log(usernames[i] + " is offline");
				twitch[usernames[i]] = false;
			}
		}
	});
}



var bot = new Discord.Client();
var hook = new Discord.WebhookClient(process.env.WEBHOOK_ID, process.env.WEBHOOK_SECRET);

bot.on("ready", function () {
	console.log("Logged in! Serving in " + bot.guilds.array().length + " servers");
	require("./plugins.js").init();
	console.log("type "+Config.commandPrefix+"help in Discord for a commands list.");
	bot.user.setGame(Config.commandPrefix+"help | " + bot.guilds.array().length +" Servers");
	// Set Twitch checker if hook and twitch config exist 
	if(hook){
		if(twitch){
			setInterval(function(){
				checkTwitch();
			},90000);	
		}
	}
});

bot.on("disconnected", function () {
	console.log("Disconnected!");
	process.exit(1); //exit node.js with an error

});

function checkMessageForCommand(msg, isEdit) {
	//check if message is a command
	if(msg.author.id != bot.user.id && (msg.content.startsWith(Config.commandPrefix))){
		console.log("treating " + msg.content + " from " + msg.author + " as command");
		var cmdTxt = msg.content.split(" ")[0].substring(Config.commandPrefix.length);
        var suffix = msg.content.substring(cmdTxt.length+Config.commandPrefix.length+1);//add one for the ! and one for the space
        if(msg.isMentioned(bot.user)){
        	try {
        		cmdTxt = msg.content.split(" ")[1];
        		suffix = msg.content.substring(bot.user.mention().length+cmdTxt.length+Config.commandPrefix.length+1);
			} catch(e){ //no command
				msg.channel.sendMessage("Yes?");
				return;
			}
		}
		alias = aliases[cmdTxt];
		if(alias){
			console.log(cmdTxt + " is an alias, constructed command is " + alias.join(" ") + " " + suffix);
			cmdTxt = alias[0];
			suffix = alias[1] + " " + suffix;
		}
		var cmd = commands[cmdTxt];
		if(cmdTxt === "help"){
            //help is special since it iterates over the other commands
            if(suffix){
            	var cmds = suffix.split(" ").filter(function(cmd){return commands[cmd]});
            	var info = "";
            	for(var i=0;i<cmds.length;i++) {
            		var cmd = cmds[i];
            		info += "**"+Config.commandPrefix + cmd+"**";
            		var usage = commands[cmd].usage;
            		if(usage){
            			info += " " + usage;
            		}
            		var description = commands[cmd].description;
            		if(description instanceof Function){
            			description = description();
            		}
            		if(description){
            			info += "\n\t" + description;
            		}
            		info += "\n"
            	}
            	msg.channel.sendMessage(info);
            } else {
            	msg.author.sendMessage("**Available Commands:**").then(function(){
            		var batch = "";
            		var sortedCommands = Object.keys(commands).sort();
            		for(var i in sortedCommands) {
            			var cmd = sortedCommands[i];
            			var info = "**"+Config.commandPrefix + cmd+"**";
            			var usage = commands[cmd].usage;
            			if(usage){
            				info += " " + usage;
            			}
            			var description = commands[cmd].description;
            			if(description instanceof Function){
            				description = description();
            			}
            			if(description){
            				info += "\n\t" + description;
            			}
            			var newBatch = batch + "\n" + info;
									if(newBatch.length > (1024 - 8)){ //limit message length
										msg.author.sendMessage(batch);
										batch = info;
									} else {
										batch = newBatch
									}
								}
								if(batch.length > 0){
									msg.author.sendMessage(batch);
								}
							});
            }
        }
        else if(cmd) {
        	if(Permissions.checkPermission(msg.author,cmdTxt)){
        		try{
        			cmd.process(bot,msg,suffix,isEdit);
        		} catch(e){
        			var msgTxt = "command " + cmdTxt + " failed <:weenie:299962998695395348>";
        			if(Config.debug){
        				msgTxt += "\n" + e.stack;
        			}
        			msg.channel.sendMessage(msgTxt);
        		}
        	} else {
        		msg.channel.sendMessage("You are not allowed to run " + cmdTxt + "!");
        	}
        } else {
        	msg.channel.sendMessage(cmdTxt + " not recognized as a command!").then((message => message.delete(5000)))
        }
    } else {
		//message isn't a command or is from us
        //drop our own messages to prevent feedback loops
        if(msg.author == bot.user){
        	return;
        }

        if(Config.sailorMode){
        	var words = msg.content.split(' ');
        	if(words.length >= 3){
        		var counter = 0;
        		words.forEach(function(element){
        			if(swears.indexOf(element.toLowerCase()) >= 0){
        				counter++;
        			}
        		});
        		if(counter > Config.maxSwears){
        			console.log(counter);
        			msg.delete(1000);
        			msg.channel.sendMessage(msg.author + ", do you kiss your mother with that mouth?");
        			return;
        		}
        	}
        }

        if (msg.author != bot.user && msg.isMentioned(bot.user)) {
        	msg.channel.sendMessage(msg.author + ", may I take your order, weenie?");
        } else {

        }
    }
}

bot.on("message", (msg) => checkMessageForCommand(msg, false));
bot.on("messageUpdate", (oldMessage, newMessage) => {
	checkMessageForCommand(newMessage,true);
});

//Log user status changes
bot.on("presence", function(user,status,gameId) {
	//if(status === "online"){
	//console.log("presence update");
	console.log(user+" went "+status);
	//}
	try{
		if(status != 'offline'){
			if(messagebox.hasOwnProperty(user.id)){
				console.log("found message for " + user.id);
				var message = messagebox[user.id];
				var channel = bot.channels.get("id",message.channel);
				delete messagebox[user.id];
				updateMessagebox();
				bot.sendMessage(channel,message.content);
			}
		}
	}catch(e){}
});


exports.addCommand = function(commandName, commandObject){
	try {
		commands[commandName] = commandObject;
	} catch(err){
		console.log(err);
	}
}
exports.commandCount = function(){
	return Object.keys(commands).length;
}
if(process.env.BOT_TOKEN){
	console.log("logging in with token");
	bot.login(process.env.BOT_TOKEN);
} else {
	console.log("Logging in with user credentials is no longer supported!\nYou can use token based log in with a user account, see\nhttps://discord.js.org/#/docs/main/master/general/updating");
}

}