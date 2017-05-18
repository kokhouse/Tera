exports.commands = [
	"aesthetic"
]

// Full-width text dictionary

// Commands for ppl who think 2012 memes are funny lmao

exports.aesthetic = {
	description: "ａｅｓｔｈｅｔｉｃ",
	process: function(bot,msg,suffix){
		var text = suffix;
		if(text.length > 2000){
			msg.channel.sendMessage("Too much vapourwave");
			return;
		}
		for(var char in aesthetic){
			text = text.split(char).join(aesthetic[char]);
		}
		msg.channel.sendMessage(text);
	}
}

var aesthetic = {
  " ": "　",
  "`": "`",
  "1": "１",
  "2": "２",
  "3": "３",
  "4": "４",
  "5": "５",
  "6": "６",
  "7": "７",
  "8": "８",
  "9": "９",
  "0": "０",
  "-": "－",
  "=": "＝",
  "~": "~",
  "!": "！",
  "@": "＠",
  "#": "＃",
  "$": "＄",
  "%": "％",
  "^": "^",
  "&": "＆",
  "*": "＊",
  "(": "（",
  ")": "）",
  "_": "_",
  "+": "＋",
  "q": "ｑ",
  "w": "ｗ",
  "e": "ｅ",
  "r": "ｒ",
  "t": "ｔ",
  "y": "ｙ",
  "u": "ｕ",
  "i": "ｉ",
  "o": "ｏ",
  "p": "ｐ",
  "[": "[",
  "]": "]",
  "\\": "\\",
  "Q": "Ｑ",
  "W": "Ｗ",
  "E": "Ｅ",
  "R": "Ｒ",
  "T": "Ｔ",
  "Y": "Ｙ",
  "U": "Ｕ",
  "I": "Ｉ",
  "O": "Ｏ",
  "P": "Ｐ",
  "{": "{",
  "}": "}",
  "|": "|",
  "a": "ａ",
  "s": "ｓ",
  "d": "ｄ",
  "f": "ｆ",
  "g": "ｇ",
  "h": "ｈ",
  "j": "ｊ",
  "k": "ｋ",
  "l": "ｌ",
  ";": "；",
  "'": "＇",
  "A": "Ａ",
  "S": "Ｓ",
  "D": "Ｄ",
  "F": "Ｆ",
  "G": "Ｇ",
  "H": "Ｈ",
  "J": "Ｊ",
  "K": "Ｋ",
  "L": "Ｌ",
  ":": "：",
  "\"": "\"",
  "z": "ｚ",
  "x": "ｘ",
  "c": "ｃ",
  "v": "ｖ",
  "b": "ｂ",
  "n": "ｎ",
  "m": "ｍ",
  ",": "，",
  ".": "．",
  "/": "／",
  "Z": "Ｚ",
  "X": "Ｘ",
  "C": "Ｃ",
  "V": "Ｖ",
  "B": "Ｂ",
  "N": "Ｎ",
  "M": "Ｍ",
  "<": "<",
  ">": ">",
  "?": "？"
};