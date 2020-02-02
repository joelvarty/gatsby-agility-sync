require("dotenv").config({
	path: `.env.${process.env.NODE_ENV}`,
})

//the default storage provider is local files...


module.exports = {
	guid: process.env.AGILITY_GUID,
	apiKey: process.env.AGILITY_API_KEY,
	isPreview: process.env.AGILITY_API_ISPREVIEW,
	languageCodes: process.env.AGILITY_LANGUAGES,
	channels: process.env.AGILITY_CHANNELS,
	debug: process.env.AGILITY_DEBUG == "true"

}